
# Creative Lab – SmartBiz AI

## Overview
An AI-powered multi-tenant SaaS platform for automated sales, customer management, and analytics. Built with React + Supabase with a modern dashboard UI.

---

## Phase 1: Foundation & Multi-Tenant Architecture

### Authentication & Tenant System
- Email/password signup and login with Supabase Auth
- Business registration flow — each signup creates a new "business" (tenant)
- Role-based access: Owner, Admin, Agent
- All data isolated per business via Row-Level Security

### Database Schema
- **businesses** — tenant profiles, WhatsApp config, settings
- **users** — linked to businesses with roles
- **customers** — CRM contacts per business
- **products** — product catalog per business
- **orders** — order tracking with status and payment info
- **conversations** — WhatsApp message logs
- **analytics_logs** — event tracking for dashboards
- **demand_predictions** — AI forecast results

---

## Phase 2: Dashboard & CRM

### Owner Dashboard (Home)
- Revenue today, orders today, active conversations, missed leads cards
- Quick-action buttons for common tasks
- Recent activity feed

### Sales Analytics Page
- Revenue trend line charts
- Product performance breakdown
- Order volume over time
- Conversion rate metrics

### Customer Management (CRM)
- Customer list with search and filters
- Customer detail view: purchase history, conversations, tags
- High-value and repeat customer identification
- Lead categorization (hot/warm/cold)

### Order Management
- Order list with status filters (pending, confirmed, shipped, delivered)
- Order detail with items, payment status, customer info
- Manual status override capability

### Product Catalog
- Add/edit/delete products
- Product categories and pricing
- Stock level tracking

---

## Phase 3: WhatsApp Automation Engine

### Webhook & Messaging Infrastructure
- Supabase Edge Function to receive WhatsApp webhooks from your provider
- Incoming message processing and storage
- Outbound message sending via provider API

### AI-Powered Auto-Replies
- AI intent detection using Lovable AI (Gemini model)
- Automated product recommendations based on customer messages
- Guided order flow: collect name, phone, address, product, quantity
- Payment link generation placeholder

### Conversation Management UI
- Live conversation view in dashboard
- Human takeover mode toggle
- Escalation tagging for complex queries
- Conversation history per customer

---

## Phase 4: AI Features

### AI Sales Assistant
- Product recommendations based on customer history
- Upsell suggestions during conversations
- Lead scoring and categorization

### AI Demand Prediction (V1)
- Moving average forecasting on order data
- Weekly demand estimates per product
- Low-stock alerts based on predicted demand
- Architecture ready for future Python ML microservice integration

### AI Analytics Insights
- Natural language summaries of daily performance
- Anomaly detection on revenue/orders
- Most demanded product identification

---

## Phase 5: Settings & Configuration

### Business Settings
- Business profile (name, logo, contact info)
- WhatsApp API configuration (provider credentials, webhook URL)
- Team member management (invite/remove users, assign roles)

### Subscription Plans UI (Visual Only)
- Starter / Growth / Pro plan display
- Feature comparison table
- Upgrade flow placeholder (Stripe integration later)
- Feature gating structure in code (ready for real billing)

### Voice AI Preparation
- Backend structure for future Twilio call webhooks
- Placeholder endpoints for voice transcription and AI reply
- Database tables for call logs and summaries

---

## Design & UX
- Clean, modern SaaS dashboard inspired by Linear/Notion
- Dark and light theme support
- Sidebar navigation with collapsible sections
- Mobile responsive layout
- Professional data visualization with Recharts
