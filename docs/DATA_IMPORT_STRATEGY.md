# Data Import Strategy

## Status

Accepted for the MVP import path.

Last checked: 2026-06-01.

## Recommendation

Use automated source-backed import as the MVP data path for banzuke and bout results.

Manual entry was the pain point this app is intended to remove. Even if the available source endpoints are undocumented or third-party, maintaining source adapters is a better trade-off than asking an admin to hand-enter daily tournament data. A broken adapter should be fixed when source URLs or payloads change; those changes should be infrequent and easier to repair than manually running the game.

Recommended MVP approach:

- import banzuke from the Japan Sumo Association `indexAjax` endpoint first because it is official and currently machine-readable;
- import daily results from Sumo API first because it provides documented torikumi/result-style endpoints;
- keep an adapter boundary so JSA results, Sumo API, and future sources can produce the same internal import model;
- support a manual trigger for an admin to run or rerun imports;
- design the import service so it can later run from a scheduled job, e.g. once per day during a basho;
- use manual JSON fixtures only as a fallback/debug/test path, not as the expected product workflow.

Keep the import boundary source-agnostic:

- fetch source payloads in small source-specific adapters;
- map source payloads into validated Fantasy Sumo import commands;
- apply validated imports into the existing `Basho`, `Rikishi`, `BanzukeEntry`, and `BoutResult` model;
- keep source-specific adapters separate from scoring and database writes;
- support dry-run validation before writing to the database;
- allow fallback between sources where practical.

## Source Investigation

### Japan Sumo Association banzuke endpoint

Legacy code referenced:

```text
http://sumo.or.jp/EnHonbashoBanzuke/index_ajax/1/1/
```

That exact lowercase `index_ajax` URL is not suitable to reuse. On 2026-05-30 it redirected to `/Mischief/`.

The current mixed-case endpoint works:

```text
https://www.sumo.or.jp/EnHonbashoBanzuke/indexAjax/1/1/
```

It returns JSON containing a `BanzukeTable`, `BashoInfo`, `basho_name`, `basho_id`, division metadata, and rows with fields such as `rikishi_id`, `shikona`, `banzuke_name`, `banzuke_id`, `rank`, `ew`, `heya_name`, and `pref_name`.

Pros:

- official source;
- currently returns machine-readable banzuke JSON;
- contains stable-looking identifiers and enough fields for Fantasy Sumo's banzuke model.

Cons:

- not documented as a public API;
- endpoint casing changed from the old prototype reference;
- URL parameters are not self-describing;
- result availability and backward compatibility are not guaranteed.

Use this as the first MVP banzuke adapter. Because it is not documented as a public API, isolate it behind an adapter and keep reduced fixtures that make payload changes easy to spot in tests.

### Japan Sumo Association results pages

The official site exposes results pages such as:

```text
https://www.sumo.or.jp/EnHonbashoMain/torikumi/1/15/
```

and Ajax-shaped URLs such as:

```text
https://www.sumo.or.jp/EnHonbashoMain/torikumiAjax/1/15/
```

On 2026-05-30, the visible English results page loaded but did not provide a clean reusable JSON result payload in the same way as the banzuke endpoint. The Ajax endpoint shape may still be useful to investigate later, but should be treated as website internals rather than an import contract.

Pros:

- official source;
- the public site and official app publish current basho results.

Cons:

- no documented public API contract found;
- scraping HTML would be brittle;
- the official app result timing is useful for fans, but not a direct public data integration;
- endpoint changes would break imports without warning.

Do not build the first MVP around scraping official results pages unless Sumo API proves unsuitable. If a clean JSA results Ajax payload is confirmed later, add it as a higher-priority results adapter because it is official.

### Sumo API

