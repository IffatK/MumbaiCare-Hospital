# MumbaiCare — Hospital Patient Analytics and Decision Support System

Full-stack **MERN + Supabase** academic project for Data Warehousing and Data Mining.

> **Academic use only.** All patients and hospitals are synthetic. Nothing in this app is a diagnosis, prescription or clinical recommendation.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + TypeScript, Vite, Tailwind CSS, Recharts, TanStack Query |
| Backend | Node.js 20, Express, TypeScript, JWT, bcrypt, pg |
| Database | Supabase (PostgreSQL) — `public.*` operational tables + `dw.*` star-schema warehouse |
| Mining | 9 algorithms written in TypeScript — no Python needed |

## Folder structure

```
├─ backend/src/
│  ├─ routes/          auth, hospitals, patients, analytics, warehouse, olap, mining, reports, quality
│  ├─ services/etl.ts  Node.js ETL: public.patients → dw.* (upserts, idempotent)
│  └─ services/mining/ kmeans · dbscan · decisionTree · randomForest · naiveBayes
│                      linearRegression · apriori · crossHospital · compare
├─ frontend/src/pages/ 16 pages including 9-tab Mining page and full Reports
├─ supabase/migrations/ 001_schema.sql · 002_warehouse.sql
└─ docs/
```

## Setup

### 1. Create Supabase project
- Go to supabase.com → New project
- Under **Authentication → Sign In / Up** turn off public sign-ups
- Copy from **Project Settings → Database → Connection string (Session pooler)**

### 2. Configure `.env`
```bash
cp .env.example .env   # fill DATABASE_URL and JWT_SECRET
```

### 3. Run with Docker (easiest)
```bash
docker compose up --build
```
Open **http://localhost:5173**. The backend auto-migrates and seeds on first start.

### 4. Run manually
```bash
# Terminal 1 — Backend
cd backend && npm install
npm run setup   # runs migrations + seed
npm run dev     # :4000

# Terminal 2 — Frontend
cd frontend && npm install
npm run dev     # :5173  (proxies /api → :4000)
```

### 5. First run
Sign in as **admin**, go to **Data warehouse → Run ETL**. OLAP and all 9 mining algorithms read from the warehouse — they will be empty until the first ETL run.

## Demo accounts (password for all: `Password@123`)

| Role | Email | Access |
|---|---|---|
| Admin | admin@mumbaicare.local | Everything including ETL, hospital management |
| Analyst | analyst@mumbaicare.local | Analytics, OLAP, all 9 mining algorithms, reports |
| Staff (Andheri) | staff.andheri@mumbaicare.local | Andheri hospital records only |
| Staff (Dadar) | staff.dadar@mumbaicare.local | Dadar hospital records only |

## Data persistence

Data lives in **Supabase cloud** — it survives restarts, local machine shutdowns, and redeployments.
The seed script is idempotent: running it again only ensures hospitals and users exist; it never re-inserts the 3,000 patients if they are already there.

## 9 ML algorithms

| Algorithm | Type | Key output |
|---|---|---|
| K-Means | Clustering | K clusters, silhouette score, centroids, scatter |
| DBSCAN | Clustering | Density clusters, noise/anomaly points |
| Decision Tree | Classification | Accuracy, confusion matrix, rules text, feature importance |
| Random Forest | Classification | Accuracy, OOB accuracy, feature importance |
| Naive Bayes | Classification | Accuracy, class profiles (per-feature means) |
| Linear Regression | Regression | R², adj-R², coefficients, residuals |
| Apriori | Association | Rules with support, confidence, lift |
| Algorithm Comparison | Benchmark | Side-by-side accuracy + macro F1 for 4 classifiers |
| Cross-Hospital | Clustering | Cluster sizes and severity by hospital |

## Tests

```bash
cd backend && npm test   # 7 pure-logic tests — no DB needed
```

Tests cover: ETL rules T1–T5 and rejection rules R01–R07, K-Means on known blobs, DBSCAN noise detection, Decision Tree on a known threshold, Naive Bayes on clean separation, Apriori support/confidence hand-calculation.

## Security

- Passwords hashed with bcrypt, JWTs expire after 8 hours
- Roles enforced server-side on every API request; staff hospital scoping applied in SQL
- OLAP dimensions/measures come from a server-side whitelist — no raw SQL from the client
- Supabase RLS should be enabled with service-role access only for the backend
"# MumbaiCare-Hospital" 
