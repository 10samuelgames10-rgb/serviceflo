# Putting ServiceFlo online

About 20 minutes, no coding. Do the steps in order.

## 1. Create the database (Supabase)

1. Go to supabase.com and sign in with GitHub.
2. Click **New project**. Name it `serviceflo`, pick a strong database password (save it in your password manager), and choose the region **Canada (Central)**. Click **Create new project** and wait about 2 minutes.
3. In the left menu, open **SQL Editor**, click **New query**.
4. Open `supabase/migrations/0001_foundation.sql` in this repository on GitHub, click **Copy raw file**, paste it into the SQL editor, and click **Run**. You should see "Success. No rows returned".
5. Click **New query** again and do the same with `supabase/migrations/0002_referrals_and_messages.sql`, then `0003_phone.sql`. Always run the numbered files in order, once each.
6. In the left menu, open **Authentication → URL Configuration** and leave it for now. You'll come back after step 2.
7. Open **Project Settings → API**. Keep this tab open: you need the **Project URL** and the **anon public** key in step 2.

## 2. Put the app online (Vercel)

1. Go to vercel.com and sign in with GitHub.
2. Click **Add New → Project**, find `serviceflo`, and click **Import**.
3. Open **Environment Variables** and add two:
   - `NEXT_PUBLIC_SUPABASE_URL` = the Project URL from Supabase
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = the anon public key from Supabase
4. Click **Deploy** and wait about 2 minutes. Vercel gives you a web address like `serviceflo-xyz.vercel.app`.

## 3. Connect the two

1. Back in Supabase, **Authentication → URL Configuration**:
   - **Site URL**: your Vercel address, for example `https://serviceflo-xyz.vercel.app`
   - **Redirect URLs**: add `https://serviceflo-xyz.vercel.app/auth/callback`
2. Open your Vercel address, click **Create an account**, confirm the email Supabase sends you, and set up your business.

## Later

- Your own web address (for example `app.caninecarcare.ca`): Vercel → Settings → Domains.
- Business phone numbers (calls and texts): follow `docs/PHONE_SETUP.md`.
- Employee logins, payments (Stripe) and Facebook leads are the next build steps.
