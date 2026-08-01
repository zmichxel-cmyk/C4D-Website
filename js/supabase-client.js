// Shared Supabase client for the Community page (Suggestions, Connect, Clip
// of the Week tabs). Fill these in from your Supabase project's
// Settings -> API page. Must load after the Supabase CDN script and before
// community.js / connect.js.
const SUPABASE_URL = "https://ypzazhjyrvhbjcjgowbl.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlwemF6aGp5cnZoYmpjamdvd2JsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU1NDIyMDgsImV4cCI6MjEwMTExODIwOH0.WnYy1FuC7XS-wc4M_4-Two4H0qmasMzUk-9Q016xrGo";

window.supabaseClient = (SUPABASE_URL !== "YOUR_SUPABASE_PROJECT_URL")
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;
