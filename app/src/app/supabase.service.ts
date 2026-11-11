import { Injectable } from '@angular/core';
import { createClient } from '@supabase/supabase-js';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  public supabase: any;

  constructor() {
    // From your Supabase project - replace with your actual project URL and anon key
    this.supabase = createClient(
      'https://wdoyhtjpjhmagdllvd.supabase.co',
      'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH'
    );
  }
}