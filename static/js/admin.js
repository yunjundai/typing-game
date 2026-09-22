/* ═══════════════════════════════════════════════
   教師後台管理邏輯 (admin.js)
   ═══════════════════════════════════════════════ */

let currentAdminPassword = '';
let allStudentsList = [];

document.addEventListener('DOMContentLoaded', () => {
    const pwdInput = document.getElementById('admin-password-input');
    if (pwdInput) {
        pwdInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') doAdminLogin();
        });
    }
});

// ── 前往教師後台（單頁按鈕切換） ──────────────────
function goToAdmin() {
    if (currentAdminPassword) {
        showScreen('screen-admin-dashboard');
        loadAllStudents();
    } else {
        showScreen('screen-admin-login');
        const pwdInput = document.getElementById('admin-password-input');
        if (pwdInput) {
            pwdInput.value = '';
            setTimeout(() => pwdInput.focus(), 200);
        }
    }
}

// ── 登入驗證 ─────────────────────────────────────
async function doAdminLogin() {
    const pwdInput = document.getElementById('admin-password-input');
    const feedback = document.getElementById('login-feedback');
    const password = pwdInput.value.trim();

    if (!password) {
        feedback.textContent = '請輸入管理密碼！';
        feedback.className = 'feedback wrong';
        return;
    }

    if (password === '5552472') {
        currentAdminPassword = password;
        showScreen('screen-admin-dashboard');
        loadAllStudents();
    } else {
        feedback.textContent = '❌ 密碼錯誤！';
        feedback.className = 'feedback wrong';
    }
}

// ── 載入所有學生 ─────────────────────────────────
async function loadAllStudents() {
    const tbody = document.getElementById('admin-tbody');
    tbody.innerHTML = '<tr><td colspan="7" style="padding: 30px; color: #b2bec3;">資料載入中...</td></tr>';

    try {
        if (isSupabaseConfigured()) {
            // ⚡ Supabase 極速查詢所有學生（支援即時排序）
            const { data, error } = await supabaseClient
                .from('students')
                .select('id, class_name, seat_number, name, cjes_account, cjes_password')
                .order('class_name', { ascending: true })
                .order('seat_number', { ascending: true });

            if (!error && data) {
                allStudentsList = data;
                updateClassFilterOptions();
                filterStudents();
            } else {
                tbody.innerHTML = `<tr><td colspan="7" style="color: #d63031;">載入失敗: ${error ? error.message : '未知錯誤'}</td></tr>`;
            }
        } else {
            const res = await fetch('/api/admin/students', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: currentAdminPassword })
            });
            const result = await res.json();
            if (result.success) {
                allStudentsList = result.data || [];
                updateClassFilterOptions();
                filterStudents();
            } else {
                tbody.innerHTML = `<tr><td colspan="7" style="color: #d63031;">載入失敗: ${result.error}</td></tr>`;
            }
        }
    } catch (err) {
        console.error('載入學生失敗:', err);
        tbody.innerHTML = '<tr><td colspan="7" style="color: #d63031;">無法連線至伺服器</td></tr>';
    }
}

// ── 班級選單更新 ─────────────────────────────────
function updateClassFilterOptions() {
    const select = document.getElementById('filter-class');
    const classes = [...new Set(allStudentsList.map(s => String(s.class_name).trim()))].sort();
    
    const currentVal = select.value;
    select.innerHTML = '<option value="all">全部班級</option>';
    classes.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = `${c} 班`;
        select.appendChild(opt);
    });
    select.value = currentVal || 'all';
}

// ── 篩選與搜尋 ───────────────────────────────────
function filterStudents() {
    const selectedClass = document.getElementById('filter-class').value;
    const query = document.getElementById('search-name').value.trim().toLowerCase();

    const filtered = allStudentsList.filter(stu => {
        const matchClass = selectedClass === 'all' || String(stu.class_name).trim() === selectedClass;
        const matchQuery = !query || 
            String(stu.name).toLowerCase().includes(query) || 
            String(stu.cjes_account).toLowerCase().includes(query) ||
            String(stu.seat_number).includes(query);
        return matchClass && matchQuery;
    });

    renderAdminTable(filtered);
}

