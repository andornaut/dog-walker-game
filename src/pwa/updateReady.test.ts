import { describe, expect, it, vi } from "vitest";

import {
  activateWaitingWorker,
  type ContainerLike,
  createUpdateFlow,
  newerVersionOf,
  noticePlacement,
  type RegistrationLike,
  type ServiceWorkerLike,
  SKIP_WAITING_MESSAGE,
  updateAction,
  type UpdateState,
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
  updates = 0;
  waiting: FakeWorker | null = null;

  // The deploy update() finds: none, or a new version that starts installing.
  constructor(private readonly deployed: boolean = false) {
    super();
  }

  // The installing version finishes and waits behind the running one.
  finishInstall(): FakeWorker {
    const worker = this.installing ?? new FakeWorker();
    this.installing = null;
    this.waiting = worker;
    worker.state = "installed";
    worker.dispatchEvent(new Event("statechange"));
    return worker;
  }

  startInstall(): FakeWorker {
    const worker = new FakeWorker();
    this.installing = worker;
    this.dispatchEvent(new Event("updatefound"));
    return worker;
  }

  update(): Promise<unknown> {
    this.updates += 1;
    if (this.deployed) {
      this.startInstall();
    }
    return Promise.resolve(this);
  }
}

const RUNNING_WORKER = {};

// Lets the flow's promise callbacks run.
const settle = () =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });

describe("updateAction", () => {
  const fresh: UpdateState = {
    interacted: false,
    newer: "pending",
    onHome: false,
    online: true,
    reloading: false,
    waitOver: false,
  };
  const playing: UpdateState = { ...fresh, interacted: true, newer: "waiting", waitOver: true };
  it.each<{ expected: ReturnType<typeof updateAction>; name: string; state: UpdateState }>([
    { expected: "wait", name: "a fresh load checking for a newer version", state: fresh },
    { expected: "run", name: "a fresh load offline", state: { ...fresh, online: false } },
    {
      expected: "run",
      name: "a fresh load whose wait ran out",
      state: { ...fresh, waitOver: true },
    },
    { expected: "run", name: "no newer version", state: { ...fresh, newer: "none" } },
    {
      expected: "switch",
      name: "a waiting version before input",
      state: { ...fresh, newer: "waiting" },
    },
    {
      expected: "switch",
      name: "a waiting version before input, offline, after the wait",
      state: { ...fresh, newer: "waiting", online: false, waitOver: true },
    },
    {
      expected: "switch",
      name: "a waiting version before input, on the home screen",
      state: { ...fresh, newer: "waiting", onHome: true, waitOver: true },
    },
    {
      expected: "prompt",
      name: "a waiting version, after input, home",
      state: { ...playing, onHome: true },
    },
    { expected: "run", name: "a waiting version, after input, mid-walk", state: playing },
    {
      expected: "run",
      name: "a pending version after input",
      state: { ...fresh, interacted: true },
    },
    {
      expected: "wait",
      name: "a switch before the wait runs out",
      state: { ...fresh, reloading: true },
    },
    {
      expected: "run",
      name: "a switch after the wait, on the home screen",
      state: { ...playing, onHome: true, reloading: true },
    },
  ])("is $expected for $name", ({ expected, state }) => {
    expect(updateAction(state)).toBe(expected);
  });
});

