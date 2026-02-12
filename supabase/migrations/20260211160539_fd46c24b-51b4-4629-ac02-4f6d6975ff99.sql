-- Role enum
CREATE TYPE public.app_role AS ENUM ('owner', 'admin', 'agent');
-- Businesses (tenants)
CREATE TABLE public.businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  logo_url TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  whatsapp_api_token TEXT,
  whatsapp_webhook_secret TEXT,
  whatsapp_phone_number_id TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Profiles (user-business link)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, business_id)
);
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'agent',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, business_id)
);
-- Customers (CRM)
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  tags TEXT [] DEFAULT '{}',
  lead_status TEXT DEFAULT 'cold' CHECK (lead_status IN ('hot', 'warm', 'cold')),
  total_spent NUMERIC(12, 2) DEFAULT 0,
  order_count INT DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Products
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  category TEXT,
  stock_quantity INT DEFAULT 0,
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Orders
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE
  SET NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (
      status IN (
        'pending',
        'confirmed',
        'shipped',
        'delivered',
        'cancelled'
      )
    ),
    payment_status TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'refunded')),
    total_amount NUMERIC(12, 2) DEFAULT 0,
    shipping_address TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Order items
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE
  SET NULL,
    product_name TEXT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
    total_price NUMERIC(12, 2) NOT NULL DEFAULT 0
);
-- Conversations
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE
  SET NULL,
    channel TEXT DEFAULT 'whatsapp',
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'closed', 'escalated')),
    is_human_takeover BOOLEAN DEFAULT false,
    last_message_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Messages
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('customer', 'bot', 'agent')),
  sender_id UUID,
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Analytics logs
CREATE TABLE public.analytics_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Demand predictions
CREATE TABLE public.demand_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  prediction_date DATE NOT NULL,
  predicted_quantity INT NOT NULL DEFAULT 0,
  confidence NUMERIC(5, 2),
  model_version TEXT DEFAULT 'v1_moving_avg',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Indexes
CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX idx_profiles_business_id ON public.profiles(business_id);
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_business_id ON public.user_roles(business_id);
CREATE INDEX idx_customers_business_id ON public.customers(business_id);
CREATE INDEX idx_products_business_id ON public.products(business_id);
CREATE INDEX idx_orders_business_id ON public.orders(business_id);
CREATE INDEX idx_orders_customer_id ON public.orders(customer_id);
CREATE INDEX idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX idx_conversations_business_id ON public.conversations(business_id);
CREATE INDEX idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX idx_analytics_logs_business_id ON public.analytics_logs(business_id);
CREATE INDEX idx_demand_predictions_business_id ON public.demand_predictions(business_id);
-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now();
RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;
-- Apply updated_at triggers
CREATE TRIGGER update_businesses_updated_at BEFORE
UPDATE ON public.businesses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE
UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_customers_updated_at BEFORE
UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE
UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE
UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_conversations_updated_at BEFORE
UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
-- Helper: check role (SECURITY DEFINER to bypass RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role) RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  ) $$;
-- Helper: get current user's business_id
CREATE OR REPLACE FUNCTION public.current_user_business_id() RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
SELECT business_id
FROM public.profiles
WHERE user_id = auth.uid()
LIMIT 1 $$;
-- Helper: check if user is owner or admin in their business
CREATE OR REPLACE FUNCTION public.is_business_admin(_user_id UUID) RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('owner', 'admin')
  ) $$;
-- ===================== ENABLE RLS =====================
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demand_predictions ENABLE ROW LEVEL SECURITY;
-- ===================== RLS POLICIES =====================
-- BUSINESSES
CREATE POLICY "Users can view own business" ON public.businesses FOR
SELECT TO authenticated USING (id = public.current_user_business_id());
CREATE POLICY "Owners can update business" ON public.businesses FOR
UPDATE TO authenticated USING (
    id = public.current_user_business_id()
    AND public.has_role(auth.uid(), 'owner')
  );
-- PROFILES
CREATE POLICY "Users can view profiles in their business" ON public.profiles FOR
SELECT TO authenticated USING (business_id = public.current_user_business_id());
CREATE POLICY "Users can insert own profile" ON public.profiles FOR
INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own profile" ON public.profiles FOR
UPDATE TO authenticated USING (
    user_id = auth.uid()
    AND business_id = public.current_user_business_id()
  );
-- USER_ROLES
CREATE POLICY "Users can view roles in their business" ON public.user_roles FOR
SELECT TO authenticated USING (business_id = public.current_user_business_id());
CREATE POLICY "Users can insert own role during signup" ON public.user_roles FOR
INSERT TO authenticated WITH CHECK (user_id = auth.uid());
-- CUSTOMERS
CREATE POLICY "Business members can view customers" ON public.customers FOR
SELECT TO authenticated USING (business_id = public.current_user_business_id());
CREATE POLICY "Admins+ can create customers" ON public.customers FOR
INSERT TO authenticated WITH CHECK (
    business_id = public.current_user_business_id()
    AND public.is_business_admin(auth.uid())
  );
CREATE POLICY "Admins+ can update customers" ON public.customers FOR
UPDATE TO authenticated USING (
    business_id = public.current_user_business_id()
    AND public.is_business_admin(auth.uid())
  );
