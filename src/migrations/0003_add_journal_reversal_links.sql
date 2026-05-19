alter table "journal_entries"
  add column if not exists "reverses_journal_entry_id" text;

alter table "journal_entries"
  add column if not exists "reversed_by_journal_entry_id" text;

create index if not exists "journal_entry_reverses_idx"
  on "journal_entries" ("reverses_journal_entry_id");

create index if not exists "journal_entry_reversed_by_idx"
  on "journal_entries" ("reversed_by_journal_entry_id");
