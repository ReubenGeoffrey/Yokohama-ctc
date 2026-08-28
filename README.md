<div align="center">

<img src="https://img.shields.io/badge/ATC%20Tires-Attendance%20Hub-f59e0b?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iI2ZmZiIgZD0iTTEyIDJMMiA3bDEwIDUgMTAtNS0xMC01ek0yIDE3bDEwIDUgMTAtNS0xMC01LTEwIDV6TTIgMTJsMTAgNSAxMC01LTEwLTUtMTAgNXoiLz48L3N2Zz4=" alt="ATC Attendance Hub"/>

# 🌟 ATC Attendance Hub

**Automated Daily CTC Cost Mapping, Overtime Analytics & Master Excel Generator**

[![Vercel](https://img.shields.io/badge/Live%20on-Vercel-000000?style=flat-square&logo=vercel&logoColor=white)](https://atc-ctc-hub.vercel.app)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev)
[![Supabase](https://img.shields.io/badge/Supabase-Cloud%20Sync-3ECF8E?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-2.2-38B2AC?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)

<br/>

> 🏭 Built for **ATC Tires** — A premium internal tool to reconcile contractor CTC costs,  
> generate unified monthly Excel summaries, and sync data across multiple plant laptops in real time.

<br/>

[🚀 Open Live App](https://atc-ctc-hub.vercel.app) · [📋 Features](#-features) · [🖥️ Screenshots](#️-screenshots) · [⚙️ Setup](#️-setup)

</div>

---

## ✨ Features

### 🔐 Executive Authentication
- **Quick PIN Login** — Enter `atc2026` for instant executive access
- **Email & Password** — Supabase-powered individual accounts
- **Session Persistence** — Stay logged in across page refreshes
- **Vault-Style File Lock** — Stored rosters & files hidden behind auth gate

### ☁️ Multi-Laptop Cloud Sync
- Upload files from **Sir's laptop** → appears instantly on **your laptop**
- Powered by **Supabase Storage** (live JSON state sync)
- One-click **Refresh Cloud** button in the header

### 📊 4-Step Reconciliation Workflow

```
01. Rate Master Setup → 02. Daily Attendance Upload → 03. Reconciliation Matrix → 04. Excel Export
```

| Step | Description |
|------|-------------|
| **01 Setup** | Upload contractor rate master (Direct / Indirect / Trainee) |
| **02 Upload** | Drop all daily attendance files at once (multi-date batch) |
| **03 Review** | Executive cost matrix with KPIs — Total HC, CTC, OT, Grand Total |
| **04 Export** | Generate styled Excel workbooks with yellow headers & WOP tracking |

### 📁 Smart File Management
- **IndexedDB** local storage — works offline
- **Supabase Cloud** backup — shared across all plant laptops
- Vault-style stored files modal (login required to view)

### 🎨 Premium UI Design
- ☀️ Maya Studio Sunshine theme — Amber `#F59E0B` + Royal Blue `#2563EB` + Cream Canvas `#FDFBF7`
- Caveat handwriting font accents
- Framer Motion animations — smooth transitions everywhere
- Pricing-package style Excel export cards with `⭐ MOST POPULAR` badge

---

## 🖥️ Screenshots

| Header — Premium Vault & Login | Excel Export Packages |
|---|---|
| Premium amber gradient navbar with vault button | Maya Studio pricing cards with MOST POPULAR badge |

---

## ⚙️ Setup

### Prerequisites
- Node.js 18+
- A [Supabase](https://supabase.com) project (free tier works)

### 1. Clone the repo
```bash
git clone https://github.com/ReubenGeoffrey/Yokohama-ctc.git
cd Yokohama-ctc
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment variables
Create a `.env` file in the root:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

### 4. Run locally
```bash
npm run dev
```

### 5. Build for production
```bash
npm run build
```

---

## 🗂️ Project Structure

```
src/
├── components/
│   ├── Header.jsx            # Premium navbar — vault button + auth chip
│   ├── AuthModal.jsx         # Executive login (PIN + Email)
│   ├── MasterUpload.jsx      # Rate master dropzone
│   ├── AttendanceUpload.jsx  # Multi-file attendance upload
│   ├── ReconciliationMatrix.jsx  # KPI cards + cost table
│   ├── ExportPanel.jsx       # Excel export package cards
│   ├── FileManagerModal.jsx  # Vault-style stored files
│   └── Stepper.jsx           # 4-step workflow pills
├── services/
│   ├── auth.js               # Executive auth service
│   ├── supabase.js           # Cloud sync helpers
│   └── storage.js            # IndexedDB local storage
└── index.css                 # Premium design system CSS
```

---

## 🔑 Default Login

| Method | Credentials |
|--------|-------------|
| Quick Executive PIN | `atc2026` |
| Email | Your registered email + password |

> ⚠️ Change the default PIN before sharing with external users.

---

## 🛠️ Tech Stack

| Technology | Purpose |
|------------|---------|
| **React 18** | UI framework |
| **Vite 6** | Build tool & dev server |
| **Tailwind CSS 2.2** | Utility-first styling |
| **Framer Motion** | Animations & transitions |
| **SheetJS (xlsx)** | Excel file generation |
| **Supabase** | Cloud sync & auth |
| **IndexedDB** | Offline local storage |
| **Lucide React** | Icon system |
| **Vercel** | Hosting & deployment |

---

## 🚀 Deployment

Deployed automatically on [Vercel](https://vercel.com):

```bash
vercel --prod --yes
```

**Live URL:** [https://atc-ctc-hub.vercel.app](https://atc-ctc-hub.vercel.app)

---

<div align="center">

**Built with ☀️ for ATC Tires Plant Operations**

© 2026 ATC Tires Executive Hub · All rights reserved

[![Made with Love](https://img.shields.io/badge/Made%20with-☀️%20Sunshine-f59e0b?style=flat-square)](https://atc-ctc-hub.vercel.app)

</div>