describe("newerVersionOf", () => {
  const worker = new FakeWorker();
  it.each([
    {
      controller: null,
      expected: "none",
      installing: worker,
      name: "a first install",
      waiting: null,
    },
    {
      controller: RUNNING_WORKER,
      expected: "none",
      installing: null,
      name: "no new version",
      waiting: null,
    },
    {
      controller: RUNNING_WORKER,
      expected: "pending",
      installing: worker,
      name: "a version installing",
      waiting: null,
    },
    {
      controller: RUNNING_WORKER,
      expected: "waiting",
      installing: null,
      name: "a version waiting",
      waiting: worker,
    },
  ])("is $expected for $name", ({ controller, expected, installing, waiting }) => {
    const registration = Object.assign(new FakeRegistration(), { installing, waiting });
    expect(newerVersionOf(new FakeContainer(controller), registration).newer).toBe(expected);
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

describe("createUpdateFlow", () => {
  const setup = ({ controller = RUNNING_WORKER as unknown, online = true } = {}) => {
    const container = new FakeContainer(controller);
    const reload = vi.fn();
    const shown: boolean[] = [];
    const flow = createUpdateFlow(
      container,
      () => online,
      reload,
      (visible) => shown.push(visible),
    );
    let booted = false;
    void flow.bootable.then(() => {
      booted = true;
    });
    return { booted: () => booted, container, flow, reload, shown };
  };

  it("holds the boot until it is watching a registration", async () => {
    const { booted } = setup();
    await settle();
    expect(booted()).toBe(false);
  });

  it.each([
    { controller: RUNNING_WORKER, name: "no new version", online: true, updates: 1 },
    { controller: RUNNING_WORKER, name: "offline", online: false, updates: 0 },
    { controller: null, name: "a first install", online: true, updates: 0 },
  ])("boots with no notice for $name", async ({ controller, online, updates }) => {
    const { booted, flow, reload, shown } = setup({ controller, online });
    const registration = new FakeRegistration();
    flow.watch(registration);
    await settle();
    expect({
      booted: booted(),
      reloads: reload.mock.calls.length,
      shown,
      updates: registration.updates,
    }).toEqual({
      booted: true,
      reloads: 0,
      shown: [],
      updates,
    });
  });

  it("boots when the registration fails", async () => {
    const { booted, flow } = setup();
    flow.noRegistration();
    await settle();
    expect(booted()).toBe(true);
  });

  it("switches a fresh load to a version that installs during the boot wait, without booting", async () => {
    const { booted, container, flow, reload, shown } = setup();
    const registration = new FakeRegistration(true);
    flow.watch(registration);
    await settle();
    expect(booted()).toBe(false);
    const worker = registration.finishInstall();
    expect(worker.messages).toEqual([SKIP_WAITING_MESSAGE]);
    container.takeOver();
    await settle();
    expect({ booted: booted(), reloads: reload.mock.calls.length, shown }).toEqual({
      booted: false,
      reloads: 1,
      shown: [],
    });
  });

  it("switches at once to a version already waiting at load", () => {
    const { flow } = setup();
    const registration = new FakeRegistration();
    const worker = new FakeWorker();
    registration.waiting = worker;
    flow.watch(registration);
    expect(worker.messages).toEqual([SKIP_WAITING_MESSAGE]);
  });

  it("boots when the wait runs out, then switches if the install lands before input", async () => {
    const { booted, flow } = setup();
    const registration = new FakeRegistration(true);
    flow.watch(registration);
    flow.endBootWait();
    await settle();
    expect(booted()).toBe(true);
    expect(registration.finishInstall().messages).toEqual([SKIP_WAITING_MESSAGE]);
  });

  it("after input never switches on its own, and offers Reload on each arrival home", () => {
    const { container, flow, reload, shown } = setup();
    const registration = new FakeRegistration();
    flow.watch(registration);
    flow.endBootWait();
    flow.setOnHome(true);
    flow.noteInteraction();
    flow.setOnHome(false);
    registration.startInstall();
    const worker = registration.finishInstall();
    flow.setOnHome(true);
    flow.setOnHome(false);
    flow.setOnHome(true);
    expect(worker.messages).toEqual([]);
    expect(shown).toEqual([true, false, true]);
    flow.accept();
    flow.accept();
    expect(shown).toEqual([true, false, true, false]);
    expect(worker.messages).toEqual([SKIP_WAITING_MESSAGE]);
    container.takeOver();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  // The load's own check, then one per arrival home after input; none offline.
  it.each([
    { online: true, updates: 3 },
    { online: false, updates: 0 },
  ])("with online $online checks $updates times", ({ online, updates }) => {
    const { flow } = setup({ online });
    const registration = new FakeRegistration();
    flow.watch(registration);
    flow.setOnHome(true);
    flow.noteInteraction();
    flow.setOnHome(false);
    flow.setOnHome(true);
    flow.setOnHome(true);
    flow.setOnHome(false);
    flow.setOnHome(true);
    expect(registration.updates).toBe(updates);
  });

  it("ignores Reload with no version waiting", () => {
    const { container, flow, reload, shown } = setup();
    flow.watch(new FakeRegistration());
    flow.noteInteraction();
    flow.setOnHome(true);
    flow.accept();
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
