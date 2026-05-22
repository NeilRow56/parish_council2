create table if not exists "bank_reconciliations" (
  "id" text primary key not null,
  "parish_council_id" text not null references "parish_councils" ("id") on delete cascade,
  "financial_year_id" text not null references "financial_years" ("id") on delete cascade,
  "bank_nominal_code_id" text not null references "nominal_codes" ("id"),
  "statement_date" date not null,
  "statement_balance" decimal(12, 2) not null,
  "statement_attachment_url" text,
  "statement_attachment_name" text,
  "statement_attachment_key" text,
  "created_by_user_id" text references "user" ("id") on delete set null,
  "created_at" timestamp default now() not null,
  "updated_at" timestamp default now() not null
);

create unique index if not exists "bank_reconciliation_statement_unique_idx"
  on "bank_reconciliations" (
    "parish_council_id",
    "financial_year_id",
    "bank_nominal_code_id",
    "statement_date"
  );

create index if not exists "bank_reconciliation_parish_year_idx"
  on "bank_reconciliations" ("parish_council_id", "financial_year_id");
