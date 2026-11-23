-- =====================================================================
-- Footix - PostgreSQL schema (3rd normal form)
-- Run order: 01_schema.sql -> 02_roles.sql -> 03_seed.sql
-- =====================================================================
BEGIN;

-- Users: one table, a role column (spectator | controller | admin)
CREATE TABLE users (
    id            SERIAL       PRIMARY KEY,
    email         VARCHAR(254) NOT NULL,
    password_hash VARCHAR(100) NOT NULL,          -- bcrypt hash, never the password
    first_name    VARCHAR(80)  NOT NULL,
    last_name     VARCHAR(80)  NOT NULL,
    role          VARCHAR(12)  NOT NULL DEFAULT 'spectator'
                  CHECK (role IN ('spectator', 'controller', 'admin')),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);
-- Case-insensitive uniqueness: Alice@x.fr and alice@x.fr are the same account
CREATE UNIQUE INDEX users_email_lower_uq ON users (lower(email));

CREATE TABLE stadiums (
    id   SERIAL       PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    city VARCHAR(80)  NOT NULL,
    UNIQUE (name, city)
);

-- A stadium is split into stands (tribunes)
CREATE TABLE stands (
    id         SERIAL       PRIMARY KEY,
    stadium_id INTEGER      NOT NULL REFERENCES stadiums(id) ON DELETE CASCADE,
    name       VARCHAR(80)  NOT NULL,
    UNIQUE (stadium_id, name)
);

-- Physical seats, numbered by row and seat number inside a stand
CREATE TABLE seats (
    id          SERIAL  PRIMARY KEY,
    stand_id    INTEGER NOT NULL REFERENCES stands(id) ON DELETE CASCADE,
    row_number  INTEGER NOT NULL CHECK (row_number > 0),
    seat_number INTEGER NOT NULL CHECK (seat_number > 0),
    UNIQUE (stand_id, row_number, seat_number)
);

CREATE TABLE teams (
    id   SERIAL       PRIMARY KEY,
    name VARCHAR(80)  NOT NULL UNIQUE,
    city VARCHAR(80)  NOT NULL
);

CREATE TABLE matches (
    id           SERIAL      PRIMARY KEY,
    stadium_id   INTEGER     NOT NULL REFERENCES stadiums(id),
    home_team_id INTEGER     NOT NULL REFERENCES teams(id),
    away_team_id INTEGER     NOT NULL REFERENCES teams(id),
    kickoff_at   TIMESTAMPTZ NOT NULL,
    status       VARCHAR(12) NOT NULL DEFAULT 'draft'
                 CHECK (status IN ('draft', 'on_sale', 'cancelled')),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (home_team_id <> away_team_id)           -- a team cannot play itself
);
CREATE INDEX matches_kickoff_idx ON matches (kickoff_at);

-- Price of a stand for a given match (many-to-many with an attribute)
CREATE TABLE match_stand_prices (
    match_id    INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    stand_id    INTEGER NOT NULL REFERENCES stands(id),
    price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
    PRIMARY KEY (match_id, stand_id)
);

CREATE TABLE orders (
    id          SERIAL      PRIMARY KEY,
    user_id     INTEGER     NOT NULL REFERENCES users(id),
    total_cents INTEGER     NOT NULL CHECK (total_cents >= 0),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX orders_user_idx ON orders (user_id);

CREATE TABLE tickets (
    id          SERIAL      PRIMARY KEY,
    order_id    INTEGER     NOT NULL REFERENCES orders(id),
    match_id    INTEGER     NOT NULL REFERENCES matches(id),
    seat_id     INTEGER     NOT NULL REFERENCES seats(id),
    price_cents INTEGER     NOT NULL CHECK (price_cents >= 0),  -- price at purchase time
    status      VARCHAR(8)  NOT NULL DEFAULT 'valid'
                CHECK (status IN ('valid', 'used')),
    used_at     TIMESTAMPTZ,
    used_by     INTEGER     REFERENCES users(id),               -- the controller who scanned it
    -- THE key constraint: a seat can be sold only once per match.
    -- The database itself prevents double selling, even under concurrency.
    CONSTRAINT tickets_match_seat_unique UNIQUE (match_id, seat_id)
);
CREATE INDEX tickets_order_idx ON tickets (order_id);

COMMIT;
