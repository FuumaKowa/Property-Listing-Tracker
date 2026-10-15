CREATE TABLE public.owner_summary_reports (
 id text PRIMARY KEY CHECK (id ~ '^[a-f0-9]{64}$'),
 created_by integer REFERENCES public.auth_users(id) ON DELETE SET NULL,
 report_text text NOT NULL CHECK (length(report_text) BETWEEN 1 AND 50000),
 entry_count integer NOT NULL CHECK (entry_count BETWEEN 1 AND 100),
 outcomes jsonb NOT NULL DEFAULT '{}'::jsonb,
 choices jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX owner_summary_reports_creator_idx ON public.owner_summary_reports(created_by,updated_at DESC);
