import { useEffect, useState } from 'react';
import { Save } from '@/components/ui/icons';
import { Breadcrumb, ErrorState, LoadingState, Spinner } from '@/components';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useMealPhotoWindows } from '@/hooks/kitchen/useKitchenRecords';
import { KITCHEN_RECORD_PAGES, MEAL_SESSION_LABELS } from '@/models/kitchen/kitchenRecordConstants';
import { kitchenRecordsApi } from '@/services/kitchenRecordsApi';
import { kitchenCrumbs } from '@/utils/kitchen/breadcrumbs';
import { isPrincipal } from '@/utils/kitchen/kitchenPermissions';
import { validateWindowsForm, windowsToForm } from '@/utils/kitchen/kitchenRecords';
import '@/styles/modules/kitchen.css';
import '@/styles/modules/kitchen-records.css';

/**
 * Khung giờ bếp được đăng ảnh từng bữa (`/kitchen/photo-windows`), chung toàn trường. Hiệu trưởng sửa; Phó hiệu trưởng chỉ
 * xem (BE từ chối sửa với vai trò khác). Bữa chưa cấu hình thì bếp chưa đăng được ảnh bữa đó.
 */
export default function MealPhotoWindowsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const windows = useMealPhotoWindows();
  const canEdit = isPrincipal(user);
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

  const setCell = (index, field, value) => {
    setForm((rows) => rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
    setErrors((e) => ({ ...e, [`windows.${index}.${field}`]: undefined, _form: undefined }));
  };

  const save = async () => {
    const found = validateWindowsForm(form);
    setErrors(found);
    if (Object.keys(found).length) {
      toast.error('Kiểm tra các ô giờ đánh dấu đỏ.', 'Chưa lưu được');
      return;
    }
    setSaving(true);
    try {
      const saved = await kitchenRecordsApi.saveWindows(form);
      windows.setData(saved);
      toast.success('Đã lưu khung giờ đăng ảnh.');
    } catch (err) {
      if (err.details && typeof err.details === 'object') setErrors(err.details);
      toast.error(err, 'Chưa lưu được khung giờ');
    } finally {
      setSaving(false);
    }
  };

  let body;
  if (windows.error) body = <ErrorState error={windows.error} onRetry={windows.reload} />;
  else if (windows.loading || !windows.data) body = <LoadingState />;
  else
    body = (
      <section className="card">
        {!canEdit && (
          <div className="alert alert--info card__body" role="status">
            Chỉ Hiệu trưởng được đặt khung giờ đăng ảnh. Tài khoản này chỉ xem.
          </div>
        )}
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
                        disabled={!canEdit || saving}
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
        {canEdit && (
          <div className="card__body">
            <button type="button" className="btn btn--primary" disabled={saving} onClick={save}>
              {saving ? <Spinner small /> : <Save size={16} />} Lưu khung giờ
            </button>
          </div>
        )}
      </section>
    );

  return (
    <div className="page">
      <Breadcrumb items={kitchenCrumbs(KITCHEN_RECORD_PAGES.photoWindows)} />
      <div className="page__head">
        <div>
          <h1 className="page__title">Khung giờ đăng ảnh bữa ăn</h1>
        </div>
      </div>
      {body}
    </div>
  );
}
