# SmartBiz AI Connect

SmartBiz AI Connect is a futuristic AI-powered business automation engine that integrates WhatsApp, Supabase, and Gemini AI to automate product discovery, order management, and customer notifications.

## 🚀 Key Features

- **Visual Product Search**: Customers can send a photo of a product to the WhatsApp bot, and it automatically identifies the item in your catalog using Gemini 2.0 Vision.
- **Automated Order Processing**: Intent-based AI extraction of product names and quantities from natural language messages.
- **Real-time Status Notifications**: Automatic WhatsApp alerts whenever an order status is updated (e.g., from "Pending" to "Out for Delivery").
- **Payment Verification**: AI-powered bank receipt verification to confirm transfers automatically.
- **Business Dashboard**: A sleek, modern React dashboard to manage products, orders, and customer conversations.

---

## 👥 Professional Roles & Contributions

This project highlights a multidisciplinary approach to building modern AI-driven enterprise solutions:

### **Business Analyst Role**

*Precision in Business Logic & Digital Transformation*

- **Strategy & Mapping**: Defined the end-to-end customer journey on WhatsApp to ensure a frictionless "Chat-to-Checkout" experience.
- **Requirement Engineering**: Bridged the gap between business needs and technical execution, ensuring the automated order flow aligns with standard retail operations.
- **Value Optimization**: Focused on reducing manual overhead by automating order status notifications and bank receipt verification processes.

### **AI Software Engineer Role**

*Innovation in Multi-modal AI & Orchestration*

- **Visual Intelligence**: Implemented **Gemini 2.0 Vision** models via OpenRouter, utilizing "Chain-of-Thought" prompting for high-accuracy product identification.
- **System Orchestration**: Architected the background processing logic using **EdgeRuntime.waitUntil** to handle heavy AI tasks without violating messaging server timeouts.
- **Full-Stack AI Integration**: Developed the secure integration between Supabase (PostgreSQL), Deno Edge Functions, and the WhatsApp Business API.

---

## 🛠️ Tech Stack

- **Frontend**: React, TypeScript, Vite, Tailwind CSS, Lucide Icons, Framer Motion.
- **Backend/Infrastructure**: Supabase (PostgreSQL), Edge Functions (Deno).
- **Messaging**: WhatsApp Business Platform (Meta Graph API).
- **AI Model**: Gemini 2.0 Flash / Pro (via OpenRouter).
- **Styling**: Shadcn/UI for premium, responsive design.

---

## 🏗️ Getting Started (Start-to-End Guidance)

### 1. Prerequisites

- [Node.js](https://nodejs.org/) (Latest LTS)
- [Supabase CLI](https://supabase.com/docs/guides/cli) installed and authenticated.
- A Meta Developer account with a WhatsApp Business phone number set up.

### 2. Project Setup

Clone the repository and install dependencies:

```bash
git clone https://github.com/kavishkat2002/smartbiz-ai-connect.git
cd smartbiz-ai-connect
npm install
```

### 3. Database & Secret Configuration

Initialize Supabase and push the schema:

```bash
supabase link --project-ref your_project_id
supabase db push
```

Set the required environment variables for the AI and Messaging components:

```bash
supabase secrets set WHATSAPP_API_TOKEN="..."
supabase secrets set WHATSAPP_PHONE_NUMBER_ID="..."
supabase secrets set OPENROUTER_API_KEY="..."
```

### 4. Deploying Edge Functions

The bot logic resides in Supabase Edge Functions. Deploy them using:

```bash
supabase functions deploy whatsapp-webhook --no-verify-jwt
supabase functions deploy send-order-notification --no-verify-jwt
```

### 5. Config WhatsApp Webhook

1. Go to your Meta Developer Dashboard -> WhatsApp -> Configuration.
2. Set the Webhook URL to: `https://your_project_ref.supabase.co/functions/v1/whatsapp-webhook`
3. Verify with your custom token (as set in the code).

### 6. Local Development (Frontend)

Run the project locally to view the dashboard:

```bash
npm run dev
```

---

## 📦 Project Structure

- `/src`: The React frontend application.
- `/supabase/functions`: Deno Edge Functions for the WhatsApp bot and notifications.
- `/supabase/migrations`: SQL migrations for the automated order triggers.
- `tailwind.config.ts`: Modern design tokens and theming.

## 🤝 Contribution

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## 📄 License

[MIT](https://choosealicense.org/licenses/mit/)
