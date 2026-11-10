# CIT Booker

Campus bus reservations and QR based boarding for Chennai Institute of Technology. The frontend is a static Vite site hosted on GitHub Pages. Supabase provides authentication, Postgres, row level security, and the ESP32 boarding verification function. No always-on Express server is needed.

## Supabase setup

The project already has the initial schema from `supabase/migrations/20261109160000_initial_schema.sql`. In the Supabase dashboard SQL Editor, apply these files in order:

1. `supabase/migrations/20261110103000_pages_backend.sql`
2. `supabase/seed.sql`

The seed adds the sample routes, buses, staff profiles, today's trips, and the bus identification map. It does not add bookings. Run it once after the schema migration.

In **Authentication → URL Configuration**, set the Site URL to your deployed GitHub Pages URL and add that URL plus `http://localhost:5173/**` to the allowed redirect URLs. For a project site, the deployed URL includes the repository path, for example `https://ACCOUNT.github.io/REPOSITORY/`.

### Enable staff accounts

Students can register and sign in with the email link. Staff must have a Supabase Auth account and a matching seeded profile. Add/ invite staff from **Authentication → Users** using the seeded email address. Then, in the SQL Editor, assign the appropriate role:

```sql
update public.profiles
set role = 'admin'
where email = 'admin@example.invalid';

update public.profiles
set role = 'driver'
where email = 'driver-1@example.invalid';
```

The seed uses reserved `example.invalid` addresses. Replace them with actual authorized staff emails in your own database, or update the seeded profile email to match the account you invite. Repeat for each driver. The profile trigger links the Auth account to the existing profile by email. Never give a staff role to an account the transport office does not control.

## Run locally

Copy `.env.example` to `.env.local` and set the project's **Project URL** and **publishable key**. These are browser values; never use a `sb_secret_...` or service-role key in the frontend.

```sh
npm ci
npm run dev
```

Open the Vite URL shown in the terminal, usually `http://localhost:5173`.

## Deploy to GitHub Pages

1. Select **GitHub Actions** as the Pages build source under repository **Settings → Pages**.
2. Push to the `minimal` branch (or run **Deploy to GitHub Pages** from the Actions tab).
3. Configure Supabase Auth's Site URL and allowed redirect URLs for the published Pages address.

The workflow includes the Supabase project URL and publishable key. The publishable key is public by design; database access is protected by row level security. Never put a Supabase secret or service-role key in the website or workflow.
## ESP32-CAM boarding verification

The ESP32-CAM decodes the QR locally, then posts the decoded `opaque_qr_identifier` and the selected `trip_id` directly to the Supabase Edge Function. It does not connect to Firebase Realtime Database, and it does not send a camera image.

Deploy the function and configure a unique device token and the assigned driver profile ID:

```sh
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase secrets set ESP32_DEVICE_TOKEN=YOUR_LONG_RANDOM_TOKEN ESP32_DRIVER_ID=YOUR_DRIVER_PROFILE_ID
npx supabase functions deploy verify-boarding
```

The firmware sends an HTTPS request to:

```text
https://YOUR_PROJECT_REF.supabase.co/functions/v1/verify-boarding
```

with `Authorization: Bearer YOUR_LONG_RANDOM_TOKEN`, JSON content type, and a body like:

```json
{
  "trip_id": "trip_bus_1",
  "qr_identifier": "CIT-QR-..."
}
```

The function responds with `success`, `code`, and `message`; the device can use `success` to control its green/red indicator. The QR identifier is not an access credential for Supabase. Keep the device token only in firmware/device configuration and Supabase secrets, never in the website.

## Current features and limitations

- Student email-link login, seat selection, booking, cancellation, and personal QR pass use Supabase Auth and Postgres.
- Driver browser scans and ESP32 scans share the protected boarding verification logic. Driver manifests refresh from the database.
- Admin writes use role-checked SQL functions and row level security.
- Gmail reminder dispatch requires the driver's connected Gmail account; Supabase itself does not send mail unless an email provider is configured.
