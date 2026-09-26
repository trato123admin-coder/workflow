import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getEngineEnv } from '../config/env.js';
import type { StorageProvider } from './provider.js';
import { SupabaseStorageProvider } from './supabase-provider.js';

export * from './provider.js';
export * from './supabase-provider.js';

let activeProvider: StorageProvider | null = null;
let supabaseServiceClient: SupabaseClient | null = null;

export function getSupabaseServiceClient(): SupabaseClient {
  if (supabaseServiceClient) {
    return supabaseServiceClient;
  }

  const env = getEngineEnv();
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      'Variables SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no configuradas en el engine',
    );
  }

  supabaseServiceClient = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return supabaseServiceClient;
}

export function getStorageProvider(): StorageProvider {
  if (activeProvider) {
    return activeProvider;
  }

  const client = getSupabaseServiceClient();
  activeProvider = new SupabaseStorageProvider(client, 'case-documents');
  return activeProvider;
}

export function setStorageProvider(provider: StorageProvider | null): void {
  activeProvider = provider;
}

export function setSupabaseServiceClient(client: SupabaseClient | null): void {
  supabaseServiceClient = client;
}
