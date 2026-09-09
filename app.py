#!/usr/bin/env python3
"""帳號密碼練習遊戲 — Flask 後端伺服器。"""

from flask import Flask, render_template, jsonify, request
import sqlite3
import os

app = Flask(__name__)
DB_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'students.db')


def get_db():
    """取得資料庫連線。"""
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn


# ── 頁面路由 ──────────────────────────────────────────────

@app.route('/')
def index():
    return render_template('index.html')


# ── API 路由 ──────────────────────────────────────────────

@app.route('/api/classes')
def get_classes():
    """取得所有班級列表。"""
    conn = get_db()
    rows = conn.execute(
        'SELECT DISTINCT class_name FROM students ORDER BY class_name'
    ).fetchall()
    conn.close()
    return jsonify([row['class_name'] for row in rows])


@app.route('/api/students')
def get_students():
    """取得指定班級的學生名單（包含保護的 hash 用於前端零延遲驗證）。"""
    class_name = request.args.get('class')
    if not class_name:
        return jsonify({'error': '缺少 class 參數'}), 400

    import hashlib
    conn = get_db()
    rows = conn.execute(
        'SELECT id, seat_number, name, cjes_account, cjes_password FROM students WHERE class_name = ? ORDER BY seat_number',
        (class_name,)
    ).fetchall()
    conn.close()

    result = []
    for r in rows:
        acc = r['cjes_account']
        pwd = r['cjes_password']
        at_pos = acc.index('@') if '@' in acc else len(acc)
        acc_hint = acc[:4] + '*' * max(0, at_pos - 4) + acc[at_pos:]
        pwd_hint = pwd[0] + '*' * max(0, len(pwd) - 2) + pwd[-1] if len(pwd) > 2 else pwd

        result.append({
            'id': r['id'],
            'seat_number': r['seat_number'],
            'name': r['name'],
            'acc_hash': hashlib.sha256(acc.strip().encode('utf-8')).hexdigest(),
            'pwd_hash': hashlib.sha256(pwd.strip().encode('utf-8')).hexdigest(),
            'acc_len': len(acc.strip()),
            'pwd_len': len(pwd.strip()),
            'acc_hint': acc_hint,
            'pwd_hint': pwd_hint
        })

    return jsonify(result)


@app.route('/api/verify', methods=['POST'])
def verify():
    """驗證學生輸入的帳號或密碼是否正確。"""
    data = request.json
    if not data:
        return jsonify({'error': '缺少請求資料'}), 400

    student_id = data.get('student_id')
    field = data.get('field')       # 'account' 或 'password'
    user_input = data.get('input', '')

    conn = get_db()
    student = conn.execute(
        'SELECT cjes_account, cjes_password FROM students WHERE id = ?',
        (student_id,)
    ).fetchone()
    conn.close()

    if not student:
        return jsonify({'error': '找不到該學生'}), 404

    if field == 'account':
        correct = user_input == student['cjes_account']
        length = len(student['cjes_account'])
    elif field == 'password':
        correct = user_input == student['cjes_password']
        length = len(student['cjes_password'])
    else:
        return jsonify({'error': '無效的 field 參數'}), 400

    return jsonify({
        'correct': correct,
        'expected_length': length,
    })


@app.route('/api/hint')
def get_hint():
    """取得帳號或密碼的提示。"""
    student_id = request.args.get('student_id')
    field = request.args.get('field')

    if not student_id or not field:
        return jsonify({'error': '缺少參數'}), 400

    conn = get_db()
    student = conn.execute(
        'SELECT cjes_account, cjes_password FROM students WHERE id = ?',
        (student_id,)
    ).fetchone()
    conn.close()

    if not student:
        return jsonify({'error': '找不到該學生'}), 404

    if field == 'account':
        account = student['cjes_account']
        at_pos = account.index('@')
        # 顯示前4字元 + 星號 + @後面全部: "cjes******@cjes.hcc.edu.tw"
        hint = account[:4] + '*' * (at_pos - 4) + account[at_pos:]
        hint_length = len(account)
    elif field == 'password':
        password = student['cjes_password']
        # 顯示首尾字元: "J*********j"
        hint = password[0] + '*' * (len(password) - 2) + password[-1]
        hint_length = len(password)
    else:
        return jsonify({'error': '無效的 field 參數'}), 400

    return jsonify({
        'hint': hint,
        'length': hint_length,
    })


@app.route('/api/scores', methods=['POST'])
def submit_score():
    """提交遊戲成績。"""
    data = request.json
    if not data:
        return jsonify({'error': '缺少請求資料'}), 400

    required = ['student_id', 'score', 'rounds', 'accuracy', 'time_limit']
    for key in required:
        if key not in data:
            return jsonify({'error': f'缺少 {key} 參數'}), 400

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        '''INSERT INTO scores (student_id, score, rounds, accuracy, time_limit)
           VALUES (?, ?, ?, ?, ?)''',
        (data['student_id'], data['score'], data['rounds'],
         data['accuracy'], data['time_limit'])
    )
    conn.commit()
    score_id = cursor.lastrowid
    conn.close()
    return jsonify({'id': score_id, 'message': '成績已儲存！'})


