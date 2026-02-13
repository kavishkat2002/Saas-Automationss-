-- Create a trigger to call the edge function on order update
-- NOTE: This requires the pg_net extension to be enabled in Supabase
-- 1. Enable pg_net extension if not already enabled
create extension if not exists pg_net;
-- 2. Create the function to call the edge function
create or replace function public.handle_order_update() returns trigger language plpgsql security definer as $$ begin -- Only trigger if status has changed
    if new.status <> old.status then perform net.http_post(
        url := 'https://rskkufaczzltlwtpyect.supabase.co/functions/v1/send-order-notification',
        headers := jsonb_build_object(
            'Content-Type',
            'application/json',
            'Authorization',
            'Bearer ' || coalesce(
                current_setting('request.jwt.claim.role', true),
                'anon'
            )
        ),
        body := jsonb_build_object(
            'type',
            'UPDATE',
            'table',
            'orders',
            'record',
            row_to_json(new),
            'old_record',
            row_to_json(old),
            'schema',
            'public'
        )
    );
end if;
return new;
end;
$$;
-- 3. Create the trigger
drop trigger if exists on_order_update_notification on public.orders;
create trigger on_order_update_notification
after
update on public.orders for each row execute function public.handle_order_update();