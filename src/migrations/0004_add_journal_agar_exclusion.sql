alter table "journal_entries"
  add column if not exists "exclude_from_agar" boolean not null default false;

update "journal_entries"
set "exclude_from_agar" = true
where "source" = 'VAT_RETURN';

create index if not exists "journal_entry_exclude_from_agar_idx"
  on "journal_entries" ("parish_council_id", "financial_year_id", "exclude_from_agar");
