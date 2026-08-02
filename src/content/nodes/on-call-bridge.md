---
title: The On-Call Bridge
tagline: My employer's pager, wired into the apartment, with a watchdog on the pager itself.
scale: 2
status: retired
domain: home-automation
parent: home-assistant
started: 2020-02-18
ended: 2021-06-01
links: [homelab-kubernetes]
tech: [home-assistant, webhooks, ios, tts, templating]
---

## Problem

On-call for enterprise systems, where the pager was email. Email on a phone is a badge you can sleep through, and the cost of sleeping through it was not mine alone to pay.

## Constraints

I did not own the alerting system and could not change what it sent. It emitted mail, and that was the contract. Everything I could do had to happen after the mail arrived, in the last hundred feet between my inbox and me actually being awake.

## Approach

A watcher turned qualifying mail into a webhook into the house, and the house escalated in stages.

First a push notification marked critical, which on iOS is the class that overrides silent mode and plays at full volume regardless of what the phone is set to. Then, only if my phone said I was home, a physical escalation: flash the bedroom light, wait five seconds, and speak the alert aloud on the bedroom display, naming who sent it and what it was about. Thirty seconds later the display turns itself back off.

## Edge cases considered

The whole thing hangs off a manual kill switch, because I was not always on call. A pager that alerts you during weeks you are not responsible is one you train yourself to ignore, and then it is worthless during the week you are.

It also refuses to fire outside my actual on-call hours, which did not include the small hours of the morning. That looks wrong at first glance, since a pager that sleeps is a contradiction, but the rotation genuinely did not cover that window and someone else's did. Encoding the real boundary of my responsibility into the automation is the same decision as the kill switch, one step finer: an alert I am not the right person to answer is not an alert, it is an interruption.

The spoken message pulls the sender's address out of the raw `Name <address>` header rather than reading the whole string, because hearing a display name and an address read aloud in sequence at 3am is noise, and the address was the part that told me which system was unhappy.

The part I am still proudest of is not the pager, it is the watchdog on the pager. Two more automations track whether the mail watcher itself is online. If it drops, that pages me. If it recovers, the recovery message does not just say "back online", it tells me whether the kill switch is currently on or off. After an outage the dangerous state is not the system being down, it is the system being up while silently muted, and believing you are covered when you are not is worse than knowing you are not.

## Tradeoffs

Critical alerts bypass Do Not Disturb by design, so every false positive spends real trust, and a system that cries wolf at 3am gets disabled within a week. That put the burden entirely on the filter deciding what qualified as an alert, which is unglamorous work and was most of the work.

Speaking alerts aloud in a bedroom is aggressive by any measure. It was correct for a household of one and I would not ship it to anyone else.

## Outcome

Ran through my on-call rotations until the role changed. The idea that a notification pipeline needs its own liveness check, and that the recovery message should restate the current configuration rather than just announce recovery, is the piece I have carried into everything since.
