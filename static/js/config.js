// 🌐 Google Apps Script 部署後的 Web App URL
const API_URL = 'https://script.google.com/macros/s/AKfycbzZ4FBD1roKxOceFCzqC3ze6nfC7jkv8ywoJ2ZnvYJfLRJGqxm_bhmTkVuiQvUF8ptL7Q/exec';

// 後端 API 發送輔助函式（Google Apps Script Web App 對 GET 支援最為完美且不會有 CORS 或 302 重定向丟失 body 問題）
async function apiRequest(action, data = {}, method = 'GET') {
    if (!API_URL || API_URL.includes('YOUR-DEPLOYMENT-ID')) {
        console.warn('尚未設定 Google Apps Script API_URL，目前使用本地模式');
    }

    try {
        // 將所有參數（包含複雜物件）扁平化或轉為 JSON 字串放入 Query String
        const queryParams = new URLSearchParams({ action });
        for (const [key, val] of Object.entries(data)) {
            if (typeof val === 'object' && val !== null) {
                queryParams.append(key, JSON.stringify(val));
            } else {
                queryParams.append(key, String(val));
            }
        }

        const url = API_URL + (API_URL.includes('?') ? '&' : '?') + queryParams.toString();
        const response = await fetch(url, { method: 'GET' });
        return await response.json();
    } catch (err) {
        console.error('API 請求失敗:', err);
        throw err;
    }
}
