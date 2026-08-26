# ATC CTC Attendance Reconciliation Hub (React + Vite + Supabase)

An executive web application for automated CTC cost mapping, overtime computation, and multi-year attendance archiving for ATC Tires.

---

## ⚡ 100% Free Forever Cloud Database Setup (Supabase)

This app supports **120 files/month year-by-year** (~1,500+ files/year) using **Supabase Free Tier** (1 GB File Storage + 500 MB PostgreSQL Database):

### 1. Get Your Free Supabase Keys (1 Minute):
1. Go to [supabase.com](https://supabase.com) and create a free project.
2. Go to **Project Settings $\rightarrow$ API** and copy:
   - **Project URL**
   - **Project API Anon Key**

### 2. Connect in App:
- Open the application and click **"Connect Cloud DB"** in the top navigation.
- Paste your Project URL and Anon Key $\rightarrow$ Click **"Save & Connect"**.
- *(Optional)* In Supabase SQL Editor, run the 1-click SQL provided in the app to create the history database table and bucket.

---

## 🚀 1-Click Vercel Deployment

1. Push this repository to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Deploy ATC CTC Hub with Supabase"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/atc-ctc-hub.git
   git push -u origin main
   ```
2. In [Vercel.com](https://vercel.com), click **"Add New Project"** $\rightarrow$ Import your repo $\rightarrow$ Click **Deploy**.
3. *(Optional)* Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel **Environment Variables**.

---

## 💻 Running Locally (Windows)

1. Double-click **`start_app.bat`** (or run `npm run dev`).
2. Open `http://localhost:3000` in your browser.

---

## 📂 Multi-Year Storage Organization

Files are automatically organized in Supabase storage by **Year $\rightarrow$ Month**:
```
atc-attendance-storage/
├── 2026/
│   ├── 08/
│   │   ├── master/ (CL CTC Input 2.xlsx)
│   │   ├── attendance/ (up to 120+ daily attendance files...)
│   │   └── output/ (CTC_Output_August_2026.xlsx)
│   └── 09/
└── 2027/
```

- **Year Archives Explorer**: Click **"Year Archives"** in the top bar to inspect, filter, or re-download any month from any previous year with 1 click!
