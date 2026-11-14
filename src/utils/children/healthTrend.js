import { TREND_CONTENT_LIMITS as LIMITS } from '@/models/children/childrenConstants';

/*
 * Nội dung nhận định xu hướng có cấu trúc (HLT-21, BE HealthTrendContentRules): tổng quan, điểm cần chú ý gắn mã cảnh báo,
 * điểm tích cực, gợi ý theo dõi, giới hạn dữ liệu. Kiểm và tên ô lỗi giống BE để lỗi 400 của BE và lỗi kiểm trước hiện cùng chỗ.
 */

const trim = (value) => (value == null || String(value).trim() === '' ? null : String(value).trim());

/** Bỏ khoảng trắng thừa; danh sách thiếu ⇒ rỗng; câu trống ⇒ null (như BE normalize trước khi kiểm). */
export function normalizeTrendContent(content) {
  return {
    overview: trim(content?.overview),
    attentionPoints: (content?.attentionPoints || []).map((a) => ({ warningCode: a.warningCode, text: trim(a.text) })),
    positives: (content?.positives || []).map(trim),
    followUps: (content?.followUps || []).map((f) => ({ type: f.type, text: trim(f.text) })),
    limitations: trim(content?.limitations),
  };
}

const checkItem = (errors, field, text) => {
  if (text == null) errors[field] = 'Không được để trống';
  else if (text.length > LIMITS.item) errors[field] = `Tối đa ${LIMITS.item} ký tự`;
};

/**
 * Kiểm bản nhân sự sửa trước khi duyệt (AI-02, HLT-21); trả map ô ⇒ câu lỗi, rỗng khi hợp lệ. Điểm cần chú ý chỉ gắn mã cảnh báo
 * của lần phân tích (trừ NORMAL), mỗi mã một mục; mỗi loại gợi ý một mục.
 */
export function validateTrendContent(content, warnings = []) {
  const c = normalizeTrendContent(content);
  const errors = {};
  if (c.overview == null) errors['content.overview'] = 'Tổng quan không được để trống';
  else if (c.overview.length > LIMITS.overview) errors['content.overview'] = `Tổng quan tối đa ${LIMITS.overview} ký tự`;
  const warned = new Set(warnings.map((w) => w.code).filter((code) => code && code !== 'NORMAL'));
  const seenCodes = new Set();
  c.attentionPoints.forEach((a, i) => {
    const field = `content.attentionPoints.${i}`;
    if (!a.warningCode || !warned.has(a.warningCode) || seenCodes.has(a.warningCode))
      errors[`${field}.warningCode`] = 'Mã cảnh báo không có trong lần phân tích';
    seenCodes.add(a.warningCode);
    checkItem(errors, `${field}.text`, a.text);
  });
  if (c.positives.length > LIMITS.positives) errors['content.positives'] = `Tối đa ${LIMITS.positives} điểm tích cực`;
  c.positives.forEach((p, i) => checkItem(errors, `content.positives.${i}`, p));
  const seenTypes = new Set();
  c.followUps.forEach((f, i) => {
    const field = `content.followUps.${i}`;
    if (!f.type || seenTypes.has(f.type)) errors[`${field}.type`] = 'Loại gợi ý trống hoặc bị trùng';
    seenTypes.add(f.type);
    checkItem(errors, `${field}.text`, f.text);
  });
  if (c.limitations != null && c.limitations.length > LIMITS.item) errors['content.limitations'] = `Tối đa ${LIMITS.item} ký tự`;
  return errors;
}

const block = (heading, items) => (items.length ? `\n\n${heading}:${items.map((i) => `\n- ${i}`).join('')}` : '');

/** Bản văn ghép từ nội dung (giống BE render) — bản giả lập lưu ở `summary`. */
export function renderTrendSummary(c) {
  return (
    `Tổng quan: ${c.overview}` +
    block(
      'Cần chú ý',
      c.attentionPoints.map((a) => a.text),
    ) +
    block('Điểm tích cực', c.positives) +
    block(
      'Gợi ý theo dõi',
      c.followUps.map((f) => f.text),
    ) +
    (c.limitations ? `\n\nLưu ý về dữ liệu: ${c.limitations}` : '')
  );
}

/** Tập lần đo lúc phân tích khác tập lần đo đã công bố hiện tại ⇒ bản cần phân tích lại (HLT-21). */
export function isTrendStale(analyzedIds = [], currentIds = []) {
  const a = new Set(analyzedIds.map(String));
  const b = new Set(currentIds.map(String));
  return a.size !== b.size || [...a].some((id) => !b.has(id));
}
