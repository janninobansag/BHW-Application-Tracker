"use client";

import { useState } from "react";
import type { Barangay, Purok, Sitio } from "@/Data/entities";
import {
  Dialog, DialogClose, DialogContent, DialogDescription,
  DialogHeader, DialogTitle,
} from "@/Client/shared/components/ui/dialog";

export function ExportExcelDialog({ barangays, puroks, sitios }: { barangays: Barangay[]; puroks: Purok[]; sitios: Sitio[] }) {
  const [open, setOpen] = useState(false);
  const [barangayId, setBarangayId] = useState("");
  const [sitioId, setSitioId] = useState("");
  const [purokId, setPurokId] = useState("");
  const availableSitios = sitios.filter((sitio) => sitio.barangay_id === barangayId);
  const availablePuroks = puroks.filter((purok) => purok.barangay_id === barangayId);

  return <Dialog open={open} onOpenChange={setOpen}>
    <button type="button" className="primary-button" onClick={() => setOpen(true)}>Download formatted Excel</button>
    <DialogContent className="export-dialog" showCloseButton>
      <DialogHeader>
        <DialogTitle>Download child records</DialogTitle>
        <DialogDescription>Choose a Barangay, Sitio, and Purok. The workbook includes records from the selected Purok and shows the Sitio in its heading.</DialogDescription>
      </DialogHeader>
      <form className="export-dialog-form" action="/api/export/xlsx" method="get">
        <label className="field"><span>Barangay</span><select name="barangay" required value={barangayId} onChange={(event) => { setBarangayId(event.target.value); setSitioId(""); setPurokId(""); }}>
          <option value="" disabled>Select a Barangay</option>
          {barangays.map((barangay) => <option key={barangay.id} value={barangay.id}>{barangay.name}</option>)}
        </select></label>
        <label className="field"><span>Sitio</span><select name="sitio" required value={sitioId} disabled={!barangayId || availableSitios.length === 0} onChange={(event) => setSitioId(event.target.value)}>
          <option value="" disabled>{!barangayId ? "Select a Barangay first" : availableSitios.length ? "Select a Sitio" : "No Sitios available"}</option>
          {availableSitios.map((sitio) => <option key={sitio.id} value={sitio.id}>{sitio.name}</option>)}
        </select></label>
        <label className="field"><span>Purok</span><select name="purok" required value={purokId} disabled={!barangayId || availablePuroks.length === 0} onChange={(event) => setPurokId(event.target.value)}>
          <option value="" disabled>{!barangayId ? "Select a Barangay first" : availablePuroks.length ? "Select a Purok" : "No Puroks available"}</option>
          {availablePuroks.map((purok) => <option key={purok.id} value={purok.id}>{purok.name}</option>)}
        </select></label>
        <div className="export-dialog-actions"><DialogClose asChild><button className="secondary-button" type="button">Cancel</button></DialogClose><button className="primary-button" type="submit">Download Excel</button></div>
      </form>
    </DialogContent>
  </Dialog>;
}
