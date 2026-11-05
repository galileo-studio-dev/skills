---
name: keyword-fanout-map
description: Use for keyword research: turning a seed keyword, business type or topic into an intent-clustered keyword map with real search volumes, AI search volume and the fan-out questions a page must answer. Step 1 of the 5-skill SEO system. Also use when asked what to write about, which keyword to target, or to find keywords for a page.
---

# Keyword & Fan-Out Map

> **Antes de nada:** lee el perfil `.sau/site.json` (ver `running-sau`): de él salen `brief`, `output_dir`, `locale`, `code_repo_path` y el resto de rutas. Los scripts se invocan como `${CLAUDE_PLUGIN_ROOT}/skills/keyword-fanout-map/scripts/…` con el intérprete `py` o `python3` (el que exista).

Step 1 of 5. Produces the keyword map every later skill reads, so nothing has to be
restated.

## Before you start

**Required: the DataForSEO connector.** Without it there are no real search volumes
and this skill would be guessing, which is worse than useless because the guesses
look like data.

Check for a DataForSEO tool. If there isn't one, stop and say:

> This skill needs real search data. Connect DataForSEO first:
> Customize → Connectors → Add custom connector → `https://mcp.dataforseo.com/mcp`
> → Connect → approve. Takes about a minute, then run this again.

