export const childHistoryLabel = (status) => ({ TRANSFERRED: 'Đã chuyển lớp', LEFT_SCHOOL: 'Đã nghỉ học' })[status] || '';
export const childNameWithHistory = (name, status) => {
  const label = childHistoryLabel(status);
  return label ? `${name} (${label})` : name;
};
