-- Family household inventory: data model, tenant isolation, and atomic inventory actions.

CREATE TABLE public.households (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX households_singleton_idx ON public.households ((true));

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  display_name text NOT NULL CHECK (length(btrim(display_name)) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  barcode text CHECK (barcode IS NULL OR length(btrim(barcode)) > 0),
  brand text,
  specification text,
  image_url text,
  category text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, household_id)
);

CREATE TABLE public.rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (household_id, name),
  UNIQUE (id, household_id)
);

CREATE TABLE public.storage_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  room_id uuid NOT NULL,
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  photo_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (household_id, room_id, name),
  UNIQUE (id, household_id),
  CONSTRAINT storage_locations_room_household_fkey
    FOREIGN KEY (room_id, household_id)
    REFERENCES public.rooms (id, household_id)
    ON DELETE RESTRICT
);

CREATE TABLE public.inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  product_id uuid NOT NULL,
  location_id uuid NOT NULL,
  quantity integer NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  unit text NOT NULL DEFAULT '件' CHECK (length(btrim(unit)) > 0),
  low_stock_threshold integer NOT NULL DEFAULT 0 CHECK (low_stock_threshold >= 0),
  reminder_ignored boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, household_id),
  CONSTRAINT inventory_items_product_household_fkey
    FOREIGN KEY (product_id, household_id)
    REFERENCES public.products (id, household_id)
    ON DELETE RESTRICT,
  CONSTRAINT inventory_items_location_household_fkey
    FOREIGN KEY (location_id, household_id)
    REFERENCES public.storage_locations (id, household_id)
    ON DELETE RESTRICT
);

CREATE TABLE public.inventory_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  item_id uuid NOT NULL,
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  kind text NOT NULL CHECK (kind IN ('restock', 'consume', 'deplete')),
  quantity_before integer NOT NULL CHECK (quantity_before >= 0),
  quantity_after integer NOT NULL CHECK (quantity_after >= 0),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_events_item_household_fkey
    FOREIGN KEY (item_id, household_id)
    REFERENCES public.inventory_items (id, household_id)
    ON DELETE RESTRICT
);

CREATE INDEX products_household_id_idx ON public.products (household_id);
CREATE INDEX rooms_household_id_idx ON public.rooms (household_id);
CREATE INDEX storage_locations_household_id_idx ON public.storage_locations (household_id);
CREATE INDEX inventory_items_household_id_idx ON public.inventory_items (household_id);
CREATE INDEX inventory_items_low_stock_idx ON public.inventory_items (household_id, quantity, low_stock_threshold)
  WHERE reminder_ignored = false;
CREATE INDEX inventory_events_item_created_at_idx ON public.inventory_events (item_id, created_at DESC);
CREATE INDEX inventory_events_household_created_at_idx ON public.inventory_events (household_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER households_set_updated_at
BEFORE UPDATE ON public.households
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER profiles_set_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER products_set_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER rooms_set_updated_at
BEFORE UPDATE ON public.rooms
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER storage_locations_set_updated_at
BEFORE UPDATE ON public.storage_locations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER inventory_items_set_updated_at
BEFORE UPDATE ON public.inventory_items
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.current_household_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT p.household_id
  FROM public.profiles AS p
  WHERE p.id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_household_creator(target_household_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.households AS h
    WHERE h.id = target_household_id
      AND h.created_by = auth.uid()
  );
$$;

ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storage_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY households_select_own ON public.households
  FOR SELECT TO authenticated
  USING (id = public.current_household_id());

CREATE POLICY profiles_select_own_household ON public.profiles
  FOR SELECT TO authenticated
  USING (household_id = public.current_household_id());

CREATE POLICY profiles_insert_by_household_creator ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    household_id = public.current_household_id()
    AND public.is_household_creator(household_id)
  );

CREATE POLICY profiles_update_by_household_creator ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    household_id = public.current_household_id()
    AND public.is_household_creator(household_id)
  )
  WITH CHECK (
    household_id = public.current_household_id()
    AND public.is_household_creator(household_id)
  );

CREATE POLICY profiles_delete_by_household_creator ON public.profiles
  FOR DELETE TO authenticated
  USING (
    household_id = public.current_household_id()
    AND public.is_household_creator(household_id)
  );

CREATE POLICY products_access_own_household ON public.products
  FOR ALL TO authenticated
  USING (household_id = public.current_household_id())
  WITH CHECK (household_id = public.current_household_id());

CREATE POLICY rooms_access_own_household ON public.rooms
  FOR ALL TO authenticated
  USING (household_id = public.current_household_id())
  WITH CHECK (household_id = public.current_household_id());

