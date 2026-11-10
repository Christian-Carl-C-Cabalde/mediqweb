import { Injectable, inject } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

export interface SupabaseProfile {
  user_id: string;
  username: string;
  full_name: string | null;
  email: string | null;
  role: string;
  status: string;
}

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  private supabase: SupabaseClient;

  constructor() {
    const url = environment.supabaseUrl;
    const key = environment.supabaseAnonKey;
    if (!url || !key) {
      throw new Error(
        'Supabase URL and Anon Key must be configured via window.__env.SUPABASE_URL and SUPABASE_ANON_KEY',
      );
    }
    this.supabase = createClient(url, key);

    const serviceRoleKey = environment.supabaseServiceRoleKey;
    if (url && serviceRoleKey) {
      this.admin = createClient(url, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
    }
  }

  private admin?: SupabaseClient;

  async createUser(email: string, password: string) {
    if (!this.admin) {
      throw new Error(
        'SUPABASE_SERVICE_ROLE_KEY is not configured; cannot create admin users without email confirmation.',
      );
    }
    const { data, error } = await this.admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) {
      throw error;
    }
    return data;
  }

  get client(): SupabaseClient {
    return this.supabase;
  }

  from(table: string) {
    return this.supabase.from(table);
  }

  rpc(functionName: string, params?: any) {
    return this.supabase.rpc(functionName, params);
  }

  async signIn(email: string, password: string) {
    return this.supabase.auth.signInWithPassword({ email, password });
  }

  async signOut() {
    return this.supabase.auth.signOut();
  }

  async getSession() {
    return this.supabase.auth.getSession();
  }

  async getUser() {
    return this.supabase.auth.getUser();
  }

  async getProfile(userId: string) {
    return (this.supabase as any).from('profiles').select('*').eq('user_id', userId).single();
  }

  async getAccessToken(): Promise<string | null> {
    const { data } = await this.supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }

  onAuthStateChange(callback: (event: string, session: any) => void) {
    return this.supabase.auth.onAuthStateChange(callback);
  }
}