// ── 渲染學生列表 ─────────────────────────────────
function renderAdminTable(list) {
    const tbody = document.getElementById('admin-tbody');
    document.getElementById('student-count').textContent = `${list.length} 人`;

    if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="padding: 30px; color: #b2bec3;">無符合條件的學生資料</td></tr>';
        return;
    }

    tbody.innerHTML = list.map(stu => `
        <tr>
            <td>${stu.id}</td>
            <td><strong>${stu.class_name}</strong></td>
            <td>${stu.seat_number}</td>
            <td>${stu.name}</td>
            <td>
                <code>${stu.cjes_account}</code>
                <button class="btn-copy" onclick="copyText('${stu.cjes_account}')">複製</button>
            </td>
            <td>
                <span style="font-family: monospace; background: #eee; padding: 2px 6px; border-radius: 4px;">${stu.cjes_password}</span>
                <button class="btn-copy" onclick="copyText('${stu.cjes_password}')">複製</button>
            </td>
            <td>
                <button class="btn-del" onclick="confirmDeleteStudent(${stu.id}, '${stu.name}')">刪除</button>
            </td>
        </tr>
    `).join('');
}

// ── 複製文字功能 ─────────────────────────────────
function copyText(text) {
    navigator.clipboard.writeText(text).then(() => {
        alert('已複製到剪貼簿：' + text);
    }).catch(err => {
        prompt('請手動複製：', text);
    });
}

// ── 新增學生彈窗 ─────────────────────────────────
function openAddModal() {
    document.getElementById('new-class').value = '';
    document.getElementById('new-seat').value = '';
    document.getElementById('new-name').value = '';
    document.getElementById('new-account').value = '';
    document.getElementById('new-password').value = '';
    document.getElementById('add-modal').classList.add('active');
}

function closeAddModal() {
    document.getElementById('add-modal').classList.remove('active');
}

async function submitAddStudent() {
    const className = document.getElementById('new-class').value.trim();
    const seatNum = document.getElementById('new-seat').value.trim();
    const name = document.getElementById('new-name').value.trim();
    const account = document.getElementById('new-account').value.trim();
    const password = document.getElementById('new-password').value.trim();

    if (!className || !name || !account || !password) {
        alert('請填寫完整資訊（班級、姓名、帳號、密碼為必填）！');
        return;
    }

    try {
        if (isSupabaseConfigured()) {
            // ⚡ 前端計算安全 Hash 與提示
            const accHash = await sha256Hex(account);
            const pwdHash = await sha256Hex(password);
            const atPos = account.indexOf('@');
            const accHint = atPos > 4 ? account.substring(0, 4) + '*'.repeat(atPos - 4) + account.substring(atPos) : account;
            const pwdHint = password.length > 2 ? password[0] + '*'.repeat(password.length - 2) + password[password.length - 1] : password;

            const { error } = await supabaseClient
                .from('students')
                .insert([{
                    class_name: className,
                    seat_number: seatNum.padStart(2, '0'),
                    name: name,
                    cjes_account: account,
                    cjes_password: password,
                    acc_hash: accHash,
                    pwd_hash: pwdHash,
                    acc_len: account.length,
                    pwd_len: password.length,
                    acc_hint: accHint,
                    pwd_hint: pwdHint
                }]);

            if (!error) {
                alert('✅ 學生新增成功！');
                closeAddModal();
                loadAllStudents();
            } else {
                alert('❌ 新增失敗：' + error.message);
            }
        } else {
            const res = await fetch('/api/admin/add_student', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    password: currentAdminPassword,
                    student: {
                        class_name: className,
                        seat_number: seatNum,
                        name: name,
                        cjes_account: account,
                        cjes_password: password
                    }
                })
            });
            const result = await res.json();
            if (result.success) {
                alert('✅ 學生新增成功！');
                closeAddModal();
                loadAllStudents();
            } else {
                alert('❌ 新增失敗：' + (result.error || '未知錯誤'));
            }
        }
    } catch (err) {
        console.error('新增失敗:', err);
        alert('❌ 網路請求失敗');
    }
}

