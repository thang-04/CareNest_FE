export const HEALTH_SYMPTOMS = { COUGH: 'Ho', RUNNY_NOSE: 'Sổ mũi', TIRED: 'Mệt mỏi', OTHER: 'Khác' };

export const validateDailyHealth = ({
  temperature,
  observation,
  symptoms = [],
  note = '',
  contactOutcome = 'NOT_CONTACTED',
  contactNote = '',
}) => {
  const errors = {};
  const raw = String(temperature ?? '')
    .trim()
    .replace(',', '.');
  if (raw && (!/^\d{2}(\.\d)?$/.test(raw) || !Number.isFinite(Number(raw))))
    errors.temperature = 'Nhập thân nhiệt bằng hai chữ số, tối đa một số thập phân.';
  if (!['NO_CONCERN', 'NOTED'].includes(observation)) errors.observation = 'Chọn kết quả quan sát sau khi kiểm tra trẻ.';
  if (symptoms.some((symptom) => !Object.hasOwn(HEALTH_SYMPTOMS, symptom))) errors.symptoms = 'Chọn biểu hiện trong danh sách.';
  if (observation === 'NOTED' && !symptoms.length && !note.trim()) errors.note = 'Ghi biểu hiện hoặc ghi chú cần lưu ý.';
  if (note.length > 500) errors.note = 'Ghi chú tối đa 500 ký tự.';
  if (observation === 'NOTED' && !['NOT_CONTACTED', 'NO_ANSWER', 'DISCUSSED'].includes(contactOutcome))
    errors.contactOutcome = 'Chọn kết quả liên hệ hợp lệ.';
  if (contactNote.length > 500) errors.contactNote = 'Nội dung trao đổi tối đa 500 ký tự.';
  return errors;
};
