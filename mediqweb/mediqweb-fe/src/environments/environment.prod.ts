export const environment = {
  production: true,
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
