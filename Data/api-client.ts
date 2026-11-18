import "server-only";
import { cookies } from "next/headers";

const backendOrigin = () => {
  const configured = process.env.RENDER_API_URL || (process.env.NODE_ENV === "development" ? "http://127.0.0.1:10000" : "");
  if (!configured) throw new Error("RENDER_API_URL is required to connect to the BHW API.");
  return configured.replace(/\/$/, "");
};

export async function backendRequest(path: string, init: RequestInit = {}): Promise<Response> {
  const cookieHeader = (await cookies()).getAll().map(({ name, value }) => `${name}=${value}`).join("; ");
  const headers = new Headers(init.headers);
  if (cookieHeader) headers.set("cookie", cookieHeader);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  return fetch(`${backendOrigin()}/api${path}`, { ...init, headers, cache: "no-store" });
}

export async function backendJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await backendRequest(path, init);
  if (!response.ok) throw new Error(`Render API request failed (${response.status})`);
  return await response.json() as T;
}
