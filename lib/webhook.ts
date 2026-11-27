import "server-only";
import type { NextRequest } from "next/server";
import { isValidTwilioRequest } from "./twilio";

/** Reads a Twilio webhook and checks it really came from Twilio. */
export async function readTwilio(req: NextRequest): Promise<{ ok: boolean; params: Record<string, string> }> {
  const form = await req.formData();
  const params: Record<string, string> = {};
  form.forEach((v, k) => { params[k] = String(v); });
  const base = (process.env.APP_URL || "").replace(/\/$/, "");
  const url = base ? base + req.nextUrl.pathname + req.nextUrl.search : req.url;
  return { ok: isValidTwilioRequest(url, params, req.headers.get("x-twilio-signature")), params };
}

export const xml = (body: string) => new Response(body, { headers: { "Content-Type": "text/xml; charset=utf-8" } });
export const forbidden = () => new Response("Forbidden", { status: 403 });
