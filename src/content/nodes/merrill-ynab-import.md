---
title: Merrill to YNAB Balance Sync
tagline: A small script that logged into my brokerage account so I didn't have to, just to keep one number honest.
scale: 1
status: retired
domain: tools
started: 2023-11-14
ended: 2023-11-17
links: [ynab-automation]
tech: [typescript, puppeteer, imap, ynab-api]
---

## Problem

Merrill.com had a working connection to Yodlee, the aggregator behind a lot of bank-to-app plumbing, but not to YNAB. That gap meant checking the real balance on Merrill's site and typing the difference into YNAB by hand.

## Constraints

Merrill offered no OAuth, so getting in meant reproducing an actual login: credentials, a security-question challenge, and a one-time code that only ever arrived by email. On the YNAB side, matching had to happen by name, so an account had to be named identically in both places for the script to know which one it was looking at. And it was built to run at most once a day, since a bank login script firing every few minutes is asking for trouble regardless of the platform.

## Approach

The script drove an actual Merrill login, then read the account data straight out of the page's own embedded state rather than scraping visible HTML, which meant nicknames and balances came back as structured values instead of parsed text. Each one got compared against the balance YNAB last knew about, and only a real difference produced a transaction: a single balance adjustment posted through YNAB's API.

## Edge cases considered

If nothing had changed since the last run, nothing got posted. That sounds obvious, but it was the difference between a daily job that stays quiet and one that spams a zero-dollar adjustment into the budget every single day.

If a Merrill account had no matching name on the YNAB side, the run logged a warning and moved on rather than guessing which account it was supposed to be.

Browser cleanup lived in a finally block, so a login that failed partway through never left a hung session behind to deal with on the next run.

## Tradeoffs

No OAuth meant the credentials for both services had to be handed to the script directly rather than through any kind of token exchange, a compromise the project's own notes complain about openly while waiting for something better to come along.

It's balance-only. The script can tell YNAB a number changed, not what caused it, so it was never a substitute for actually looking at transactions, only a way to stop that top-line number from silently drifting out of date.

It also shipped with a real bug: a pause meant to be ten seconds was written as ten million milliseconds instead of ten thousand, something close to three hours, and it sat there the whole time the tool ran daily. It still finished the job every day, just slower than intended, which is probably why nobody caught it.

## Outcome

Ran daily and kept one account's balance in YNAB matching reality without me opening the Merrill site. Scraping a bank that offers no clean way in turned out to be a problem I came back to on a larger scale later, across more than one institution.
