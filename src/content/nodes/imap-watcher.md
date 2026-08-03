---
title: IMAP Watcher
tagline: Email screening backed by contact groups instead of filter rules.
scale: 1
status: shipped
domain: tools
tags: [client-work]
started: 2025-10-02
links: [dex-contacts]
tech: [javascript, imap, carddav]
---

## Problem

Screening email works well as an idea and badly as a pile of filter rules, because the rules live in the mail client and know nothing about who anyone is.

## Constraints

Had to work against a standard mailbox rather than a specific provider's automation, so the logic stays portable if the mail host changes.

## Approach

Watch the mailbox and maintain the screening decision as contact group membership rather than as filter rules. The decision then lives with the person, in a system that already syncs everywhere, instead of inside one client's settings.

## Edge cases considered

Watching a mailbox continuously means handling the connection dropping without either missing messages or reprocessing the whole folder on reconnect. That is the entire operational difficulty of this class of tool.

Screening also has to be conservative in one direction. A false negative means an unwanted message arrives; a false positive means something real is silently filed away, and only one of those is recoverable by the person waiting on a reply.

## Tradeoffs

Representing screening as contacts means it is only as good as the contact data, and it makes the mail rules depend on a second system being reachable. In exchange the decision is portable and legible instead of trapped in a client.

## Outcome

Part of the wider email screening workflow, running quietly. Same instinct as the contacts plugin: put the fact on the person, not in the tool that happens to be asking.
