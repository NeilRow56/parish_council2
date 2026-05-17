-- Ensure the Better Auth user table has the columns selected by the app.
-- This migration is intentionally idempotent for production databases that
-- were created before the custom user fields were added to the Drizzle schema.

alter table "user"
  add column if not exists "name" text not null default '',
  add column if not exists "email" text not null default '',
  add column if not exists "email_verified" boolean not null default false,
  add column if not exists "image" text,
  add column if not exists "role" text not null default 'CLERK',
  add column if not exists "parish_council_id" text,
  add column if not exists "created_at" timestamp not null default now(),
  add column if not exists "updated_at" timestamp not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_parish_council_id_parish_councils_id_fk'
  ) then
    alter table "user"
      add constraint "user_parish_council_id_parish_councils_id_fk"
      foreign key ("parish_council_id")
      references "parish_councils"("id")
      on delete restrict;
  end if;
end $$;

create unique index if not exists "user_email_idx" on "user" ("email");
