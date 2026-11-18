import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Calculator, CheckCircle2, Save } from '@/components/ui/icons';
import { Button, DateInput, FormField, Modal, Spinner, StatCard, TextField } from '@/components';
import { WeekPicker } from '@/components/form/WeekPicker';
import { Tabs } from '@/components/ui/Tabs';
import { ForecastCountsTable, ForecastDryCard, ForecastLinesTable } from '@/components/kitchen/FreshForecastTables';
import { useToast } from '@/contexts/ToastContext';
import { freshGoodsApi } from '@/services/freshGoodsApi';
import { NOTE_MAX } from '@/models/kitchen/kitchenConstants';
import { countsToForm, emptyForecastForm, forecastInputKey, validateForecastForm } from '@/utils/kitchen/freshGoodsForm';
import { formatWeekdayDate, isIsoDate, todayInput } from '@/utils/format';
import { addDays, schoolWeekStart, weekShortLabel } from '@/utils/week';

// Mã BE của kỳ dự trù sai; thứ tự ngày đã kiểm ở ô nhập nên còn lại là kỳ quá dài, câu của BE dài và gộp hai lỗi
const PERIOD_INVALID = 6041;
const weekPeriod = (weekStart) => ({ periodFrom: weekStart, periodTo: addDays(weekStart, 4) });

