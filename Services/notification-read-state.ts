type Snapshot = { readIds: string[]; loaded: boolean; error: string };
type StorageLike = Pick<Storage, "getItem" | "setItem">;
type Dependencies = { fetch: typeof fetch; storage: () => StorageLike | undefined; now?: () => Date };

// No child names or health details are stored here, only per-account receipts.
export function createNotificationReadStore(userId: string, dependencies: Dependencies) {
  const key = `bhw-age-notifications:${userId}`;
  const listeners = new Set<() => void>();
  const pending = new Set<string>();
  let state: Snapshot = { readIds: [], loaded: false, error: "" };
  const serverSnapshot = state;
  let busy = false;

  function recentIds(value: unknown): string[] {
    const cutoff = (dependencies.now?.() ?? new Date());
    cutoff.setUTCDate(cutoff.getUTCDate() - 30);
    const earliest = cutoff.toISOString().slice(0, 10);
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string" && /^[a-zA-Z0-9_-]{1,160}:\d{4}-\d{2}-\d{2}$/.test(id) && id.slice(-10) >= earliest) : [];
  }
  function cached(): string[] {
    try { return recentIds(JSON.parse(dependencies.storage()?.getItem(key) ?? "[]")); } catch { return []; }
  }
  function publish(ids: string[], loaded = state.loaded, error = state.error) {
    const readIds = [...new Set(recentIds([...state.readIds, ...ids]))].sort();
    try {
      const storage = dependencies.storage();
      const serialized = JSON.stringify(readIds);
      if (storage?.getItem(key) !== serialized) storage?.setItem(key, serialized);
    } catch { /* The account still saves receipts when browser storage is blocked. */ }
    if (loaded === state.loaded && error === state.error && readIds.join("\n") === state.readIds.join("\n")) return;
    state = { readIds, loaded, error };
    listeners.forEach((listener) => listener());
  }
  async function responseIds(response: Response) {
    if (!response.ok) throw new Error("Could not sync read status. Retrying when connected.");
    const data = await response.json();
    if (data.userId !== userId || !Array.isArray(data.readIds)) throw new Error("Sign in again to sync notifications.");
    return recentIds(data.readIds);
  }
  async function sync() {
    if (busy) return;
    busy = true;
    try {
      const ids = await responseIds(await dependencies.fetch("/api/backend/notifications/age/read", { cache: "no-store" }));
      publish(ids, true, "");
      while (pending.size) {
        const batch = [...pending].slice(0, 500);
        const accepted = await responseIds(await dependencies.fetch("/api/backend/notifications/age/read", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids: batch }), keepalive: true, cache: "no-store" }));
        batch.forEach((id) => pending.delete(id));
        publish(accepted, true, "");
      }
    } catch (error) {
      publish([], state.loaded, error instanceof Error ? error.message : "Could not sync read status.");
    } finally { busy = false; }
  }
  function mergeCached() {
    const ids = cached();
    ids.filter((id) => !state.readIds.includes(id)).forEach((id) => pending.add(id));
    publish(ids);
  }
  return {
    key,
    getSnapshot: () => state,
    getServerSnapshot: () => serverSnapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    start() { mergeCached(); return sync(); },
    refresh() { mergeCached(); return sync(); },
    markRead(ids: string[]) {
      mergeCached();
      const additions = recentIds(ids).filter((id) => !state.readIds.includes(id));
      if (!additions.length) return;
      additions.forEach((id) => pending.add(id));
      publish(additions);
      return sync();
    },
  };
}
