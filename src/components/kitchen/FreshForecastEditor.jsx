import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calculator, Save } from '@/components/ui/icons';
import { Breadcrumb, DateInput, ErrorState, FormField, Spinner } from '@/components';
import { ForecastCountsTable, ForecastLinesTable } from '@/components/kitchen/FreshForecastTables';
import { useToast } from '@/contexts/ToastContext';
import { useCanManageStock } from '@/hooks/kitchen/useDryStock';
import { freshGoodsApi } from '@/services/freshGoodsApi';
import { NOTE_MAX } from '@/models/kitchen/kitchenConstants';
import { countsToForm, emptyForecastForm, forecastInputKey, validateForecastForm } from '@/utils/kitchen/freshGoodsForm';
import { kitchenCrumbs, KITCHEN_PAGES } from '@/utils/kitchen/breadcrumbs';
import { todayInput } from '@/utils/format';

/**
 * Lập bản dự trù (`/kitchen/forecast/new`): chọn kỳ, BE tính lượng thực phẩm (xem trước, chưa lưu), sửa số trẻ dự kiến rồi
 * "Tính lại", cuối cùng lưu. Bảng chỉ lưu được khi khớp kỳ và số trẻ đang nhập.
 */
export function FreshForecastEditor({ campus }) {
  const navigate = useNavigate();
  const toast = useToast();
  const canManage = useCanManageStock();
  const [form, setForm] = useState(() => emptyForecastForm({ campusId: campus.campusId, today: todayInput() }));
  const [preview, setPreview] = useState(null); // { data, key } của lần tính gần nhất
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState('');

  const listPath = `/kitchen/forecast?campusId=${campus.campusId}`;
  const stale = !!preview && preview.key !== forecastInputKey(form);

  const setField = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined, _form: undefined }));
  };
  const setCount = (index, value) => {
    setForm((f) => ({ ...f, counts: f.counts.map((c, i) => (i === index ? { ...c, expectedCount: value } : c)) }));
    setErrors((e) => ({ ...e, [`counts.${index}`]: undefined, _form: undefined }));
  };

  const fail = (err, heading) => {
    setErrors(err.details && typeof err.details === 'object' ? err.details : { _form: err.message });
    toast.error(err, heading);
  };

  const calculate = async () => {
    const found = validateForecastForm(form);
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy('preview');
    try {
      const data = await freshGoodsApi.previewForecast(form);
      // Lần đầu BE điền sẵn số trẻ đang theo học; các lần sau BE trả đúng số đã gửi
      const next = { ...form, counts: countsToForm(data.counts) };
      setForm(next);
      setPreview({ data, key: forecastInputKey(next) });
    } catch (err) {
      fail(err, 'Chưa tính được dự trù');
    } finally {
      setBusy('');
    }
  };

  const save = async () => {
    setBusy('save');
    try {
      const saved = await freshGoodsApi.saveForecast(form);
      toast.success('Đã lưu bản dự trù hàng tươi.');
      navigate(`/kitchen/forecast/${saved.id}?campusId=${campus.campusId}`, { replace: true });
    } catch (err) {
      fail(err, 'Chưa lưu được bản dự trù');
    } finally {
      setBusy('');
    }
  };

  if (!canManage) {
    return (
      <div className="page">
        <Breadcrumb items={kitchenCrumbs(KITCHEN_PAGES.forecast, 'Lập bản dự trù')} />
        <ErrorState error={{ status: 403, message: 'Tài khoản chưa được cấp quyền lập bản dự trù hàng tươi.' }} />
      </div>
    );
  }

  const data = preview?.data;
  return (
    <div className="page">
      <Breadcrumb items={kitchenCrumbs(KITCHEN_PAGES.forecast, 'Lập bản dự trù')} />
      <div className="page__head">
        <h1 className="page__title">Lập bản dự trù hàng tươi</h1>
      </div>
      {errors._form && (
        <div className="alert alert--danger mb-16" role="alert">
          {errors._form}
        </div>
      )}
      <section className="card mb-16">
        <div className="card__header">
          <div className="card__title">Kỳ dự trù</div>
        </div>
        <div className="card__body grid-2">
          <FormField label="Từ ngày" required error={errors.periodFrom}>
            <DateInput value={form.periodFrom} onChange={(v) => setField('periodFrom', v)} />
          </FormField>
          <FormField label="Đến ngày" required error={errors.periodTo}>
            <DateInput value={form.periodTo} onChange={(v) => setField('periodTo', v)} />
          </FormField>
          <FormField label="Ghi chú" error={errors.note} hint={`Tối đa ${NOTE_MAX} ký tự`}>
            <input className="input" value={form.note} maxLength={NOTE_MAX} onChange={(e) => setField('note', e.target.value)} />
          </FormField>
          <div className="kb-field-action">
            <button type="button" className="btn btn--primary" disabled={!!busy} onClick={calculate}>
              {busy === 'preview' ? <Spinner small /> : <Calculator size={16} />} {data ? 'Tính lại' : 'Tính dự trù'}
            </button>
          </div>
        </div>
      </section>

      {stale && (
        <div className="alert alert--warning mb-16" role="status">
          Kỳ hoặc số trẻ dự kiến đã đổi. Bấm "Tính lại" để cập nhật bảng thực phẩm trước khi lưu.
        </div>
      )}

      {data && (
        <>
          <section className="card mb-16">
            <div className="card__header">
              <div className="card__title">Số trẻ dự kiến</div>
            </div>
            <ForecastCountsTable counts={form.counts} editable={!busy} errors={errors} onChange={setCount} />
            <p className="card__body text-sm muted">
              Mặc định bằng số trẻ đang theo học. Sửa số dự kiến rồi bấm "Tính lại" để cập nhật lượng thực phẩm.
            </p>
          </section>
          <section className={`card ${stale ? 'kb-stale' : ''}`}>
            <div className="card__header">
              <div className="card__title">Thực phẩm cần đặt</div>
            </div>
            {data.lines.length ? (
              <ForecastLinesTable forecast={data} />
            ) : (
              <p className="card__body muted">Kỳ này chưa có thực phẩm tươi cần đặt. Kiểm tra thực đơn của các ngày trong kỳ.</p>
            )}
          </section>
        </>
      )}

      <div className="page-actions">
        <Link className="btn" to={listPath}>
          <ArrowLeft size={16} /> Quay lại
        </Link>
        <button type="button" className="btn btn--primary" disabled={!data || stale || !!busy} onClick={save}>
          {busy === 'save' ? <Spinner small /> : <Save size={16} />} Lưu bản dự trù
        </button>
      </div>
    </div>
  );
}
