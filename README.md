# Contexio

A second brain for recall. You save links and notes as you come across them, and
months later you find them again from a vague memory of what they were about.

Contexio surfaces the things you saved and explains why each one matched. It does
not answer questions from their contents — it points you back at your own material.

## Architecture

```
  React (Vite)
       │  REST + SSE
       ▼
  Express API ──────────────► MongoDB Atlas
       │                       ├─ contents   (one row per saved item)
       │  enqueue              ├─ chunks     (embedded text + vectors)
       ▼                       └─ users
  Redis (BullMQ)
       │  dequeue
       ▼
  Worker ──► scrape page ──► Gemini: summarise + tag ──► chunk ──► embed
```

Two Node processes share one codebase:

- **`index.ts`** — the API. Auth, CRUD, both search paths.
- **`worker.ts`** — background processing. Fetches the page, asks Gemini for a
  summary and topics, splits the text into chunks, embeds each one, writes them
  back.

Saving returns immediately; the worker catches up. An item is searchable by
keyword the moment it is saved, and by AI once the worker finishes with it.

With `RUN_WORKER_IN_API=true` the worker runs inside the API process, which is
what free single-process hosting allows. Set it to `false` and run
`npm run start:worker` to scale the two separately.

## How search works

There are two paths, and they are for different things.

**Plain search** is keyword search: free, unlimited, instant. It runs an Atlas
text index over the item's **title, description and topics** with a clause ladder
— a title phrase beats a title word beats your own note beats an AI-generated
topic. Nothing is score-filtered; if Atlas matched it, you see it. When literal
matching finds almost nothing, a fuzzy pass runs and comes back in a separate
`suggestions` list, labelled as guesses rather than mixed into the results.

**AI search** is for when you cannot remember the words. It embeds your
description and runs a hybrid `$rankFusion` query over chunks — 70% vector, 30%
keyword, because vectors are weak on proper nouns and people search their saved
items by name constantly. It returns one page: the closest few items, each with a
line on why it matched, plus an exact count of how many others cleared the
relevance floor. That full list arrives with the answer, so expanding it costs no
second model call. It is quota-limited per user per day.

**Article bodies are reachable only through AI search.** The text index covers
title, description and topics, not scraped page content — indexing full bodies on
M0 is not affordable, and a keyword hit deep inside a 30,000-character article is
usually noise. Searching for a phrase you remember from the middle of an article
will find nothing by keyword; ask for it in AI search instead.

## Setup

### Prerequisites

- Node 20 or newer
- A MongoDB Atlas cluster on 8.0 or newer — `$rankFusion` does not exist before 8.0
- A Redis instance
- A Gemini API key from AI Studio
- A Google Cloud API key with the YouTube Data API enabled

### Atlas search indexes

Three indexes, defined in `backend/atlas-indexes/`:

| Index                | Collection | Purpose                                      |
| -------------------- | ---------- | -------------------------------------------- |
| `content_text_index` | `contents` | Plain search over title, description, topics |
| `chunk_text_index`   | `chunks`   | The keyword half of AI search                |
| `chunk_vector_index` | `chunks`   | The vector half of AI search                 |

Create all three in the Atlas UI by pasting in the matching JSON file. Several
details cannot be read back from the UI afterwards — whether a vector filter path
was saved, whether a multi-analyzer or the autocomplete mapping took — so verify
them with `npm run preflight`, which reads the live definitions and repairs any
that have drifted from the files.

### Environment

Copy `backend/.env.example` to `backend/.env` and `frontend/.env.example` to
`frontend/.env`, then fill them in. Every variable is validated at startup and the
process exits if one is missing or malformed.

