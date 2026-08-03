---
title: YNAB Automation Suite
tagline: When the bank aggregators kept breaking, I logged in like a human instead.
scale: 3
status: retired
domain: tools
tags: [client-work]
started: 2023-01-28
ended: 2026-03-09
links: [homelab-kubernetes]
tech: [typescript, puppeteer, imap, ynab-api, docker]
---

## Problem

Our budget only works if the transactions are in it, and the bank aggregation layer that was supposed to put them there broke every few weeks. Each break produced either missing transactions or duplicates, and both quietly corrupt a budget you are actively making decisions against.

## Constraints

No aggregator, which meant authenticating directly against each institution, including two-factor. It had to be zero-touch, because a daily import that needs me is a daily import I will abandon. And it had to be safe to re-run, since anything scheduled will eventually run twice.

## Approach

Drive the banks' own web sessions the way a person would, and handle the one-time codes by reading my own mail. The script requests the emailed code, connects over IMAP, waits for the message, extracts the code, submits it, and deletes the email. Clean transactions and balances then go through the budget's real API.

For Amazon I went the other way entirely and never opened a browser. Order confirmation emails already contain everything needed, so it parses those over IMAP and fuzzy-matches them to charges within configurable date and amount tolerances.

## Edge cases considered

The Amazon email total is often a few cents off the charge that eventually posts, so exact matching was never going to work. The tolerances exist because I checked what the real drift was rather than assuming it was zero.

Pending charges have no representation in the budget's data model at all, which took about twenty commits across two months to handle honestly: pending transactions that later void, pending amounts that change before posting, splits that need their sub-transactions carried across. Anything the matcher was unsure about got flagged for me to look at rather than silently guessed.

Automation needs an opt-out that a human can express in-band. Putting a specific marker in a transaction's memo tells the bot to leave it alone permanently, so I can override it from inside the budget app without touching config.

A crash loop against a rate-limited API is worse than being down, so the deployment caps restarts rather than retrying forever.

## Tradeoffs

Scraping a bank means the bank can break you at any time without notice, and it did. The maintenance record is honest about this: one commit says only "auth ID changed", another "fixed for new OTP email". That is the actual tax, paid a few times a year.

Automating logins also demanded better detection avoidance than I was comfortable needing. The pattern I landed on here, a real browser under a virtual display rather than a headless one, is the same pattern I reached for later in other work, which is the part worth carrying forward.

## Outcome

Ran our household budget daily for about two years. Two of the tools went public and found users I never expected: **16 and 13 stars**, with people opening issues trying to adapt them to Amex France and Amazon UK.

The most satisfying part came after I had personally moved off the platform: an outside contributor's fix-and-modernize pull request landed in March 2026, and I merged it and shipped one more configurability change the same day. The tool outlived my need for it.
