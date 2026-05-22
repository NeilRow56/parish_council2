alter table "bank_reconciliations"
  add column if not exists "reconciled_by_user_id" text;

alter table "bank_reconciliations"
  add column if not exists "reconciled_at" timestamp;

do $$
begin
  alter table "bank_reconciliations"
    add constraint "bank_reconciliations_reconciled_by_user_id_user_id_fk"
    foreign key ("reconciled_by_user_id")
    references "user" ("id")
    on delete set null;
exception
  when duplicate_object then null;
end $$;

alter table "journal_lines"
  add column if not exists "reconciliation_id" text;

do $$
begin
  alter table "journal_lines"
    add constraint "journal_lines_reconciliation_id_bank_reconciliations_id_fk"
    foreign key ("reconciliation_id")
    references "bank_reconciliations" ("id")
    on delete set null;
exception
  when duplicate_object then null;
end $$;

create index if not exists "journal_line_reconciliation_idx"
  on "journal_lines" ("reconciliation_id");