| Variable                                                         | What it does                                                              |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `PORT`                                                           | API port                                                                  |
| `DATABASE_URL`                                                   | Atlas connection string, including the database name                      |
| `JWT_SECRET`                                                     | Signs session tokens. Generate a real one; do not ship the placeholder    |
| `ALLOWED_ORIGINS`                                                | Comma-separated CORS allow-list. Empty rejects every cross-origin request |
| `REDIS_URL`                                                      | BullMQ connection                                                         |
| `GEMINI_API_KEY`                                                 | AI Studio key                                                             |
| `GEMINI_MODEL_PRIMARY` / `GEMINI_MODEL_FALLBACK`                 | The fallback is tried only for errors a different model could survive     |
| `GEMINI_EMBEDDING_MODEL`                                         | Embedding model                                                           |
| `GEMINI_EMBEDDING_DIMENSIONS`                                    | Must match `numDimensions` in `chunk_vector_index`                        |
| `GEMINI_TIMEOUT_MS`                                              | Per-call timeout                                                          |
| `WORKER_CONCURRENCY`                                             | Jobs processed in parallel                                                |
| `WORKER_MAX_ATTEMPTS` / `WORKER_BACKOFF_MS`                      | Retry policy for a failed job                                             |
| `WORKER_RATE_LIMIT_MAX` / `WORKER_RATE_LIMIT_DURATION_MS`        | Job throughput ceiling, sized to the Gemini free tier                     |
| `RUN_WORKER_IN_API`                                              | Run the worker inside the API process                                     |
| `AI_CHAT_DAILY_LIMIT`                                            | AI searches per user per day                                              |
| `MAX_ITEMS_PER_USER`                                             | Hard cap on saved items                                                   |
| `CONTENT_WRITE_RATE_MAX`                                         | Content writes per user per hour                                          |
| `PLAIN_SEARCH_RATE_MAX`                                          | Plain searches per user per hour                                          |
| `YOUTUBE_API_KEY`                                                | Fetches video title, channel and description                              |
| `SCRAPER_TIMEOUT_MS` / `SCRAPER_MAX_BYTES` / `SCRAPER_MAX_CHARS` | Bounds on fetching and storing a page                                     |
| `CHUNK_SIZE` / `CHUNK_OVERLAP`                                   | Chunk length, and the overlap carried between them                        |
| `MAX_CHUNKS_PER_ITEM`                                            | Ceiling per item, including chunk 0                                       |
| `MAX_QUERY_CHARS`                                                | Queries are truncated to this                                             |
| `BROWSE_SEARCH_LIMIT`                                            | Plain search result ceiling, and the only cap — there is no score floor   |
| `FUZZY_FALLBACK_MIN`                                             | Below this many literal matches, the fuzzy pass also runs                 |
| `VECTOR_NUM_CANDIDATES`                                          | ANN scan depth for the display query                                      |
| `VECTOR_SEARCH_LIMIT`                                            | Chunks returned per pipeline in the display query                         |
| `RAG_TOP_K`                                                      | Items the model explains, with a reason each                              |
| `RELEVANCE_MIN_SCORE`                                            | Floor an item must clear to be returned or counted                        |
| `RELEVANCE_COUNT_LIMIT`                                          | Scan ceiling for the exhaustive count query                               |
| `ALL_MATCHES_LIMIT`                                              | Ceiling on the inline match list                                          |

`RELEVANCE_MIN_SCORE` is `0.80`. Atlas reports cosine similarity as
`(1 + cos) / 2`, and the embedding model compresses a personal library into a
narrow band, so the number is not intuitive: across a mixed 56-item corpus,
relevant items scored 0.81–0.88 while a deliberately unrelated query topped out at
0.785. Every AI search logs its top score, so the value can be revisited against
real libraries rather than one sample.

### Running

```bash
cd backend  && npm install && npm run preflight && npm run dev
cd frontend && npm install && npm run dev
```

`preflight` checks the Atlas version, Redis, and all three index definitions
before anything else runs. Start there when something behaves strangely.

## Scripts

**backend**

| Script                               | Purpose                                                                   |
| ------------------------------------ | ------------------------------------------------------------------------- |
| `npm run dev`                        | API with reload; includes the worker unless `RUN_WORKER_IN_API=false`     |
| `npm run dev:worker`                 | Worker alone, with reload                                                 |
| `npm run build`                      | Type-check and compile to `dist/`                                         |
| `npm start` / `npm run start:worker` | Run the compiled API or worker                                            |
| `npm run preflight`                  | Verify cluster, Redis and index definitions; repair drifted indexes       |
| `npm run reprocess`                  | Re-queue every item. Use after a prompt or chunking change                |
| `npm run retry-failed`               | Re-queue every item the worker gave up on                                 |
| `npm run reset-db`                   | Empty the database and queue. Needs `-- --confirm`; indexes are untouched |

**frontend**

| Script          | Purpose                         |
| --------------- | ------------------------------- |
| `npm run dev`   | Vite dev server                 |
| `npm run build` | Type-check and build to `dist/` |
| `npm run lint`  | ESLint                          |

## Development

Backend is Node with Express 5 and TypeScript in ESM, Mongoose over Atlas, BullMQ
over Redis. Frontend is React 19 with Vite, Tailwind v4, TanStack Query and React
Router.

```
backend/src/{config,routes,controllers,middlewares,services,models,prompts,lib,scripts,queues}
frontend/src/{pages,components,hooks,store,lib,router,types}
```

Conventions worth knowing before adding code:

- ESM: every relative import ends in `.js`, including from `.ts` files.
- Controllers validate with a Zod schema, call a service, and respond. They stay
  thin; services never touch `req` or `res`.
- Every external call has a timeout and a defined failure path. Extraction is
  best-effort and never fails a save.
- Every query against `contents` or `chunks` is scoped by `userId`.
- The `embedding` field is never returned to the client.
- Every tunable lives in `.env` and is validated in `config/env.ts`.
- The frontend makes all HTTP calls through `lib/api.ts`, with response shapes
  typed in `types/index.ts`.

`npm run build` must pass in both apps, and `npm run lint` in the frontend.

## Known constraints

**Atlas M0 allows three search indexes.** All three are in use. Anything new has
to replace one of them.

**The Gemini free tier is shared across every user of a deployment.** One save
costs a generate call and an embed call, so the worker is rate-limited and each
user is capped at `MAX_ITEMS_PER_USER` items. Without the cap, one bulk import
would spend the day's quota for everybody.

**LinkedIn and X block server-side reads** from datacenter address ranges as
policy, and plenty of ordinary sites return 403 to anything that is not a browser.
Those items still save: extraction degrades to whatever the URL and your own note
provide, the item is marked partial, and the card says the page could not be read.
Pasting the text into the note field is what makes such an item findable.

**AI search is one page.** There is no pagination and no continuation call —
browsing is plain search's job, and it does that for free.
