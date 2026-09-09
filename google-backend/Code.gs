/**
 * 🎮 帳號密碼練習遊戲 — Google Apps Script 後端 (Code.gs)
 * 
 * 部署指引：
 * 1. 在 Google Drive 建立一個新的 Google 試算表（Google Sheets）
 * 2. 建立兩個工作表，分別命名為：
 *    - 「學生資料」
 *    - 「成績記錄」
 * 3. 點選試算表上方功能表的「擴充功能」 -> 「Apps Script」
 * 4. 將本檔案的所有內容貼到 Code.gs 中
 * 5. 點擊右上角「部署」 -> 「新增部署」 -> 齒輪圖示選「網頁應用程式 (Web App)」
 *    - 說明：帳號密碼遊戲 API
 *    - 執行身分：我 (您的 Google 帳號)
 *    - 誰可以存取：所有人 (Anyone)
 * 6. 點擊「部署」，授權存取後，複製「網頁應用程式網址 (Web App URL)」
 * 7. 將該網址填入前端的 config.js 中的 API_URL
 */

// 教師後台管理密碼
const ADMIN_PASSWORD = "5552472";

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  const params = e.parameter || {};
  let postData = {};
  if (e.postData && e.postData.contents) {
    try {
      postData = JSON.parse(e.postData.contents);
    } catch (err) {
      postData = {};
    }
  }

  // 合併參數，postData 優先
  const req = Object.assign({}, params, postData);
  const action = req.action;

  // 如果 student 是 JSON 字串，自動解析為物件；或支援扁平欄位
  if (req.student && typeof req.student === 'string') {
    try {
      req.student = JSON.parse(req.student);
    } catch (e) {}
  }
  if (!req.student && req.name && req.cjes_account) {
    req.student = {
      class_name: req.class_name,
      seat_number: req.seat_number,
      name: req.name,
      cjes_account: req.cjes_account,
      cjes_password: req.cjes_password
    };
  }

  let result = {};

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    switch (action) {
      case "classes":
        result = getClasses(ss);
        break;
      case "students":
        result = getStudents(ss, req.class);
        break;
      case "verify":
        result = verifyInput(ss, req.student_id, req.field, req.input);
        break;
      case "hint":
        result = getHint(ss, req.student_id, req.field);
        break;
      case "submitScore":
        result = submitScore(ss, req);
        break;
      case "leaderboard":
        result = getLeaderboard(ss, req.grade, req.time_limit, req.limit);
        break;
      
      // ── 教師後台管理相關 API (需驗證管理密碼) ──
      case "adminLogin":
        result = adminLogin(req.password);
        break;
      case "adminStudents":
        result = getAdminStudents(ss, req.password, req.class);
        break;
      case "addStudent":
        result = addStudent(ss, req.password, req.student);
        break;
      case "deleteStudent":
        result = deleteStudent(ss, req.password, req.id);
        break;
      default:
        result = { error: "未知或未提供的 action: " + action };
    }
  } catch (err) {
    result = { error: err.toString() };
  }

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── 輔助函數 ──────────────────────────────────────

function getStudentsSheet(ss) {
  let sheet = ss.getSheetByName("學生資料");
  if (!sheet) {
    sheet = ss.insertSheet("學生資料");
    sheet.appendRow(["id", "班級", "座號", "姓名", "cjes帳號", "cjes密碼"]);
  }
  return sheet;
}

function getScoresSheet(ss) {
  let sheet = ss.getSheetByName("成績記錄");
  if (!sheet) {
    sheet = ss.insertSheet("成績記錄");
    sheet.appendRow(["id", "student_id", "name", "class_name", "score", "rounds", "accuracy", "time_limit", "created_at"]);
  }
  return sheet;
}

// ── API 邏輯 ──────────────────────────────────────

// 1. 取得所有班級列表
function getClasses(ss) {
  const sheet = getStudentsSheet(ss);
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const classesSet = {};
  for (let i = 1; i < data.length; i++) {
    const cls = String(data[i][1]).trim();
    if (cls) classesSet[cls] = true;
  }

  const classes = Object.keys(classesSet).sort();
  return classes;
}

// 2. 取得指定班級學生（不含帳密，保障隱私）
function getStudents(ss, className) {
  if (!className) return { error: "缺少 class 參數" };
  const sheet = getStudentsSheet(ss);
  const data = sheet.getDataRange().getValues();
  const list = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rowClass = String(row[1]).trim();
    if (rowClass === String(className).trim()) {
      list.push({
        id: row[0],
        seat_number: String(row[2]).padStart(2, '0'),
        name: String(row[3]).trim()
      });
    }
  }

  // 依座號排序
  list.sort((a, b) => parseInt(a.seat_number, 10) - parseInt(b.seat_number, 10));
  return list;
}

// 3. 驗證學生輸入
function verifyInput(ss, studentId, field, userInput) {
  if (!studentId || !field) return { error: "缺少參數" };
  const sheet = getStudentsSheet(ss);
  const data = sheet.getDataRange().getValues();
  userInput = (userInput || "").trim();

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (String(row[0]) === String(studentId)) {
      const account = String(row[4]).trim();
      const password = String(row[5]).trim();

      if (field === "account") {
        return {
          correct: userInput === account,
          expected_length: account.length
        };
      } else if (field === "password") {
        return {
          correct: userInput === password,
          expected_length: password.length
        };
      } else {
        return { error: "無效的 field" };
      }
    }
  }

  return { error: "找不到該學生" };
}

