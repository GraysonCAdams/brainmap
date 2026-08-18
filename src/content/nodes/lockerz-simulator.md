---
title: Lockerz Simulator
tagline: A working fan-made replica of Lockerz, complete with product catalog, cart, and its own reCAPTCHA login.
scale: 2
status: retired
domain: products
started: 2009-01-01
ended: 2010-12-31
links: [redemption-accelerator, redemption-accelerator-premium]
tech: [php, mysql, javascript, html, css, reverse-engineering]
---

## Problem

Lockerz was a rewards platform I did not run and had no special access to. Rather than write about how it worked, I built a second copy of it: product catalog, cart, boutiques and all, from what a visitor could see of the real site.

## Constraints

I was somewhere between twelve and thirteen, working alone, on a stack I had taught myself: PHP and MySQL with jQuery on the front end. The site's own disclaimer states it plainly, "This website is neither owned nor operated by Lockerz.com... entirely fan-based." Nothing about it was official and nothing about it pretended to be.

## Approach

The header called it "LI - Sim!", the Lockerz Invite Simulator. I rebuilt the pieces that made Lockerz feel like Lockerz: a product database, a shopping cart, boutiques to browse, a stats page, and a registration and login flow gated by Google's reCAPTCHA, the same anti-bot check the real site of that era used. I added an IP-to-country lookup so the site could resolve where a visitor was from, and built it with multi-language support from the start rather than bolted on afterward.

## Edge cases considered

Wiring reCAPTCHA into a login form I built myself, instead of skipping it because this was just a personal clone, is the detail worth keeping. It meant treating the fake platform with the same care as a real one, not because anyone required it but because that was the only way to find out how the real thing actually worked underneath.

## Tradeoffs

Whether this ever ran live for anyone besides me is not something the archive tells me; what survived is the code, not a usage record, so the honest scale of it is a complete working clone and nothing more specific. Reverse-engineering a product by rebuilding it is a slower way to learn a system than reading about it, and a much more durable one.

## Outcome

The simulator survived in my own archive as a finished, working codebase: product data, a functioning cart, registration, login, geolocation, and translated strings, all standing years after I moved on to other things. It's the earliest evidence I have of building something purely to find out how it was built.
