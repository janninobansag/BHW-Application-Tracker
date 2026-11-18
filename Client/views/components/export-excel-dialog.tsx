"use client";

import { useState } from "react";
import { Download } from "lucide-react";
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
    <button type="button" className="primary-button registry-export-button" onClick={() => setOpen(true)} aria-label="Download formatted Excel"><Download aria-hidden="true" /><span className="export-label-desktop">Download formatted Excel</span><span className="export-label-mobile">Export Excel</span></button>
    <DialogContent className="export-dialog" showCloseButton>
      <DialogHeader>
        <DialogTitle>Download child records</DialogTitle>
        <DialogDescription>Choose which records to download, then select the Sitio shown in the report heading.</DialogDescription>
      </DialogHeader>
      <form className="export-dialog-form" action="/api/export/xlsx" method="get">
        <fieldset className="location-fieldset"><legend>Records to include</legend><p className="field-hint">The download includes the selected Barangay and Purok.</p>
        <label className="field"><span>Barangay</span><select name="barangay" required value={barangayId} onChange={(event) => { setBarangayId(event.target.value); setSitioId(""); setPurokId(""); }}>
          <option value="" disabled>Select a Barangay</option>
          {barangays.map((barangay) => <option key={barangay.id} value={barangay.id}>{barangay.name}</option>)}
        </select></label>
        <label className="field"><span>Purok</span><select name="purok" required value={purokId} disabled={!barangayId || availablePuroks.length === 0} onChange={(event) => setPurokId(event.target.value)}>
          <option value="" disabled>{!barangayId ? "Select a Barangay first" : availablePuroks.length ? "Select a Purok" : "No Puroks available"}</option>
          {availablePuroks.map((purok) => <option key={purok.id} value={purok.id}>{purok.name}</option>)}
        </select></label>
        </fieldset>
        <fieldset className="location-fieldset"><legend>Report heading</legend><label className="field"><span>Sitio</span><select name="sitio" required value={sitioId} disabled={!barangayId || availableSitios.length === 0} onChange={(event) => setSitioId(event.target.value)}>
          <option value="" disabled>{!barangayId ? "Select a Barangay first" : availableSitios.length ? "Select a Sitio" : "No Sitios available"}</option>
          {availableSitios.map((sitio) => <option key={sitio.id} value={sitio.id}>{sitio.name}</option>)}
        </select><small className="field-hint">{barangayId && !availableSitios.length ? "An administrator needs to add a Sitio to this Barangay before export." : "The Sitio labels the report; the Purok determines which records are included."}</small></label></fieldset>
        {barangayId && purokId && <div className="location-context"><span>Selected coverage</span><strong>{barangays.find((item) => item.id === barangayId)?.name} / {availablePuroks.find((item) => item.id === purokId)?.name}</strong>{sitioId && <small>Sitio {availableSitios.find((item) => item.id === sitioId)?.name}</small>}</div>}
        <div className="export-dialog-actions"><DialogClose asChild><button className="secondary-button" type="button">Cancel</button></DialogClose><button className="primary-button" type="submit" disabled={!barangayId || !purokId || !sitioId}>Download Excel</button></div>
      </form>
    </DialogContent>
  </Dialog>;
}