// 4. 取得提示
function getHint(ss, studentId, field) {
  if (!studentId || !field) return { error: "缺少參數" };
  const sheet = getStudentsSheet(ss);
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (String(row[0]) === String(studentId)) {
      if (field === "account") {
        const account = String(row[4]).trim();
        const atPos = account.indexOf("@");
        let hint = account;
        if (atPos > 4) {
          hint = account.substring(0, 4) + "*".repeat(atPos - 4) + account.substring(atPos);
        }
        return { hint: hint, length: account.length };
      } else if (field === "password") {
        const password = String(row[5]).trim();
        let hint = password;
        if (password.length > 2) {
          hint = password[0] + "*".repeat(password.length - 2) + password[password.length - 1];
        }
        return { hint: hint, length: password.length };
      }
    }
  }

  return { error: "找不到該學生" };
}

// 5. 儲存遊戲成績
function submitScore(ss, req) {
  const sheet = getScoresSheet(ss);
  const id = Utilities.getUuid();
  const dateStr = Utilities.formatDate(new Date(), "Asia/Taipei", "yyyy-MM-dd HH:mm:ss");

  // 取得學生姓名與班級
  const stuSheet = getStudentsSheet(ss);
  const stuData = stuSheet.getDataRange().getValues();
  let studentName = "";
  let className = "";

  for (let i = 1; i < stuData.length; i++) {
    if (String(stuData[i][0]) === String(req.student_id)) {
      className = stuData[i][1];
      studentName = stuData[i][3];
      break;
    }
  }

  sheet.appendRow([
    id,
    req.student_id,
    studentName,
    className,
    parseInt(req.score, 10) || 0,
    parseInt(req.rounds, 10) || 0,
    parseFloat(req.accuracy) || 0,
    parseInt(req.time_limit, 10) || 60,
    dateStr
  ]);

  return { success: true, message: "成績儲存成功" };
}

// 6. 排行榜
function getLeaderboard(ss, grade, timeLimit, limit) {
  const sheet = getScoresSheet(ss);
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  timeLimit = parseInt(timeLimit || "60", 10);
  limit = parseInt(limit || "50", 10);
  grade = grade || "all";

  // 篩選出符合條件的紀錄
  // 每位學生在同一時限下只取最高分
  const studentBest = {};

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const stuId = String(row[1]);
    const name = String(row[2]);
    const cls = String(row[3]);
    const score = parseInt(row[4], 10);
    const rounds = parseInt(row[5], 10);
    const accuracy = parseFloat(row[6]);
    const tLimit = parseInt(row[7], 10);
    const createdAt = String(row[8]);

    if (tLimit !== timeLimit) continue;
    if (grade !== "all" && !cls.startsWith(grade)) continue;

    if (!studentBest[stuId] || score > studentBest[stuId].score) {
      studentBest[stuId] = {
        name: name,
        class_name: cls,
        score: score,
        rounds: rounds,
        accuracy: accuracy,
        time_limit: tLimit,
        created_at: createdAt
      };
    }
  }

  const list = Object.values(studentBest);
  list.sort((a, b) => b.score - a.score || b.rounds - a.rounds);

  const results = list.slice(0, limit).map((item, idx) => {
    item.rank = idx + 1;
    return item;
  });

  return results;
}

// ── 教師後台管理 API ──────────────────────────────

function checkAdminPassword(password) {
  return String(password).trim() === ADMIN_PASSWORD;
}

function adminLogin(password) {
  if (checkAdminPassword(password)) {
    return { success: true };
  }
  return { success: false, error: "密碼錯誤" };
}

function getAdminStudents(ss, password, className) {
  if (!checkAdminPassword(password)) return { error: "權限不足，管理密碼錯誤" };

  const sheet = getStudentsSheet(ss);
  const data = sheet.getDataRange().getValues();
  const list = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rowClass = String(row[1]).trim();
    if (!className || className === "all" || rowClass === String(className).trim()) {
      list.push({
        id: row[0],
        class_name: rowClass,
        seat_number: String(row[2]).padStart(2, '0'),
        name: String(row[3]).trim(),
        cjes_account: String(row[4]).trim(),
        cjes_password: String(row[5]).trim()
      });
    }
  }

  return { success: true, data: list };
}

function addStudent(ss, password, student) {
  if (!checkAdminPassword(password)) return { error: "權限不足，管理密碼錯誤" };
  if (!student || !student.class_name || !student.name || !student.cjes_account || !student.cjes_password) {
    return { error: "學生資料不齊全" };
  }

  const sheet = getStudentsSheet(ss);
  const data = sheet.getDataRange().getValues();
  
  // 計算新的 ID (取最大 ID + 1)
  let maxId = 0;
  for (let i = 1; i < data.length; i++) {
    const idVal = parseInt(data[i][0], 10);
    if (!isNaN(idVal) && idVal > maxId) {
      maxId = idVal;
    }
  }
  const newId = maxId + 1;

  sheet.appendRow([
    newId,
    String(student.class_name).trim(),
    String(student.seat_number || "").padStart(2, '0'),
    String(student.name).trim(),
    String(student.cjes_account).trim(),
    String(student.cjes_password).trim()
  ]);

  return { success: true, message: "新增成功", id: newId };
}

function deleteStudent(ss, password, id) {
  if (!checkAdminPassword(password)) return { error: "權限不足，管理密碼錯誤" };
  if (!id) return { error: "缺少 id 參數" };

  const sheet = getStudentsSheet(ss);
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      sheet.deleteRow(i + 1); // 試算表行數從 1 開始，標題列是第 1 列
      return { success: true, message: "刪除成功" };
    }
  }

  return { error: "找不到該學生" };
}
