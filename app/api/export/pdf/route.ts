import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const apiOrigin = process.env.RENDER_API_URL || (process.env.NODE_ENV === "development" ? "http://127.0.0.1:10000" : "");
  if (!apiOrigin) return NextResponse.json({ message: "RENDER_API_URL is required to download the report." }, { status: 503 });

  const requestUrl = new URL(request.url);
  const backendUrl = new URL("/api/export/xlsx", apiOrigin.replace(/\/$/, ""));
  backendUrl.search = requestUrl.search;
  backendUrl.searchParams.set("format", "pdf");
  const headers = new Headers({ accept: "application/pdf, application/json" });
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
