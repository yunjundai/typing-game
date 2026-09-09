// 🌐 Google Apps Script 部署後的 Web App URL
// 請在完成 Apps Script 部署後，將您的 Web App 網址貼於此處：
// 例如: const API_URL = 'https://script.google.com/macros/s/AKfycbx.../exec';
const API_URL = 'https://script.google.com/macros/s/AKfycby-YOUR-DEPLOYMENT-ID/exec';

// 後端 API 發送輔助函式（支援 GET 與 POST，處理 CORS 與 Apps Script 重定向）
async function apiRequest(action, data = {}, method = 'GET') {
    if (!API_URL || API_URL.includes('YOUR-DEPLOYMENT-ID')) {
        console.warn('尚未設定 Google Apps Script API_URL，目前使用本地或模擬模式');
    }

    try {
        let url = API_URL;
        let options = {
            method: method,
            headers: {
                // Apps Script 對 text/plain 不會觸發 CORS preflight，最穩定
                'Content-Type': 'text/plain;charset=utf-8',
            }
        };

        if (method === 'GET') {
            const queryParams = new URLSearchParams({ action, ...data });
            url += (url.includes('?') ? '&' : '?') + queryParams.toString();
        } else {
            // POST 請求將 action 與 data 放在 payload
            options.body = JSON.stringify({ action, ...data });
        }

        const response = await fetch(url, options);
        return await response.json();
    } catch (err) {
        console.error('API 請求失敗:', err);
        throw err;
    }
}
