-- A barcode identifies one product catalogue entry within the single household.
CREATE UNIQUE INDEX products_household_barcode_unique_idx
  ON public.products (household_id, barcode)
  WHERE barcode IS NOT NULL;

-- Product and location edits must refresh joined inventory views for other members.
ALTER PUBLICATION supabase_realtime ADD TABLE
  public.products,
  public.rooms,
  public.storage_locations;