// ── 刪除學生 ─────────────────────────────────────
async function confirmDeleteStudent(id, name) {
    if (!confirm(`確定要刪除學生「${name}」(ID: ${id}) 嗎？\n此動作無法復原！`)) {
        return;
    }

    try {
        if (isSupabaseConfigured()) {
            const { error } = await supabaseClient
                .from('students')
                .delete()
                .eq('id', id);

            if (!error) {
                alert('✅ 學生已刪除！');
                loadAllStudents();
            } else {
                alert('❌ 刪除失敗：' + error.message);
            }
        } else {
            const res = await fetch('/api/admin/delete_student', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    password: currentAdminPassword,
                    id: id
                })
            });
            const result = await res.json();
            if (result.success) {
                alert('✅ 學生已刪除！');
                loadAllStudents();
            } else {
                alert('❌ 刪除失敗：' + (result.error || '未知錯誤'));
            }
        }
    } catch (err) {
        console.error('刪除失敗:', err);
        alert('❌ 網路請求失敗');
    }
}

/* ═══════════════════════════════════════════════
   後台分頁切換與擴充功能 (Tab 控制)
   ═══════════════════════════════════════════════ */

let allPracticeData = []; // 儲存彙總後的學生練習紀錄
let currentMgmtLeaderboardData = []; // 儲存當前排行榜管理資料

function switchAdminTab(tabId, btn) {
    // 切換按鈕 active 樣式
    document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');

    // 切換面板顯示
    document.querySelectorAll('.admin-panel-view').forEach(panel => panel.classList.remove('active'));
    const targetPanel = document.getElementById(tabId);
    if (targetPanel) targetPanel.classList.add('active');

    // 依據進入的分頁進行資料載入
    if (tabId === 'tab-students') {
        if (allStudentsList.length === 0) loadAllStudents();
    } else if (tabId === 'tab-practice') {
        loadPracticeStatus();
    } else if (tabId === 'tab-leaderboard-mgmt') {
        loadLeaderboardMgmt();
    }
}

/* ═══════════════════════════════════════════════
   功能 2：學生練習狀況總覽 (tab-practice)
   ═══════════════════════════════════════════════ */

// 時限選單變更時重新載入資料
function reloadPracticeByTimeLimit() {
    loadPracticeStatus();
}

async function loadPracticeStatus() {
    const tbody = document.getElementById('practice-tbody');
    const summaryBadge = document.getElementById('practice-summary');
    tbody.innerHTML = '<tr><td colspan="8" style="padding: 30px; color: #b2bec3;">正在統整學生練習資料...</td></tr>';
    summaryBadge.textContent = '統計中...';

    // 讀取目前時限篩選值
    const timeLimitVal = document.getElementById('filter-practice-timelimit')?.value || 'all';

    try {
        if (isSupabaseConfigured()) {
            // 1. 取得所有學生名單
            let students = allStudentsList;
            if (!students || students.length === 0) {
                const { data: stuData, error: stuErr } = await supabaseClient
                    .from('students')
                    .select('id, class_name, seat_number, name')
                    .order('class_name', { ascending: true })
                    .order('seat_number', { ascending: true });
                if (stuErr) throw stuErr;
                students = stuData || [];
                allStudentsList = students;
            }

            // 2. 取得練習成績紀錄（依時限篩選條件決定是否加 time_limit 條件）
            let scoreQuery = supabaseClient
                .from('scores')
                .select('id, student_id, student_name, class_name, score, accuracy, time_limit, created_at');

            // 若有選擇特定時限，加入篩選條件
            if (timeLimitVal !== 'all') {
                scoreQuery = scoreQuery.eq('time_limit', parseInt(timeLimitVal));
            }

            const { data: scoreData, error: scoreErr } = await scoreQuery;
            if (scoreErr) throw scoreErr;

            // 3. 建立學生成績統計映射 (Map by student_id 或 name+class)
            const scoreMap = new Map();
            (scoreData || []).forEach(sc => {
                // 優先使用 student_id，若無則依據 class_name + name
                const key = sc.student_id ? `id_${sc.student_id}` : `key_${String(sc.class_name).trim()}_${String(sc.student_name).trim()}`;
                if (!scoreMap.has(key)) {
                    scoreMap.set(key, []);
                }
                scoreMap.get(key).push(sc);
            });

            // 4. 彙整每位學生的練習情況
            allPracticeData = students.map(stu => {
                const keyById = `id_${stu.id}`;
                const keyByName = `key_${String(stu.class_name).trim()}_${String(stu.name).trim()}`;
                const scores = scoreMap.get(keyById) || scoreMap.get(keyByName) || [];

                const count = scores.length;
                let maxScore = 0;
                let avgAcc = 0;
                let lastTime = '-';

                if (count > 0) {
                    maxScore = Math.max(...scores.map(s => Number(s.score) || 0));
                    const totalAcc = scores.reduce((sum, s) => sum + (Number(s.accuracy) || 0), 0);
                    avgAcc = Math.round(totalAcc / count);

                    // 找出最新的時間
                    const sortedDates = scores.map(s => new Date(s.created_at)).filter(d => !isNaN(d.getTime())).sort((a, b) => b - a);
                    if (sortedDates.length > 0) {
                        const d = sortedDates[0];
                        const pad = (n) => String(n).padStart(2, '0');
                        lastTime = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
                    }
                }

                return {
                    id: stu.id,
                    class_name: stu.class_name,
                    seat_number: stu.seat_number,
                    name: stu.name,
                    hasPracticed: count > 0,
                    practiceCount: count,
                    maxScore: maxScore,
                    avgAccuracy: avgAcc,
                    lastTime: lastTime
                };
            });

            // 更新練習狀況專用班級選單
            updatePracticeClassFilterOptions();
            filterPracticeStatus();

        } else {
            tbody.innerHTML = '<tr><td colspan="8" style="color: #636e72; padding: 20px;">目前處於本機展示模式，請串接 Supabase 後使用此完整統計功能。</td></tr>';
        }
    } catch (err) {
        console.error('統計學生練習狀況失敗:', err);
        tbody.innerHTML = `<tr><td colspan="8" style="color: #d63031;">資料載入失敗: ${err.message || '連線異常'}</td></tr>`;
    }
}

