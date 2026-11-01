import { useEffect, useState } from 'react';
import { Clock4, Save, Info, Lock } from '@/components/ui/icons';
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
import { saveCutoffSetting } from '@/services/school-config/schoolConfigService';
import { CUTOFF_DEFAULT_HINT, YEAR_STATUS } from '@/models/school-config/schoolConfigConstants';
import { canConfigureCutoff } from '@/utils/school-config/schoolConfigPermissions';
import { validateCutoff, hasErrors, errorsAfterChange, CUTOFF_LIMITS } from '@/utils/school-config/schoolConfigValidation';
import { cutoffCrumbs } from '@/utils/school-config/breadcrumbs';
import { formatDate, formatDateTime, todayInput } from '@/utils/format';
import '@/styles/modules/school-config.css';

/** #19 Cutoff Setting (UC 2.7, GBR-CFG-02/03). Principal only. */
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
  const guard = useLeaveGuard({ when: dirty && !saving, onSave: () => (validate() ? persist() : false) });

  if (!canConfigureCutoff(user))
    return (
      <div className="page">
        <Breadcrumb items={cutoffCrumbs()} />
        <h1 className="page__title">Giờ chốt điểm danh & suất ăn</h1>
        <ScNoAccess description="Chỉ Hiệu trưởng được cấu hình giờ chốt điểm danh và suất ăn." />
      </div>
    );

  const closed = year?.status === YEAR_STATUS.CLOSED;
  const set = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    setErrors((e) => errorsAfterChange(e, patch, { ...form, ...patch }, CUTOFF_LIMITS));
  };

  const validate = () => {
    const e = validateCutoff(form, year);
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
      <h1 className="page__title">Giờ chốt điểm danh & suất ăn</h1>

      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading || !year ? (
        <LoadingState />
      ) : (
        <>
          <div className="split-2">
            <section className="card">
              <div className="card__header">
                <h2 className="card__title">Giờ chốt đang áp dụng</h2>
              </div>
              <div className="card__body">
                {setting ? (
                  <div className="sc-cutoff">
                    <div className="sc-cutoff__icon" aria-hidden="true">
                      <Clock4 size={28} />
                    </div>
                    <div>
                      <div className="sc-cutoff__time">{setting.time}</div>
                      <div className="text-sm text-2">
                        Áp dụng từ {formatDate(setting.effectiveFrom)} · năm học {year.name}
                      </div>
                      <div className="text-xs muted mt-8">
                        Cập nhật bởi {setting.updatedByName || md.userById(setting.updatedBy)?.fullName || setting.updatedBy} lúc{' '}
                        {formatDateTime(setting.updatedAt)}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="alert alert--warning">
                    <Info size={18} />
                    <div>Năm học {year.name} chưa có giờ chốt. Hãy nhập giờ chốt trước khi giáo viên bắt đầu điểm danh.</div>
                  </div>
                )}
                <p className="text-sm text-2 mt-12">
                  Sau giờ chốt, điểm danh và đăng ký suất ăn trong ngày bị khóa; hệ thống tổng hợp suất ăn theo lớp để Phó hiệu trưởng xác
                  nhận. Trẻ đến sau giờ chốt không được tính vào suất ăn của ngày đó.
                </p>
              </div>
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
                      <FormField label="Giờ chốt" required error={errors.time} hint={CUTOFF_DEFAULT_HINT}>
                        <input className="input" type="time" value={form.time} onChange={(e) => set({ time: e.target.value })} />
                      </FormField>
                      <FormField label="Áp dụng từ ngày" required error={errors.effectiveFrom} hint="Trong năm học, từ hôm nay trở đi">
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
