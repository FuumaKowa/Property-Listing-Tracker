CREATE TABLE marketing_workflows (
 id text PRIMARY KEY,
 reference text NOT NULL UNIQUE,
 owner_listing_id integer UNIQUE REFERENCES owner_listings(id) ON DELETE SET NULL,
 listing_id integer UNIQUE REFERENCES listings(id) ON DELETE SET NULL,
 version integer NOT NULL DEFAULT 1,
 data jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT marketing_workflow_reference_check CHECK(length(reference) BETWEEN 1 AND 80)
);
--> statement-breakpoint
CREATE TABLE marketing_workflow_roles (
 user_id integer PRIMARY KEY REFERENCES auth_users(id) ON DELETE CASCADE,
 role text NOT NULL CHECK(role IN ('coordinator','producer','reviewer','publisher','viewer'))
);
--> statement-breakpoint
INSERT INTO marketing_workflow_roles(user_id,role)
 SELECT id,CASE lower(username) WHEN 'eypa' THEN 'coordinator' WHEN 'luqman' THEN 'producer' WHEN 'drshahril74' THEN 'reviewer' WHEN 'muz' THEN 'publisher' END
 FROM auth_users WHERE lower(username) IN ('eypa','luqman','drshahril74','muz');
--> statement-breakpoint
CREATE TABLE marketing_workflow_sessions (
 session_hash text PRIMARY KEY REFERENCES auth_sessions(session_token_hash) ON DELETE CASCADE,
 effective_user_id integer NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
 csrf text NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE marketing_workflow_switches (
 id serial PRIMARY KEY,
 actual_user_id integer REFERENCES auth_users(id) ON DELETE SET NULL,
 actual_name text NOT NULL,
 from_name text NOT NULL,
 to_name text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
