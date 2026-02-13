# SmartBiz AI Bot Flow Documentation (v2 AI)

This document outlines the conversational commerce flow implemented in the Telegram/WhatsApp bot.

## 1. User Journey Overview

The bot functions as an AI Sales Assistant, capable of handling the entire sales funnel from greeting to payment confirmation without human intervention.

### Core States

1. **Browsing**: The default state where users check catalogs and add items.
2. **Checkout**: A guided step-by-step process (Method -> Details -> Payment).
3. **Verification**: AI analysis of payment receipts.

---

## 2. Detailed Interaction Flow

### A. Greeting & Discovery

- **User**: "Hi", "Hello", "/start"
- **Bot**: *"👋 Welcome to [Business Name] (v2 AI)! I can help you with Catalog, Cart, or Tracking..."*
- **User**: "Show me products" or "Catalog"
- **Bot**: Displays a list of top 10 products with prices.

### B. Natural Language Shopping (The "Brain")

Instead of clicking buttons, users can speak naturally.

- **User**: *"I want 2 kg sugar and 5 packets of cream crackers"*
- **Bot (AI)**:
    1. Analyzes text to extract items.
    2. Matches with database inventory.
    3. Updates the virtual cart.
    4. **Reply**: *"🛒 Added: 2 kg Sugar, 5 packets Cream Crackers. Reply 'Checkout' when ready."*

### C. Cart Management

- **User**: "View cart" or "Check basket"
- **Bot**: Shows itemized list and total price.

### D. Checkout Process

The bot enters a strict mode to guide the user.

**Step 1: Delivery Method**

- **User**: "Checkout"
- **Bot**: *"🚚 How would you like to receive your order? Reply 'Delivery' or 'Pickup'."*

**Step 2: Contact Details**

- **User**: "Delivery"
- **Bot**: *"📍 Please enter your Name, Address, and Contact Number."*
- *(If Pickup selected: "👤 Please enter your Name and Contact Number.")*

**Step 3: Payment Method**

- **User**: "[Enters details]"
- **Bot**: *"💳 Choose payment: 'Card', 'Bank Transfer', or 'COD'?"*

### E. Payment Handling

**Option 1: Cash on Delivery (COD)**

- **User**: "COD"
- **Bot**: *"✅ Order #12345 Confirmed! We will contact you soon."* (End of flow)

**Option 2: Card**

- **User**: "Card"
- **Bot**: *"🔗 Here is your payment link: [Link]. Order Created!"*

**Option 3: Bank Transfer (AI Verified)**

- **User**: "Bank Transfer"
- **Bot**: *"🏦 Transfer [Amount] to [Bank Details]. 📸 Then UPLOAD your receipt here."*
- **State**: Bot waits specifically for a photo.

### F. Receipt Verification (AI Vision)

- **User**: [Uploads Photo]
- **Bot (AI)**:
    1. Scans image for Date, Amount, and Transaction Reference.
    2. **If Valid**: *"✅ Payment Verified! Order #12345 is CONFIRMED."*
    3. **If Invalid/Blurry**: *"⚠️ Could not verify receipt. Please upload a clear photo."*

---

## 3. Post-Purchase Features

### Order Tracking

- **User**: "Track #12345"
- **Bot**: *"📦 Order #12345 Status: CONFIRMED / SHIPPED"*

### Cancellation

- **User**: "Cancel order"
- **Bot**: *"🚫 Order cancelled. Cart reset."*

---

## 4. Admin View (Dashboard)

- Admins can see the entire conversation in real-time under the **Chat** tab.
- The bot's state (e.g., "cart_building", "awaiting_receipt") is stored in the database, allowing enabling/disabling of the AI at any point.
