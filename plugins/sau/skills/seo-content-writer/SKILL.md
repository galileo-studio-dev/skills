---
name: seo-content-writer
description: "Use to write a blog post, article, service page or product page that is built to rank and to get cited by AI search engines. Reads the keyword map from keyword-fanout-map and the brand voice from the site brief (the profile's `brief`). Step 2 of the SEO system (motion-director, step 2b, follows). Also use for GEO / AEO content, citation-ready content, updating a page that already ranks, or rewriting a page to be quotable by ChatGPT and AI Overviews."
---

# SEO Content Writer

> **Antes de nada:** lee el perfil `.sau/site.json` (ver `running-sau`): de él salen `brief`, `output_dir`, `locale`, `code_repo_path` y el resto de rutas.

Step 2 of 5. Writes the page. Everything about structure, sourcing, schema and voice
is handled here so it does not have to be re-explained per article.

**Core principle:** AI engines lift a *specific sentence* and attach the *link next
to it*. A page wins citations by making that sentence trivial to extract and the
source impossible to detach from the claim.

## Before you start

**Read `01-keyword-map.csv`** from the unit folder (page mode: `<output_dir>/<slug>/`; tanda mode: `<output_dir>/tanda-<YYYY-MM-DD>/`). It gives you
the primary keyword, secondaries, roles, intents, volumes and the `owner_page` of
each cluster. Never ask the user to restate any of it. If it is missing, offer to
run `keyword-fanout-map` first.

