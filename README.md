# ServiceFlo

All-in-one software for mobile detailing businesses: calendar, CRM, payroll, invoices, booking pages and numbers in one place. Built first for Canine Car Care (Victoria and Vancouver, BC).

## What's in this repository

`prototype/serviceflo.html` is the clickable design prototype. Open it in Chrome to try every screen. It runs on sample data saved in your browser only, and it is not connected to Facebook, Stripe or texting yet.

## What the prototype covers

- Calendar (month, week and year) with revenue and hours
- Job screen with status steps, checklists, clock in and out, payment links with tips and a monthly-plan upsell
- Pipeline (CRM) for leads, Customers CRM with notes and visit frequency
- Invoices with PDF download and CSV export
- Team hours and payroll (BC overtime, vacation pay, tips)
- Numbers: profit and loss, CAC, ROAS, LTV, daily and weekly reports
- Products and services editor, branded booking page (shop or step-by-step) and lead forms
- Multiple locations (Victoria and Vancouver)

## The real app (in progress)

The real app lives in this repository: Next.js for the app, Supabase for the database and logins. To put it online, follow `docs/SETUP.md`.

Built so far:

- Sign in, create your business (locations, owner, starter services and checklists)
- Calendar (month and week) with revenue, collected, booked-ahead and hours
- New job form, and a job screen with status steps, cancel, checklist, discount, notes, tech and reschedule
- Customers list with visits, spend and status, and customer profiles with notes and history
- Team and Services pages for owners and managers
- Drag-and-drop rescheduling on the calendar, with an optional text to the customer (texts are queued until texting is connected)
- Business phone numbers through Twilio: a texting Inbox, two-way texts (with photos), calls forwarded to your cell, voicemail with transcripts, optional call recording, missed-call text-back, click-to-call from the business number, and an "On my way" text on jobs. Setup: `docs/PHONE_SETUP.md`
- Automatic referral codes for every customer (first name plus a number, like MEGAN50), entered on new bookings to track who referred whom
- Security: every business only sees its own data (row level security, tested)

To run it on a computer: copy `.env.example` to `.env.local`, fill in the two Supabase values, then `npm install` and `npm run dev`.

## Roadmap

1. Accounts needed (owner creates these): Supabase (database and logins), Vercel (hosting), Meta for Developers (Facebook lead ads), Stripe (payments).
2. Build the real app (Next.js + Supabase), starting with logins, customers, jobs and the calendar.
3. Facebook Lead Ads connection: Meta app, lead webhook, ad spend sync.
4. Payments, invoices, texting and reports.
