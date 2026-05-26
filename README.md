# VMS Inventory Management System

A secure, mobile-optimized Progressive Web App (PWA) for Heavy-Duty Truck Parts Warehouse inventory management with offline capabilities, barcode scanning, and immutable audit trails.

---

## 🔍 Overview

This platform provides comprehensive inventory management for high-value tools, tires, hazardous liquids/oils, and mechanical consumables. It features role-based access control, real-time analytics, and industrial warehouse operations support.

---

## � Key Features

* **Role-Based Access Control (RBAC)** - Four distinct roles: Super Admin, Admin, Fleet Dispatch, and Warehouse Staff
* **Immutable Audit Trail** - Database-level triggers capture all changes with impersonation tracking
* **PWA with Offline Support** - IndexedDB queue syncs automatically when connection restores
* **Barcode/QR Scanning** - Native device camera integration for mobile operations
* **Blind Stock-Takes** - System quantities hidden during physical audits to prevent fraud
* **Tool Custody Tracking** - High-value tool check-in/out with condition logging
* **Directed Picking Routes** - Automatic zone/bin sorting for efficient warehouse navigation
* **Core Charge Management** - Track manufacturer core charge returns
* **Bin Weight Capacity Alerts** - Safety warnings for heavy bulk items
* **Advanced Analytics** - Recharts dashboards for inventory trends, loss tracking, and tool status

---

## 🔐 Security Features

* Row-Level Security (RLS) on all database tables
* Immutable `activity_logs` table (UPDATE/DELETE blocked)
* "View As" impersonation with audit trail
* Photographic evidence required for scrap/damage logging
* IP address and user agent tracking for all actions

---

## �️ Technology Stack

* **Frontend**: Next.js 14 (App Router), React 18
* **Styling**: Tailwind CSS, Shadcn UI components
* **Icons**: Lucide React
* **Database**: Supabase (PostgreSQL with RLS)
* **Authentication**: Supabase Auth
* **PWA**: Service workers with offline sync
* **Scanning**: html5-qrcode for native camera access
* **Offline Storage**: Dexie.js (IndexedDB wrapper)
* **Visualization**: Recharts for analytics dashboards

---

## 📦 Database Schema

### Core Tables
* `profiles` - User profiles with RBAC roles
* `suppliers` - Supplier management
* `bin_locations` - Warehouse zones with weight capacity
* `unit_conversions` - Stocking unit to issuing unit rules
* `products` - Inventory items with industrial fields
* `tool_loans` - Reusable tool custody tracking
* `receiving_documents` - Goods in workflow
* `receiving_items` - Receiving line items
* `stock_movements` - All inventory transactions
* `stock_takes` - Audit sessions
* `stock_take_items` - Blind count records
* `activity_logs` - Immutable audit trail

---

## 🚀 Getting Started

### Prerequisites
* Node.js 18+ installed
* Supabase project created
* Supabase CLI installed (optional, for type generation)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
```bash
cp .env.example .env
```
Edit `.env` with your Supabase credentials:
```
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

3. Run database migrations:
```bash
# Using Supabase CLI
supabase db push

# Or manually run the migration files in supabase/migrations/
```

4. Generate TypeScript types (optional):
```bash
npm run supabase:generate-types
```

5. Start development server:
```bash
npm run dev
```

6. Open http://localhost:3000

---

## � Project Structure

```
vms-inventory/
├── app/                      # Next.js App Router
│   ├── (auth)/              # Authentication routes
│   ├── (dashboard)/         # Dashboard routes by role
│   ├── api/                 # API routes
│   ├── layout.tsx           # Root layout
│   └── page.tsx             # Home page
├── components/              # React components
│   ├── ui/                  # Shadcn UI components
│   ├── inventory/           # Inventory components
│   ├── scanning/            # Barcode scanning components
│   ├── charts/              # Recharts visualization components
│   └── mobile/              # Mobile-optimized components
├── lib/                     # Core libraries
│   ├── supabase/            # Supabase clients and queries
│   ├── offline/             # IndexedDB and sync logic
│   ├── hooks/               # Custom React hooks
│   └── utils/               # Utility functions
├── public/                  # Static assets
│   ├── manifest.json        # PWA manifest
│   ├── sw.js                # Service worker
│   └── icons/               # App icons
└── supabase/                # Database migrations
    └── migrations/          # SQL migration files
```

---

## 🔧 Available Scripts

* `npm run dev` - Start development server
* `npm run build` - Build for production
* `npm start` - Start production server
* `npm run lint` - Run ESLint
* `npm run type-check` - Run TypeScript type checking
* `npm run supabase:generate-types` - Generate TypeScript types from Supabase schema

---

## 📱 PWA Features

* **Add to Home Screen** - Install as native app on mobile devices
* **Offline Mode** - Continue working without internet connection
* **Background Sync** - Automatically sync when connection restores
* **Push Notifications** - (Future) Alerts for low stock and overdue tools

---

## 🎯 User Roles

### Super Admin / Owner
* Full system administration
* User management and impersonation
* Financial/scrap/fraud reports
* Raw activity ledger access

### Admin / Parts Manager
* Full inventory control
* Restock approvals
* Scrap/waste authorization
* Supplier purchase order management
* Tool custody audit review

### Fleet Dispatch / Mechanic
* Mobile-optimized interface
* Tool check-in/out
* Parts logging against work orders
* Current stock level viewing

### Warehouse Picker / Staff
* Mobile-optimized interface
* Barcode scanning for receiving
* Sequential picking by location
* Physical blind stock-takes

---

## 📊 Industrial Features

### Unit Conversion
* Supports DECIMAL(15,4) for precise fluid volumes
* Distinguishes between stocking unit (Drum/Bulk) and issuing unit (Liter/Quart)
* Conversion rules stored in database

### Tool Custody
* High-value tool tracking
* Check-out/in with condition logging
* Overdue tool alerts
- Expected return date tracking

### Directed Picking
* Automatic sorting by zone and bin_location
* Prevents warehouse floor zigzagging
* Optimized pick list generation

### Core Charge Returns
* Flags parts with manufacturer core charges
- Tracks return status for credit recovery

### Bin Weight Capacity
* Maximum weight threshold per bin
* Safety warnings for heavy bulk items
* Prevents over-weight routing

### Goods In Workflow
* Scan against supplier inventory notes
* Record short-shipments and overages
* Capture damage reports on arrival

---

## 📫 Contact

**Kurt Jonathan**
📧 [esoken92@gmail.com](mailto:esoken92@gmail.com)

---

© 2026 VMS Inventory Management. All rights reserved.
