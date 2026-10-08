-- Apply before promotion; grant DML only on this counter table to the ORC runtime role.
CREATE TABLE IF NOT EXISTS public.orc_security_rate_limits(key text PRIMARY KEY,hits integer NOT NULL CHECK(hits>0),window_started_at timestamptz NOT NULL,expires_at timestamptz NOT NULL);
CREATE INDEX IF NOT EXISTS orc_security_rate_limits_expiry ON public.orc_security_rate_limits(expires_at);
