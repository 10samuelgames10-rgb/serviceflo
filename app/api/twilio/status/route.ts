import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { forbidden, readTwilio } from "@/lib/webhook";

const MAP: Record<string, string> = { sent: "sent", delivered: "delivered", undelivered: "undelivered", failed: "failed" };

/** Twilio tells us whether a text was delivered. */
export async function POST(req: NextRequest) {
  const { ok, params } = await readTwilio(req);
  if (!ok) return forbidden();
  const status = MAP[params.MessageStatus];
  if (status && params.MessageSid) {
    await createAdminClient()
      .from("messages")
      .update({ status, error: params.ErrorCode ? `Carrier error ${params.ErrorCode}` : null })
      .eq("provider_sid", params.MessageSid);
  }
  return new Response(null, { status: 204 });
}
