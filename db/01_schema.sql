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

-- A stadium is split into stands (tribunes), one per side of the pitch.
-- position tells the stadium map where to draw the stand.
CREATE TABLE stands (
    id         SERIAL       PRIMARY KEY,
    stadium_id INTEGER      NOT NULL REFERENCES stadiums(id) ON DELETE CASCADE,
    name       VARCHAR(80)  NOT NULL,
    position   VARCHAR(5)   NOT NULL CHECK (position IN ('nord', 'sud', 'est', 'ouest')),
    UNIQUE (stadium_id, name),
    UNIQUE (stadium_id, position)
);

-- Price categories, as in the ticketing of big clubs (VIP, Cat. 1-3, kop, away fans)
CREATE TABLE seat_categories (
    id          SERIAL       PRIMARY KEY,
    code        VARCHAR(12)  NOT NULL UNIQUE,         -- e.g. VIP, CAT1, KOP
    name        VARCHAR(60)  NOT NULL,
    description VARCHAR(255) NOT NULL,                -- what the category offers
    color       CHAR(7)      NOT NULL CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),  -- colour on the map
    sort_order  SMALLINT     NOT NULL DEFAULT 0
);

-- A stand is cut into sectors (blocs) on several tiers. Each sector belongs to ONE category.
CREATE TABLE sectors (
    id             SERIAL      PRIMARY KEY,
    stand_id       INTEGER     NOT NULL REFERENCES stands(id) ON DELETE CASCADE,
    category_id    INTEGER     NOT NULL REFERENCES seat_categories(id),
    code           VARCHAR(10) NOT NULL,              -- e.g. S2, NH3, LOGE1
    name           VARCHAR(80) NOT NULL,
    tier           VARCHAR(5)  NOT NULL CHECK (tier IN ('bas', 'loge', 'haut')),
    position_index SMALLINT    NOT NULL CHECK (position_index > 0),  -- order along the stand
    UNIQUE (stand_id, code),
    UNIQUE (stand_id, tier, position_index)
);
CREATE INDEX sectors_category_idx ON sectors (category_id);

-- Physical seats, numbered by row and seat number inside a sector
CREATE TABLE seats (
    id            SERIAL  PRIMARY KEY,
    sector_id     INTEGER NOT NULL REFERENCES sectors(id) ON DELETE CASCADE,
    row_number    INTEGER NOT NULL CHECK (row_number > 0),
    seat_number   INTEGER NOT NULL CHECK (seat_number > 0),
    is_accessible BOOLEAN NOT NULL DEFAULT false,     -- wheelchair space (PMR)
    UNIQUE (sector_id, row_number, seat_number)
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

-- Price of a category for a given match (many-to-many with an attribute).
-- Like big clubs, prices change with the fixture. A category with no price
-- for a match is NOT sold online for that match (e.g. away fans' section).
CREATE TABLE match_category_prices (
    match_id    INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    category_id INTEGER NOT NULL REFERENCES seat_categories(id),
    price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
    PRIMARY KEY (match_id, category_id)
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
