export const HIKARI_SUPABASE_URL = 'https://xznthkyqqvnlwbvkjebo.supabase.co';
export const HIKARI_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6bnRoa3lxcXZubHdidmtqZWJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgxNDU0MzUsImV4cCI6MjA4MzcyMTQzNX0.ggPi9x-X6h4im7T7wDPDpFZikE18rDWg3I-vucE3IU4';
export const HIKARI_WEB_URL = 'http://localhost:3000';

export function getHikariConfig() {
  if (!HIKARI_SUPABASE_URL || !HIKARI_SUPABASE_ANON_KEY) {
    throw new Error('Missing Hikari Supabase config.');
  }
  return {
    url: HIKARI_SUPABASE_URL,
    anonKey: HIKARI_SUPABASE_ANON_KEY,
  };
}