/**
 * Lập bản dự trù trong modal: chọn kỳ theo tuần (hoặc tùy chọn ngày), BE tính lượng thực phẩm ngay (xem trước, chưa lưu),
 * sửa số trẻ dự kiến rồi "Tính lại", cuối cùng lưu. Bảng chỉ lưu được khi khớp kỳ và số trẻ đang nhập.
 * Cột trái là đầu vào (kỳ, số trẻ, ghi chú), cột phải là kết quả BE tính.
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
  const [view, setView] = useState('fresh');
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
  const modeLabel = (title, weekStart) => (
    <span className="kb-fcm__mode">
      {title}
      {weekStart && <span className="kb-fcm__mode-sub">{weekShortLabel(weekStart)}</span>}
    </span>
  );
  const modes = [
    { key: 'this', label: modeLabel('Tuần này', thisWeek) },
    { key: 'next', label: modeLabel('Tuần sau', nextWeek) },
    { key: 'week', label: modeLabel('Chọn tuần') },
    { key: 'custom', label: modeLabel('Tùy chọn ngày') },
  ];
  const periodError = errors.periodFrom || errors.periodTo;
  const schoolDays = data ? data.days.filter((d) => !d.off).length : 0;
  const dryCount = data?.dryLines?.length ?? 0;
  const views = data
    ? [
        { key: 'fresh', label: 'Hàng tươi cần đặt', count: data.lines.length },
        { key: 'dry', label: 'Hàng khô cần nhập thêm', count: dryCount },
      ]
    : [];

  // Dòng trạng thái ở chân hộp: nói rõ vì sao nút Lưu đang khóa
  let status = null;
  if (busy === 'preview') {
    status = (
      <span className="kb-fcm__status" role="status">
        <Spinner small /> Đang tính lượng thực phẩm…
      </span>
    );
  } else if (stale) {
    status = (
      <span className="kb-fcm__status kb-fcm__status--warn" role="status">
        <AlertTriangle size={16} /> Số trẻ đã đổi, bấm Tính lại trước khi lưu
      </span>
    );
  } else if (data) {
    status = (
      <span className="kb-fcm__status kb-fcm__status--ok" role="status">
        <CheckCircle2 size={16} /> Bảng khớp kỳ và số trẻ đang nhập
      </span>
    );
  }

  return (
    <Modal
      open
      size="full"
      title="Lập bản dự trù"
      onClose={busy === 'save' ? undefined : onClose}
      closeOnBackdrop={false}
      footer={
        <>
          {status}
          <Button disabled={busy === 'save'} onClick={onClose}>
            Hủy
          </Button>
          <Button variant="primary" icon={Save} loading={busy === 'save'} disabled={!data || stale || busy === 'preview'} onClick={save}>
            Lưu bản dự trù
          </Button>
        </>
      }
    >
      {errors._form && (
        <div className="alert alert--danger mb-16" role="alert">
          {errors._form}
        </div>
      )}
      <div className="kb-fcm">
        <aside className="kb-fcm__side" aria-label="Thông tin lập bản dự trù">
          <section className="kb-fcm__step">
            <h3 className="kb-fcm__step-title">
              <span className="kb-fcm__step-no">1</span> Kỳ dự trù<span className="req">*</span>
            </h3>
            <Tabs items={modes} value={mode} onChange={pickMode} ariaLabel="Chọn kỳ dự trù" variant="pill" className="kb-fcm__modes" />
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
            {!periodError && isIsoDate(form.periodFrom) && isIsoDate(form.periodTo) && (
              <p className="kb-fcm__period">
                {formatWeekdayDate(form.periodFrom)} – {formatWeekdayDate(form.periodTo)}
              </p>
            )}
          </section>

          <section className="kb-fcm__step">
            <h3 className="kb-fcm__step-title">
              <span className="kb-fcm__step-no">2</span> Số trẻ dự kiến
            </h3>
            {data ? (
              <>
                <ForecastCountsTable counts={form.counts} editable={busy !== 'save'} errors={errors} onChange={setCount} />
                <p className="text-xs muted">Mặc định bằng số trẻ đang theo học. Sửa số rồi bấm Tính lại.</p>
              </>
            ) : (
              <p className="text-sm muted">Chọn kỳ để hiện số trẻ theo nhóm tuổi.</p>
            )}
            {stale && busy !== 'preview' && !periodError && (
              <div className="alert alert--warning kb-forecast-stale" role="status">
                <span>Bảng thực phẩm chưa cập nhật theo số trẻ mới.</span>
                <Button size="sm" icon={Calculator} onClick={() => calculate(form)}>
                  Tính lại
                </Button>
              </div>
            )}
          </section>

          <section className="kb-fcm__step">
            <h3 className="kb-fcm__step-title">
              <span className="kb-fcm__step-no">3</span> Ghi chú
            </h3>
            <TextField
              value={form.note}
              maxLength={NOTE_MAX}
              error={errors.note}
              aria-label="Ghi chú bản dự trù"
              placeholder={`Không bắt buộc, tối đa ${NOTE_MAX} ký tự`}
              onChange={(e) => setField('note', e.target.value)}
            />
          </section>
        </aside>

        <div className={`kb-fcm__main ${stale ? 'kb-stale' : ''}`.trim()}>
          {data ? (
            <>
              <div className="kb-fcm__kpis">
                <StatCard tone="blue" icon={false} label="Ngày có bữa trong kỳ" value={schoolDays} />
                <StatCard tone="green" icon={false} label="Hàng tươi cần đặt" value={data.lines.length} />
                <StatCard tone="orange" icon={false} label="Hàng khô cần nhập thêm" value={dryCount} />
              </div>
              <Tabs items={views} value={view} onChange={setView} ariaLabel="Kết quả dự trù" />
              {view === 'fresh' &&
                (data.lines.length ? (
                  <ForecastLinesTable forecast={data} />
                ) : (
                  <p className="muted">Kỳ này chưa có thực phẩm tươi cần đặt. Kiểm tra thực đơn của các ngày trong kỳ.</p>
                ))}
              {view === 'dry' && <ForecastDryCard forecast={data} className="kb-fcm__dry" />}
            </>
          ) : (
            <div className="kb-fcm__placeholder">
              {busy === 'preview' ? (
                <>
                  <Spinner small /> Đang tính lượng hàng tươi…
                </>
              ) : (
                'Chọn kỳ dự trù để xem lượng thực phẩm cần đặt.'
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
