---
title: The Shutdown Ladder
tagline: A lamp in the living room that tells you the power state of the rack.
scale: 2
status: retired
domain: home
parent: home-assistant
started: 2020-07-19
ended: 2022-01-01
links: [homelab-kubernetes]
tech: [home-assistant, ups, shell-commands, templating]
---

## Problem

The homelab sat behind a UPS. A UPS buys you minutes, and minutes are only useful if something spends them deliberately. Left alone, the batteries drain and the machines drop as if the cord had been pulled, which is exactly the outcome the UPS was bought to prevent.

## Constraints

There was no screen anywhere I actually sat that showed the state of the rack. A dashboard you have to open is a dashboard you do not open, and power events are precisely the moment nobody is thinking to check one.

## Approach

I gave the state to a lamp. One light beside the TV became a three-colour status indicator on the power system.

Orange, flashing: mains is gone, running on battery. Red, flashing: battery is low enough that we are shutting down now, and the same automation fires the actual shutdown command. Green, flashing: mains is back, stand down.

## Edge cases considered

The shutdown requires two conditions at once, still on battery and charge below a threshold, and triggers off battery runtime changing rather than off a timer. A blip that drops power for four seconds should light the lamp orange and then green, and touch nothing else. Shutting down a rack because the lights flickered is a self-inflicted outage.

The threshold is 70 percent, not 20. This is the part that is counterintuitive and the part that matters: a graceful shutdown is not instant, and if you wait until the battery is nearly flat you have started a process you no longer have the runtime to finish. You lose the machines anyway, and you lose them mid-write. The safety margin has to cover the shutdown, not just detect the emergency.

Green is its own state rather than the absence of orange. An explicit all-clear tells you the system saw the recovery. Nothing happening is ambiguous: it looks identical to the automation being broken.

## Tradeoffs

A coloured lamp is a private code. It means nothing to a guest and it will mean nothing to me in five years without this write-up, which is a real cost of encoding status in ambient objects rather than words. I accepted it because the audience was one person who would learn it in a single power cut.

Colour alone also fails for anyone who cannot distinguish these three, which is a fair criticism of the design. The flashing carries some of the signal, but not the difference between orange and red.

## Outcome

Handled every outage until that lab was decommissioned. What stuck was the threshold reasoning: a shutdown trigger has to leave enough budget to complete the shutdown, and picking that number by asking "how long does the graceful path actually take" rather than "how low dare I go" is the whole game.
