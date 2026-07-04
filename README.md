# 🍽 Shawal's Deli — Restaurant Management System

A full-featured, production-ready restaurant management system built for Shawal's Deli, a Swahili Dishes restaurant in Nairobi, Kenya.

---

## 📸 Features

| Module | Description |
|---|---|
| **POS** | Fast point-of-sale with M-Pesa, Cash & Split bill |
| **Orders** | Real-time order management with status tracking |
| **Kitchen Display** | Live kitchen board (New → Preparing → Ready → Done) |
| **Tables** | Floor plan with occupancy, reservations |
| **Menu** | Full CRUD for items, categories, modifiers |
| **Inventory** | Stock tracking with low-stock alerts |
| **Purchases** | Purchase orders & supplier management |
| **Customers** | CRM with VIP tags, credit accounts |
| **Loyalty** | Points system with Bronze/Silver/Gold tiers |
| **Reports** | Daily/Weekly/Monthly analytics with charts |
| **Expenses** | Expense tracking with categories & budgets |
| **Staff** | Employee management with roles & permissions |
| **Scheduling** | Weekly shift calendar |
| **Settings** | System configuration |

---

## 🛠 Tech Stack

### Backend
- **Runtime**: Node.js 20 + TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL 16
- **Auth**: JWT (jsonwebtoken) + bcryptjs
- **Security**: Helmet, CORS, Rate limiting

### Frontend
- **Framework**: React 18 + TypeScript
- **Build**: Vite 5
- **Styling**: Tailwind CSS 3 (dark theme)
- **State**: Zustand + TanStack Query
- **Charts**: Recharts
- **Icons**: Lucide React
- **Routing**: React Router v6

### Infrastructure
- **Database**: PostgreSQL (local & production)
- **Containerization**: Docker + Docker Compose
- **Web Server**: Nginx (production)

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL 16+
- npm 9+

### 1. Clone & Install

```bash
git clone https://github.com/yourrepo/shawalsdeli.git
cd shawalsdeli

# Install root deps
npm install

# Install backend
cd backend && npm install && cd ..

# Install frontend
cd frontend && npm install && cd ..
```

### 2. Configure Environment

```bash
cd backend
cp .env.example .env
```

Edit `.env`:
```env
NODE_ENV=development
PORT=5000

DB_HOST=localhost
DB_PORT=5432
DB_NAME=shawalsdeli
DB_USER=postgres
DB_PASSWORD=your_password

JWT_SECRET=your_very_long_secret_key_here_minimum_32_chars
JWT_EXPIRES_IN=7d

FRONTEND_URL=http://localhost:5173
```

### 3. Setup Database

```bash
# Create database
psql -U postgres -c "CREATE DATABASE shawalsdeli;"

# Run migrations
npm run db:migrate

# Seed with sample data
npm run db:seed
```

### 4. Start Development

```bash
# Start both frontend and backend
npm run dev
```

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:5000
- **Health Check**: http://localhost:5000/health

### Default Login
```
Email: joseph.kimunya@shawalsdei.com
Password: password123
```

---

## 🐳 Docker Deployment

```bash
# Start all services
docker-compose up -d

# Run migrations inside container
docker exec shawalsdeli_api node dist/migrations/migrate.js
docker exec shawalsdeli_api node dist/seeders/seed.js

# View logs
docker-compose logs -f backend
```

Access at: http://localhost

---

## 📁 Project Structure

