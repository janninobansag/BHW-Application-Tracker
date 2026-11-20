export type WorkerRoute = { view: string; program: "deworming" | "timbang"; title: string; recordId?: string | null };
export function workerRoute(value: URL | string): WorkerRoute | null;
export function workerOfflineUrl(value: URL | string): string | null;
