import { Link } from 'react-router-dom';
import { SCHOOL_CONFIG_API } from '@/config/env';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { UserCog, AlertTriangle, ArrowLeftRight, Check, Save, Utensils } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { VpGapsNote, VpPeopleList, VpTaskEditor } from '@/components/permissions/VpTaskEditor';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { LeaveConfirmModal } from '@/components/ui/LeaveConfirmModal';
import { useLeaveGuard } from '@/hooks/useLeaveGuard';
import { useMasterData } from '@/hooks/useMasterData';
import { useSchoolYears, useViceAssignments, useVicesPermissions } from '@/hooks/school-config/useSchoolConfig';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Modal } from '@/components/ui/Modal';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState, ErrorState, SkeletonRows, Spinner } from '@/components/ui/States';
import { FormField } from '@/components/form/FormField';
import { YearPicker } from '@/components/school-config/YearPicker';
import { ScNoAccess } from '@/components/school-config/ScNoAccess';
import { VicePrincipalCard } from '@/components/school-config/VicePrincipalCard';
import { saveViceAssignment } from '@/services/school-config/schoolConfigService';
import { AREA_SCOPE_ALL, YEAR_STATUS, composeAreaGrant } from '@/models/school-config/schoolConfigConstants';
import { canAssignVicePrincipal } from '@/utils/school-config/schoolConfigPermissions';
import { validateVpAssignment, hasErrors } from '@/utils/school-config/schoolConfigValidation';
import { areaTasks, taskOn, visibleVpAreas, vpGrantsOf } from '@/utils/school-config/vpAssignmentView';
import { vpCrumbs } from '@/utils/school-config/breadcrumbs';
import { formatDate, todayInput } from '@/utils/format';
import '@/styles/modules/school-config.css';

const NOT_GIVEN = 'NONE';
// Lựa chọn gỡ Phó hiệu trưởng khỏi điểm trường đang phụ trách (BE nhận campusId = null)
const NO_CAMPUS = 'NO_CAMPUS';
const VIEW_ONLY = { view: true, create: false, update: false, delete: false };
// Bảng trước → sau khi hai Phó hiệu trưởng đổi điểm trường cho nhau (cùng cách trình bày với bảng soát lại việc được giao)
const SWAP_COLUMNS = [
  { key: 'name', header: 'Phó hiệu trưởng' },
  { key: 'before', header: 'Đang phụ trách', className: 'muted' },
  { key: 'after', header: 'Sau khi lưu', className: 'fw-600' },
];
const writes = (actions) => Object.entries(actions).some(([k, on]) => k !== 'view' && on);

// Ngày hiệu lực do BE tính (BE CFG-YR-05: năm sắp diễn ra từ ngày mở chuẩn bị, năm đang chạy từ hôm nay); FE chỉ ghi chú
const startNoteOf = (year) =>
  year.status === YEAR_STATUS.PLANNED
    ? `Phân công có hiệu lực từ ngày mở chuẩn bị${year.prepDate ? ` ${formatDate(year.prepDate)}` : ''} để kịp xếp lớp và phân công.`
    : 'Phân công có hiệu lực từ hôm nay.';

