# DishSpot — v3 updated, local testing edition

## Surprise and nearby update

This update preserves the Profile-Search-Final layout and adds:

- **Surprise me:** the first home category suggests a random distinct dish from the reviewed catalog. Search this dish fills the search box and clears the category. Surprise again picks another dish without an immediate repeat when multiple choices exist. Distance and rating filters remain active. Empty and single-dish states are handled.
- **Review graph:** each bar uses the actual published review count for Must try, Should try or Avoid. The total is displayed. Dish details refresh every 30 seconds while visible and when returning to the tab, as well as after your own review actions. This tracks reviews, not page views.
- **Also try these:** up to four other reviewed dishes within 5 km of the viewed restaurant, nearest first with review score as the tie-breaker. These distances are straight-line distances from that restaurant. Dishes without coordinates are excluded; an empty state appears when no nearby dishes are available.

### Apply to an existing copy

Only `src/community/App.tsx` and this README changed from
`Dish-Discovery-v3-Profile-Search-Final.zip`. Back up your current project, then
replace `src/community/App.tsx` with the file from this ZIP and restart the app.
Keep your existing hosting configuration, environment variables and `.local`
data. No dependency installation or database migration is needed for this update.
For a fresh local installation, follow the instructions below.

Validation: TypeScript compilation, frontend/server builds and the 17 existing
backend/auth/community tests passed. No browser interaction test was performed.


The original v3 layout with compact food cards, category row and four-icon bottom navigation.
Complete React frontend and Node/SQLite backend for local testing. This version
replaces separate reviewer roles with one community account type. Everyone can
review food and include an optional food vlog link. The previously hosted website
has not been updated; run this download locally.

## Run on your computer

Install Node.js 24+ and Bun, extract this ZIP into a new folder, then open a terminal
inside that folder (the folder containing package.json):

```bash
bun install --frozen-lockfile
bun run dev
```

Open the **localhost URL printed in the terminal**, normally
http://localhost:5173. Keep the terminal running. `dev` starts both the frontend
and local API. `preview` only serves built frontend assets and is not the full app.
Do not use `bun --bun`: the backend needs Node's built-in SQLite implementation.

## Admin and OTP testing

At first startup the backend creates exactly one admin. Its phone and random
password are in `.local/admin.json` on your computer. Log in at `/login`, then
open `/admin`. You can instead set `LOCAL_ADMIN_PHONE` and `LOCAL_ADMIN_PASSWORD`
in `.env` before startup; see `.env.example`. Passwords need at least 10 characters.
Restarting revokes admin sessions. There is no public admin registration or promotion.

Sign up at `/signup` with first/last name, email, phone including country code,
and password. The verification screen displays the testing OTP: no SMS or email
is sent. OTPs expire in 5 minutes, allow 5 attempts, and have a 60-second resend
cooldown. Forgot password uses the same test OTP flow and revokes old sessions.
Passwords use salted scrypt hashes; sessions use HttpOnly cookies. This adapter
refuses production mode and non-localhost requests. Keep the app on localhost.

## Features and test walkthrough

1. **Choose location:** type an area, city or address. Suggestions load after a
   short pause; select the matching address, or use current location. There is
   no Find button or manual coordinates form. The app cancels stale searches
   when you type again. Search text and GPS reverse lookups use Photon and need
   internet access; allow location permission for GPS. Distances are straight-line.
2. **Write a review:** open `/review`. Select an existing reviewed restaurant or
   enter a new restaurant's name, full address and coordinates. Add dish name,
   category, actual price paid in INR, experience, optional HTTPS vlog link and
   up to five JPEG/PNG/WebP photos (3 MB each). Choose Avoid, Should try or Must try.
3. **New restaurants:** the first review and restaurant stay private until admin
   verification. The app says this usually takes 3–4 days; this is a displayed
   expectation, not an automatic delay or automatic approval. Admin can approve
   immediately during testing. There is no total limit on pending requests;
   short-term request throttling protects the local API. Rejected restaurants
   can be submitted again. Review status and rejection notes appear in Profile.
4. **Existing restaurants:** subsequent reviews publish immediately. The catalog
   only includes approved restaurants with at least one published review.
   Deleting the last published review removes the restaurant from discovery.
5. **Discover:** search dishes, restaurants and cuisines; use the original category
   row. One Filter button opens distance and rating choices plus Recommended /
   Nearest first sorting. No large filter dashboard. Scores use Avoid=1, Should
   try=2, Must try=3; cards show Must Try counts and the latest reviewed price.
6. **Community:** follow/unfollow people at `/people`, like reviews and save dishes.
   Members can edit their experience/price/recommendation/link and delete their
   own reviews. Admin can delete reviews and verify new restaurant requests.
7. **Other retained features:** profile editing, local newsletter subscriptions,
   member-only simulated premium checkout and payment history. No real payments
   or active ads. All users have the same review, social and planning features.

