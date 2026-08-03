---
title: Pull.fm
tagline: A music discovery engine with a record-store owner's taste.
scale: 4
status: building
domain: products
tags: [media, ai-tooling]
started: 2026-07-15
links: []
tech: [typescript, postgres, llm]
---

## Problem

Music discovery services recommend by similarity, which reliably surfaces things adjacent to what you already play and rarely surfaces anything you would not have found. I wanted recommendations that could tell you *why*, specifically, in a way a person would actually say out loud.

## Constraints

The reasoning has to come from real data rather than vibes, which means a large open music database and the joins to go with it. Generated prose had a hard budget ceiling for the entire catalogue, so quality could not come from throwing tokens at it.

## Approach

Build the reasoning as data first and language second. A card names a specific fact: which member, which band, what they played on. Then a generated sentence carries it in a consistent voice, with a non-model fallback so the system degrades to plainer text rather than to nothing.

Two rules govern every card. **A card must state the specific fact, not the category of fact.** "Shares a member" repeated twelve times with the names swapped is one sentence pretending to be twelve. And **only recommend what someone can act on**: an artist needs at least one track and a linkable profile, or it does not belong on the shelf. That gate runs before the ranker, so filtering refills rather than thins the results.

The written rule for the prose is deliberately asymmetric: *a sentence may be incomplete, and it may not be awkward or false.*

## Edge cases considered

The project's stated defining defect is **a check that reports success while checking nothing**, and most of the engineering discipline here follows from it.

Every new check has to be proven capable of failing. I perturb the code, watch the test go red, and restore from a file copy. That caught a real one: projecting a hardcoded null for a field reddened exactly one integration test while forty others stayed green, because forty tests expected null and could not tell *absent* from *unread*.

An implausible query result is a signal, not an anomaly. "This very famous artist has no streaming page" was the tell that a join was wrong. Two URL relationship tables differ by one letter, and joining the wrong one type-checks, runs, and cheerfully pairs an artist with an unrelated band's page. **Sanity-check a join against a fact you already know**, because it will otherwise be confidently wrong at scale.

A number that is too small is a filter that is not matching, not a thin tail. Two services returned a few hundred rows out of a load of over a million, which looked like sparse data and was actually a category error: those services have their own relationship types, so filtering on the generic ones silently missed nearly all of them. Confirmed against the live source before reloading rather than assumed.

There is also a build trap worth naming. Packages resolve through their compiled output, so editing source without rebuilding produces a **false green**. That one caught me three times in a single session, which is exactly the defect the whole project is named against.

## Tradeoffs

Gating on linkability means a genuinely interesting artist with no reachable profile never appears. That is a real loss, accepted because a recommendation you cannot act on is not a recommendation.

Generating prose at all was a decision with a budget attached rather than an open one, and the fallback path exists so the product does not depend on the model being available or affordable.

## Outcome

In active development. The most transferable thing here is not the discovery engine, it is the verification stance: a test that cannot be made to fail is not evidence, and a result that surprises you should be disbelieved before it is explained.
