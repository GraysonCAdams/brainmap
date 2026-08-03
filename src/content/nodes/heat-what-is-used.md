---
title: Heat What Gets Used
tagline: The bedroom does not warm on a schedule, it warms once a light proves someone got up.
scale: 2
status: shipped
domain: home
parent: home-assistant
started: 2023-07-26
tech: [home-assistant, climate, presence]
---

## Problem

Scheduled thermostats condition rooms on the assumption that a clock predicts occupancy. On a weekday it roughly does. Every other day it heats an empty bedroom for hours because the schedule said morning.

## Constraints

Two thermostats, two zones, and no occupancy sensing worth the name in either room. Whatever inference I made about whether someone was actually up had to come from signals I already had.

## Approach

The morning automation splits the two zones and treats them differently.

The living room switches to its home preset on the clock, unconditionally, because that is where a person goes first and being cold on arrival is the failure this exists to prevent. Then the automation stops and waits, not for a timer but for the living room light to turn on. Only when that happens does the bedroom get conditioned too.

If the light never comes on, the wait expires after four hours and the automation ends without touching the bedroom at all.

## Edge cases considered

The waiting step is set not to continue on timeout, which is the entire design in one flag. The default behaviour of a wait is to give up and carry on, which would heat the bedroom anyway and reduce the whole thing to a schedule with extra steps. Timing out has to mean "the assumption was wrong, do nothing", not "proceed regardless".

A light switching on is a deliberately weak proxy for a person being awake, and I picked it over anything cleverer because it is nearly free and its errors are cheap in the right direction. A false negative costs a slightly cold bedroom later. A false positive costs some wasted heat. Neither is a real problem, which is what lets a crude signal be the right one.

The four hour window is long on purpose. It is not a guess at when I get up, it is the point past which conditioning the bedroom for the morning has stopped making sense.

## Tradeoffs

This will not work in a household where someone goes straight from the bedroom to the door without turning on a living room light, and it is not a general solution to occupancy. It is fitted tightly to one apartment and one person's path through it in the morning, which makes it effective here and worthless anywhere else.

## Outcome

Still running. The idea I keep coming back to is that most home automation guesses at intent and then commits regardless, and that a cheap observation you can wait for beats an expensive prediction you have to trust. Waiting for evidence, and doing nothing when it does not arrive, is available in almost every automation and used in almost none of them.