**Also read the site brief** (the profile's `brief` path). Take `SEARCH_COUNTRY`,
`SEARCH_LANGUAGE`, the service area, the services list and the competitors from it.
If it is missing, say so and offer to run `site-brief-builder` first. You can
proceed without it, but you must then ask for country and language explicitly and
warn that the volumes are only correct for the values given.

## Input

A seed keyword, or a business type plus location, or just a topic. If the user
gives you nothing, propose three seeds from the services list in the brief.

Optional: a **Google Search Console export** ("Performance on Search", as a .zip or
a folder with `Queries.csv`, `Pages.csv`, `Chart.csv`, `Countries.csv`,
`Filters.csv`). Ask for it once if the user has not given it. It shows where the
site already appears. It never replaces DataForSEO volumes.

## Process

### Step 1 — Expand

Use the DataForSEO connector. The endpoints you want, by API path:

- `dataforseo_labs/google/keyword_ideas` — the main expansion
- `dataforseo_labs/google/related_keywords` — semantic neighbours
- `keywords_data/google_ads/search_volume` — volume, CPC, competition
- `ai_optimization/ai_keyword_data/keyword_data` — AI search volume, meaning how
  often people put this into an LLM rather than a search box
- `dataforseo_labs/google/bulk_keyword_difficulty` — keyword difficulty (0–100)
- `dataforseo_labs/google/keyword_overview` or `historical_keyword_data` — monthly
  searches, for the 12-month trend
- `dataforseo_labs/google/ranked_keywords` — where the site's own domain ranks today
- `serp/google/organic` — who currently ranks. Required for the primary keyword and
  for the top keyword of each cluster (see Step 1b)

Tool names in the connector map onto these paths. Pick the matching tool by its
description rather than assuming an exact name.

Always pass the location and language from the brief and the profile: use
`dataforseo.location_code` and `dataforseo.language_code` when the profile has them,
otherwise derive country and language from `locale`. Never default to the United
States because it is convenient. If the profile lists `existing_pages`, read those
files to know the site's current pages before assigning `owner_page`.

### Step 1b — Check the SERP before you trust a keyword

Pull the live SERP for the primary candidate and for the top keyword of each
cluster. Check three things:

1. **How Google reads the query.** Look at the top 10, the knowledge panel and the
   AI Overview. If Google reads the query as a different thing (another entity, a
   public body, a different meaning), the keyword is a **vocabulary trap**. Example:
   a phrase that, in the target market, shows a public regulator or an unrelated
   entity in the top 10 instead of companies offering the service. Never pick a trap
   as the primary. Propose the wording Google does read correctly and list every trap in
   `SERP_CHECK_ROW` and `DATA_NOTES`. Treat ambiguous brand queries (a brand name
   shared with other products) the same way.
2. **Who wins each cluster.** Record the domains in the top 10. These are the
   **search competitors** for that cluster. They are often not the business
   competitors in the brief. If a brief competitor does not appear in the top 20 of
   any cluster, say so. If a domain wins several clusters and is not in the brief,
   propose it. Never edit the brief yourself: put the proposal in `SERP_CHECK_ROW`
   and in the handoff, and let the user decide.
3. **What kind of page wins.** Product page, comparison guide, agency service page,
   public body, directory. This tells the writer what format the page must beat.

### Step 2 — Filter and cluster

Discard: keywords with zero volume and zero AI volume, obvious misspellings, and
branded terms belonging to competitors.

Group what is left into topic clusters. Tag every keyword with one intent:

- `informational` — wants to understand ("what is", "how does")
- `commercial` — comparing before buying ("best", "vs", "review")
- `transactional` — ready to act ("near me", "book", "buy", "price")
- `navigational` — looking for a specific brand

Add four values to every keyword:

- `keyword_difficulty` — from the API, 0–100.
- `trend_12m` — the average of the last 3 months against the same 3 months a year
  earlier, as a percentage ("+25%"). Only from the monthly data the API returns.
- `current_position` — the site's position for the keyword today, from
  `ranked_keywords` (or Search Console in Step 2b). "not ranked" when the domain was
  checked and the keyword is not in its top 100.
- `opportunity`:
  - `quick_win` — the site ranks 7–20 today. Moving up costs less than starting
    from zero. Always list these first in `PRIMARY_RATIONALE` or `DATA_NOTES`.
  - `defend` — the site ranks 1–6 today.
  - `new` — the site does not rank.

Then assign each keyword a **role**:

- `primary` — exactly one. The H1 subject.
- `secondary` — earns its own H2.
- `support` — use naturally in body copy.
- `skip` — right topic, wrong intent for this page. Keep it visible so the user can
  see it was considered and rejected rather than missed.

**Pick the primary on intent match, not just volume.** A 2,400/month
informational keyword is the wrong primary for a service page, and choosing it is
the single most common keyword research mistake.

**One owner page per cluster.** Every cluster gets exactly one `owner_page`: the
URL on the site that should rank for it. Decide it like this:

1. The target page of this run owns the primary keyword's cluster.
2. For other clusters, the owner is the money page from the brief that matches the
   cluster. If none matches, the site page that already ranks best for it. If no
   page fits, write `new`.
3. **Cannibalisation.** If two or more URLs of the site rank or get impressions for
   the same cluster (home, a service page and a landing often compete), flag it in
   `DATA_NOTES`. Name the owner and say what the other pages should do instead:
   target a different cluster, or link to the owner with the cluster's primary
   keyword as anchor.

`seo-content-writer`, `onpage-optimizer` and `internal-link-architect` read
`owner_page`, so write the full path (`/es/ejemplo`), not a description.

### Step 2b — Cross with Search Console (only if an export was given)

Write a first `01-keyword-map.csv`, then run (`py` or `python3`, whichever exists;
paths inside the unit folder (page mode: `<output_dir>/<slug>/`; tanda mode: `<output_dir>/tanda-<YYYY-MM-DD>/`)):

```
<py|python3> ${CLAUDE_PLUGIN_ROOT}/skills/keyword-fanout-map/scripts/gsc_merge.py <export.zip> 01-keyword-map.csv gsc.json \
    --topic '<regex for the topic>' --target-page <path of the target page> \
    --country <Country name as in the export>
```

Use `gsc.json` for four things:

1. **Missed keywords.** Take the `gsc_only` queries. Look up their volume in
   DataForSEO. Add a query to the map only if DataForSEO returns a volume. Queries
   with no volume stay in the Search Console table of the dashboard, never in the
   CSV.
2. **Primary choice.** Intent match still decides first. Between keywords with the
   right intent, prefer the one where the site already has impressions at position
   20 or better: Google already links the site to it.
3. **Cannibalisation.** Look at `pages`. If another page (often a blog post) takes
   most of the topic impressions, give that page the list or informational
   keywords and keep the commercial ones for the target page. Say so in
   `GSC_SUMMARY` so `internal-link-architect` can act on it.
4. **Limits.** Report in `DATA_NOTES`: export window, country share
   (`country_clicks` / `total_clicks`), and how many clicks the query table explains
   (`query_table_clicks` / `total_clicks`). Search Console hides rare queries.
5. **Quick wins and CTR.** Use `gsc_position` to confirm `opportunity` when
   DataForSEO has no position. Then read `ctr_opportunities`: pages of the whole
   site with many impressions, a position of 15 or better and a CTR under 1%. Their
   title and meta description are the cheapest fix on the site. List them in
   `GSC_CTR_ROW` and hand them to `onpage-optimizer`.

Search Console impressions are not search volume. They depend on the site's
position. Never write them in the `search_volume` column.

### Step 3 — Fan-out questions

Get the follow-up queries AI engines expand this topic into:

- `ai_optimization/llm_mentions` for the fan-out queries attached to the topic
- the People Also Ask block from the SERP endpoint
- `dataforseo_labs/google/related_keywords` question-form results

Keep the ones a single page could genuinely answer. Each becomes an H2 with a
two-sentence answer directly under it. Drop anything that belongs on a different
page and say so.

## Output

Write two files, both in the unit folder (page mode: `<output_dir>/<slug>/`; tanda mode: `<output_dir>/tanda-<YYYY-MM-DD>/`).

**`01-keyword-map.csv`** — columns exactly:
`cluster,keyword,intent,role,search_volume,ai_search_volume,keyword_difficulty,trend_12m,competition,cpc,current_position,opportunity,owner_page,gsc_impressions,gsc_clicks,gsc_position`
Sort by role (primary, secondary, support, skip) then volume descending. This is
the file `seo-content-writer` reads, so the column names matter. The three `gsc_*`
columns come from `gsc.json`. Write "no data" when the keyword is not in the export
or when no export was given. Write "no data" in any other column the API did not
return.

**`01-keyword-map.html`** — fill `${CLAUDE_PLUGIN_ROOT}/skills/keyword-fanout-map/templates/keyword-map.html.template`.

Build a `data.json` and render it:

```
<py|python3> ${CLAUDE_PLUGIN_ROOT}/skills/keyword-fanout-map/scripts/render.py ${CLAUDE_PLUGIN_ROOT}/skills/keyword-fanout-map/templates/keyword-map.html.template data.json 01-keyword-map.html
```

`data.json` shape:

```json
{
  "tokens": { "SUBJECT": "...", "KW_TOTAL": 42, "...": "..." },
  "rows": {
    "KEYWORD_ROW": [{ "ROW_CLUSTER": "...", "ROW_KEYWORD": "...", "...": "..." }],
    "FANOUT_ROW": [{ "ROW_QUESTION": "...", "ROW_QUESTION_NOTE": "..." }],
    "SERP_ROW": [{ "ROW_POSITION": 1, "ROW_DOMAIN": "...", "...": "..." }],
    "SERP_CHECK_ROW": [{ "ROW_CHECK_CLUSTER": "...", "ROW_CHECK_QUERY": "...", "...": "..." }],
    "GSC_CTR_ROW": [{ "ROW_CTR_PAGE": "...", "ROW_CTR_IMPRESSIONS": 120, "...": "..." }]
  }
}
```

Notes on tokens:
- `ROW_INTENT_CLASS` must be one of `info`, `comm`, `trans`, `nav`.
- If you skipped the SERP check, set `SERP_TABLE_DISPLAY` to `none` and
  `SERP_EMPTY_DISPLAY` to `block`. Otherwise `block` and `none`. Skipping it is
  only acceptable when the SERP tool is unavailable; say so in `DATA_NOTES`.
- `KEYWORD_ROW` also takes `ROW_KD`, `ROW_TREND`, `ROW_POSITION_NOW`,
  `ROW_OPPORTUNITY` and `ROW_OWNER`.
- `SERP_CHECK_ROW`, one row per cluster checked: `ROW_CHECK_CLUSTER`,
  `ROW_CHECK_QUERY`, `ROW_CHECK_READING` (how Google reads it),
  `ROW_CHECK_WINNERS` (top domains), `ROW_CHECK_PAGE_TYPE`, `ROW_CHECK_BRIEF`
  (which brief competitors appear, or "none") and `ROW_CHECK_STATUS` /
  `ROW_CHECK_CLASS` (`pass` usable, `warn` ambiguous, `fail` vocabulary trap).
- `GSC_CTR_ROW`: `ROW_CTR_PAGE`, `ROW_CTR_IMPRESSIONS`, `ROW_CTR_CLICKS`,
  `ROW_CTR_RATE`, `ROW_CTR_POSITION`. Empty list if there is no export or no
  opportunity.
- `DATA_WINDOW` is the volume window, normally "12-month average".
- `DATA_NOTES` must state the location and language used. This is how the user
  catches a wrong-market run.
- Search Console section: with an export, set `GSC_BLOCK_DISPLAY` to `block` and
  `GSC_EMPTY_DISPLAY` to `none`, and fill `GSC_WINDOW`, `GSC_TOPIC_QUERIES`,
  `GSC_TOPIC_IMPRESSIONS`, `GSC_TOPIC_CLICKS`, `GSC_TARGET_NOTE`, `GSC_SUMMARY`,
  `GSC_ROW` (map keywords with impressions, then the top `gsc_only` queries) and
  `GSC_PAGE_ROW`. Without an export, set `GSC_BLOCK_DISPLAY` to `none`,
  `GSC_EMPTY_DISPLAY` to `block` and leave the rows empty.

Do not restyle the template. Do not add fonts, colours or charts.

## Honesty rules

- Never write a volume you did not get from the API. If a keyword returned no
  volume, show "no data", not 0 and not an estimate.
- AI search volume is newer and thinner than Google volume. Where it is missing,
  say missing rather than implying zero demand.
- If the total keyword count is small because the niche is small, say so. A short
  honest map beats a padded one.
- Difficulty, trend and current position come from the API only. Never estimate
  them.

## Handing off

Finish by telling the user:

> Next: run `seo-content-writer`. It reads `01-keyword-map.csv` on its own, so you
> won't need to repeat the keyword. It will ask you three things, and one of them
> only you can answer.

If Step 1b found vocabulary traps or search competitors missing from the brief,
add one line after the handoff: "Proposed update to the brief: …". The user
decides whether to apply it with `site-brief-builder`.

## Credits

Original: Galileo Studio internal SEO skills, adapted for the sau plugin.
