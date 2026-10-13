import { PGlite } from '@electric-sql/pglite';
export async function promotionFixture(pg:PGlite) {
 await pg.exec(`CREATE TABLE listings(id serial PRIMARY KEY,source_owner_listing_id integer UNIQUE,property text,project_category text,location text,tenure text,pm text,negotiator text,agent text,no_tel text,available_units text,status text,date text,renew_status text,notes text,created_by_user_id text,created_by_name text,updated_by_user_id text,updated_by_name text,last_updated_at timestamp,version integer DEFAULT 1,archived_at timestamp,archived_by_name text);
 CREATE TABLE listing_audit_logs(id serial PRIMARY KEY,listing_id integer,action text,changed_fields text,user_uid text,user_name text);`);
}
