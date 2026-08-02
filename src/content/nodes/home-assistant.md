---
title: Home Assistant
tagline: Seven years of home automation that started with server alerts, not lights.
scale: 4
status: shipped
domain: home-automation
tags: [infra, workflows]
started: 2019-10-08
links: [homelab-kubernetes, morning-routine, litterbox-loop]
tech: [home-assistant, yaml, rest, templating]
---

## Problem

I wanted the house to act on things I already knew, without me being the integration layer between devices that do not speak to each other.

## Constraints

Every vendor exposes a different surface, several of them cloud-polled and slow to confirm. Anything that runs while I am asleep has to fail safe, and anything with a heating element has to fail safe regardless.

## Approach

Two eras, seven years apart in character. It began in October 2019 and, tellingly, the first automations I ever wrote were **homelab server up and down alerts**. Ops before lights. Within a year it covered remote car start through a voice relay for a car with no API, an on-call webhook that flashed the lights and read the sender and subject aloud, and a UPS rule that strobed red and gracefully shut down the homelab below 70% battery.

The current system runs 53 automations, 16 scripts, and 10 scenes, and has moved from reacting to devices toward inferring state from several weak signals at once.

## Edge cases considered

The most useful pattern here is treating a derived state as a state machine with one authoritative input. Sleep is driven entirely by the phone's next alarm; wind-down derives from it at a fixed offset, and there is an escalating failsafe if the primary path does not fire. One source of truth, everything else computed.

Presence inference is deliberately fused rather than sensor-driven. Being in the shower is inferred from illuminance, music playing, no motion, and the time window together; the difference between coding and being on a video call comes from which application is frontmost plus camera and microphone state. Any one of those signals alone is wrong often enough to be useless.

Anything with a heating element gets a hard budget rather than a timeout. The candle warmer tracks cumulative runtime against a **210 minute daily ceiling**, because the failure I was designing against is not "left on for an hour", it is "left on every day."

The medication and nutrition reminders bypass the flaky integration and speak raw REST, then verify after writing that exactly the expected number of items exist, and alert on two independent channels if not. It is a reconciliation loop rather than a fire-and-forget notification.

The Xbox bedtime rule needed characterization before it needed code. The console emits phantom power blips of roughly 70 seconds and re-stamps its own last-changed hourly, so a naive "is it on" check fires constantly. The guard requires it to have genuinely been on for three minutes, with the reasoning written inline next to it.

## Tradeoffs

Owning the integration layer means owning every vendor's quirks permanently, and the automations carry that as inline commentary explaining why each workaround exists. That commentary is the actual deliverable. A workaround with no recorded reason gets deleted by a future me who assumes it was cargo cult.

There is also a graveyard. Several elaborate systems I built are now ghost entities: a calorie and streak economy with penalties against gaming time, a snooze bank. I keep them visible rather than purging them, because the pattern of what I abandon is as informative as what I kept.

## Outcome

Running continuously since 2019 across two homes, currently 53 automations. The most interesting artifact is the earliest one: I reached for home automation as an operations tool first and a convenience second, roughly a year before infrastructure became my job.
