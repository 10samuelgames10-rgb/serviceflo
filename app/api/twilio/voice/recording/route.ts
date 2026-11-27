import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { forbidden, readTwilio } from "@/lib/webhook";

/** A call recording or voicemail is ready. */
export async function POST(req: NextRequest) {
  const { ok, params } = await readTwilio(req);
  if (!ok) return forbidden();
  if (params.RecordingStatus && params.RecordingStatus !== "completed") return new Response(null, { status: 204 });
  const type = req.nextUrl.searchParams.get("type");
  const callId = req.nextUrl.searchParams.get("call");
  const url = params.RecordingUrl ? `${params.RecordingUrl}.mp3` : null;
  if (url) {
    const patch = type === "voicemail" ? { voicemail_url: url, status: "voicemail" } : { recording_url: url };
    const q = createAdminClient().from("calls").update(patch);
    await (callId ? q.eq("id", callId) : q.eq("provider_sid", params.CallSid));
  }
  return new Response(null, { status: 204 });
}
