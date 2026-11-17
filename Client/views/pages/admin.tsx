import { requireAdmin } from "@/Services/auth";
import { listBarangays, listManagedUsers, listPuroks } from "@/Data/repositories";
import { addBarangay, addPurok, createBhw, editBarangay, editPurok, resetBhwPassword, saveAssignments, setBhwActive } from "@/Client/controllers/actions";
import { AppShell } from "@/Client/views/components/shell";

export const dynamic = "force-dynamic";

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const admin = await requireAdmin();
  const [barangays, puroks, users] = await Promise.all([listBarangays(admin), listPuroks(admin), listManagedUsers()]);
  const { message } = await searchParams;
  return <AppShell user={admin} title="Administration" eyebrow="Team and coverage">
    {message && <p className="notice" role="status">{message}</p>}
    <div className="admin-intro"><div><h2>Manage your health workers</h2><p>Assign barangays, issue temporary passwords, and deactivate accounts when access should end.</p></div><div className="admin-number"><strong>{users.filter((user) => user.is_active).length}</strong><span>active BHWs</span></div></div>
    <div className="admin-grid">
      <section className="panel"><div className="section-heading"><div><p className="eyebrow">Team</p><h2>BHW accounts</h2></div></div>
        {users.length ? <div className="worker-list">{users.map((user) => {
          const assigned = new Set((user.assigned_ids ?? "").split(",").filter(Boolean));
          const assignedPuroks = new Set((user.assigned_purok_ids ?? "").split(",").filter(Boolean));
          return <article className="worker" key={user.id}><div className="worker-heading"><span className="avatar">{user.display_name.charAt(0).toUpperCase()}</span><div><h3>{user.display_name}</h3><p>@{user.username}</p></div><span className={`status ${user.is_active ? "active" : "inactive"}`}>{user.is_active ? "Active" : "Inactive"}</span></div>
            <form action={saveAssignments} className="assignment-form"><input type="hidden" name="userId" value={user.id} /><strong>Assigned Barangays</strong><div className="checkbox-list">{barangays.map((barangay) => <label key={barangay.id}><input type="checkbox" name="barangayId" value={barangay.id} defaultChecked={assigned.has(barangay.id)} />{barangay.name}</label>)}</div><strong>Assigned Puroks</strong><div className="checkbox-list">{puroks.map((purok) => <label key={purok.id}><input type="checkbox" name="purokId" value={purok.id} defaultChecked={assignedPuroks.has(purok.id)} />{barangays.find((item) => item.id === purok.barangay_id)?.name} — {purok.name}</label>)}</div><button className="secondary-button" type="submit">Save assignments</button></form>
            <div className="worker-actions"><form action={resetBhwPassword} className="reset-form"><input type="hidden" name="userId" value={user.id} /><label htmlFor={`reset-${user.id}`}>Temporary password</label><div><input id={`reset-${user.id}`} type="password" name="temporaryPassword" minLength={12} maxLength={128} placeholder="12+ characters" required /><button className="secondary-button" type="submit">Set password</button></div></form>
              <form action={setBhwActive}><input type="hidden" name="userId" value={user.id} /><input type="hidden" name="active" value={user.is_active ? "0" : "1"} /><button className="text-button danger" type="submit">{user.is_active ? "Deactivate account" : "Reactivate account"}</button></form>
            </div>
          </article>;
        })}</div> : <div className="empty-state"><strong>No BHW accounts yet</strong><p>Create a worker account using the form.</p></div>}
      </section>
      <div className="admin-side">
        <section className="panel form-panel"><p className="eyebrow">Add staff</p><h2>Create BHW account</h2><p className="muted">The worker changes their temporary password at first sign-in.</p><form action={createBhw} className="form-stack">
          <div className="field"><label htmlFor="displayName">Worker name</label><input id="displayName" name="displayName" maxLength={100} required /></div>
          <div className="field"><label htmlFor="username">Username</label><input id="username" name="username" pattern="[A-Za-z0-9._-]{3,40}" maxLength={40} autoComplete="off" required /></div>
          <div className="field"><label htmlFor="temporaryPassword">Temporary password</label><input id="temporaryPassword" name="temporaryPassword" type="password" minLength={12} maxLength={128} autoComplete="new-password" required /></div>
          <button className="primary-button" type="submit">Create account</button>
        </form></section>
        <section className="panel form-panel"><p className="eyebrow">Coverage</p><h2>Barangays and Puroks</h2>
          <div className="barangay-list">{barangays.map((barangay) => <div className="coverage-item" key={barangay.id}>
            <strong>{barangay.name}</strong>
            <details><summary>Edit barangay</summary><form action={editBarangay} className="form-stack"><input type="hidden" name="barangayId" value={barangay.id} /><div className="field"><label htmlFor={`barangay-${barangay.id}`}>Barangay name</label><input id={`barangay-${barangay.id}`} name="name" defaultValue={barangay.name} maxLength={100} required /></div><button className="secondary-button" type="submit">Save barangay</button></form></details>
            <form action={addPurok} className="form-stack"><input type="hidden" name="barangayId" value={barangay.id} /><div className="field"><label htmlFor={`new-purok-${barangay.id}`}>Add Purok</label><input id={`new-purok-${barangay.id}`} name="name" maxLength={100} required /></div><button className="secondary-button" type="submit">Add Purok</button></form>
            {puroks.filter((purok) => purok.barangay_id === barangay.id).map((purok) => <details key={purok.id}><summary>Edit Purok: {purok.name}</summary><form action={editPurok} className="form-stack"><input type="hidden" name="purokId" value={purok.id} /><div className="field"><label htmlFor={`purok-${purok.id}`}>Purok name</label><input id={`purok-${purok.id}`} name="name" defaultValue={purok.name} maxLength={100} required /></div><button className="secondary-button" type="submit">Save Purok</button></form></details>)}
          </div>)}</div>
          <form action={addBarangay} className="form-stack"><div className="field"><label htmlFor="barangayName">New barangay name</label><input id="barangayName" name="name" maxLength={100} required /></div><button className="secondary-button" type="submit">Add barangay</button></form>
        </section>
      </div>
    </div>
  </AppShell>;
}
