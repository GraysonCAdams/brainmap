---
title: Cameras Off When Home
tagline: Privacy enforced by cutting power, not by trusting a setting.
scale: 2
status: shipped
domain: home-automation
parent: home-assistant
started: 2023-07-27
tech: [home-assistant, smart-plugs, presence]
---

## Problem

Indoor cameras are useful for exactly one situation, an empty apartment, and are a liability in every other one. The usual answer is a privacy mode in the vendor's app, which asks you to believe a company's software about whether its own hardware is recording you.

## Constraints

The cameras were not mine to modify and their firmware was not open to inspection. Whatever guarantee I wanted had to come from outside the device, because anything inside it was the vendor's word.

## Approach

The cameras run through switched outlets, and presence drives the switches. When the apartment is occupied the outlets cut. When it empties, they energise.

There is no privacy mode, no toggle, no account setting involved. When I am home the cameras have no electricity.

## Edge cases considered

The automation triggers on any change to the presence sensor and then branches on the current state, rather than having a separate turn-on and turn-off automation. A single automation cannot disagree with itself. Two of them can drift, and the failure mode of drift here is cameras quietly powered while someone is home, which is precisely the state the whole design exists to make impossible.

Presence is a household sensor rather than my phone alone, so a guest in the apartment keeps the cameras dark even if I am out. The person a camera should least be recording is someone who never agreed to it.

The cost is a cold start. A camera coming out of a power cut takes time to boot and rejoin the network, so there is a gap of a minute or so after the apartment empties. I decided a short blind spot at the start of an absence was an acceptable price, because the threat model is a whole empty apartment over hours, not the first sixty seconds.

## Tradeoffs

Power cycling hardware daily is not what these devices were designed for and will shorten their lives. That is a real cost and I accepted it, because the alternative is a guarantee I cannot verify.

It also means the cameras genuinely cannot help with anything that happens while I am home, including the case where that is exactly what I would have wanted. That is the trade, and making it explicit is better than a setting that pretends I can have both.

## Outcome

Still running. The transferable idea is that the strongest privacy control is the one that does not require trusting the vendor, and if you can express a guarantee as a physical fact rather than a configuration flag, it stops being a promise and becomes a property.
