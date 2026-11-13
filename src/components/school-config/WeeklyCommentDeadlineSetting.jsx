import { useEffect, useState } from 'react';
import { Save } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useAsync } from '@/hooks/useAsync';
import { SelectField } from '@/components/form/Field';
import { Button } from '@/components/ui/Button';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { getSchoolYearById, saveWeeklyCommentDeadline } from '@/services/school-config/schoolConfigService';
import { YEAR_STATUS } from '@/models/school-config/schoolConfigConstants';
import { canConfigureSchool } from '@/utils/school-config/schoolConfigPermissions';
import { formatDate } from '@/utils/format';

const MIN = 0;
const MAX = 5;
const OPTIONS = Array.from({ length: MAX - MIN + 1 }, (_, i) => ({
  value: String(MIN + i),
  label: MIN + i === 0 ? 'Hết ngày học cuối của tuần' : `${MIN + i} ngày học sau tuần`,
}));

/**
 * Cấu hình thời gian › Hạn nhận xét tuần (BE OBS-29): nhận xét tuần khóa sau 23:59:59 của ngày học thứ N sau ngày học cuối
 * của tuần giáo án; Hiệu trưởng đặt N (0–5) theo năm học chưa kết thúc. onDirtyChange / saveRef như các tab khác.
 */
export function WeeklyCommentDeadlineSetting({ yearId, onDirtyChange, saveRef }) {
  const { user } = useAuth();
  const toast = useToast();
  const { data: year, loading, error, reload } = useAsync(() => getSchoolYearById(yearId, user), [yearId, user?.id], { enabled: !!yearId });
  const [days, setDays] = useState('1');
  const [errorText, setErrorText] = useState('');
  const [saving, setSaving] = useState(false);

  const saved = String(year?.weeklyCommentDeadlineDays ?? 1);
  useEffect(() => {
    setDays(saved);
    setErrorText('');
  }, [saved]);
  const editable = !!year && year.status !== YEAR_STATUS.CLOSED && canConfigureSchool(user);
  const dirty = editable && days !== saved;
  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !year) return <LoadingState />;

  const check = () => {
    const n = Number(days);
    return Number.isInteger(n) && n >= MIN && n <= MAX ? '' : `Chọn từ ${MIN} đến ${MAX} ngày học sau tuần.`;
  };

  const save = async () => {
    const message = check();
    setErrorText(message);
    if (message) return false;
    setSaving(true);
    try {
      await saveWeeklyCommentDeadline(year.id, Number(days), user);
      toast.success('Đã lưu hạn nhận xét tuần.');
      reload({ silent: true });
      return true;
    } catch (err) {
      setErrorText(err.details?.deadlineDays || err.message);
      return false;
    } finally {
      setSaving(false);
    }
  };
  if (saveRef) saveRef.current = save;

  return (
    <section className="card">
      <div className="card__header">
        <h2 className="card__title">
          Hạn nhận xét tuần năm học {year.name} ({formatDate(year.startDate)} – {formatDate(year.endDate)})
        </h2>
      </div>
      <div className="card__body">
        <div className="grid-3">
          {editable ? (
            <SelectField
              label="Khóa nhận xét tuần sau"
              required
              error={errorText}
              value={days}
              onChange={(e) => {
                setDays(e.target.value);
                setErrorText('');
              }}
              options={OPTIONS}
            />
          ) : (
            <SelectField label="Khóa nhận xét tuần sau" value={saved} disabled options={OPTIONS} />
          )}
        </div>
      </div>
      {editable && (
        <div className="card__body row sc-end">
          <Button variant="primary" icon={Save} loading={saving} disabled={!dirty} onClick={save}>
            Lưu hạn nhận xét tuần
          </Button>
        </div>
      )}
    </section>
  );
}