function updatePracticeClassFilterOptions() {
    const select = document.getElementById('filter-practice-class');
    if (!select) return;
    const classes = [...new Set(allPracticeData.map(s => String(s.class_name).trim()))].sort();
    
    const currentVal = select.value;
    select.innerHTML = '<option value="all">全部班級</option>';
    classes.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = `${c} 班`;
        select.appendChild(opt);
    });
    select.value = currentVal || 'all';
}

function filterPracticeStatus() {
    const classFilter = document.getElementById('filter-practice-class')?.value || 'all';
    const statusFilter = document.getElementById('filter-practice-status')?.value || 'all';
    const searchFilter = document.getElementById('search-practice-student')?.value.trim().toLowerCase() || '';

    // 統計當前所選班級的整體情況
    const classBaseList = allPracticeData.filter(item => classFilter === 'all' || String(item.class_name).trim() === classFilter);
    const practicedTotal = classBaseList.filter(s => s.hasPracticed).length;
    const unpracticedTotal = classBaseList.length - practicedTotal;
    const rate = classBaseList.length > 0 ? Math.round((practicedTotal / classBaseList.length) * 100) : 0;

    const summaryBadge = document.getElementById('practice-summary');
    if (summaryBadge) {
        summaryBadge.textContent = `已練: ${practicedTotal} 人 / 未練: ${unpracticedTotal} 人 (完成率 ${rate}%)`;
    }

    // 依狀態與搜尋篩選呈現
    const filtered = classBaseList.filter(item => {
        if (statusFilter === 'done' && !item.hasPracticed) return false;
        if (statusFilter === 'none' && item.hasPracticed) return false;
        if (searchFilter) {
            const matchName = String(item.name).toLowerCase().includes(searchFilter);
            const matchSeat = String(item.seat_number).includes(searchFilter);
            if (!matchName && !matchSeat) return false;
        }
        return true;
    });

    renderPracticeTable(filtered);
}

function renderPracticeTable(list) {
    const tbody = document.getElementById('practice-tbody');
    if (!tbody) return;

    if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="padding: 30px; color: #b2bec3;">無符合條件的學生練習資料</td></tr>';
        return;
    }

    tbody.innerHTML = list.map(stu => `
        <tr>
            <td><strong>${stu.class_name}</strong></td>
            <td>${stu.seat_number}</td>
            <td>${stu.name}</td>
            <td>
                ${stu.hasPracticed 
                    ? '<span class="badge-practice-yes">✅ 已完成練習</span>' 
                    : '<span class="badge-practice-no">⚠️ 尚未練習</span>'}
            </td>
            <td><strong style="color: ${stu.practiceCount > 0 ? '#0984e3' : '#b2bec3'};">${stu.practiceCount} 次</strong></td>
            <td>${stu.hasPracticed ? `<span style="font-weight: 700; color: #d63031;">${stu.maxScore} 分</span>` : '-'}</td>
            <td>${stu.hasPracticed ? `${stu.avgAccuracy}%` : '-'}</td>
            <td style="font-size: 0.88rem; color: #636e72;">${stu.lastTime}</td>
        </tr>
    `).join('');
}

