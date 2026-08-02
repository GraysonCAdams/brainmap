---
title: dibs.gifts
tagline: A family wishlist where claiming a gift stays hidden from the person who asked for it.
scale: 2
status: shipped
domain: apps
started: 2025-11-18
links: []
tech: [nextjs, trpc, typescript, magic-links]
---

## Problem

Family gift coordination fails in a specific way: two people buy the same thing, or nobody buys anything because everyone assumed someone else had. Shared documents do not solve it, because the person who wrote the list can see the edits.

## Constraints

The people using this are family across a range of comfort with software, so anything requiring account creation and password management would have lost half of them immediately. And the core requirement is an information asymmetry: claims must be visible to everyone except the list's owner.

## Approach

A wishlist where a claim is a hidden "dib", plus group gifts that several people can split. Sign-in by emailed magic link, so there is no password to forget.

## Edge cases considered

The hiding has to hold everywhere, not just in the obvious view. A claim that leaks through a notification, an ordering change, or a count somewhere spoils the surprise just as thoroughly as showing it outright, so the owner's view is a genuinely different projection of the data rather than the same view with a filter.

Group gifts add a second problem, because a split needs to be visible to the participants and to nobody else, including the recipient who might otherwise notice several people claiming one expensive thing.

## Tradeoffs

Magic links trade a small amount of friction per sign-in for no password support burden, which is the right trade for an app used a few weeks a year by relatives who will not remember anything about it between uses.

## Outcome

The third iteration of this idea, after two earlier family wishlist attempts. Currently suspended rather than retired: it is seasonal, and the cost of keeping it warm year-round was not worth it.
