"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import type { Barangay, Purok, Sitio } from "@/Data/entities";
import {
  Dialog, DialogClose, DialogContent, DialogDescription,
  DialogHeader, DialogTitle,
} from "@/Client/shared/components/ui/dialog";

export function ExportExcelDialog({ barangays, puroks, sitios, program = "deworming" }: { barangays: Barangay[]; puroks: Purok[]; sitios: Sitio[]; program?: "deworming" | "timbang" }) {
  const [open, setOpen] = useState(false);
  const [barangayId, setBarangayId] = useState("");
  const [sitioId, setSitioId] = useState("");
  const [purokId, setPurokId] = useState("");
  const [format, setFormat] = useState("xlsx");
  const availableSitios = sitios.filter((sitio) => sitio.barangay_id === barangayId);
  const availablePuroks = puroks.filter((purok) => purok.barangay_id === barangayId);

  return <Dialog open={open} onOpenChange={setOpen}>
    <button type="button" className="primary-button registry-export-button" onClick={() => setOpen(true)} aria-label="Download child report"><Download aria-hidden="true" /><span className="export-label-desktop">Download report</span><span className="export-label-mobile">Export report</span></button>
    <DialogContent className="export-dialog" showCloseButton>
      <DialogHeader>
        <DialogTitle>{program === "timbang" ? "Download Operation Timbang" : "Download child records"}</DialogTitle>
        <DialogDescription>Choose which records to download, then select the Sitio shown in the report heading.</DialogDescription>
      </DialogHeader>
      <form className="export-dialog-form" action={format === "pdf" ? "/api/export/pdf" : "/api/export/xlsx"} method="get">
        {program === "timbang" && <input type="hidden" name="program" value="timbang" />}
        <label className="field"><span>File format</span><select value={format} onChange={(event) => setFormat(event.target.value)}>
          <option value="xlsx">Excel workbook</option><option value="pdf">PDF for printing on long bond paper</option>
        </select><small className="field-hint">{format === "pdf" ? "Ready to print on 8.5 × 13-inch long bond paper, landscape, with narrow margins. No Excel app needed." : "For editing in Excel. Choose PDF for a fixed long bond paper print layout."}</small></label>
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
        <div className="export-age-option">
          <label htmlFor="exclude-age-extremes"><input id="exclude-age-extremes" type="checkbox" name="excludeAgeExtremes" value="true" aria-describedby="export-age-help" /><span>{program === "timbang" ? "Exclude children aged 73 months and older" : "Exclude children under 6 months and 60 months or older"}</span></label>
          <p id="export-age-help" className="field-hint">{program === "timbang" ? "When selected, the download includes only children aged 0 through 72 full months." : "When selected, the download includes only children aged 6 through 59 full months."}</p>
        </div>
        {barangayId && purokId && <div className="location-context"><span>Selected coverage</span><strong>{barangays.find((item) => item.id === barangayId)?.name} / {availablePuroks.find((item) => item.id === purokId)?.name}</strong>{sitioId && <small>Sitio {availableSitios.find((item) => item.id === sitioId)?.name}</small>}</div>}
        <div className="export-dialog-actions"><DialogClose asChild><button className="secondary-button" type="button">Cancel</button></DialogClose><button className="primary-button" type="submit" disabled={!barangayId || !purokId || !sitioId}>{format === "pdf" ? "Download PDF" : "Download Excel"}</button></div>
      </form>
    </DialogContent>
  </Dialog>;
}