/* ═══════════════════════════════════════════════
   功能 1：排行榜管理與成績清除 (tab-leaderboard-mgmt)
   ═══════════════════════════════════════════════ */

async function loadLeaderboardMgmt() {
    const tbody = document.getElementById('mgmt-leaderboard-tbody');
    tbody.innerHTML = '<tr><td colspan="9" style="padding: 30px; color: #b2bec3;">排行榜資料載入中...</td></tr>';

    const timeLimit = parseInt(document.getElementById('filter-mgmt-timelimit').value) || 60;
    const grade = document.getElementById('filter-mgmt-grade').value;

    try {
        if (isSupabaseConfigured()) {
            let query = supabaseClient
                .from('scores')
                .select('id, student_name, class_name, score, rounds, accuracy, time_limit, created_at')
                .eq('time_limit', timeLimit)
                .order('score', { ascending: false })
                .order('accuracy', { ascending: false })
                .order('created_at', { ascending: true })
                .limit(100);

            if (grade !== 'all') {
                query = query.like('class_name', `${grade}%`);
            }

            const { data, error } = await query;
            if (error) throw error;

            currentMgmtLeaderboardData = data || [];
            renderMgmtLeaderboard(currentMgmtLeaderboardData);

        } else {
            tbody.innerHTML = '<tr><td colspan="9" style="color: #636e72; padding: 20px;">本機模式下無遠端資料庫紀錄</td></tr>';
        }
    } catch (err) {
        console.error('載入排行榜管理資料失敗:', err);
        tbody.innerHTML = `<tr><td colspan="9" style="color: #d63031;">載入失敗: ${err.message}</td></tr>`;
    }
}

