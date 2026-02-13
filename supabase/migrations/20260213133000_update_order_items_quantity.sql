-- Change quantity in order_items to numeric to support fractional units (e.g. 1.5 Kg)
ALTER TABLE public.order_items
ALTER COLUMN quantity TYPE NUMERIC(10, 3);