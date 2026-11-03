import { useEffect, useState } from 'react';
import { Plus, Save, Trash2 } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useAsync } from '@/hooks/useAsync';
import { DateInput } from '@/components/form/DateInput';
import { EmptyState, ErrorState, LoadingState, Spinner } from '@/components/ui/States';
import { getHolidays, getSchoolYearById, saveHolidays } from '@/services/school-config/schoolConfigService';
import { YEAR_STATUS } from '@/models/school-config/schoolConfigConstants';
import { canConfigureSchool } from '@/utils/school-config/schoolConfigPermissions';
import { formatDate, isIsoDate } from '@/utils/format';

const NAME_MAX = 100;

/**
 * Cấu hình thời gian › Ngày nghỉ (BE SCH-05): ngày lễ, Tết… của năm học không tính là ngày học dù rơi vào thứ 2–6
 * (điểm danh, đơn nghỉ, đánh giá, báo cáo bỏ qua). Hiệu trưởng thêm / bớt rồi lưu cả danh sách.
 */
export function HolidaySetting({ yearId }) {
  const { user } = useAuth();
  const toast = useToast();
  const { data: year } = useAsync(() => getSchoolYearById(yearId, user), [yearId, user?.id], { enabled: !!yearId });
  const { data, loading, error, reload } = useAsync(() => getHolidays(yearId, user), [yearId, user?.id], { enabled: !!yearId });
  const [rows, setRows] = useState([]);
  const [draft, setDraft] = useState({ date: '', name: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => setRows(data || []), [data]);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !year) return <LoadingState />;

  const editable = canConfigureSchool(user) && year.status !== YEAR_STATUS.CLOSED;
  const changed = JSON.stringify(rows) !== JSON.stringify(data || []);

  const add = () => {
    const e = {};
    if (!isIsoDate(draft.date)) e.date = 'Chọn ngày';
    else if (draft.date < year.startDate || draft.date > year.endDate) e.date = 'Ngày phải nằm trong năm học';
    else if (rows.some((r) => r.date === draft.date)) e.date = 'Ngày này đã có trong danh sách';
    if (!draft.name.trim()) e.name = 'Nhập tên ngày nghỉ';
    setErrors(e);
    if (Object.keys(e).length) return;
    setRows((all) => [...all, { date: draft.date, name: draft.name.trim() }].sort((a, b) => a.date.localeCompare(b.date)));
    setDraft({ date: '', name: '' });
  };

  const save = async () => {
    setSaving(true);
    try {
      await saveHolidays(yearId, rows, user);
      toast.success('Đã lưu ngày nghỉ.');
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
        <div className="card__body filter-bar">
          <div className="field">
            <DateInput
              aria-label="Ngày nghỉ"
              min={year.startDate}
              max={year.endDate}
              value={draft.date}
              onChange={(v) => setDraft((d) => ({ ...d, date: v }))}
            />
            {errors.date && <p className="field__error">{errors.date}</p>}
          </div>
          <div className="field flex-1">
            <input
              className="input"
              aria-label="Tên ngày nghỉ"
              placeholder="Vd. Quốc khánh, Tết Nguyên đán"
              maxLength={NAME_MAX}
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && add()}
            />
            {errors.name && <p className="field__error">{errors.name}</p>}
          </div>
          <button className="btn" onClick={add}>
            <Plus size={16} /> Thêm ngày nghỉ
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
                <th>Ngày</th>
                <th>Tên ngày nghỉ</th>
                {editable && <th className="cell--actions">Thao tác</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.date}>
                  <td className="nowrap">{formatDate(r.date)}</td>
                  <td>{r.name}</td>
                  {editable && (
                    <td className="cell--actions">
                      <button
                        className="btn btn--sm btn--ghost"
                        aria-label={`Bỏ ngày nghỉ ${formatDate(r.date)}`}
                        onClick={() => setRows((all) => all.filter((x) => x.date !== r.date))}
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
