---
name: internal-link-architect
description: Use to plan internal links for a page. Crawls the site's existing pages and returns exactly which pages should link to the target and which the target should link out to, with the exact anchor text and the sentence to place it in. Also finds orphan pages, broken internal links and soft 404s, checks how well the money pages are linked and in the navigation, and maps topic clusters. Step 4 of the SAU sequence. Use for internal linking, orphan pages, topical authority or site structure questions.
metadata:
  internal: true
---

# Internal Link Architect

> **First:** read the profile `.sau/site.json` (see `running-sau`): it gives `brief`, `output_dir`, `locale`, `code_repo_path` and every other path. Call its scripts as `${CLAUDE_PLUGIN_ROOT}/skills/internal-link-architect/scripts/…` with `py` or `python3`, whichever exists.

Step 4 of 5. This is the step almost everyone skips. People publish a post and link
it from nowhere, so it sits with no internal authority and Google has no signal that
it belongs to a topic the site covers in depth.

It is also the most rules-based of the five, which is why automating it works well.

## Before you start

**The DataForSEO connector is required.** This skill needs a real page inventory.

**Read the site brief** (the profile's `brief` path) for the domain and, importantly, the **money pages**, so
links get prioritised towards the pages that actually earn.

**Read `01-keyword-map.csv`** if it exists (in the unit folder (page mode: `<output_dir>/<slug>/`; tanda mode: `<output_dir>/tanda-<YYYY-MM-DD>/`)), for the `owner_page` of each cluster.
Anchors that point at a money page use the owner's primary keyword.

## Input

The target page (a live URL, or the draft plus its intended URL) and the domain (the profile's `domain`).

## Process

### Step 1 — Build the page inventory

Get every indexable page on the site with its URL, title, H1 and main topic.

- Start with `/sitemap.xml`. If it returns HTML rather than XML, the sitemap is
  missing or broken: report that as a finding, it is a real problem, then fall back
  to a crawl.
- Use `on_page/task_post` for a full crawl, or `on_page/pages` for the page list on
  a site already crawled. For topic extraction use `on_page/content_parsing`.
- Exclude: tag and category archives, paginated archives, thank-you pages,
  noindex pages, and the target page itself.

Report how many pages you crawled. If you had to cap the crawl, **say what you
capped and what was left out.** A silent cap reads as complete coverage.

While you have the sitemap and the crawl, run three site checks. Report each one in
`SITE_CHECK_ROW`:

- **Sitemap dates.** `lastmod` should reflect real changes. The same fixed date on
  most URLs is a `warn`. Non-page entries (RSS, feeds) are a `warn`.
- **Soft 404s.** Request one URL that cannot exist for each page template (for
  example `/xx/blog/zz-no-existe-123`). It must return 404. A 200 is a `fail`:
  Google can index empty pages.
- **Broken internal links.** Check the HTTP status of every internal link found in
  the crawl. List each 4xx or 5xx link in `BROKEN_ROW` with the source page, the
  anchor and the status. Look for a pattern (for example a duplicated language
  prefix, `/xx/xx/…`) and name the probable cause once: one bug can break dozens of
  links. A broken link to a money page is the most urgent row.

### Step 2 — Find the links IN (this is the valuable half)

For each existing page, decide whether it has a genuine reason to link to the
target. A reason means the source page already discusses the target's topic in
passing.

For every proposed link, give all four of these:

1. **Source page URL** to edit
2. **Exact anchor text.** Descriptive and keyword-relevant. Never "click here",
   never the bare URL, never the same anchor on every link.
3. **The actual sentence on the source page** where the link belongs, quoted, so the
   user can search for it and place the link in seconds.
4. **Priority:** `pass` for high (strong topical match, strong page), `warn` for
   medium, `na` for optional.

Rank by topical relevance first, then by how strong the source page is.

**Blog rule.** Each blog post links to one money page: the `owner_page` of the
post's cluster, with that page's primary keyword as anchor. If a post already links
to two money pages that compete for the same cluster, flag it and say which link to
keep.

**Cap at 15 links in.** More than that on one target looks manipulative and nobody
will place 40 links by hand. If you found more, say how many you found and that you
showed the top 15.

### Step 3 — Find the links OUT

From the target page, link to existing pages that genuinely help the reader. Push
towards money pages where the context is honest. Never force a money-page link into
a sentence where it does not belong: that is the thing that makes a page read like
SEO spam.

Cap at 8.

### Step 4 — Orphans

List pages with zero internal links pointing at them, excluding the homepage. For
each, name the best page to link from and a suggested anchor. This is usually the
highest-value thing in the whole report because these pages are currently invisible.

### Step 4b — Money page coverage

For every money page in the brief, count how many crawled pages link to it ("2 of
51") and check whether it is in the header menu and in the footer. Rate it:

- `fail` — not in the menu or the footer, and linked from fewer than 5% of the
  pages. Google reads this as a minor page.
- `warn` — only one of the two (navigation or contextual links) is present.
- `pass` — in the navigation and linked from the content of related pages.

Report it in `MONEY_ROW`. This is a site-wide signal: a strong target page with no
navigation link still looks unimportant.

### Step 5 — Topic clusters

Group the inventory into topic clusters. For each: how many pages, which is the hub,
and whether the members actually interlink (`pass`), interlink weakly (`warn`), or
sit isolated (`fail`).

## Output

**`04-internal-links.html`** (in the unit folder (page mode: `<output_dir>/<slug>/`; tanda mode: `<output_dir>/tanda-<YYYY-MM-DD>/`)) — fill `${CLAUDE_PLUGIN_ROOT}/skills/internal-link-architect/templates/internal-links.html.template`.

Build a `data.json` and render it, because these tables get long:

```
<py|python3> ${CLAUDE_PLUGIN_ROOT}/skills/internal-link-architect/scripts/render.py ${CLAUDE_PLUGIN_ROOT}/skills/internal-link-architect/templates/internal-links.html.template data.json 04-internal-links.html
```

Row blocks: `LINK_IN_ROW`, `LINK_OUT_ROW`, `ORPHAN_ROW`, `CLUSTER_ROW`,
`SITE_CHECK_ROW`, `BROKEN_ROW`, `MONEY_ROW`.

- `SITE_CHECK_ROW`: `ROW_CHECK`, `ROW_RESULT`, `ROW_CHECK_STATUS`, `ROW_CHECK_CLASS`.
- `BROKEN_ROW`: `ROW_BROKEN_SOURCE`, `ROW_BROKEN_HREF`, `ROW_BROKEN_ANCHOR`,
  `ROW_BROKEN_STATUS`. Put the probable cause in `BROKEN_CAUSE`. If there are none,
  pass an empty list and set `BROKEN_EMPTY_DISPLAY` to `block`, otherwise `none`.
  Set `BROKEN_COUNT`.
- `MONEY_ROW`: `ROW_MONEY_URL`, `ROW_MONEY_INBOUND` ("2 of 51"), `ROW_MONEY_MENU`,
  `ROW_MONEY_FOOTER`, `ROW_MONEY_STATUS`, `ROW_MONEY_CLASS`.

Notes:
- `ROW_PRIORITY_CLASS` and `ROW_CLUSTER_CLASS` are one of `pass`, `warn`, `fail`,
  `na`.
- If there are no orphans, pass an empty `ORPHAN_ROW` list and set
  `ORPHAN_EMPTY_DISPLAY` to `block`. Otherwise set it to `none`.
- `DATA_NOTES` must state how many pages were crawled and anything excluded or
  capped.

## Honesty rules

- Only propose a link where the source page genuinely discusses the topic. A
  plausible-looking link plan full of forced links is worse than a short honest one.
- Quote real sentences from the real page. Never invent the sentence the anchor goes
  in: the user will search for it and not find it, and the whole report loses trust.
- Report only status codes you received. If you could not check a link, say so;
  never mark it as working.
- If the target page is brand new and nothing on the site relates to it, say that
  plainly and suggest what to publish first.

## Handing off

> Next: run `ai-visibility-checker`. It's the one that tells you whether any of this
> is actually getting you cited in ChatGPT and AI Overviews.

## Credits

Original: Galileo Studio internal SEO skills, adapted for the sau plugin.
