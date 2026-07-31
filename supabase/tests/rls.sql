\set ON_ERROR_STOP on

-- Direct `psql -f` execution is safe: fixtures are always rolled back.  The
-- outer_transaction switch lets migration validation keep schema and fixtures
-- in one outer transaction without issuing a nested BEGIN.
\if :{?outer_transaction}
\else
BEGIN;
\endif

INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at)
VALUES
  ('10000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'alice-rls-test@example.invalid', now(), now(), now()),
  ('20000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'bob-rls-test@example.invalid', now(), now(), now()),
  ('d0000000-0000-0000-0000-000000000013', 'authenticated', 'authenticated', 'charlie-rls-test@example.invalid', now(), now(), now());

INSERT INTO public.households (id, name, created_by)
VALUES
  ('30000000-0000-0000-0000-000000000003', 'Alice household', '10000000-0000-0000-0000-000000000001');

INSERT INTO public.profiles (id, household_id, display_name)
VALUES
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003', 'Alice'),
  ('d0000000-0000-0000-0000-000000000013', '30000000-0000-0000-0000-000000000003', 'Charlie');

INSERT INTO public.products (id, household_id, name, barcode)
VALUES
  ('50000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000003', 'Alice tissues', '6900000000001');

DO $$
BEGIN
  INSERT INTO public.products (household_id, name, barcode)
  VALUES (
    '30000000-0000-0000-0000-000000000003',
    'Duplicate Alice tissues',
    '6900000000001'
  );
  RAISE EXCEPTION 'duplicate household barcode unexpectedly succeeded';
EXCEPTION
  WHEN unique_violation THEN
    NULL;
END;
$$;

INSERT INTO public.rooms (id, household_id, name)
VALUES
  ('70000000-0000-0000-0000-000000000007', '30000000-0000-0000-0000-000000000003', 'Alice kitchen');

INSERT INTO public.storage_locations (id, household_id, room_id, name)
VALUES
  ('90000000-0000-0000-0000-000000000009', '30000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000007', 'Alice cupboard');

INSERT INTO public.inventory_items (id, household_id, product_id, location_id, quantity, unit, low_stock_threshold)
VALUES
  ('b0000000-0000-0000-0000-000000000011', '30000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000005', '90000000-0000-0000-0000-000000000009', 3, 'pack', 1);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);

DO $$
BEGIN
  IF (SELECT count(*) FROM public.inventory_items) <> 1 THEN
    RAISE EXCEPTION 'Alice must see exactly one inventory item from her household';
  END IF;

END;
$$;

SELECT set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000002', true);

DO $$
BEGIN
  IF (SELECT count(*) FROM public.inventory_items) <> 0 THEN
    RAISE EXCEPTION 'a user without a household can read inventory';
  END IF;

  INSERT INTO public.inventory_items (household_id, product_id, location_id, unit, low_stock_threshold)
  VALUES (
    '30000000-0000-0000-0000-000000000003',
    '50000000-0000-0000-0000-000000000005',
    '90000000-0000-0000-0000-000000000009',
    'pack',
    0
  );
  RAISE EXCEPTION 'a user without a household inserted inventory';
EXCEPTION
  WHEN insufficient_privilege THEN
    NULL;
END;
$$;

DO $$
BEGIN
  PERFORM public.apply_inventory_action('b0000000-0000-0000-0000-000000000011', 'consume', 1, NULL);
  RAISE EXCEPTION 'a user without a household changed inventory';
EXCEPTION
  WHEN invalid_authorization_specification THEN
    NULL;
END;
$$;

SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);

DO $$
DECLARE
  updated public.inventory_items;
BEGIN
  SELECT * INTO updated
  FROM public.apply_inventory_action('b0000000-0000-0000-0000-000000000011', 'consume', 2, 'RLS test');

  IF updated.quantity <> 1 THEN
    RAISE EXCEPTION 'inventory action did not return the updated owned item';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.inventory_events
    WHERE item_id = 'b0000000-0000-0000-0000-000000000011'
      AND actor_id = '10000000-0000-0000-0000-000000000001'
      AND kind = 'consume'
      AND quantity_before = 3
      AND quantity_after = 1
      AND note = 'RLS test'
  ) THEN
    RAISE EXCEPTION 'inventory action did not append the expected immutable event';
  END IF;
END;
$$;

DO $$
DECLARE
  updated_rows integer;
BEGIN
  UPDATE public.inventory_items
  SET quantity = 42
  WHERE id = 'b0000000-0000-0000-0000-000000000011';
  GET DIAGNOSTICS updated_rows = ROW_COUNT;

  IF updated_rows <> 0 THEN
    RAISE EXCEPTION 'direct inventory quantity update unexpectedly succeeded';
  END IF;
EXCEPTION
  WHEN insufficient_privilege THEN
    NULL;
END;
$$;

DO $$
BEGIN
  INSERT INTO public.inventory_events (
    household_id,
    item_id,
    actor_id,
    kind,
    quantity_before,
    quantity_after,
    note
  ) VALUES (
    '30000000-0000-0000-0000-000000000003',
    'b0000000-0000-0000-0000-000000000011',
    '20000000-0000-0000-0000-000000000002',
    'restock',
    1,
    2,
    'forged actor'
  );
  RAISE EXCEPTION 'direct inventory event insert unexpectedly succeeded';
EXCEPTION
  WHEN insufficient_privilege THEN
    NULL;
END;
$$;

INSERT INTO storage.objects (bucket_id, name, owner, owner_id)
VALUES (
  'location-photos',
  '30000000-0000-0000-0000-000000000003/cupboard.jpg',
  '10000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001'
);

DO $$
BEGIN
  INSERT INTO storage.objects (bucket_id, name, owner, owner_id)
  VALUES (
    'location-photos',
    '40000000-0000-0000-0000-000000000004/cupboard.jpg',
    '10000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001'
  );
  RAISE EXCEPTION 'cross-household location photo insert unexpectedly succeeded';
EXCEPTION
  WHEN insufficient_privilege THEN
    NULL;
END;
$$;

DO $$
DECLARE
  updated_rows integer;
BEGIN
  UPDATE public.profiles
  SET display_name = 'Charlie updated by creator'
  WHERE id = 'd0000000-0000-0000-0000-000000000013';
  GET DIAGNOSTICS updated_rows = ROW_COUNT;

  IF updated_rows <> 1 THEN
    RAISE EXCEPTION 'household creator could not update a household profile';
  END IF;
END;
$$;

SELECT set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000013', true);

DO $$
DECLARE
  updated_rows integer;
BEGIN
  UPDATE public.profiles
  SET display_name = 'Charlie direct update'
  WHERE id = 'd0000000-0000-0000-0000-000000000013';
  GET DIAGNOSTICS updated_rows = ROW_COUNT;

  IF updated_rows <> 0 THEN
    RAISE EXCEPTION 'non-creator updated a household profile';
  END IF;
END;
$$;

RESET ROLE;

\if :{?outer_transaction}
\else
ROLLBACK;
\endif
