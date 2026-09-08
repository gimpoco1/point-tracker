# Hosted Supabase tests

This suite runs the real application against the configured hosted Supabase
project. It is separate from the isolated suite: `npm run test:e2e` never loads
hosted credentials or runs these specs.

## Setup and commands

Copy `.env.e2e-hosted.example` to `.env.e2e-hosted.local` and fill in the project
URL, publishable key and service-role key. Run once:

```sh
npm run test:e2e:hosted:provision
```

This creates two confirmed email/password users with reserved `.example.test`
addresses and server-controlled `app_metadata.e2e_suite`/`e2e_role` markers. It
writes their IDs and generated passwords to the ignored local file with mode
0600. It sends no emails and does not take over existing accounts. Keep the file
for subsequent runs; the accounts are deliberately retained. Provisioning fails
rather than adopting an existing email when local credentials are missing.

```sh
npm run test:e2e:hosted
npm run test:e2e:hosted -- --project=hosted-chromium
npm run test:e2e:hosted -- --project=hosted-mobile-webkit
npm run test:e2e:hosted:cleanup
npx playwright show-report playwright-hosted-report
```

The server builds into `dist-e2e-hosted/` and uses port 4175. Only public Supabase configuration is exposed to the browser bundle;
entitlement overrides are explicitly disabled.
Pro-only scenarios use temporary database subscription rows; no payment is made.
Service-role credentials stay in Node. Browser tests use real user sessions and
real Auth, PostgREST, RPC and Realtime requests, without mocked responses.

## What is checked

- Successful password sign-in through the UI; account-player creation and session
  persistence on reload.
- UI-created saved players, teams and team memberships, verified through the
  authenticated API and loaded in a fresh browser context with empty storage.
- UI-created cloud games, scores restored in another browser, and completed-game
  wins/win-rate in saved-player stats.
- Two different users joining via an invite code and receiving bidirectional
  scoreboard updates without reload/navigation.
- Owner CRUD and cross-account/anonymous read isolation for games, profiles and
  teams; denied cross-account updates/deletes and forged ownership inserts;
  team membership isolation and rejected unauthorized scoring RPC calls.
- Google/Apple buttons initiating hosted PKCE authorization and Supabase
  redirecting to the actual provider with its callback URI.

RLS assertions use normal user/anonymous clients. An admin client would bypass
RLS and cannot establish that these restrictions work.

## Cleanup and concurrency

The fixture verifies each exact user ID, email and server-controlled test marker
before any cleanup. It closes browser contexts, revokes test sessions and deletes
owned games, profiles, teams, temporary subscriptions, sharing preferences,
notifications, linked-player history and referral codes. Database cascades remove
invites, collaborators, memberships, comments and merge authorizations. Count
checks verify cleanup; failures fail the run. The auth accounts and their metadata
remain. Supabase-managed auth audit history is not removed.

Cleanup runs before/after each test and at suite teardown. It also runs on the
next launch, recovering rows left by an interrupted previous run. The manual
cleanup command is available after a crash. A game with a non-test collaborator
causes cleanup to refuse rather than delete that person's shared game.

Use these accounts only for tests. One worker and an atomic lock in the system temporary directory
prevent overlapping runs and manual cleanup across local checkouts using the same
project/account pair; GitHub Actions uses a shared concurrency group.
Do not run local and CI tests concurrently against the same account pair. Use a
separate pair/project per independently running environment. After a forcibly
killed process, confirm it has stopped before removing the lock path printed in the error and
running cleanup. A killed runner cannot execute its teardown.

## OAuth completion

The automated OAuth checks verify the real provider handoff, **not** successful
Google/Apple login or callback completion. An Auth admin-created user is not a
Google/Apple identity. Full provider testing needs a dedicated provider account
and a permitted redirect URL in Supabase Auth settings (for this runner,
`http://127.0.0.1:4175/`). Do not substitute a personal Google/Apple session.

For a full interactive smoke check, use that dedicated identity to complete the
provider login/consent, verify the return to Plink, inspect `auth.getUser()` for
the expected ID/provider, verify its account-player row, then reopen the app and
check session restoration. Only include this identity in automated cleanup after
it has its own reserved test ID and server-controlled test marker. Provider MFA,
CAPTCHA and account consent must be completed by the account holder; saved auth
state can test subsequent session behavior but does not retest OAuth login.

## CI and credentials

The manual `Hosted end-to-end tests` workflow runs on `main` using the
`hosted-e2e` GitHub environment. Configure all nine variables from
`.env.e2e-hosted.example` as environment secrets; provisioning is a one-time local
step, not a CI action. The workflow is not triggered by pull requests. Do not
share its account pair with an active local run.

Hosted traces and videos are disabled because auth requests contain credentials
and session tokens. Reports contain assertions and failure screenshots of test
accounts. Never commit local credential files or exported auth state.

References: [Supabase admin users](https://supabase.com/docs/reference/javascript/auth-admin-createuser),
[Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security),
[Playwright authentication](https://playwright.dev/docs/auth).
