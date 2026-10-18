// Biểu hiện giáo viên tự chọn (không suy ra từ nhiệt độ); thứ tự hiển thị trên form
export const HEALTH_SYMPTOMS = { FEVER: 'Sốt', COUGH: 'Ho', RUNNY_NOSE: 'Sổ mũi', FLU: 'Cảm cúm', TIRED: 'Mệt mỏi', OTHER: 'Khác' };

/*
 * Xử trí khi trẻ có dấu hiệu cần lưu ý (TTLT 13/2016/TTLT-BYT-BGDĐT Điều 9: theo dõi, sơ cứu, thông báo gia đình,
 * chuyển cơ sở khám chữa bệnh). Giáo viên ghi việc đã làm, không chẩn đoán; chẩn đoán do nhân viên y tế ghi sổ khám bệnh.
 * Mỗi lần xử trí là một lần ghi nhận mới có giờ và người ghi (vết lưu trong ngày). Cần chốt 15/10/2026.
 */
export const HEALTH_ACTIONS = {
  MONITOR: 'Theo dõi tại lớp',
  MEDICAL_ROOM: 'Đưa phòng y tế',
  PARENT_INFORMED: 'Đã gọi điện cho phụ huynh',
  EARLY_PICKUP: 'Báo phụ huynh đón về sớm',
  REFERRAL: 'Chuyển cơ sở y tế / cấp cứu',
};
/** Nhãn ngắn cho bảng và chip. */
export const HEALTH_ACTION_SHORT = {
  MONITOR: 'Theo dõi',
  MEDICAL_ROOM: 'Phòng y tế',
  PARENT_INFORMED: 'Gọi PH',
  EARLY_PICKUP: 'Về sớm',
  REFERRAL: 'Chuyển viện',
};

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** "Phòng y tế · Về sớm 10:15" từ các lần ghi nhận (hoặc một lần). */
export const actionSummary = (entries = []) => {
  const parts = [];
  entries.forEach((e) =>
    (e.actions || []).forEach((a) => {
      // Về sớm: giờ lấy từ lúc cô trả trẻ ở màn Đón trẻ (earlyPickup gắn khi đọc); chưa trả thì "Chờ đón sớm"
      if (a === 'EARLY_PICKUP') {
        const text = e.earlyPickup ? `Về sớm ${e.earlyPickup.time}` : 'Chờ đón sớm';
        if (!parts.includes(text) && !(text === 'Chờ đón sớm' && parts.some((x) => x.startsWith('Về sớm')))) parts.push(text);
        return;
      }
      const time = a === 'REFERRAL' ? e.referral?.time : '';
      const text = `${HEALTH_ACTION_SHORT[a] || a}${time ? ` ${time}` : ''}`;
      if (!parts.includes(text)) parts.push(text);
    }),
  );
  return parts.join(' · ');
};

export const validateDailyHealth = ({ temperature, observation, symptoms = [], note = '', actions = [], referral = null }) => {
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
  if (actions.length && observation !== 'NOTED') errors.actions = 'Chỉ ghi xử trí khi có dấu hiệu cần lưu ý.';
  if (actions.some((a) => !Object.hasOwn(HEALTH_ACTIONS, a))) errors.actions = 'Chọn xử trí trong danh sách.';
  if (actions.includes('REFERRAL')) {
    if (!(referral?.place || '').trim()) errors.referral = 'Nhập nơi chuyển trẻ đến.';
    else if (!TIME_RE.test(referral?.time || '')) errors.referral = 'Nhập giờ chuyển theo hh:mm.';
    else if ((referral.place || '').length > 150 || (referral.escort || '').length > 100) errors.referral = 'Nội dung quá dài.';
  }
  return errors;
};

/** Thân nhiệt hiển thị đúng giá trị giáo viên nhập ("38,2 °C"); không tự đánh giá theo ngưỡng. */
export const formatTemperature = (value) => (Number.isFinite(value) ? `${value.toLocaleString('vi-VN')} °C` : '—');

export const symptomLabels = (symptoms = []) => symptoms.map((item) => HEALTH_SYMPTOMS[item] || item).join(', ');
