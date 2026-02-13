-- Update orders status check constraint to include new statuses
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders
ADD CONSTRAINT orders_status_check CHECK (
        status IN (
            'pending',
            'confirmed',
            'packed',
            'ready_for_pickup',
            'out_for_delivery',
            'shipped',
            'delivered',
            'cancelled'
        )
    );
-- Add comment to explain the new statuses
COMMENT ON COLUMN public.orders.status IS 'Order status: pending, confirmed, packed, ready_for_pickup, out_for_delivery, shipped, delivered, cancelled';