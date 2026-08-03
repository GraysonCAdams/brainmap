---
title: Unrecognized Entry
tagline: Motion while I am out does not just alert me, it addresses the room.
scale: 2
status: retired
domain: home
parent: home-assistant
started: 2020-08-04
ended: 2022-01-01
tech: [home-assistant, motion-sensors, tts, templating]
---

## Problem

Motion in the apartment while I was not in it. The interesting question is not how to detect it, which is one sensor, but what is worth doing in the ten seconds after.

## Constraints

A motion sensor and speakers, no camera in that room. Presence was inferred from my phone's location, which is a good signal and not a reliable one.

## Approach

Motion, plus my phone reporting not home, produces three things at once: a critical push to me, every light in the apartment to full brightness immediately, and a spoken announcement into the room stating that the apartment is under video surveillance and that the resident has been notified. The time is written to a variable so I can see afterwards when it happened.

The announcement is the part that is not an alert. Everything else tells me. That tells whoever is standing there that they have been seen, which is the only thing that changes what happens next.

## Edge cases considered

The automation refuses to fire if it has fired in the last hour, and it works that out from its own last-triggered timestamp rather than a helper. A person moving through a room trips a motion sensor continuously, so without this the design is a stream of notifications that convey nothing after the first and train me to swipe them away.

The lights go to full with a transition of zero. Every other lighting automation I have written fades, because fading is more pleasant. Here pleasant is wrong. A room going instantly bright is startling, and startling is the entire point.

Deciding what the announcement should say took longer than building any of it. It does not threaten and it does not accuse, because the overwhelmingly likely visitor is a friend, a neighbour, a maintenance worker, or my own phone having lied about where I was. It states a fact and it makes clear that someone knows, which is the deterrent for the rare case and merely startling for the common one.

## Tradeoffs

Phone-based presence is the weak link and I never fixed it. Losing GPS, or a phone on the edge of the home zone, produces an empty apartment being shouted at, and the cost of that false positive is low but the cost of the opposite, staying silent because the phone thought I was home, is high. I set the failure toward noise on purpose.

## Outcome

Ran for the life of that apartment and fired for real only a handful of times, every one of them benign. The design lesson I kept is that a security automation aimed only at the owner is half-built. Acting on the room, not just reporting on it, is a different and better category of response.
