import { describe, expect, it, vi } from "vitest";

import {
  activateWaitingWorker,
  type ContainerLike,
  createUpdatePrompt,
  NO_UPDATE,
  noticePlacement,
  type RegistrationLike,
  type ServiceWorkerLike,
  showsUpdateNotice,
  SKIP_WAITING_MESSAGE,
  watchForWaitingWorker,
} from "./updateReady";

class FakeWorker extends EventTarget implements ServiceWorkerLike {
  readonly messages: unknown[] = [];
  state = "installing";

  postMessage(message: unknown): void {
    this.messages.push(message);
  }
}

class FakeContainer extends EventTarget implements ContainerLike {
  constructor(public controller: unknown) {
    super();
  }

  takeOver(): void {
    this.dispatchEvent(new Event("controllerchange"));
  }
}

class FakeRegistration extends EventTarget implements RegistrationLike {
  installing: FakeWorker | null = null;
  waiting: FakeWorker | null = null;

  // A new version is found, installs and waits behind the running one.
  install(): FakeWorker {
    const worker = new FakeWorker();
    this.installing = worker;
    this.dispatchEvent(new Event("updatefound"));
    this.installing = null;
    this.waiting = worker;
    worker.state = "installed";
    worker.dispatchEvent(new Event("statechange"));
    return worker;
  }
}

const RUNNING_WORKER = {};

describe("showsUpdateNotice", () => {
  // Only for a waiting version, on the home screen, before Reload is pressed.
  const ready = { ...NO_UPDATE, onHome: true, waiting: true };
  it.each([
    { expected: true, name: "a waiting version on the home screen", state: ready },
    { expected: false, name: "no update", state: NO_UPDATE },
    { expected: false, name: "away from the home screen", state: { ...ready, onHome: false } },
    { expected: false, name: "no version waiting", state: { ...ready, waiting: false } },
    { expected: false, name: "after Reload is pressed", state: { ...ready, reloading: true } },
  ])("is $expected for $name", ({ expected, state }) => {
    expect(showsUpdateNotice(state)).toBe(expected);
  });
});

describe("watchForWaitingWorker", () => {
  it("reports a new version once it has installed behind the running one", () => {
    const registration = new FakeRegistration();
    const onWaiting = vi.fn();
    watchForWaitingWorker(new FakeContainer(RUNNING_WORKER), onWaiting, registration);
    expect(onWaiting).not.toHaveBeenCalled();
    const worker = registration.install();
    expect(onWaiting).toHaveBeenCalledExactlyOnceWith(worker);
  });

  it("reports a version already waiting at registration", () => {
    const registration = new FakeRegistration();
    const worker = new FakeWorker();
    registration.waiting = worker;
    const onWaiting = vi.fn();
    watchForWaitingWorker(new FakeContainer(RUNNING_WORKER), onWaiting, registration);
    expect(onWaiting).toHaveBeenCalledExactlyOnceWith(worker);
  });

  it("ignores a first install, which has no running version to wait behind", () => {
    const registration = new FakeRegistration();
    const onWaiting = vi.fn();
    watchForWaitingWorker(new FakeContainer(null), onWaiting, registration);
    registration.install();
    expect(onWaiting).not.toHaveBeenCalled();
  });
});

describe("activateWaitingWorker", () => {
  it("tells the worker to skip waiting and reloads once when it takes over", () => {
    const container = new FakeContainer(RUNNING_WORKER);
    const worker = new FakeWorker();
    const reload = vi.fn();
    activateWaitingWorker(container, reload, worker);
    expect(worker.messages).toEqual([SKIP_WAITING_MESSAGE]);
    expect(reload).not.toHaveBeenCalled();
    container.takeOver();
    container.takeOver();
    expect(reload).toHaveBeenCalledTimes(1);
  });
});

describe("createUpdatePrompt", () => {
  const setup = () => {
    const container = new FakeContainer(RUNNING_WORKER);
    const reload = vi.fn();
    const shown: boolean[] = [];
    const prompt = createUpdatePrompt(container, reload, (visible) => shown.push(visible));
    return { container, prompt, reload, shown };
  };

  it("shows the notice while a version waits and the home screen is in front", () => {
    const { prompt, shown } = setup();
    prompt.setOnHome(true);
    prompt.setWaiting(new FakeWorker());
    prompt.setOnHome(false);
    prompt.setOnHome(false);
    prompt.setOnHome(true);
    expect(shown).toEqual([true, false, true]);
  });

  it("never shows during a walk, waiting for the home screen", () => {
    const { prompt, shown } = setup();
    prompt.setOnHome(false);
    prompt.setWaiting(new FakeWorker());
    expect(shown).toEqual([]);
    prompt.setOnHome(true);
    expect(shown).toEqual([true]);
  });

  it("on Reload hides the notice, activates the waiting version and reloads on takeover", () => {
    const { container, prompt, reload, shown } = setup();
    const worker = new FakeWorker();
    prompt.setOnHome(true);
    prompt.setWaiting(worker);
    prompt.accept();
    prompt.accept();
    expect(shown).toEqual([true, false]);
    expect(worker.messages).toEqual([SKIP_WAITING_MESSAGE]);
    container.takeOver();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("ignores Reload with no version waiting", () => {
    const { container, prompt, reload, shown } = setup();
    prompt.setOnHome(true);
    prompt.accept();
    container.takeOver();
    expect(shown).toEqual([]);
    expect(reload).not.toHaveBeenCalled();
  });
});

describe("noticePlacement", () => {
  // Centred on the canvas, its top at game y 48 and at most 260 game px wide.
  it.each([
    {
      canvas: { height: 1120, left: 0, top: 20, width: 720 },
      name: "a 2x canvas letterboxed 20px down",
      placement: { centreX: 360, maxWidth: 520, top: 116 },
    },
    {
      canvas: { height: 560, left: 100, top: 0, width: 360 },
      name: "a 1x canvas offset to the side",
      placement: { centreX: 280, maxWidth: 260, top: 48 },
    },
  ])("places the notice on $name", ({ canvas, placement }) => {
    expect(noticePlacement(canvas)).toEqual(placement);
  });
});
