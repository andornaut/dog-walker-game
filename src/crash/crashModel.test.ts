import { describe, expect, it } from "vitest";

import {
  crashGate,
  type CrashReport,
  crashView,
  isCrash,
  reportFromErrorEvent,
  reportFromRejection,
} from "./crashModel";

const APP_URL = "https://dogwalker.test/assets/play-abc123.js";

function thrownAt(url: string, message = "boom"): Error {
  const error = new Error(message);
  error.stack = `Error: ${message}\n    at step (${url}:1:200)\n    at tick (${url}:1:900)`;
  return error;
}

const crash: CrashReport = { message: "boom", source: APP_URL, stack: thrownAt(APP_URL).stack };

describe("reportFromErrorEvent", () => {
  it("takes the message and stack from the thrown error, not the event's prefixed message", () => {
    const error = thrownAt(APP_URL);

    expect(
      reportFromErrorEvent({ error, filename: APP_URL, message: "Uncaught Error: boom" }),
    ).toEqual({ message: "boom", source: APP_URL, stack: error.stack });
  });

  it("falls back to the event's message when no error object came with it", () => {
    expect(reportFromErrorEvent({ error: null, filename: "", message: "Script error." })).toEqual({
      message: "Script error.",
      source: "",
      stack: undefined,
    });
  });

  it("names a thrown non-error value", () => {
    expect(reportFromErrorEvent({ error: "plain string", message: "" }).message).toBe(
      "plain string",
    );
  });
});

describe("reportFromRejection", () => {
  it("reads an Error reason", () => {
    const error = thrownAt(APP_URL, "save failed");

    expect(reportFromRejection(error)).toEqual({
      message: "save failed",
      source: "",
      stack: error.stack,
    });
  });

  it("names a reason that is not an Error, even one that cannot be stringified", () => {
    expect(reportFromRejection(42).message).toBe("42");
    expect(reportFromRejection(undefined).message).toBe("undefined");
    expect(reportFromRejection(Object.create(null)).message).toBe("[object Object]");
  });
});

describe("isCrash", () => {
  it("counts an error thrown by the game's own script", () => {
    expect(isCrash(crash)).toBe(true);
  });

  it.each([
    "chrome-extension://abcdef/content.js",
    "moz-extension://1234-5678/inject.js",
    "safari-web-extension://ABCD/script.js",
    "webkit-masked-url://hidden/",
  ])("ignores an error from an extension script (%s)", (url) => {
    expect(isCrash({ message: "boom", source: url, stack: undefined })).toBe(false);
  });

  it("ignores a rejection whose stack starts in an extension", () => {
    const { stack } = thrownAt("chrome-extension://abcdef/content.js");

    expect(isCrash({ message: "boom", source: "", stack })).toBe(false);
  });

  it("counts a rejection whose stack starts in the game", () => {
    expect(isCrash({ ...crash, source: "" })).toBe(true);
  });

  it("ignores a cross-origin script's opaque error", () => {
    expect(isCrash({ message: "Script error.", source: "", stack: undefined })).toBe(false);
    expect(isCrash({ message: "Script error", source: "", stack: undefined })).toBe(false);
  });

  it("counts an error whose message is 'Script error.' when it has a stack", () => {
    expect(isCrash({ ...crash, message: "Script error." })).toBe(true);
  });

  it.each([
    "ResizeObserver loop limit exceeded",
    "ResizeObserver loop completed with undelivered notifications.",
  ])("ignores the ResizeObserver warning (%s)", (message) => {
    expect(isCrash({ message, source: "", stack: undefined })).toBe(false);
  });
});

describe("crashGate", () => {
  it("opens the screen for the first crash only", () => {
    const accept = crashGate();

    expect(accept(crash)).toBe(true);
    expect(accept(crash)).toBe(false);
    expect(accept({ ...crash, message: "a different error" })).toBe(false);
  });

  it("lets an ignored error pass without using up the screen", () => {
    const accept = crashGate();

    expect(
      accept({ message: "ResizeObserver loop limit exceeded", source: "", stack: undefined }),
    ).toBe(false);
    expect(accept(crash)).toBe(true);
  });
});

describe("crashView", () => {
  it("says what happened, what is kept and how to recover", () => {
    expect(crashView(false, crash)).toEqual({
      action: "Reload",
      body: "Your saved progress is kept.",
      details: undefined,
      title: "Something went wrong",
    });
  });

  it("adds the stack in dev builds, once, when the stack already starts with the message", () => {
    expect(crashView(true, crash).details).toBe(crash.stack);
  });

  it("puts the message above a stack that leaves it out", () => {
    const stack = `step@${APP_URL}:1:200`;

    expect(crashView(true, { ...crash, stack }).details).toBe(`boom\n${stack}`);
  });

  it("shows only the message when there is no stack", () => {
    expect(crashView(true, { ...crash, stack: undefined }).details).toBe("boom");
  });
});
