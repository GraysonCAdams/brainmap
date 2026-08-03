---
title: Grocery Pickup MCP
tagline: My AI assistant builds the grocery pickup order; I just pay.
scale: 3
status: shipped
domain: ai-tooling
tags: [products]
started: 2026-05-15
links: [mcp-gateway]
tech: [mcp, typescript, reverse-engineering]
---

## Problem

Building a grocery pickup order is a chore made of small decisions, and it is the kind of thing an assistant should be able to do end to end while I stay the one who approves it.

## Constraints

There is no public API, so everything had to be derived from watching the real site. It had to stop before payment: I wanted the cart built, not the card charged. And it had to be honest about being unofficial, since nothing here is contractual and any of it can change without notice.

## Approach

Reverse-engineer the endpoints from a captured session, write them up as documentation first, and build the client against that. Search, cart operations, substitution preferences, checkout totals, pickup slot listing and reservation. Deliberately no payment step.

## Edge cases considered

The finding that shaped everything: **the authentication plane is defended and the data plane is not.** Sign-in and the silent-refresh callback are both blocked to any non-browser client, while cart, checkout, and substitution work fine from a plain HTTP call. That single asymmetry determines the entire architecture, because it means a session has to be established the slow way and then used, rather than obtained on demand.

A token lifetime bug hid for hours behind a lenient endpoint. The refresh loop logged success every ten minutes while the same token quietly aged out, because reopening the page keeps the sign-in session alive without minting a new access token. It stayed invisible because the search and cart endpoints **accept an expired token**; only the coupon endpoints reject one outright. Now the refresh drives the token exchange explicitly and verifies the issued-at claim actually advanced before overwriting a good session with a stale one. A no-op refresh used to be indistinguishable from a successful one, which is the same class of bug as a backup that succeeds while backing up nothing.

Cart lines are handles, not quantities. Posting an add-shaped request for something already in the cart creates a second line rather than incrementing the first, so the line handle has to be resolved from a fresh read before any update.

Weight-sold produce prices against average weight rather than quantity, so the obvious reading of price times quantity misreports every apple.

Coupons have a trap where a previously-removed offer returns marked as both deleted and still clipped, and the normal payload is refused as a duplicate, so it needs a different shape keyed off different fields. Getting that wrong means the coupon silently never comes back.

Also worth knowing: updating one field of an access policy replaces the whole block rather than merging, so writing a single new value can silently break every other consumer of that policy.

## Tradeoffs

Hosting turned out to be an egress problem before it was an auth problem: the service is unreachable from the datacenter range the rest of my infrastructure runs on, measured directly rather than inferred. Solving that meant accepting a dependency on a specific machine being awake, which is a real availability cost and the honest description is that if that machine sleeps, this is down.

I also traded search coverage for reliability. The real paginated search is blocked, so queries run through a different endpoint that returns the same product records but caps at about seven results.

No credentials are stored on the machine that signs in. Re-authenticating occasionally is cheaper than holding a password somewhere I would then have to defend.

## Outcome

Verified end to end: search, cart operations in both directions, bulk changes, substitution preferences, checkout totals, and slot reservation, which turns out to be a temporary hold that auto-releases rather than a booking.

Two bugs surfaced only under concurrent use. A load flag was set before the await that populated it, so parallel calls saw a spurious signed-out state; and the profile endpoint returns a **reduced** payload as a session degrades, which was overwriting good cached fields with undefined ones. It now merges rather than replaces.
