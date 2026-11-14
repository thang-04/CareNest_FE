import { useState } from 'react';
import { AlertTriangle, CheckCircle2, History, Info, RotateCcw, Save } from '@/components/ui/icons';
import { useToast } from '@/contexts/ToastContext';
import { Modal } from '@/components/ui/Modal';
import { RowActions } from '@/components/ui/RowActions';
import { Spinner } from '@/components/ui/States';
import { Tabs } from '@/components/ui/Tabs';
import { FormField } from '@/components/form/FormField';
import { MealCountStatusBadge } from '@/components/attendance/AttendanceBadges';
import { adjustMealDay, unlockAttendanceDay } from '@/services/attendance/attendanceService';
import { MEAL_COUNT_STATUS, MEAL_SESSION_LABELS } from '@/models/attendance/attendanceConstants';
import {
  canAdjustMealCount,
  canConfirmMealCount,
  canSeeMealReconfirmNotice,
  canUnlockAttendanceDay,
} from '@/utils/attendance/attendancePermissions';
import { dayBySession, dayRegister } from '@/utils/attendance/mealRegister';
import { formatDate, formatDateTime } from '@/utils/format';
import { ROLE_LABELS } from '@/models/User';

// NUT-02: BE từ chối xác nhận khi còn lớp trong cơ sở–ngày có trẻ chưa điểm danh
const BLOCKED_HINT = 'Còn lớp chưa điểm danh xong, chưa xác nhận được.';
// OPEN: chưa tới giờ chốt (sổ tạm tính)
const STATUS_ORDER = ['OPEN', MEAL_COUNT_STATUS.PENDING_CONFIRMATION, MEAL_COUNT_STATUS.CONFIRMED];
const DAY = 'DAY';

/** Trạng thái sổ của một ngày: bữa nào còn mở/chờ xác nhận thì cả ngày chưa chốt. */
export const dayStatus = (counts) => STATUS_ORDER.find((st) => counts.some((c) => c.status === st)) || MEAL_COUNT_STATUS.CONFIRMED;

// "+2 suất thường, −1 suất thay thế"
const deltaText = (a) =>
  [
    a.normal && `${a.normal > 0 ? '+' : '−'}${Math.abs(a.normal)} suất thường`,
    a.substitute && `${a.substitute > 0 ? '+' : '−'}${Math.abs(a.substitute)} suất thay thế`,
  ]
    .filter(Boolean)
    .join(', ');

/** Một lần sửa áp cho nhiều bữa của lớp: gộp các dòng điều chỉnh cùng lớp, người, lý do, cùng phút thành một. */
const groupAdjustments = (list) => {
  const map = new Map();
  list.forEach((a) => {
    const key = `${a.at.slice(0, 16)}|${a.classId}|${a.userId}|${a.note}|${a.normal}|${a.substitute}`;
    const g = map.get(key);
    if (g) g.sessions.push(a.session);
    else map.set(key, { ...a, sessions: [a.session] });
  });
  return [...map.values()].sort((x, y) => (x.at < y.at ? 1 : -1));
};

const mealName = (session) => (MEAL_SESSION_LABELS[session] || session).toLowerCase();

// NUT-02: HT hoặc PHT xác nhận; ghi rõ vai trò cạnh tên người xác nhận
const confirmerLabel = (count, md) => {
  const name = count.confirmedByName || md.userById?.(count.confirmedBy)?.fullName;
  const role = ROLE_LABELS[count.confirmedByRole];
  if (name && role) return `${name} (${role})`;
  return name || role || 'Phó hiệu trưởng';
};

// Ngày đã qua mà sổ còn "đang báo ăn" (chưa ai lập sổ): chỉ xem, không phải "chưa tới giờ chốt" (BE NUT-03)
const schoolToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
const pastOpen = (count) => count.status === 'OPEN' && !!count.date && count.date < schoolToday();

