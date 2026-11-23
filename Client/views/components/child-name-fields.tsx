export function ChildNameFields({ initial }: { initial?: { firstName: string; middleInitial: string; surname: string } }) {
  return <fieldset className="child-name-fields">
    <legend>Child&apos;s name</legend>
    <div className="field"><label htmlFor="surname">Surname</label><input id="surname" name="surname" autoComplete="family-name" defaultValue={initial?.surname ?? ""} maxLength={100} required /></div>
    <div className="field"><label htmlFor="firstName">First name</label><input id="firstName" name="firstName" autoComplete="given-name" defaultValue={initial?.firstName ?? ""} maxLength={100} required /></div>
    <div className="field"><label htmlFor="middleInitial">M.I. <span className="field-optional">(optional)</span></label><input id="middleInitial" name="middleInitial" defaultValue={initial?.middleInitial ?? ""} maxLength={3} inputMode="text" aria-describedby="middle-initial-hint" /><small id="middle-initial-hint" className="field-hint">One letter.</small></div>
  </fieldset>;
}
