// Shared by the service worker and worker pages. Admin/security URLs never match.
export function workerRoute(value) {
  const url = value instanceof URL ? value : new URL(value, "https://bhw.invalid");
  const path = url.pathname;
  if (path === "/dashboard") return { view: "dashboard", program: "deworming", title: "Dashboard" };
  if (path === "/worker-portfolio" || path.startsWith("/worker-portfolio/")) return { view: "portfolio", program: "deworming", title: "Household Profiling", recordId: path.startsWith("/worker-portfolio/") ? decodeURIComponent(path.split("/").pop()) : null };
  if (path === "/notifications") return { view: "notifications", program: "deworming", title: "Notifications" };
  if (path === "/" || path.startsWith("/records/") || path === "/operation-timbang" || path.startsWith("/operation-timbang/") || path === "/offline.html") {
    const timbang = path.startsWith("/operation-timbang") || url.searchParams.get("program") === "timbang";
    const view = path === "/offline.html" ? url.searchParams.get("view") : "registry";
    if (["dashboard", "portfolio", "notifications"].includes(view)) return { view, program: "deworming", title: { dashboard: "Dashboard", portfolio: "Household Profiling", notifications: "Notifications" }[view] };
    let recordId;
    try { recordId = path.startsWith("/records/") || path.startsWith("/operation-timbang/") ? decodeURIComponent(path.split("/").pop()) : url.searchParams.get("record"); }
    catch { return null; }
    return { view: "registry", program: timbang ? "timbang" : "deworming", title: timbang ? "Operation Timbang" : "Child records", recordId };
  }
  return null;
}

export function workerOfflineUrl(value) {
  const source = value instanceof URL ? value : new URL(value, "https://bhw.invalid");
  const route = workerRoute(source);
  if (!route) return null;
  const params = new URLSearchParams(source.search);
  if (route.program === "timbang") params.set("program", "timbang"); else params.delete("program");
  if (route.view !== "registry") params.set("view", route.view); else params.delete("view");
  if (route.recordId) params.set("record", route.recordId);
  return `/offline.html${params.size ? `?${params}` : ""}`;
}
