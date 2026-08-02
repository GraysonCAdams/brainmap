---
title: Owl Radio Streaming
tagline: Brought a college radio station's stream in-house and cut its cost by 95%.
scale: 3
status: retired
domain: media
tags: [infra]
started: 2015-01-01
ended: 2016-05-01
links: [ksu-student-media, halolobbies]
tech: [icecast, php, javascript, lastfm-api, ustream]
---

## Problem

The student radio station paid a third-party service to carry its stream. The money was real for a student organization, the audio quality was capped by the plan, and none of it was under our control.

## Constraints

A student media budget, which means the payback period has to be short enough that the next year's staff still benefit. Whatever replaced the vendor had to be operable by whoever held the job after me, not just by me.

## Approach

Self-host the stream instead of renting it. Then build the player the station actually wanted rather than the one the vendor shipped: a web player pulling album art from a music-metadata API so listeners could see what was playing, plus a live video feed of the studio itself, because a college station's appeal is partly that you can see the people doing it.

## Edge cases considered

The station broadcast across two campuses, and a listener moving between them should not have to think about it. The player switches streams seamlessly rather than exposing that as a choice, which is the sort of detail that is invisible when it works and is the entire experience when it does not.

Self-hosting also moves the failure surface onto us. A vendor outage is somebody else's pager; a self-hosted outage during a live show is mine. That trade only made sense because the cost saving was large enough to justify carrying the operational load.

## Tradeoffs

Owning the stack meant owning it permanently, including handoff. I optimized for a successor being able to run it, which meant boring, documented choices over clever ones.

## Outcome

Streaming costs cut by around **95%**, roughly two thousand dollars for a student organization, with better audio quality than the paid plan had allowed. Listeners got album art and a live studio camera that the vendor's player never offered.

Worth noting the date: this is 2015, and it is the first time I replaced a paid service with infrastructure I ran myself. That has turned out to be a recurring habit.
