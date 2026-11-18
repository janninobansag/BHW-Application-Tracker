"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { OfflineSnapshot } from "@/Client/offline/vault";
import {
  decryptOfflineContents,
  encryptOfflineContents,
  readOfflineVault,
  removeOfflineVault,
  writeOfflineVault,
} from "@/Client/offline/vault";

export function OfflineAccessPanel({ snapshot }: { snapshot: OfflineSnapshot }) {
  const [hasOfflineCopy, setHasOfflineCopy] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checkingVault, setCheckingVault] = useState(true);
  const [confirmRemoval, setConfirmRemoval] = useState(false);
  const [confirmReplacement, setConfirmReplacement] = useState(false);

  useEffect(() => {
    void readOfflineVault(snapshot.user.username)
      .then((record) => setHasOfflineCopy(!!record))
      .catch(() => setFeedback("This browser does not support offline storage."))
      .finally(() => setCheckingVault(false));
  }, [snapshot.user.username]);

  const saveCopy = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback("");
    setError(false);
    if (!navigator.onLine) {
      setFeedback("Connect to the internet before updating your offline copy.");
      setError(true);
      return;
    }
    if (passphrase.length < 12 || passphrase.length > 128) {
      setFeedback("Choose an offline passphrase between 12 and 128 characters.");
      setError(true);
      return;
    }
    if (passphrase !== confirmation) {
      setFeedback("The passphrases do not match.");
      setError(true);
      return;
    }

    setBusy(true);
    try {
      const existing = await readOfflineVault(snapshot.user.username);
      const previous = existing && !confirmReplacement ? await decryptOfflineContents(existing, passphrase) : null;
      if (previous && previous.snapshot.user.id !== snapshot.user.id) throw new Error("The saved offline copy belongs to a different account.");
      const contents = {
        snapshot: { ...snapshot, savedAt: new Date().toISOString() },
        pending: previous?.pending ?? [],
        conflicts: previous?.conflicts ?? [],
      };
      const encrypted = await encryptOfflineContents(snapshot.user.username, snapshot.user.id, contents, passphrase);
      await writeOfflineVault(encrypted);
      setHasOfflineCopy(true);
      setConfirmReplacement(false);
      setPassphrase("");
      setConfirmation("");
      setFeedback(confirmReplacement
        ? `Offline copy replaced with ${snapshot.children.length} assigned child records. The previous copy and any unsynced edits were discarded.`
        : previous?.pending.length
          ? `Offline copy updated. ${previous.pending.length} queued change${previous.pending.length === 1 ? " is" : "s are"} still waiting to sync.`
          : `Offline copy updated with ${snapshot.children.length} assigned child records.`);
    } catch (saveError) {
      setError(true);
      setFeedback(existingCopyError(saveError, hasOfflineCopy));
    } finally {
      setBusy(false);
    }
  };

  const clearCopy = async () => {
    setFeedback("");
    setError(false);
    setBusy(true);
    try {
      const existing = await readOfflineVault(snapshot.user.username);
      if (!existing) {
        setHasOfflineCopy(false);
        setConfirmRemoval(false);
        return;
      }
      const contents = await decryptOfflineContents(existing, passphrase);
      if (contents.pending.length || contents.conflicts?.length) {
        setError(true);
        setFeedback("Sync or resolve the queued changes before removing this offline copy.");
        return;
      }
      await removeOfflineVault(snapshot.user.username);
      setHasOfflineCopy(false);
      setConfirmRemoval(false);
      setPassphrase("");
      setConfirmation("");
      setFeedback("Offline copy removed from this browser.");
    } catch {
      setError(true);
      setFeedback("Could not unlock the offline copy. Check the passphrase and try again.");
    } finally {
      setBusy(false);
    }
  };

  return <section className="panel offline-access-panel" aria-labelledby="offline-access-title">
    <p className="eyebrow">Offline access</p>
    <h2 id="offline-access-title">Assigned child records on this device</h2>
    <p className="muted">Prepare an encrypted copy of the records assigned to you. In Offline records, you can view, add, and edit children without a connection; queued changes sync when you reconnect. Admin tools and Excel export still need internet. Keep this passphrase safe because it is not stored.</p>
    <form className="offline-access-form" onSubmit={(event) => void saveCopy(event)}>
      <div className="field">
        <label htmlFor="offline-passphrase">Offline passphrase</label>
        <input id="offline-passphrase" type="password" autoComplete="new-password" minLength={12} maxLength={128} value={passphrase} onChange={(event) => setPassphrase(event.target.value)} required />
        <small>Use at least 12 characters. You will need it to unlock records offline{hasOfflineCopy ? " or update this copy" : ""}.</small>
      </div>
      <div className="field">
        <label htmlFor="offline-passphrase-confirm">Confirm offline passphrase</label>
        <input id="offline-passphrase-confirm" type="password" autoComplete="new-password" minLength={12} maxLength={128} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required />
      </div>
      <div className="button-row">
        <button className="primary-button" type="submit" disabled={busy || checkingVault}>{busy ? "Saving…" : confirmReplacement ? "Replace offline copy" : hasOfflineCopy ? "Update offline copy" : "Enable offline access"}</button>
        {hasOfflineCopy && <a className="secondary-button" href="/offline.html">Open offline records</a>}
        {hasOfflineCopy && !confirmRemoval && !confirmReplacement && <button className="danger-button" type="button" disabled={busy} onClick={() => setConfirmRemoval(true)}>Remove offline copy</button>}
      </div>
    </form>
    {confirmReplacement && <div className="offline-remove-confirm" role="group" aria-label="Confirm replacement">
      <p>Replacing the copy permanently discards its offline records and any unsynced edits. Enter a new offline passphrase above, then confirm replacement.</p>
      <div className="button-row"><button className="secondary-button" type="button" disabled={busy} onClick={() => setConfirmReplacement(false)}>Cancel</button></div>
    </div>}
    {confirmRemoval && <div className="offline-remove-confirm" role="group" aria-label="Confirm removal">
      <p>Remove the encrypted child record copy from this browser? Pending edits must be synced first.</p>
      <div className="button-row">
        <button className="secondary-button" type="button" disabled={busy} onClick={() => setConfirmRemoval(false)}>Keep copy</button>
        <button className="danger-button" type="button" disabled={busy || passphrase.length < 12} onClick={() => void clearCopy()}>{busy ? "Checking…" : "Remove copy"}</button>
      </div>
    </div>}
    {hasOfflineCopy && !confirmReplacement && <button className="text-button offline-replace-link" type="button" disabled={busy} onClick={() => setConfirmReplacement(true)}>Forgot the offline passphrase? Replace the copy</button>}
    {feedback && <p className={error ? "form-error" : "form-success"} role={error ? "alert" : "status"}>{feedback}</p>}
    <p className="offline-scope-note">Offline access is tied to this browser and this BHW account. Clear the copy before sharing the device.</p>
  </section>;
}

function existingCopyError(error: unknown, hasOfflineCopy: boolean): string {
  if (hasOfflineCopy && error instanceof DOMException && error.name === "OperationError") {
    return "The passphrase did not unlock the current copy. Enter the same passphrase or remove the old copy after syncing its changes.";
  }
  return error instanceof Error ? error.message : "Could not save the offline copy. Try again.";
}
