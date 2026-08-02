---
title: Workspace ONE Migrations
tagline: Moving federal and corporate fleets onto a new device-management platform.
scale: 2
status: retired
domain: infra
tags: [workflows]
started: 2018-07-01
ended: 2019-06-01
links: [freelance-web]
tech: [workspace-one, mdm, jamf]
---

## Problem

Organizations with thousands of managed devices needed to move to a different management platform, often off an incumbent they had used for years. A migration like this is only partly technical: every device in the fleet belongs to a person who will notice if it goes wrong.

## Constraints

Federal and corporate customers, which sets the change-control bar high and makes "we will roll it back" a much harder promise to keep than it sounds. I was the consultant, not the owner, so I could recommend but not decide.

## Approach

Run the implementation as a sequence of scoped waves rather than a cutover, with the customer's own staff doing enough of the work to be able to operate it afterwards. Most of the actual job was scheduling, communicating, and making sure the right people were on the right call.

## Edge cases considered

The interesting failures in device management are almost never in the tooling. They are in the fleet's long tail: the devices that have been offline for months, the ones enrolled under a policy nobody remembers writing, the executive whose device cannot be touched during a specific week. Discovering that tail early is most of the value a consultant adds.

## Tradeoffs

Consulting work optimizes for the customer being self-sufficient after you leave, which frequently means choosing the more boring configuration over the more capable one. A clever setup that only I understood would have been a liability handed over at the end of the engagement.

## Outcome

A year of implementations and migrations across federal and corporate customers. It was also where I learned that talking to people is a technical skill with the same failure modes as any other: unstated assumptions, missing error handling, no retries.
