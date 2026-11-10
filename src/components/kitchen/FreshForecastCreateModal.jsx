import { useCallback, useEffect, useRef, useState } from 'react';
import { Calculator, Save } from '@/components/ui/icons';
import { DateInput, FormField, Modal, Spinner } from '@/components';
import { WeekPicker } from '@/components/form/WeekPicker';
import { Tabs } from '@/components/ui/Tabs';
import { ForecastCountsTable, ForecastLinesTable } from '@/components/kitchen/FreshForecastTables';
import { useToast } from '@/contexts/ToastContext';
import { freshGoodsApi } from '@/services/freshGoodsApi';
import { NOTE_MAX } from '@/models/kitchen/kitchenConstants';
import { countsToForm, emptyForecastForm, forecastInputKey, validateForecastForm } from '@/utils/kitchen/freshGoodsForm';
import { isIsoDate, todayInput } from '@/utils/format';
import { addDays, schoolWeekStart, weekShortLabel } from '@/utils/week';

// Mã BE của kỳ dự trù sai; thứ tự ngày đã kiểm ở ô nhập nên còn lại là kỳ quá dài, câu của BE dài và gộp hai lỗi
const PERIOD_INVALID = 6041;
const weekPeriod = (weekStart) => ({ periodFrom: weekStart, periodTo: addDays(weekStart, 4) });

/**
 * Lập bản dự trù trong modal: chọn kỳ theo tuần (hoặc tùy chọn ngày), BE tính lượng thực phẩm ngay (xem trước, chưa lưu),
 * sửa số trẻ dự kiến rồi "Tính lại", cuối cùng lưu. Bảng chỉ lưu được khi khớp kỳ và số trẻ đang nhập.
 * Lưu xong gọi `onSaved(id)` để mở bản vừa lập.
 */
export function FreshForecastCreateModal({ campusId, onClose, onSaved }) {
  const toast = useToast();
  const thisWeek = schoolWeekStart(todayInput());
  const [form, setForm] = useState(() => ({ ...emptyForecastForm({ campusId, today: thisWeek }), ...weekPeriod(thisWeek) }));
  const [mode, setMode] = useState('this');
  const [week, setWeek] = useState(thisWeek);
  const [preview, setPreview] = useState(null); // { data, key } của lần tính gần nhất
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState('');
  const lastRun = useRef(0);

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
  const pickWeek = (next) => {
    setWeek(next);
    setForm((f) => ({ ...f, ...weekPeriod(next) }));
  };
  const pickMode = (next) => {
    setMode(next);
    if (next === 'this') pickWeek(thisWeek);
    if (next === 'next') pickWeek(addDays(thisWeek, 7));
  };

  const inlineErrors = (err) => {
    if (err.errorCode === PERIOD_INVALID) return { periodTo: 'Kỳ dự trù tối đa 31 ngày' };
    return err.details && typeof err.details === 'object' ? err.details : { _form: err.message };
  };

  const calculate = useCallback(async (input) => {
    const found = validateForecastForm(input);
    setErrors(found);
    if (Object.keys(found).length) return;
    const run = ++lastRun.current;
    setBusy('preview');
    try {
      const result = await freshGoodsApi.previewForecast(input);
      if (run !== lastRun.current) return;
      // Lần đầu BE điền sẵn số trẻ đang theo học; các lần sau BE trả đúng số đã gửi
      const counts = countsToForm(result.counts);
      setForm((f) => ({ ...f, counts }));
      setPreview({ data: result, key: forecastInputKey({ ...input, counts }) });
    } catch (err) {
      // Lỗi hiện ngay tại ô trong hộp, không lặp thêm toast
      if (run === lastRun.current) setErrors(inlineErrors(err));
    } finally {
      if (run === lastRun.current) setBusy('');
    }
  }, []);

  // Đổi kỳ là tính lại ngay; sửa số trẻ thì chờ bấm "Tính lại". formRef giữ số trẻ mới nhất mà không chạy lại theo từng phím
  const formRef = useRef(form);
  formRef.current = form;
  useEffect(() => {
    if (isIsoDate(form.periodFrom) && isIsoDate(form.periodTo)) calculate(formRef.current);
  }, [form.periodFrom, form.periodTo, calculate]);

  const save = async () => {
    setBusy('save');
    try {
      const saved = await freshGoodsApi.saveForecast(form);
      toast.success('Đã lưu bản dự trù.');
      onSaved(saved.id);
    } catch (err) {
      setErrors(inlineErrors(err));
      toast.error(err, 'Chưa lưu được bản dự trù');
      setBusy('');
    }
  };

  const nextWeek = addDays(thisWeek, 7);
  const modes = [
    { key: 'this', label: `Tuần này (${weekShortLabel(thisWeek)})` },
    { key: 'next', label: `Tuần sau (${weekShortLabel(nextWeek)})` },
    { key: 'week', label: 'Chọn tuần' },
    { key: 'custom', label: 'Tùy chọn ngày' },
  ];

  return (
    <Modal
      open
      size="xl"
      title="Lập bản dự trù"
      onClose={busy === 'save' ? undefined : onClose}
      footer={
        <>
          <button type="button" className="btn" disabled={busy === 'save'} onClick={onClose}>
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
        <div className="field">
          <span className="field__label">
            Kỳ dự trù<span className="req">*</span>
          </span>
          <Tabs items={modes} value={mode} onChange={pickMode} ariaLabel="Chọn kỳ dự trù" variant="pill" />
        </div>
        {mode === 'week' && <WeekPicker value={week} thisWeek={thisWeek} onChange={pickWeek} />}
        {mode === 'custom' && (
          <div className="kb-forecast-form__range">
            <FormField label="Từ ngày" required error={errors.periodFrom}>
              <DateInput value={form.periodFrom} onChange={(v) => setField('periodFrom', v)} />
            </FormField>
            <FormField label="Đến ngày" required error={errors.periodTo}>
              <DateInput value={form.periodTo} onChange={(v) => setField('periodTo', v)} />
            </FormField>
          </div>
        )}
        <FormField label="Ghi chú" error={errors.note}>
          <input
            className="input"
            value={form.note}
            maxLength={NOTE_MAX}
            placeholder={`Tối đa ${NOTE_MAX} ký tự`}
            onChange={(e) => setField('note', e.target.value)}
          />
        </FormField>
      </div>

      {stale && busy !== 'preview' && !errors.periodFrom && !errors.periodTo && (
        <div className="alert alert--warning kb-forecast-stale mt-16" role="status">
          <span>Số trẻ dự kiến đã đổi, bảng thực phẩm chưa cập nhật.</span>
          <button type="button" className="btn btn--sm" onClick={() => calculate(form)}>
            <Calculator size={16} /> Tính lại
          </button>
        </div>
      )}

      {data ? (
        <div className="kb-stack mt-16">
          <section className="card">
            <div className="card__header">
              <div className="card__title">Số trẻ dự kiến</div>
            </div>
            <ForecastCountsTable counts={form.counts} editable={busy !== 'save'} errors={errors} onChange={setCount} />
            <p className="card__body text-sm muted">Mặc định bằng số trẻ đang theo học.</p>
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
        busy === 'preview' && (
          <p className="muted mt-16">
            <Spinner small /> Đang tính lượng hàng tươi…
          </p>
        )
      )}
    </Modal>
  );
}