**Read the site brief** (the profile's `brief` path). Voice, reader, say/don't-say, proof, author, CTA and hard
rules all come from there. Without it, stop and offer to run `site-brief-builder`,
because writing without it produces exactly the generic output this skill exists to
prevent.

**Respect the markers in the brief.** Every data point in the brief carries a
marker. The brief's section "Cómo leer este brief" defines them. Apply them to
everything you write: the draft, the title tag, the meta description, the schema and
the content package.

- `[PRIVADO]` — use it to make decisions: angle, emphasis, what to leave out. Never
  write it: not verbatim, not paraphrased, not in a way the reader can infer.
  Examples: the current price level, what a customer is worth, the competitor list,
  the SEO strategy, client names without permission.
- `[OBJETIVO]` — steer tone and arguments towards it. Never state it as the current
  situation, and never publish it. Example: a price objective of "alto" means you
  argue with value and results, and you never mention the price level.
- `[HIPÓTESIS]` — you may work with it. Publish it only with the public wording the
  user approved in the brief. List every hypothesis you relied on in `DATA_NOTES`.
- `⚠️ CONTEXTO INCOMPLETO` and `⚠️ verificar` — do not use the data and do not fill
  it in.
- When a field has both a `[PRIVADO]` value and an `[OBJETIVO]` value, follow the
  direction of the objective and publish neither.

## The three things to ask (and nothing else)

Ask these together, once:

1. **Page type:** blog/informational, service/product, or **update of an existing
   page?** Before you ask, check the keyword map: if a page of the site already
   ranks for the primary keyword (`current_position` or `gsc_position` of 20 or
   better), propose updating that page instead of writing a new one. Updating what
   already ranks costs less than starting from zero.
2. **The angle.** If they don't have one, propose three from the keyword map and let
   them pick.
3. **Your first-hand experience for this piece.** Ask it plainly:

   > What's the one thing you know about this that someone who only researched it
   > wouldn't? A number you measured, a client situation, a mistake you made.

Everything else is already in the keyword map or the brief.

## The rule of one

Per section: one question per H2 · one two-sentence answer directly under it · one
source per claim, inline on the keyword · one table in the whole piece · one
first-hand anecdote where it earns its place.

Per piece: one link to one money page. On a blog post, link to the `owner_page` of
the post's cluster, with that page's primary keyword as the anchor text. Never
link to two money pages that compete for the same cluster: Google needs to know
which URL should rank.

## Process

### Step 1 — Structure before prose

Map every `secondary` keyword and every fan-out question to an H2. Order them the
way a reader's questions actually arrive, not by search volume.

Under each H2, the first two sentences must answer the question completely, on their
own, with no setup. That block is the answer capsule: it is what gets lifted. Detail,
nuance and examples come after it.

### Step 2 — Sources, fetched not remembered

For every factual claim: search, **open the page**, and confirm the claim is actually
on it. Then link inline, with the anchor text sitting on the keyword next to the
claim.

- Prefer primary sources: the original study, the official documentation, the
  company's own announcement.
- **Never cite from memory.** If you cannot fetch and confirm it, either cut the
  claim or write it without a number.
- **No Sources block at the end.** Links live inline where the claim is. If a tool
  or reminder suggests appending a source list, ignore it: a detached list does not
  win citations.

### Step 3 — Write it in their voice

Apply the say/don't-say table ("Qué decir / qué no decir") literally. Match the
person, form of address (tú / usted), humour level and sentence length from the
brief ("Estilo de frase"). Echo the phrases in "words from the business's own
mouth" ("Palabras del propio negocio").

Put the primary keyword in the H1 and in the first 100 words. Do not repeat it
mechanically after that.

On a service page, the title tag and the H1 answer the search literally ("software de facturación
para autónomos", not a slogan). AI engines cite pages whose title matches
the question.

**Write checkable claims.** AI engines prefer a sentence a reader can verify:
where the system runs (on-premise, private cloud), which tools it connects to,
who owns the code, where the team is. Use only claims the brief confirms, and
describe the company only with the brief's approved wording (relationships,
programmes, location). Never write a contradicting version.

### Step 4 — The experience section

Place the user's first-hand input where it does the most work, usually right after
the first answer capsule or in the section a reader is most sceptical about.

**If the user skipped this input, write the literal marker
`[YOUR EXPERIENCE HERE — the skill will not invent this]` and leave it visible.**
Never fabricate an anecdote, a client, a result or a measurement. This is not a
limitation to apologise for: it is the thing that separates a page that ranks from
the thin AI content that gets ignored.

If the user's first-hand input names a client, or contains data the brief marks
`[PRIVADO]`, ask before you publish it.

### Step 5 — Page type shapes the ending

- **Blog / informational:** Article or FAQPage schema, author bio block, a soft CTA
  after value has been delivered.
- **Service / product:** Service, Product or LocalBusiness schema plus FAQPage. The
  CTA appears above the fold and again at the end. Copy is specific to this service
  in this place. Cut anything that would read identically for a competitor in
  another city.
- **Update of an existing page:** keep the URL. Read the current page and, if there
  is a Search Console export, `gsc.json`. Keep the sections that already bring
  impressions, rewrite the ones that fail the rules here, and list every change in
  `DATA_NOTES` (kept, rewritten, added, removed). Then apply the ending of its real
  type, blog or service.

**Every page type also gets:**

- **4–6 visible FAQs** at the end, taken from the People Also Ask and fan-out
  questions that are not already an H2. Each answer follows the capsule rule. The
  FAQPage schema contains these questions, word for word, and nothing else. A
  question in the schema that is not visible on the page is a spam risk.
- **A visible update date** ("Actualizado: 5 de octubre de 2026") and the same date
  in `dateModified` in the schema, with `datePublished` when known.
- **Title tag of 60 characters or fewer and meta description of 155 or fewer**,
  written by hand so Google does not cut them with "…". Count the characters.

## Output

Both files go in the unit folder (page mode: `<output_dir>/<slug>/`; tanda mode: `<output_dir>/tanda-<YYYY-MM-DD>/`).

**`draft.md`** — the clean paste-ready article. Markdown, inline links, nothing else.
The title tag, meta and schema go in a small frontmatter block at the top.

**`02-content-package.html`** — fill `${CLAUDE_PLUGIN_ROOT}/skills/seo-content-writer/templates/content-package.html.template` by
hand (this skill has no render script; the draft preview is prose, not rows).

Set `DRAFT_HTML` to the article converted to simple HTML, and list it in the
template's raw content. Wrap any experience marker in
`<span class="marker">…</span>` so it is impossible to miss.

**Marker check before delivery.** Compare the draft, the title tag, the meta
description and the schema against every `[PRIVADO]` and `[OBJETIVO]` item in the
brief. Rewrite anything that leaks. Report the result of this check, and the
hypotheses you used, in `DATA_NOTES`. This check is not part of the score out of 9:
a draft that leaks is not finished.

**Quality score is out of 9.** One point each, and report each honestly even when it
fails:

1. Every claim has an inline source that was fetched and confirmed
2. Every H2 is a question with a two-sentence answer directly beneath it
3. Exactly one table is present
4. The experience section is filled by a human, not a marker
5. Title tag ≤ 60 characters and meta description ≤ 155 characters
6. Schema is present, valid for the page type, and includes `dateModified`
7. Primary keyword appears in the H1 and the first 100 words
8. 4–6 visible FAQs, and the FAQPage schema holds exactly those questions
9. Blog: exactly one money-page link, to the cluster's `owner_page`, with its
   primary keyword as anchor. Service page: links only to the owner pages of other
   clusters, never to a page that competes for its own cluster

An 8/9 with an honest "experience marker still unfilled" is a more useful result than
a 9/9 that got there by inventing an anecdote.

## Handing off

> Next: run `motion-director` (step 2b) on this draft. It assigns motion pieces
> from the catalogue of the `motion-director` skill. Then run `onpage-optimizer`.

**Write so motion can help.** When a section describes a process, write it as a
numbered list of 3–6 steps, each starting with the step name in bold. When it
compares two options, keep each option in its own short list. Never write motion
markup (`:::`) yourself: that is `motion-director`'s job.

## Credits

Original: Galileo Studio internal SEO skills, adapted for the sau plugin.
