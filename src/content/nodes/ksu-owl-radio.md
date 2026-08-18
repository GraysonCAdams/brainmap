---
title: Owl Radio Streaming
tagline: Took a college radio station's stream off a paid vendor and onto hardware we ran ourselves.
scale: 3
org: KSU Student Media
status: retired
domain: media
tags: [platform]
started: 2015-01-01
ended: 2016-08-01 # Bracketed by the Student Media staff page: listed as
  # Website Manager on 2016-07-28, absent by 2016-08-31.
links: [ksu-student-media, halolobbies]
tech: [icecast, php, javascript, lastfm-api, ustream]
---

## Problem

The student radio station rented its stream from Live365. The money was real for a student organization, the audio quality was capped by the plan, and none of it was under our control.

## Constraints

A student media budget, which means the payback period has to be short enough that the next year's staff still benefit. Whatever replaced the vendor had to be operable by whoever held the job after me, not just by me.

## Approach

Self-host the stream instead of renting it, then build the player the station actually wanted rather than the one the vendor shipped. The site kept its existing jPlayer front end, so the work was not a new player so much as a new source behind it: our own stream host, and track metadata resolved through Last.fm so listeners could see cover art for whatever was on air. A separate studio page carried a live Ustream video feed of the booth, because a college station's appeal is partly that you can see the people doing it.

## Edge cases considered

Self-hosting moves the failure surface onto us. A vendor outage is somebody else's pager; a self-hosted outage during a live show is mine. That trade only made sense because the saving was large enough to justify carrying the operational load, and because the station's schedule made the risky hours predictable.

Metadata is a second stream that can fail on its own. The audio can be perfectly healthy while the now-playing lookup returns nothing, so the player has to degrade to a station name rather than sit on a blank where the track title goes.

The two campuses were the constraint I never fully solved. KSU and Southern Polytechnic merged during this period and the station eventually broadcast from Marietta as well, but the stream stayed one stream while I was there. A properly seamless handoff between two sources arrived in a later rebuild that I had no part in, and I would rather record that honestly than claim a feature that shipped after I left.

## Tradeoffs

Owning the stack meant owning it permanently, including handoff. I optimized for a successor being able to run it, which meant boring, documented choices over clever ones.

## Outcome

The paid stream was gone by mid-September 2015, replaced by one we ran, at better audio quality than the plan had allowed, with a Last.fm-backed player and a studio camera the vendor's player never offered. The footer read "Designed and developed by Grayson Adams" for the next fifteen months.

This is 2015, and it is the first time I replaced a paid service with infrastructure I ran myself. That has turned out to be a recurring habit.
