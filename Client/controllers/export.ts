import { NextRequest } from "next/server";
import { getCurrentUser } from "@/Services/auth";
import { ageInMonths, makeCsv, todayInManila } from "@/Services/child-records";
import { listChildren } from "@/Data/repositories";
import { siteCopy } from "@/Resources/copy";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.must_change_password) return new Response("Unauthorized", { status: 401 });
  const q = request.nextUrl.searchParams.get("q") ?? "";
  const barangay = request.nextUrl.searchParams.get("barangay") ?? "";
  const today = todayInManila();
  const children = await listChildren(user, q, barangay);
  const rows: Array<Array<string | number>> = [[...siteCopy.csvHeaders]];
  for (const child of children) rows.push([
    child.name, child.birthday, ageInMonths(child.birthday, today), child.sex,
    child.parents, child.barangay_name, child.bhw_names ?? "", today,
  ]);
  return new Response(makeCsv(rows), { headers: {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="bhw-records-${today}.csv"`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  } });
}
