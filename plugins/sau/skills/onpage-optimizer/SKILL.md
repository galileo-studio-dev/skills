---
name: onpage-optimizer
description: "Use to audit and optimize a single page's on-page SEO. Detects whether it is a blog post or a service/product page and applies the matching checklist, then rewrites the title tag, meta description, headings and schema. Step 3 of the SAU sequence. Also use for on-page audits, title and meta rewrites, schema fixes, or when asked why a page isn't ranking."
metadata:
  internal: true
---

# On-Page Optimizer

> **First:** read the profile `.sau/site.json` (see `running-sau`): it gives `brief`, `output_dir`, `locale`, `code_repo_path` and every other path.

Step 3 of 5. The point of this skill is that **a blog post and a service page are not
graded on the same things.** Generic on-page checklists are why people optimise a
service page like an article and then wonder why it doesn't convert or rank.

## Before you start

**Read the site brief** (the profile's `brief` path). Several checks are literally unanswerable without it:
"is there an author bio" needs to know who the author should be, and "is this
specific rather than generic" needs the services and locations. If it is missing,
say which checks you will have to skip, or offer to run `site-brief-builder`.

**Respect the markers in the brief.** Every data point in the brief carries a
marker. The brief's section "Cómo leer este brief" defines them. They change what
you may recommend:

- `[PRIVADO]` — use it to judge the page. Never put it in a rewrite (title, meta,
  H1, schema) and never recommend publishing it. Examples: the current price level,
  the competitor list, client names without permission.
- `[OBJETIVO]` — judge whether the page moves towards it. Never recommend stating it
  as the current situation.
- `[HIPÓTESIS]` — accept it on the page only with the public wording the user
  approved in the brief.
- `⚠️ CONTEXTO INCOMPLETO` and `⚠️ verificar` — do not use the data and do not
  recommend it.

**The DataForSEO connector** is required for live URLs (not for a local draft).

## Input

Either:
- `draft.md` from `seo-content-writer`, or
- a live URL. Pull it with `on_page/instant_pages` for on-page elements and
  `on_page/content_parsing` for the body content. Match the connector tool by
  description rather than assuming an exact name. Also fetch the raw server HTML
  for check 10: the parsed content hides exactly the problems that check looks for.

Also read `01-keyword-map.csv` if it exists in the unit folder (page mode: `<output_dir>/<slug>/`; tanda mode: `<output_dir>/tanda-<YYYY-MM-DD>/`), for the page's cluster and its
`owner_page`, and `gsc.json` for `ctr_opportunities`. If the page is in
`ctr_opportunities`, the title and meta rewrite is the first fix: Google already
shows the page and people do not click.

## Step 1 — Detect the page type. Do this first.

Decide between **blog / informational** and **service / product** using:

- URL pattern (`/blog/`, `/post/`, dates, versus `/services/`, `/products/`)
- existing schema (Article and BlogPosting versus Service, Product, LocalBusiness)
- intent language (explaining a topic versus selling a specific thing)
- CTA density (one soft CTA at the end versus CTAs throughout)
- presence of price, booking or enquiry elements

State your conclusion and the evidence for it. **If the signals conflict, ask before
proceeding.** Running the wrong branch produces confidently wrong advice, which is
the worst possible output.

Then run **only** the matching branch.

## Branch A — Blog / informational

1. **Topical relevance and ownership.** Does the page actually answer the target
   keyword's intent, or drift? Quote the drifting section. If the keyword map names
   another `owner_page` for this keyword's cluster, the page competes with it: that
   is a `fail`, and the fix is to retarget the page or link to the owner. Under 600
   words on a guide is a `warn` (thin content).
2. **Freshness.** Dates in the copy, stats with a year attached, references to
   superseded tools or versions, "last updated" versus the real last modification.
   A visible update date and `dateModified` in the schema are both required. Name
   each stale item specifically.
3. **Internal links.** Count links in and out. Under 2 outbound contextual links or
   0 inbound is a fail, not a warning. The post links to exactly one money page,
   the `owner_page` of its cluster, with that page's primary keyword as anchor.
4. **Claims backed by sources.** Every statistic and factual claim should link to a
   high-quality source, inline, on the keyword. Flag unsourced numbers individually:
   these are what stop a page being cited.
5. **Author bio.** Present, named, with credentials, ideally linking to an author
   page. Compare against the author in the brief ("Identidad del autor").
6. **Schema.** Article or BlogPosting, plus FAQPage if there are Q&A sections.
   Valid, and matching what is actually on the page.
7. **Content capsule structure.** Is each H2 a question with a complete two-sentence
   answer directly beneath it? This is the check that decides whether AI engines can
   lift from the page at all. Quote one H2 that passes and one that fails.
8. **Brief markers.** The page publishes no `[PRIVADO]` data and does not state an
   `[OBJETIVO]` as the current situation. Quote every leak. A leak is a `fail`. Use
   `n/a` if the brief has no markers.
9. **Motion.** Check against `${CLAUDE_PLUGIN_ROOT}/skills/motion-director/motion-rules.md`: the H1, the
   hero and the LCP element are not animated; every piece is in
   `${CLAUDE_PLUGIN_ROOT}/skills/motion-director/motion-catalog.md`; no piece wraps an answer capsule; the dose matches the
   brief's "Movimiento" intensity and the block-piece cap (`bento`, `cifras`, `filas`: at most one per H2 section and
   six per page, at any intensity). Read the `motion:` frontmatter and any `:::`
   blocks. Use `n/a` if `motion-director` has not run yet, and say so.
