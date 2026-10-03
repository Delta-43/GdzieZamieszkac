import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

// Development only. The dev server forwards /v1 to the API, so the browser makes same-origin requests
// and needs no CORS setup. The API address is private: it lives in .env.local, which git ignores.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const devApi = env.VITE_DEV_API || 'http://localhost:8000'
  const extraHosts = (env.DEV_ALLOWED_HOSTS ?? '')
    .split(',')
    .map((host) => host.trim())
    .filter(Boolean)

  return {
    plugins: [react()],
    server: {
      // Listen on the network so the reviewer can open the dev app over the team Tailscale network.
      host: true,
      // The API allows this port only, so fail instead of moving to another one.
      port: 5173,
      strictPort: true,
      allowedHosts: ['.ts.net', ...extraHosts],
      proxy: {
        // changeOrigin: the tailnet proxy routes by host name.
        '/v1': { target: devApi, changeOrigin: true },
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['src/test/setup.ts'],
      // jsdom cannot build a request from a relative URL, so tests give the client an absolute origin.
      env: { VITE_API_URL: 'http://api.test' },
    },
  }
})
