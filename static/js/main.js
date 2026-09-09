/* ═══════════════════════════════════════════════
   帳號密碼練習遊戲 — 主程式邏輯 (支援 GitHub Pages / Google Apps Script)
   ═══════════════════════════════════════════════ */

// ── 遊戲狀態 ─────────────────────────────────────
const state = {
    selectedClass: null,
    selectedStudent: null,  // { id, name, seat_number }
    timeLimit: 60,

    // 遊戲進行中的狀態
    currentField: 'account',  // 'account' 或 'password'
    score: 0,
    rounds: 0,
    correctAttempts: 0,
    totalAttempts: 0,
    wrongStreak: 0,          // 連續錯誤次數（用於提示）
    expectedLength: 0,

    timer: null,
    timeRemaining: 0,
    gameActive: false,

    // 排行榜篩選
    leaderboardGrade: 'all',
    leaderboardTime: 60,

    // 返回排行榜前的畫面
    previousScreen: 'screen-welcome',
};

// ── 初始化 ───────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    loadClasses();
    setupInputHandler();
});

// ── 畫面切換 ─────────────────────────────────────
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(screenId);
    if (target) {
        target.classList.add('active');
        target.style.animation = 'none';
        target.offsetHeight; // force reflow
        target.style.animation = '';
    }
}

// ══════════════════════════════════════════════════
// 畫面一：載入班級列表
// ══════════════════════════════════════════════════

async function loadClasses() {
    try {
        let classes = [];
        // 若已設定 Google Apps Script API，則呼叫 apiRequest
        if (typeof API_URL !== 'undefined' && !API_URL.includes('YOUR-DEPLOYMENT-ID')) {
            classes = await apiRequest('classes', {}, 'GET');
        } else {
            // 本地 Flask 模式備援
            const res = await fetch('/api/classes');
            classes = await res.json();
        }

        const gradeContainers = {
            '3': document.getElementById('classes-grade-3'),
            '4': document.getElementById('classes-grade-4'),
            '5': document.getElementById('classes-grade-5'),
            '6': document.getElementById('classes-grade-6'),
        };

        // 清空
        Object.values(gradeContainers).forEach(c => { if(c) c.innerHTML = ''; });

        classes.forEach(className => {
            const grade = String(className).charAt(0);
            const container = gradeContainers[grade];
            if (!container) return;

            const btn = document.createElement('button');
            btn.className = `class-btn grade-${grade}`;
            btn.textContent = className;
            btn.onclick = () => selectClass(className);
            container.appendChild(btn);
        });

        // 隱藏空的年級區塊
        for (const [grade, container] of Object.entries(gradeContainers)) {
            if (!container) continue;
            const section = container.closest('.grade-section');
            if (container.children.length === 0 && section) {
                section.style.display = 'none';
            } else if (section) {
                section.style.display = 'block';
            }
        }
    } catch (err) {
        console.error('載入班級失敗:', err);
    }
}

// ══════════════════════════════════════════════════
// 畫面二：載入學生名單
// ══════════════════════════════════════════════════

async function selectClass(className) {
    state.selectedClass = className;
    document.getElementById('class-title').textContent = `📋 ${className} 班`;

    try {
        let students = [];
        if (typeof API_URL !== 'undefined' && !API_URL.includes('YOUR-DEPLOYMENT-ID')) {
            students = await apiRequest('students', { class: className }, 'GET');
        } else {
            const res = await fetch(`/api/students?class=${className}`);
            students = await res.json();
        }

        const grid = document.getElementById('student-grid');
        grid.innerHTML = '';

        students.forEach(student => {
            const btn = document.createElement('button');
            btn.className = 'student-btn';
            btn.innerHTML = `<span class="seat">${student.seat_number}號</span>${student.name}`;
            btn.onclick = () => selectStudent(student);
            grid.appendChild(btn);
        });

        showScreen('screen-students');
    } catch (err) {
        console.error('載入學生失敗:', err);
    }
}

// ══════════════════════════════════════════════════
// 畫面三：選擇學生 → 顯示時間選項
// ══════════════════════════════════════════════════

function selectStudent(student) {
    state.selectedStudent = student;
    document.getElementById('player-greeting').textContent =
        `你好，${state.selectedClass} ${student.name}！準備好了嗎？`;
    showScreen('screen-settings');
}

// ══════════════════════════════════════════════════
// 畫面四：開始遊戲
// ══════════════════════════════════════════════════

