-- game_item_purchases is an immutable purchase ledger and has no updated_at
-- column. The original game economy migration accidentally attached the
-- shared timestamp trigger, which makes purchase updates fail with:
-- record "new" has no field "updated_at".

drop trigger if exists game_item_purchases_updated_at on public.game_item_purchases;
