---
title: Rocket Money MCP
tagline: A budgeting assistant with no API, wired into my AI tools through a browser session instead.
scale: 3
status: shipped
domain: ai-tooling
tags: [products]
started: 2026-07-05
links: [jewel-mcp]
tech: [mcp, typescript, puppeteer, reverse-engineering]
---

## Problem

Rocket Money has no third-party API. The only way to read my own accounts, transactions, budgets, and subscriptions programmatically is to reuse the same web session my browser would use, and that session was never designed to be held open by anything but a browser.

## Constraints

Read-only, on purpose: nothing in this server writes to the account beyond categorizing and annotating transactions I've already made. The session cookie rotates on a fixed clock and comes with no offline refresh token, so there is no way to renew it out of band; it either gets kept alive or it dies outright and needs a fresh login. And the underlying API calls are hash-addressed, so a query that worked yesterday can start failing today if the service changes the hash server-side.

## Approach

A rotating cookie jar persisted to disk, refreshed on every response, with a periodic keepalive call so the session doesn't go stale from idling. When the session dies anyway, an automated login recovers it, including working through a one-time code delivered by text. Every failure gets classified before it's surfaced: a dead session and a broken query hash both come back as errors, but they're different errors, because one means "log back in" and the other means "the request itself is wrong," and conflating them would make the recovery logic guess.

A separate read-only tool enriches Amazon charges after the fact: order confirmation emails get matched to existing transactions by amount and date, within a tolerance, and only the matching category and note get written back. Nothing about the match is invented; if nothing lines up, nothing gets touched.

## Edge cases considered

The one that mattered most: this server makes several tool calls that all touch the same rotating credential, and two calls in flight at once both start with the same cookie. The service accepts it for whichever one lands first and rotates it out from under the other, which fails not just that call but the whole session, since the client is now holding a cookie the server no longer recognizes. The fix was to stop pretending the calls are independent. Every request against the account goes through a single queue, one at a time, so nothing races the rotation. It's a smaller version of the same problem any system with one mutable credential and multiple concurrent holders eventually hits.

A one-time code sent by text doesn't always arrive in the order you'd expect relative to when the login flow is ready for it. Codes get held briefly rather than discarded if they arrive early, but only briefly, so a stale code from a much earlier attempt can't be replayed against a later one.

Matching Amazon emails to charges can't be exact, since the emailed total and the amount that actually posts drift by small amounts for reasons that have nothing to do with the order being wrong. The tolerance absorbs that, but only for rows already identified as an Amazon charge, so a loose match can never land on something it shouldn't.

## Tradeoffs

Nothing here survives without upkeep. A session with no refresh token means the system has to actively keep it breathing, and if that lapses for long enough, someone has to log back in by hand. I accepted that because the alternative, storing something with a longer lifetime, isn't something Rocket Money offers.

Keeping the credential off the client was a deliberate trade: it never leaves the one process that uses it, which also means there's no way to hand the session to another device if this one goes down.

## Outcome

Working and in daily use. It answers account, transaction, budget, net worth, and subscription questions through my assistant, and recovers on its own when the session dies rather than paging me to go log back in.
