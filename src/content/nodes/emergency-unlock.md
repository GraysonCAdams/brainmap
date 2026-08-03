---
title: Emergency Unlock
tagline: The door my phone unlocks, and what happens when my phone dies.
scale: 2
status: retired
domain: home
parent: home-assistant
started: 2021-05-31
ended: 2022-06-01
tech: [home-assistant, smart-locks, presence]
---

## Problem

A smart lock replaces a key with a phone. That is a straight improvement until the phone is at four percent and you are twenty minutes from home, at which point you have swapped a lost key for a dead battery and there is no locksmith for that.

## Constraints

The failure is silent and it is one-directional. Nothing tells you your automation is about to lock you out, and by the time it matters the device you would use to fix it is the device that died. Whatever the mitigation was, it had to fire while the phone still worked.

## Approach

Battery below twenty five percent, plus no motion anywhere in the apartment for half an hour, unlocks the front door and leaves it that way.

The half hour of stillness is what distinguishes "out" from "in another room", so this only ever arms when I am genuinely away. It notifies me that it has done it, and it notifies me again when it stops, so the state is never a surprise in either direction.

## Edge cases considered

The interesting part is that the apartment has a separate automation which locks the front door one minute after it is unlocked, and that automation is correct and should keep running. So this one does not disable it. It fights it.

The unlock sits inside a loop: unlock the door, then wait for the door to report itself locked. If the auto-lock wins, the wait completes, the loop goes round and unlocks it again. The two automations push against each other for as long as the condition holds, and the door ends up effectively unlocked without either automation being switched off or made conditional on the other's mood.

Two independent exits end it. Motion in the kitchen means a human is inside and no longer needs the door open. Battery back above the threshold means the emergency is over. Whichever happens first, the loop ends and the auto-lock resumes winning immediately.

The wait also has a timeout that does not continue. If half an hour passes with nothing locking the door, the sequence ends rather than looping forever, so a lock that has gone offline produces a stopped automation instead of an infinite one.

## Tradeoffs

This deliberately leaves a front door unlocked while nobody is home, which is the least defensible sentence in this entire map. I want to be plain that it is a real cost and not hand-wave it: for the window it is active, the lock provides no security at all.

I took it because the alternative failure is worse in expectation. Being locked out is certain to be expensive and certain to happen eventually, while the unlocked window is short, requires an adversary to be present during exactly that window, and ends the instant anyone walks into the kitchen. That is a bet, not a proof, and someone in a different building with different neighbours should take the opposite side of it.

## Outcome

Armed a handful of times and did its job every time. The habit it left behind is broader than locks: when you automate away a physical fallback, you have inherited responsibility for the case where the replacement fails, and the mitigation has to trigger on the leading indicator rather than the failure itself. Twenty five percent battery is not an emergency. It is the last moment you can still do something about one.
