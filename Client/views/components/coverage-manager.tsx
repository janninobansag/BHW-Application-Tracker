"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Plus, Pencil, Search, MapPin } from "lucide-react";
import { addBarangay, addPurok, addSitio, deleteBarangay, deletePurok, deleteSitio, editBarangay, editPurok, editSitio } from "@/Client/controllers/actions";
import type { Barangay, Purok, Sitio } from "@/Data/entities";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/Client/shared/components/ui/dialog";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/Client/shared/components/ui/alert-dialog";

type Kind = "barangay" | "purok" | "sitio";
type Location = { kind: Kind; id: string; name: string; barangayId: string; barangayName: string };
type Editor = Location & { mode: "add" | "edit" };
const names: Record<Kind, string> = { barangay: "Barangay", purok: "Purok", sitio: "Sitio" };
const idFields: Record<Kind, string> = { barangay: "barangayId", purok: "purokId", sitio: "sitioId" };
const addActions = { barangay: addBarangay, purok: addPurok, sitio: addSitio };
const editActions = { barangay: editBarangay, purok: editPurok, sitio: editSitio };
const deleteActions = { barangay: deleteBarangay, purok: deletePurok, sitio: deleteSitio };

function SaveButton({ label, danger = false }: { label: string; danger?: boolean }) {
  const { pending } = useFormStatus();
  return <button className={danger ? "delete-confirm-button" : "primary-button"} type="submit" disabled={pending}>{pending ? "Please wait..." : label}</button>;
}

