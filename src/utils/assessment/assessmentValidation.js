import { DIAGNOSTIC_TERMS, EMOTION, HEALTH_STATUS } from '@/models/assessment/assessmentConstants';

/* Each validator returns { field: message }; empty object = valid. Used by forms and by the mock repository (422). */

const REQUIRED = 'Trường này là bắt buộc.';

/** GBR-OBS-05: returns the diagnostic terms found in a text. */
export const findDiagnosticTerms = (text) => {
  const lower = String(text || '').toLowerCase();
  return DIAGNOSTIC_TERMS.filter((t) => lower.includes(t));
};

const diagnosticError = (text) => {
  const found = findDiagnosticTerms(text);
  return found.length ? `Không dùng thuật ngữ chẩn đoán (“${found.join('”, “')}”). Hãy mô tả hành vi quan sát được.` : null;
};

/** One child row of the daily assessment sheet. */
export const validateDailyEntry = (entry, { locked = false } = {}) => {
  const errors = {};
  if (!Object.values(HEALTH_STATUS).includes(entry.healthStatus)) errors.healthStatus = 'Chọn tình trạng sức khỏe.';
  if (!Object.values(EMOTION).includes(entry.emotion)) errors.emotion = 'Chọn cảm xúc của trẻ.';
  if ((entry.comment || '').length > 500) errors.comment = 'Nhận xét tối đa 500 ký tự.';
  const diag = diagnosticError(entry.comment);
  if (diag) errors.comment = diag;
  if (locked && !(entry.correctionReason || '').trim()) errors.correctionReason = 'Đánh giá đã khóa: nhập lý do điều chỉnh.';
  return errors;
};

export const validateEvaluationContent = (content) => {
  const errors = {};
  const text = String(content || '').trim();
  if (!text) errors.content = 'Nhập nội dung đánh giá.';
  else if (text.length < 30) errors.content = 'Nội dung đánh giá cần ít nhất 30 ký tự.';
  else if (text.length > 3000) errors.content = 'Nội dung đánh giá tối đa 3000 ký tự.';
  const diag = diagnosticError(text);
  if (diag) errors.content = diag;
  return errors;
};

export const validateRewardProposal = (p) => {
  const errors = {};
  if (!p.classId) errors.classId = REQUIRED;
  if (!p.childId) errors.childId = 'Chọn trẻ được đề xuất.';
  if (!(p.rewardTitle || '').trim()) errors.rewardTitle = 'Chọn danh hiệu khen thưởng.';
  const reason = String(p.reason || '').trim();
  if (!reason) errors.reason = 'Nhập lý do đề xuất.';
  else if (reason.length < 20) errors.reason = 'Lý do cần ít nhất 20 ký tự, nêu rõ căn cứ từ đánh giá.';
  else if (reason.length > 1000) errors.reason = 'Lý do tối đa 1000 ký tự.';
  const diag = diagnosticError(reason);
  if (diag) errors.reason = diag;
  return errors;
};

/** Return / reject always need a reason (DESIGN §12.2, UC 4.2–4.3). */
export const validateDecision = ({ negative, comment }) => {
  const errors = {};
  if (negative && !(comment || '').trim()) errors.comment = 'Nhập lý do.';
  if ((comment || '').length > 500) errors.comment = 'Tối đa 500 ký tự.';
  return errors;
};

export const hasErrors = (errors) => Object.keys(errors || {}).length > 0;
