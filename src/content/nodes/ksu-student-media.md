---
title: Student Media Websites
tagline: Running the web presence for a university's newspaper and radio station.
scale: 2
org: KSU Student Media
status: retired
domain: tools
tags: [client-work, media]
started: 2014-08-01
ended: 2016-05-01
links: [ksu-owl-radio, freelance-web]
tech: [wordpress, php, css, automation]
---

## Problem

A university's student newspaper and radio station ran on a handful of aging WordPress sites, maintained by whoever currently had the job. Editors wanted to publish; instead they were negotiating with the software.

## Constraints

The staff turns over completely every few years, so any process that depends on a specific person knowing a specific trick will be lost. Editors are writers, not operators, and the tooling has to respect that.

## Approach

Redesign the newspaper site, maintain the fleet, and then attack the parts of the publishing routine that were repetitive rather than editorial. Automating the path from finished story to published story, and the weekly newsfeed email, gave the editors back the time they had been spending on mechanics.

## Edge cases considered

Automating a publishing workflow raises the cost of a mistake, because the same automation that saves an hour will also propagate an error faster than a human can catch it. Anything that publishes outward needs a point where a person can still stop it.

Designing for turnover is the other constraint that shaped everything. The right question was not "can I maintain this" but "will the person who has this job in two years be able to", and that ruled out several things I would otherwise have enjoyed building.

## Tradeoffs

Staying on a commodity platform rather than building something bespoke meant living with its limitations. It also meant the sites were still running long after I left, which is the only outcome that actually matters for student media.

## Outcome

Managed the site fleet from 2014, moved into the Website Manager role in late 2015, redesigned the newspaper's site, and automated the editorial publish path and the weekly newsletter.

This was my first job where other people depended on software I maintained, and the lesson that stuck was that handoff is a design requirement rather than a documentation task.
