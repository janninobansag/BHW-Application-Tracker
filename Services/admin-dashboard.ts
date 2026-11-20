import type { Barangay, Child, ManagedUser, Purok, TimbangRecord } from "@/Data/entities";

type DashboardWorker = Pick<ManagedUser, "id" | "is_active" | "assigned_purok_ids">;

export function summarizeAdminDashboard({ users, barangays, puroks, children, timbang }: {
  users: DashboardWorker[]; barangays: Barangay[]; puroks: Purok[]; children: Child[]; timbang: TimbangRecord[];
}) {
  const active = users.filter((user) => user.is_active === 1);
  const validPuroks = new Set(puroks.map((purok) => purok.id));
  const workersByPurok = new Map<string, Set<string>>();
  let unassignedWorkers = 0;
  for (const user of active) {
    const assigned = new Set((user.assigned_purok_ids ?? "").split(",").map((id) => id.trim()).filter((id) => validPuroks.has(id)));
    if (!assigned.size) unassignedWorkers++;
    for (const purokId of assigned) {
      const workers = workersByPurok.get(purokId) ?? new Set<string>();
      workers.add(user.id); workersByPurok.set(purokId, workers);
    }
  }
  function counts(records: Child[]) {
    const byBarangay = new Map<string, number>();
    for (const record of records) byBarangay.set(record.barangay_id, (byBarangay.get(record.barangay_id) ?? 0) + 1);
    return byBarangay;
  }
  const childCounts = counts(children);
  const timbangCounts = counts(timbang);
  const coverage = [...barangays].sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" })).map((barangay) => {
    const assignedPuroks = puroks.filter((purok) => purok.barangay_id === barangay.id);
    const workers = new Set(assignedPuroks.flatMap((purok) => [...(workersByPurok.get(purok.id) ?? [])]));
    return { ...barangay, puroks: assignedPuroks.length, workers: workers.size, children: childCounts.get(barangay.id) ?? 0, timbang: timbangCounts.get(barangay.id) ?? 0 };
  });
  return {
    activeWorkers: active.length,
    inactiveWorkers: users.length - active.length,
    unassignedWorkers,
    uncoveredPuroks: puroks.filter((purok) => !workersByPurok.get(purok.id)?.size).length,
    incompleteMeasurements: timbang.filter((record) => [record.weight, record.height, record.muac].some((value) => typeof value !== "number" || !Number.isFinite(value) || value <= 0)).length,
    coverage,
  };
}
