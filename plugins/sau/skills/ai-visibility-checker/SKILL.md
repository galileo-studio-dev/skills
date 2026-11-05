---
name: ai-visibility-checker
description: Use to check whether a website is being cited or mentioned in AI search results across ChatGPT, Gemini, Google AI Overviews and Perplexity, compare it against competitors, and produce the gap list of queries it should own but doesn't. Step 5 of the 5-skill SEO system. Use for AI visibility, GEO, AI search tracking, LLM citations, "am I showing up in ChatGPT", or AI Overview monitoring.
---

# AI Visibility Checker

> **Antes de nada:** lee el perfil `.sau/site.json` (ver `running-sau`): de él salen `brief`, `output_dir`, `locale`, `code_repo_path` y el resto de rutas. Los scripts se invocan como `${CLAUDE_PLUGIN_ROOT}/skills/ai-visibility-checker/scripts/…` con el intérprete `py` o `python3` (el que exista).

Step 5 of 5, and the one that closes the loop. Ranking in Google and being cited by
an AI engine are different outcomes with different causes. This measures the second
one, then hands the gaps back to Step 1.

## Before you start

**The DataForSEO connector is required**, specifically its AI Optimization tools. If
you cannot find any, the connector may have been added with a restricted module set.
Say so plainly rather than substituting a workaround:

> I can't see the DataForSEO AI Optimization tools, so I can't get real citation
> data. Guessing at this would be worse than not answering. Check the connector has
> the AI_OPTIMIZATION module enabled and re-run.

