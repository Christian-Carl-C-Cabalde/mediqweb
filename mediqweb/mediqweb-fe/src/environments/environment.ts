// MediQ web frontend environment configuration.
// apiBaseUrl / bffBaseUrl are read from window.__env at runtime (injected via index.html).
// Vercel sets these at deploy time; local dev uses .env.
export const environment = {
  production: false,
  get apiBaseUrl(): string | undefined {
    return (window as unknown as { __env?: Record<string, string> })?.__env?.['API_BASE_URL'];
  },
  get supabaseUrl(): string | undefined {
    return (window as unknown as { __env?: Record<string, string> })?.__env?.['SUPABASE_URL'];
  },
  get supabaseAnonKey(): string | undefined {
    return (window as unknown as { __env?: Record<string, string> })?.__env?.['SUPABASE_ANON_KEY'];
  },
  useHttpApi: true,
};