CREATE POLICY storage_locations_access_own_household ON public.storage_locations
  FOR ALL TO authenticated
  USING (household_id = public.current_household_id())
  WITH CHECK (household_id = public.current_household_id());

CREATE POLICY inventory_items_access_own_household ON public.inventory_items
  FOR ALL TO authenticated
  USING (household_id = public.current_household_id())
  WITH CHECK (household_id = public.current_household_id());

CREATE POLICY inventory_events_select_own_household ON public.inventory_events
  FOR SELECT TO authenticated
  USING (household_id = public.current_household_id());

-- Supabase's database defaults grant broad table permissions to API roles.
-- Stock and audit writes are deliberately restored only through the RPC below.
REVOKE ALL ON TABLE public.inventory_items, public.inventory_events
  FROM anon, authenticated, service_role;

GRANT SELECT ON public.households TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products, public.rooms,
  public.storage_locations TO authenticated;
GRANT SELECT ON public.inventory_items TO authenticated;
GRANT INSERT (household_id, product_id, location_id, unit, low_stock_threshold, reminder_ignored)
  ON public.inventory_items TO authenticated;
GRANT UPDATE (product_id, location_id, unit, low_stock_threshold, reminder_ignored)
  ON public.inventory_items TO authenticated;
GRANT SELECT ON public.inventory_events TO authenticated;

REVOKE ALL ON FUNCTION public.current_household_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_household_creator(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_household_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_household_creator(uuid) TO authenticated;

INSERT INTO storage.buckets (id, name, public)
VALUES ('location-photos', 'location-photos', false)
ON CONFLICT (id) DO UPDATE SET public = false;

CREATE POLICY location_photos_select_own_household ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'location-photos'
    AND name LIKE (public.current_household_id()::text || '/%')
  );

CREATE POLICY location_photos_insert_own_household ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'location-photos'
    AND name LIKE (public.current_household_id()::text || '/%')
  );

CREATE POLICY location_photos_update_own_household ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'location-photos'
    AND name LIKE (public.current_household_id()::text || '/%')
  )
  WITH CHECK (
    bucket_id = 'location-photos'
    AND name LIKE (public.current_household_id()::text || '/%')
  );

CREATE OR REPLACE FUNCTION public.apply_inventory_action(
  p_item_id uuid,
  p_action text,
  p_amount integer DEFAULT NULL,
  p_note text DEFAULT NULL
)
RETURNS public.inventory_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_item public.inventory_items;
  v_household_id uuid;
  v_before integer;
  v_after integer;
BEGIN
  IF p_action NOT IN ('restock', 'consume', 'deplete') THEN
    RAISE EXCEPTION 'unsupported inventory action: %', p_action
      USING ERRCODE = '22023';
  END IF;

  IF p_action IN ('restock', 'consume') AND (p_amount IS NULL OR p_amount <= 0) THEN
    RAISE EXCEPTION 'action % requires a positive amount', p_action
      USING ERRCODE = '22023';
  END IF;

  IF p_action = 'deplete' AND p_amount IS NOT NULL THEN
    RAISE EXCEPTION 'deplete does not accept an amount'
      USING ERRCODE = '22023';
  END IF;

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authenticated user is required'
      USING ERRCODE = '28000';
  END IF;

  v_household_id := public.current_household_id();

  IF v_household_id IS NULL THEN
    RAISE EXCEPTION 'household membership is required'
      USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_item
  FROM public.inventory_items
  WHERE id = p_item_id
    AND household_id = v_household_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'inventory item not found'
      USING ERRCODE = 'P0002';
  END IF;

  v_before := v_item.quantity;
  v_after := CASE p_action
    WHEN 'restock' THEN v_before + p_amount
    WHEN 'consume' THEN GREATEST(0, v_before - p_amount)
    WHEN 'deplete' THEN 0
  END;

  UPDATE public.inventory_items
  SET quantity = v_after,
      reminder_ignored = CASE
        WHEN v_after > low_stock_threshold THEN false
        ELSE reminder_ignored
      END
  WHERE id = v_item.id
  RETURNING * INTO v_item;

  INSERT INTO public.inventory_events (
    household_id,
    item_id,
    actor_id,
    kind,
    quantity_before,
    quantity_after,
    note
  ) VALUES (
    v_item.household_id,
    v_item.id,
    auth.uid(),
    p_action,
    v_before,
    v_after,
    p_note
  );

  RETURN v_item;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_inventory_action(uuid, text, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_inventory_action(uuid, text, integer, text) FROM anon, service_role;
GRANT EXECUTE ON FUNCTION public.apply_inventory_action(uuid, text, integer, text) TO authenticated;
