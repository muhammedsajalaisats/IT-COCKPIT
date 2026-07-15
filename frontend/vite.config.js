import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  // Load env vars for the current mode (development / production)
  const env = loadEnv(mode, process.cwd(), '')

  // The proxy is ONLY active in local development.
  // In production the compiled bundle uses the absolute VITE_API_BASE_URL
  // baked in at build time — no proxy is needed or configured.
  const isDev = mode !== 'production'

  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    server: {
      // Preferred port. If it is already in use, Vite will automatically
      // try the next available port (5174, 5175, …) rather than crashing.
      port: 5173,
      // strictPort: false  →  gracefully fall back to next free port.
      // This replaces the previous strictPort: true which caused the
      // "Port 3000 is already in use" crash when a stale server was running.
      strictPort: false,
      ...(isDev && {
        proxy: {
          // All /api requests are forwarded to the FastAPI backend.
          // This avoids CORS issues during local development.
          '/api': {
            target: 'http://localhost:8000',
            changeOrigin: true,
            // Bail out quickly (3 s) so the terminal isn't blocked when the
            // backend is down. Without a timeout, Vite can hang waiting for a
            // TCP connection that will never succeed.
            proxyTimeout: 3000,
            timeout: 3000,
            configure: (proxy) => {
              // ── CRITICAL: remove Vite's own error listener first ──────────
              // Vite registers an internal 'error' handler on the http-proxy
              // instance that prints the raw AggregateError stacktrace to the
              // terminal even when we have our own handler. By calling
              // removeAllListeners('error') before registering ours, we take
              // sole ownership of proxy error handling and the noise is gone.
              proxy.removeAllListeners('error')

              proxy.on('error', (err, req, res) => {
                // Absorb the error at the socket level so Node.js never sees
                // it as an unhandled rejection / AggregateError.
                if (req.socket && !req.socket.destroyed) {
                  req.socket.destroy()
                }

                // Only log ECONNREFUSED / ETIMEDOUT — those are "backend is
                // down" signals. Skip EPIPE / ECONNRESET which are harmless
                // client-disconnect events that fire after we destroy the socket.
                const silentCodes = new Set(['EPIPE', 'ECONNRESET'])
                if (!silentCodes.has(err.code)) {
                  console.warn(
                    '\n[Vite Proxy] ⚠️  FastAPI not reachable on localhost:8000.' +
                    ' Start it with:\n' +
                    '   npm run dev:all          (runs both servers together)\n' +
                    '   — or —\n' +
                    '   cd backend && .\\venv\\Scripts\\uvicorn main:app --reload --port 8000\n' +
                    `   (${err.code ?? err.message})\n`
                  )
                }

                // Return a structured 503 so the frontend can display a
                // helpful "Connecting to server…" fallback instead of crashing.
                if (!res.headersSent) {
                  res.writeHead(503, { 'Content-Type': 'application/json' })
                  res.end(JSON.stringify({
                    error: {
                      code:      'BACKEND_UNAVAILABLE',
                      message:   'FastAPI backend is not running on localhost:8000. Use `npm run dev:all` to start both servers.',
                      retryable: true,
                    },
                  }))
                }
              })
            },
          },
        },
      }),
    },
  }
})