function renderMgmtLeaderboard(list) {
    const tbody = document.getElementById('mgmt-leaderboard-tbody');
    if (!tbody) return;

    if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="padding: 30px; color: #b2bec3;">目前條件下尚無成績紀錄</td></tr>';
        return;
    }

    tbody.innerHTML = list.map((item, index) => {
        let rankBadge = `${index + 1}`;
        if (index === 0) rankBadge = '🥇 1';
        else if (index === 1) rankBadge = '🥈 2';
        else if (index === 2) rankBadge = '🥉 3';

        // 格式化測驗時間
        let dateStr = '-';
        if (item.created_at) {
            const d = new Date(item.created_at);
            if (!isNaN(d.getTime())) {
                const pad = (n) => String(n).padStart(2, '0');
                dateStr = `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
            }
        }

        return `
            <tr>
                <td><strong>${rankBadge}</strong></td>
                <td>${item.class_name || '-'}</td>
                <td><strong>${item.student_name || '無名氏'}</strong></td>
                <td><span style="font-weight: 700; color: #d63031;">${item.score}</span></td>
                <td>${item.rounds || 0}</td>
                <td>${item.accuracy || 100}%</td>
                <td>${Math.round((item.time_limit || 60) / 60)} 分鐘</td>
                <td style="font-size: 0.85rem; color: #636e72;">${dateStr}</td>
                <td>
                    <button class="btn-del" onclick="deleteSingleScore(${item.id}, '${item.student_name}', ${item.score})">🗑️ 清除</button>
                </td>
            </tr>
        `;
    }).join('');
}

// ── 單筆清除某項成績 ──
async function deleteSingleScore(scoreId, studentName, score) {
    if (!confirm(`確定要清除學生「${studentName}」的此筆成績（${score} 分）嗎？\n清除後將從排行榜移除！`)) {
        return;
    }

    try {
        if (isSupabaseConfigured()) {
            const { error } = await supabaseClient
                .from('scores')
                .delete()
                .eq('id', scoreId);

            if (!error) {
                alert('✅ 該筆成績已成功清除！');
                loadLeaderboardMgmt();
            } else {
                alert('❌ 清除失敗：' + error.message);
            }
        } else {
            alert('本機模式不支援刪除成績');
        }
    } catch (err) {
        console.error('刪除成績失敗:', err);
        alert('❌ 操作失敗，請檢查網路連線');
    }
}

// ── 一鍵清空目前條件所有成績 ──
async function clearAllScoresForCurrentFilter() {
    const timeLimit = parseInt(document.getElementById('filter-mgmt-timelimit').value) || 60;
    const grade = document.getElementById('filter-mgmt-grade').value;
    const timeText = `${Math.round(timeLimit / 60)} 分鐘挑戰`;
    const gradeText = grade === 'all' ? '全部年級' : `${grade} 年級`;

    const confirmMsg = `⚠️【危險操作確認】\n您即將清除「${timeText}」且屬於「${gradeText}」的所有排行榜成績！\n\n此動作無法還原，請確認是否繼續？`;
    if (!confirm(confirmMsg)) return;

    // 二次輸入驗證以防誤按
    const doubleCheck = prompt(`請輸入「清除」兩字以確認清空【${timeText} - ${gradeText}】的所有成績：`);
    if (doubleCheck !== '清除') {
        alert('操作已取消');
        return;
    }

    try {
        if (isSupabaseConfigured()) {
            let query = supabaseClient
                .from('scores')
                .delete()
                .eq('time_limit', timeLimit);

            if (grade !== 'all') {
                query = query.like('class_name', `${grade}%`);
            }

            const { error } = await query;
            if (!error) {
                alert(`✅ 已清空【${timeText} - ${gradeText}】的排行榜資料！`);
                loadLeaderboardMgmt();
            } else {
                alert('❌ 清除失敗：' + error.message);
            }
        } else {
            alert('本機展示模式不支援此操作');
        }
    } catch (err) {
        console.error('清空成績失敗:', err);
        alert('❌ 發生錯誤，請稍候再試');
    }
}

/* ═══════════════════════════════════════════════
   功能：匯出成績表為 CSV/Excel 格式
   ═══════════════════════════════════════════════ */

// ── 通用 CSV 下載輔助函式（自動加入 UTF-8 BOM，防止 Excel 開啟中文亂碼） ──
function downloadCSV(filename, rows) {
    try {
        const processRow = (row) => row.map(val => {
            let str = (val === null || val === undefined) ? '' : String(val);
            if (str.search(/("|,|\n|\r)/g) >= 0) {
                str = '"' + str.replace(/"/g, '""') + '"';
            }
            return str;
        }).join(',');

        const csvContent = '\uFEFF' + rows.map(processRow).join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        
        // 支援 IE / Edge 舊版或現代瀏覽器
        if (navigator.msSaveBlob) {
            navigator.msSaveBlob(blob, filename);
            return;
        }

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.setAttribute('download', filename);
        document.body.appendChild(a);
        a.click();
        
        // 延遲移除避免部分瀏覽器在下載前釋放
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 1000);
    } catch (err) {
        console.error('下載 CSV 失敗:', err);
        alert('❌ 產生下載檔案失敗：' + err.message);
    }
}

// ── 匯出學生練習狀況成績表（若尚未載入自動從 Supabase 即時取得） ──
async function exportPracticeToCSV() {
    const exportBtn = document.querySelector("button[onclick='exportPracticeToCSV()']");
    const originalText = exportBtn ? exportBtn.innerHTML : '';
    if (exportBtn) {
        exportBtn.disabled = true;
        exportBtn.innerHTML = '⏳ 匯出產製中...';
    }

    try {
        // 如果目前記憶體尚未快取練習資料，自動即時載入
        if (!allPracticeData || allPracticeData.length === 0) {
            await loadPracticeStatus();
        }

        if (!allPracticeData || allPracticeData.length === 0) {
            alert('⚠️ 無法取得學生資料，請確認網路連線或稍候再試！');
            return;
        }

        const classFilter = document.getElementById('filter-practice-class')?.value || 'all';
        const statusFilter = document.getElementById('filter-practice-status')?.value || 'all';
        const searchFilter = document.getElementById('search-practice-student')?.value.trim().toLowerCase() || '';

        // 依目前後台設定的篩選條件過濾要匯出的名單
        const targetList = allPracticeData.filter(item => {
            if (classFilter !== 'all' && String(item.class_name).trim() !== classFilter) return false;
            if (statusFilter === 'done' && !item.hasPracticed) return false;
            if (statusFilter === 'none' && item.hasPracticed) return false;
            if (searchFilter) {
                const matchName = String(item.name).toLowerCase().includes(searchFilter);
                const matchSeat = String(item.seat_number).includes(searchFilter);
                if (!matchName && !matchSeat) return false;
            }
            return true;
        });

        if (targetList.length === 0) {
            alert('⚠️ 目前篩選條件下沒有學生資料可匯出！');
            return;
        }

        // 準備 CSV 表頭與資料列
        const headers = [
            '班級',
            '座號',
            '姓名',
            '練習狀態',
            '累計練習次數',
            '最高分紀錄',
            '平均正確率(%)',
            '最近練習時間'
        ];

        const rows = [headers];
        targetList.forEach(s => {
            rows.push([
                s.class_name,
                s.seat_number,
                s.name,
                s.hasPracticed ? '已完成練習' : '尚未練習',
                s.practiceCount,
                s.hasPracticed ? s.maxScore : 0,
                s.hasPracticed ? `${s.avgAccuracy}%` : '-',
                s.lastTime
            ]);
        });

        // 檔名：竹仁國小_學生打字練習成績表_[班級]_[日期].csv
        const today = new Date().toISOString().slice(0, 10);
        const classLabel = classFilter === 'all' ? '全部班級' : `${classFilter}班`;
        const filename = `竹仁國小_打字練習成績表_${classLabel}_${today}.csv`;

        downloadCSV(filename, rows);
    } catch (err) {
        console.error('匯出練習表失敗:', err);
        alert('❌ 匯出失敗：' + err.message);
    } finally {
        if (exportBtn) {
            exportBtn.disabled = false;
            exportBtn.innerHTML = originalText;
        }
    }
}

// ── 匯出排行榜成績表 ──
async function exportLeaderboardToCSV() {
    const exportBtn = document.querySelector("button[onclick='exportLeaderboardToCSV()']");
    const originalText = exportBtn ? exportBtn.innerHTML : '';
    if (exportBtn) {
        exportBtn.disabled = true;
        exportBtn.innerHTML = '⏳ 匯出產製中...';
    }

    try {
        if (!currentMgmtLeaderboardData || currentMgmtLeaderboardData.length === 0) {
            await loadLeaderboardMgmt();
        }

        if (!currentMgmtLeaderboardData || currentMgmtLeaderboardData.length === 0) {
            alert('⚠️ 目前條件下尚無排行榜資料可供匯出！');
            return;
        }

        const timeLimit = parseInt(document.getElementById('filter-mgmt-timelimit').value) || 60;
        const grade = document.getElementById('filter-mgmt-grade').value;
        const timeText = `${Math.round(timeLimit / 60)}分鐘挑戰`;
        const gradeText = grade === 'all' ? '全部年級' : `${grade}年級`;

        const headers = [
            '排名',
            '班級',
            '姓名',
            '得分',
            '完成次數',
            '正確率(%)',
            '挑戰時限',
            '測驗時間'
        ];

        const rows = [headers];
        currentMgmtLeaderboardData.forEach((item, idx) => {
            let dateStr = '-';
            if (item.created_at) {
                const d = new Date(item.created_at);
                if (!isNaN(d.getTime())) {
                    const pad = (n) => String(n).padStart(2, '0');
                    dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
                }
            }

            rows.push([
                idx + 1,
                item.class_name || '-',
                item.student_name || '無名氏',
                item.score,
                item.rounds || 0,
                `${item.accuracy || 100}%`,
                timeText,
                dateStr
            ]);
        });

        const today = new Date().toISOString().slice(0, 10);
        const filename = `竹仁國小_打字排行榜_${gradeText}_${timeText}_${today}.csv`;

        downloadCSV(filename, rows);
    } catch (err) {
        console.error('匯出排行榜失敗:', err);
        alert('❌ 匯出失敗：' + err.message);
    } finally {
        if (exportBtn) {
            exportBtn.disabled = false;
            exportBtn.innerHTML = originalText;
        }
    }
}
