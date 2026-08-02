---
title: Grocery Pickup MCP
tagline: My AI assistant builds the grocery pickup order; I just pay.
status: shipped
domain: ai-tooling
tags: [apps]
started: 2026-05-15
links: [mcp-gateway]
tech: [mcp, typescript, reverse-engineering]
featured: 3
---

> Draft placeholder seeded during construction; the real write-up lands soon.

## Problem

Weekly grocery ordering is pure toil: search, cart, substitutions, pickup slot, every single week.

## Constraints

Stop before payment, always. The human approves the money.

## Approach

Reverse-engineered the store's app traffic into a tool server that searches, carts, manages substitutions, and reserves pickup slots.

## Edge cases considered

The bot-protection vendor blocked the login plane but not the data plane, which shaped the whole session model; sessions also expire fast enough that re-auth had to be a first-class flow.

## Tradeoffs

Unofficial APIs rot without warning. A monthly re-capture ritual keeps it alive.

## Outcome

Weekly orders happen in a two-minute chat.
