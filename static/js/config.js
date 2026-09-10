// ══════════════════════════════════════════════════
// 🎮 帳號密碼練習遊戲 — 雲端資料庫設定檔 (Supabase)
// ══════════════════════════════════════════════════

// 填入您在 Supabase 專案建立後的 Project URL 與 anon public key：
const SUPABASE_URL = 'https://tvzmludmmwnfdowzjssv.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_mGlw3yCWBAv_709kqwiRYw_MEq3R0FU';

// 建立 Supabase Client 實例
let supabaseClient = null;
if (typeof supabase !== 'undefined' && SUPABASE_URL && !SUPABASE_URL.includes('YOUR-PROJECT-ID')) {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// 輔助函式：判斷是否已啟用 Supabase
function isSupabaseConfigured() {
    return supabaseClient !== null;
}
