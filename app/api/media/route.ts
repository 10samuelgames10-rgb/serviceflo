import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchTwilioMedia } from "@/lib/twilio";

/**
 * Plays a call recording or voicemail, or shows a texted photo. Twilio keeps
 * these behind your account login, so ServiceFlo fetches them for signed-in
 * team members only (the database rules decide who can see the record).
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const supabase = await createClient();
  let url: string | null = null;
  if (sp.get("call")) {
    const { data } = await supabase.from("calls").select("recording_url, voicemail_url").eq("id", sp.get("call")!).maybeSingle();
    url = sp.get("f") === "voicemail" ? data?.voicemail_url ?? null : data?.recording_url ?? null;
  } else if (sp.get("msg")) {
    const { data } = await supabase.from("messages").select("media_urls").eq("id", sp.get("msg")!).maybeSingle();
    url = (data?.media_urls as string[] | undefined)?.[Number(sp.get("i") || 0)] ?? null;
  }
  if (!url) return new Response("Not found", { status: 404 });
  try {
    const upstream = await fetchTwilioMedia(url);
    if (!upstream.ok) return new Response("Not available", { status: 502 });
    return new Response(upstream.body, {
      headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/octet-stream", "Cache-Control": "private, max-age=3600" },
    });
  } catch {
    return new Response("Not available", { status: 502 });
  }
}
