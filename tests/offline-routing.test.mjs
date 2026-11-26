import test from "node:test";
import assert from "node:assert/strict";
import { workerRoute, workerOfflineUrl } from "../public/offline-routing.js";

test("worker pages retain their destination and registry when switching offline", () => {
  assert.equal(workerRoute("/dashboard").view, "dashboard");
  assert.equal(workerRoute("/worker-portfolio").view, "portfolio");
  assert.equal(workerRoute("/worker-portfolio/summary").view, "portfolio-summary");
  assert.equal(workerOfflineUrl("/worker-portfolio/summary"), "/offline.html?view=portfolio-summary");
  assert.equal(workerRoute("/worker-portfolio/new").recordId, "new");
  assert.equal(workerRoute("/worker-portfolio/house-1").recordId, "house-1");
  assert.equal(workerOfflineUrl("/worker-portfolio/house-1"), "/offline.html?view=portfolio&record=house-1");
  assert.equal(workerRoute("/notifications").view, "notifications");
  assert.equal(workerRoute("/operation-timbang/child-1").recordId, "child-1");
  assert.equal(workerRoute("/operation-timbang/child-1").program, "timbang");
  assert.equal(workerOfflineUrl("/operation-timbang?age=73-plus&purok=p"), "/offline.html?age=73-plus&purok=p&program=timbang");
  assert.equal(workerOfflineUrl("/records/child-1"), "/offline.html?record=child-1");
  assert.equal(workerRoute(workerOfflineUrl("/dashboard")).view, "dashboard");
});

test("offline routing never exposes administration or account security pages", () => {
  for (const path of ["/admin", "/admin/users", "/login", "/password", "/setup", "/api/backend/children"]) {
    assert.equal(workerRoute(path), null);
    assert.equal(workerOfflineUrl(path), null);
  }
});
