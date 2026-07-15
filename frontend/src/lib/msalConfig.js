/**
 * src/lib/msalConfig.js
 *
 * MSAL (Microsoft Authentication Library) configuration for local browser
 * development outside of the Teams client.
 *
 * Used ONLY when Teams SDK initialisation fails (i.e. the app is running in
 * a normal browser rather than inside a Teams tab).  In production the Teams
 * SSO + OBO flow is always preferred.
 *
 * Scopes:
 *   We request Graph API scopes directly so that the access token returned
 *   by loginPopup() can be forwarded to the backend and used as a pass-through
 *   Graph token (no OBO exchange required in local dev mode).
 */

export const msalConfig = {
  auth: {
    clientId:    import.meta.env.VITE_AZURE_CLIENT_ID   ?? '',
    authority:   `https://login.microsoftonline.com/${import.meta.env.VITE_AZURE_TENANT_ID ?? 'common'}`,
    // Redirect URI must be registered in the Azure App Registration.
    // For local dev, http://localhost:5173 (or whichever port Vite uses).
    redirectUri: window.location.origin,
  },
  cache: {
    cacheLocation:       'sessionStorage', // keeps auth state across HMR reloads
    storeAuthStateInCookie: false,
  },
}

/**
 * Graph API scopes to request during loginPopup / acquireTokenSilent.
 * These match the permissions declared in the Azure App Registration.
 */
export const GRAPH_SCOPES = [
  'Mail.Read',
  'Tasks.Read',
  'Calendars.Read',
  'User.Read',
]
