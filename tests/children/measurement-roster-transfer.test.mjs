import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { beforeEach, test } from 'node:test';

const values = new Map();
globalThis.localStorage = {
  getItem: (k) => values.get(k) ?? null,
  setItem: (k, v) => values.set(k, String(v)),
  removeItem: (k) => values.delete(k),
  clear: () => values.clear(),
};
globalThis.window = new EventTarget();

const { readDb, writeDb, resetDb } = await import('@/mocks/mockDatabase');
const { healthCheckMockRepository: checks } = await import('@/services/children/mock/healthCheckMockRepository');
const { ensureChildRecordsSeeded } = await import('@/services/children/mock/childrenMockRepository');
const { todayInput } = await import('@/utils/format');

// G94-180 (mục 11, 13): dòng trẻ chuyển lớp, số đo ở lớp khác, trẻ vắng hôm nay trong kỳ cân đo (HLT-09, HLT-01).
const ROUND = 'hc_c2_next';
const TUAN = { id: 'u_tuan', role: 'TEACHER', campusId: 'c2' };
const read = (f) => readFileSync(f, 'utf8');
const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

let ids;
beforeEach(() => {
  resetDb();
  ensureChildRecordsSeeded();
  const today = todayInput();
  ids = writeDb((d) => {
    const [a, b] = d.classes.filter((c) => c.campusId === 'c2');
    b.teacherIds = [...new Set([...(b.teacherIds || []), TUAN.id])];
    a.teacherIds = [...new Set([...(a.teacherIds || []), TUAN.id])];
    const child = d.children.find((ch) => ch.classId === a.id && ch.status === 'ACTIVE');
    d.healthMeasurements = d.healthMeasurements.filter((m) => !(m.childId === child.id && m.campaignId === ROUND));
    // Đo ở lớp A cách đây 3 ngày, chuyển sang lớp B từ hôm qua
    d.healthMeasurements.push({
      id: 'hm_transfer',
      childId: child.id,
      campaignId: ROUND,
      date: addDays(today, -3),
      heightCm: 100,
      weightKg: 16,
      note: '',
    });
    d.childPlacements.push({
      id: 'pl_transfer',
      childId: child.id,
      fromClassId: a.id,
      toClassId: b.id,
      userId: 'u_hung',
      at: new Date().toISOString(),
      reason: 'Thử',
      effectiveFrom: addDays(today, -1),
    });
    child.classId = b.id;
    return { a: a.id, b: b.id, childId: child.id };
  });
});

test('lớp mới: số đo ở lớp cũ có measuredIn, sửa được', async () => {
  const roster = await checks.getHealthCheckClass(ROUND, ids.b, TUAN);
  const row = roster.children.find((r) => r.childId === ids.childId);
  assert.equal(row.result, 'RECORDED');
  assert.ok(row.measuredIn.className);
  assert.equal(row.measuredIn.date, addDays(todayInput(), -3));
  assert.equal(row.canEdit, true);
  assert.equal(row.movedTo, null);
});

test('lớp cũ: dòng chỉ xem có movedTo, không sửa được', async () => {
  const roster = await checks.getHealthCheckClass(ROUND, ids.a, TUAN);
  const row = roster.children.find((r) => r.childId === ids.childId);
  assert.ok(row.movedTo.className);
  assert.equal(row.movedTo.from, addDays(todayInput(), -1));
  assert.equal(row.canEdit, false);
  assert.equal(row.measuredIn, null);
});

test('chi tiết kỳ: trẻ đã chuyển không tính vào số đã cân đo của lớp cũ', async () => {
  const detail = await checks.getHealthCheck(ROUND, TUAN);
  const total = detail.classes.reduce((s, c) => s + c.recorded, 0);
  const ofB = detail.classes.find((c) => c.classId === ids.b).recorded;
  assert.ok(ofB >= 1);
  assert.equal(total, detail.campaign.progress.recorded, 'không đếm trẻ hai lần');
});

test('trẻ điểm danh vắng hôm nay ⇒ absentToday', async () => {
  writeDb((d) => {
    d.attendance = [
      ...(d.attendance || []).filter((r) => !(r.childId === ids.childId && r.date === todayInput())),
      { id: 'att_x', date: todayInput(), childId: ids.childId, classId: ids.b, status: 'EXCUSED', meals: {} },
    ];
  });
  const row = (await checks.getHealthCheckClass(ROUND, ids.b, TUAN)).children.find((r) => r.childId === ids.childId);
  assert.equal(row.absentToday, true);
  writeDb((d) => {
    d.attendance = d.attendance.filter((r) => r.id !== 'att_x');
  });
  const again = (await checks.getHealthCheckClass(ROUND, ids.b, TUAN)).children.find((r) => r.childId === ids.childId);
  assert.equal(again.absentToday, false);
});

test('MeasurementRoundRoster: sửa theo canEdit, khóa nhập khi vắng, bỏ dòng chuyển lớp khỏi số đã đo', () => {
  const src = read('src/components/children/MeasurementRoundRoster.jsx');
  assert.match(src, /r\.canEdit/);
  assert.match(src, /r\.absentToday/);
  assert.match(src, /Trẻ vắng hôm nay \(điểm danh\)\. Nhập khi trẻ có mặt\./);
  assert.match(src, /Vắng hôm nay/);
  assert.match(src, /Đã chuyển sang /);
  assert.match(src, /Đo ở /);
  assert.match(src, /!r\.movedTo/);
  assert.match(read('src/components/children/RosterActions.jsx'), /disabled/);
  assert.ok(src.includes('${measured}/${countable} trẻ'), 'mẫu số không tính trẻ đã chuyển lớp');
});

test('HealthCheckClassRoster: Khám khóa với trẻ vắng hôm nay, mẫu số bỏ trẻ đã chuyển lớp', () => {
  const src = read('src/components/children/HealthCheckClassRoster.jsx');
  assert.match(src, /r\.absentToday\s*\?\s*\{ label: 'Khám', strong: true, disabled: true, title: ABSENT_TODAY_HINT \}/);
  assert.ok(src.includes('Trẻ vắng hôm nay (điểm danh). Nhập khi trẻ có mặt.'));
  assert.match(src, /Tiếp tục khám/);
  assert.match(src, /Xem phiếu/);
  assert.ok(src.includes('${concluded}/${countable} trẻ'));
});

test('bấm dòng trẻ vắng hôm nay không mở form: nút khóa thì về sổ sức khỏe (cả hai danh sách)', () => {
  const exam = read('src/components/children/HealthCheckClassRoster.jsx');
  assert.ok(exam.includes('navigate(primary && !primary.disabled ? examLink(r.childId) : healthLink)'));
  const round = read('src/components/children/MeasurementRoundRoster.jsx');
  assert.ok(round.includes('navigate(primary && !primary.disabled ? primary.to : healthLink)'));
});
