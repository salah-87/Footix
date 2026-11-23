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

INSERT INTO stands (stadium_id, name)
SELECT s.id, v.name FROM stadiums s
CROSS JOIN (VALUES ('Tribune Nord'), ('Tribune Sud'), ('Tribune Est'), ('Tribune Ouest')) AS v(name)
WHERE s.name = 'Stade Municipal';

-- Seats are generated: rows x seats per row, depending on the stand
INSERT INTO seats (stand_id, row_number, seat_number)
SELECT st.id, r, n
FROM stands st
JOIN (VALUES ('Tribune Nord', 10, 20),
             ('Tribune Sud',  10, 20),
             ('Tribune Est',   6, 15),
             ('Tribune Ouest', 4, 12)) AS cfg(name, nb_rows, nb_cols) ON cfg.name = st.name
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

INSERT INTO match_stand_prices (match_id, stand_id, price_cents)
SELECT m.id, st.id,
       CASE st.name WHEN 'Tribune Nord'  THEN 1200
                    WHEN 'Tribune Sud'   THEN 1200
                    WHEN 'Tribune Est'   THEN 2000
                    WHEN 'Tribune Ouest' THEN 3500 END
FROM matches m CROSS JOIN stands st;

COMMIT;
