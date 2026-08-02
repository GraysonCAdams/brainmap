---
title: The Handoff Document
tagline: A confidential runbook written so a client could survive me disappearing.
scale: 2
status: retired
domain: apps
parent: freelance-web
started: 2018-06-13
ended: 2018-07-21
links: [sandbroker]
tech: [wordpress, bluehost, ssl, photoshop]
---

## Problem

A real estate brokerage hired me to build and launch a site. The site was the thing they were paying for, but it was not the thing that would determine whether they still had a working website in three years. That would be decided by whether anyone but me understood how it was wired together.

## Constraints

I was the only person who knew where anything lived: which registrar held the domain, whose card was on the hosting account, when the certificate expired, what the CMS login was. The client could not evaluate any of it, which meant they also could not notice it rotting.

## Approach

I wrote a technical information document and delivered it as part of the engagement rather than as a favor afterward. Domain expiry dates and auto-renew status, the hosting plan, the SSL certificate and the dedicated IP it needed, the security add-on, and the credentials for each. Marked confidential, dated, and revised as things changed through launch.

The site itself was deliberately boring: a purchased real estate theme on commodity shared hosting. Every hour I did not spend hand-building a listings grid was an hour spent on the document and on their content.

## Edge cases considered

The failure mode I was designing against was my own absence, not a bug. A small business site does not usually die from bad code. It dies because a fifteen dollar domain renewal lapsed on a card nobody was watching, and by the time anyone notices, the name is gone. So the expiry dates and the auto-renew status are the first things in the document, above anything technical.

Listing the dedicated IP as its own line item was for the same reason. It existed only because the certificate needed it, it appeared on the invoice as a mysterious recurring charge, and an unexplained recurring charge is exactly what gets cancelled by someone tidying up expenses two years later.

## Tradeoffs

The document lists passwords in plaintext. For its era and its reader that was the right call, and I would defend it in 2018: a shared secret in a document the client controls beats a secret only I can reach, and any scheme requiring them to install something would simply not have been used.

But I have thought about that document a lot since. Everything I have built for myself in the years after runs in the opposite direction, to the point that my current setup will not let me read a secret's value at all. The through-line from this file to that one is straight, and it starts with noticing that the most careful thing in the engagement was also the most dangerous artifact I produced.

## Outcome

Delivered mid-2018, revised through launch. The pattern stuck: every engagement after this one ended with a handoff document, and the reasoning behind it, that the client should own the thing they paid for even if I vanish, is the same reasoning I would later apply to secrets I hold for myself.
