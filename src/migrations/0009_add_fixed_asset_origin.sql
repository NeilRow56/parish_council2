alter table "fixed_assets"
  add column if not exists "asset_origin" text not null default 'opening_balance';

alter table "fixed_assets"
  drop constraint if exists "fixed_assets_asset_origin_check";

alter table "fixed_assets"
  add constraint "fixed_assets_asset_origin_check"
  check ("asset_origin" in ('opening_balance', 'live'));

update "fixed_assets"
set "asset_origin" = 'opening_balance'
where "asset_origin" is null;
