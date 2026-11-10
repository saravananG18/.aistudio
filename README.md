<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# CIT Booker

Campus bus reservations and QR-based boarding verification for Chennai Institute of Technology.

## Run locally

Prerequisite: Node.js 22 or later.

```sh
npm ci
npm run dev
```

The local app and its API are served together at `http://localhost:3000`.

## Deploy the website to GitHub Pages

GitHub Pages hosts the static frontend; it does not run the Express API. To keep
sign-in, bookings, administration, and boarding verification working, deploy
the existing Node API separately and keep its `data/cit_booker_db.json` on
persistent storage.

1. Push this repository to GitHub on the `main` branch.
2. In **Settings → Pages**, choose **GitHub Actions** as the build and deployment source.
3. In **Settings → Secrets and variables → Actions → Variables**, add:
   - `VITE_API_BASE_URL`: the public API URL including `/api`, for example
     `https://api.example.com/api`.
   - `VITE_BASE_PATH` (optional): use `/` for a custom domain. Otherwise the
     workflow uses the repository path automatically.
4. Configure the API host with `CORS_ORIGINS` set to the Pages origin, such as
   `https://your-account.github.io` (include the repository path only in the
   frontend URL; origins do not include paths).
5. Push to `main` or run **Deploy to GitHub Pages** from the Actions tab.

The API host must use HTTPS. The current website still calls the existing
Express API, which reads `data/cit_booker_db.json`; this must remain available
until the rest of the API is migrated to Supabase. Do not use ephemeral server
storage for live bookings.

## Supabase migration foundation

The Supabase migration and protected ESP32 verification function are in
`supabase/`. The web app's other API operations have **not** yet been migrated,
so these files alone do not make a Pages-only deployment functional.

After creating a Supabase project, install the Supabase CLI and run:

```sh
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
supabase secrets set ESP32_DEVICE_TOKEN=YOUR_LONG_RANDOM_DEVICE_TOKEN ESP32_DRIVER_ID=YOUR_DRIVER_PROFILE_ID
supabase functions deploy verify-boarding
```

Set the project URL and public anon/publishable key as GitHub Actions variables
only after the frontend is migrated to Supabase Auth and its Edge Functions.
Never put a service-role key in the website or ESP32 firmware.

## ESP32-CAM QR verification

The ESP32-CAM should decode the QR locally and POST its decoded text to the
existing API endpoint. CIT Booker QR codes contain the opaque QR identifier;
send that value as `qr_identifier` (not the image or a link to the image).

For the current Express API, configure these server-side environment variables
on its host:

- `ESP32_DEVICE_TOKEN`: a long, unique secret provisioned to the device.
- `ESP32_DRIVER_ID`: the driver's existing user ID. The driver must be assigned
  to the trip being scanned.

The Express API device endpoint is:

```http
POST https://api.example.com/api/boarding/verify
Authorization: Bearer <ESP32_DEVICE_TOKEN>
Content-Type: application/json
```

```json
{
  "trip_id": "trip_id_from_the_api",
  "qr_identifier": "CIT-QR-..."
}
```

The Supabase function endpoint, once deployed, is
`https://YOUR_PROJECT_REF.supabase.co/functions/v1/verify-boarding`; it accepts
the same JSON body and device bearer token. It checks QR status, booking,
driver assignment, and duplicate boarding atomically.

Keep the device token out of the website build and use HTTPS for device
requests. The current function supports one configured device/driver. The
remaining application endpoints still require the Express API until migrated.
