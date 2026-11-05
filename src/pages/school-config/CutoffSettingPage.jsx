import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Clock4, Save, Lock } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useConfigYear } from '@/hooks/school-config/useConfigYear';
import { useMasterData } from '@/hooks/useMasterData';
import { useCutoffSetting } from '@/hooks/school-config/useSchoolConfig';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { ErrorState, LoadingState, Spinner } from '@/components/ui/States';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { LeaveConfirmModal } from '@/components/ui/LeaveConfirmModal';
import { useLeaveGuard } from '@/hooks/useLeaveGuard';
import { FormField } from '@/components/form/FormField';
import { Pagination, paginate } from '@/components/ui/Pagination';
import { ScNoAccess } from '@/components/school-config/ScNoAccess';
import { HolidaySetting } from '@/components/school-config/HolidaySetting';
import { SemesterSetting } from '@/components/school-config/SemesterSetting';
import { Tabs } from '@/components/ui/Tabs';
import { saveCutoffSetting } from '@/services/school-config/schoolConfigService';
import { YEAR_STATUS } from '@/models/school-config/schoolConfigConstants';
import { canConfigureCutoff } from '@/utils/school-config/schoolConfigPermissions';
import { validateCutoff, hasErrors, errorsAfterChange, CUTOFF_LIMITS } from '@/utils/school-config/schoolConfigValidation';
import { cutoffCrumbs } from '@/utils/school-config/breadcrumbs';
import { formatDate, formatDateTime, todayInput } from '@/utils/format';
import '@/styles/modules/school-config.css';

const TABS = [
  { key: 'cutoff', label: 'Giờ chốt điểm danh' },
  { key: 'semester', label: 'Học kỳ' },
  { key: 'holidays', label: 'Ngày nghỉ' },
];

