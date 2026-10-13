import { test } from "node:test";
import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";
import { createDocumentEvidencePoller } from "../components/project/document-evidence-poller.ts";

function fakeClock() {
  const timers = new Map();
  let nextId = 1;
  return {
    timers,
    setTimeout(callback, delay) {
      assert.equal(delay, 2000);
      const id = nextId++;
      timers.set(id, callback);
      return id;
    },
    clearTimeout(id) { timers.delete(id); },
    async runNext() {
      const [id, callback] = timers.entries().next().value;
      timers.delete(id);
      callback();
      await setImmediate();
    },
  };
}

test("FAILED, Retry, PENDING, PROCESSING, READY stops polling", async () => {
  const clock = fakeClock();
  const statuses = ["PENDING", "PROCESSING", "READY"];
  const seen = ["FAILED"];
  let calls = 0;
  const poller = createDocumentEvidencePoller(
    async () => ({ status: statuses[calls++] }),
    (summary) => seen.push(summary.status),
    (error) => { throw error; },
    2000,
    clock,
  );
  poller.start(); // accepted Retry restarts the card's existing loop
  await setImmediate();
  assert.equal(clock.timers.size, 1);
  await clock.runNext();
  assert.equal(clock.timers.size, 1);
  await clock.runNext();
  assert.deepEqual(seen, ["FAILED", "PENDING", "PROCESSING", "READY"]);
  assert.equal(clock.timers.size, 0);
  assert.equal(calls, 3);
});

test("FAILED, Retry, PROCESSING, FAILED stops polling", async () => {
  const clock = fakeClock();
  const statuses = ["PROCESSING", "FAILED"];
  const seen = ["FAILED"];
  const poller = createDocumentEvidencePoller(
    async () => ({ status: statuses.shift() }),
    (summary) => seen.push(summary.status),
    (error) => { throw error; },
    2000,
    clock,
  );
  poller.start();
  await setImmediate();
  await clock.runNext();
  assert.deepEqual(seen, ["FAILED", "PROCESSING", "FAILED"]);
  assert.equal(clock.timers.size, 0);
});

test("registration processing polls through extraction READY", async () => {
  const clock = fakeClock();
  const responses = [
    { status: null, registrationStatus: "PROCESSING" },
    { status: "PENDING", registrationStatus: "REGISTERED" },
    { status: "READY", registrationStatus: "REGISTERED" },
  ];
  const seen = [];
  const poller = createDocumentEvidencePoller(
    async () => responses.shift(),
    (summary) => seen.push(summary.registrationStatus + ":" + summary.status),
    (error) => { throw error; }, 2000, clock,
  );
  poller.start();
  await setImmediate();
  await clock.runNext();
  await clock.runNext();
  assert.deepEqual(seen, ["PROCESSING:null", "REGISTERED:PENDING", "REGISTERED:READY"]);
  assert.equal(clock.timers.size, 0);
});

test("unmount cancels timer and discards an in-flight response", async () => {
  const clock = fakeClock();
  let resolvePending;
  const seen = [];
  const poller = createDocumentEvidencePoller(
    () => new Promise((resolve) => { resolvePending = resolve; }),
    (summary) => seen.push(summary.status),
    (error) => { throw error; },
    2000,
    clock,
  );
  poller.start();
  poller.stop();
  resolvePending({ status: "READY" });
  await setImmediate();
  assert.deepEqual(seen, []);
  assert.equal(clock.timers.size, 0);
});
