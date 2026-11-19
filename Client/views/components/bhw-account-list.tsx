"use client";

import { useState } from "react";
import { resetBhwPassword, setBhwActive } from "@/Client/controllers/actions";
import type { Barangay, ManagedUser, Purok } from "@/Data/entities";
import { AssignmentManager } from "@/Client/views/components/assignment-manager";
import { PasswordInput } from "@/Client/views/components/password-input";

type BhwAccount = Pick<ManagedUser, "id" | "username" | "display_name" | "is_active" | "assigned_ids" | "assigned_purok_ids">;

type BhwAccountListProps = {
  accounts: BhwAccount[];
  barangays: Barangay[];
  puroks: Purok[];
};

const pageSize = 10;

export function BhwAccountList({ accounts, barangays, puroks }: BhwAccountListProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [barangayFilter, setBarangayFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const normalizedSearch = search.trim().toLowerCase();

  const filteredAccounts = accounts.filter((account) => {
    const matchesSearch = !normalizedSearch || `${account.display_name} ${account.username}`.toLowerCase().includes(normalizedSearch);
    const matchesStatus = statusFilter === "all" || (statusFilter === "active" ? account.is_active === 1 : account.is_active !== 1);
    const assignedBarangayIds = (account.assigned_ids ?? "").split(",").filter(Boolean);
    const matchesBarangay = barangayFilter === "all" || assignedBarangayIds.includes(barangayFilter);
    return matchesSearch && matchesStatus && matchesBarangay;
  });

  const pageCount = Math.max(1, Math.ceil(filteredAccounts.length / pageSize));
  const safePage = Math.min(currentPage, pageCount);
  const pageAccounts = filteredAccounts.slice((safePage - 1) * pageSize, safePage * pageSize);
  const firstResult = filteredAccounts.length ? (safePage - 1) * pageSize + 1 : 0;
  const lastResult = Math.min(safePage * pageSize, filteredAccounts.length);

  function resetFilters() {
    setSearch("");
    setStatusFilter("all");
    setBarangayFilter("all");
    setCurrentPage(1);
  }

  return <section className="panel account-panel">
    <div className="section-heading"><div><p className="eyebrow">Team</p><h2>BHW accounts</h2><p className="muted">Search by name or username, then filter by status or Barangay.</p></div></div>
    {accounts.length ? <>
      <div className="account-toolbar">
        <label className="account-control account-search"><span>Search accounts</span><input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setCurrentPage(1); }} placeholder="Name or username" /></label>
        <label className="account-control"><span>Status</span><select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setCurrentPage(1); }}><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
        <label className="account-control"><span>Assigned Barangay</span><select value={barangayFilter} onChange={(event) => { setBarangayFilter(event.target.value); setCurrentPage(1); }}><option value="all">All Barangays</option>{barangays.map((barangay) => <option key={barangay.id} value={barangay.id}>{barangay.name}</option>)}</select></label>
      </div>
      <p className="account-result-count" aria-live="polite">Showing {firstResult}-{lastResult} of {filteredAccounts.length} matching accounts ({accounts.length} total)</p>
      {pageAccounts.length ? <div className="worker-list">{pageAccounts.map((user) => {
        const assignedBarangayIds = (user.assigned_ids ?? "").split(",").filter(Boolean);
        const assignedPurokIds = (user.assigned_purok_ids ?? "").split(",").filter(Boolean);
        return <article className="worker" key={user.id}>
          <div className="worker-heading"><span className="avatar">{user.display_name.charAt(0).toUpperCase()}</span><div><h3>{user.display_name}</h3><p>@{user.username}</p></div><span className={`status ${user.is_active ? "active" : "inactive"}`}>{user.is_active ? "Active" : "Inactive"}</span></div>
          <p className="worker-coverage-summary">{assignedBarangayIds.length ? barangays.filter((item) => assignedBarangayIds.includes(item.id)).map((item) => item.name).join(", ") : "No Barangay assigned"}<span>{assignedPurokIds.length} {assignedPurokIds.length === 1 ? "Purok" : "Puroks"} assigned</span></p>
          <details className="worker-management"><summary>Manage account<span>Assignments and security</span></summary><div className="worker-management-body">
          <AssignmentManager key={`${user.id}:${user.assigned_ids ?? ""}:${user.assigned_purok_ids ?? ""}`} userId={user.id} barangays={barangays} puroks={puroks} assignedBarangayIds={assignedBarangayIds} assignedPurokIds={assignedPurokIds} />
          <div className="worker-actions"><form action={resetBhwPassword} className="reset-form"><input type="hidden" name="userId" value={user.id} /><label htmlFor={`reset-${user.id}`}>Temporary password</label><div><PasswordInput id={`reset-${user.id}`} name="temporaryPassword" minLength={12} maxLength={128} placeholder="12+ characters" required /><button className="secondary-button" type="submit">Set password</button></div></form>
            <form action={setBhwActive}><input type="hidden" name="userId" value={user.id} /><input type="hidden" name="active" value={user.is_active ? "0" : "1"} /><button className={`text-button account-status-button ${user.is_active ? "danger" : "positive"}`} type="submit">{user.is_active ? "Deactivate account" : "Reactivate account"}</button></form>
          </div>
          </div></details>
        </article>;
      })}</div> : <div className="empty-state account-empty"><strong>No BHW accounts match</strong><p>Try another name or change the filters.</p><button className="secondary-button" type="button" onClick={resetFilters}>Clear filters</button></div>}
      {pageCount > 1 && <nav className="account-pagination" aria-label="BHW account pages"><span>Page {safePage} of {pageCount}</span><div><button className="secondary-button" type="button" disabled={safePage <= 1} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}>Previous</button><button className="secondary-button" type="button" disabled={safePage >= pageCount} onClick={() => setCurrentPage((page) => Math.min(pageCount, page + 1))}>Next</button></div></nav>}
    </> : <div className="empty-state"><strong>No BHW accounts yet</strong><p>Create a worker account using the form.</p></div>}
  </section>;
}
