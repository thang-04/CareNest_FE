import { useEffect, useState } from 'react';
import { Save } from '@/components/ui/icons';
import { ErrorState, LoadingState, Spinner } from '@/components/ui/States';
import { useToast } from '@/contexts/ToastContext';
import { useMealPhotoWindows } from '@/hooks/kitchen/useKitchenRecords';
import { MEAL_SESSION_LABELS } from '@/models/kitchen/kitchenRecordConstants';
import { kitchenRecordsApi } from '@/services/kitchenRecordsApi';
import { validateWindowsForm, windowsToForm } from '@/utils/kitchen/kitchenRecords';
import '@/styles/modules/kitchen-records.css';

/**
 * Cấu hình thời gian › Giờ đăng ảnh: khung giờ bếp được đăng ảnh từng bữa, chung toàn trường (BE `/meal-photo-windows`).
 * Bữa chưa cấu hình thì bếp chưa đăng được ảnh bữa đó. Đặt ở gốc `components/` vì dùng dữ liệu của module bếp trong trang cấu hình trường.
 * onDirtyChange / saveRef: trang cha hỏi lưu khi đổi tab hoặc rời màn còn giờ chưa lưu.
 */
export function MealPhotoWindowsSetting({ onDirtyChange, saveRef }) {
  const toast = useToast();
  const windows = useMealPhotoWindows();
  const [form, setForm] = useState([]);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // Khung giờ nạp lại từ BE (lần đầu, sau khi lưu) thì nạp lại ô nhập
  useEffect(() => {
    if (windows.data) {
      setForm(windowsToForm(windows.data));
      setErrors({});
    }
  }, [windows.data]);

  const changed = !!windows.data && JSON.stringify(form) !== JSON.stringify(windowsToForm(windows.data));
  useEffect(() => onDirtyChange?.(changed), [changed, onDirtyChange]);

  const setCell = (index, field, value) => {
    setForm((rows) => rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
    setErrors((e) => ({ ...e, [`windows.${index}.${field}`]: undefined, _form: undefined }));
  };

  // Trả true khi lưu được
  const save = async () => {
    const found = validateWindowsForm(form);
    setErrors(found);
    if (Object.keys(found).length) {
      toast.error('Kiểm tra các ô giờ đánh dấu đỏ.', 'Chưa lưu được');
      return false;
    }
    setSaving(true);
    try {
      const saved = await kitchenRecordsApi.saveWindows(form);
      windows.setData(saved);
      toast.success('Đã lưu giờ đăng ảnh.');
      return true;
    } catch (err) {
      if (err.details && typeof err.details === 'object') setErrors(err.details);
      toast.error(err, 'Chưa lưu được giờ đăng ảnh');
      return false;
    } finally {
      setSaving(false);
    }
  };
  if (saveRef) saveRef.current = save;

  if (windows.error) return <ErrorState error={windows.error} onRetry={windows.reload} />;
  if (windows.loading || !windows.data) return <LoadingState />;

  return (
    <section className="card">
      <div className="card__header">
        <h2 className="card__title">Giờ bếp được đăng ảnh bữa ăn</h2>
        <span className="muted text-sm">Chung cho cả trường. Bữa chưa đặt giờ thì bếp chưa đăng được ảnh bữa đó.</span>
      </div>
      {errors._form && (
        <div className="alert alert--danger card__body" role="alert">
          {errors._form}
        </div>
      )}
      <div className="table-wrap">
        <table className="table table--grid kr-table">
          <thead>
            <tr>
              <th>Bữa ăn</th>
              <th>Từ giờ</th>
              <th>Đến giờ</th>
            </tr>
          </thead>
          <tbody>
            {form.map((row, i) => (
              <tr key={row.session}>
                <th scope="row">
                  {MEAL_SESSION_LABELS[row.session] || row.session}
                  {!row.configured && <div className="text-xs muted">Chưa cấu hình</div>}
                </th>
                {['startTime', 'endTime'].map((field) => (
                  <td key={field}>
                    <input
                      type="time"
                      className={`input kr-window-time ${errors[`windows.${i}.${field}`] ? 'input--error' : ''}`}
                      aria-label={`${field === 'startTime' ? 'Từ giờ' : 'Đến giờ'} ${MEAL_SESSION_LABELS[row.session] || row.session}`}
                      value={row[field]}
                      disabled={saving}
                      onChange={(e) => setCell(i, field, e.target.value)}
                    />
                    {errors[`windows.${i}.${field}`] && <div className="field__error">{errors[`windows.${i}.${field}`]}</div>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card__body">
        <button type="button" className="btn btn--primary" disabled={saving} onClick={save}>
          {saving ? <Spinner small /> : <Save size={16} />} Lưu giờ đăng ảnh
        </button>
      </div>
    </section>
  );
}
