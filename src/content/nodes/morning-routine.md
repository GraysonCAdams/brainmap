---
title: Morning Routine Orchestration
tagline: One automation runs the morning, and it survived the outage that taught me why.
scale: 2
status: shipped
domain: home
tags: [client-work]
started: 2026-06-15
links: [litterbox-loop, home-assistant]
tech: [home-assistant, automations, templating]
---

## Problem

The same choreography every morning: curtains, coffee, vacuum scheduling, music. Spread across separate automations it was five things to edit whenever one detail changed, and five things that could each silently stop firing.

## Constraints

It must never fire while I am asleep, and it must not fire twice. Both failure modes are unpleasant in opposite directions, and presence data from a phone is not trustworthy enough to be the only guard against either.

## Approach

A single orchestrating automation triggered by the wake signal, with a done-flag helper making the whole sequence idempotent for the day. One place to edit, one place to read when something misfires.

## Edge cases considered

The design exists because of a specific outage. A single GPS blip marked the apartment empty at dawn, which cascaded into the routine cancelling itself, and it then failed **silently** for days before I noticed. Nothing errored. The house simply stopped doing something, which is the worst class of automation bug because there is no signal to alert on.

The fix was to stop treating presence as authoritative and pair the wake signal with a daily done-flag, so triggers re-arm rather than assuming the earlier evaluation was correct. I wrote the postmortem into the automation's own description field, where the next person to touch it is guaranteed to read it, rather than into notes I would lose.

Retriggering also needed an anti-recursion guard, because an automation that can be woken by its own side effects will happily wake itself. Vacuum scheduling separately needed dedupe, since the routine and the standing schedule could both queue the same run.

Transition times are set per trigger rather than globally. Waking to an alarm and drifting awake before one want different curtain and light ramps, and a single global value is wrong for both.

## Tradeoffs

More helper entities to reason about, and helpers are invisible state that will confuse me in a year. The offsetting benefit is that every step is separately inspectable when something misfires, which matters much more for a failure mode whose signature is silence.

## Outcome

Mornings run themselves, and edits touch one automation instead of five. The durable lesson is narrower than the automation: an automation that fails by not running needs a positive daily signal, because absence never raises an alarm on its own.
