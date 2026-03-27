const SUPABASE_URL = 'https://ttlyyhralgayeifwgicj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0bHl5aHJhbGdheWVpZndnaWNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MDI4NzMsImV4cCI6MjA5MDE3ODg3M30.8OFVUDtO_DLdJt_2sQzjruguXZ_sOGsbr0cxY6oQjME';

if (!window.supabase || !window.supabase.createClient) {
    throw new Error('Biblioteca do Supabase não foi carregada.');
}

window.supabaseProjectRef = new URL(SUPABASE_URL).hostname.split('.')[0];
window.supabaseSessionStorageKey = `sb-${window.supabaseProjectRef}-auth-token`;
window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);