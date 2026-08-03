---
title: The Alert Pipeline
tagline: Two regions, a written one-minute SLA, and a phone emulator watching a store app because the API would not talk.
scale: 3
status: retired
domain: products
parent: fast-alerts
started: 2021-08-01
ended: 2023-05-01
links: [homelab-kubernetes]
tech: [kubernetes, python, django, celery, redis, fluent-bit, datadog]
---

## Problem

Detect that a retailer has stock, and tell tens of thousands of people, before the listing is gone. Restock windows were often measured in seconds, so a pipeline that was correct but a minute late was a pipeline that did nothing.

## Constraints

No retailer publishes a restock event. Every signal had to be inferred by polling something that was not built to be polled, by a company with an active interest in not being polled. We wrote the latency target down in a carrier filing rather than leaving it as an aspiration: alerts must be delivered within the minute of a product being restocked.

## Approach

Kubernetes, with the alert path split by region into separate namespaces for the US and Canada, and separate production and development environments. A Django service formatted and delivered alerts, Celery workers scanned listings concurrently, Redis and SQL absorbed the read load, and Fluent Bit shipped logs centrally so failures were diagnosable after the fact rather than only during.

Detection worked at whatever level the retailer permitted. Where an internal product-search endpoint could be reached, we called it directly and parameterised it per physical store, so stock was tracked per location rather than as one national yes-or-no.

Where that was not possible, we dropped a level. For one retailer the only reliable signal was their own phone app, so a macro driver ran inside an Android emulator on a VM, searching a product and returning to the home screen every few minutes, indefinitely.

## Edge cases considered

The emulator is the honest part of this system and the part I would defend hardest. It is inelegant, it is fragile, and it was the only thing that worked for that retailer. Refusing to build it would have meant telling users we did not cover the store they most wanted, in order to protect an architectural preference. Coverage is what the users came for.

That path also failed in a way an API never does: the app silently signed itself out, and the pipeline kept running against a logged-out session with no error anywhere. So retailer health became a first-class thing rather than an inference, surfaced as a channel that showed each retailer red or green, with the propagation delay after a fix written down so an operator would not conclude the fix had failed while waiting for state to settle. The account it ran on was disposable on purpose, because the store did not verify email addresses and a throwaway login is one less credential to protect.

Alert delivery and community features ran as separate services. They shared a naming prefix, which turned out to be a real hazard: the runbooks carry a bolded warning not to confuse them, and another not to delete a Deployment when you mean to delete a Pod. Both warnings exist because someone did it, at speed, under pressure. The fix was documentation rather than renaming, which in hindsight was the cheaper fix and not the better one.

Messages had to vary in wording, across sends and across originating numbers. Identical repeated content is the clearest signal a carrier spam filter looks for, and a filtered alert is an alert that did not happen. Nothing about that requirement is visible from the product side.

## Tradeoffs

Speed fights confirmation. Every check you add before firing costs the users the head start that is the entire point, and every check you skip risks sending thousands of people to an empty page. That tension never resolved, it only got tuned.

Per-store polling multiplies request volume by the number of stores you care about, against retailers who would rather you did not. Regional coverage and politeness were in direct conflict for the life of the product.

## Outcome

Ran from 2021 until the shutdown in 2023. What stayed with me is that infrastructure taste is a luxury of systems whose inputs cooperate. When the signal only exists inside a phone app, the choice is an ugly pipeline or no coverage, and picking the ugly one is not a failure of engineering standards, it is the standard being applied to the right question.
