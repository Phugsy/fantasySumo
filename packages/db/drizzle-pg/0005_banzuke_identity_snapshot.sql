ALTER TABLE "banzuke_entries"
ADD COLUMN IF NOT EXISTS "shikona" text;

ALTER TABLE "banzuke_entries"
ADD COLUMN IF NOT EXISTS "heya" text;

UPDATE "banzuke_entries"
SET
  "shikona" = "rikishi"."shikona",
  "heya" = "rikishi"."heya"
FROM "rikishi"
WHERE
  "banzuke_entries"."rikishi_id" = "rikishi"."id"
  AND "banzuke_entries"."shikona" IS NULL;
