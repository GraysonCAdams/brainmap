---
title: Couple Assistant
tagline: A shared AI assistant for two people, self-hosted with a common memory.
scale: 3
status: shipped
domain: ai-tooling
tags: [apps]
started: 2026-04-06
links: [mcp-gateway, box-stack]
tech: [open-webui, litellm, mcp, docker]
---

## Problem

An assistant that only one person can talk to is a personal tool. What my partner and I actually wanted was a shared one: common context, a shared library of things that matter to both of us, and a place either of us could ask a question and both see the answer.

## Constraints

Self-hosted, because the shared context is the relationship's own information. Cost had to be predictable rather than per-token unbounded. And it had to be usable by someone who does not want to think about models or configuration.

## Approach

Started as a private chat bot, then moved to a self-hosted web interface with a proxy layer in front of the models so the backend can change without anyone noticing. Shared knowledge and a shared channel are the features that make it a couple's tool rather than two accounts.

Tool access comes through the same gateway that serves my other assistants, so capabilities are added once rather than per surface.

## Edge cases considered

Shared and personal have to coexist. Some tools and context are genuinely joint; others are mine and should not surface in a shared thread. Getting that boundary wrong in either direction breaks it, either by leaking something private or by making the shared assistant useless because everything interesting is siloed.

The access model turned out to be the fiddly part, since the platform's defaults are built around an organization rather than a household of two.

## Tradeoffs

Self-hosting means I am the support desk, and when it breaks the person affected is someone whose evening I have just interrupted. That raised my standards for rollback more than any professional system has.

## Outcome

Running as a shared instance with a common library and a joint channel. The previous stack was left in place rather than deleted so a rollback was always one command away, which turned out to matter more than it usually does when the affected user lives with you.