export function CoverageManager({ barangays, puroks, sitios }: { barangays: Barangay[]; puroks: Purok[]; sitios: Sitio[] }) {
  const [open, setOpen] = useState(false);
  const [barangayId, setBarangayId] = useState(barangays[0]?.id || "");
  const [kind, setKind] = useState<"purok" | "sitio">("purok");
  const [search, setSearch] = useState("");
  const [editor, setEditor] = useState<Editor | null>(null);
  const [deleting, setDeleting] = useState<Location | null>(null);
  const selected = barangays.find((item) => item.id === barangayId);
  const selectedPuroks = puroks.filter((item) => item.barangay_id === barangayId);
  const selectedSitios = sitios.filter((item) => item.barangay_id === barangayId);
  const locations = (kind === "purok" ? selectedPuroks : selectedSitios).filter((item) => item.name.toLowerCase().includes(search.trim().toLowerCase()));
  const location = (entryKind: Kind, id = "", name = ""): Location => ({ kind: entryKind, id, name, barangayId, barangayName: selected?.name || "" });
  const startAdd = (entryKind: Kind) => setEditor({ ...location(entryKind), mode: "add" });
  const confirmDelete = (target: Location) => { setOpen(false); setDeleting(target); };

  return <section className="panel coverage-panel">
    <div className="coverage-title"><p className="eyebrow">Coverage setup</p><h2>Community locations</h2><p className="muted">Manage Barangays and the Puroks and Sitios within them.</p></div>
    <div className="coverage-overview" aria-label="Coverage totals"><div><strong>{barangays.length}</strong><span>Barangays</span></div><div><strong>{puroks.length}</strong><span>Puroks</span></div><div><strong>{sitios.length}</strong><span>Sitios</span></div></div>
    <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) setEditor(null); }}>
      <DialogTrigger asChild><button className="secondary-button coverage-manage-button" type="button" onClick={() => setEditor(null)}><MapPin aria-hidden="true" />Manage coverage</button></DialogTrigger>
      <DialogContent className={`coverage-workspace-dialog${editor ? " coverage-editor-dialog" : ""}`}>
        <DialogHeader><DialogTitle>{editor ? `${editor.mode === "add" ? "Add" : "Edit"} ${names[editor.kind]}` : "Manage coverage"}</DialogTitle><DialogDescription>{editor ? editor.kind === "barangay" ? "Set the Barangay name used in assignments and child records." : `This ${names[editor.kind]} belongs to Barangay ${editor.barangayName}.` : "Choose a Barangay, then manage its Puroks and Sitios separately."}</DialogDescription></DialogHeader>
        {editor ? <form key={`${editor.kind}:${editor.id}:${editor.mode}`} action={editor.mode === "add" ? addActions[editor.kind] : editActions[editor.kind]} className="coverage-editor-form">
          {editor.mode === "edit" && <input type="hidden" name={idFields[editor.kind]} value={editor.id} />}
          {editor.mode === "add" && editor.kind !== "barangay" && <input type="hidden" name="barangayId" value={editor.barangayId} />}
          {editor.kind !== "barangay" && <div className="location-context"><span>Barangay</span><strong>{editor.barangayName}</strong></div>}
          <div className="field"><label htmlFor="coverage-location-name">{names[editor.kind]} name</label><input id="coverage-location-name" name="name" defaultValue={editor.name} maxLength={100} placeholder={`Enter ${names[editor.kind]} name`} required autoFocus autoComplete="off" /><small className="field-hint">Use the name recognized by your community.</small></div>
          <div className="coverage-dialog-footer"><button className="secondary-button" type="button" onClick={() => setEditor(null)}>Cancel</button><SaveButton label={editor.mode === "add" ? `Add ${names[editor.kind]}` : "Save changes"} /></div>
        </form> : <div className="coverage-workspace-body">
          <div className="coverage-selector-row"><div className="field"><label htmlFor="coverage-barangay">Barangay</label><select id="coverage-barangay" value={barangayId} onChange={(event) => { setBarangayId(event.target.value); setSearch(""); }} disabled={!barangays.length}><option value="" disabled>Select a Barangay</option>{barangays.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div><button className="secondary-button" type="button" onClick={() => startAdd("barangay")}><Plus aria-hidden="true" />Add Barangay</button></div>
          {selected ? <>
            <div className="coverage-selected-heading"><div><span className="coverage-label">Barangay</span><h3>{selected.name}</h3></div><div className="coverage-item-actions"><button className="secondary-button" type="button" onClick={() => setEditor({ ...location("barangay", selected.id, selected.name), mode: "edit" })}><Pencil aria-hidden="true" />Edit Barangay</button><button className="text-button danger" type="button" onClick={() => confirmDelete(location("barangay", selected.id, selected.name))}>Delete</button></div></div>
            <div className="coverage-type-switch" role="group" aria-label="Location type"><button type="button" aria-pressed={kind === "purok"} onClick={() => { setKind("purok"); setSearch(""); }}>Puroks <span>{selectedPuroks.length}</span></button><button type="button" aria-pressed={kind === "sitio"} onClick={() => { setKind("sitio"); setSearch(""); }}>Sitios <span>{selectedSitios.length}</span></button></div>
            <div className="coverage-list-toolbar"><label className="coverage-search"><Search aria-hidden="true" /><span className="sr-only">Search {names[kind]} names</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${kind === "purok" ? "Puroks" : "Sitios"}`} /></label><button className="primary-button" type="button" onClick={() => startAdd(kind)}><Plus aria-hidden="true" />Add {names[kind]}</button></div>
            <p className="coverage-list-caption">{locations.length} {kind === "purok" ? "Puroks" : "Sitios"} in Barangay {selected.name}</p>
            {locations.length ? <ul className="coverage-location-list">{locations.map((item) => <li key={item.id}><div><strong>{item.name}</strong><small>{names[kind]}</small></div><div className="coverage-item-actions"><button className="secondary-button" type="button" aria-label={`Edit ${names[kind]} ${item.name}`} onClick={() => setEditor({ ...location(kind, item.id, item.name), mode: "edit" })}>Edit</button><button className="text-button danger" type="button" aria-label={`Delete ${names[kind]} ${item.name}`} onClick={() => confirmDelete(location(kind, item.id, item.name))}>Delete</button></div></li>)}</ul> : <div className="empty-state"><strong>{search ? "No matching locations" : `No ${kind === "purok" ? "Puroks" : "Sitios"} yet`}</strong><p>{search ? "Try another name or clear the search." : `Add a ${names[kind]} to Barangay ${selected.name} to get started.`}</p>{search && <button className="secondary-button" type="button" onClick={() => setSearch("")}>Clear search</button>}</div>}
          </> : <div className="empty-state"><strong>Add your first Barangay</strong><p>Once added, you can organize its Puroks and Sitios here.</p></div>}
        </div>}
      </DialogContent>
    </Dialog>
    <AlertDialog open={Boolean(deleting)} onOpenChange={(value) => { if (!value) { setDeleting(null); setOpen(true); } }}>
      {deleting && <AlertDialogContent className="coverage-delete-dialog"><AlertDialogHeader><AlertDialogTitle>Delete {names[deleting.kind]}?</AlertDialogTitle><AlertDialogDescription>{deleting.kind === "sitio" ? "This Sitio will no longer appear in Excel export options." : "Deletion is allowed only when there are no linked records, locations, or worker assignments."}</AlertDialogDescription></AlertDialogHeader><div className="location-context"><span>{names[deleting.kind]}</span><strong>{deleting.name}</strong>{deleting.kind !== "barangay" && <small>Barangay {deleting.barangayName}</small>}</div><form action={deleteActions[deleting.kind]}><input type="hidden" name={idFields[deleting.kind]} value={deleting.id} /><AlertDialogFooter><AlertDialogCancel className="secondary-button">Cancel</AlertDialogCancel><SaveButton label={`Delete ${names[deleting.kind]}`} danger /></AlertDialogFooter></form></AlertDialogContent>}
    </AlertDialog>
  </section>;
}
