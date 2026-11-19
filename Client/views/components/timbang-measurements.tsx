import type { TimbangRecord } from "@/Data/entities";

export function TimbangMeasurements({ record }: { record?: TimbangRecord }) {
  return <fieldset className="location-fieldset timbang-measurements"><legend>Body measurements</legend>
    <p className="field-hint" id="measurement-hint">Enter the measured value, including decimals if needed. Leave a field blank if it has not been measured yet.</p>
    {([['weight', 'Weight (kg)'], ['height', 'Height (cm)'], ['muac', 'MUAC (cm)']] as const).map(([name, label]) => <div className="field" key={name}>
      <label htmlFor={`timbang-${name}`}>{label}</label><input id={`timbang-${name}`} name={name} type="number" inputMode="decimal" min="0.01" max="1000" step="0.01" defaultValue={record?.[name] ?? ""} aria-describedby="measurement-hint" />
    </div>)}
    <small className="field-hint">MUAC is mid-upper arm circumference, recorded in centimetres.</small>
  </fieldset>;
}