## Existing data and backups

A fresh installation starts with eight illustrative dishes and sixteen sample reviews across three sample restaurants. These are labelled sample records, not genuine recommendations. Schema migrations run
on startup. The sample seed runs once on both new and existing databases and never replaces user reviews or restores deleted samples. To carry data from v3, stop the old server, back up its entire `.local`
folder, then copy that folder into the extracted updated folder **before** starting.
It contains the SQLite database, admin configuration and uploaded photos. Never
run two app copies against the same database. Do not share that folder publicly.

The migration retains prior reviews and saved/follow relationships where possible,
converts old reviewer roles to ordinary users, and converts old premium entitlements
to membership. Historical accounts are not automatically linked to new phone
accounts. Imported restaurants may have no coordinates; their distance is shown
as unavailable. Existing illustrative records remain if they were in your old
local database. Original schema migrations and historical tables are retained
for compatibility, but former creator registration and catalog APIs are disabled
in this local app.

## Code layout and validation

- `src/community/`: discovery, location picker, reviews, people, profile, admin.
- `src/components/app/AuthPage.tsx`: login, signup, OTP and password reset.
- `server/community.ts`: restaurant/review, social and outing API authorization.
- `scripts/local-api.ts`: local HTTP adapter and serialized database requests.
- `scripts/test-auth.ts`: local account, OTP and admin provisioning.
- `scripts/community-services.ts`: geocoder and protected photo storage.
- `db/` and `drizzle/`: schemas and append-only migrations.
- `tests/`: local auth, community integration and retained billing/backend tests.

```bash
bun run test
bunx tsc --noEmit
bun run build
```

The community integration test checks pending visibility, admin-only approval,
immediate later reviews, private/public photo access, review ownership, idempotent
likes, follows, saved-dish isolation and outing ownership/order/revision persistence.
The production build checks compilation; it does not turn test authentication
into production authentication. The legacy Worker output is retained for the old
hosting architecture and is not the deployment target for this local edition.

Location provider documentation: https://github.com/komoot/photon

This revision removes the outing UI. This is food discovery, with no food ordering or delivery.
Historical outing data/tables remain for upgrade compatibility, but are not shown.
Browser GPS interactions have not been manually browser-tested in this revision.

## Design update: Friends, review sections and Premium saves

The supplied Home_merged.pdf guides the four-tab layout. Friends replaces Vloggers.
Dish pages separate Vlog reviews (a vlog link is present) from Text reviews (no vlog
link), independently of user roles. Both kinds can include photos.
The third tab is Premium for free users and Saved for active members. Saving and
reading saved dishes require an active, unrevoked member entitlement on the backend.
Use simulated successful checkout to unlock Saved; expiry/refund locks access while
retaining the saved records. No real payment provider is activated.

## Latest screen update

Home/search uses compact grey search, square category tiles, two best matches,
an inactive ad placement and other options. Own and friend profiles use an ocean
cover, avatar/initials, real review and following counts, and clickable Following / Followers / Reviews counters.
Sample friends have illustrative photos. New users start with their own real counts
and no invented visits. Lists stay hidden until a counter is clicked. Edit profile, requests and account controls remain available.
Images use the existing remote photo assets and require internet access.

## Banner, profile counts, moderation and directions update

- Click Change banner on your own profile to upload a JPEG, PNG or WebP image
  (up to 3 MB). It is saved in the local uploads folder and visible on your profile.
  Edit profile → Reset banner restores the default. The backend only accepts
  images uploaded by that account.
- Profiles initially show no review feed, visited-place list or following list.
  Click Following, Followers or Reviews to show the selected content; click the
  selected count again to collapse it. Reviews opens one Reviewed places section
  containing both text and vlog reviews together. Your own section includes
  pending/rejected requests; visitors see only published reviews. Dish pages
  retain their separate vlog/text review sections.
- Existing approved restaurants publish subsequent reviews immediately. A new
  restaurant and its first reviews remain pending until admin verifies it.
- Report appears on published reviews written by other people. Supply a reason.
  Three distinct accounts reporting the same review puts it in Administration →
  Reported reviews. One account counts once. Reports never automatically delete
  content; admin chooses Delete review or Keep review / dismiss reports.
  Dismissed reports stay recorded and cannot be repeated by the same reporter.
- The navigation arrow next to a dish's distance opens Google Maps directions to
  the restaurant coordinates, or its name/address when coordinates are unavailable.
  Google Maps supplies the starting point; the app does not store your journey.
- Migrations run automatically, preserving existing data. Stop the old server
  and back up/copy the complete .local folder before launching this edition.

Validation covers instant/pending publishing, image ownership and banner visibility,
report deduplication and threshold, admin-only keep/delete, connection lists,
premium saving, OTP authentication and persistence. Browser interactions have not
been manually tested in this edition.
