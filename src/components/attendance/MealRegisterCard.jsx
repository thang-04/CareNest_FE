import { useState } from 'react';
import { AlertTriangle, CheckCircle2, History, Info, Save } from '@/components/ui/icons';
import { useToast } from '@/contexts/ToastContext';
import { Modal } from '@/components/ui/Modal';
import { RowActions } from '@/components/ui/RowActions';
import { Spinner } from '@/components/ui/States';
import { Tabs } from '@/components/ui/Tabs';
import { FormField } from '@/components/form/FormField';
import { MealCountStatusBadge } from '@/components/attendance/AttendanceBadges';
import { adjustMealDay } from '@/services/attendance/attendanceService';
import { MEAL_COUNT_STATUS, MEAL_SESSION_LABELS } from '@/models/attendance/attendanceConstants';
import { canAdjustMealCount, canConfirmMealCount, canSeeMealReconfirmNotice } from '@/utils/attendance/attendancePermissions';
import { dayBySession, dayRegister } from '@/utils/attendance/mealRegister';
import { formatDate, formatDateTime } from '@/utils/format';

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

/** Bảng lớp của một bữa: số suất theo bữa BE trả, sửa riêng bữa này, xác nhận riêng bữa này. */
function MealPanel({ count, user, md, onConfirm, onAdjust, counts }) {
  const confirmable = count.id && canConfirmMealCount(count, user);
  const adjustable = canAdjustMealCount(count, user);
  return (
    <>
      <div className="dd-meal-head">
        <MealCountStatusBadge status={count.status} />
        <span className="muted text-sm">
          {count.confirmedAt
            ? `${count.needsReconfirmation ? 'Lần xác nhận trước' : 'Xác nhận'} bởi ${count.confirmedByName || md.userById?.(count.confirmedBy)?.fullName || 'Phó hiệu trưởng'} lúc ${formatDateTime(count.confirmedAt)}`
            : count.status === 'OPEN'
              ? 'Đang báo ăn, chưa tới giờ chốt'
              : 'Chưa xác nhận'}
        </span>
        <div className="spacer" />
        {confirmable && (
          <button className="btn btn--primary btn--sm" onClick={() => onConfirm({ counts: [count], scope: mealName(count.session) })}>
            <CheckCircle2 size={15} /> {count.needsReconfirmation ? 'Xác nhận lại' : 'Xác nhận'} {mealName(count.session)}
          </button>
        )}
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
              {adjustable && <th className="cell--actions">Thao tác</th>}
            </tr>
          </thead>
          <tbody>
            {count.classes.map((l) => (
              <tr key={l.classId}>
                <td className="fw-600 nowrap">{l.className}</td>
                <td className="num">{l.present}</td>
                <td className="num">{l.absent}</td>
                <td className={`num ${l.missing ? 'text-danger' : 'muted'}`}>{l.missing || '—'}</td>
                <td className="num fw-600">{l.normal}</td>
                <td className="num">{l.substitute}</td>
                {adjustable && (
                  <td className="cell--actions">
                    <RowActions
                      edit={{
                        label: `Sửa số suất ${mealName(count.session)}`,
                        onClick: () => onAdjust({ counts, line: l, session: count.session }),
                      }}
                      name={l.className}
                    />
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
 * Sổ báo ăn ngày của một điểm trường: tab "Cả ngày" (mỗi lớp một dòng suất/ngày, BA) và mỗi bữa một tab
 * (lớp nào ăn bữa đó, số suất, xác nhận riêng bữa). Nút "Xác nhận tất cả" chốt mọi bữa còn chờ.
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
  // PHT điểm trường / Hiệu trưởng sửa số suất của lớp (có lý do) sau giờ chốt
  const adjustable = counts.some((c) => canAdjustMealCount(c, user));
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
        <div className="card__title">Sổ báo ăn ngày{campusName ? ` · ${campusName}` : ''}</div>
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
            <div>Giáo viên đang điểm danh và báo ăn. Số liệu dưới đây là tạm tính đến giờ chốt.</div>
          </div>
        )}
        {status !== MEAL_COUNT_STATUS.CONFIRMED && incomplete.length > 0 && (
          <div className="alert alert--warning mb-12">
            <AlertTriangle size={18} />
            <div>
              Lớp chưa hoàn thành điểm danh: <b>{incomplete.map((l) => l.className).join(', ')}</b>. Trẻ chưa điểm danh không được tính
              suất; kiểm tra với giáo viên trước khi xác nhận.
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
          <MealPanel count={meal} counts={counts} user={user} md={md} onConfirm={onConfirm} onAdjust={onAdjust} />
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
                  {adjustable && <th className="cell--actions">Thao tác</th>}
                </tr>
              </thead>
              <tbody>
                {day.rows.map((l) => (
                  <tr key={l.classId}>
                    <td className="fw-600 nowrap">{l.className}</td>
                    <td className="num">{l.present}</td>
                    <td className="num">{l.absent}</td>
                    <td className={`num ${l.missing ? 'text-danger' : 'muted'}`}>{l.missing || '—'}</td>
                    {day.sessions.map((sKey) => (
                      <td key={sKey} className={`num ${l.meals[sKey] ? '' : 'muted'}`}>
                        {l.meals[sKey] ? l.meals[sKey].normal + l.meals[sKey].substitute : '—'}
                      </td>
                    ))}
                    <td className="num fw-600">{l.normal + l.substitute}</td>
                    <td className="num">{l.substitute}</td>
                    <td className={l.missing ? 'text-danger' : 'muted'}>{l.missing ? 'Chưa hoàn thành' : 'Hoàn thành'}</td>
                    {adjustable && (
                      <td className="cell--actions">
                        <RowActions
                          edit={{ label: 'Sửa số suất cả ngày', onClick: () => onAdjust({ counts, line: lineOf[l.classId] }) }}
                          name={l.className}
                        />
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
            Đã xác nhận đủ {counts.length} bữa · lần cuối bởi{' '}
            {lastConfirmed.confirmedByName || md.userById?.(lastConfirmed.confirmedBy)?.fullName || 'Phó hiệu trưởng'} lúc{' '}
            {formatDateTime(lastConfirmed.confirmedAt)}. Bếp đang dùng số này.
          </div>
        )}
        {confirmable.length > 0 && (
          <div className="row mt-12 dd-count__actions">
            <button
              className="btn btn--primary"
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
    </div>
  );
}

/**
 * Sửa số suất của một lớp (bắt buộc lý do, lưu lịch sử): từ tab "Cả ngày" áp cho mọi bữa của lớp,
 * từ tab một bữa chỉ áp cho bữa đó; bữa đã xác nhận chuyển sang chờ xác nhận lại.
 */
export function MealAdjustModal({ target, user, onClose, onSaved }) {
  const toast = useToast();
  const { counts, line, session } = target;
  const scoped = session ? counts.filter((c) => c.session === session) : counts;
  const confirmed = scoped.some((c) => c.status === MEAL_COUNT_STATUS.CONFIRMED);
  const [form, setForm] = useState({ normal: String(line.normal), substitute: String(line.substitute), note: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const normal = Number(form.normal);
    const substitute = Number(form.substitute);
    const errs = {};
    if (!Number.isInteger(normal) || normal < 0) errs.normal = 'Nhập số nguyên ≥ 0.';
    if (!Number.isInteger(substitute) || substitute < 0) errs.substitute = 'Nhập số nguyên ≥ 0.';
    if (!form.note.trim()) errs.note = 'Nhập lý do điều chỉnh.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      await adjustMealDay(
        { campusId: counts[0].campusId, date: counts[0].date, session, classId: line.classId, normal, substitute, note: form.note },
        user,
      );
      toast.success(confirmed ? `Đã sửa số suất ${line.className}. Chờ xác nhận lại.` : `Đã sửa số suất ${line.className}.`);
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
      title={`Sửa số suất – ${line.className}${session ? ` · ${MEAL_SESSION_LABELS[session]}` : ''}`}
      onClose={busy ? undefined : onClose}
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={busy}>
            Hủy
          </button>
          <button className="btn btn--primary" onClick={save} disabled={busy}>
            {busy ? <Spinner small /> : <Save size={16} />} Lưu số suất
          </button>
        </>
      }
    >
      <p className="muted text-sm mb-12">
        Ngày {formatDate(counts[0].date)} · đang tính {line.normal} suất thường, {line.substitute} suất thay thế (có mặt {line.present}).{' '}
        {session ? `Chỉ áp cho ${mealName(session)} của lớp.` : 'Số mới áp cho mọi bữa của lớp trong ngày.'}
        {confirmed && ' Bữa đã xác nhận: sửa xong cần xác nhận lại, bếp dùng số cũ đến khi xác nhận.'}
      </p>
      <div className="dd-adjust-form">
        <FormField label="Suất thường" required error={errors.normal}>
          <input type="number" min={0} step={1} className="input" {...field('normal')} />
        </FormField>
        <FormField label="Suất thay thế" required error={errors.substitute}>
          <input type="number" min={0} step={1} className="input" {...field('substitute')} />
        </FormField>
      </div>
      <FormField label="Lý do" required error={errors.note}>
        <input className="input" maxLength={200} placeholder="Ví dụ: 2 trẻ đến muộn, cô báo thêm suất" {...field('note')} />
      </FormField>
    </Modal>
  );
}
