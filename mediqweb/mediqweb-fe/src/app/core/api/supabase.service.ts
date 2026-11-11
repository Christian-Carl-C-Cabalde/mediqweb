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

  // Profile cache to avoid repeated Supabase queries for the same user
  private profileCache = new Map<string, { data: any; expiresAt: number }>();
  private readonly PROFILE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor() {
    const url = environment.supabaseUrl;
    const key = environment.supabaseAnonKey;
    if (!url || !key) {
      throw new Error(
        'Supabase URL and Anon Key must be configured in environment'
      );
    }
    this.supabase = createClient(url, key);
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

  async signUp(email: string, password: string) {
    return this.supabase.auth.signUp({ email, password });
  }

  async signIn(email: string, password: string) {
    return this.supabase.auth.signInWithPassword({ email, password });
  }

  async signOut() {
    this.profileCache.clear();
    return this.supabase.auth.signOut();
  }

  async getSession() {
    return this.supabase.auth.getSession();
  }

  async getUser() {
    return this.supabase.auth.getUser();
  }

  async getProfile(userId: string) {
    const now = Date.now();
    const cached = this.profileCache.get(userId);
    if (cached && now < cached.expiresAt) {
      return cached.data;
    }

    const result = await (this.supabase as any)
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    this.profileCache.set(userId, {
      data: result,
      expiresAt: now + this.PROFILE_CACHE_TTL_MS,
    });
    return result;
  }

  async getAccessToken(): Promise<string | null> {
    const { data } = await this.supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }

  onAuthStateChange(callback: (event: string, session: any) => void) {
    return this.supabase.auth.onAuthStateChange(callback);
  }
}
