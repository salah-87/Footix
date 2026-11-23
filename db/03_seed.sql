-- =====================================================================
-- Demo data. All demo accounts use the password: Passw0rd!demo
-- (DEV ONLY - never load this file in production)
-- Match dates are relative to now(), so the demo never expires.
-- =====================================================================
BEGIN;

INSERT INTO users (email, password_hash, first_name, last_name, role) VALUES
 ('admin@footix.test',    '$2b$12$vSViouFs69aNeH4dn1Slc.PpvH2FfB.OPOW7U/o6A3Wm7Gwq9uf7u', 'Alex',  'Admin',    'admin'),
 ('controle@footix.test', '$2b$12$vSViouFs69aNeH4dn1Slc.PpvH2FfB.OPOW7U/o6A3Wm7Gwq9uf7u', 'Camille','Controle', 'controller'),
 ('fan@footix.test',      '$2b$12$vSViouFs69aNeH4dn1Slc.PpvH2FfB.OPOW7U/o6A3Wm7Gwq9uf7u', 'Sam',   'Supporter','spectator');

INSERT INTO teams (name, city) VALUES
 ('FC Limoges',      'Limoges'),
 ('AS Bordeaux Nord','Bordeaux'),
 ('Olympique Creuse','Gueret'),
 ('US Perigord',     'Perigueux'),
 ('Racing Poitiers', 'Poitiers'),
 ('Stade Angoumois', 'Angouleme');

INSERT INTO stadiums (name, city) VALUES ('Stade Municipal', 'Limoges');

-- ---------------------------------------------------------------------
-- Layout inspired by the ticketing of big clubs: 4 stands, 2 tiers,
-- loges in the main stand, a kop behind one goal and an away section.
-- ---------------------------------------------------------------------
INSERT INTO stands (stadium_id, name, position)
SELECT s.id, v.name, v.position FROM stadiums s
CROSS JOIN (VALUES ('Tribune Nord',  'nord'),
                   ('Tribune Sud',   'sud'),     -- main stand (présidentielle)
                   ('Tribune Est',   'est'),     -- virage: general + away fans
                   ('Tribune Ouest', 'ouest')    -- virage: home kop
           ) AS v(name, position)
WHERE s.name = 'Stade Municipal';

INSERT INTO seat_categories (code, name, description, color, sort_order) VALUES
 ('VIP',   'Hospitalité VIP', 'Loge privée en tribune présidentielle, accueil dédié, repas et boissons inclus.', '#c5a253', 1),
 ('CAT1',  'Catégorie 1',     'Anneau bas, face au rond central : la meilleure vue sur le jeu.',                 '#0b1f4b', 2),
 ('CAT2',  'Catégorie 2',     'Anneau bas vers les poteaux de corner, ou anneau haut au centre.',                '#3b5bab', 3),
 ('CAT3',  'Catégorie 3',     'Anneau haut en bout de tribune et virage Est : le tarif le plus doux.',          '#8fa3cf', 4),
 ('KOP',   'Virage Kop',      'Derrière le but, avec les groupes de supporters. Places debout autorisées.',      '#a1192e', 5),
 ('VISIT', 'Parcage visiteurs','Réservé aux supporters adverses : billets vendus par le club visiteur.',         '#5a6681', 6);