/** #19 Cấu hình thời gian: giờ chốt (UC 2.7, GBR-CFG-02/03) và học kỳ I, II. Principal only. */
export default function CutoffSettingPage() {
  const { user } = useAuth();
  const toast = useToast();
  const md = useMasterData();
  const yearId = useConfigYear();
  const { year, setting, loading, error, reload } = useCutoffSetting(yearId, { live: false });
  const [form, setForm] = useState({ time: '', effectiveFrom: '', note: '' });
  const [initial, setInitial] = useState(null);
  const [errors, setErrors] = useState({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [params, setParams] = useSearchParams();
  const tab = ['semester', 'holidays'].includes(params.get('tab')) ? params.get('tab') : 'cutoff';
  // Tab Học kỳ / Ngày nghỉ báo còn thay đổi chưa lưu; đổi tab hay rời màn đều hỏi như tab giờ chốt
  const [childDirty, setChildDirty] = useState(false);
  const childSave = useRef(null);
  const switchTab = (key) => {
    setChildDirty(false);
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (key === 'cutoff') next.delete('tab');
        else next.set('tab', key);
        return next;
      },
      { replace: true },
    );
  };

  // New values apply from today at the earliest: retroactive changes are not specified (UC 2.7).
  useEffect(() => {
    if (!year) return;
    const today = todayInput();
    const from = today < year.startDate ? year.startDate : today;
    const next = { time: setting?.time || '', effectiveFrom: from, note: '' };
    setForm(next);
    setInitial(next);
    setErrors({});
  }, [year, setting]);

  const dirty = !!initial && ['time', 'effectiveFrom', 'note'].some((key) => form[key] !== initial[key]);
  // Rời màn khi đang sửa giờ chốt ⇒ hỏi; "Lưu" trong hộp kiểm tra rồi lưu như nút Lưu giờ chốt
  const guard = useLeaveGuard({
    when: (dirty && !saving) || childDirty,
    onSave: () => (tab === 'cutoff' ? (validate() ? persist() : false) : (childSave.current?.() ?? false)),
  });
  const changeTab = (key) => key !== tab && guard.leave(() => switchTab(key));

  if (!canConfigureCutoff(user))
    return (
      <div className="page">
        <Breadcrumb items={cutoffCrumbs()} />
        <h1 className="page__title">Cấu hình thời gian</h1>
        <ScNoAccess description="Chỉ Hiệu trưởng được cấu hình thời gian." />
      </div>
    );

  const closed = year?.status === YEAR_STATUS.CLOSED;
  const set = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    setErrors((e) => errorsAfterChange(e, patch, { ...form, ...patch }, CUTOFF_LIMITS));
  };

  const validate = () => {
    const e = validateCutoff(form, year);
    // Như BE CUTOFF_DATE_PAST: đã có giờ chốt thì lần đổi sau chỉ áp dụng từ hôm nay (gõ tay vượt được min của ô ngày)
    if (!e.effectiveFrom && setting?.history?.length && form.effectiveFrom < todayInput())
      e.effectiveFrom = 'Giờ chốt mới chỉ áp dụng từ hôm nay trở đi';
    if (!e.time && setting && setting.time === form.time && setting.effectiveFrom === form.effectiveFrom)
      e.time = 'Giờ chốt và ngày áp dụng chưa thay đổi';
    setErrors(e);
    return !hasErrors(e);
  };
  const ask = () => {
    if (validate()) setConfirmOpen(true);
  };

  // Trả true khi lưu được
  const persist = async () => {
    setSaving(true);
    try {
      await saveCutoffSetting(yearId, form, user);
      toast.success('Đã lưu giờ chốt. Hãy báo trực tiếp cho các Phó hiệu trưởng và giáo viên.');
      setConfirmOpen(false);
      setInitial(form);
      reload({ silent: true });
      return true;
    } catch (err) {
      setConfirmOpen(false);
      setErrors(err.details || { _form: err.message });
      return false;
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page">
      <Breadcrumb items={cutoffCrumbs()} />
      <h1 className="page__title">Cấu hình thời gian</h1>
      <div className="mb-16">
        <Tabs items={TABS} value={tab} onChange={changeTab} ariaLabel="Cấu hình thời gian" />
      </div>

      {tab === 'semester' ? (
        <SemesterSetting yearId={yearId} onDirtyChange={setChildDirty} saveRef={childSave} />
      ) : tab === 'holidays' ? (
        <HolidaySetting yearId={yearId} onDirtyChange={setChildDirty} saveRef={childSave} />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading || !year ? (
        <LoadingState />
      ) : (
        <>
          <div className="stack">
            <section className="card sc-cutoff-now">
              {setting ? (
                <div className="sc-cutoff">
                  <Clock4 size={20} className="text-primary" aria-hidden="true" />
                  <span>{setting.effectiveFrom > todayInput() ? 'Giờ chốt sắp áp dụng' : 'Giờ chốt đang áp dụng'}</span>
                  <b className="sc-cutoff__time">{setting.time}</b>
                  <span className="text-sm text-2">
                    từ {formatDate(setting.effectiveFrom)} · năm học {year.name}
                  </span>
                </div>
              ) : (
                <div className="muted">Chưa có giờ chốt.</div>
              )}
            </section>

            <section className="card">
              <div className="card__header">
                <h2 className="card__title">Thay đổi giờ chốt</h2>
              </div>
              <div className="card__body">
                {closed ? (
                  <div className="alert alert--info">
                    <Lock size={18} />
                    <div>Năm học {year.name} đã kết thúc, giờ chốt chỉ còn xem.</div>
                  </div>
                ) : (
                  <>
                    {errors._form && (
                      <div className="alert alert--danger mb-12" role="alert">
                        {errors._form}
                      </div>
                    )}
                    <div className="grid-2">
                      <FormField label="Giờ chốt" required error={errors.time}>
                        <input className="input" type="time" value={form.time} onChange={(e) => set({ time: e.target.value })} />
                      </FormField>
                      <FormField label="Áp dụng từ ngày" required error={errors.effectiveFrom}>
                        <input
                          className="input"
                          type="date"
                          min={todayInput() > year.startDate ? todayInput() : year.startDate}
                          max={year.endDate}
                          value={form.effectiveFrom}
                          onChange={(e) => set({ effectiveFrom: e.target.value })}
                        />
                      </FormField>
                    </div>
                    <FormField label="Ghi chú" error={errors.note} className="mt-12">
                      <textarea
                        className="textarea"
                        rows={2}
                        value={form.note}
                        placeholder="Lý do thay đổi (nếu có)"
                        onChange={(e) => set({ note: e.target.value })}
                      />
                    </FormField>
                    <div className="row mt-16 sc-end">
                      <button className="btn btn--primary" onClick={ask} disabled={saving}>
                        {saving ? <Spinner small /> : <Save size={16} />} Lưu giờ chốt
                      </button>
                    </div>
                  </>
                )}
              </div>
            </section>
          </div>

          <section className="card mt-16">
            <div className="card__header">
              <h2 className="card__title">Lịch sử thay đổi</h2>
            </div>
            <div className="table-wrap sc-table-flat">
              <table className="table table--grid table--compact">
                <thead>
                  <tr>
                    <th>Thời điểm</th>
                    <th>Người thay đổi</th>
                    <th>Giờ cũ</th>
                    <th>Giờ mới</th>
                    <th>Áp dụng từ</th>
                    <th>Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  {!setting?.history?.length ? (
                    <tr>
                      <td colSpan={6} className="muted center">
                        Chưa có thay đổi nào.
                      </td>
                    </tr>
                  ) : (
                    // Mới nhất trước, 5 lần / trang
                    paginate(
                      [...setting.history].reverse(),
                      Math.min(historyPage, Math.max(1, Math.ceil(setting.history.length / 5))),
                      5,
                    ).map((h) => (
                      <tr key={`${h.at}-${h.time}`}>
                        <td className="nowrap">{formatDateTime(h.at)}</td>
                        <td>{h.userName || md.userById(h.userId)?.fullName || h.userId}</td>
                        <td>{h.previousTime || '—'}</td>
                        <td className="fw-600">{h.time}</td>
                        <td>{formatDate(h.effectiveFrom)}</td>
                        <td className="sc-wrap">{h.note || <span className="muted">—</span>}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {setting?.history?.length > 5 && (
              <Pagination
                page={Math.min(historyPage, Math.ceil(setting.history.length / 5))}
                total={setting.history.length}
                pageSize={5}
                onChange={setHistoryPage}
                unit="lần"
              />
            )}
          </section>
        </>
      )}

      <ConfirmationModal
        open={confirmOpen}
        title="Lưu giờ chốt"
        message={
          <>
            Từ ngày <b>{formatDate(form.effectiveFrom)}</b>, điểm danh và suất ăn sẽ khóa lúc <b>{form.time}</b> mỗi ngày học. Hệ thống chưa
            gửi thông báo; hãy báo trực tiếp cho các Phó hiệu trưởng và giáo viên.
          </>
        }
        confirmLabel="Lưu giờ chốt"
        onConfirm={persist}
        onClose={() => setConfirmOpen(false)}
      />
      <LeaveConfirmModal {...guard.modal} />
    </div>
  );
}
