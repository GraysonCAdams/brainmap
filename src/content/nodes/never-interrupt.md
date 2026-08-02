---
title: Never Interrupt
tagline: An automation that is ninety percent refusing to run, and that is the feature.
scale: 2
status: retired
domain: home-automation
parent: home-assistant
started: 2020-08-04
ended: 2022-01-01
tech: [home-assistant, sonos, templating, media-players]
---

## Problem

I wanted music to come back on in the living room by itself, the way it does in a shop. What I did not want, ever, was for the house to start playing music over something I was already listening to or watching.

## Constraints

Seven or eight media endpoints across four ecosystems: speakers, two casting displays, two streaming boxes, and a streaming account that reports its own state independently of all of them. None of them know the others exist. There is no single "is anything playing" question to ask.

## Approach

Three triggers, all cheap: motion in the kitchen, a podcast ending, or the speakers switching off. Then a wall of conditions that has to survive before anything actually plays.

The bulk of it is one negative condition enumerating every media player in the apartment, and for each of them both the playing and the paused state. Then a debounce, a presence check, and a cutoff after mid-afternoon.

## Edge cases considered

Paused counts as busy, and this is the condition that took the longest to get right. A paused streaming box does not mean nobody is using it, it means somebody is mid-episode and went to get a drink. Treating paused as free produces the single most annoying possible failure: music starting the moment you walk out of the room, over the thing you are coming back to.

The debounce is twenty five minutes and it is keyed to when the music last started, not when it last stopped. If I deliberately killed the music five minutes ago, I do not want a negotiation about it, and an automation that immediately undoes a manual action is one you end up disabling entirely.

The file still contains two commented-out conditions: a check against my calendar for whether I was in a meeting, and a timestamp comparison meant to catch a case the state checks missed. Both were tried and both were wrong in practice, the calendar one because "busy" on a calendar correlates poorly with a person actually being on a call. I left them in place rather than deleting them, because the next version of me would otherwise have exactly the same two ideas in the same order.

## Tradeoffs

The condition list is a hand-maintained inventory of the apartment. Every new speaker or streaming stick has to be added by hand, and a device I forget to add is a device the automation will happily talk over. That is genuinely brittle, and I never found a way around it that did not amount to writing the same list somewhere else.

I took it anyway, because the alternative failure is worse. An ambient automation that is occasionally silent when it could have played is invisible. One that occasionally interrupts you is one you turn off.

## Outcome

Ran for about two years and interrupted me, as far as I remember, never. The general shape has stayed with me: for anything ambient, the trigger is the easy part and nearly worthless. The guard conditions are the actual product, and the honest measure of the thing is not how often it fires but how often it correctly declines to.
