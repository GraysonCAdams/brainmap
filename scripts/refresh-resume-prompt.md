# Monthly canonical resume refresh

You are an unattended, scheduled Claude Code session on GRAYTHINKPAD (fired by
the user-level `resume-refresh.timer`; Grayson is not watching). Your job: re-read
what actually shipped recently, re-assess which accomplishments best represent the
most recent professional role, regenerate the canonical resume content, and deploy
it so https://graysonadams.com/resume/view serves the fresh PDF. Grayson has
standing-authorized this exact flow, including the commit, push, and deploy at the
end. Nothing else is authorized: do not touch resume-facts.json, node content, or
site code beyond what is listed here.

Work in /home/gray/repos/brainmap. If the tree will not build for reasons
unrelated to your change, stop and notify rather than fixing unrelated code.

## Steps

1. `npm ci` only if node_modules is missing, then `npm run prebuild`. This
   rebuilds `src/data/experience-kb.json` from the node write-ups plus
   `src/data/private-kb.local.json`. If the script reports the private KB
   ABSENT, stop and notify: a re-assessment of the current role without it
   would be built from thin material and would overwrite a better one.

2. Re-assess. Read `src/data/resume-facts.json` (canonical facts; never edit
   it), `src/data/experience-kb.json` (his own words about the work; local
   only, never quote it anywhere public verbatim), the current
   `src/data/canonical-resume.json`, and whatever changed in
   `src/content/nodes/` since the current file's `generatedAt`
   (`git log --since=<generatedAt> -- src/content/nodes`). Then, for the MOST
   RECENT professional role (the first entry in facts.experience): write the
   bullet set that best represents the strongest work as of today, grounded in
   the KB. Other roles keep their canonical bullets unless the KB clearly
   offers a stronger phrasing of the same fact.

   Hard rules, same as the live generator's:
   - Never invent employers, titles, dates, metrics, or technologies. Every
     bullet must be grounded in facts or that role's KB entry.
   - Per-role bullet count must not exceed the canonical count in facts.
   - Write at the altitude of the existing canonical bullets: a system,
     capability or program he owned and what it did for the business. One
     incident, bug, root cause or debugging session is never a bullet on its
     own; the fix is at most a closing clause on the bullet about the system
     it belongs to. A number measures scope or outcome, never a count of
     failures fixed.
   - Plain, declarative register. No marketing adjectives. No em dashes.
   - This JSON is committed to a PUBLIC repo: bullets must be resume-grade
     public statements. No internal system names, hostnames, or figures beyond
     what resume-facts.json already publishes.

3. Write `src/data/canonical-resume.json`: `generatedAt` = today (YYYY-MM-DD),
   `basis` = one line saying what this assessment drew on, `content` =
   `{ skillsets, experienceBullets }`.

4. `npm run resume:check` must end with `ok: one page.` If it does not, trim
   the least load-bearing bullets until it does.

5. `npm run check` must report 0 errors.

6. Build and deploy exactly as DEPLOY.md's "Deploying" section describes
   (env vars for the build, tarball over loopback, brokered wrangler with the
   Production-vault Cloudflare credentials). Secrets go through sandbroker
   only; you use them, you never see them. If the Production vault is locked,
   finish steps 1-5 and 8, then notify Grayson (push notification) with the
   unlock command it names and `systemctl --user start resume-refresh.service`
   as the rerun, and stop. Do not look for another route to the credential.

7. Verify: `curl -sI https://graysonadams.com/resume/view` returns 200,
   `content-type: application/pdf`, and a `last-modified` matching today.

8. Commit only `src/data/canonical-resume.json` as
   `chore(resume): monthly canonical refresh` (Conventional Commits, no
   Claude attribution of any kind) and `git push`. Never `git stash`, never
   force-push, never commit anything matching src/data/*.local.json or
   src/data/experience-kb.json.

9. On any failure: stop, leave the tree as it is, and send a push notification
   saying which step failed and why.