-- Sectors (blocs). Lateral stands: 5 blocks low + 5 blocks high.
-- Centre blocks are better (and dearer) than corner blocks, low better than high.
INSERT INTO sectors (stand_id, category_id, code, name, tier, position_index)
SELECT st.id, c.id, v.code, v.name, v.tier, v.idx
FROM (VALUES
  -- Tribune Nord
  ('Tribune Nord', 'N1',  'Bloc N1',  'bas',  1, 'CAT2'), ('Tribune Nord', 'N2',  'Bloc N2',  'bas',  2, 'CAT1'),
  ('Tribune Nord', 'N3',  'Bloc N3',  'bas',  3, 'CAT1'), ('Tribune Nord', 'N4',  'Bloc N4',  'bas',  4, 'CAT1'),
  ('Tribune Nord', 'N5',  'Bloc N5',  'bas',  5, 'CAT2'),
  ('Tribune Nord', 'NH1', 'Bloc NH1', 'haut', 1, 'CAT3'), ('Tribune Nord', 'NH2', 'Bloc NH2', 'haut', 2, 'CAT2'),
  ('Tribune Nord', 'NH3', 'Bloc NH3', 'haut', 3, 'CAT2'), ('Tribune Nord', 'NH4', 'Bloc NH4', 'haut', 4, 'CAT2'),
  ('Tribune Nord', 'NH5', 'Bloc NH5', 'haut', 5, 'CAT3'),
  -- Tribune Sud (présidentielle) with 3 loges between the two tiers
  ('Tribune Sud', 'S1',  'Bloc S1',  'bas',  1, 'CAT2'), ('Tribune Sud', 'S2',  'Bloc S2',  'bas',  2, 'CAT1'),
  ('Tribune Sud', 'S3',  'Bloc S3',  'bas',  3, 'CAT1'), ('Tribune Sud', 'S4',  'Bloc S4',  'bas',  4, 'CAT1'),
  ('Tribune Sud', 'S5',  'Bloc S5',  'bas',  5, 'CAT2'),
  ('Tribune Sud', 'L1',  'Loge Bordeaux', 'loge', 1, 'VIP'),
  ('Tribune Sud', 'L2',  'Loge Présidentielle', 'loge', 2, 'VIP'),
  ('Tribune Sud', 'L3',  'Loge Émail', 'loge', 3, 'VIP'),
  ('Tribune Sud', 'SH1', 'Bloc SH1', 'haut', 1, 'CAT3'), ('Tribune Sud', 'SH2', 'Bloc SH2', 'haut', 2, 'CAT2'),
  ('Tribune Sud', 'SH3', 'Bloc SH3', 'haut', 3, 'CAT2'), ('Tribune Sud', 'SH4', 'Bloc SH4', 'haut', 4, 'CAT2'),
  ('Tribune Sud', 'SH5', 'Bloc SH5', 'haut', 5, 'CAT3'),
  -- Virage Est: general admission + away section
  ('Tribune Est', 'E1',  'Bloc E1',  'bas',  1, 'CAT3'), ('Tribune Est', 'E2',  'Parcage E2',  'bas',  2, 'VISIT'),
  ('Tribune Est', 'EH1', 'Bloc EH1', 'haut', 1, 'CAT3'), ('Tribune Est', 'EH2', 'Parcage EH2', 'haut', 2, 'VISIT'),
  -- Virage Ouest: the home kop
  ('Tribune Ouest', 'O1',  'Kop O1',  'bas',  1, 'KOP'), ('Tribune Ouest', 'O2',  'Kop O2',  'bas',  2, 'KOP'),
  ('Tribune Ouest', 'OH1', 'Kop OH1', 'haut', 1, 'KOP'), ('Tribune Ouest', 'OH2', 'Kop OH2', 'haut', 2, 'KOP')
) AS v(stand, code, name, tier, idx, category)
JOIN stands st ON st.name = v.stand
JOIN seat_categories c ON c.code = v.category;

-- Seats are generated: rows x seats per row, depending on the kind of sector
INSERT INTO seats (sector_id, row_number, seat_number, is_accessible)
SELECT se.id, r, n,
       -- PMR: wheelchair spaces at the end of row 1 of some low blocks (step-free access)
       (r = 1 AND n <= 2 AND se.code IN ('N3', 'S3', 'E1', 'O1'))
FROM sectors se
JOIN stands st ON st.id = se.stand_id
CROSS JOIN LATERAL (SELECT CASE
          WHEN se.tier = 'loge' THEN 2
          WHEN st.position IN ('est', 'ouest') AND se.tier = 'bas' THEN 8
          WHEN st.position IN ('est', 'ouest') THEN 6
          WHEN se.tier = 'bas' THEN 8
          ELSE 6 END AS nb_rows,
        CASE
          WHEN se.tier = 'loge' THEN 6
          WHEN st.position IN ('est', 'ouest') THEN 12
          ELSE 14 END AS nb_cols) AS cfg
CROSS JOIN LATERAL generate_series(1, cfg.nb_rows) AS r
CROSS JOIN LATERAL generate_series(1, cfg.nb_cols) AS n;

INSERT INTO matches (stadium_id, home_team_id, away_team_id, kickoff_at, status)
SELECT 1, h.id, a.id,
       -- kick-off at 20:45 (Paris time), N days from today
       (date_trunc('day', now() AT TIME ZONE 'Europe/Paris') + m.delay + interval '20 hours 45 minutes') AT TIME ZONE 'Europe/Paris',
       m.status
FROM (VALUES ('FC Limoges',      'AS Bordeaux Nord', interval '10 days', 'on_sale'),
             ('FC Limoges',      'Olympique Creuse', interval '24 days', 'on_sale'),
             ('FC Limoges',      'US Perigord',      interval '38 days', 'draft'),
             ('FC Limoges',      'Racing Poitiers',  interval '52 days', 'cancelled')
     ) AS m(home, away, delay, status)
JOIN teams h ON h.name = m.home
JOIN teams a ON a.name = m.away;

-- Prices per category AND per match (the fixture against Bordeaux is a big game).
-- No row for VISIT: the away section is never sold online (rule RG2).
INSERT INTO match_category_prices (match_id, category_id, price_cents)
SELECT m.id, c.id,
       CASE WHEN a.name = 'AS Bordeaux Nord'   -- big game: higher prices
            THEN CASE c.code WHEN 'VIP' THEN 18000 WHEN 'CAT1' THEN 4500 WHEN 'CAT2' THEN 3000
                             WHEN 'CAT3' THEN 1900 WHEN 'KOP' THEN 1200 END
            ELSE CASE c.code WHEN 'VIP' THEN 15000 WHEN 'CAT1' THEN 3800 WHEN 'CAT2' THEN 2600
                             WHEN 'CAT3' THEN 1600 WHEN 'KOP' THEN 1000 END
       END
FROM matches m
JOIN teams a ON a.id = m.away_team_id
CROSS JOIN seat_categories c
WHERE c.code <> 'VISIT';

COMMIT;
