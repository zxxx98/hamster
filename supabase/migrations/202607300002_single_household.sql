-- A unique expression index on a constant permits zero or one household rows.
CREATE UNIQUE INDEX households_singleton_idx ON public.households ((true));
