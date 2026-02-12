# SmartBiz AI Connect - Automation Roadmap

## ✅ COMPLETED (Working Now!)

### 1. Dashboard - Business Health ✅

- Real-time revenue tracking (today + monthly)
- Conversion rate analytics
- Pending orders monitoring
- Unanswered messages tracking
- Top selling product identification
- AI Activity Feed with intelligent insights

### 2. AI Insights Page - FULLY FUNCTIONAL ✅

**Now includes real analytics:**

- 📈 Weekly Sales Forecast (moving average prediction)
- 🔁 Repeat Customer Rate (retention metrics)
- 💰 Average Order Value
- 📦 Low Stock Alerts (automatic detection)
- 👑 High Value Customer Identification (Rs. 5000+ threshold)
- 🎯 Product Demand Ranking (by units sold)
- 💬 AI-generated Performance Summaries

### 3. Products Module ✅

- Full CRUD operations
- Image URL support
- Stock tracking
- Category management
- Real-time dashboard updates

### 4. Customers Module ✅  

- Full CRUD operations
- Lead status tracking (hot/warm/cold)
- Total spent & order count tracking
- AI lead detection logging

### 5. Orders Module ✅

- Complete order creation system
- Multi-product orders with quantities
- Automatic customer stats updates
- AI activity logging
- Real-time total calculation

### 6.Architecture - Multi-Tenancy ✅

**VERIFIED:** All tables include `business_id`:

- ✅ businesses
- ✅ profiles
- ✅ user_roles
- ✅ customers
- ✅ products
- ✅ orders
- ✅ order_items
- ✅ conversations
- ✅ messages
- ✅ analytics_logs
- ✅ demand_predictions

**RLS Policies:** All configured for business isolation

---

## 🔥 NEXT PHASE: AUTOMATION ENGINE

### STEP 3: WhatsApp Cloud API Integration

#### What You Need

1. **WhatsApp Business Account** (Meta Business Suite)
2. **Phone Number ID** from Meta
3. **API Access Token** from Meta Developer Portal
4. **Webhook Verification Token** (you create this)

#### Architecture

```
Customer WhatsApp → Meta Cloud API → Supabase Edge Function (Webhook) → Database → Dashboard
```

#### Implementation Plan

**Backend (Supabase Edge Functions):**

Create `/supabase/functions/whatsapp-webhook/index.ts`:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  // 1. Webhook verification (GET request from Meta)
  if (req.method === 'GET') {
    const url = new URL(req.url)
    const mode = url.searchParams.get('hub.mode')
    const token = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')
    
    if (mode === 'subscribe' && token === Deno.env.get('WEBHOOK_VERIFY_TOKEN')) {
      return new Response(challenge, { status: 200 })
    }
    return new Response('Forbidden', { status: 403 })
  }
  
  // 2. Handle incoming messages (POST)
  const payload = await req.json()
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
  
  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      const message = change.value.messages?.[0]
      if (!message) continue
      
      const phone = message.from
      const text = message.text?.body || ''
      const businessId = 'YOUR_BUSINESS_ID' // Get from webhook metadata
      
      // 3. Find or create customer
      let { data: customer } = await supabase
        .from('customers')
        .select('*')
        .eq('business_id', businessId)
        .eq('phone', phone)
        .single()
      
      if (!customer) {
        const { data: newCustomer } = await supabase
          .from('customers')
          .insert({
            business_id: businessId,
            name: message.profile?.name || `Customer ${phone}`,
            phone,
            lead_status: 'warm'
          })
          .select()
          .single()
        
        customer = newCustomer
        
        // Log new lead
        await supabase.from('analytics_logs').insert({
          business_id: businessId,
          event_type: 'New lead detected from WhatsApp',
          event_data: { customer_id: customer.id, phone }
        })
      }
      
      // 4. Find or create conversation
      let { data: conversation } = await supabase
        .from('conversations')
        .select('*')
        .eq('business_id', businessId)
        .eq('customer_id', customer.id)
        .eq('status', 'active')
        .single()
      
      if (!conversation) {
        const { data: newConvo } = await supabase
          .from('conversations')
          .insert({
            business_id: businessId,
            customer_id: customer.id,
            channel: 'whatsapp',
            status: 'active'
          })
          .select()
          .single()
        
        conversation = newConvo
      }
      
      // 5. Save message
      await supabase.from('messages').insert({
        conversation_id: conversation.id,
        sender_type: 'customer',
        content: text,
        message_type: 'text'
      })
      
      // 6. AI: Detect intent and respond
      const intent = detectIntent(text)
      let aiResponse = ''
      
      if (intent === 'order') {
        aiResponse = 'I can help you place an order! What product are you interested in?'
      } else if (intent === 'catalog') {
        // Fetch products
        const { data: products } = await supabase
          .from('products')
          .select('name, price')
          .eq('business_id', businessId)
          .eq('is_active', true)
          .limit(5)
        
        aiResponse = 'Here are our products:\n' + 
          products.map(p => `${p.name} - Rs. ${p.price}`).join('\n')
      } else {
        aiResponse = 'Thanks for your message! An agent will respond shortly.'
      }
      
      // 7. Send AI response via WhatsApp API
      await sendWhatsAppMessage(phone, aiResponse)
      
      // 8. Save AI message
      await supabase.from('messages').insert({
        conversation_id: conversation.id,
        sender_type: 'bot',
        content: aiResponse,
        message_type: 'text'
      })
    }
  }
  
  return new Response('OK', { status: 200 })
})