**Read the site brief** (the profile's `brief` path) for the brand name, domain, competitors, country and
language. Without the brand name you cannot tell a mention of this business from a
mention of a similarly-named one.

## Input

- The domain and brand name (from the brief)
- The queries to check: the **query panel** (below).
- Competitors: the business competitors from the brief **plus** the search
  competitors: the domains that appear in the SERP check of `01-keyword-map.html`
  and in the AI answers you pull. In a local market the brief's list is often
  wrong: global brands may not appear at all, and local players may win every
  answer. If a brief competitor never appears, say so and propose the domains that
  do. Never edit the brief yourself.

### The query panel

AI answers vary between runs, so one check means little. A fixed panel measured
every month shows the trend.

- Keep the panel in `<output_dir>/05-query-panel.csv` (site-wide: at the root of the
  profile's `output_dir`, not inside a unit folder) with the columns
  `query,type,cluster,added_on`. `type` is `commercial` (a buyer asking who to
  hire: "¿Qué empresas en <país> ofrecen <servicio> para <sector>?") or `informational` (a fan-out question from the keyword map).
- First run: build the panel with 10 queries, at least 3 of them commercial, from
  the fan-out questions in `01-keyword-map.csv` and the services in the brief.
  Show it to the user before you run it.
- Later runs: reuse the panel unchanged. Add up to 15 extra queries for the page
  of this run if needed, and keep them out of the panel. Change the panel only
  when the user asks, and log the change in `added_on` and `DATA_NOTES`.

## Process

### Step 1 — Pull the citation data

Endpoints, by API path:

- `ai_optimization/llm_mentions` — the main one. Brand, domain and keyword mentions
  across LLM responses, with the sources cited and the snippets.
- `ai_optimization/chat_gpt/llm_responses` and the Gemini, Claude and Perplexity
  equivalents — live spot checks on specific queries.
- `ai_optimization/ai_keyword_data/keyword_data` — AI search volume, to weight which
  gaps are worth chasing.
- The LLM mentions aggregated metrics and top domains — mentions of this domain and
  of each competitor in Google AI Overviews and in ChatGPT, across the whole
  database, not only the panel. This gives the share-of-voice baseline.
- `business_data/business_listings/search` — the Google Business Profile of the
  business (name, address, phone, categories, rating, number of reviews). AI
  engines show Maps profiles in commercial answers.

For the commercial queries, use ChatGPT with web search on. Those answers show
which providers it recommends and which sources it reads.

Match tools by description rather than assuming exact names.

### Step 2 — Classify every result

For each query and engine, record:

- Is **this domain** cited with a link? That is a citation.
- Is the **brand named** without a link? That is a mention, and it counts for less.
  Track it separately; do not merge the two numbers.
- Which domains **are** cited?
- Which exact sentence was attributed to each source?
- Which **type of source** is each citation: `own page` (a provider's own service
  page), `guide` (a "best tools" or comparison article), `directory` (a sector
  directory, a city ranking), `maps` (a Google Business Profile), `press`, `product`
  (a software product page), `public body` or `other`. The type decides the fix.

Be strict about identity. A different business with a similar name is not you, and a
citation of a directory listing that happens to include the business is not a
citation of the site.

### Step 3 — Compare

Build the competitor table: citations, queries won, and share of total citations
across the checked set. Include this domain in the same table so the comparison is
direct.

### Step 4 — The gap list

A gap is a query where a competitor is cited and this domain is not.

For each gap, record which page of theirs gets cited and **what that page has that
this site doesn't.** Be specific: a stat with a primary source, a comparison table,
first-hand testing, a clearer direct answer near the top. That specific difference is
the actionable part.

Classify each gap by the fix it needs:

- `content` — the cited sources win with pages: a title that answers the question
  literally, checkable claims (where it runs, what it connects to, who owns the
  code), a comparison table, a direct answer near the top. The fix is a page on
  this site. These gaps go back to `keyword-fanout-map`.
- `authority` — the cited sources are third parties: directories, Maps profiles
  with reviews, press, other people's guides. No page on this site closes the gap.
  The fix is off-site: get listed, get reviewed, get mentioned. These go to
  `AUTHORITY_ROW`.

Rate each gap `pass` (winnable now), `warn` (needs real work), `fail` (not realistic
soon), and rank the list by winnability against AI search volume.

### Step 4b — Off-site actions

Turn every `authority` gap into one concrete action in `AUTHORITY_ROW`: the source
(the directory, the publication, the guide), the queries where it is cited, the
action (apply for a listing, propose an article, send the product to the guide's
author) and the effort (`low`, `medium`, `high`).

Add the Google Business Profile check here. Compare name, address and phone with
the brief's canonical NAP. Every mismatch is an action. Report the rating and the
number of reviews as the API returns them. Never estimate them.

Never propose buying links, link networks or fake reviews.

### Step 5 — Protect what you have

List the queries where this domain is already cited, with the page and the sentence
that got lifted. These are worth defending and worth learning from: whatever those
pages do is what the rest of the site should copy.

## Output

**`05-history.csv`** at the root of the profile's `output_dir` — append one row per panel query
and engine for this run, never rewrite old rows:
`run_date,query,engine,cited,mentioned,cited_domains,source_types`. This file is the
monthly record. Compare this run with the previous one in `PREV_RUN_NOTE` (for
example "0 → 1 citations; competitor.example entered 2 answers"). On the first run, write
"first run, no previous data".

**`05-ai-visibility.html`** (in the unit folder (page mode: `<output_dir>/<slug>/`; tanda mode: `<output_dir>/tanda-<YYYY-MM-DD>/`)) — fill `${CLAUDE_PLUGIN_ROOT}/skills/ai-visibility-checker/templates/ai-visibility.html.template`.

Build a `data.json` and render it:

```
<py|python3> ${CLAUDE_PLUGIN_ROOT}/skills/ai-visibility-checker/scripts/render.py ${CLAUDE_PLUGIN_ROOT}/skills/ai-visibility-checker/templates/ai-visibility.html.template data.json 05-ai-visibility.html
```

Row blocks: `ENGINE_ROW`, `RIVAL_ROW`, `GAP_ROW`, `WIN_ROW`, `NEXT_ROW`,
`AUTHORITY_ROW`.

Notes:
- In `RIVAL_ROW`, set `ROW_IS_YOU` to ` ← you` on this domain's row and empty on the
  others.
- If cited nowhere, pass an empty `WIN_ROW` list and set `WIN_EMPTY_DISPLAY` to
  `block`, otherwise `none`.
- `CITED_CLASS` should be `is-fail` when citations are zero, so the number reads as
  the finding it is.
- `NEXT_ROW` is the top three to five `content` gaps, phrased as the next seed
  keywords.
- `GAP_ROW` also takes `ROW_SOURCE_TYPE` and `ROW_GAP_TYPE` (`content` or
  `authority`).
- `RIVAL_ROW` also takes `ROW_KIND` (`business`, `search` or `both`) and
  `ROW_AIO_MENTIONS` (mentions in the aggregated AI Overviews and ChatGPT data).
- `AUTHORITY_ROW`: `ROW_AUTH_SOURCE`, `ROW_AUTH_QUERIES`, `ROW_AUTH_ACTION`,
  `ROW_AUTH_EFFORT`. If there are none, set `AUTHORITY_EMPTY_DISPLAY` to `block`,
  otherwise `none`.
- `PREV_RUN_NOTE` is the comparison with the previous run from `05-history.csv`.

## Honesty rules

This skill is the easiest of the five to fake and the most damaging to fake.

- **Zero citations is a real, useful answer.** Report it plainly. Do not soften it
  into "limited visibility" and do not pad the report with mentions to make the
  number look better.
- Never list a citation you did not receive from the API.
- LLM responses vary between runs. Say when the data was pulled and that a re-run
  can differ. Do not present a single check as a stable ranking.
- If coverage was thin for an engine, say which engine and why, rather than
  averaging it away.

## Closing the loop

End with the handoff that makes these five a system rather than a pipeline:

> Take the top content gaps and feed them back into `keyword-fanout-map` as your
> next seed keywords. That's the loop: research, write, optimise, link, check, then
> research the gap you just found. Work the off-site actions in parallel: no page
> closes those gaps. Run the same panel again next month.

## Credits

Original: Galileo Studio internal SEO skills, adapted for the sau plugin.
