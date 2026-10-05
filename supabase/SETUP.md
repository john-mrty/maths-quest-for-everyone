# Optional parent accounts

Guest play uses the original local storage key and works without a configured
Supabase project. No running quest or scratchpad is uploaded or restored.

## Project setup

1. Create a new Supabase Free project in an EU region. The old project
   `bxzohmpitnejdottxfth` is paused and cannot be restored in the dashboard.
2. Run `schema.sql` once in the new project's SQL editor. It creates an
   owner-protected family snapshot and a private `profile-photos` bucket.
3. Put the project URL and **publishable** key in `cloud-config.js`. Never use a
   secret/service-role key in the browser. Leave each provider disabled until
   its configuration and live callback have been verified.
4. Set Auth's Site URL to the app's production URL and allow its exact redirect
   URL (the origin plus pathname, without query parameters). Allow the local
   preview URL separately for development.
5. Configure Google in Auth > Sign In / Providers using a Google Web OAuth
   client. Register `https://PROJECT_REF.supabase.co/auth/v1/callback` as its
   authorized redirect URI. Request basic identity only.
6. Configure Apple using a Services ID associated with a Sign in with Apple
   App ID. Register the Supabase domain and callback URI in Apple Developer.
   Enter the Services ID and client secret in Supabase. Apple's OAuth client
   secret requires periodic renewal (at most six months); record its expiry.
7. Deploy `functions/delete-account` with Supabase CLI or the dashboard, then set
   `deleteAccountEnabled: true` in `cloud-config.js`. Its
   platform JWT gateway is disabled in `config.toml`, but the function itself
   verifies the caller's token using `auth.getUser` before any privileged action.
   The built-in service-role environment variable stays server-side.
8. Enable configured providers in `cloud-config.js`, verify the checklist below,
   then publish the app through its existing hosting workflow.

For this project, the production origin is `https://play.maths-quests.com` and
the callback is `https://iflmypdwnpaexvddbhbj.supabase.co/auth/v1/callback`.
The database and photo bucket were applied to that project on 4 October 2026.
Google is configured in Supabase; Apple is deferred. The authenticated
`delete-account` function was deployed on 5 October 2026. The browser config
enables Google and deletion; both still require end-to-end signed-in verification
before merging this draft. The function revokes refresh sessions before deleting
the user's stored photos and auth record.

Live SQL checks passed for parent isolation of family data and photo metadata,
revision conflict rejection, denial of guest access, and absence of direct client
write privileges. Temporary test users and rows were rolled back.

## Data and sync

One `family_state` row per parent holds learner names, ages, class levels,
avatar choice, learning plans, mastery totals, preferences and completed-result
records. A JSON snapshot matches the existing app's data model and saves all
profiles atomically. Photos are stored separately with immutable hashed paths;
the database contains those paths instead of image bytes. Authenticated downloads
are turned into local image data for offline use. There are no public photo URLs.

Saves use an atomic revision comparison. A stale or offline device cannot
silently overwrite another device's newer snapshot. On conflict, automatic
saving stops; the parent can explicitly choose to replace their unsynced changes with the cloud
save. Automatic multi-device conflict merging is deliberately deferred.

Account data is cached under a separate local storage key, removed on sign-out.
Guest data migrates automatically for a new account and is removed only after a
successful cloud save. Existing accounts can explicitly add guest profiles as
new learners; settings already saved in the account take precedence.

Existing cumulative progress is preserved. Individual completed results begin
when this version is installed; old quest details cannot be reconstructed.
Results history shows the newest 20 entries, but all entries remain stored in the account. Free project limits and browser storage quotas still apply.

Deleting an account removes its private photos, its auth user and its family
snapshot. A failed photo cleanup prevents auth deletion so it can be retried.
Obsolete photos are retained until account deletion to avoid breaking snapshots
still held by other devices; storage usage should be monitored.

## Required live verification before enabling

- Google and Apple callbacks return to the correct app URL.
- New sign-in migrates profiles, photos, preferences and completed results.
- Returning account restores them on a second device.
- Account A cannot read Account B's state or photo paths using the public key.
- A stale second-device save reports a conflict and keeps its local progress.
- Offline changes survive reload and sync when online if the revision matches.
- Sign-out restores guest use and removes the departing account's local copy.
- Account deletion removes the auth user, family row and private photo objects.
- Guest play and installation work offline with no auth setup.
- Service worker caches only app assets, never Supabase requests or callbacks.

The vendored browser SDK is `@supabase/supabase-js` 2.57.4, downloaded from
jsDelivr's npm distribution (`dist/umd/supabase.js`); see `vendor/LICENSE.supabase`.
