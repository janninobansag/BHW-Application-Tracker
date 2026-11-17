import { NextRequest } from "next/server";
import { getCurrentUser } from "@/Services/auth";
import { ageInMonths, makeCsv, todayInManila } from "@/Services/child-records";
import { listBarangays, listChildren } from "@/Data/repositories";
import { siteCopy } from "@/Resources/copy";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.must_change_password) return new Response("Unauthorized", { status: 401 });
  const q = request.nextUrl.searchParams.get("q") ?? "";
  const barangay = request.nextUrl.searchParams.get("barangay") ?? "";
  const today = todayInManila();
  const [children, assignedBarangays] = await Promise.all([
    listChildren(user, q, barangay),
    listBarangays(user),
  ]);
  const selectedBarangays = assignedBarangays
    .filter((item) => !barangay || item.id === barangay)
    .map((item) => item.name);
  const barangayTitle = selectedBarangays.length === 1
    ? `BARANGAY ${selectedBarangays[0].toUpperCase()}, ${siteCopy.csvLocationSuffix}`
    : `BARANGAYS ${selectedBarangays.map((name) => name.toUpperCase()).join(", ")}, ${siteCopy.csvLocationSuffix}`;
  const rows: Array<Array<string | number>> = [
    [siteCopy.csvTitle],
    [barangayTitle],
    [...siteCopy.csvHeaders],
  ];
  for (const [index, child] of children.entries()) rows.push([
    `${index + 1}.`,
    child.name,
    child.birthday,
    "", // Purok is not currently collected by the app.
    ageInMonths(child.birthday, today),
    child.sex,
    "", // Vitamin A doses are not currently tracked by the app.
    "",
    "", // Deworming doses are not currently tracked by the app.
    "",
    child.parents,
  ]);
  return new Response(makeCsv(rows), { headers: {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="vitamin-a-deworming-${today}.csv"`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  } });
}
