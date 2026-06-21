"""
Access → Supabase 移行スクリプト
対象:
  T01 + T04 → students (メンバー or ファン)
  T03       → student_records (カルテメモ)
  T022      → lessons + attendance + transactions
"""
import xlrd
import uuid
import datetime
import json

base = '/root/.claude/uploads/16ea9628-463f-5266-bb4a-279734c298a7/'

def xls_date(val, datemode):
    if not val:
        return None
    try:
        dt = xlrd.xldate_as_datetime(val, datemode)
        return dt.strftime('%Y-%m-%d')
    except:
        return None

def clean_str(val):
    if val is None or val == '' or val == 0:
        return None
    s = str(val).strip()
    return s if s else None

# ============================================================
# Step 1: T04 から メンバー or ファン の ID を収集
# ============================================================
wb4 = xlrd.open_workbook(base + '1c327bf6-T04______.xls')
sh4 = wb4.sheets()[0]

target_ids = set()
for i in range(1, sh4.nrows):
    row = [sh4.cell_value(i, j) for j in range(sh4.ncols)]
    rid = int(row[0]) if row[0] else None
    is_member = row[2] == 1.0
    is_fan    = row[3] == 1.0
    if rid and (is_member or is_fan):
        target_ids.add(rid)

print(f'対象人数: {len(target_ids)}人')

# ============================================================
# Step 2: T01 → students INSERT SQL
# ============================================================
wb1 = xlrd.open_workbook(base + '3b3e3abb-T01_____.xls')
sh1 = wb1.sheets()[0]

# カラムインデックス
C = {h: i for i, h in enumerate([sh1.cell_value(0, j) for j in range(sh1.ncols)])}

old_id_to_uuid = {}  # T01のID → 生成したUUID
students_sql = []

for i in range(1, sh1.nrows):
    r = [sh1.cell_value(i, j) for j in range(sh1.ncols)]
    old_id = int(r[C['ID']]) if r[C['ID']] else None
    if old_id not in target_ids:
        continue

    new_uuid = str(uuid.uuid4())
    old_id_to_uuid[old_id] = new_uuid

    # 姓名
    sei  = clean_str(r[C['姓']])
    mei  = clean_str(r[C['名']])
    hyoji = clean_str(r[C['表示名']])
    name = f"{sei} {mei}".strip() if sei and mei else (sei or mei or hyoji or '不明')

    # フリガナ（半角カナ → そのまま保持）
    kana_sei = clean_str(r[C['ﾌﾘｶﾞﾅｾｲ']])
    kana_mei = clean_str(r[C['ﾌﾘｶﾞﾅﾒｲ']])
    name_kana = f"{kana_sei} {kana_mei}".strip() if kana_sei and kana_mei else clean_str(r[C['ﾌﾘｶﾞﾅ']])

    # メール（①優先、なければ携帯メール）
    email = clean_str(r[C['電子メール アドレス①']]) or clean_str(r[C['携帯メール']])
    if email and r[C['ﾒｰﾙ①無効']] == 1.0:
        email = clean_str(r[C['携帯メール']])

    # 電話（携帯優先）
    phone = clean_str(r[C['携帯電話']]) or clean_str(r[C['自宅電話番号 :']])

    # 住所
    postal   = clean_str(r[C['自宅の郵便番号']])
    addr     = clean_str(r[C['自宅住所']])
    address  = f"〒{postal} {addr}".strip() if postal and addr else addr

    # 生年月日
    birthdate = xls_date(r[C['生年月日']], wb1.datemode)

    # メモ
    memo1 = clean_str(r[C['メモ']])
    memo2 = clean_str(r[C['memo']])
    notes = '\n'.join(filter(None, [memo1, memo2])) or None

    def esc(v):
        if v is None:
            return 'NULL'
        return "'" + str(v).replace("'", "''") + "'"

    students_sql.append(
        f"('{new_uuid}', {esc(name)}, {esc(name_kana)}, {esc(email)}, "
        f"{esc(phone)}, {esc(birthdate)}, {esc(address)}, NULL, {esc(notes)}, "
        f"TRUE, CURRENT_DATE, now(), now())"
    )

print(f'students: {len(students_sql)}件')

# ============================================================
# Step 3: T03 → student_records INSERT SQL
# ============================================================
wb3 = xlrd.open_workbook(base + '7c18d94e-T03Tap____.xls')
sh3 = wb3.sheets()[0]

records_sql = []
for i in range(1, sh3.nrows):
    r = [sh3.cell_value(i, j) for j in range(sh3.ncols)]
    old_id  = int(r[0]) if r[0] else None
    memo    = clean_str(r[4])
    if not memo or old_id not in old_id_to_uuid:
        continue
    new_uuid     = old_id_to_uuid[old_id]
    record_uuid  = str(uuid.uuid4())
    records_sql.append(
        f"('{record_uuid}', '{new_uuid}', '2024-01-01', {repr(memo)}, now())"
    )

print(f'student_records: {len(records_sql)}件')

# ============================================================
# Step 4: T022 → lessons + attendance + transactions
# ============================================================
wb22 = xlrd.open_workbook(base + 'ac44fecf-T022.xls')
sh22 = wb22.sheets()[0]

