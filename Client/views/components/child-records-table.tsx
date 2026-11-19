"use client";

import Link from "next/link";
import { useState } from "react";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { ageInMonths } from "@/Services/child-records";
import type { Child, TimbangRecord } from "@/Data/entities";
import { deleteChildRecord, deleteTimbangRecord } from "@/Client/controllers/actions";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle,
} from "@/Client/shared/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/Client/shared/components/ui/dropdown-menu";

const pageSize = 8;

export function ChildRecordsTable({ records, today, returnTo, program = "deworming" }: { records: Child[]; today: string; returnTo: string; program?: "deworming" | "timbang" }) {
  const timbang = program === "timbang";
  const [page, setPage] = useState(1);
  const [deleteChild, setDeleteChild] = useState<Child | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const pageCount = Math.max(1, Math.ceil(records.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const first = records.length ? (safePage - 1) * pageSize : 0;
  const visibleChildren = records.slice(first, first + pageSize);
  const last = Math.min(first + pageSize, records.length);

  return <>
    <div className={`table-scroll registry-table${timbang ? " timbang-table" : ""}`} tabIndex={0} role="region" aria-label={timbang ? "Operation Timbang registry" : "Child registry"}><table><caption className="sr-only">{timbang ? "Operation Timbang children and body measurements" : "Registered children and their assigned communities"}</caption><thead><tr>{timbang && <th scope="col">No.</th>}<th scope="col">Child</th><th scope="col">Age</th><th scope="col">Sex</th>{timbang && <><th scope="col">Weight (kg)</th><th scope="col">Height (cm)</th><th scope="col">MUAC (cm)</th></>}<th scope="col">Parent / guardian</th><th scope="col">Community / BHW</th><th scope="col"><span className="sr-only">Action</span></th></tr></thead><tbody>
      {visibleChildren.map((child, index) => <tr key={child.id}>
        {timbang && <td className="timbang-number" data-label="No.">{first + index + 1}</td>}
        <th scope="row" className="record-child"><strong>{child.name}</strong><small>Born {child.birthday}</small></th>
        <td className="record-age" data-label="Age">{ageInMonths(child.birthday, today)} months</td>
        <td className="record-sex" data-label="Sex"><span className={`sex-pill ${child.sex === "F" ? "sex-pill-female" : "sex-pill-male"}`}><span aria-hidden="true">{child.sex}</span><span className="sr-only">{child.sex === "F" ? "Female" : "Male"}</span></span></td>
        {timbang && ([['weight', 'Weight (kg)'], ['height', 'Height (cm)'], ['muac', 'MUAC (cm)']] as const).map(([field, label]) => <td key={field} className="timbang-value" data-label={label}>{(child as TimbangRecord)[field] ?? <span className="muted">Not measured</span>}</td>)}
        <td className="record-parents" data-label="Parents">{child.parents}</td>
        <td className="record-location" data-label="Community"><div className="record-desktop-location"><strong>{child.barangay_name}</strong><small>{child.purok_name || "Purok not specified"} / {child.bhw_names || "Unassigned"}</small></div><details className="record-mobile-disclosure"><summary>View details</summary><dl><div><dt>Parent / guardian</dt><dd>{child.parents}</dd></div><div><dt>Barangay / Purok</dt><dd>{child.barangay_name} / {child.purok_name || "Purok not specified"}</dd></div><div><dt>Health worker</dt><dd>{child.bhw_names || "Unassigned"}</dd></div></dl></details></td>
        <td className="record-actions-cell"><DropdownMenu modal={false} open={openMenuId === child.id} onOpenChange={(open) => setOpenMenuId(open ? child.id : null)}>
          <DropdownMenuTrigger asChild onPointerDown={(event) => event.preventDefault()} onContextMenu={(event) => event.preventDefault()} onClick={() => setOpenMenuId((current) => current === child.id ? null : child.id)}><button type="button" className="record-menu-trigger" aria-label={`Actions for ${child.name}`}><MoreHorizontal aria-hidden="true" /></button></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="record-menu-content">
            <DropdownMenuItem asChild className="record-menu-item"><Link href={`${timbang ? "/operation-timbang" : "/records"}/${encodeURIComponent(child.id)}`}><Pencil aria-hidden="true" />Edit</Link></DropdownMenuItem>
            <DropdownMenuItem className="record-menu-item record-menu-delete" onSelect={() => setDeleteChild(child)}><Trash2 aria-hidden="true" />Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu></td>
      </tr>)}
    </tbody></table></div>
    <AlertDialog open={Boolean(deleteChild)} onOpenChange={(open) => { if (!open) setDeleteChild(null); }}>
      {deleteChild && <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>{timbang ? "Delete Operation Timbang record?" : "Delete child record?"}</AlertDialogTitle><AlertDialogDescription>This will permanently delete {deleteChild.name}&apos;s {timbang ? "Operation Timbang " : ""}record. It will no longer appear in this registry or its reports.</AlertDialogDescription></AlertDialogHeader>
        <form action={timbang ? deleteTimbangRecord : deleteChildRecord} data-offline-delete-form data-record-program={program}>
          <input type="hidden" name="childId" value={deleteChild.id} />
          <input type="hidden" name="updatedAt" value={deleteChild.updated_at ?? ""} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <AlertDialogFooter><AlertDialogCancel type="button" className="secondary-button">Cancel</AlertDialogCancel><button type="submit" className="delete-confirm-button">Delete record</button></AlertDialogFooter>
        </form>
      </AlertDialogContent>}
    </AlertDialog>
    <nav className="records-pagination" aria-label="Child record pages">
      <span aria-live="polite">Showing {first + 1} to {last} of {records.length} records</span>
      <div><span>Page {safePage} of {pageCount}</span>
        <button className="secondary-button" type="button" disabled={safePage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</button>
        <button className="secondary-button" type="button" disabled={safePage >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}>Next</button>
      </div>
    </nav>
  </>;
}
