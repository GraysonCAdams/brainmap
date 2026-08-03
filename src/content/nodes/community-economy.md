---
title: The Community Economy
tagline: Points, a wheel, weekly challenges and a monthly shop, on a product that refused to sell advantage.
scale: 3
status: retired
domain: apps
parent: fast-alerts
started: 2022-01-01
ended: 2023-05-01
links: [fast-alerts]
tech: [discord, python, celery, redis, memberful, square]
---

## Problem

A free service funded by donations has no contract with anyone. People arrive for one restock, get it or do not, and leave. Meanwhile the Discord server was where the alerts actually landed first, which made it the real product surface and not a side channel.

So the question was how to make a community worth being in on the days nothing is in stock, and how to convert goodwill into the funding that kept the service running, without ever selling the one thing people came for.

## Constraints

That last clause is the whole design constraint. We had published commitments: no ads, no affiliate links, and no intentionally delayed alerts. Any economy attached to this product had to be incapable of selling speed, priority, or early access, because those are exactly the advantages we existed to take away from scalpers. An engagement layer that quietly recreated a paid fast lane would have been worse than having none.

## Approach

A points economy with several ways in and one way out.

Points came from participating: activity in the server, a daily bonus, a wheel spin, and weekly challenges. Ranks sat on top of the point totals, each with a name, an icon, a role and a number, and hitting the top rank changed your nickname.

The way out was a shop that opened once a month on a Celery schedule. Items had a category, a quantity, and a price in either dollars or points, with the rule that a points price was mandatory whenever the dollar price was zero. Redemptions could grant a Discord role, or issue a real coupon through the membership and payments providers. Monthly supporters got a discount.

It was built as a completely separate application from the alert pipeline, scoped per guild.

## Edge cases considered

A shop that opens once a month is a thundering herd by design. Everyone arrives in the same few seconds for a fixed quantity, which is the same oversell race that ruins ticket sales. Redemptions go onto a queue and a single worker drains it one at a time per guild, so ordering is serialised where inventory lives. Selling out is not detected in advance, it is discovered: the worker rejects an order and that rejection is what marks the item sold out. Scaling out across guilds is fine, scaling out within one is not, and that asymmetry is the entire concurrency design.

Any points economy is a farming target within a day of launch. Point-earning interactions carry a one-day cooldown, can be restricted to an allowlist of channels or excluded from an ignore list, and roles can be blacklisted from earning entirely. Without channel scoping the rational move is to spam whichever channel pays out, which degrades the server for everyone in exchange for a currency that then means nothing.

Points can go negative, and negative balances do not count toward a member's total unless explicitly flagged to. That is a moderation lever rather than an accounting detail: it allows a penalty that is visible without being permanently punitive, and it makes the default forgiving.

Redemptions can be locked to a rank, and each is limited to one purchase per person. Both exist to stop a single well-resourced member clearing the shop in the opening seconds, which is the community-scale version of the exact behaviour the whole company was built to fight.

## Tradeoffs

Every item in that shop is deliberately worthless in the only currency the product actually trades in. It sells roles, cosmetics and coupons, never a faster alert or an earlier one. That is a real revenue ceiling, accepted on purpose, and it meant the economy could support the service without ever being the reason someone got a graphics card.

Building it as a separate application doubled the operational surface: another deployment, another failure mode, another thing to restart at three in the morning. It was still right, because a crash in a wheel spin must never be able to take down a restock alert.

## Outcome

Ran until the shutdown in 2023. The idea I would carry anywhere is that an engagement economy has to be checked against the product's promise, not just its metrics. Points, wheels and challenges will reliably increase engagement, and if the redemption catalogue is not fenced off from the core value proposition they will quietly sell the thing you swore you would never sell.
