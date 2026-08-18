---
title: The Family Portal
tagline: A private dashboard for family passwords, notes, and tools, where every service checks the visitor itself.
scale: 3
status: shipped
domain: home
tags: [security]
started: 2026-07-11
links: [adams-family-christmas]
tech: [nodejs, javascript, oauth, docker, templating]
---

## Problem

The family needed one place to reach shared passwords, notes, and a few small tools without each person juggling separate logins or OAuth setups. A couple of those tools cost money per use, so anything unauthenticated reaching the app directly was a real cost, not just a theoretical hole.

## Constraints

Every service sits behind an access proxy that authenticates each request before it reaches the app, but the app can't just trust that the proxy is actually in front of it. The raw origin is still reachable to anyone who has the URL, and knowing that URL must not be enough to get in.

## Approach

A single YAML file lists the family and what each of them sees, and a build step renders it into a static dashboard, so adding a service or hiding a card for one person is a config edit, not a code change. The password vault and a couple of smaller apps sit behind the same portal. A dictation tool runs a family member's voice notes through Claude to fix phonetic dictation errors, with an explicit instruction to preserve their own words, sentence structure, and tone rather than rewrite them.

Every app independently verifies the proxy's signed token before doing anything, rather than trusting a header the proxy attached to the request. If that verification fails, or an app's own proxy configuration is missing in production, it refuses the request instead of falling open.

## Edge cases considered

One of the smaller apps had moved origins once during an earlier deploy, and afterward some visitors kept getting served a stale cached copy of the old app from their own browser, which then failed every request because it was calling the wrong place. The fix was to stop the browser from caching the HTML shell at all, so every visit re-fetches whatever is actually running now. Trusting a cache you don't control is how a replaced app keeps running long after you replaced it.

The password vault originally hit its backend live every time someone opened a reveal, which made the modal noticeably slow. A short in-memory cache on the couple of credentials people open most made that fast again, at the cost of a few minutes of staleness if something changes.

## Tradeoffs

Verifying the signed token at every origin, instead of trusting the proxy once at the edge, means each service repeats the same check. That's more code than a single shared gate, but it's the difference between the proxy being a convenience and the proxy being the only thing standing between the internet and a password vault.

## Outcome

Shipped and in daily use: a family portal with a working vault, a dictation cleanup tool, and a few smaller utilities, each independently checking who's asking before it answers.