function AssignModal({ row, rows, year, campuses, sharedHolder, onClose }) {
  const { user } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({
    campusId: row.presetCampusId || row.assignment?.campusId || row.user.campusId || '',
    note: '',
  });
  const [grants, setGrants] = useState(() => vpGrantsOf(row.assignment));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const menuHeldByOther = sharedHolder && sharedHolder.id !== row.user.id;
  // Điểm trường chọn đang có Phó hiệu trưởng khác và người này cũng đang có điểm trường ⇒ hai người đổi chỗ cho nhau
  const oldCampusId = row.assignment?.campusId;
  const campusLabel = (id) => {
    const c = campuses.find((x) => String(x.id) === String(id));
    return c?.shortName || c?.name || 'điểm trường khác';
  };
  const removing = form.campusId === NO_CAMPUS;
  const takenBy =
    SCHOOL_CONFIG_API && form.campusId && !removing && String(oldCampusId) !== String(form.campusId)
      ? rows.find((r) => r.user.id !== row.user.id && String(r.assignment?.campusId) === String(form.campusId))
      : null;
  const holder = oldCampusId ? takenBy : null;
  const menuClash = menuHeldByOther && !!grants.menu && writes(grants.menu.actions);
  // Mỗi điểm trường một dòng: ai đang phụ trách và chọn thì chuyện gì xảy ra, để không phải đóng hộp thoại xem lại
  const holderOf = (campusId) => rows.find((r) => r.user.id !== row.user.id && String(r.assignment?.campusId) === String(campusId));
  const options = [
    ...campuses
      .filter((c) => c.status !== 'INACTIVE' || String(c.id) === String(oldCampusId))
      .map((c) => {
        const other = holderOf(c.id);
        const current = String(c.id) === String(oldCampusId);
        return {
          id: c.id,
          name: !c.shortName || c.name.startsWith(c.shortName) ? c.name : `${c.shortName} – ${c.name}`,
          current,
          holderName: current ? row.user.fullName : other?.user.fullName,
          effect: current
            ? 'Giữ nguyên'
            : !other
              ? 'Nhận phụ trách'
              : SCHOOL_CONFIG_API && oldCampusId
                ? `Hoán đổi với ${other.user.fullName}`
                : `Cần gỡ ${other.user.fullName} trước`,
        };
      }),
    ...(SCHOOL_CONFIG_API && oldCampusId
      ? [{ id: NO_CAMPUS, name: 'Không phụ trách điểm trường nào', effect: `${campusLabel(oldCampusId)} sẽ chưa có Phó hiệu trưởng` }]
      : []),
  ];
  const optionColumns = [
    {
      key: 'name',
      header: 'Điểm trường',
      render: (o) => (
        <>
          <span className="fw-600">{o.name}</span> {o.current && <span className="chip chip--teal">Đang phụ trách</span>}
          <div className="text-xs muted">{o.effect}</div>
        </>
      ),
    },
    { key: 'holderName', header: 'Phó hiệu trưởng hiện tại' },
    {
      key: 'pick',
      header: 'Thao tác',
      className: 'cell--actions',
      render: (o) =>
        String(form.campusId) === String(o.id) ? (
          <Button size="sm" variant="primary" icon={Check} aria-pressed="true" disabled={saving}>
            Đã chọn
          </Button>
        ) : (
          <Button size="sm" aria-pressed="false" disabled={saving} onClick={() => setCampus(o.id)}>
            Chọn
          </Button>
        ),
    },
  ];

  const setGrant = (key, value) => {
    setErrors({});
    setGrants((all) => {
      const next = { ...all };
      if (value) next[key] = value;
      else delete next[key];
      return next;
    });
  };
  // Đổi điểm trường phụ trách: việc đang theo điểm trường cũ chuyển theo
  const setCampus = (campusId) => {
    setGrants((all) =>
      Object.fromEntries(
        Object.entries(all).map(([k, g]) => [k, form.campusId && g.campusId === form.campusId ? { ...g, campusId: campusId || '' } : g]),
      ),
    );
    setForm((f) => ({ ...f, campusId }));
  };
  const setScope = (area, scope) => {
    if (scope === NOT_GIVEN) return setGrant(area.key, null);
    const g = grants[area.key];
    setGrant(area.key, { campusId: scope, actions: g ? g.actions : VIEW_ONLY });
  };
  const toggleTask = (area, task) => {
    const g = grants[area.key];
    const on = !taskOn(task, g.actions);
    setGrant(area.key, { ...g, actions: { ...g.actions, ...Object.fromEntries(task.keys.map((k) => [k, on])), view: true } });
  };

  const submit = async () => {
    const e = validateVpAssignment(form);
    if (!SCHOOL_CONFIG_API && Object.values(grants).some((g) => !g.campusId)) e.areas = 'Chọn "Ở đâu" cho từng công việc được giao';
    if (!SCHOOL_CONFIG_API && menuClash)
      e.areas = `Thực đơn & dịch vụ bán trú đang do ${sharedHolder.fullName} quản lý. Mỗi năm học chỉ một Phó hiệu trưởng được lập, sửa, xóa thực đơn.`;
    setErrors(e);
    if (hasErrors(e)) return;
    setSaving(true);
    try {
      const areas = Object.fromEntries(
        Object.entries(grants).map(([k, g]) => [
          k,
          composeAreaGrant({ actions: g.actions, campusId: g.campusId === AREA_SCOPE_ALL ? null : g.campusId }),
        ]),
      );
      await saveViceAssignment(
        year.id,
        row.user.id,
        {
          ...form,
          ...(removing ? { campusId: null } : {}),
          ...(holder ? { swap: true } : {}),
          ...(!SCHOOL_CONFIG_API ? { areas } : {}),
        },
        user,
      );
      toast.success(
        holder
          ? `Đã hoán đổi điểm trường giữa ${row.user.fullName} và ${holder.user.fullName}.`
          : removing
            ? `${row.user.fullName} không còn phụ trách điểm trường nào.`
            : `Đã lưu phân công cho ${row.user.fullName}.`,
        'Phân công Phó hiệu trưởng',
      );
      onClose(true);
    } catch (err) {
      if (err.details) setErrors(err.details);
      toast.error(err, 'Không lưu được thay đổi');
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      size="lg"
      title={`Phân công ${row.user.fullName}`}
      onClose={saving ? undefined : () => onClose(false)}
      footer={
        <>
          <button className="btn" onClick={() => onClose(false)} disabled={saving}>
            Hủy
          </button>
          <button className="btn btn--primary" onClick={submit} disabled={saving}>
            {saving ? <Spinner small /> : holder ? <ArrowLeftRight size={16} /> : <Save size={16} />}{' '}
            {holder ? 'Xác nhận hoán đổi' : 'Lưu phân công'}
          </button>
        </>
      }
    >
      <div className="sc-assign-person mb-12">
        <Avatar user={row.user} />
        <div className="sc-assign-person__name">
          <div className="fw-600">{row.user.fullName}</div>
          <div className="text-xs muted">Năm học {year.name}</div>
        </div>
        {oldCampusId ? (
          <span className="chip chip--teal chip--lg">Đang phụ trách: {campusLabel(oldCampusId)}</span>
        ) : (
          <span className="chip chip--gray chip--lg">Chưa phụ trách điểm trường nào</span>
        )}
      </div>
      <div className="field__label mb-8">
        Chọn điểm trường phụ trách <span aria-hidden="true">*</span>
      </div>
      <div className="mb-12">
        <DataTable className="table--compact" columns={optionColumns} rows={options} />
        {errors.campusId && (
          <span className="field__error" role="alert">
            {errors.campusId}
          </span>
        )}
      </div>
      <p className="text-sm text-2 mb-12">
        {startNoteOf(year)}{' '}
        {SCHOOL_CONFIG_API
          ? 'Việc được giao chỉnh ở khung bên phải khi chọn người này.'
          : 'Phó hiệu trưởng chỉ thấy và làm được những công việc Hiệu trưởng giao dưới đây.'}
      </p>
      {holder ? (
        <div className="mb-12">
          <div className="alert alert--warning mb-8">
            <ArrowLeftRight size={18} />
            <div>
              <b>
                {campusLabel(form.campusId)} đang do {holder.user.fullName} phụ trách.
              </b>{' '}
              Lưu thì hai Phó hiệu trưởng đổi điểm trường cho nhau, mỗi điểm trường vẫn có một người phụ trách.
            </div>
          </div>
          <DataTable
            className="table--compact"
            columns={SWAP_COLUMNS}
            rows={[
              { id: row.user.id, name: row.user.fullName, before: campusLabel(oldCampusId), after: campusLabel(form.campusId) },
              { id: holder.user.id, name: holder.user.fullName, before: campusLabel(form.campusId), after: campusLabel(oldCampusId) },
            ]}
          />
        </div>
      ) : takenBy ? (
        <div className="alert alert--warning mb-12">
          <AlertTriangle size={18} />
          <div>
            {campusLabel(form.campusId)} đang do {takenBy.user.fullName} phụ trách. Mở phân công của {takenBy.user.fullName}, chọn
            &quot;Không phụ trách điểm trường nào&quot; rồi quay lại phân công {row.user.fullName}.
          </div>
        </div>
      ) : (
        oldCampusId &&
        form.campusId &&
        String(oldCampusId) !== String(form.campusId) && (
          <div className="alert alert--warning mb-12">
            <AlertTriangle size={18} />
            <div>
              {removing
                ? `Lưu thì ${row.user.fullName} không còn phụ trách điểm trường nào và ${campusLabel(oldCampusId)} sẽ chưa có Phó hiệu trưởng.`
                : `${row.user.fullName} đang phụ trách ${campusLabel(oldCampusId)}. Lưu phân công mới thì điểm trường đó sẽ chưa có Phó hiệu trưởng.`}
            </div>
          </div>
        )
      )}

      {!SCHOOL_CONFIG_API && (
        <div className="mt-16">
          <span className="field__label">Công việc được giao</span>
          <div className="field__hint mb-8">
            Chọn &quot;Ở đâu&quot; cho từng việc; chọn &quot;Không giao&quot; thì Phó hiệu trưởng không thấy việc đó. Không tích ô nào = chỉ
            được xem.
          </div>
          <div className="sc-vp-edit">
            {visibleVpAreas.map((area) => {
              const g = grants[area.key];
              const lockMenu = area.key === 'menu' && menuHeldByOther;
              return (
                <div key={area.key} className={`sc-vp-edit__row ${g ? '' : 'is-off'}`}>
                  <div className="sc-vp-edit__name">
                    <div className="fw-600">{area.label}</div>
                    <div className="text-xs muted">{area.hint}</div>
                  </div>
                  <select
                    className={`select ${errors.areas && g && !g.campusId ? 'is-invalid' : ''}`}
                    aria-label={`Ở đâu: ${area.label}`}
                    value={g ? g.campusId : NOT_GIVEN}
                    onChange={(e) => setScope(area, e.target.value)}
                  >
                    <option value={NOT_GIVEN}>Không giao</option>
                    {g && !g.campusId && <option value="">Chọn nơi…</option>}
                    {area.scopes.includes('CAMPUS') &&
                      campuses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.shortName || c.name}
                        </option>
                      ))}
                    {area.scopes.includes('ALL') && <option value={AREA_SCOPE_ALL}>Toàn trường</option>}
                  </select>
                  <div className="sc-vp-edit__tasks" role="group" aria-label={`Việc được làm: ${area.label}`}>
                    {g ? (
                      <>
                        {areaTasks(area).map((t) => {
                          const on = taskOn(t, g.actions);
                          return (
                            <label key={t.id} className={`sc-vp-task ${lockMenu && !on ? 'is-off' : ''}`}>
                              <input type="checkbox" checked={on} disabled={lockMenu && !on} onChange={() => toggleTask(area, t)} />
                              {t.label}
                            </label>
                          );
                        })}
                        {lockMenu && (
                          <span className="sc-vp-edit__warn text-xs">
                            <AlertTriangle size={13} /> {sharedHolder.fullName} đang quản lý thực đơn. Mỗi năm học chỉ 1 người.
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="muted text-sm">—</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {errors.areas && (
            <p className="field__error mt-8" role="alert">
              {errors.areas}
            </p>
          )}
        </div>
      )}

      <FormField label="Ghi chú" className="mt-12">
        <textarea
          className="textarea"
          rows={2}
          maxLength={300}
          value={form.note}
          onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
        />
      </FormField>
    </Modal>
  );
}

// Chọn tài khoản Phó hiệu trưởng để phụ trách điểm trường đang thiếu (người chưa phân công lên đầu)
function ChooseViceModal({ campus, rows, campusName, onPick, onClose }) {
  const sorted = [...rows].sort((a, b) => Number(!!a.assignment) - Number(!!b.assignment));
  return (
    <Modal open size="lg" title={`Phân công Phó hiệu trưởng cho ${campus.shortName || campus.name}`} onClose={onClose}>
      {sorted.length === 0 ? (
        <EmptyState
          icon={UserCog}
          title="Chưa có tài khoản Phó hiệu trưởng"
          description="Tạo tài khoản Phó hiệu trưởng ở Tài khoản nhân sự rồi quay lại phân công."
          action={
            <Link className="btn btn--primary" to="/school/staff">
              Tạo tài khoản
            </Link>
          }
        />
      ) : (
        <>
          <p className="text-sm text-2 mb-12">
            Chọn người phụ trách {campus.shortName || campus.name}. Mỗi Phó hiệu trưởng phụ trách một điểm trường trong năm học; bước sau
            chọn quyền thao tác.
          </p>
          <div className="table-wrap">
            <table className="table table--grid table--compact">
              <thead>
                <tr>
                  <th>Phó hiệu trưởng</th>
                  <th>Đang phụ trách</th>
                  <th className="cell--actions">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => (
                  <tr key={r.user.id}>
                    <td>
                      <div className="fw-600">{r.user.fullName}</div>
                      <div className="text-xs muted">{r.user.email}</div>
                    </td>
                    <td className="text-sm">
                      {r.assignment ? (
                        <span className="chip chip--orange">
                          {campusName(r.assignment.campusId)} · chọn thì chuyển sang điểm trường này
                        </span>
                      ) : (
                        <span className="chip chip--gray">Chưa phân công</span>
                      )}
                    </td>
                    <td className="cell--actions">
                      <button type="button" className="btn btn--sm btn--primary" onClick={() => onPick(r)}>
                        Chọn
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs muted mt-12">
            Cần thêm người? Tạo tài khoản Phó hiệu trưởng ở <Link to="/school/staff">Tài khoản nhân sự</Link>.
          </p>
        </>
      )}
    </Modal>
  );
}

/** #23 Vice Principal Assignment (UC 2.5, GBR-GEN-03, GBR-GEN-10). Principal only. */
/** embedded: nằm trong Thiết lập năm học (năm học do bước thiết lập chọn, không hiện bộ chọn năm). */
export default function VicePrincipalAssignmentPage({ embedded = false }) {
  const { user } = useAuth();
  const { schoolYear: headerYear } = useSchoolYear();
  const [params, setParams] = useSearchParams();
  const yearId = params.get('year') || headerYear;
  const md = useMasterData();
  const { years } = useSchoolYears();
  const allowed = canAssignVicePrincipal(user);
  const { data, loading, error, reload } = useViceAssignments(allowed ? yearId : null);
  const [editing, setEditing] = useState(null);
  const [choosingFor, setChoosingFor] = useState(null);
  const [dirty, setDirty] = useState(false);
  const year = data?.year;
  const today = todayInput();
  const rows = useMemo(() => data?.rows || [], [data?.rows]);
  const assignedIds = useMemo(() => (SCHOOL_CONFIG_API ? rows.filter((r) => r.assignment).map((r) => r.user.id) : []), [rows]);
  const vices = useVicesPermissions(assignedIds);
  const guard = useLeaveGuard({ when: dirty });
  // Người đang được giao việc (cột phải) nằm trên URL để mở thẳng; đổi người khi còn nháp thì hỏi trước
  const [switchTo, setSwitchTo] = useState(null);
  const selectPerson = (userId) => {
    const next = new URLSearchParams(params);
    next.set('vp', String(userId));
    guard.step(`?${next}`, { replace: true });
  };
  const askSelect = (userId) => (dirty && String(userId) !== params.get('vp') ? setSwitchTo(userId) : selectPerson(userId));
  const pickYear = (v) => {
    const next = new URLSearchParams(params);
    next.set('year', v);
    setParams(next);
  };

  if (!allowed)
    return (
      <div className="page">
        <Breadcrumb items={vpCrumbs()} />
        <h1 className="page__title">Phân công Phó hiệu trưởng</h1>
        <ScNoAccess description="Chỉ Hiệu trưởng được phân công Phó hiệu trưởng." />
      </div>
    );

  const readOnly = year?.status === YEAR_STATUS.CLOSED;
  const sharedRow = rows.find((r) => r.assignment?.sharedService);
  // Điểm trường đã ngừng hoạt động không phân công PHT (BE từ chối)
  const uncovered = md.campuses.filter((c) => c.status !== 'INACTIVE' && !rows.some((r) => r.assignment?.campusId === c.id));
  const campusName = (id) => md.campusById(id)?.shortName || id;
  const activeCampuses = md.campuses.filter((c) => c.status !== 'INACTIVE');
  const assignedRows = rows.filter((r) => r.assignment);
  const personOf = (r) => ({
    userId: r.user.id,
    fullName: r.user.fullName,
    campusId: r.assignment.campusId,
    campusName: campusName(r.assignment.campusId),
    items: vices.itemsByUser[r.user.id],
  });
  // Người có điểm trường lên trước; chưa chọn ai thì mở người đầu tiên
  const ordered = [...assignedRows, ...rows.filter((r) => !r.assignment)];
  const selectedRow =
    ordered.find((r) => String(r.user.id) === params.get('vp')) || ordered.find((r) => vices.itemsByUser[r.user.id]?.length) || ordered[0];
  const selectedItems = selectedRow ? vices.itemsByUser[selectedRow.user.id] : null;
  const switchName = rows.find((r) => r.user.id === switchTo)?.user.fullName;
  const cardOf = (r) => (
    <VicePrincipalCard
      key={r.user.id}
      row={r}
      campusName={campusName}
      assignerName={r.assignment ? md.userById(r.assignment.assignedBy)?.fullName : null}
      readOnly={readOnly}
      onEdit={() => setEditing(r)}
    />
  );

  return (
    <div className="page">
      <Breadcrumb items={vpCrumbs()} />
      <h1 className="page__title">Phân công Phó hiệu trưởng</h1>

      {!embedded && (
        <div className="card mb-16">
          <div className="filter-bar">
            <YearPicker years={years} value={yearId} onChange={pickYear} />
          </div>
        </div>
      )}

      {!loading && year && !readOnly && uncovered.length > 0 && (
        <div className="alert alert--warning mb-16">
          <AlertTriangle size={18} />
          <div className="flex-1">
            Chưa có Phó hiệu trưởng phụ trách: {uncovered.map((c) => c.shortName).join(', ')}.
            <div className="row mt-8">
              {uncovered.map((c) => (
                <button key={c.id} type="button" className="btn btn--sm btn--primary" onClick={() => setChoosingFor(c)}>
                  <UserCog size={15} /> Phân công cho {c.shortName || c.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      {!SCHOOL_CONFIG_API && !loading && year && !readOnly && !sharedRow && rows.length > 0 && (
        <div className="alert alert--warning mb-16">
          <Utensils size={18} />
          <div>Chưa có Phó hiệu trưởng phụ trách dịch vụ chung (bán trú toàn trường).</div>
        </div>
      )}

      {error ? (
        <div className="card">
          <ErrorState error={error} onRetry={reload} />
        </div>
      ) : loading ? (
        <div className="card">
          <div className="table-wrap">
            <table className="table table--grid table--compact">
              <tbody>
                <SkeletonRows rows={4} cols={3} />
              </tbody>
            </table>
          </div>
        </div>
      ) : rows.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={UserCog}
            title="Chưa có tài khoản Phó hiệu trưởng"
            description="Tạo tài khoản Phó hiệu trưởng trước khi phân công."
            action={
              <Link className="btn btn--primary" to="/school/staff">
                Tạo tài khoản
              </Link>
            }
          />
        </div>
      ) : SCHOOL_CONFIG_API ? (
        <>
          {!vices.loading && !vices.error && (
            <VpGapsNote
              people={assignedRows.map(personOf)}
              campuses={activeCampuses}
              missing={assignedRows.filter((r) => vices.errorsByUser[r.user.id]).map((r) => r.user.fullName)}
            />
          )}
          <div className="vp-split">
            <aside className="card vp-split__list">
              <VpPeopleList
                people={ordered.map((r) => ({
                  userId: r.user.id,
                  user: r.user,
                  // Phân công chưa tới ngày hiệu lực (vd. năm sau, từ ngày mở chuẩn bị) ghi kèm ngày bắt đầu
                  campusName: r.assignment
                    ? `${campusName(r.assignment.campusId)}${
                        r.assignment.validFrom > today ? ` · từ ${formatDate(r.assignment.validFrom)}` : ''
                      }`
                    : null,
                  items: vices.itemsByUser[r.user.id],
                  loading: vices.loading,
                  error: vices.error || vices.errorsByUser[r.user.id],
                }))}
                selectedId={selectedRow?.user.id}
                onSelect={askSelect}
                actionsOf={(p) => {
                  const r = rows.find((row) => row.user.id === p.userId);
                  if (readOnly) return null;
                  return (
                    <button
                      type="button"
                      className={`btn btn--sm ${r.assignment ? 'btn--ghost' : 'btn--primary'}`}
                      onClick={() => setEditing(r)}
                    >
                      <UserCog size={15} /> {r.assignment ? 'Đổi điểm trường' : 'Phân công điểm trường'}
                    </button>
                  );
                }}
              />
            </aside>
            <section className="card vp-split__detail" aria-label="Giao việc">
              {!selectedRow ? null : !selectedRow.assignment ? (
                <EmptyState
                  icon={UserCog}
                  title={`${selectedRow.user.fullName} chưa có điểm trường`}
                  description="Phân công điểm trường trước rồi mới giao việc."
                  action={
                    !readOnly && (
                      <button type="button" className="btn btn--primary" onClick={() => setEditing(selectedRow)}>
                        Phân công điểm trường
                      </button>
                    )
                  }
                />
              ) : vices.loading ? (
                <div className="table-wrap">
                  <table className="table table--compact">
                    <tbody>
                      <SkeletonRows rows={8} cols={2} />
                    </tbody>
                  </table>
                </div>
              ) : vices.error || vices.errorsByUser[selectedRow.user.id] || !selectedItems ? (
                <ErrorState error={vices.error || vices.errorsByUser[selectedRow.user.id]} onRetry={vices.reload} />
              ) : selectedItems.length === 0 ? (
                <EmptyState
                  icon={UserCog}
                  title="Chưa có việc nào để giao"
                  description="Vai trò Phó hiệu trưởng chưa có việc cấu hình được."
                />
              ) : (
                <VpTaskEditor
                  key={selectedRow.user.id}
                  person={personOf(selectedRow)}
                  others={assignedRows.filter((r) => r !== selectedRow).map(personOf)}
                  campuses={activeCampuses}
                  // Việc giao theo người, không theo năm nên chỉ sửa ở năm đang hoạt động
                  readOnly={year?.status !== YEAR_STATUS.ACTIVE}
                  onSaved={() => vices.reload({ silent: true })}
                  onDirty={setDirty}
                />
              )}
            </section>
          </div>
        </>
      ) : (
        <div className="sc-vp-grid">{rows.map(cardOf)}</div>
      )}

      <LeaveConfirmModal {...guard.modal} canSave={false} message="Việc vừa giao chưa được lưu. Rời trang sẽ mất các thay đổi này." />

      <ConfirmationModal
        open={switchTo !== null}
        danger
        title="Bỏ thay đổi chưa lưu?"
        message={`Việc vừa chỉnh cho ${selectedRow?.user.fullName || ''} chưa được lưu. Chuyển sang ${switchName || 'người khác'} sẽ mất các thay đổi này.`}
        confirmLabel="Bỏ thay đổi"
        cancelLabel="Ở lại"
        onClose={() => setSwitchTo(null)}
        onConfirm={() => {
          const target = switchTo;
          setSwitchTo(null);
          selectPerson(target);
        }}
      />
      {choosingFor && (
        <ChooseViceModal
          campus={choosingFor}
          rows={rows}
          campusName={campusName}
          onClose={() => setChoosingFor(null)}
          onPick={(r) => {
            setEditing({ ...r, presetCampusId: choosingFor.id });
            setChoosingFor(null);
          }}
        />
      )}
      {editing && year && (
        <AssignModal
          row={editing}
          rows={rows}
          year={year}
          campuses={md.campuses}
          sharedHolder={sharedRow?.user}
          onClose={(changed) => {
            setEditing(null);
            if (changed) reload({ silent: true });
          }}
        />
      )}
    </div>
  );
}
