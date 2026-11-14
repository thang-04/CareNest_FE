import { useState } from 'react';
import { Plus, Trash2 } from '@/components/ui/icons';
import { Button, TextAreaField, LABELS } from '@/components';
import { TREND_CONTENT_LIMITS, TREND_FOLLOW_UP_LABELS } from '@/models/children/childrenConstants';
import { newPositive, toEditable, toPayload, validateTrendContent } from '@/utils/children/healthTrend';

/**
 * Sửa từng mục nhận định xu hướng trước khi duyệt (AI-02, HLT-21): mã cảnh báo và loại gợi ý giữ nguyên, chỉ sửa câu chữ, xóa dòng,
 * thêm điểm tích cực (tối đa 3). Kiểm trước giống BE; lỗi 400 BE trả về (`serverErrors`) hiện đúng ô.
 */
export function AiTrendEditor({ data, serverErrors, saving, onCancel, onSubmit }) {
  const [form, setForm] = useState(() => toEditable(data.content));
  const [errors, setErrors] = useState({});
  const shown = { ...serverErrors, ...errors };
  const warningText = (code) => data.warnings.find((w) => w.code === code)?.text;

  const setList = (name, key, patch) =>
    setForm((f) => ({ ...f, [name]: f[name].map((row) => (row.key === key ? { ...row, ...patch } : row)) }));
  const removeRow = (name, key) => {
    setForm((f) => ({ ...f, [name]: f[name].filter((row) => row.key !== key) }));
    // Xóa dòng làm lệch chỉ số ô lỗi ⇒ bỏ lỗi cũ, kiểm lại khi gửi
    setErrors({});
  };

  const submit = () => {
    const payload = toPayload(form);
    const found = validateTrendContent(payload, data.warnings);
    setErrors(found);
    if (!Object.keys(found).length) onSubmit(payload);
  };

  return (
    <div className="tr-ai__editor">
      <TextAreaField
        label="Tổng quan"
        required
        rows={3}
        maxLength={TREND_CONTENT_LIMITS.overview}
        value={form.overview}
        onChange={(e) => setForm((f) => ({ ...f, overview: e.target.value }))}
        error={shown['content.overview']}
      />

      {form.attentionPoints.length > 0 && <h3 className="tr-ai__block-title">Cần chú ý</h3>}
      {form.attentionPoints.map((a, i) => (
        <div key={a.key} className="tr-ai__edit-row">
          <TextAreaField
            label={`Điểm cần chú ý ${i + 1}`}
            hint={warningText(a.warningCode)}
            rows={2}
            maxLength={TREND_CONTENT_LIMITS.item}
            value={a.text}
            onChange={(e) => setList('attentionPoints', a.key, { text: e.target.value })}
            error={shown[`content.attentionPoints.${i}.text`] || shown[`content.attentionPoints.${i}.warningCode`]}
            fieldClassName="tr-ai__edit-field"
          />
          <Button
            variant="icon"
            icon={Trash2}
            aria-label={`Xóa điểm cần chú ý ${i + 1}`}
            onClick={() => removeRow('attentionPoints', a.key)}
          />
        </div>
      ))}

      <h3 className="tr-ai__block-title">Điểm tích cực</h3>
      {form.positives.map((p, i) => (
        <div key={p.key} className="tr-ai__edit-row">
          <TextAreaField
            label={`Điểm tích cực ${i + 1}`}
            rows={2}
            maxLength={TREND_CONTENT_LIMITS.item}
            value={p.text}
            onChange={(e) => setList('positives', p.key, { text: e.target.value })}
            error={shown[`content.positives.${i}`]}
            fieldClassName="tr-ai__edit-field"
          />
          <Button variant="icon" icon={Trash2} aria-label={`Xóa điểm tích cực ${i + 1}`} onClick={() => removeRow('positives', p.key)} />
        </div>
      ))}
      {shown['content.positives'] && <p className="field__error">{shown['content.positives']}</p>}
      {form.positives.length < TREND_CONTENT_LIMITS.positives && (
        <Button size="sm" icon={Plus} onClick={() => setForm((f) => ({ ...f, positives: [...f.positives, newPositive()] }))}>
          Thêm điểm tích cực
        </Button>
      )}

      {form.followUps.length > 0 && <h3 className="tr-ai__block-title">Gợi ý theo dõi (phụ huynh không thấy)</h3>}
      {form.followUps.map((f, i) => (
        <div key={f.key} className="tr-ai__edit-row">
          <TextAreaField
            label={TREND_FOLLOW_UP_LABELS[f.type] || f.type}
            rows={2}
            maxLength={TREND_CONTENT_LIMITS.item}
            value={f.text}
            onChange={(e) => setList('followUps', f.key, { text: e.target.value })}
            error={shown[`content.followUps.${i}.text`] || shown[`content.followUps.${i}.type`]}
            fieldClassName="tr-ai__edit-field"
          />
          <Button variant="icon" icon={Trash2} aria-label={`Xóa gợi ý ${i + 1}`} onClick={() => removeRow('followUps', f.key)} />
        </div>
      ))}

      <TextAreaField
        label="Lưu ý về dữ liệu"
        rows={2}
        maxLength={TREND_CONTENT_LIMITS.item}
        value={form.limitations}
        onChange={(e) => setForm((f) => ({ ...f, limitations: e.target.value }))}
        error={shown['content.limitations']}
      />

      <div className="page-actions">
        <Button onClick={onCancel} disabled={saving}>
          {LABELS.cancel}
        </Button>
        <Button variant="primary" loading={saving} onClick={submit}>
          Lưu và duyệt
        </Button>
      </div>
    </div>
  );
}
