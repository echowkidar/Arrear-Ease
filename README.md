# ArrearEase — Government Salary Arrear Calculator

A professional web application for calculating and generating government employee salary arrear statements, built with **Next.js 15**, **Firebase**, and **Tailwind CSS**.

---

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Tech Stack](#tech-stack)
4. [Project Structure](#project-structure)
5. [Pages & Routes](#pages--routes)
6. [Core Modules](#core-modules)
7. [Data Models](#data-models)
8. [Allowance Calculation Logic](#allowance-calculation-logic)
9. [Authentication & Authorization](#authentication--authorization)
10. [Firestore Database](#firestore-database)
11. [Offline Support](#offline-support)
12. [Environment Variables](#environment-variables)
13. [Docker Deployment](#docker-deployment)
14. [Local Development](#local-development)
15. [Security](#security)

---

## Overview

**ArrearEase** is a domain-specific financial tool designed for government payroll officers and accounts departments. It automates the calculation of salary arrears — the difference between what an employee *was paid* and what they *should have been paid* — across a defined date range.

It supports both **6th Pay Commission (CPC)** and **7th Pay Commission (CPC)** rules, applies correct DA, HRA, NPA, and TA rates per month, and generates a clean, printable month-wise arrear statement.

---

## Features

### Arrear Calculator (Main Page)
- **Employee Profile Input** — Employee ID, Name, Designation, Department
- **Dual CPC Support** — Configure separately for 6th and 7th Pay Commission
- **Salary Components (Paid vs. To-Be-Paid)**:
  - Basic Pay with Pay Level selection
  - Dearness Allowance (DA) — auto-applied from rate master
  - House Rent Allowance (HRA) — DA-linked rate with minimum floor
  - Non-Practising Allowance (NPA) — date-range configurable
  - Transport Allowance (TA) — with double-TA option
  - Other Allowance (custom, named)
- **Fixed Rate Overrides** — Per allowance, override with a fixed % or amount for a custom date range
- **Annual Increment Engine** — Auto-increments basic pay each January/July per CPC pay matrix
- **Pay Refixation** — Set a refixed basic pay with an effective date
- **Fixed Basic Pay** — Override basic pay for a specific period
- **Statement Generation** — Month-wise table showing Drawn vs. Due vs. Difference
- **Print to PDF** — Browser print with a clean print-optimised layout
- **Save & Load Statements** — Cloud-sync via Firestore; local fallback via `localStorage`
- **History Panel** — Load/delete previously saved statements

### Admin Features
- **Rate Configuration Page** (`/rates`) — Admin-only; manage DA, HRA, NPA, TA rate masters for both 6th and 7th CPC
- **User Management Page** (`/users`) — Admin-only; view all registered users, edit display names, delete user data + all associated statements

### UX
- **Dark / Light Mode** toggle
- **Offline Mode** — Works without internet; syncs when reconnected
- **Real-time online status indicator**
- **Toast notifications** for all actions

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v3 + `tailwindcss-animate` |
| UI Components | Radix UI primitives (via shadcn/ui) |
| Forms | React Hook Form + Zod |
| Charts | Recharts |
| Date Utilities | date-fns |
| Backend / DB | Firebase Firestore |
| Authentication | Firebase Authentication |
| AI (optional) | Google Genkit (`@genkit-ai/googleai`) |
| State (global) | React Context API |
| Containerisation | Docker (multi-stage) + Docker Compose |
| Icons | Lucide React |

---

## Project Structure

```
Arrear-Ease/
├── docs/
│   └── blueprint.md              # Original app specification
├── public/                       # Static assets
├── src/
│   ├── ai/
│   │   ├── dev.ts                # Genkit dev entry
│   │   └── genkit.ts             # Genkit + Google AI plugin init
│   ├── app/
│   │   ├── globals.css           # Global CSS / Tailwind base
│   │   ├── layout.tsx            # Root layout (providers, fonts)
│   │   ├── page.tsx              # Main arrear calculator (home)
│   │   ├── rates/
│   │   │   └── page.tsx          # Admin: Rate Configuration
│   │   └── users/
│   │       └── page.tsx          # Admin: User Management
│   ├── components/
│   │   ├── auth-modals.tsx       # Sign-In / Sign-Up / Reset modal
│   │   ├── theme-provider.tsx    # next-themes wrapper
│   │   ├── theme-toggle.tsx      # Dark/Light toggle button
│   │   └── ui/                   # shadcn/ui component library
│   ├── context/
│   │   ├── auth-context.tsx      # Firebase Auth state + actions
│   │   └── rates-context.tsx     # Rate master state + Firestore sync
│   ├── hooks/
│   │   ├── use-mobile.tsx        # Responsive breakpoint hook
│   │   └── use-toast.ts          # Toast notification hook
│   └── lib/
│       ├── cpc-data.ts           # 6th & 7th CPC pay matrix tables
│       ├── firebase.ts           # Firebase init + exports
│       └── utils.ts              # `cn()` class merge utility
├── .env                          # Local environment variables (not committed)
├── .firebaserc                   # Firebase project binding
├── Dockerfile                    # Multi-stage production Docker image
├── docker-compose.yml            # Compose stack for VPS deployment
├── firebase.json                 # Firebase hosting config
├── firestore.rules               # Firestore security rules
├── next.config.ts                # Next.js config (headers, images)
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

---

## Pages & Routes

| Route | Access | Description |
|---|---|---|
| `/` | Public (read-only) / Auth (save/print) | Main arrear calculator |
| `/rates` | Admin only | Manage DA, HRA, NPA, TA rate masters |
| `/users` | Admin only | Manage registered user accounts |

> **Admin** is identified by the hardcoded email `amulivealigarh@gmail.com` in both the application code and Firestore security rules.

---

## Core Modules

### `src/app/page.tsx` — Arrear Calculator

The largest single file (~2,000 lines). Contains:

- **`formSchema`** (Zod) — Full validation schema for both the `paid` and `toBePaid` salary component sides, employee info, and the arrear date range.
- **`calculateMonthlyRow()`** — The core calculation engine. For each month in the arrear period it:
  1. Applies annual increment logic from the CPC pay matrix
  2. Checks for fixed basic pay overrides
  3. Calculates DA using the rate master (`daRates` / `da6thRates`)
  4. Calculates HRA (DA-linked for 7th CPC; fixed % on Basic+NPA for 6th CPC)
  5. Calculates NPA as a % of Basic Pay
  6. Applies TA (fixed amount, optionally doubled)
  7. Applies Other Allowance
  8. Returns `drawn` and `due` totals and their `difference`
- **`fetchSavedStatements()`** — Loads statements from Firestore (admin sees all; users see their own) with local fallback.
- **`syncLocalToServer()`** — Pushes locally-saved statements to Firestore on reconnection.
- **`handlePrint()`** — Requires authentication before allowing print.
- **`sanitizeForFirebase()`** — Recursively converts `Date` → `Timestamp` and strips `undefined` before writing to Firestore.

### `src/context/rates-context.tsx` — Rate Master

A React Context that:
- Loads rates from Firestore on mount (falls back to `localStorage`, then built-in defaults)
- Auto-saves to both `localStorage` and Firestore with a **1.5-second debounce** after any rate change
- Manages: `daRates`, `hraRates`, `npaRates`, `taRates`, `da6thRates`, `sixthCpcConfig`

### `src/context/auth-context.tsx` — Authentication

Wraps Firebase Auth and exposes:
- `signUpWithEmailPassword()` — Creates auth user + Firestore `/users/{uid}` document
- `signInWithEmailPassword()`
- `sendPasswordReset()`
- `logout()`
- `openAuthModal()` / `closeAuthModal()`
- Tracks `lastLogin` timestamp in Firestore on each session (once per session via `sessionLoginUpdated` flag)

### `src/lib/cpc-data.ts` — Pay Matrix

Contains the full pay matrix tables for both pay commissions:
- **7th CPC** — All pay levels (1–18) with their cell values used for annual increment lookup
- **6th CPC** — Pay bands and grade pays with increment progression
- **`default6thCpcDaRates`** — Built-in 6th CPC DA rates (Jan 2006 → Dec 2015) used as defaults

### `src/app/rates/page.tsx` — Rate Configuration

Admin-only page for managing the rate masters. Uses a reusable `RateTable` component that can be configured with optional columns:

| Rate Type | Special Columns |
|---|---|
| DA (7th CPC) | From Date, To Date, Rate % |
| HRA (7th CPC) | Effective Date, DA Rate Range, Rate %, Min Amount |
| NPA (7th CPC) | From Date, To Date, Rate % |
| TA (7th CPC) | Basic Range, Pay Level Range, Amount |
| DA (6th CPC) | From Date, Rate % |
| HRA/NPA (6th CPC) | Fixed % config card (HRA on Basic+NPA; NPA on Basic) |

---

## Data Models

### `ArrearFormData` (Zod-inferred)
```ts
{
  employeeId: string
  employeeName: string
  designation: string
  department: string
  fromDate: Date
  toDate: Date
  payFixationRef?: string
  paid: SalaryComponentSchema      // "What was paid"
  toBePaid: SalaryComponentSchema  // "What should be paid"
}
```

### `SalaryComponentSchema`
```ts
{
  cpc: "6th" | "7th"
  basicPay: number
  payLevel: string
  incrementMonth: "1" | "7"        // January or July
  incrementDate?: Date             // Specific increment date override

  fixedBasicPayApplicable: boolean
  fixedBasicPayValue?: number
  fixedBasicPayFromDate?: Date
  fixedBasicPayToDate?: Date

  daApplicable: boolean
  daFixedRateApplicable: boolean
  daFixedRate?: number             // Override DA rate for a period
  daFixedRateFromDate?: Date
  daFixedRateToDate?: Date

  hraApplicable: boolean
  hraFixedRateApplicable: boolean
  // ... similar from/to date + fixed rate fields for HRA, NPA, TA, Other
  
  refixedBasicPay?: number         // (toBePaid only) Pay refixation value
  refixedBasicPayDate?: Date
}
```

### `SavedStatement` (Firestore + localStorage)
```ts
{
  id: string
  savedAt: string            // ISO timestamp
  lastAccessedAt?: string
  rows: StatementRow[]
  totals: StatementTotals
  employeeInfo: Partial<ArrearFormData>
  userId?: string
  userName?: string
  userEmail?: string
  isLocal?: boolean          // true if not yet synced to Firestore
}
```

### `Rate` (Rate Master entry)
```ts
{
  id: string
  fromDate?: Date
  toDate?: Date
  rate: number               // % or fixed amount
  basicFrom?: number         // For TA: basic pay range
  basicTo?: number
  daRateFrom?: number        // For HRA: applicable DA range
  daRateTo?: number
  payLevelFrom?: string      // For TA: pay level range
  payLevelTo?: string
  minAmount?: number         // For HRA: minimum floor amount
}
```

---

## Allowance Calculation Logic

### DA (Dearness Allowance)
- Looks up `daRates` (7th CPC) or `da6thRates` (6th CPC) by month date
- Returns the most recent applicable rate for that month
- Applied as: `DA = basicPay × daRate / 100`
- Can be overridden with a **fixed rate** for a custom date range

### HRA (House Rent Allowance) — 7th CPC
- DA-linked: the current DA rate determines the HRA % tier
- Looks up `hraRates` by `effectiveDate` and `daRateFrom/To` range
- Applied as: `HRA = max(basicPay × hraRate / 100, minAmount)`
- Can be overridden with a fixed rate/amount

### HRA — 6th CPC
- Fixed percentage (default 20%) applied on `basicPay + npa`

### NPA (Non-Practising Allowance) — 7th CPC
- Looked up from `npaRates` by date range
- Applied as: `NPA = basicPay × npaRate / 100`

### NPA — 6th CPC
- Fixed percentage (default 25%) applied on `basicPay`

### TA (Transport Allowance) — 7th CPC
- Looked up from `taRates` by `basicPay` range and `payLevel` range
- Returns a fixed amount
- **Double TA** option multiplies the result by 2

### Annual Increment
- **7th CPC**: Looks up the next cell value in the pay level's value array
- **6th CPC**: Applies a 3% increment, rounded to the nearest 10
- Triggered every January (month 1) or July (month 7) depending on `incrementMonth`
- Specific `incrementDate` overrides general month-based triggering

---

## Authentication & Authorization

| Role | Email | Permissions |
|---|---|---|
| Admin | `amulivealigarh@gmail.com` | Full access: all pages, all users' statements, rate config |
| User | Any registered email | Own statements only; no access to `/rates` or `/users` |
| Guest | Not logged in | Can use calculator; cannot save or print |

**Auth Flow:**
1. Guest opens the app → can calculate but saving/printing triggers auth modal
2. Sign-up creates a Firebase Auth user + a `/users/{uid}` Firestore document
3. On each session, `lastLogin` is updated in Firestore (once per session)
4. Admin is detected client-side by email comparison and enforced server-side by Firestore rules

---

## Firestore Database

### Collections

#### `/users/{uid}`
```
email: string
displayName: string
phoneNumber: string
createdAt: Timestamp
lastLogin: Timestamp
```

#### `/savedStatements/{statementId}`
```
userId: string
userName: string
userEmail: string
savedAt: Timestamp
lastAccessedAt: Timestamp
employeeInfo: { ... }   // Partial ArrearFormData
rows: StatementRow[]
totals: StatementTotals
```

#### `/configurations/allRates`
```
daRates: Rate[]
hraRates: Rate[]
npaRates: Rate[]
taRates: Rate[]
da6thRates: Rate[]
sixthCpcConfig: { hra6thRate: number, npa6thRate: number }
```

### Security Rules Summary (`firestore.rules`)

```
/users/{userId}
  - read:   admin OR own document
  - write:  own document only
  - delete: admin only

/savedStatements/{statementId}
  - read:   admin OR document.userId == auth.uid
  - write:  admin OR request.resource.data.userId == auth.uid
  - delete: admin OR resource.data.userId == auth.uid

/configurations/{docId}
  - read:   any authenticated user
  - write:  admin only
```

---

## Offline Support

The app has a two-tier storage strategy:

1. **Primary** — Firebase Firestore with multi-tab IndexedDB persistence (`enableMultiTabIndexedDbPersistence`)
2. **Fallback** — `localStorage` for both saved statements and rate master data

**Sync Behaviour:**
- On app load: Firestore is tried first; `localStorage` is the fallback
- When offline: all operations use `localStorage`; statements are saved with `isLocal: true`
- On reconnection: `syncLocalToServer()` automatically pushes all `isLocal` statements to Firestore via a batch write
- Rate changes are debounced 1.5s then saved to both `localStorage` and Firestore

**localStorage Keys:**
| Key | Contents |
|---|---|
| `arrearEase_savedStatements` | Array of `SavedStatement` objects |
| `arrearEase_rates` | Full `AllRates` object |

---

## Environment Variables

Create a `.env` file in the project root (never commit this file):

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

> All variables are prefixed with `NEXT_PUBLIC_` and are baked into the client bundle at **build time**. They are passed as Docker build arguments (not runtime env vars) via `docker-compose.yml`.

---

## Docker Deployment

The production setup uses a **3-stage Docker build**:

| Stage | Base Image | Purpose |
|---|---|---|
| `deps` | `node:18-alpine` | Install npm dependencies |
| `builder` | `node:18-alpine` | Accept Firebase build args, run `next build` |
| `runner` | `node:18-alpine` | Minimal runtime image; runs `next start` |

The runner stage uses `USER node` (non-root) for security.

### `docker-compose.yml`

```yaml
services:
  arrear-ease:
    build:
      context: .
      args:              # Firebase config injected at build time from .env
        NEXT_PUBLIC_FIREBASE_API_KEY: ${NEXT_PUBLIC_FIREBASE_API_KEY}
        # ... other Firebase vars
    restart: unless-stopped
    ports:
      - "3000:3000"
    networks:
      - npm_network      # Connects to Nginx Proxy Manager external network
```

### Build & Run

```bash
# Build and start in detached mode
docker compose up -d --build

# View logs
docker compose logs -f

# Stop
docker compose down
```

> The container connects to an external Docker network `npm-network`, managed by **Nginx Proxy Manager** on the VPS for reverse-proxying and SSL termination.

---

## Local Development

### Prerequisites
- Node.js 18+
- npm

### Setup

```bash
# 1. Clone the repository
git clone <repo-url>
cd Arrear-Ease

# 2. Install dependencies
npm install

# 3. Create environment file
cp .env.example .env   # then fill in your Firebase credentials

# 4. Start the dev server (Turbopack, port 9003)
npm run dev
```

Open [http://localhost:9003](http://localhost:9003).

### Other Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server with Turbopack on port 9003 |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | ESLint check |
| `npm run typecheck` | TypeScript type check (no emit) |
| `npm run genkit:dev` | Start Genkit AI dev UI |
| `npm run genkit:watch` | Start Genkit with file watching |

---

## Security

| Control | Implementation |
|---|---|
| Non-root container | `USER node` in Dockerfile runner stage |
| HTTP security headers | Set in `next.config.ts` for all routes |
| Firestore access control | Per-collection rules; admin email-gated |
| No secrets in image | Firebase config passed as build args, not baked into source |
| XSS protection | `X-Content-Type-Options: nosniff` header |
| Clickjacking protection | `X-Frame-Options: DENY` header |
| Referrer leakage | `Referrer-Policy: strict-origin-when-cross-origin` |
| Permissions Policy | Camera, mic, geolocation all denied |

### HTTP Security Headers (applied to all routes)

```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

---

## Design Guidelines

- **Primary colour**: Slate Blue `#708090`
- **Background**: Light Gray `#D3D3D3` (desaturated, eye-strain optimised)
- **Accent colour**: Steel Blue `#4682B4`
- **Headline font**: Playfair (serif)
- **Body font**: PT Sans (sans-serif)
- Layout is mobile-first with clear sections for input and output
- Print styles hide navigation and controls, showing only the statement table