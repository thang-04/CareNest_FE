import { useState } from 'react';
import { Calculator, Save } from '@/components/ui/icons';
import { DateInput, FormField, Modal, Spinner } from '@/components';
import { ForecastCountsTable, ForecastLinesTable } from '@/components/kitchen/FreshForecastTables';
import { useToast } from '@/contexts/ToastContext';
import { freshGoodsApi } from '@/services/freshGoodsApi';
import { NOTE_MAX } from '@/models/kitchen/kitchenConstants';
import { countsToForm, emptyForecastForm, forecastInputKey, validateForecastForm } from '@/utils/kitchen/freshGoodsForm';
import { todayInput } from '@/utils/format';

/**
 * Lập bản dự trù trong modal: chọn kỳ, BE tính lượng thực phẩm (xem trước, chưa lưu), sửa số trẻ dự kiến rồi "Tính lại",
 * cuối cùng lưu. Bảng chỉ lưu được khi khớp kỳ và số trẻ đang nhập. Lưu xong gọi `onSaved(id)` để mở bản vừa lập.
 */
export function FreshForecastCreateModal({ campusId, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState(() => emptyForecastForm({ campusId, today: todayInput() }));
  const [preview, setPreview] = useState(null); // { data, key } của lần tính gần nhất
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState('');

  const data = preview?.data;
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
      const result = await freshGoodsApi.previewForecast(form);
      // Lần đầu BE điền sẵn số trẻ đang theo học; các lần sau BE trả đúng số đã gửi
      const next = { ...form, counts: countsToForm(result.counts) };
      setForm(next);
      setPreview({ data: result, key: forecastInputKey(next) });
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
      onSaved(saved.id);
    } catch (err) {
      fail(err, 'Chưa lưu được bản dự trù');
      setBusy('');
    }
  };

  return (
    <Modal
      open
      size="xl"
      title="Lập bản dự trù hàng tươi"
      onClose={busy ? undefined : onClose}
      footer={
        <>
          <button type="button" className="btn" disabled={!!busy} onClick={onClose}>
            Hủy
          </button>
          <button type="button" className="btn btn--primary" disabled={!data || stale || !!busy} onClick={save}>
            {busy === 'save' ? <Spinner small /> : <Save size={16} />} Lưu bản dự trù
          </button>
        </>
      }
    >
      {errors._form && (
        <div className="alert alert--danger mb-16" role="alert">
          {errors._form}
        </div>
      )}
      <div className="kb-forecast-form">
        <FormField label="Từ ngày" required error={errors.periodFrom}>
          <DateInput value={form.periodFrom} onChange={(v) => setField('periodFrom', v)} />
        </FormField>
        <FormField label="Đến ngày" required error={errors.periodTo}>
          <DateInput value={form.periodTo} onChange={(v) => setField('periodTo', v)} />
        </FormField>
        <FormField label="Ghi chú" error={errors.note}>
          <input
            className="input"
            value={form.note}
            maxLength={NOTE_MAX}
            placeholder={`Tối đa ${NOTE_MAX} ký tự`}
            onChange={(e) => setField('note', e.target.value)}
          />
        </FormField>
        <button type="button" className="btn btn--primary" disabled={!!busy} onClick={calculate}>
          {busy === 'preview' ? <Spinner small /> : <Calculator size={16} />} {data ? 'Tính lại' : 'Tính dự trù'}
        </button>
      </div>

      {stale && (
        <div className="alert alert--warning mt-16" role="status">
          Kỳ hoặc số trẻ dự kiến đã đổi. Bấm &quot;Tính lại&quot; để cập nhật bảng thực phẩm trước khi lưu.
        </div>
      )}

      {data ? (
        <div className="kb-stack mt-16">
          <section className="card">
            <div className="card__header">
              <div className="card__title">Số trẻ dự kiến</div>
            </div>
            <ForecastCountsTable counts={form.counts} editable={!busy} errors={errors} onChange={setCount} />
            <p className="card__body text-sm muted">
              Mặc định bằng số trẻ đang theo học. Sửa số dự kiến rồi bấm &quot;Tính lại&quot; để cập nhật lượng thực phẩm.
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
        </div>
      ) : (
        <p className="muted mt-16">Chọn kỳ rồi bấm &quot;Tính dự trù&quot; để xem trước lượng hàng tươi cần đặt.</p>
      )}
    </Modal>
  );
}