[sumo-api.com](https://sumo-api.com/) is a third-party sumo data API. Its API guide documents endpoints for rikishi, basho, banzuke, torikumi, kimarite, ranks, and shikona, including:

```text
GET /api/basho/:bashoId
GET /api/basho/:bashoId/banzuke/:division
GET /api/basho/:bashoId/torikumi/:division/:day
```

The site describes itself as free to access, asks users to use it responsibly, and notes that it costs money to run and maintain.

Pros:

- directly matches the data Fantasy Sumo needs;
- documented endpoints for banzuke and daily torikumi;
- likely much easier than scraping;
- used by other fantasy sumo and sumo-stat projects.

Cons:

- third-party hobby/service dependency;
- not official;
- availability, schema, rate limits, and long-term maintenance are outside this repo's control;
- should not be required for local tests or deterministic seed data.

Use this as the first MVP results adapter, and optionally as a backup banzuke adapter. It should map into the same internal import commands as the JSA banzuke adapter.

### SumoDB

[Sumo Reference / SumoDB](https://sumodb.sumogames.de/) is a long-running historical sumo database with banzuke, torikumi, kimarite, rikishi, and query pages.

Pros:

- broad historical coverage;
- useful for checking historical banzuke and bout data;
- public pages are easy for humans to inspect.

Cons:

- primarily an HTML website, not a documented JSON API;
- scraping would add parser maintenance;
- page shape is optimised for human browsing and historical research, not daily MVP operation.

Use SumoDB as a manual verification/reference source, not as the first automated importer.

### Paid sports data APIs

Commercial sports-data providers advertise sumo coverage, but they are not appropriate for the first MVP.

Pros:

- potentially stronger uptime and support contracts;
- may provide structured pre-match and post-match data.

Cons:

- likely paid and overbuilt for a hobby MVP;
- introduces vendor setup before the local game loop needs it;
- conflicts with the project's low-maintenance local-first direction.

Do not use a paid provider for MVP import work.

## Internal Import Shape

Source adapters should emit small, explicit internal import commands. These commands can also be represented as JSON fixtures for tests, dry runs, and emergency debugging, but they are not the primary user workflow.

Prefer JSON for fixtures because it preserves types and nested data more clearly than CSV. CSV can be added later only if it is useful for debugging or emergency fallback.

### Banzuke import

Minimum required fields:

```json
{
  "basho": {
    "id": "2026-05",
    "name": "2026 May Basho",
    "startDate": "2026-05-10",
    "endDate": "2026-05-24",
    "status": "active"
  },
  "rikishi": [
    {
      "id": "onosato",
      "shikona": "Onosato",
      "heya": "Nishonoseki"
    }
  ],
  "banzuke": [
    {
      "bashoId": "2026-05",
      "rikishiId": "onosato",
      "rank": "Yokozuna",
      "rankOrder": 2
    }
  ]
}
```

Recommended optional fields for future adapters:

- `source`;
- `sourceBashoId`;
- `sourceRikishiId`;
- `division`;
- `side`: `east` or `west`;
- `rankGroup`;
- `rankNumber`;
- `countryOrPrefecture`.

Validation rules:

- `basho.id` must match the import target;
- each banzuke row must reference an imported or existing rikishi;
- `rankOrder` must be unique within the imported basho;
- duplicate `(bashoId, rikishiId)` rows must be rejected;
- unknown extra fields should be ignored or captured as source metadata, not written into core domain objects.

### Bout result import

Minimum required fields:

```json
{
  "bashoId": "2026-05",
  "results": [
    {
      "id": "2026-05-01-onosato-kotozakura",
      "day": 1,
      "winnerRikishiId": "onosato",
      "loserRikishiId": "kotozakura",
      "kimarite": "oshidashi",
      "winnerAbsent": false,
      "loserAbsent": false
    }
  ]
}
```

Recommended optional fields:

- `division`;
- `boutOrder`;
- `eastRikishiId`;
- `westRikishiId`;
- `source`;
- `sourceBoutId`;
- `fusen`: explicit flag for default/forfeit wins;
- `playoff`: explicit flag for playoff bouts.

Validation rules:

- `day` must be 1-15 for a standard basho;
- winner and loser must be different rikishi;
- winner and loser should exist in the local rikishi table;
- winner and loser should normally be on the target basho's banzuke unless the import explicitly allows cross-division bouts;
- importing the same result twice should be idempotent or fail with a clear duplicate-result error;
- absent/default wins should preserve enough data for scoring to keep absences at 0 points unless rules change later.

## Failure Handling

Import should be explicit and reversible enough for local operation:

- validate the whole file before writing any rows;
- report line/item-level errors with the source row id or array index;
- support dry-run mode that returns created/updated/skipped counts;
- write imports in a transaction;
- fail without partial writes when required data is invalid;
- make duplicate handling deliberate: either reject duplicates or upsert by stable ids, but do not silently create conflicting rows;
- log source name, imported file name, and timestamp once an import log table exists.

For the first local MVP, a failed import can return a structured API error and leave the database unchanged. A full audit/revert UI can wait.

## Proposed Implementation Path

1. Add internal import command types and validation functions for banzuke and results.
2. Add a JSA banzuke source adapter using the currently working `indexAjax` endpoint.
3. Add a Sumo API results source adapter using documented basho/torikumi endpoints.
4. Add repository/service functions that apply validated imports transactionally.
5. Add local-only admin endpoints or scripts to manually trigger source imports and dry runs.
6. Add small reduced source fixtures for adapter tests and internal JSON fixtures for import-service tests.
7. Add a protected scheduled production trigger that locks the eligible basho
   on the evening before day 0 without fetching results, then derives the
   current day in Japan time and reuses the result import service on days 1-15.
   Allow day-0 lock catch-up, then import every day absent from stored bout
   results through the calculated day so banzuke calendar progress cannot hide
   missed result imports. Keep locked or active bashos eligible for final-day
   recovery after the end date. Move upcoming or locked bashos to active with
   day 1 and complete the basho with day 15. Keep deterministic demo bashos
   outside this path. Preserve lifecycle progress inside transactional banzuke
   writes so a concurrent refresh cannot regress a scheduled lock.
8. Add fallback source support:
   - Sumo API banzuke as backup if JSA banzuke fails;
   - JSA results adapter if a stable machine-readable result endpoint is confirmed;
   - no SumoDB scraper unless API paths prove inadequate.

## Follow-Up Tickets

- GitHub issue #26: add redundant/fallback source adapters after the first automated import path exists.
