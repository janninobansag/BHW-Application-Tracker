export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Reports are untrusted. Retain only an allowlisted directive and a count,
// never document URLs, query strings, script samples, cookies, or record data.
const directives = new Set(["script-src", "script-src-elem", "script-src-attr", "style-src", "style-src-elem", "style-src-attr", "img-src", "connect-src", "font-src", "worker-src", "object-src", "base-uri", "form-action", "frame-ancestors", "default-src"]);
let windowStart = 0;
let received = 0;
const reply = (status: number) => new Response(null, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  if (Date.now() - windowStart >= 60_000) { windowStart = Date.now(); received = 0; }
  if (++received > 60) return reply(429);
  if (request.headers.get("sec-fetch-site") === "cross-site") return reply(403);
  const type = request.headers.get("content-type")?.split(";")[0];
  if (!["application/csp-report", "application/reports+json", "application/json"].includes(type || "")) return reply(415);
  if (Number(request.headers.get("content-length")) > 8192) return reply(413);
  const reader = request.body?.getReader();
  if (!reader) return reply(400);
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > 8192) { await reader.cancel(); return reply(413); }
    chunks.push(value);
  }
  try {
    const payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    const reports = Array.isArray(payload) ? payload.slice(0, 10).map((item) => item?.body) : [payload?.["csp-report"]];
    const counts: Record<string, number> = {};
    for (const report of reports) {
      const directive = report?.effectiveDirective ?? report?.["effective-directive"];
      if (directives.has(directive)) counts[directive] = (counts[directive] || 0) + 1;
    }
    if (Object.keys(counts).length) console.warn("CSP violation counts", counts);
    return reply(204);
  } catch { return reply(400); }
}