# レッスン日ごとにlessonを1件作成
lesson_date_to_uuid = {}
lessons_sql = []
attendance_sql = []
transactions_sql = []

for i in range(1, sh22.nrows):
    r = [sh22.cell_value(i, j) for j in range(sh22.ncols)]
    lesson_date_raw = r[0]
    participant_id  = int(r[1]) if r[1] else None
    ticket_val      = r[8]   # チケット金額
    nyukin_val      = r[9]   # その他入金
    nyukin_fee      = clean_str(r[10])  # 入金費目
    taiken          = r[3]   # 体験レッスン

    if not lesson_date_raw or not participant_id:
        continue

    lesson_date = xls_date(lesson_date_raw, wb22.datemode)
    if not lesson_date:
        continue

    # レッスンレコード（同日は1件）
    if lesson_date not in lesson_date_to_uuid:
        l_uuid = str(uuid.uuid4())
        lesson_date_to_uuid[lesson_date] = l_uuid
        scheduled_at = f"{lesson_date}T19:00:00+09:00"
        lessons_sql.append(
            f"('{l_uuid}', NULL, 'タップダンスレッスン', '{scheduled_at}', NULL, 20, NULL, now())"
        )

    l_uuid = lesson_date_to_uuid[lesson_date]

    # 出席記録（生徒が対象IDの場合のみ）
    if participant_id in old_id_to_uuid:
        s_uuid    = old_id_to_uuid[participant_id]
        att_uuid  = str(uuid.uuid4())
        ticket_used = 'TRUE' if ticket_val and ticket_val > 0 else 'FALSE'
        attendance_sql.append(
            f"('{att_uuid}', '{l_uuid}', '{s_uuid}', 'present', {ticket_used}, NULL, now())"
            f" ON CONFLICT (lesson_id, student_id) DO NOTHING"
        )

    # チケット入金 → transactions
    if ticket_val and ticket_val > 0:
        t_uuid = str(uuid.uuid4())
        transactions_sql.append(
            f"('{t_uuid}', '{lesson_date}', 'income', 'チケット販売', {int(ticket_val)}, "
            f"'参加者ID:{participant_id}', now())"
        )

    # その他入金 → transactions
    if nyukin_val and float(nyukin_val) > 0:
        t_uuid   = str(uuid.uuid4())
        if taiken == 1.0:
            category = '体験レッスン収入'
        else:
            category = nyukin_fee if nyukin_fee else 'その他収入'
        transactions_sql.append(
            f"('{t_uuid}', '{lesson_date}', 'income', {repr(category)}, {int(float(nyukin_val))}, "
            f"'参加者ID:{participant_id}', now())"
        )

print(f'lessons: {len(lessons_sql)}件')
print(f'attendance: {len(attendance_sql)}件')
print(f'transactions: {len(transactions_sql)}件')

# ============================================================
# Step 5: SQLファイルに出力
# ============================================================
out = '/home/user/osakalivetheater/dance-business-labo/migration.sql'

with open(out, 'w', encoding='utf-8') as f:
    f.write('-- ============================================================\n')
    f.write('-- Access → Supabase 移行SQL\n')
    f.write(f'-- 生成日時: {datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")}\n')
    f.write('-- ============================================================\n\n')

    # students
    f.write(f'-- students ({len(students_sql)}件)\n')
    f.write('INSERT INTO students (id, name, name_kana, email, phone, birthdate, address, emergency_contact, notes, is_active, joined_at, created_at, updated_at) VALUES\n')
    f.write(',\n'.join(students_sql))
    f.write(';\n\n')

    # student_records
    if records_sql:
        f.write(f'-- student_records ({len(records_sql)}件)\n')
        f.write('INSERT INTO student_records (id, student_id, record_date, content, created_at) VALUES\n')
        f.write(',\n'.join(records_sql))
        f.write(';\n\n')

    # lessons
    f.write(f'-- lessons ({len(lessons_sql)}件)\n')
    f.write('INSERT INTO lessons (id, lesson_type_id, title, scheduled_at, location, max_capacity, notes, created_at) VALUES\n')
    f.write(',\n'.join(lessons_sql))
    f.write(';\n\n')

    # attendance (ON CONFLICT付きはINSERT個別)
    f.write(f'-- attendance ({len(attendance_sql)}件)\n')
    for a in attendance_sql:
        f.write(f'INSERT INTO attendance (id, lesson_id, student_id, status, ticket_used, notes, created_at) VALUES {a};\n')
    f.write('\n')

    # transactions
    if transactions_sql:
        f.write(f'-- transactions ({len(transactions_sql)}件)\n')
        f.write('INSERT INTO transactions (id, transaction_date, type, category, amount, description, created_at) VALUES\n')
        f.write(',\n'.join(transactions_sql))
        f.write(';\n\n')

print(f'\n✅ 出力完了: {out}')

# old_id → uuid のマッピングをJSONで保存（デバッグ用）
with open('/home/user/osakalivetheater/dance-business-labo/migration_id_map.json', 'w') as f:
    json.dump({str(k): v for k, v in old_id_to_uuid.items()}, f, ensure_ascii=False, indent=2)
print('✅ IDマップ: migration_id_map.json')
