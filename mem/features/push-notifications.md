---
name: Push Notifications
description: Web Push reminders sent nightly by SO-KI cat at 21:00 JST
type: feature
---
- Web Push (PWA) only — no email fallback. Disabled in Lovable preview iframe.
- Service worker: `/public/sw.js` (push + notificationclick handlers, NO fetch caching).
- Subscription stored in `push_subscriptions` table (endpoint UNIQUE, RLS by user_id).
- Edge function `send-push-notifications` (verify_jwt=false): triggered by pg_cron job `soki-nightly-push` at `0 12 * * *` UTC = 21:00 JST.
- Function generates SO-KI flavored line via Lovable AI (`google/gemini-2.5-flash`) using user's last 5 diaries; falls back to canned messages on error.
- VAPID keys stored as secrets: VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT. Public key also hardcoded in `src/lib/pushNotifications.ts` for client subscribe.
- Opt-in UI: `NotificationOptInCard` shown on Home calendar tab; dismissal stored in localStorage `soki:push-optin-dismissed`.
- iOS requires "Add to Home Screen" PWA install (iOS 16.4+).
