import "server-only";
import crypto from "node:crypto";

/**
 * Small Twilio client using fetch (no SDK needed). Server-only: it uses the
 * account's auth token, which must never reach the browser.
 */

const SID = () => process.env.TWILIO_ACCOUNT_SID ?? "";
const TOKEN = () => process.env.TWILIO_AUTH_TOKEN ?? "";
export const twilioConfigured = () => Boolean(SID() && TOKEN());

/** Twilio's request signature: HMAC-SHA1 of the full URL plus the POST params sorted by name. */
export function twilioSignature(authToken: string, url: string, params: Record<string, string>): string {
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join("");
  return crypto.createHmac("sha1", authToken).update(Buffer.from(data, "utf-8")).digest("base64");
}

export function isValidTwilioRequest(url: string, params: Record<string, string>, signature: string | null): boolean {
  if (!signature || !TOKEN()) return false;
  const expected = Buffer.from(twilioSignature(TOKEN(), url, params));
  const given = Buffer.from(signature);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

type Form = Record<string, string | string[] | undefined>;

async function api<T>(path: string, form?: Form, method: "GET" | "POST" = "POST"): Promise<T> {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(form ?? {})) {
    if (v === undefined) continue;
    (Array.isArray(v) ? v : [v]).forEach((x) => body.append(k, x));
  }
  const url = `https://api.twilio.com/2010-04-01/Accounts/${SID()}${path}${method === "GET" && form ? `?${body}` : ""}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: "Basic " + Buffer.from(`${SID()}:${TOKEN()}`).toString("base64"),
      ...(method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: method === "POST" ? body : undefined,
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as T & { message?: string; code?: number };
  if (!res.ok) throw new Error(json.message || `Twilio error ${res.status}`);
  return json;
}

export async function sendSms(opts: { to: string; from: string; body: string; statusCallback?: string; mediaUrls?: string[] }) {
  const r = await api<{ sid: string; status: string }>("/Messages.json", {
    To: opts.to, From: opts.from, Body: opts.body, StatusCallback: opts.statusCallback, MediaUrl: opts.mediaUrls,
  });
  return { sid: r.sid, status: r.status };
}

export async function startCall(opts: { to: string; from: string; url: string; statusCallback?: string }) {
  const r = await api<{ sid: string; status: string }>("/Calls.json", {
    To: opts.to, From: opts.from, Url: opts.url, Method: "POST",
    StatusCallback: opts.statusCallback, StatusCallbackMethod: opts.statusCallback ? "POST" : undefined,
  });
  return { sid: r.sid, status: r.status };
}

/** Points a Twilio number's texts and calls at ServiceFlo. Returns the number's SID. */
export async function connectNumber(e164: string, smsUrl: string, voiceUrl: string): Promise<string> {
  const list = await api<{ incoming_phone_numbers: { sid: string }[] }>("/IncomingPhoneNumbers.json", { PhoneNumber: e164 }, "GET");
  const found = list.incoming_phone_numbers?.[0];
  if (!found) throw new Error(`${e164} isn't in your Twilio account. Buy it in Twilio first, or check the number.`);
  await api(`/IncomingPhoneNumbers/${found.sid}.json`, { SmsUrl: smsUrl, SmsMethod: "POST", VoiceUrl: voiceUrl, VoiceMethod: "POST" });
  return found.sid;
}

/** Downloads a recording or photo that Twilio stores behind your account login. */
export async function fetchTwilioMedia(url: string): Promise<Response> {
  if (!/^https:\/\/api\.twilio\.com\//.test(url)) throw new Error("Not a Twilio media URL");
  return fetch(url, {
    headers: { Authorization: "Basic " + Buffer.from(`${SID()}:${TOKEN()}`).toString("base64") },
    cache: "no-store",
    redirect: "follow",
  });
}
