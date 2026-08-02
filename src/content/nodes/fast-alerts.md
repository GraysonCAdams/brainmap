---
title: Fast Alerts
tagline: Restock alerts that beat the scalpers, for 200,000 people.
scale: 5
status: retired
domain: apps
tags: [infra]
started: 2021-08-01
ended: 2023-05-01
links: [homelab-kubernetes]
tech: [kubernetes, celery, redis, react, python, nodejs, discord]
featured: 3
---

## Problem

The global chip shortage made consoles and graphics cards effectively unbuyable at retail. The inventory existed, but scalpers had two advantages an ordinary buyer could not match: inside information about when restocks would land, and auto-purchase bots that could complete checkout faster than a human can read a page. The stock was gone before most people knew it existed, and came back at roughly 75% markup.

## Constraints

We had to be faster than the people we were competing with, which meant latency was the product rather than a quality of it. It had to be free, because a paywall would have selected for exactly the buyers who were already winning. And it had to work against retailers who publish no restock signal at all and actively resist being polled.

## Approach

Scan continuously and fan the signal out the instant it changes. The tracker checked **over 210 listings** across retailers, scanning concurrently with a task queue and caching through Redis and SQL, on a Kubernetes backbone. Two delivery paths: a web tracker, and a Discord server that got the alert first because pushing to Discord is faster than we could update the site.

Funded by community donations rather than subscriptions.

## Edge cases considered

**The central problem is that a restock alert service is, by default, a perfect scalper tool.** Everything that makes it valuable to a person trying to buy one console makes it more valuable to someone running bots against the same feed. Solving the stated mission required treating our own users as adversaries and detecting which side of that line they were on, then denying them the product. By the later part of the run we had blocked on the order of **95,000** accounts on that basis. Building the alert was the easy half.

We also refused several things that would have made money, and named them on the site as commitments: no advertisements, **no intentionally delayed alerts**, no affiliate links. The middle one is the interesting one, because a delay is invisible. Competitors could monetize a premium tier simply by holding the free tier's alert back a few seconds, and nobody outside could ever prove it happened. Committing publicly to not doing it was the only available form of proof, and it foreclosed the most natural revenue model we had.

Choosing Discord as the fast path rather than the site was an admission about our own architecture: the push channel was genuinely lower latency than our own front end, and pretending otherwise would have cost users the thing they came for.

## Tradeoffs

Donations instead of subscriptions meant permanent under-funding of a service whose costs scaled with retailer count and user count simultaneously. That was the deliberate cost of the mission. A paid tier would have worked and would have quietly reintroduced the advantage we existed to remove.

Speed also fought accuracy. Alerting a fraction of a second sooner means alerting on less confirmation, and a false positive sends thousands of people to a page with nothing on it. That tension never fully resolved.

## Outcome

Launched August 2021 as **Fast Alerts Ltd. Co**, co-founded, and wound down in May 2023 as the shortage eased and the product's reason to exist went away with it. **Around 200,000 people used it**, with a Discord community in the tens of thousands.

The mission statement we published still reads as the right summary of the whole thing:

> "Scalpers share inside information on restocks and use auto-purchase bots to score inventory before anyone else can, and then they sell it at 75% markup to hard-working individuals who have no other options. We decided enough was enough."
