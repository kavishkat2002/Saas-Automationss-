# Order Management System - Setup Guide

## Overview

We have enhanced the Order Management System to allow full control over orders and automated customer notifications.

## Features Added

1. **Detailed Order View**
    - View customer details (Name, Phone, Address, Email)
    - View ordered items and total

2. **Order Status Management**
    - New Statuses supported:
        - ✅ Confirmed
        - 📦 Order Packed
        - 🛍️ Ready for Pickup
        - 🚚 Out for Delivery / Handed Over
        - 🚚 Shipped
        - 🎉 Delivered
        - ❌ Cancelled
    - **Custom Messages:** You can add a personal note (e.g., "Left at front door") which will be sent to the customer.

3. **Automated Bot Notifications**
    - When you update an order status, the bot **instantly** sends a message to the customer on Telegram.
    - The message includes the new status, your custom note, and order details.

4. **Order Deletion**
    - Admins can now delete orders if necessary.

---

## 🚀 Deployment Steps (Required)

To make the notifications work, you must deploy the new Edge Function.

### 1. Deploy the "Send Notification" Function

Open your terminal and run:

```bash
supabase functions deploy send-order-notification
```

This updates the cloud function that handles sending messages.

### 2. Set Up Environment Variables (If not already set)

Ensure your Telegram Bot Token is set in Supabase secrets:

```bash
supabase secrets set TELEGRAM_BOT_TOKEN="your_bot_token_here"
```

### 3. Database Updates

The database has already been updated with the new status options via the migration `20260213123500_update_order_status_enum.sql`.

---

## How to Use

1. Go to the **Orders** page in your dashboard.
2. Click on any order row (or the "Eye" icon).
3. A "Manage Order" dialog will open.
    - **View Details:** See customer and item info on the left.
    - **Update Status:** Select a new status from the dropdown.
    - **Add Note:** Type a custom message for the customer.
    - **Update:** Click "Update Status & Notify".
4. The customer will immediately receive a formatted message on Telegram.

## Troubleshooting

- **Notification Failed?**
  - Check if the customer has a valid Telegram phone number triggered via the bot (starts with `telegram:`).
  - Check if `TELEGRAM_BOT_TOKEN` is set correctly in Supabase secrets.
  - Check Edge Function logs via specific Supabase dashboard or CLI: `supabase functions logs -f send-order-notification`.
