# Business phone numbers: calls and texts in ServiceFlo

Your personal cell stays personal. Each location gets its own business number,
and every call and text to those numbers comes into ServiceFlo.

Do this after ServiceFlo is online (`docs/SETUP.md`).

## 1. Twilio (about 20 minutes, plus a few days for approval)

1. Go to twilio.com and sign up. Under **Billing**, add a card so it's a full account (start with about $20).
2. **Phone Numbers → Buy a number**: country **Canada**, tick **Voice**, **SMS** and **MMS**, search area code **250** (Victoria) and buy one, then **604** (Vancouver) and buy one. About $1–2/month each.
3. **Trust Hub**: fill in your business profile (legal name, address, business number). Carriers require it for business texting. Approval usually takes a few days.
4. On the Twilio **Console** home page, find **Account SID** and **Auth Token**. You'll paste them into Vercel in step 3. Never paste them into chat or email.

## 2. Supabase (2 minutes)

1. **SQL Editor → New query**: paste and run `supabase/migrations/0003_phone.sql` (after 0001 and 0002).
2. **Project Settings → API**: find the **service_role** key. This one is secret: it can read everything, so it only goes into Vercel.

## 3. Vercel (3 minutes)

**Settings → Environment Variables**, add:

| Name | Value |
| --- | --- |
| `TWILIO_ACCOUNT_SID` | Account SID from Twilio |
| `TWILIO_AUTH_TOKEN` | Auth Token from Twilio |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key from Supabase |
| `APP_URL` | Your ServiceFlo address, e.g. `https://serviceflo-xyz.vercel.app` (no slash at the end) |

Then **Deployments → Redeploy**.

## 4. ServiceFlo (2 minutes)

1. **Team**: add your mobile number (and your techs'). Click-to-call rings this phone first.
2. **Phone settings**: the checklist at the top should show three green ticks.
3. **Add a business number** for each location: the Twilio number, which location it's for, and the mobile that should ring when someone calls (your cell). Leave **Text people back when a call is missed** on.
4. Click **Connect to Twilio** on each number. ServiceFlo points the number's calls and texts at itself, so there's nothing to set inside Twilio.

## 5. Test it (5 minutes)

- From your personal phone, **text the business number**. It appears in **Inbox** within about 10 seconds. Reply from ServiceFlo: your phone gets the reply from the business number.
- **Call the business number**: your cell rings, showing the caller's number.
- **Call again and don't answer**: the caller hears your voicemail greeting and gets the missed-call text. The voicemail (and its transcript) shows in the Inbox.
- In the Inbox, press **📞 Call**: your cell rings; answer it and ServiceFlo dials the customer, who sees the business number.

## Good to know

- **STOP / opt-out**: if someone texts STOP, Twilio blocks further texts to them automatically.
- **Call recording** is off by default. If you turn it on, callers hear "This call may be recorded", which BC privacy rules expect.
- **Texts saved before setup** (for example reschedule texts) are waiting in **Phone settings → Texts waiting to send**. Send them, or leave them.
- **Cost**: about 1¢ per text and 1–2¢ per minute of calls, plus the numbers. Most small shops spend $30–60/month.
