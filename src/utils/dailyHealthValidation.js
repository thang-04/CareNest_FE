// Biểu hiện giáo viên tự chọn (không suy ra từ nhiệt độ); thứ tự hiển thị trên form
export const HEALTH_SYMPTOMS = { FEVER: 'Sốt', COUGH: 'Ho', RUNNY_NOSE: 'Sổ mũi', FLU: 'Cảm cúm', TIRED: 'Mệt mỏi', OTHER: 'Khác' };

export const validateDailyHealth = ({ temperature, observation, symptoms = [], note = '' }) => {
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
  return errors;
};

/** Thân nhiệt hiển thị đúng giá trị giáo viên nhập ("38,2 °C"); không tự đánh giá theo ngưỡng. */
export const formatTemperature = (value) => (Number.isFinite(value) ? `${value.toLocaleString('vi-VN')} °C` : '—');

export const symptomLabels = (symptoms = []) => symptoms.map((item) => HEALTH_SYMPTOMS[item] || item).join(', ');