10. **Technical hygiene.** Read the raw server HTML (fetch the URL; for a draft,
   check what applies). Each item is a `fail` when found:
   - **Hidden text:** `sr-only`, `display:none` or `<noscript>` blocks that hold
     keyword or city lists the visitor never sees. Quote them.
   - **Unresolved placeholders** in the title, meta description, H1 or Open Graph
     tags: translation keys (`section.item.metaTitle`), `{{…}}`,
     `undefined`.
   - **Title and meta length:** title over 60 characters or meta description over
     155, or either one already cut with "…". Give the count.
   - **Schema that does not match the page:** a FAQPage question that is not
     visible, an `areaServed` wider than the brief's service area, or NAP that
     differs from the brief.
   - **H1 or LCP element invisible without JavaScript:** an initial `opacity:0`,
     `visibility:hidden` or blur in the server HTML.
11. **Entity consistency.** Every statement about the company (name, relationships
    with ventures and partners, programmes, location, who built what) matches the
    brief's approved wording. Quote each contradiction and the brief line it breaks.
    A contradiction is a `fail`: AI engines repeat whichever version they find.

## Branch B — Service / product

1. **Schema.** Service, Product or LocalBusiness as appropriate, plus FAQPage.
   Check that NAP in the schema matches the brief's canonical NAP exactly (business
   name, "Dirección" and "Teléfono").
2. **Transactional intent satisfied.** Does the page let someone act, or does it read
   like a blog post about the service? Look for: what is included, who it is for,
   how it works, what it costs or how pricing works, how to start. If the brief marks
   pricing `[PRIVADO]`, check instead that the page explains how to get a quote, and
   never recommend publishing the price level.
3. **Specificity.** Would this copy read identically for a competitor in another
   city? If yes, that is a fail. Quote the generic sentences. Check the service and
   the location both appear naturally, not stuffed.
4. **CTA.** Present above the fold, repeated at the end, with one clear action.
   Check it matches the brief's primary CTA ("CTA principal") and points at the
   right URL.
5. **Trust signals.** Reviews or testimonials, credentials and certifications from
   the brief, real photos rather than stock, NAP visible. Never recommend a trust
   signal the brief marks `[PRIVADO]`, such as client names without permission.
6. **First fold.** Within one screen: what this is, who it is for, where it is
   offered, and how to start.
