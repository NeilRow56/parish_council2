alter table "parish_councils"
  add column if not exists "accounting_basis" text;

alter table "parish_councils"
  alter column "accounting_basis" set default 'RECEIPTS_AND_PAYMENTS';
