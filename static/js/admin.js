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

    try {
        let result = {};
        if (typeof API_URL !== 'undefined' && !API_URL.includes('YOUR-DEPLOYMENT-ID')) {
            result = await apiRequest('adminLogin', { password: password }, 'POST');
        } else {
            // 本地 Flask 模式
            const res = await fetch('/api/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: password })
            });
            result = await res.json();
        }

        if (result.success) {
            currentAdminPassword = password;
            showScreen('screen-admin-dashboard');
            loadAllStudents();
        } else {
            feedback.textContent = '❌ ' + (result.error || '密碼錯誤！');
            feedback.className = 'feedback wrong';
        }
    } catch (err) {
        console.error('登入出錯:', err);
        feedback.textContent = '連線失敗，請檢查網路或 API 設置！';
        feedback.className = 'feedback wrong';
    }
}

// ── 載入所有學生 ─────────────────────────────────
async function loadAllStudents() {
    const tbody = document.getElementById('admin-tbody');
    tbody.innerHTML = '<tr><td colspan="7" style="padding: 30px; color: #b2bec3;">資料載入中...</td></tr>';

    try {
        let result = {};
        if (typeof API_URL !== 'undefined' && !API_URL.includes('YOUR-DEPLOYMENT-ID')) {
            result = await apiRequest('adminStudents', { password: currentAdminPassword, class: 'all' }, 'POST');
        } else {
            const res = await fetch('/api/admin/students', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: currentAdminPassword })
            });
            result = await res.json();
        }

        if (result.success) {
            allStudentsList = result.data || [];
            updateClassFilterOptions();
            filterStudents();
        } else {
            tbody.innerHTML = `<tr><td colspan="7" style="color: #d63031;">載入失敗: ${result.error}</td></tr>`;
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

    const newStudent = {
        class_name: className,
        seat_number: seatNum,
        name: name,
        cjes_account: account,
        cjes_password: password
    };

    try {
        let result = {};
        if (typeof API_URL !== 'undefined' && !API_URL.includes('YOUR-DEPLOYMENT-ID')) {
            result = await apiRequest('addStudent', {
                password: currentAdminPassword,
                student: newStudent
            }, 'POST');
        } else {
            const res = await fetch('/api/admin/add_student', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    password: currentAdminPassword,
                    student: newStudent
                })
            });
            result = await res.json();
        }

        if (result.success) {
            alert('✅ 學生新增成功！');
            closeAddModal();
            loadAllStudents();
        } else {
            alert('❌ 新增失敗：' + (result.error || '未知錯誤'));
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
        let result = {};
        if (typeof API_URL !== 'undefined' && !API_URL.includes('YOUR-DEPLOYMENT-ID')) {
            result = await apiRequest('deleteStudent', {
                password: currentAdminPassword,
                id: id
            }, 'POST');
        } else {
            const res = await fetch('/api/admin/delete_student', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    password: currentAdminPassword,
                    id: id
                })
            });
            result = await res.json();
        }

        if (result.success) {
            alert('✅ 學生已刪除！');
            loadAllStudents();
        } else {
            alert('❌ 刪除失敗：' + (result.error || '未知錯誤'));
        }
    } catch (err) {
        console.error('刪除失敗:', err);
        alert('❌ 網路請求失敗');
    }
}
