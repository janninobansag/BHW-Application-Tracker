import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const apiOrigin = process.env.RENDER_API_URL || (process.env.NODE_ENV === "development" ? "http://127.0.0.1:10000" : "");
  if (!apiOrigin) return NextResponse.json({ message: "The report service is unavailable." }, { status: 503 });
  const requestUrl = new URL(request.url);
  const format = requestUrl.searchParams.get("format");
  if (format !== "pdf" && format !== "xlsx") return NextResponse.json({ message: "Choose Excel or PDF format." }, { status: 400 });
  const backendUrl = new URL(`/api/households/summary/export${requestUrl.search}`, apiOrigin.replace(/\/$/, ""));
  const headers = new Headers({ accept: format === "pdf" ? "application/pdf, application/json" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/json" });
  const cookie = request.headers.get("cookie");
  if (cookie) headers.set("cookie", cookie);
  try {
    const upstream = await fetch(backendUrl, { headers, cache: "no-store" });
    const responseHeaders = new Headers();
    for (const header of ["content-type", "content-disposition", "content-length", "cache-control", "x-content-type-options"]) {
      const value = upstream.headers.get(header);
      if (value) responseHeaders.set(header, value);
    }
    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
  } catch {
    return NextResponse.json({ message: "The BHW service is unavailable. Try again shortly." }, { status: 502 });
  }
}
