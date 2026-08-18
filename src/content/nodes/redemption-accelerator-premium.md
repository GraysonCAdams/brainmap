---
title: Redemption Accelerator Premium
tagline: The alerting half of an earlier prototype, rebuilt into a real Windows app.
scale: 2
status: retired
domain: products
started: 2011-01-01
ended: 2011-12-31
links: [redemption-accelerator, fast-alerts]
tech: [windows, http, html]
---

## Problem

I had already built the full chain for winning a Lockerz redemption race: detect, open, strip the page down, auto-fill the form. I looked at the finished thing and did not want it in anyone's hands, including my own going forward. RAP is what I built once I decided to keep only the first stage of that chain and make it something real.

## Constraints

Same target, same problem, further along the same year: Lockerz redemptions still opened and closed in seconds, and the only leverage available was still time. What had changed was the shape of the answer I was willing to build. Alerting is a weaker tool than the full chain, and this time that was the point.

## Approach

RAP is a Windows Forms desktop application, 1,335 lines across multiple forms, that polls Lockerz on a configurable interval and tells you the moment redemption status changes. It has a compact always-on-top mode for running it in the corner of a screen, an audio notification so a status change doesn't depend on watching it, an embedded browser so following the alert to the actual page is one click instead of a tab switch, and settings that persist between runs.

## Edge cases considered

The polling interval is configurable rather than fixed, which matters more than it sounds. Too aggressive and it's hammering someone else's server for no reason; too slow and the alert lands after the window has already closed. I don't have the number I settled on, only that it was a setting and not a constant, which means I was tuning it against something real rather than guessing once.

The embedded browser is where the scoping decision shows up most clearly. The earlier prototype opened and stripped the page automatically, because the goal then was to win the race outright. RAP opens a normal, unstripped page, because the goal here was to tell you in time to compete yourself, not to compete for you.

## Tradeoffs

Keeping only the alert half means RAP loses every race against the tool I had already built and chosen not to ship. I made that trade before I had a clean argument for why; the argument came a decade later with Fast Alerts, where the same line separated the tool we ran from the tools working against us.

## Outcome

A complete, working application: real network monitoring, real settings persistence, real audio and interface polish, finished rather than left as a demo. It's the shipped counterpart to the prototype I shelved, and proof that the smaller, honest version of an idea can still be a real piece of software.
