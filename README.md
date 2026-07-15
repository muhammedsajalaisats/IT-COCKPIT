# IT Cockpit Monorepo

IT Cockpit is a Microsoft Teams Application designed to aggregate M365 (inbox triage, Planner tasks, calendars) and ManageEngine ServiceDesk Plus data into a unified dashboard interface.

This repository is structured as a monorepo containing:
- **`frontend/`**: React Vite SPA client interface (securing authentication using MSAL Redirect-Only flow).
- **`backend/`**: FastAPI backend service exposing REST endpoints (supporting Microsoft Graph direct tokens locally and SSO OBO JWT exchange in production).
- **`api/`**: Entrypoint for deploying the FastAPI backend as Vercel Python Serverless functions.

---

## ── Vercel Deployment Instructions ──

This monorepo is fully configured to deploy both the Frontend (React SPA) and the Backend (FastAPI Python Serverless Functions) to **Vercel**.

### 1. Backend Service (Serverless FastAPI)
The root `vercel.json` maps all `/api/(.*)` requests to `api/index.py`, which initializes the FastAPI app and resolves internal directory paths.

**Deployment Steps**:
1. In the Vercel Dashboard, select **New Project** and import this repository.
2. In the project creation wizard, set the following:
   - **Root Directory**: `.` (leave as repository root)
   - **Build Command**: (leave default/empty, Vercel automatically installs the root `requirements.txt` and packages `api/index.py` with the `@vercel/python` builder).
3. Configure the following **Environment Variables** in Vercel under Settings:
   - `APP_ENV` = `production`
   - `FRONTEND_ORIGIN` = `https://it-cockpit-frontend.vercel.app` (your frontend deployment URL)
   - `AZURE_CLIENT_ID` = *Your Microsoft Entra Client ID*
   - `AZURE_TENANT_ID` = *Your Microsoft Entra Tenant ID*
   - `AZURE_CLIENT_SECRET` = *Your Microsoft Entra Client Secret*
   - `TEAM_PLANNER_PLAN_ID` = *Your Microsoft Planner Plan ID*
   - `DATABASE_URL` = *Your production PostgreSQL connection string*

### 2. Frontend Client (React Vite SPA)
You can deploy the frontend client as a separate Vercel project or set up a multi-project monorepo.

**Deployment Steps**:
1. Import this repository in the Vercel Dashboard.
2. In the project creation wizard:
   - **Root Directory**: `frontend`
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
3. Configure the following **Environment Variables** in Vercel:
   - `VITE_AZURE_CLIENT_ID` = *Your Microsoft Entra Client ID*
   - `VITE_AZURE_TENANT_ID` = *Your Microsoft Entra Tenant ID*
   - `VITE_ENV` = `production`
   - `VITE_API_BASE_URL` = `https://your-backend-vercel-url.vercel.app` (The URL of the Vercel backend service created in step 1, with no trailing slash).
