"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChartNoAxesColumn, Download, Plus, Search } from "lucide-react";
import type { AppUser, Barangay, HouseholdProfile, Purok } from "@/Data/entities";
import { queueWorkerHouseholdDelete, syncWorkerChanges } from "@/public/worker-offline-store.js";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/Client/shared/components/ui/alert-dialog";

const PAGE_SIZE = 8;
const name = (item: HouseholdProfile) => `${item.respondent.surname}, ${item.respondent.firstName}${item.respondent.middleName ? ` ${item.respondent.middleName}` : ""}`;

export function HouseholdRegistry({ initialProfiles, barangays, puroks, user }: { initialProfiles: HouseholdProfile[]; barangays: Barangay[]; puroks: Purok[]; user: AppUser }) {
  const router = useRouter();
  const [profiles, setProfiles] = useState(initialProfiles);
  const [query, setQuery] = useState("");
  const [barangayId, setBarangayId] = useState("");
  const [purokId, setPurokId] = useState("");
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState<HouseholdProfile | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const filtered = useMemo(() => profiles.filter((profile) => {
    const text = query.trim().toLocaleLowerCase();
    return (!text || `${profile.householdNumber} ${name(profile)} ${profile.barangay_name ?? ""} ${profile.purok_name ?? ""}`.toLocaleLowerCase().includes(text))
      && (!barangayId || profile.barangayId === barangayId)
      && (!purokId || profile.purokId === purokId);
  }), [profiles, query, barangayId, purokId]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  async function remove() {
    if (!deleting || busy) return;
    setBusy(true);
    try {
      if (user.role === "bhw") {
        await queueWorkerHouseholdDelete(deleting.id, deleting.updated_at);
        if (navigator.onLine) {
          try { await syncWorkerChanges("households"); } catch { /* The encrypted queue retains this deletion. */ }
        }
        setProfiles((current) => current.filter((profile) => profile.id !== deleting.id));
        setFeedback(navigator.onLine ? "Household deleted or queued to sync." : "Household deletion saved on this device. It will sync when online.");
        setDeleting(null);
        return;
      }
      const response = await fetch(`/api/backend/households/${encodeURIComponent(deleting.id)}`, {
        method: "DELETE", credentials: "same-origin", cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ expectedUpdatedAt: deleting.updated_at }),
      });
      const result = await response.json() as { message?: string };
      if (!response.ok) throw new Error(result.message || "Could not delete this household.");
      setProfiles((current) => current.filter((profile) => profile.id !== deleting.id));
      setFeedback("Household deleted.");
      setDeleting(null);
      router.refresh();
    } catch (error) { setFeedback(error instanceof Error ? error.message : "Could not delete this household."); }
    finally { setBusy(false); }
  }

  return <section className="panel household-registry" aria-labelledby="household-registry-title">
    <div className="household-registry-header">
      <div><p className="eyebrow">Household register</p><h2 id="household-registry-title">Profiles <span className="registry-total-badge">{profiles.length}</span></h2></div>
      <div className="household-registry-actions"><Link href="/worker-portfolio/summary" className="secondary-button"><ChartNoAxesColumn aria-hidden="true" />View summary</Link><Link href="/worker-portfolio/new" className="primary-button"><Plus aria-hidden="true" />New household</Link></div>
    </div>
    <div className="household-filters">
      <div className="field"><label htmlFor="household-search">Search</label><div className="household-search"><Search aria-hidden="true" /><input id="household-search" type="search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Household number or respondent" /></div></div>
      <div className="field"><label htmlFor="household-barangay">Barangay</label><select id="household-barangay" value={barangayId} onChange={(event) => { setBarangayId(event.target.value); setPurokId(""); setPage(1); }}><option value="">All assigned barangays</option>{barangays.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></div>
      <div className="field"><label htmlFor="household-purok">Purok</label><select id="household-purok" value={purokId} onChange={(event) => { setPurokId(event.target.value); setPage(1); }} disabled={!barangayId}><option value="">{barangayId ? "All Puroks" : "Choose a Barangay"}</option>{puroks.filter((item) => item.barangay_id === barangayId).map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></div>
    </div>
    {feedback && <p className="household-feedback" role="status">{feedback}</p>}
    {visible.length ? <div className="household-list">{visible.map((profile) => <article className="household-card" key={profile.id}>
      <div className="household-card-main"><div><span className="household-number">Household {profile.householdNumber}</span><h3>{name(profile)}</h3><p>{profile.barangay_name}{profile.purok_name ? ` / ${profile.purok_name}` : ""}{profile.sitio_name ? ` / ${profile.sitio_name}` : ""}</p></div><span className="household-member-count">{profile.members.length} {profile.members.length === 1 ? "member" : "members"}</span></div>
      <div className="household-card-footer"><span>Updated {new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" }).format(new Date(profile.updated_at))}</span><div className="household-card-actions"><Link href={`/worker-portfolio/${encodeURIComponent(profile.id)}`} className="secondary-button">Edit</Link><a className="secondary-button" href={`/api/backend/households/${encodeURIComponent(profile.id)}/pdf`}><Download aria-hidden="true" />PDF</a><button className="household-delete-button" type="button" onClick={() => setDeleting(profile)}>Delete</button></div></div>
    </article>)}</div> : <div className="empty-state"><h3>{profiles.length ? "No matching households" : "No household profiles yet"}</h3><p>{profiles.length ? "Try another search or location." : "Add a household to start the register."}</p>{!profiles.length && <Link href="/worker-portfolio/new" className="primary-button">Add household</Link>}</div>}
    {filtered.length > PAGE_SIZE && <nav className="records-pagination" aria-label="Household pages"><span>Showing {(currentPage - 1) * PAGE_SIZE + 1} to {Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length}</span><div><span>Page {currentPage} of {pageCount}</span><button type="button" className="secondary-button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</button><button type="button" className="secondary-button" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>Next</button></div></nav>}
    <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => { if (!open && !busy) setDeleting(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete household?</AlertDialogTitle><AlertDialogDescription>{deleting ? `Household ${deleting.householdNumber} and its ${deleting.members.length} member record${deleting.members.length === 1 ? "" : "s"} will be permanently removed.` : ""}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel type="button" className="secondary-button" disabled={busy}>Cancel</AlertDialogCancel><button type="button" className="delete-confirm-button" disabled={busy} onClick={remove}>{busy ? "Deleting..." : "Delete household"}</button></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </section>;
}
