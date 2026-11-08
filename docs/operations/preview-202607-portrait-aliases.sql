-- Manual repair for the persistent Preview branch br-cold-union-abi8tnee only.
-- Reviewed source: https://sumo-api.com/api/basho/202607/banzuke/Makuuchi
-- Canonical IDs and exact ranks come from the existing July roster, not slug guesses.
-- Preview first; switch only settings.apply to true after blockers is empty.
-- Additive and idempotent. Never changes picks, results, local IDs or existing aliases.
WITH settings(apply) AS (VALUES (false)),
expected(rikishi_id, shikona, rank, rank_order, provider_id) AS (VALUES
    ('hoshoryu', 'Hoshoryu', 'Yokozuna', '1', '19'),
    ('onosato', 'Onosato', 'Yokozuna', '2', '8850'),
    ('kirishima', 'Kirishima', 'Ozeki', '3', '7'),
    ('kotozakura', 'Kotozakura', 'Ozeki', '4', '20'),
    ('atamifuji', 'Atamifuji', 'Sekiwake', '5', '74'),
    ('kotoshoho', 'Kotoshoho', 'Sekiwake', '6', '8'),
    ('wakatakakage', 'Wakatakakage', 'Sekiwake', '7', '12'),
    ('aonishiki', 'Aonishiki', 'Sekiwake', '8', '8854'),
    ('yoshinofuji', 'Yoshinofuji', 'Komusubi', '9', '8857'),
    ('oho', 'Oho', 'Komusubi', '10', '41'),
    ('fujinokawa', 'Fujinokawa', 'Maegashira #1', '11', '615'),
    ('takanosho', 'Takanosho', 'Maegashira #1', '12', '37'),
    ('gonoyama', 'Gonoyama', 'Maegashira #2', '13', '56'),
    ('churanoumi', 'Churanoumi', 'Maegashira #2', '14', '71'),
    ('hiradoumi', 'Hiradoumi', 'Maegashira #3', '15', '24'),
    ('hakunofuji', 'Hakunofuji', 'Maegashira #3', '16', '3'),
    ('daieisho', 'Daieisho', 'Maegashira #4', '17', '9'),
    ('ichiyamamoto', 'Ichiyamamoto', 'Maegashira #4', '18', '11'),
    ('ura', 'Ura', 'Maegashira #5', '19', '28'),
    ('oshoma', 'Oshoma', 'Maegashira #5', '20', '61'),
    ('shodai', 'Shodai', 'Maegashira #6', '21', '33'),
    ('fujiseiun', 'Fujiseiun', 'Maegashira #6', '22', '82'),
    ('kotoeiho', 'Kotoeiho', 'Maegashira #7', '23', '112'),
    ('takayasu', 'Takayasu', 'Maegashira #7', '24', '44'),
    ('wakamotoharu', 'Wakamotoharu', 'Maegashira #8', '25', '13'),
    ('roga', 'Roga', 'Maegashira #8', '26', '55'),
    ('fujiryoga', 'Fujiryoga', 'Maegashira #9', '27', '9051'),
    ('tobizaru', 'Tobizaru', 'Maegashira #9', '28', '21'),
    ('asanoyama', 'Asanoyama', 'Maegashira #10', '29', '2'),
    ('chiyoshoma', 'Chiyoshoma', 'Maegashira #10', '30', '39'),
    ('wakanosho', 'Wakanosho', 'Maegashira #11', '31', '195'),
    ('mitakeumi', 'Mitakeumi', 'Maegashira #11', '32', '26'),
    ('asahakuryu', 'Asahakuryu', 'Maegashira #12', '33', '607'),
    ('abi', 'Abi', 'Maegashira #12', '34', '22'),
    ('nishikifuji', 'Nishikifuji', 'Maegashira #13', '35', '40'),
    ('takerufuji', 'Takerufuji', 'Maegashira #13', '36', '5'),
    ('kinbozan', 'Kinbozan', 'Maegashira #14', '37', '50'),
    ('shishi', 'Shishi', 'Maegashira #14', '38', '86'),
    ('onokatsu', 'Onokatsu', 'Maegashira #15', '39', '8853'),
    ('kazuma', 'Kazuma', 'Maegashira #15', '40', '8865'),
    ('daiseizan', 'Daiseizan', 'Maegashira #16', '41', '378'),
    ('asakoryu', 'Asakoryu', 'Maegashira #16', '42', '164')
),
blockers AS (
  SELECT 'Expected the isolated July-only Preview fixture' AS detail
  WHERE (SELECT count(*) FROM basho) <> 1
     OR NOT EXISTS (SELECT 1 FROM basho WHERE id='2026-07' AND NOT is_demo
        AND status='complete' AND start_date='2026-07-12' AND end_date='2026-07-26')
     OR (SELECT count(*) FROM banzuke_entries WHERE basho_id='2026-07') <> 42
  UNION ALL
  SELECT e.rikishi_id || ': historical roster differs'
  FROM expected e
  WHERE NOT EXISTS (
    SELECT 1 FROM banzuke_entries b JOIN rikishi r ON r.id=b.rikishi_id
    WHERE b.basho_id='2026-07' AND b.rikishi_id=e.rikishi_id
      AND coalesce(b.shikona,r.shikona)=e.shikona AND b.rank=e.rank
      AND b.rank_order=e.rank_order::integer
  )
  UNION ALL
  SELECT e.rikishi_id || ': conflicting provider identity'
  FROM expected e JOIN rikishi_source_identities a ON a.source='sumo-api' AND (
    (a.source_rikishi_id=e.provider_id AND a.rikishi_id<>e.rikishi_id)
    OR (a.rikishi_id=e.rikishi_id AND a.source_rikishi_id<>e.provider_id)
  )
),
pending AS (
  SELECT e.* FROM expected e WHERE NOT EXISTS (
    SELECT 1 FROM rikishi_source_identities a WHERE a.source='sumo-api'
      AND a.source_rikishi_id=e.provider_id AND a.rikishi_id=e.rikishi_id
  )
),
inserted AS (
  INSERT INTO rikishi_source_identities(source,source_rikishi_id,rikishi_id)
  SELECT 'sumo-api',provider_id,rikishi_id FROM pending
  WHERE (SELECT apply FROM settings) AND NOT EXISTS (SELECT 1 FROM blockers)
  RETURNING 1
)
SELECT CASE WHEN NOT (SELECT apply FROM settings) THEN 'preview'
       WHEN EXISTS (SELECT 1 FROM blockers) THEN 'blocked' ELSE 'applied' END AS mode,
  ARRAY(SELECT detail FROM blockers ORDER BY detail) AS blockers,
  (SELECT count(*) FROM pending) AS planned_aliases,
  (SELECT count(*) FROM inserted) AS inserted_aliases;
