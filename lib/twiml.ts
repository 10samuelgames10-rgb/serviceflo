/**
 * Builds the TwiML (XML) instructions Twilio follows during calls and texts.
 * Pure functions with no dependencies, so they can be unit-tested.
 */

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

export const twiml = (inner = "") => `<?xml version="1.0" encoding="UTF-8"?><Response>${inner}</Response>`;

export const RECORDING_NOTICE = "This call may be recorded for quality and training.";

export function say(text: string) {
  return `<Say voice="Polly.Joanna">${esc(text)}</Say>`;
}

/** Incoming call: ring the forwarding number; if nobody answers, Twilio calls actionUrl. */
export function forwardCall(opts: {
  forwardTo: string; callerId: string; actionUrl: string; record: boolean; recordingCallback: string; timeoutSeconds?: number;
}) {
  const rec = opts.record
    ? ` record="record-from-answer-dual" recordingStatusCallback="${esc(opts.recordingCallback)}" recordingStatusCallbackEvent="completed"`
    : "";
  return twiml(
    (opts.record ? say(RECORDING_NOTICE) : "") +
      `<Dial timeout="${opts.timeoutSeconds ?? 20}" answerOnBridge="true" callerId="${esc(opts.callerId)}" action="${esc(opts.actionUrl)}" method="POST"${rec}>` +
      `<Number>${esc(opts.forwardTo)}</Number></Dial>`,
  );
}

/** Nobody answered: play a greeting and take a voicemail (transcribed). */
export function voicemail(opts: { businessName: string; actionUrl: string; recordingCallback: string; transcribeCallback: string }) {
  return twiml(
    say(`Sorry, ${opts.businessName} can't come to the phone right now. Leave a message after the beep, or send a text to this number and we'll reply soon.`) +
      `<Record maxLength="120" playBeep="true" trim="trim-silence" action="${esc(opts.actionUrl)}" method="POST"` +
      ` recordingStatusCallback="${esc(opts.recordingCallback)}" recordingStatusCallbackEvent="completed"` +
      ` transcribe="true" transcribeCallback="${esc(opts.transcribeCallback)}"/>` +
      say("We didn't get a message. Goodbye.") + "<Hangup/>",
  );
}

/** Click-to-call: your phone has answered; now ring the customer, showing the business number. */
export function bridgeCall(opts: {
  to: string; callerId: string; actionUrl: string; record: boolean; recordingCallback: string; whisperUrl?: string;
}) {
  const rec = opts.record
    ? ` record="record-from-answer-dual" recordingStatusCallback="${esc(opts.recordingCallback)}" recordingStatusCallbackEvent="completed"`
    : "";
  const whisper = opts.record && opts.whisperUrl ? ` url="${esc(opts.whisperUrl)}"` : "";
  return twiml(
    say("Connecting you now.") +
      `<Dial callerId="${esc(opts.callerId)}" answerOnBridge="true" action="${esc(opts.actionUrl)}" method="POST"${rec}>` +
      `<Number${whisper}>${esc(opts.to)}</Number></Dial>`,
  );
}

export const hangup = (message?: string) => twiml((message ? say(message) : "") + "<Hangup/>");
