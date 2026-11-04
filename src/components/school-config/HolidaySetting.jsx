import { useEffect, useState } from 'react';
import { Plus, Save, Trash2 } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useAsync } from '@/hooks/useAsync';
import { DateInput } from '@/components/form/DateInput';
import { FormField } from '@/components/form/FormField';
import { EmptyState, ErrorState, LoadingState, Spinner } from '@/components/ui/States';
import { getHolidays, getSchoolYearById, saveHolidays } from '@/services/school-config/schoolConfigService';
import { YEAR_STATUS } from '@/models/school-config/schoolConfigConstants';
import { canManageSchoolCalendar } from '@/utils/school-config/schoolConfigPermissions';
import { formatDate, isIsoDate } from '@/utils/format';
import { holidayDays, validateHoliday } from '@/utils/school-config/holidays';

const NAME_MAX = 100;
const EMPTY = { startDate: '', endDate: '', name: '' };

/**
 * Cấu hình thời gian › Ngày nghỉ (BE SCH-05): đợt nghỉ lễ, Tết… từ ngày – đến ngày; các ngày trong đợt không tính là
 * ngày học dù rơi vào thứ 2–6 (điểm danh, báo ăn, đánh giá, báo cáo bỏ qua). HT (hoặc PHT được cấp quyền) thêm / bớt rồi
 * lưu cả danh sách; BE kiểm lại (trong năm học, không chồng đợt, không trùm ngày đã điểm danh).
 */
export function HolidaySetting({ yearId }) {
  const { user } = useAuth();
  const toast = useToast();
  const {
    data: year,
    error: yearError,
    reload: reloadYear,
  } = useAsync(() => getSchoolYearById(yearId, user), [yearId, user?.id], { enabled: !!yearId });
  const { data, loading, error, reload } = useAsync(() => getHolidays(yearId, user), [yearId, user?.id], { enabled: !!yearId });
  const [rows, setRows] = useState([]);
  const [draft, setDraft] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => setRows(data || []), [data]);

  if (yearError) return <ErrorState error={yearError} onRetry={reloadYear} />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !year) return <LoadingState />;

  const editable = canManageSchoolCalendar(user) && year.status !== YEAR_STATUS.CLOSED;
  const changed = JSON.stringify(rows) !== JSON.stringify(data || []);
  const setField = (patch) => {
    setDraft((d) => ({ ...d, ...patch }));
    setErrors(({ _form: _f, ...rest }) => Object.fromEntries(Object.entries(rest).filter(([k]) => !(k in patch))));
  };

  const add = () => {
    const e = validateHoliday(draft, year, rows);
    setErrors(e);
    if (Object.keys(e).length) return;
    const item = { startDate: draft.startDate, endDate: draft.endDate, name: draft.name.trim() };
    setRows((all) => [...all, item].sort((a, b) => a.startDate.localeCompare(b.startDate)));
    setDraft(EMPTY);
  };

  const save = async () => {
    setSaving(true);
    try {
      await saveHolidays(yearId, rows, user);
      toast.success('Đã lưu ngày nghỉ.');
      setErrors({});
      reload({ silent: true });
    } catch (err) {
      setErrors({ _form: err.message });
      toast.error(err, 'Chưa lưu được ngày nghỉ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="card">
      <div className="card__header">
        <h2 className="card__title">
          Ngày nghỉ năm học {year.name} ({formatDate(year.startDate)} – {formatDate(year.endDate)})
        </h2>
        <span className="muted text-sm">Ngày nghỉ không tính là ngày học: không điểm danh, không báo ăn, không đánh giá.</span>
      </div>
      {errors._form && (
        <div className="card__body">
          <div className="alert alert--danger" role="alert">
            {errors._form}
          </div>
        </div>
      )}
      {editable && (
        <div className="card__body sc-holiday-form">
          <FormField label="Từ ngày" required error={errors.startDate}>
            <DateInput
              aria-label="Nghỉ từ ngày"
              min={year.startDate}
              max={year.endDate}
              value={draft.startDate}
              onChange={(v) => setField({ startDate: v, ...(isIsoDate(v) && !draft.endDate ? { endDate: v } : {}) })}
            />
          </FormField>
          <FormField label="Đến ngày" required error={errors.endDate}>
            <DateInput
              aria-label="Nghỉ đến ngày"
              min={draft.startDate || year.startDate}
              max={year.endDate}
              value={draft.endDate}
              onChange={(v) => setField({ endDate: v })}
            />
          </FormField>
          <FormField label="Tên đợt nghỉ" required error={errors.name} className="flex-1">
            <input
              className="input"
              aria-label="Tên đợt nghỉ"
              placeholder="Vd. Quốc khánh, Tết Nguyên đán"
              maxLength={NAME_MAX}
              value={draft.name}
              onChange={(e) => setField({ name: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && add()}
            />
          </FormField>
          <button className="btn sc-holiday-form__add" onClick={add}>
            <Plus size={16} /> Thêm đợt nghỉ
          </button>
        </div>
      )}
      {rows.length === 0 ? (
        <EmptyState title="Chưa có ngày nghỉ" description="Năm học chỉ nghỉ thứ Bảy, Chủ nhật." />
      ) : (
        <div className="table-wrap sc-table-flat">
          <table className="table table--grid">
            <thead>
              <tr>
                <th>Từ ngày</th>
                <th>Đến ngày</th>
                <th className="num">Số ngày học được nghỉ</th>
                <th>Tên đợt nghỉ</th>
                {editable && <th className="cell--actions">Thao tác</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.startDate}>
                  <td className="nowrap">{formatDate(r.startDate)}</td>
                  <td className="nowrap">{formatDate(r.endDate)}</td>
                  <td className="num">{holidayDays(r)}</td>
                  <td>{r.name}</td>
                  {editable && (
                    <td className="cell--actions">
                      <button
                        className="btn btn--sm btn--ghost"
                        aria-label={`Bỏ đợt nghỉ ${r.name}`}
                        onClick={() => setRows((all) => all.filter((x) => x.startDate !== r.startDate))}
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editable && (
        <div className="card__body row sc-end">
          {changed && (
            <button className="btn" onClick={() => setRows(data || [])} disabled={saving}>
              Hủy thay đổi
            </button>
          )}
          <button className="btn btn--primary" onClick={save} disabled={saving || !changed}>
            {saving ? <Spinner small /> : <Save size={16} />} Lưu ngày nghỉ
          </button>
        </div>
      )}
    </section>
  );
}
