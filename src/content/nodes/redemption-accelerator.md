---
title: Redemption Accelerator
tagline: Built the whole automation chain at fifteen, then decided to stay on the alerting side of it.
scale: 2
status: retired
domain: products
started: 2011-03-01
ended: 2011-12-31
links: [gtotechnology, fast-alerts]
tech: [windows, http, html]
---

## Problem

Lockerz was a rewards site where you earned points through activity and spent them on prizes. Redemptions opened at unannounced moments and were gone in seconds, so a lot of people who had earned the points never got anything for them. The scarce thing was not points. It was the few seconds between a redemption going live and it being over.

## Constraints

I was fifteen, on a home connection, against everyone else on the site at once. I could not make their server faster and I could not know when stock would drop. The only ground I had was the gap between a redemption existing and a form being submitted.

## Approach

I took that gap apart a stage at a time, and each stage I closed revealed the next one.

Watch for a redemption going live and alert. Then open the page automatically instead of waiting for a click. Then strip the JavaScript and media out of the page so it rendered as fast as the line allowed. Then auto-fill the form so submission did not wait on typing.

By the end it was a complete chain from detection to submission with no human in it.

## Edge cases considered

Stripping the page came from realising I had the bottleneck wrong. I had assumed this was a reaction-time problem, the kind you solve by paying attention and being quick with a mouse. It was not. Under a rush the server is slow and the page is heavy at the same instant, so the race was being lost in transport and rendering before a person was involved at all.

Seen that way the fix has nothing to do with reflexes: stop downloading what you do not need. Images, tracking scripts and layout JavaScript contribute nothing to submitting a form, and every one of them competes for bytes on a connection already struggling. A stripped page finishes while a full one is still fetching assets.

I also learned that alerting on its own was worthless in that context. Telling a human a redemption is live, when they then have to open a browser, load a page and type, spends the entire advantage the alert just created. The chain only worked as a chain.

Which is what made the last step the real decision. Auto-fill is the point where the tool stops helping a person compete and simply competes on its own, and the difference between those is not technical. I did not publish it. It stayed a proof of concept and I went back toward alerting, which is the weaker tool and the one I was willing to have other people use.

## Tradeoffs

Alerting is genuinely worse at the stated job. Everything I had just proved says so: a notification hands you a lead you then squander on page loads and typing. Choosing it means accepting that the tool you release is beaten by the tool you already built and shelved.

I would not claim fifteen-year-old me reasoned this out cleanly. It was closer to a feeling that the finished thing was not something I wanted in other people's hands, arriving before I had language for why. But the direction was right, and it is the same line I ended up drawing a decade later with a lot more deliberation: alert people, do not act for them.

## Outcome

Never released. It existed as a proof of concept and as five demo videos on my channel, which together hold **2,849 views**, the preview of the last version being the most-watched thing there. No source survives, which for unpublished 2011 freeware is the expected outcome rather than a surprise.

Ten years later I co-founded a company built on exactly the choice this ended on. Fast Alerts told people when consoles and graphics cards came back in stock and deliberately did not buy anything for them, while the people we were up against were running the chain I had prototyped at fifteen, at scale, for profit. We blocked roughly ninety-five thousand accounts for it.

I do not think I foresaw any of that. I think I built the whole thing, looked at it, and did not like the last step, and the useful part is that the instinct showed up years before the argument for it did.
