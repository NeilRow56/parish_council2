alter table "journal_lines"
  add column if not exists "cleared_at" timestamp;

alter table "journal_lines"
  add column if not exists "cleared_by_user_id" text;

alter table "journal_lines"
  add column if not exists "cleared_statement_date" date;

alter table "journal_lines"
  add column if not exists "reconciliation_reference" text;

do $$
begin
  alter table "journal_lines"
    add constraint "journal_lines_cleared_by_user_id_user_id_fk"
    foreign key ("cleared_by_user_id")
    references "user" ("id")
    on delete set null;
exception
  when duplicate_object then null;
end $$;

create index if not exists "journal_line_cleared_at_idx"
  on "journal_lines" ("cleared_at");
