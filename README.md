# 🎮 帳號密碼練習遊戲 — 部署與管理指南

本專案支援 **雙模式運作**：
1. **GitHub Pages + Google Sheets / Apps Script 雲端無伺服器架構**（學生在家在校皆可玩，老師直接在試算表或管理頁面維護）
2. **本機 / 區域網路 Flask 架構**（免連外網，教室內電腦直接練習）

---

## 📌 第一部分：教師後台管理功能

- **管理密碼**：`5552472`
- **後台網址**：
  - 本機/區網：`http://localhost:8080/admin`
  - GitHub Pages 部署後：`https://您的帳號.github.io/專案名稱/admin.html`
- **主要功能**：
  - 🔑 密碼驗證登入
  - 📋 顯示全校 733 名學生清單（含真實帳號與密碼）
  - 🔍 支援按「班級」篩選、依「姓名 / 帳號 / 座號」即時搜尋
  - 📋 帳號與密碼提供「一鍵複製」按鈕
  - ➕ 線上直接「新增學生」
  - 🗑️ 線上直接「刪除學生」

---

## 📌 第二部分：Google Sheets + Google Apps Script 雲端後端建置（5分鐘完成）

### 步驟 1：建立 Google 試算表
1. 前往 [Google Drive](https://drive.google.com/)，新增一個 **Google 試算表 (Google Sheets)**。
2. 將試算表命名為：`竹仁國小學生帳號密碼遊戲資料庫`。
3. 建立兩個工作表，名稱務必為：
   - 第一個工作表命名為：`學生資料`
   - 第二個工作表命名為：`成績記錄`
4. 匯入現有學生資料：
   - 在專案目錄中的 `google-backend/` 資料夾內，已為您自動產生好：  
     [`學生資料_匯入GoogleSheet用.csv`](file:///Users/daiyujun/Desktop/帳號密碼遊戲/google-backend/學生資料_匯入GoogleSheet用.csv)
   - 在 Google 試算表的 `學生資料` 工作表，點「檔案」->「匯入」->「上傳」該 CSV 檔案（選擇「取代目前的工作表」）。

### 步驟 2：貼上 Apps Script 程式碼
1. 在該 Google 試算表中，點擊上方選單的 **「擴充功能」 -> 「Apps Script」**。
2. 開啟專案內的 [`google-backend/Code.gs`](file:///Users/daiyujun/Desktop/帳號密碼遊戲/google-backend/Code.gs)，複製全部程式碼並貼入 Apps Script 編輯器中覆蓋。
3. 點擊上方的「儲存」圖示（磁碟片）。

### 步驟 3：部署為 Web 應用程式 (Web App)
1. 點擊右上角藍色的 **「部署」 -> 「新增部署」**。
2. 點擊左側齒輪圖示，選擇 **「網頁應用程式 (Web App)」**。
3. 設定如下：
   - **說明**：`帳號密碼遊戲 API`
   - **執行身分**：`我 (您的 Gmail 帳號)`
   - **誰可以存取**：**`所有人 (Anyone)`**  *(注意：必須選所有人，前端網頁才能免登入呼叫)*
4. 點擊「部署」，依系統提示授予權限（進階 -> 前往...）。
5. 部署完成後，複製產生的 **「網頁應用程式網址」** (格式為 `https://script.google.com/macros/s/AKfycb.../exec`)。

### 步驟 4：設定前端 API 網址
打開專案中的 [`static/js/config.js`](file:///Users/daiyujun/Desktop/帳號密碼遊戲/static/js/config.js)：
```javascript
const API_URL = 'https://script.google.com/macros/s/您的部署ID/exec';
```
將剛才複製的網址貼到引號中並儲存。

---

## 📌 第三部分：使用 GitHub Pages 發布前端網頁

1. 登入 [GitHub](https://github.com/)，點擊「New repository」新增一個專案（例如名稱為 `cjes-typing-game`，設為 Public）。
2. 在本地專案資料夾將程式碼 push 到 GitHub：
   ```bash
   cd /Users/daiyujun/Desktop/帳號密碼遊戲
   git init
   git add index.html admin.html static/
   git commit -m "feat: 發布帳號密碼練習遊戲與教師管理後台"
   git branch -M main
   git remote add origin https://github.com/您的GitHub帳號/cjes-typing-game.git
   git push -u origin main
   ```
3. 在 GitHub 該專案頁面點擊 **Settings** -> 左側選 **Pages**：
   - **Source** 選擇 `Deploy from a branch`
   - **Branch** 選擇 `main`，資料夾選擇 `/ (root)`，點擊 **Save**。
4. 約 1~2 分鐘後，即可透過以下公開網址遊玩：
   - 學生遊戲主頁：`https://您的GitHub帳號.github.io/cjes-typing-game/`
   - 教師管理後台：`https://您的GitHub帳號.github.io/cjes-typing-game/admin.html`

---

## 📌 第四部分：本機 / 區域網路備援方案

如果您在沒有外網連線的教室，仍然可以直接啟動本機伺服器：
```bash
cd /Users/daiyujun/Desktop/帳號密碼遊戲
python3 app.py
```
- 本機訪問：`http://localhost:8080`
- 區域網路訪問：`http://老師電腦IP:8080`
- 教師後台：`http://localhost:8080/admin`
