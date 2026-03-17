// Supabase Configuration
const SUPABASE_CONFIG = {
    url: 'https://bbwiyfiyvgstgqyyopjx.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJid2l5Zml5dmdzdGdxeXlvcGp4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwNzc2MzQsImV4cCI6MjA4MzY1MzYzNH0.emqf5-8mzh7koAzY1RlHolkOF8V2ejNek1a_bkZTHpI'
};

// Initialize Supabase client
const supabaseClient = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);

console.log('Supabase client initialized');