function startGame(timeLimit) {
    state.timeLimit = timeLimit;
    state.timeRemaining = timeLimit;
    state.score = 0;
    state.rounds = 0;
    state.correctAttempts = 0;
    state.totalAttempts = 0;
    state.wrongStreak = 0;
    state.currentField = 'account';
    state.gameActive = false;

    showScreen('screen-game');

    updateGameUI();
    updateStats();
    updateTimerDisplay();
    document.getElementById('timer-bar').style.width = '100%';
    document.getElementById('timer-bar').className = 'timer-bar';
    document.getElementById('game-input').value = '';
    document.getElementById('feedback').textContent = '';
    document.getElementById('feedback').className = 'feedback';
    document.getElementById('hint-area').style.display = 'none';
    document.getElementById('hint-text').textContent = '';

    showCountdown(3, () => {
        state.gameActive = true;
        document.getElementById('game-input').focus();
        startTimer();
    });
}

function showCountdown(count, callback) {
    if (count <= 0) {
        callback();
        return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'countdown-overlay';
    const num = document.createElement('div');
    num.className = 'countdown-number';
    num.textContent = count === 1 ? 'GO!' : count;
    overlay.appendChild(num);
    document.body.appendChild(overlay);

    setTimeout(() => {
        overlay.remove();
        if (count === 1) {
            callback();
        } else {
            showCountdown(count - 1, callback);
        }
    }, 800);
}

function startTimer() {
    state.timer = setInterval(() => {
        state.timeRemaining--;
        updateTimerDisplay();
        updateTimerBar();

        if (state.timeRemaining <= 0) {
            endGame();
        }
    }, 1000);
}

function updateTimerDisplay() {
    const minutes = Math.floor(state.timeRemaining / 60);
    const seconds = state.timeRemaining % 60;
    const timerText = document.getElementById('timer-text');
    timerText.textContent =
        `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    const pct = state.timeRemaining / state.timeLimit;
    timerText.className = 'timer-text';
    if (pct <= 0.1) {
        timerText.classList.add('danger');
    } else if (pct <= 0.3) {
        timerText.classList.add('warning');
    }
}

function updateTimerBar() {
    const pct = (state.timeRemaining / state.timeLimit) * 100;
    const bar = document.getElementById('timer-bar');
    bar.style.width = pct + '%';

    bar.className = 'timer-bar';
    if (pct <= 10) {
        bar.classList.add('danger');
    } else if (pct <= 30) {
        bar.classList.add('warning');
    }
}

function updateGameUI() {
    const stepAccount = document.getElementById('step-account');
    const stepPassword = document.getElementById('step-password');
    const prompt = document.getElementById('game-prompt');
    const formatHint = document.getElementById('game-format-hint');
    const input = document.getElementById('game-input');
    const toggleBtn = document.getElementById('btn-toggle-pwd');

    if (state.currentField === 'account') {
        stepAccount.className = 'step active';
        stepPassword.className = 'step';
        prompt.textContent = '📧 請輸入你的帳號';
        formatHint.textContent = '格式：cjesXXXXXX@cjes.hcc.edu.tw';
        input.placeholder = '輸入 cjes 帳號...';
        input.type = 'text';
        if (toggleBtn) toggleBtn.style.display = 'none';
    } else {
        stepAccount.className = 'step done';
        stepPassword.className = 'step active';
        prompt.textContent = '🔑 請輸入你的密碼';
        formatHint.textContent = '注意英文大小寫！可點右側眼睛切換顯示/隱藏';
        input.placeholder = '輸入密碼...';
        input.type = 'password';
        if (toggleBtn) {
            toggleBtn.style.display = 'block';
            toggleBtn.textContent = '👁️';
            toggleBtn.title = '顯示密碼';
        }
    }

    document.getElementById('hint-area').style.display = 'none';
    document.getElementById('hint-text').textContent = '';
    state.wrongStreak = 0;
}

// ── 密碼顯示 / 隱藏切換 ─────────────────────────
function togglePasswordVisibility() {
    const input = document.getElementById('game-input');
    const toggleBtn = document.getElementById('btn-toggle-pwd');
    if (!input || state.currentField !== 'password') return;

    if (input.type === 'password') {
        input.type = 'text';
        if (toggleBtn) {
            toggleBtn.textContent = '🙈';
            toggleBtn.title = '隱藏密碼';
        }
    } else {
        input.type = 'password';
        if (toggleBtn) {
            toggleBtn.textContent = '👁️';
            toggleBtn.title = '顯示密碼';
        }
    }
    input.focus();
}

// ── 防貼上警告提示 ─────────────────────────────
function showNoPasteWarning(message = '⚠️ 為了練習打字，禁止使用複製貼上喔！請動手打出來！') {
    const feedback = document.getElementById('feedback');
    const input = document.getElementById('game-input');
    if (feedback) {
        feedback.textContent = message;
        feedback.className = 'feedback wrong';
        setTimeout(() => {
            if (feedback.textContent === message) {
                feedback.textContent = '';
                feedback.className = 'feedback';
            }
        }, 2200);
    }
    if (input) {
        input.classList.add('wrong');
        setTimeout(() => input.classList.remove('wrong'), 400);
    }
}

function updateStats() {
    document.getElementById('stat-score').textContent = state.score;
    document.getElementById('stat-rounds').textContent = state.rounds;

    const accuracy = state.totalAttempts > 0
        ? Math.round((state.correctAttempts / state.totalAttempts) * 100)
        : 100;
    document.getElementById('stat-accuracy').textContent = accuracy + '%';
}

// ── 輸入處理與反複製貼上限制 ─────────────────────────────

function setupInputHandler() {
    const input = document.getElementById('game-input');

    // 1. 攔截 Enter 送出，並攔截 Ctrl+V / Command+V / Shift+Insert 貼上快捷鍵
    input.addEventListener('keydown', (e) => {
        // 偵測快捷鍵複製貼上 (Ctrl+V, Cmd+V, Shift+Insert, Ctrl+Insert 等)
        if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V' || e.key === 'c' || e.key === 'C')) {
            e.preventDefault();
            showNoPasteWarning();
            return;
        }
        if (e.shiftKey && e.key === 'Insert') {
            e.preventDefault();
            showNoPasteWarning();
            return;
        }

        if (e.key === 'Enter' && state.gameActive) {
            e.preventDefault();
            submitInput();
        }
    });

    // 2. 嚴格攔截 paste 事件（滑鼠右鍵貼上或任何外部貼上）
    input.addEventListener('paste', (e) => {
        e.preventDefault();
        showNoPasteWarning();
    });

    // 3. 攔截 copy 事件（避免學生先複製其他地方貼進去）
    input.addEventListener('copy', (e) => {
        e.preventDefault();
    });

    // 4. 攔截 drop 拖曳文字進入輸入框
    input.addEventListener('drop', (e) => {
        e.preventDefault();
        showNoPasteWarning();
    });

    // 5. 停用右鍵選單以防點「貼上」
    input.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showNoPasteWarning('⚠️ 右鍵選單已停用，請親自動手打字！');
    });

    // 即時字元計數
    input.addEventListener('input', () => {
        const len = input.value.length;
        const expected = state.expectedLength || '?';
        document.getElementById('char-counter').textContent =
            `${len} / ${expected} 字元`;
    });
}

// ── 前端 SHA-256 計算函式（瀏覽器原生 Web Crypto API，極速且無需額外函式庫）──
async function sha256Hex(str) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

let isSubmitting = false;

async function submitInput() {
    if (isSubmitting) return;

    const input = document.getElementById('game-input');
    const value = input.value.trim();
    if (!value) return;

    isSubmitting = true;
    state.totalAttempts++;

    const stu = state.selectedStudent;

    // ⚡【極速零延遲模式】：若有學生的保護 Hash，直接於前端即時秒驗證（0 延遲，絕無頓挫感）
    if (stu && ((state.currentField === 'account' && stu.acc_hash) || (state.currentField === 'password' && stu.pwd_hash))) {
        try {
            const inputHash = await sha256Hex(value);
            const targetHash = state.currentField === 'account' ? stu.acc_hash : stu.pwd_hash;
            const targetLen = state.currentField === 'account' ? (stu.acc_len || 26) : (stu.pwd_len || 11);
            state.expectedLength = targetLen;

            if (inputHash === targetHash) {
                onCorrect();
            } else {
                onWrong();
            }
        } catch (e) {
            console.error('前端 Hash 比對異常，回退至網路請求:', e);
            await fallbackVerify(value);
        } finally {
            isSubmitting = false;
        }
        return;
    }

    // 🌐【網路備援驗證】
    await fallbackVerify(value);
    isSubmitting = false;
}

async function fallbackVerify(value) {
    try {
        let result = {};
        if (typeof API_URL !== 'undefined' && !API_URL.includes('YOUR-DEPLOYMENT-ID')) {
            result = await apiRequest('verify', {
                student_id: state.selectedStudent.id,
                field: state.currentField,
                input: value,
            }, 'GET');
        } else {
            const res = await fetch('/api/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    student_id: state.selectedStudent.id,
                    field: state.currentField,
                    input: value,
                }),
            });
            result = await res.json();
        }

        if (result && result.expected_length) {
            state.expectedLength = result.expected_length;
        }

        if (result && result.correct) {
            onCorrect();
        } else {
            onWrong();
        }
    } catch (err) {
        console.error('驗證失敗:', err);
        const feedback = document.getElementById('feedback');
        if (feedback) {
            feedback.textContent = '⚠️ 網路連線稍慢，請再試一次！';
            feedback.className = 'feedback wrong';
        }
    }
}

function onCorrect() {
    state.correctAttempts++;
    state.wrongStreak = 0;
    state.score += 100;

    const input = document.getElementById('game-input');
    const wrapper = document.getElementById('input-wrapper');
    const feedback = document.getElementById('feedback');

    input.classList.add('correct');
    feedback.textContent = '✅ 正確！';
    feedback.className = 'feedback correct';

    showScoreFly(wrapper, '+100');
    updateStats();

    // ⚡ 將等待時間從原本 500ms 大幅縮減至 180ms，打字節奏極度絲滑順暢
    setTimeout(() => {
        input.classList.remove('correct');
        input.value = '';
        document.getElementById('char-counter').textContent = '0 / ? 字元';
        feedback.textContent = '';
        feedback.className = 'feedback';

        if (state.currentField === 'account') {
            state.currentField = 'password';
            updateGameUI();
        } else {
            state.rounds++;
            updateStats();
            state.currentField = 'account';
            updateGameUI();

            feedback.textContent = `🎉 第 ${state.rounds} 輪完成！`;
            feedback.className = 'feedback correct';
            setTimeout(() => {
                if (feedback.textContent.includes('輪完成')) {
                    feedback.textContent = '';
                    feedback.className = 'feedback';
                }
            }, 1000);
        }

        if (state.gameActive) {
            input.focus();
        }
    }, 180);
}

function onWrong() {
    state.wrongStreak++;

    const input = document.getElementById('game-input');
    const feedback = document.getElementById('feedback');

    input.classList.add('wrong');
    feedback.textContent = '❌ 再試一次！';
    feedback.className = 'feedback wrong';

    updateStats();

    if (state.wrongStreak >= 3) {
        document.getElementById('hint-area').style.display = 'block';
    }

    // ⚡ 錯誤反饋延遲縮減至 200ms
    setTimeout(() => {
        input.classList.remove('wrong');
        input.value = '';
        document.getElementById('char-counter').textContent = '0 / ? 字元';
        if (state.gameActive) {
            input.focus();
        }
    }, 200);
}

// ── 提示功能 ─────────────────────────────────────

async function requestHint() {
    const stu = state.selectedStudent;

    // ⚡ 本地秒出提示
    if (stu && ((state.currentField === 'account' && stu.acc_hint) || (state.currentField === 'password' && stu.pwd_hint))) {
        const hint = state.currentField === 'account' ? stu.acc_hint : stu.pwd_hint;
        const len = state.currentField === 'account' ? stu.acc_len : stu.pwd_len;
        const hintText = document.getElementById('hint-text');
        hintText.textContent = `提示：${hint}（${len} 個字元）`;
        state.expectedLength = len;
        const input = document.getElementById('game-input');
        document.getElementById('char-counter').textContent = `${input.value.length} / ${len} 字元`;
        return;
    }

    try {
        let data = {};
        if (typeof API_URL !== 'undefined' && !API_URL.includes('YOUR-DEPLOYMENT-ID')) {
            data = await apiRequest('hint', {
                student_id: state.selectedStudent.id,
                field: state.currentField
            }, 'GET');
        } else {
            const res = await fetch(
                `/api/hint?student_id=${state.selectedStudent.id}&field=${state.currentField}`
            );
            data = await res.json();
        }

        const hintText = document.getElementById('hint-text');
        hintText.textContent = `提示：${data.hint}（${data.length} 個字元）`;

        state.expectedLength = data.length;
        const input = document.getElementById('game-input');
        document.getElementById('char-counter').textContent =
            `${input.value.length} / ${data.length} 字元`;
    } catch (err) {
        console.error('取得提示失敗:', err);
    }
}

// ── 分數飛出動畫 ─────────────────────────────────

function showScoreFly(anchor, text) {
    const rect = anchor.getBoundingClientRect();
    const fly = document.createElement('div');
    fly.className = 'score-fly';
    fly.textContent = text;
    fly.style.left = (rect.left + rect.width / 2 - 20) + 'px';
    fly.style.top = (rect.top - 10) + 'px';
    document.body.appendChild(fly);

    setTimeout(() => fly.remove(), 800);
}

// ══════════════════════════════════════════════════
// 遊戲結束 & 結算
// ══════════════════════════════════════════════════

function endGame() {
    state.gameActive = false;
    clearInterval(state.timer);

    const accuracy = state.totalAttempts > 0
        ? Math.round((state.correctAttempts / state.totalAttempts) * 100)
        : 0;

    let stars = '⭐';
    if (state.timeLimit >= 180) {
        if (state.rounds >= 15) stars = '⭐⭐⭐';
        else if (state.rounds >= 8) stars = '⭐⭐';
    } else {
        if (state.rounds >= 5) stars = '⭐⭐⭐';
        else if (state.rounds >= 3) stars = '⭐⭐';
    }

    document.getElementById('result-stars').textContent = stars;
    document.getElementById('result-score').textContent = state.score;
    document.getElementById('result-rounds').textContent = state.rounds;
    document.getElementById('result-accuracy').textContent = accuracy + '%';

    const timeLabels = { 60: '1 分鐘', 180: '3 分鐘', 300: '5 分鐘' };
    document.getElementById('result-time').textContent =
        timeLabels[state.timeLimit] || state.timeLimit + ' 秒';

    if (state.score > 0 || state.totalAttempts > 0) {
        submitScore(accuracy);
    }
    showScreen('screen-results');
}

async function submitScore(accuracy) {
    try {
        const payload = {
            student_id: state.selectedStudent.id,
            score: state.score,
            rounds: state.rounds,
            accuracy: accuracy,
            time_limit: state.timeLimit,
        };

        if (typeof API_URL !== 'undefined' && !API_URL.includes('YOUR-DEPLOYMENT-ID')) {
            await apiRequest('submitScore', payload, 'POST');
        } else {
            await fetch('/api/scores', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
        }
    } catch (err) {
        console.error('提交成績失敗:', err);
    }
}

function replayGame() {
    showScreen('screen-settings');
}

// ══════════════════════════════════════════════════
// 排行榜
// ══════════════════════════════════════════════════

function showLeaderboard() {
    const activeScreen = document.querySelector('.screen.active');
    if (activeScreen) {
        state.previousScreen = activeScreen.id;
    }

    showScreen('screen-leaderboard');
    loadLeaderboard();
}

function goBackFromLeaderboard() {
    if (state.previousScreen === 'screen-results') {
        showScreen('screen-results');
    } else {
        showScreen('screen-welcome');
    }
}

function filterGrade(grade, btn) {
    state.leaderboardGrade = grade;

    document.querySelectorAll('.filter-btn:not(.time-btn)').forEach(b =>
        b.classList.remove('active'));
    btn.classList.add('active');

    loadLeaderboard();
}

function filterTime(time, btn) {
    state.leaderboardTime = time;

    document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    loadLeaderboard();
}

async function loadLeaderboard() {
    try {
        let data = [];
        if (typeof API_URL !== 'undefined' && !API_URL.includes('YOUR-DEPLOYMENT-ID')) {
            data = await apiRequest('leaderboard', {
                grade: state.leaderboardGrade,
                time_limit: state.leaderboardTime,
                limit: 50
            }, 'GET');
        } else {
            const res = await fetch(
                `/api/leaderboard?grade=${state.leaderboardGrade}&time_limit=${state.leaderboardTime}&limit=50`
            );
            data = await res.json();
        }
        renderLeaderboard(data);
    } catch (err) {
        console.error('載入排行榜失敗:', err);
    }
}

function renderLeaderboard(data) {
    const tbody = document.getElementById('leaderboard-body');

    if (!data || data.length === 0) {
        tbody.innerHTML =
            '<tr><td colspan="6" class="empty-msg">目前還沒有成績，快去挑戰吧！🎮</td></tr>';
        return;
    }

    const medals = ['🥇', '🥈', '🥉'];

    tbody.innerHTML = data.map((row, i) => {
        const rankClass = i < 3 ? `rank-${i + 1}` : '';
        const rankDisplay = i < 3
            ? `<span class="rank-medal">${medals[i]}</span>`
            : row.rank;

        return `
            <tr class="${rankClass}">
                <td>${rankDisplay}</td>
                <td>${row.class_name}</td>
                <td>${row.name}</td>
                <td><strong>${row.score}</strong></td>
                <td>${row.rounds}</td>
                <td>${Math.round(row.accuracy)}%</td>
            </tr>
        `;
    }).join('');
}