```
shawalsdeli/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── database.ts          # PostgreSQL pool config
│   │   ├── controllers/
│   │   │   ├── authController.ts    # Login, profile, password
│   │   │   ├── ordersController.ts  # Orders + payment processing
│   │   │   ├── menuController.ts    # Menu items + categories
│   │   │   ├── inventoryController.ts
│   │   │   ├── customersController.ts
│   │   │   ├── reportsController.ts # Daily/weekly/monthly reports
│   │   │   ├── expensesController.ts
│   │   │   ├── staffController.ts   # Staff + schedules
│   │   │   ├── tablesController.ts  # Tables + reservations
│   │   │   └── purchasesController.ts
│   │   ├── middleware/
│   │   │   ├── auth.ts              # JWT authentication
│   │   │   └── errorHandler.ts      # Global error handling
│   │   ├── migrations/
│   │   │   └── migrate.ts           # All 20+ database tables
│   │   ├── routes/
│   │   │   └── index.ts             # All API routes
│   │   ├── seeders/
│   │   │   └── seed.ts              # Realistic Kenyan restaurant data
│   │   └── server.ts                # Express app entry point
│   ├── .env.example
│   ├── Dockerfile
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── Sidebar.tsx      # Navigation sidebar
│   │   │   │   └── AppLayout.tsx    # Main layout wrapper
│   │   │   └── ui/
│   │   │       └── index.tsx        # Badge, StatCard, Modal, Pagination...
│   │   ├── lib/
│   │   │   ├── api.ts               # Axios client with interceptors
│   │   │   └── utils.ts             # formatCurrency, formatDate, etc.
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx        # Auth with Google sign-in UI
│   │   │   ├── POSPage.tsx          # Full POS with cart
│   │   │   ├── OrdersPage.tsx       # Orders management
│   │   │   ├── KitchenPage.tsx      # Kitchen kanban display
│   │   │   ├── TablesPage.tsx       # Floor plan + reservations
│   │   │   ├── MenuPage.tsx         # Menu CRUD with grid/list views
│   │   │   ├── ReportsPage.tsx      # Analytics with Recharts
│   │   │   └── OtherPages.tsx       # Expenses + placeholder pages
│   │   ├── store/
│   │   │   └── authStore.ts         # Zustand auth state
│   │   ├── App.tsx                  # Router setup
│   │   ├── main.tsx
│   │   └── index.css                # Tailwind + custom components
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.ts
│
├── docker-compose.yml
└── README.md
```

---

## 🔌 API Reference

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/login` | Login with email/password |
| GET | `/api/auth/profile` | Get current user profile |
| PUT | `/api/auth/change-password` | Change password |

### Orders
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/orders` | List orders (filterable) |
| GET | `/api/orders/:id` | Order detail with items |
| POST | `/api/orders` | Create new order |
| PUT | `/api/orders/:id/status` | Update order status |
| POST | `/api/orders/:id/payment` | Process payment |

### Menu
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/menu/items` | List menu items |
| GET | `/api/menu/categories` | List categories with counts |
| POST | `/api/menu/items` | Create menu item |
| PUT | `/api/menu/items/:id` | Update menu item |
| DELETE | `/api/menu/items/:id` | Delete menu item |

### Tables & Reservations
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/tables` | All tables with status |
| PUT | `/api/tables/:id/status` | Update table status |
| GET | `/api/tables/reservations` | List reservations |
| POST | `/api/tables/reservations` | Create reservation |

> All endpoints require `Authorization: Bearer <token>` header.

---

## 💳 Payment Methods

| Method | Implementation |
|---|---|
| **Cash** | Direct — mark payment as complete |
| **M-Pesa** | Safaricom Daraja API (STK Push) — configure in `.env` |
| **Split Bill** | Split amounts across multiple payment methods |

### M-Pesa Setup
```env
MPESA_CONSUMER_KEY=your_key
MPESA_CONSUMER_SECRET=your_secret
MPESA_SHORTCODE=174379
MPESA_PASSKEY=your_passkey
MPESA_CALLBACK_URL=https://yourdomain.com/api/payments/mpesa/callback
MPESA_ENV=sandbox   # change to 'production' for live
```

---

## 🔐 Role-Based Access

| Role | Permissions |
|---|---|
| `administrator` | Full access to all features |
| `manager` | All except system settings |
| `head_chef` | Kitchen display, orders, inventory |
| `cashier` | POS, orders, payments |
| `waiter` | POS, orders, tables |
| `kitchen_staff` | Kitchen display only |
| `cleaner` | Limited view |

---

## 📊 Database Schema

20+ tables covering:
- `users` — Staff with roles
- `menu_items` + `menu_categories` + `menu_modifiers`
- `inventory_items` + `inventory_transactions`
- `purchase_orders` + `purchase_order_items`
- `orders` + `order_items` + `payments`
- `customers` + `loyalty_points` + `loyalty_tiers`
- `restaurant_tables` + `reservations`
- `expenses` + `expense_categories`
- `staff_schedules` + `leave_requests`
- `notifications`

---

## 🧩 Extending the System

### Adding a new page
1. Create controller in `backend/src/controllers/`
2. Add routes in `backend/src/routes/index.ts`
3. Create page in `frontend/src/pages/`
4. Add route in `frontend/src/App.tsx`
5. Add nav link in `frontend/src/components/layout/Sidebar.tsx`

---

## 📄 License

MIT — Built for Shawal's Deli, Nairobi, Kenya 🇰🇪
