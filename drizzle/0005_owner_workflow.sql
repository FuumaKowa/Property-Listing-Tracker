-- Owner workflow only. No existing owner values, timestamps or normal listings are rewritten.
ALTER TABLE public.owner_listings
  ADD COLUMN version integer NOT NULL DEFAULT 1,
  ADD COLUMN assigned_agent_id integer REFERENCES public.auth_users(id) ON DELETE SET NULL,
  ADD COLUMN assigned_agent_name text,
  ADD COLUMN assigned_at timestamptz,
  ADD COLUMN last_agent_activity_at timestamptz,
  ADD COLUMN seeding_status text CHECK (seeding_status IN ('IFU1','IFU2','IFU3'));
ALTER TABLE public.owner_listings DROP CONSTRAINT owner_listings_status_check;
ALTER TABLE public.owner_listings ADD CONSTRAINT owner_listings_status_check CHECK (status IN ('Listed','Unlisted','Rejected'));
--> statement-breakpoint
CREATE TABLE public.owner_assignment_rules (
  key text PRIMARY KEY,
  agent_label text NOT NULL,
  areas jsonb NOT NULL,
  user_id integer REFERENCES public.auth_users(id) ON DELETE SET NULL
);
INSERT INTO public.owner_assignment_rules(key,agent_label,areas) VALUES
 ('shahril','Dr Shahril','["shah alam"]'),
 ('hakim','Hakim','["klang"]'),
 ('luqman','Luqman','["damansara","kota damansara","petaling jaya","sunway"]'),
 ('ikhwan','Ikhwan','["puchong","bandar saujana putera","cyberjaya","subang jaya"]'),
 ('muz','Muz','["rawang","puncak alam","sungai buloh","selayang"]');
CREATE TABLE public.owner_listing_events (
 id serial PRIMARY KEY,
 listing_id integer REFERENCES public.owner_listings(id) ON DELETE SET NULL,
 action text NOT NULL,
 actor_id integer,
 actor_name text NOT NULL,
 note text,
 before_record jsonb,
 after_record jsonb,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX owner_listing_events_listing_idx ON public.owner_listing_events(listing_id,id);
--> statement-breakpoint
-- Distinct rule count prevents guessing when different agents' areas occur together.
CREATE FUNCTION public.owner_agent_for_location(value text) RETURNS integer LANGUAGE sql STABLE AS $$
 SELECT CASE WHEN count(DISTINCT r.key)=1 THEN min(u.id) END
 FROM public.owner_assignment_rules r
 LEFT JOIN public.auth_users u ON u.id=r.user_id
 WHERE EXISTS (SELECT 1 FROM jsonb_array_elements_text(r.areas) a(area)
   WHERE (' ' || regexp_replace(lower(coalesce(value,'')), '[^a-z0-9]+', ' ', 'g') || ' ')
     LIKE '% ' || a.area || ' %')
$$;
CREATE FUNCTION public.owner_assign_on_insert() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 NEW.assigned_agent_id := public.owner_agent_for_location(NEW.location);
 IF NEW.assigned_agent_id IS NOT NULL THEN
   SELECT coalesce(nullif(display_name,''),username) INTO NEW.assigned_agent_name FROM public.auth_users WHERE id=NEW.assigned_agent_id;
   NEW.assigned_at := now();
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER owner_assign_on_insert BEFORE INSERT ON public.owner_listings FOR EACH ROW EXECUTE FUNCTION public.owner_assign_on_insert();
CREATE FUNCTION public.owner_log_insert() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO public.owner_listing_events(listing_id,action,actor_name,after_record)
 VALUES(NEW.id,'created',NEW.updated_by_name,to_jsonb(NEW));
 RETURN NEW;
END $$;
CREATE TRIGGER owner_log_insert AFTER INSERT ON public.owner_listings FOR EACH ROW EXECUTE FUNCTION public.owner_log_insert();
