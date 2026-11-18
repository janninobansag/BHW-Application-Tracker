import type { OfflineSnapshot, OfflineVaultContents, OfflineChildInput } from "../Client/offline/vault";
export function activeWorkerId(): string | null;
export function closeWorkerAccess(): void;
export function prepareWorker(snapshot: OfflineSnapshot, isCurrent?: () => boolean): Promise<OfflineVaultContents>;
export function readWorkerContents(): Promise<OfflineVaultContents | null>;
export function changeWorkerContents(operation: (contents: OfflineVaultContents) => void | Promise<void>): Promise<OfflineVaultContents>;
export function queueWorkerChild(child: OfflineChildInput, id?: string, expectedUpdatedAt?: string): Promise<OfflineVaultContents>;
export function queueWorkerDelete(id: string, expectedUpdatedAt?: string): Promise<OfflineVaultContents>;
export function syncWorkerChanges(): Promise<OfflineVaultContents | null>;