CREATE POLICY "Owners can delete customers" ON public.customers FOR DELETE TO authenticated USING (
  business_id = public.current_user_business_id()
  AND public.has_role(auth.uid(), 'owner')
);
-- PRODUCTS
CREATE POLICY "Business members can view products" ON public.products FOR
SELECT TO authenticated USING (business_id = public.current_user_business_id());
CREATE POLICY "Admins+ can create products" ON public.products FOR
INSERT TO authenticated WITH CHECK (
    business_id = public.current_user_business_id()
    AND public.is_business_admin(auth.uid())
  );
CREATE POLICY "Admins+ can update products" ON public.products FOR
UPDATE TO authenticated USING (
    business_id = public.current_user_business_id()
    AND public.is_business_admin(auth.uid())
  );
CREATE POLICY "Owners can delete products" ON public.products FOR DELETE TO authenticated USING (
  business_id = public.current_user_business_id()
  AND public.has_role(auth.uid(), 'owner')
);
-- ORDERS
CREATE POLICY "Business members can view orders" ON public.orders FOR
SELECT TO authenticated USING (business_id = public.current_user_business_id());
CREATE POLICY "Admins+ can create orders" ON public.orders FOR
INSERT TO authenticated WITH CHECK (business_id = public.current_user_business_id());
CREATE POLICY "Admins+ can update orders" ON public.orders FOR
UPDATE TO authenticated USING (business_id = public.current_user_business_id());
CREATE POLICY "Owners can delete orders" ON public.orders FOR DELETE TO authenticated USING (
  business_id = public.current_user_business_id()
  AND public.has_role(auth.uid(), 'owner')
);
-- ORDER_ITEMS
CREATE POLICY "View order items via order" ON public.order_items FOR
SELECT TO authenticated USING (
    order_id IN (
      SELECT id
      FROM public.orders
      WHERE business_id = public.current_user_business_id()
    )
  );
CREATE POLICY "Create order items" ON public.order_items FOR
INSERT TO authenticated WITH CHECK (
    order_id IN (
      SELECT id
      FROM public.orders
      WHERE business_id = public.current_user_business_id()
    )
  );
CREATE POLICY "Update order items" ON public.order_items FOR
UPDATE TO authenticated USING (
    order_id IN (
      SELECT id
      FROM public.orders
      WHERE business_id = public.current_user_business_id()
    )
  );
CREATE POLICY "Delete order items" ON public.order_items FOR DELETE TO authenticated USING (
  order_id IN (
    SELECT id
    FROM public.orders
    WHERE business_id = public.current_user_business_id()
  )
  AND public.has_role(auth.uid(), 'owner')
);
-- CONVERSATIONS
CREATE POLICY "View conversations" ON public.conversations FOR
SELECT TO authenticated USING (business_id = public.current_user_business_id());
CREATE POLICY "Create conversations" ON public.conversations FOR
INSERT TO authenticated WITH CHECK (business_id = public.current_user_business_id());
CREATE POLICY "Update conversations" ON public.conversations FOR
UPDATE TO authenticated USING (business_id = public.current_user_business_id());
CREATE POLICY "Delete conversations" ON public.conversations FOR DELETE TO authenticated USING (
  business_id = public.current_user_business_id()
  AND public.has_role(auth.uid(), 'owner')
);
-- MESSAGES
CREATE POLICY "View messages" ON public.messages FOR
SELECT TO authenticated USING (
    conversation_id IN (
      SELECT id
      FROM public.conversations
      WHERE business_id = public.current_user_business_id()
    )
  );
CREATE POLICY "Create messages" ON public.messages FOR
INSERT TO authenticated WITH CHECK (
    conversation_id IN (
      SELECT id
      FROM public.conversations
      WHERE business_id = public.current_user_business_id()
    )
  );
-- ANALYTICS_LOGS
CREATE POLICY "View analytics" ON public.analytics_logs FOR
SELECT TO authenticated USING (business_id = public.current_user_business_id());
CREATE POLICY "Create analytics" ON public.analytics_logs FOR
INSERT TO authenticated WITH CHECK (business_id = public.current_user_business_id());
-- DEMAND_PREDICTIONS
CREATE POLICY "View predictions" ON public.demand_predictions FOR
SELECT TO authenticated USING (business_id = public.current_user_business_id());
-- Enable realtime for conversations and messages
ALTER PUBLICATION supabase_realtime
ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime
ADD TABLE public.messages;
-- Auto-create business + profile + role on signup via trigger
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE new_business_id UUID;
BEGIN -- Create a new business for every signup
INSERT INTO public.businesses (name)
VALUES (
    COALESCE(
      NEW.raw_user_meta_data->>'business_name',
      'My Business'
    )
  )
RETURNING id INTO new_business_id;
-- Create profile
INSERT INTO public.profiles (user_id, business_id, full_name)
VALUES (
    NEW.id,
    new_business_id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
-- Assign owner role
INSERT INTO public.user_roles (user_id, business_id, role)
VALUES (NEW.id, new_business_id, 'owner');
RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
AFTER
INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();