/** Bảng lớp của một bữa: số suất theo bữa BE trả, sửa riêng bữa này. Xác nhận theo cả ngày (BE NUT-02, D10). */
/** NUT-02: điểm danh đổi sau khi suất thay thế đã sửa tay ⇒ người duyệt kiểm tra lại số thay thế. */
function ClassNameCell({ line }) {
  return (
    <td className="fw-600 nowrap">
      {line.className}
      {line.attendanceChanged && (
        <>
          {' '}
          <span className="chip chip--orange">Điểm danh đã đổi, cần kiểm tra lại</span>
        </>
      )}
    </td>
  );
}

/** "Trả lại GV kiểm tra" (ATT-08, NUT-02): số sai không sửa tay, mở lại điểm danh lớp – ngày để giáo viên sửa. */
function ReturnButton({ line, onReturn }) {
  return (
    <button type="button" className="btn btn--sm" onClick={() => onReturn(line)}>
      <RotateCcw size={14} /> Trả lại GV kiểm tra
    </button>
  );
}

function MealPanel({ count, user, md, onAdjust, counts, onReturn }) {
  const adjustable = canAdjustMealCount(count, user);
  const actions = adjustable || !!onReturn;
  return (
    <>
      <div className="dd-meal-head">
        <MealCountStatusBadge status={count.status} />
        <span className="muted text-sm">
          {count.confirmedAt
            ? `${count.needsReconfirmation ? 'Lần xác nhận trước' : 'Xác nhận'} bởi ${confirmerLabel(count, md)} lúc ${formatDateTime(count.confirmedAt)}`
            : pastOpen(count)
              ? 'Ngày đã qua, sổ chưa được xác nhận'
              : count.status === 'OPEN'
                ? 'Đang báo ăn, chưa tới giờ chốt'
                : 'Chưa xác nhận'}
        </span>
      </div>
      <div className="table-wrap mt-12">
        <table className="table table--grid table--compact table--wrap-head">
          <thead>
            <tr>
              <th>Lớp</th>
              <th className="num">Có mặt</th>
              <th className="num">Vắng</th>
              <th className="num">Chưa ĐD</th>
              <th className="num">Suất thường</th>
              <th className="num">Suất thay thế</th>
              {actions && <th className="cell--actions">Thao tác</th>}
            </tr>
          </thead>
          <tbody>
            {count.classes.map((l) => (
              <tr key={l.classId}>
                <ClassNameCell line={l} />
                <td className="num">{l.present}</td>
                <td className="num">{l.absent}</td>
                <td className={`num ${l.missing ? 'text-danger' : 'muted'}`}>{l.missing || '—'}</td>
                <td className="num fw-600">{l.normal}</td>
                <td className="num">{l.substitute}</td>
                {actions && (
                  <td className="cell--actions">
                    <div className="row">
                      {onReturn && <ReturnButton line={l} onReturn={onReturn} />}
                      {adjustable && (
                        <RowActions
                          edit={{
                            label: `Sửa suất thay thế ${mealName(count.session)}`,
                            onClick: () => onAdjust({ counts, line: l, session: count.session }),
                          }}
                          name={l.className}
                        />
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/**
 * Sổ suất ăn ngày của một điểm trường: tab "Cả ngày" (mỗi lớp một dòng suất/ngày, BA) và mỗi bữa một tab
 * (lớp nào ăn bữa đó, số suất). Nút "Xác nhận tất cả" chốt mọi bữa còn chờ: BE xác nhận theo cơ sở–ngày (NUT-02).
 */
export function MealRegisterCard({ counts, campusName, user, md, onConfirm, onAdjust }) {
  const [tab, setTab] = useState(DAY);
  const first = counts[0];
  const status = dayStatus(counts);
  const confirmable = counts.filter((c) => c.id && canConfirmMealCount(c, user));
  const reconfirm = counts.some((c) => c.needsReconfirmation);
  const register = dayRegister(counts);
  // Tab Cả ngày: cộng đủ các bữa (Cần chốt 20/10/2026); dayRegister giữ cho phần sửa cả ngày của lớp
  const day = dayBySession(counts);
  const lineOf = Object.fromEntries(register.rows.map((l) => [l.classId, l]));
  const incomplete = register.rows.filter((l) => l.missing > 0);
  const classById = Object.fromEntries(register.rows.map((l) => [l.classId, l.className]));
  const adjustments = groupAdjustments(counts.flatMap((c) => c.adjustments.map((a) => ({ ...a, session: c.session }))));
  // NUT-02: PHT điểm trường chỉ điều chỉnh suất thay thế của lớp (có lý do) sau giờ chốt
  const adjustable = counts.some((c) => canAdjustMealCount(c, user));
  // ATT-08: qua giờ chốt (sổ không còn OPEN), ngày không ở tương lai, người có quyền mở lại điểm danh ở cơ sở này
  const [returning, setReturning] = useState(null);
  const returnable =
    !!first &&
    first.date <= schoolToday() &&
    counts.some((c) => c.status !== 'OPEN') &&
    canUnlockAttendanceDay({ campusId: first.campusId }, user);
  const onReturn = returnable ? setReturning : null;
  const actions = adjustable || returnable;
  const meal = counts.find((c) => c.session === tab);
  const lastConfirmed = counts.filter((c) => c.confirmedAt).sort((x, y) => (x.confirmedAt < y.confirmedAt ? 1 : -1))[0];
  const tabs = [
    { key: DAY, label: 'Cả ngày' },
    ...counts.map((c) => ({
      key: c.session,
      label: `${MEAL_SESSION_LABELS[c.session]}${c.status === MEAL_COUNT_STATUS.CONFIRMED && !c.needsReconfirmation ? ' ✓' : ''}`,
      count: c.classes.length,
    })),
  ];
  return (
    <div className="card dd-count">
      <div className="card__header">
        <div className="card__title">Sổ suất ăn ngày{campusName ? ` · ${campusName}` : ''}</div>
        <MealCountStatusBadge status={status} />
      </div>
      <div className="card__body">
        {reconfirm && canSeeMealReconfirmNotice(user) && (
          <div className="alert alert--warning mb-12" role="status">
            <AlertTriangle size={18} />
            <div>
              Số suất đã thay đổi sau khi xác nhận (mở lại điểm danh hoặc điều chỉnh). Cần xác nhận lại; bếp vẫn dùng số đã xác nhận trước
              đó.
            </div>
          </div>
        )}
        {status === 'OPEN' && (
          <div className="alert alert--info mb-12">
            <Info size={18} />
            <div>
              {pastOpen(first)
                ? 'Ngày đã qua và sổ suất ăn chưa được xác nhận trong ngày: số liệu dưới đây tính từ điểm danh, chỉ để xem.'
                : 'Giáo viên đang điểm danh và báo ăn. Số liệu dưới đây là tạm tính đến giờ chốt.'}
            </div>
          </div>
        )}
        {(status !== MEAL_COUNT_STATUS.CONFIRMED || confirmable.length > 0) && incomplete.length > 0 && (
          <div className="alert alert--warning mb-12" role="status">
            <AlertTriangle size={18} />
            <div>
              Lớp chưa hoàn thành điểm danh: <b>{incomplete.map((l) => `${l.className} (${l.missing} trẻ)`).join(', ')}</b>. Chưa xác nhận
              được sổ suất ăn tới khi giáo viên điểm danh đủ (mở lại điểm danh nếu đã qua giờ chốt).
            </div>
          </div>
        )}
        <Tabs ariaLabel="Xem theo bữa" items={tabs} value={meal ? tab : DAY} onChange={setTab} />
        {/* Số tổng theo tab: cả ngày hoặc riêng bữa đang chọn (số BE trả theo bữa) */}
        <div className="dd-count__totals mt-12">
          {meal ? (
            <>
              <div>
                <span className="dd-count__num">{meal.totals.normal + meal.totals.substitute}</span>
                <span className="muted text-sm">Suất {mealName(meal.session)}</span>
              </div>
              <div>
                <span className="dd-count__num dd-count__num--sub">{meal.totals.substitute}</span>
                <span className="muted text-sm">Trong đó suất thay thế</span>
              </div>
              <div>
                <span className="dd-count__num">{meal.classes.length}</span>
                <span className="muted text-sm">Lớp ăn bữa này</span>
              </div>
            </>
          ) : (
            <>
              <div>
                <span className="dd-count__num">{day.total}</span>
                <span className="muted text-sm">Tổng suất cả ngày ({counts.length} bữa)</span>
              </div>
              <div>
                <span className="dd-count__num dd-count__num--sub">{day.substitute}</span>
                <span className="muted text-sm">Trong đó suất thay thế</span>
              </div>
              <div>
                <span className="dd-count__num">
                  {counts.filter((c) => c.status === MEAL_COUNT_STATUS.CONFIRMED && !c.needsReconfirmation).length}/{counts.length}
                </span>
                <span className="muted text-sm">Bữa đã xác nhận</span>
              </div>
            </>
          )}
        </div>
        {meal ? (
          <MealPanel count={meal} counts={counts} user={user} md={md} onAdjust={onAdjust} onReturn={onReturn} />
        ) : (
          <div className="table-wrap mt-12">
            <table className="table table--grid table--compact table--wrap-head">
              <thead>
                <tr>
                  <th>Lớp</th>
                  <th className="num">Có mặt</th>
                  <th className="num">Vắng</th>
                  <th className="num">Chưa ĐD</th>
                  {day.sessions.map((sKey) => (
                    <th key={sKey} className="num">
                      {MEAL_SESSION_LABELS[sKey]}
                    </th>
                  ))}
                  <th className="num">Tổng suất</th>
                  <th className="num">Suất thay thế</th>
                  <th>Điểm danh</th>
                  {actions && <th className="cell--actions">Thao tác</th>}
                </tr>
              </thead>
              <tbody>
                {day.rows.map((l) => (
                  <tr key={l.classId}>
                    <ClassNameCell line={l} />
                    <td className="num">{l.present}</td>
                    <td className="num">{l.absent}</td>
                    <td className={`num ${l.missing ? 'text-danger' : 'muted'}`}>{l.missing || '—'}</td>
                    {day.sessions.map((sKey) => (
                      <td key={sKey} className={`num ${l.meals[sKey] ? '' : 'muted'}`}>
                        {l.meals[sKey] ? <ServingCell meal={l.meals[sKey]} /> : '—'}
                      </td>
                    ))}
                    <td className="num fw-600">{l.normal + l.substitute}</td>
                    <td className="num">{l.substitute}</td>
                    <td className={l.missing ? 'text-danger' : 'muted'}>{l.missing ? 'Chưa hoàn thành' : 'Hoàn thành'}</td>
                    {actions && (
                      <td className="cell--actions">
                        <div className="row">
                          {onReturn && <ReturnButton line={l} onReturn={onReturn} />}
                          {adjustable && (
                            <RowActions
                              edit={{ label: 'Sửa suất thay thế cả ngày', onClick: () => onAdjust({ counts, line: lineOf[l.classId] }) }}
                              name={l.className}
                            />
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {adjustments.length > 0 && (
          <div className="mt-12">
            <div className="subsection-title row">
              <History size={16} /> Điều chỉnh ({adjustments.length})
            </div>
            <ul className="dd-adjust">
              {adjustments.map((a, i) => (
                <li key={i}>
                  <span className="text-xs muted nowrap">{formatDateTime(a.at)}</span>
                  <span>
                    <b>{classById[a.classId]}</b> ({a.sessions.map((x) => MEAL_SESSION_LABELS[x]).join(', ')}): {deltaText(a)} – {a.note}
                    <span className="muted"> ({a.userName || md.userById?.(a.userId)?.fullName || 'Giáo viên'})</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {!confirmable.length && lastConfirmed && status === MEAL_COUNT_STATUS.CONFIRMED && (
          <div className="text-sm muted mt-12">
            Đã xác nhận đủ {counts.length} bữa · lần cuối bởi {confirmerLabel(lastConfirmed, md)} lúc{' '}
            {formatDateTime(lastConfirmed.confirmedAt)}. Bếp đang dùng số này.
          </div>
        )}
        {confirmable.length > 0 && (
          <div className="row mt-12 dd-count__actions">
            <button
              className="btn btn--primary"
              disabled={incomplete.length > 0}
              title={incomplete.length > 0 ? BLOCKED_HINT : undefined}
              onClick={() =>
                onConfirm({
                  counts: confirmable,
                  scope: `${confirmable.length} bữa`,
                  servings: day.total,
                  campusName,
                  date: first.date,
                })
              }
            >
              <CheckCircle2 size={16} /> {reconfirm ? 'Xác nhận lại' : 'Xác nhận'} tất cả ({confirmable.length} bữa)
            </button>
          </div>
        )}
      </div>
      {returning && (
        <ReturnToTeacherModal
          line={returning}
          date={first.date}
          user={user}
          onClose={() => setReturning(null)}
          onDone={() => setReturning(null)}
        />
      )}
    </div>
  );
}

const REASON_MAX = 300; // BE DayUnlockRequest.reason @Size(max = 300)

/**
 * Trả lại GV kiểm tra (ATT-08): mở lại điểm danh lớp – ngày tới hết hôm nay, lý do bắt buộc; BE báo giáo viên lớp. Giáo
 * viên sửa xong, sổ chuyển "chờ xác nhận lại" như khi mở lại ở màn Mở lại điểm danh.
 */
function ReturnToTeacherModal({ line, date, user, onClose, onDone }) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const check = (text) =>
    !text.trim() ? 'Nhập lý do trả lại.' : text.trim().length > REASON_MAX ? `Lý do tối đa ${REASON_MAX} ký tự.` : '';
  const submit = async () => {
    const message = check(reason);
    setError(message);
    if (message) return;
    setBusy(true);
    try {
      const today = schoolToday();
      await unlockAttendanceDay(
        { classId: line.classId, date, validUntil: new Date(`${today}T23:59:00+07:00`).toISOString(), reason: reason.trim() },
        user,
      );
      toast.success(`Đã trả lại ${line.className} để giáo viên kiểm tra điểm danh ngày ${formatDate(date)}.`);
      onDone();
    } catch (err) {
      setError(err.details?.reason || err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      title={`Trả lại GV kiểm tra – ${line.className}`}
      onClose={busy ? undefined : onClose}
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={busy}>
            Hủy
          </button>
          <button className="btn btn--primary" onClick={submit} disabled={busy}>
            {busy ? <Spinner small /> : <RotateCcw size={16} />} Trả lại
          </button>
        </>
      }
    >
      <p className="muted text-sm mb-12">
        Mở lại điểm danh ngày {formatDate(date)} của lớp tới hết hôm nay. Giáo viên nhận thông báo, sửa xong thì sổ chờ xác nhận lại.
      </p>
      <FormField label="Lý do" required error={error}>
        <textarea
          className="textarea"
          rows={3}
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            if (error) setError(check(e.target.value));
          }}
          onBlur={() => setError(check(reason))}
        />
      </FormField>
    </Modal>
  );
}

/**
 * NUT-02: điều chỉnh suất thay thế của một lớp (bắt buộc lý do, lưu lịch sử); suất thường chỉ đổi qua điểm danh.
 * Từ tab "Cả ngày" áp cho mọi bữa của lớp, từ tab một bữa chỉ bữa đó; bữa đã xác nhận chuyển sang chờ xác nhận lại.
 */
export function MealAdjustModal({ target, user, onClose, onSaved }) {
  const toast = useToast();
  const { counts, line, session } = target;
  const scoped = session ? counts.filter((c) => c.session === session) : counts;
  const confirmed = scoped.some((c) => c.status === MEAL_COUNT_STATUS.CONFIRMED);
  const [form, setForm] = useState({ substitute: String(line.substitute), note: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const substitute = Number(form.substitute);
    const errs = {};
    // Suất thay thế nằm trong số trẻ ăn bữa đó (BE 6075): 20 trẻ, 1 thay thế = 20 suất
    const eating = line.normal + line.substitute;
    if (form.substitute.trim() === '' || !Number.isInteger(substitute) || substitute < 0) errs.substitute = 'Nhập số nguyên ≥ 0.';
    else if (substitute > eating) errs.substitute = `Không quá ${eating} (số trẻ ăn của lớp).`;
    if (!form.note.trim()) errs.note = 'Nhập lý do điều chỉnh.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      await adjustMealDay(
        { campusId: counts[0].campusId, date: counts[0].date, session, classId: line.classId, substitute, note: form.note },
        user,
      );
      toast.success(confirmed ? `Đã sửa suất thay thế ${line.className}. Chờ xác nhận lại.` : `Đã sửa suất thay thế ${line.className}.`);
      onSaved();
    } catch (err) {
      if (err.details) setErrors(err.details);
      toast.error(err, 'Không sửa được');
    } finally {
      setBusy(false);
    }
  };
  const field = (key) => ({
    value: form[key],
    onChange: (e) => {
      setForm({ ...form, [key]: e.target.value });
      setErrors({ ...errors, [key]: '' });
    },
  });
  return (
    <Modal
      open
      title={`Sửa suất thay thế – ${line.className}${session ? ` · ${MEAL_SESSION_LABELS[session]}` : ''}`}
      onClose={busy ? undefined : onClose}
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={busy}>
            Hủy
          </button>
          <button className="btn btn--primary" onClick={save} disabled={busy}>
            {busy ? <Spinner small /> : <Save size={16} />} Lưu suất thay thế
          </button>
        </>
      }
    >
      <p className="muted text-sm mb-12">
        Ngày {formatDate(counts[0].date)} · đang tính {line.normal} suất thường, {line.substitute} suất thay thế (có mặt {line.present}).{' '}
        {session ? `Chỉ áp cho ${mealName(session)} của lớp.` : 'Số mới áp cho mọi bữa của lớp trong ngày.'} Suất thường tính từ điểm danh;
        số sai thì mở lại điểm danh để giáo viên sửa.
        {confirmed && ' Bữa đã xác nhận: sửa xong cần xác nhận lại, bếp dùng số cũ đến khi xác nhận.'}
      </p>
      <FormField label="Suất thay thế" required error={errors.substitute}>
        <input type="number" min={0} step={1} className="input" {...field('substitute')} />
      </FormField>
      <FormField label="Lý do" required error={errors.note}>
        <input className="input" maxLength={200} placeholder="Ví dụ: 1 trẻ dị ứng nặng cần suất riêng" {...field('note')} />
      </FormField>
    </Modal>
  );
}

/** Số suất một bữa; đang chờ xác nhận lại mà khác số đã chốt thì hiện "cũ → mới" để người duyệt thấy thay đổi. */
function ServingCell({ meal }) {
  const now = meal.normal + meal.substitute;
  if (meal.before == null || meal.before === now) return now;
  return (
    <span className="text-warning fw-600" title={`Đã chốt trước: ${meal.before} suất, nay: ${now} suất`}>
      <s className="muted">{meal.before}</s> → {now}
    </span>
  );
}
