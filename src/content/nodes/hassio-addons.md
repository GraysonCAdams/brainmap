---
title: Home Assistant Add-ons
tagline: Reviving abandoned add-ons because something I depend on stopped shipping.
scale: 2
status: shipped
domain: home
tags: [platform]
started: 2025-11-06
links: [home-assistant]
tech: [docker, shell, jinja]
---

## Problem

Several add-ons I depended on had stopped being maintained. In a self-hosted setup that is not an inconvenience, it is a slow-motion outage: the thing keeps working until a base image or a platform update finally breaks it.

## Constraints

I did not want to migrate off them, and I did not want to run unmaintained containers indefinitely. That leaves picking them up.

## Approach

Repackage and revive the ones I actually run: a calendar and contacts server, a remote access gateway, a TV backend, a proxy manager, plus a maintained fork of a template-filters extension. One of them needed a custom build tuned for the specific low-power hardware it runs on.

## Edge cases considered

Reviving an add-on is mostly about the packaging rather than the application. The upstream software is usually fine; what rotted is the base image, the build for a particular processor architecture, and the assumptions about where configuration lives. Discovering which of those three broke is most of the work.

Hardware-specific tuning is also a fork in the road. A build optimized for one small device is not the build for everyone, and pretending otherwise ships something that is worse for both.

## Tradeoffs

Taking over maintenance means owning it, and I now have several small things I have implicitly promised myself to keep alive. The alternative was migrating off tools that work, which is a larger cost paid sooner.

## Outcome

Running my own packaged versions of the add-ons my house depends on. This is the same conclusion as the plugin work, arrived at from a different direction: if you depend on something abandoned, maintaining it is usually cheaper than replacing it.
