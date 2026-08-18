---
title: The Family Christmas Wishlist
tagline: A holiday wishlist app that used an Amazon login and an email whitelist instead of building real access control.
scale: 2
status: retired
domain: home
started: 2024-11-01 # UNVERIFIED: no commit dates in the archive. Inferred from
  # position before dibs-gifts (2025-11-18). Correct before this is treated as fact.
ended: 2025-11-01
links: [dibs-gifts, adams-home]
tech: [nextjs, react, typescript, oauth, sqlite]
---

## Problem

Coordinating family holiday wishlists with a spreadsheet or a group chat has no real structure to it: gifts get duplicated, or nobody buys anything because everyone assumed someone else had.

## Constraints

This is software for a family across a wide range of comfort with technology, at family scale rather than product scale, which changes what counts as a reasonable amount of access control to build. Signing in required an active Login with Amazon security profile on Amazon's side, not something under my control.

## Approach

Sign-in went through Login with Amazon instead of a password. Admin access was a plain email whitelist checked at every sign-in, plus a separate hardcoded list of accounts that always get in. Admins could edit a banner message, manage the whitelist, and reassign wishlist profiles between users. Every sign-in attempt, success or failure, got written to an audit log.

## Edge cases considered

Turning on a whitelist has an obvious chicken-and-egg problem: if the person meant to administer it can get locked out by their own whitelist, the feature is dangerous to use. Accounts on the hardcoded admin list bypass the whitelist entirely, so enabling access control could never accidentally lock the owner out.

If the app's Amazon OAuth security profile ended up scoped differently than expected, sign-in failed without an obvious error, and the only fix was checking an environment variable against the exact scope string configured on Amazon's side.

## Tradeoffs

An email whitelist plus a hardcoded admin list is not a real permission system, it's a single admin-or-user split with no granularity, and getting anything more precise later would mean a schema change. That was still the right call for an app a handful of relatives touch a few weeks a year: building proper role-based access for that audience would have been effort spent solving a problem the app didn't actually have.

## Outcome

A working wishlist coordinator that borrowed Amazon accounts for identity instead of building another password system. It was the second of three attempts at this idea and was eventually superseded by a rewrite built around a different core problem, hiding who claimed what from the person who asked for it.