function detectIntent(text: string): string {
  const lower = text.toLowerCase()
  if (lower.includes('order') || lower.includes('buy')) return 'order'
  if (lower.includes('catalog') || lower.includes('products') || lower.includes('price')) return 'catalog'
  return 'general'
}

async function sendWhatsAppMessage(phone: string, message: string) {
  const WHATSAPP_TOKEN = Deno.env.get('WHATSAPP_API_TOKEN')
  const PHONE_NUMBER_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')
  
  await fetch(`https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: phone,
      text: { body: message }
    })
  })
}
```

**Deploy:**

```bash
supabase functions deploy whatsapp-webhook --no-verify-jwt
```

**Frontend Settings Page:**

Add WhatsApp configuration UI to store:

- Phone Number ID
- API Token
- Webhook URL (provided by Supabase)

---

### STEP 4: Settings Page Enhancement

**Current Status:** Basic settings page exists  
**Need to Add:**

1. **Business Info Section**
   - Logo upload
   - Business name
   - Contact details
   - Operating hours

2. **WhatsApp API Configuration**
   - Phone Number ID
   - API Token storage
   - Webhook URL display
   - Test connection button

3. **Team Management**
   - Invite team members (use existing user_roles table)
   - Assign roles: owner/admin/agent
   - View active team members

4. **Subscription Plan** (display only for now)
   - Current plan badge
   - Feature access status

---

### STEP 5: Stripe Subscription System

#### Database Changes Needed

Create new migration: `/supabase/migrations/add_subscriptions.sql`

```sql
-- Subscription tiers
CREATE TYPE subscription_tier AS ENUM ('starter', 'growth', 'pro');

-- Add subscription to businesses table
ALTER TABLE public.businesses 
ADD COLUMN subscription_tier subscription_tier DEFAULT 'starter',
ADD COLUMN subscription_status TEXT DEFAULT 'trialing',
ADD COLUMN stripe_customer_id TEXT,
ADD COLUMN stripe_subscription_id TEXT,
ADD COLUMN trial_ends_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '14 days');

-- Feature gates function
CREATE FUNCTION has_feature(
  feature_name TEXT,
  tier subscription_tier
) RETURNS BOOLEAN AS $$
BEGIN
  -- Starter: Basic features only
  IF tier = 'starter' THEN
    RETURN feature_name IN ('products', 'customers', 'orders');
  END IF;
  
  -- Growth: Add AI Insights
  IF tier = 'growth' THEN
    RETURN feature_name IN ('products', 'customers', 'orders', 'ai_insights', 'whatsapp');
  END IF;
  
  -- Pro: Everything
  IF tier = 'pro' THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;
```

#### Frontend Feature Gates

Create `/src/hooks/useSubscription.ts`:

```typescript
export function useSubscription() {
  const { businessId } = useBusiness()
  
  const { data: business } = useQuery({
    queryKey: ['business', businessId],
    queryFn: async () => {
      const { data } = await supabase
        .from('businesses')
        .select('subscription_tier, subscription_status, trial_ends_at')
        .eq('id', businessId)
        .single()
      return data
    }
  })
  
  const hasFeature = (feature: string) => {
    const tier = business?.subscription_tier || 'starter'
    
    if (tier === 'starter') {
      return ['products', 'customers', 'orders'].includes(feature)
    }
    if (tier === 'growth') {
      return ['products', 'customers', 'orders', 'ai_insights', 'whatsapp'].includes(feature)
    }
    return true // Pro has everything
  }
  
  const isTrialing = business?.subscription_status === 'trialing'
  const isActive = business?.subscription_status === 'active'
  
  return { hasFeature, isTrialing, isActive, tier: business?.subscription_tier }
}
```

#### Stripe Integration

**Supabase Edge Function:** `/supabase/functions/create-checkout/index.ts`

```typescript
import Stripe from 'https://esm.sh/stripe@13.0.0'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2023-10-16',
})

serve(async (req) => {
  const { priceId, businessId } = await req.json()
  
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    mode: 'subscription',
    success_url: `${req.headers.get('origin')}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${req.headers.get('origin')}/settings`,
    metadata: { business_id: businessId }
  })
  
  return new Response(JSON.stringify({ url: session.url }), {
    headers: { 'Content-Type': 'application/json' }
  })
})
```

**Pricing Page Component:**

```tsx
const plans = [
  {
    name: 'Starter',
    price: 'Rs. 999/mo',
    priceId: 'price_starter',
    features: ['Products', 'Customers', 'Orders', 'Basic Dashboard']
  },
  {
    name: 'Growth',
    price: 'Rs. 2,999/mo',
    priceId: 'price_growth',
    features: ['Everything in Starter', 'AI Insights', 'WhatsApp Integration', 'Analytics']
  },
  {
    name: 'Pro',
    price: 'Rs. 5,999/mo',
    priceId: 'price_pro',
    features: ['Everything in Growth', 'Demand Forecasting', 'Priority Support', 'Custom AI']
  }
]
```

---

## 🎯 IMPLEMENTATION PRIORITY

### Week 1: Automation Foundation ✅ DONE

- [x] Enhanced Dashboard
- [x] AI Insights with real data
- [x] Full CRUD for Products/Customers/Orders
- [x] AI Activity Logging

### Week 2: WhatsApp Integration 🔥 DO THIS NEXT

- [ ] Set up Meta Developer Account
- [ ] Create WhatsApp Business App
- [ ] Deploy Supabase Edge Function
- [ ] Add WhatsApp config to Settings page
- [ ] Test end-to-end message flow
- [ ] Add conversation UI

### Week 3: Subscription System

- [ ] Add subscription fields to database
- [ ] Integrate Stripe
- [ ] Create pricing page
- [ ] Implement feature gates
- [ ] Add billing history

### Week 4: Polish & Launch

- [ ] End-to-end testing
- [ ] Demo preparation
- [ ] Documentation
- [ ] First customer onboarding

---

## 🚀 QUICK START: WhatsApp Setup

### 1. Get WhatsApp Business API Access

1. Go to <https://developers.facebook.com/>
2. Create a new app → Select "Business" type
3. Add "WhatsApp" product
4. Get your Phone Number ID and Token
5. Add a test number for development

### 2. Deploy Webhook

```bash
cd supabase
supabase functions deploy whatsapp-webhook
# Save the URL: https://[project].supabase.co/functions/v1/whatsapp-webhook
```

### 3. Configure Webhook in Meta

1. Go to WhatsApp → Configuration
2. Enter your webhook URL + `/whatsapp-webhook`
3. Enter verification token (create a random string)
4. Subscribe to `messages` events

### 4. Test

Send a message to your WhatsApp Business number!

---

## 📊 Feature Gate Matrix

| Feature | Starter | Growth | Pro |
|---------|---------|--------|-----|
| Products CRUD | ✅ | ✅ | ✅ |
| Customers CRUD | ✅ | ✅ | ✅ |
| Orders System | ✅ | ✅ | ✅ |
| Dashboard | ✅ | ✅ | ✅ |
| AI Insights | ❌ | ✅ | ✅ |
| WhatsApp | ❌ | ✅ | ✅ |
| Demand Forecast | ❌ | ❌ | ✅ |
| Custom AI | ❌ | ❌ | ✅ |
| Team Members | 1 | 3 | Unlimited |

---

## ⚡ CRITICAL NEXT STEPS

### TODAY (Do This Now)

1. ✅ Test the AI Insights page - create orders and see analytics populate
2. ✅ Verify multi-tenancy (check that different users see different data)
3. 📝 Sign up for Meta Developer account
4. 📝 Apply for WhatsApp Business API access

### THIS WEEK

1. Deploy WhatsApp webhook
2. Test message → customer → conversation flow
3. Build Conversations UI page

### WITHIN 7 DAYS

1. Get 1 real business to test WhatsApp automation
2. Monitor AI activity logs
3. Iterate based on real usage

---

## 💡 Business Logic Enhancements

### Auto-Order Detection (AI Enhancement)

Add to WhatsApp webhook:

```typescript
// Detect order intent
if (text.toLowerCase().includes('order') || text.toLowerCase().includes('buy')) {
  // Extract product name using simple keyword matching
  const products = await fetchProducts(businessId)
  const matchedProduct = products.find(p => 
    text.toLowerCase().includes(p.name.toLowerCase())
  )
  
  if (matchedProduct) {
    // Auto-create order
    const order = await supabase.from('orders').insert({
      business_id: businessId,
      customer_id: customer.id,
      total_amount: matchedProduct.price,
      status: 'pending',
      payment_status: 'unpaid'
    }).select().single()
    
    // Log AI order creation
    await logAiOrderCompletion(businessId, order.id, matchedProduct.price)
    
    // Respond
    aiResponse = `Great! I've created an order for ${matchedProduct.name} (Rs. ${matchedProduct.price}). 
    Our team will contact you shortly to confirm payment and delivery.`
  }
}
```

---

## 🎓 Learning Resources

### WhatsApp Cloud API

- Docs: <https://developers.facebook.com/docs/whatsapp/cloud-api>
- Quick Start: <https://developers.facebook.com/docs/whatsapp/cloud-api/get-started>

### Supabase Edge Functions

- Docs: <https://supabase.com/docs/guides/functions>
- Examples: <https://github.com/supabase/supabase/tree/master/examples/edge-functions>

### Stripe

- Docs: <https://stripe.com/docs/billing/subscriptions/build-subscriptions>
- Test Cards: <https://stripe.com/docs/testing>

---

## ✅ You're Ready For Production When

- [x] Dashboard shows real-time metrics ✅
- [x] AI Insights generates actionable data ✅
- [x] Orders create → customer stats update → AI logs activity ✅
- [ ] WhatsApp messages create conversations automatically
- [ ] Basic AI responds to common queries
- [ ] Subscription system gates features properly
- [ ] Can demo full customer journey: WhatsApp → Order → Payment

**YOU ARE 60% THERE!** 🔥  
The foundation is SOLID. Focus on WhatsApp integration next to unlock real automation.
