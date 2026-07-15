# Deployment Environment Variables Checklist

This document summarizes all environment variables required for deploying the **IT Cockpit** application to production. 

---

## ── Backend (Render / Railway) ──

Set these variables in your backend service configuration (e.g., Render Dashboard or Railway Shared Variables):

| Environment Variable Name | Recommended Value / Guide | Purpose |
| :--- | :--- | :--- |
| **`APP_ENV`** | `production` (Must change from `local`) | Tells the authentication middleware to enforce JWKS verification against Microsoft keys and execute the On-Behalf-Of (OBO) flow instead of bypassing validation. |
| **`DATABASE_URL`** | `postgresql://<user>:<password>@<host>/<database>` | The production SQL database connection string. During development, SQLite is used locally. |
| **`AZURE_TENANT_ID`** | *Microsoft Entra App Tenant ID* | The Azure Active Directory Tenant ID under which the app is registered. |
| **`AZURE_CLIENT_ID`** | *Microsoft Entra App Client ID* | The Application ID of the registered Entra App. |
| **`AZURE_CLIENT_SECRET`** | *Microsoft Entra Client Secret* | Client secret generated in Entra App registrations for backend OBO token exchange. |
| **`TEAM_PLANNER_PLAN_ID`** | *Target Microsoft Planner Plan ID* | The identifier of the Planner Plan from which team tasks are retrieved. |
| **`FRONTEND_ORIGIN`** | `https://it-cockpit-frontend.vercel.app` | The production URL where the frontend is hosted. Used to permit secure cross-origin requests. |

---

## ── Frontend (Vercel) ──

Configure these environment variables in your Vercel Project Settings under **Settings → Environment Variables**:

| Environment Variable Name | Recommended Value / Guide | Purpose |
| :--- | :--- | :--- |
| **`VITE_AZURE_CLIENT_ID`** | *Microsoft Entra App Client ID* | Client ID used by `@azure/msal-browser` to initialize the client-side SPA auth flows. |
| **`VITE_AZURE_TENANT_ID`** | *Microsoft Entra App Tenant ID* | Tenant ID configuration for MSAL. |
| **`VITE_API_BASE_URL`** | `https://your-backend-service.railway.app` (e.g., your Railway URL) | Specifies the base API origin for all fetch queries in production. Make sure there is **no trailing slash**. |
| **`VITE_ENV`** | `production` | Signals MSAL redirect hooks to run in production mode (using production redirect URIs). |

---

## ── Steps to Transition from Local to Production ──

1. **Change Environment Configs**:
   Ensure `APP_ENV=production` is set in the backend environment. If it remains `local`, the backend will bypass OBO token validation and attempt to resolve tokens without validating signatures, which is insecure for production.
2. **Setup Redirect URIs in Azure Portal**:
   In the Azure Portal under **Entra ID → App Registrations → [Your App] → Authentication**:
   - Add a Single-page application redirect URI: `https://it-cockpit-frontend.vercel.app/`
3. **Deploy Backend**:
   Link your repository to Railway/Render, configure the environment variables listed above, and start the app using Gunicorn:
   ```bash
   gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT
   ```
4. **Deploy Frontend**:
   Deploy the `frontend` folder to Vercel, populate the VITE variables, and trigger a build. Vercel will bundle the production endpoint directly into the SPA bundle.