@app.route('/api/leaderboard')
def leaderboard():
    """取得排行榜（每位學生取最高分）。"""
    grade = request.args.get('grade', 'all')      # 'all', '3', '4', '5', '6'
    time_limit = request.args.get('time_limit', '60')
    limit = request.args.get('limit', '50')

    conn = get_db()

    # 每位學生取該時間設定下的最高分
    query = '''
        SELECT
            st.name,
            st.class_name,
            s.score,
            s.rounds,
            s.accuracy,
            s.time_limit,
            s.created_at
        FROM scores s
        JOIN students st ON s.student_id = st.id
        WHERE s.time_limit = ?
          AND s.id = (
              SELECT s2.id FROM scores s2
              WHERE s2.student_id = s.student_id
                AND s2.time_limit = s.time_limit
              ORDER BY s2.score DESC, s2.created_at DESC
              LIMIT 1
          )
    '''
    params = [int(time_limit)]

    if grade != 'all':
        query += ' AND st.class_name LIKE ?'
        params.append(f'{grade}%')

    query += ' ORDER BY s.score DESC, s.rounds DESC LIMIT ?'
    params.append(int(limit))

    rows = conn.execute(query, params).fetchall()
    conn.close()

    results = []
    for i, row in enumerate(rows, 1):
        results.append({
            'rank': i,
            'name': row['name'],
            'class_name': row['class_name'],
            'score': row['score'],
            'rounds': row['rounds'],
            'accuracy': row['accuracy'],
            'time_limit': row['time_limit'],
            'created_at': row['created_at'],
        })

@app.route('/admin')
def admin_page():
    return render_template('admin.html')


# ── 教師管理後台 API ──────────────────────────────────────

ADMIN_PASSWORD = '5552472'

@app.route('/api/admin/login', methods=['POST'])
def admin_login():
    data = request.json or {}
    password = data.get('password', '')
    if password == ADMIN_PASSWORD:
        return jsonify({'success': True})
    return jsonify({'success': False, 'error': '密碼錯誤'}), 401


@app.route('/api/admin/students', methods=['POST'])
def admin_get_students():
    data = request.json or {}
    password = data.get('password', '')
    if password != ADMIN_PASSWORD:
        return jsonify({'success': False, 'error': '權限不足'}), 401

    conn = get_db()
    rows = conn.execute(
        'SELECT id, class_name, seat_number, name, cjes_account, cjes_password FROM students ORDER BY class_name, seat_number'
    ).fetchall()
    conn.close()
    return jsonify({'success': True, 'data': [dict(r) for r in rows]})


@app.route('/api/admin/add_student', methods=['POST'])
def admin_add_student():
    data = request.json or {}
    password = data.get('password', '')
    if password != ADMIN_PASSWORD:
        return jsonify({'success': False, 'error': '權限不足'}), 401

    stu = data.get('student', {})
    class_name = stu.get('class_name', '').strip()
    seat_number = str(stu.get('seat_number', '')).strip().zfill(2)
    name = stu.get('name', '').strip()
    cjes_account = stu.get('cjes_account', '').strip()
    cjes_password = stu.get('cjes_password', '').strip()

    if not class_name or not name or not cjes_account or not cjes_password:
        return jsonify({'success': False, 'error': '缺少必要欄位'}), 400

    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        '''INSERT INTO students (class_name, seat_number, name, cjes_account, cjes_password)
           VALUES (?, ?, ?, ?, ?)''',
        (class_name, seat_number, name, cjes_account, cjes_password)
    )
    conn.commit()
    new_id = cur.lastrowid
    conn.close()
    return jsonify({'success': True, 'id': new_id, 'message': '新增成功'})


@app.route('/api/admin/delete_student', methods=['POST'])
def admin_delete_student():
    data = request.json or {}
    password = data.get('password', '')
    if password != ADMIN_PASSWORD:
        return jsonify({'success': False, 'error': '權限不足'}), 401

    student_id = data.get('id')
    if not student_id:
        return jsonify({'success': False, 'error': '缺少 id'}), 400

    conn = get_db()
    cur = conn.cursor()
    cur.execute('DELETE FROM students WHERE id = ?', (student_id,))
    cur.execute('DELETE FROM scores WHERE student_id = ?', (student_id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': '刪除成功'})


# ── 啟動伺服器 ────────────────────────────────────────────

if __name__ == '__main__':
    if not os.path.exists(DB_FILE):
        print('❌ 找不到資料庫！請先執行 python3 import_data.py')
        exit(1)

    import socket
    hostname = socket.gethostname()
    local_ip = socket.gethostbyname(hostname)

    print('🎮 帳號密碼練習遊戲伺服器啟動中...')
    print(f'📡 本機存取：http://localhost:8080')
    print(f'📡 區域網路：http://{local_ip}:8080')
    print('💡 學生請用瀏覽器連入上面的區域網路網址')
    print('按 Ctrl+C 停止伺服器\n')

    app.run(host='0.0.0.0', port=8080, debug=False)
