import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { toE164, prettyPhone, firstName } from "../lib/phone.ts";
import { forwardCall, voicemail, bridgeCall, hangup, twiml } from "../lib/twiml.ts";
import { twilioSignature } from "../lib/twilio.ts";
const require = createRequire(import.meta.url);
const twilio = require("twilio");

// phone helpers
assert.equal(toE164("(250) 555-0101"), "+12505550101");
assert.equal(toE164("1 604 555 0102"), "+16045550102");
assert.equal(toE164("+44 20 7946 0958"), "+442079460958");
assert.equal(toE164("555-0101"), null);
assert.equal(toE164("—"), null);
assert.equal(toE164(""), null);
assert.equal(prettyPhone("+12505550101"), "(250) 555-0101");
assert.equal(firstName("Megan (Test)"), "Megan");
assert.equal(firstName(""), "there");

// signature matches Twilio's own library
const token = "12345abcde";
const url = "https://app.example.com/api/twilio/sms?x=1";
const params = { To: "+12505550199", From: "+12505550101", Body: "Hi there & <hello>", MessageSid: "SM123", NumMedia: "0" };
const sig = twilioSignature(token, url, params);
assert.equal(twilio.validateRequest(token, sig, url, params), true, "official library accepts our signature");
assert.equal(twilio.validateRequest(token, sig, url, { ...params, Body: "changed" }), false);

// TwiML is well-formed and escapes text
const parse = (x: string) => { assert.ok(x.startsWith('<?xml version="1.0" encoding="UTF-8"?><Response>') && x.endsWith("</Response>")); return x; };
const f = parse(forwardCall({ forwardTo: "+12505550111", callerId: "+12505550101", actionUrl: "https://a/after?x=1&y=2", record: true, recordingCallback: "https://a/rec" }));
assert.match(f, /<Dial [^>]*action="https:\/\/a\/after\?x=1&amp;y=2"/);
assert.match(f, /record="record-from-answer-dual"/);
assert.match(f, /<Say[^>]*>This call may be recorded/);
assert.match(f, /<Number>\+12505550111<\/Number>/);
const f2 = forwardCall({ forwardTo: "+1", callerId: "+1", actionUrl: "u", record: false, recordingCallback: "r" });
assert.doesNotMatch(f2, /record=/); assert.doesNotMatch(f2, /may be recorded/);
const v = parse(voicemail({ businessName: "Canine & Co <Care>", actionUrl: "a", recordingCallback: "r", transcribeCallback: "t" }));
assert.match(v, /Canine &amp; Co &lt;Care&gt;/); assert.match(v, /<Record [^>]*transcribe="true"/);
const b = parse(bridgeCall({ to: "+12505550101", callerId: "+12505550199", actionUrl: "a", record: true, recordingCallback: "r", whisperUrl: "https://a/w" }));
assert.match(b, /<Dial callerId="\+12505550199"/); assert.match(b, /<Number url="https:\/\/a\/w">\+12505550101<\/Number>/);
assert.equal(hangup(), twiml("<Hangup/>"));
// official TwiML parser-free check: every tag opened is closed
for (const x of [f, v, b]) { const open = (x.match(/<(Dial|Number|Say|Response)\b/g) || []).length, close = (x.match(/<\/(Dial|Number|Say|Response)>/g) || []).length; assert.equal(open, close); }
console.log("phone tests passed");
