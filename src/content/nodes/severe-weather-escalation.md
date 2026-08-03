---
title: Severe Weather Escalation
tagline: Storms respect quiet hours. Tornadoes do not.
scale: 2
status: retired
domain: home
parent: home-assistant
started: 2021-03-26
ended: 2022-06-01
tech: [home-assistant, nws, tts]
---

## Problem

Weather alerts arrive on a phone, and a phone at night is face down, muted, in another room, or all three. In Georgia the difference between a storm warning and a tornado warning is the difference between an inconvenience and a few minutes to get to an interior room.

## Constraints

The National Weather Service feed does not rank things by how much they should be allowed to wake you. Every alert arrives with the same urgency, so any system that treats them uniformly either shouts at you constantly or is asleep when it matters.

## Approach

Two tiers, distinguished by what they are permitted to override.

An ordinary storm warning speaks the alert text aloud on the living room speakers, but only during the day. A tornado warning ignores the time entirely, speaks a different and much more directive message, and takes every light in the apartment to full brightness with no fade.

The spoken text is chosen inline: the generic path reads out whatever the alert feed says, while the tornado path says something specific and instructional about seeking shelter, staying away from windows, and staying low.

## Edge cases considered

The quiet-hours rule is the whole design. A storm warning at three in the morning is not worth waking someone for, because there is nothing to do about it and the cost of being woken is real. A tornado warning at three in the morning is precisely the case the system exists for. So the time condition is written as a single OR: after the morning threshold, or a tornado is on the ground. One tier is polite. The other cannot be silenced.

The tornado message is not a read-out of the alert. Generic alert text is bureaucratic and describes a region rather than telling you what to do, and someone half awake needs an instruction, not a county list. Writing that sentence by hand, in the imperative, is the difference between information and an instruction, and only one of those is useful in the ten seconds after it plays.

Lights go to full with no transition, which is the same choice as the intruder automation and for the same reason: a fade is for comfort. Somebody who needs to move through a dark apartment quickly needs the lights on now, and the abruptness is itself part of the signal that this is not routine.

## Tradeoffs

A false tornado warning produces the most aggressive thing the apartment can do, at any hour, with no way to stop it from inside the automation. I accepted that asymmetry deliberately. The cost of the false positive is a bad awakening; the cost of the false negative is unbounded, and for a class of alert that fires a handful of times a year, that is not a close call.

Relying on text-to-speech through cloud services also means the alert is only as reliable as the network, which during severe weather is exactly when it is least reliable. That is a real weakness and I never solved it.

## Outcome

Ran through two Georgia storm seasons. The principle that outlived the setup is that an alerting system's most important decision is not what to say but what is allowed to override silence, and that the ranking must be written by hand. No feed will tell you which of its messages is worth waking someone for, because it does not know what silence costs at your house.
