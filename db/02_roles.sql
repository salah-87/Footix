-- =====================================================================
-- Database accounts with least privilege.
-- DEV PASSWORDS ONLY: change them in production (use secrets).
-- =====================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'footix_app') THEN
        CREATE ROLE footix_app LOGIN PASSWORD 'footix_app_dev';
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'footix_readonly') THEN
        CREATE ROLE footix_readonly LOGIN PASSWORD 'footix_readonly_dev';
    END IF;
END
$$;

-- Application account: data manipulation only (no CREATE / DROP / ALTER)
GRANT USAGE ON SCHEMA public TO footix_app, footix_readonly;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO footix_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO footix_app;

-- Reporting account: read only, and no access to password hashes
GRANT SELECT ON stadiums, stands, seats, teams, matches, match_stand_prices,
                orders, tickets TO footix_readonly;
GRANT SELECT (id, role, created_at) ON users TO footix_readonly;