7. **Title and meta match intent and ownership.** Commercial or transactional
   phrasing, not informational. The title and H1 answer the search literally. If
   the keyword map names another `owner_page` for this page's cluster (home and
   service pages often compete), that is a `fail`.
8. **Brief markers.** The page publishes no `[PRIVADO]` data and does not state an
   `[OBJETIVO]` as the current situation. Quote every leak. A leak is a `fail`. Use
   `n/a` if the brief has no markers.
9. **Motion.** Check against `${CLAUDE_PLUGIN_ROOT}/skills/motion-director/motion-rules.md`: the H1, the
   hero and the LCP element are not animated; every piece is in
   `${CLAUDE_PLUGIN_ROOT}/skills/motion-director/motion-catalog.md`; no piece wraps an answer capsule; the dose matches the
   brief's "Movimiento" intensity and the block-piece cap (`bento`, `cifras`, `filas`: at most one per H2 section and
   six per page, at any intensity). Read the `motion:` frontmatter and any `:::`
   blocks. Use `n/a` if `motion-director` has not run yet, and say so.
10. **Technical hygiene.** Read the raw server HTML (fetch the URL; for a draft,
   check what applies). Each item is a `fail` when found:
   - **Hidden text:** `sr-only`, `display:none` or `<noscript>` blocks that hold
     keyword or city lists the visitor never sees. Quote them.
   - **Unresolved placeholders** in the title, meta description, H1 or Open Graph
     tags: translation keys (`section.item.metaTitle`), `{{…}}`,
     `undefined`.
   - **Title and meta length:** title over 60 characters or meta description over
     155, or either one already cut with "…". Give the count.
   - **Schema that does not match the page:** a FAQPage question that is not
     visible, an `areaServed` wider than the brief's service area, or NAP that
     differs from the brief.
   - **H1 or LCP element invisible without JavaScript:** an initial `opacity:0`,
     `visibility:hidden` or blur in the server HTML.
11. **Entity consistency.** Every statement about the company (name, relationships
    with ventures and partners, programmes, location, who built what) matches the
    brief's approved wording. Quote each contradiction and the brief line it breaks.
    A contradiction is a `fail`: AI engines repeat whichever version they find.

## Scoring

Report `passed / total` for the branch you ran, and a score out of 100 weighted by
impact rather than a flat average. Weight schema, capsule structure, specificity,
CTA, brief markers, technical hygiene and entity consistency higher than cosmetic
issues (motion is a medium-weight check), and say which weighting you used
in `DATA_NOTES`.

Mark each check `pass`, `warn`, `fail` or `n/a`. Use `n/a` (not `fail`) when
the brief was missing the input a check needed, and say so.

## Output

**`03-onpage-report.html`** (in the unit folder (page mode: `<output_dir>/<slug>/`; tanda mode: `<output_dir>/tanda-<YYYY-MM-DD>/`)) — fill `${CLAUDE_PLUGIN_ROOT}/skills/onpage-optimizer/templates/onpage-report.html.template` by hand.

Show the score out of 100 clearly in the report: `running-sau` reads it at gate P2 and compares it with the profile's `onpage_min`.

- `PAGE_TYPE_LABEL` and `BRANCH_LABEL` reflect the branch you ran.
- `OTHER_TYPE_LABEL` is the branch you did not run, so the user can spot a
  misdetection and re-run.
- Delete the `.fix` span on any check that passed.
- `ROW_STATUS_CLASS` is one of `pass`, `warn`, `fail`, `na`.
- Rewritten title, meta and H1 go in section 05, with character counts.
- Schema to add goes in section 06 as valid JSON-LD.

Every finding must quote the actual page. "Thin content" is useless; "the second H2
answers a different question than it asks, quote: …" is actionable.

## Handing off

> Next: run `internal-link-architect`. It'll crawl the rest of the site and tell you
> exactly which existing pages should link to this one, with the anchor text.

## Credits

Original: Galileo Studio internal SEO skills, adapted for the sau plugin.
