import test from "node:test";
import assert from "node:assert/strict";
import { summarizeAdminDashboard } from "../Services/admin-dashboard.ts";

test("admin totals count active assignments once and keep the registries separate", () => {
  const summary = summarizeAdminDashboard({
    users: [
      { id: "a", is_active: 1, assigned_purok_ids: "p1,p1,p2" },
      { id: "b", is_active: 0, assigned_purok_ids: "p3" },
      { id: "c", is_active: 1, assigned_purok_ids: null },
      { id: "d", is_active: 1, assigned_purok_ids: "deleted-purok" },
    ],
    barangays: [{ id: "b2", name: "Tungkop" }, { id: "b1", name: "Tulay" }],
    puroks: [{ id: "p1", barangay_id: "b1" }, { id: "p2", barangay_id: "b1" }, { id: "p3", barangay_id: "b2" }],
    children: [{ id: "shared-id", barangay_id: "b1" }, { id: "child-2", barangay_id: "b1" }],
    timbang: [{ id: "shared-id", barangay_id: "b2", weight: 12, height: 81, muac: 16.5 }, { id: "growth-2", barangay_id: "b1", weight: 12, height: null, muac: null }],
  });
  assert.equal(summary.activeWorkers, 3);
  assert.equal(summary.inactiveWorkers, 1);
  assert.equal(summary.unassignedWorkers, 2, "missing/deleted Puroks do not grant coverage");
  assert.equal(summary.uncoveredPuroks, 1, "inactive accounts do not cover a Purok");
  assert.equal(summary.incompleteMeasurements, 1);
  assert.deepEqual(summary.coverage.map(({ id, workers, children, timbang }) => ({ id, workers, children, timbang })), [
    { id: "b1", workers: 1, children: 2, timbang: 1 },
    { id: "b2", workers: 0, children: 0, timbang: 1 },
  ]);
});

test("an empty admin dashboard has genuine zero totals", () => {
  assert.deepEqual(summarizeAdminDashboard({ users: [], barangays: [], puroks: [], children: [], timbang: [] }), { activeWorkers: 0, inactiveWorkers: 0, unassignedWorkers: 0, uncoveredPuroks: 0, incompleteMeasurements: 0, coverage: [] });
});
