"use client";

import { addBarangay, addPurok, deleteBarangay, deletePurok, editBarangay, editPurok } from "@/Client/controllers/actions";
import type { Barangay, Purok } from "@/Data/repositories";
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader,
  DialogTitle, DialogTrigger,
} from "@/Client/shared/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/Client/shared/components/ui/alert-dialog";

export function CoverageManager({ barangays, puroks }: { barangays: Barangay[]; puroks: Purok[] }) {
  return <section className="panel coverage-panel">
    <div className="coverage-title"><div><p className="eyebrow">Coverage setup</p><h2>Barangays and Puroks</h2><p className="muted">Add each Barangay first, then manage its Puroks underneath.</p></div></div>
    <form action={addBarangay} className="coverage-add-barangay">
      <label className="field"><span>New Barangay</span><input name="name" maxLength={100} placeholder="Enter barangay name" required /></label>
      <button className="secondary-button" type="submit">Add Barangay</button>
    </form>
    {barangays.length ? <div className="coverage-tree">{barangays.map((barangay) => {
      const barangayPuroks = puroks.filter((purok) => purok.barangay_id === barangay.id);
      return <article className="coverage-card" key={barangay.id}>
        <div className="coverage-card-heading"><div><span className="coverage-label">BARANGAY</span><h3>{barangay.name}</h3></div><div className="coverage-card-actions">
          <Dialog><DialogTrigger asChild><button className="text-button" type="button">Edit</button></DialogTrigger>
            <DialogContent><DialogHeader><DialogTitle>Edit Barangay</DialogTitle><DialogDescription>Update the Barangay name. Existing Puroks and child records stay linked to it.</DialogDescription></DialogHeader>
              <form action={editBarangay} className="form-stack"><input type="hidden" name="barangayId" value={barangay.id} /><div className="field"><label htmlFor={`edit-barangay-${barangay.id}`}>Barangay name</label><input id={`edit-barangay-${barangay.id}`} name="name" defaultValue={barangay.name} maxLength={100} required /></div><DialogFooter><DialogClose asChild><button className="primary-button" type="submit">Save Barangay</button></DialogClose></DialogFooter></form>
            </DialogContent>
          </Dialog>
          <AlertDialog><AlertDialogTrigger asChild><button className="text-button danger" type="button">Delete</button></AlertDialogTrigger>
            <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete Barangay?</AlertDialogTitle><AlertDialogDescription>Delete {barangay.name} only if it has no Puroks, child records, or BHW assignments. Existing data will be protected if anything is still linked.</AlertDialogDescription></AlertDialogHeader>
              <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><form action={deleteBarangay}><input type="hidden" name="barangayId" value={barangay.id} /><AlertDialogAction type="submit" className="delete-confirm-button" variant="destructive">Delete Barangay</AlertDialogAction></form></AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div></div>
        <div className="purok-section"><div className="purok-heading"><h4>Puroks</h4><span>{barangayPuroks.length}</span></div>
          {barangayPuroks.length ? <ul className="purok-list">{barangayPuroks.map((purok) => <li key={purok.id}><span>{purok.name}</span><div className="coverage-item-actions">
            <Dialog><DialogTrigger asChild><button className="text-button" type="button">Edit</button></DialogTrigger>
              <DialogContent><DialogHeader><DialogTitle>Edit Purok</DialogTitle><DialogDescription>Change the Purok name within Barangay {barangay.name}.</DialogDescription></DialogHeader>
                <form action={editPurok} className="form-stack"><input type="hidden" name="purokId" value={purok.id} /><div className="field"><label htmlFor={`edit-purok-${purok.id}`}>Purok name</label><input id={`edit-purok-${purok.id}`} name="name" defaultValue={purok.name} maxLength={100} required /></div><DialogFooter><DialogClose asChild><button className="primary-button" type="submit">Save Purok</button></DialogClose></DialogFooter></form>
              </DialogContent>
            </Dialog>
            <AlertDialog><AlertDialogTrigger asChild><button className="text-button danger" type="button">Delete</button></AlertDialogTrigger>
              <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete Purok?</AlertDialogTitle><AlertDialogDescription>Delete {purok.name} from Barangay {barangay.name} only if it has no child records or BHW assignments. Existing data will be protected if anything is still linked.</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><form action={deletePurok}><input type="hidden" name="purokId" value={purok.id} /><AlertDialogAction type="submit" className="delete-confirm-button" variant="destructive">Delete Purok</AlertDialogAction></form></AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div></li>)}</ul> : <p className="purok-empty">No Puroks yet. Add the first one below.</p>}
          <form action={addPurok} className="coverage-add-purok"><input type="hidden" name="barangayId" value={barangay.id} /><label className="field"><span>Add Purok to {barangay.name}</span><input name="name" maxLength={100} placeholder="Enter Purok name" required /></label><button className="secondary-button" type="submit">Add Purok</button></form>
        </div>
      </article>;
    })}</div> : <div className="coverage-empty"><strong>No Barangays yet</strong><p>Add a Barangay above, then add its Puroks.</p></div>}
  </section>;
}
