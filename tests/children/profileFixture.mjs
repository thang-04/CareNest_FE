/*
 * Hành chính và tiền sử giả đủ ô bắt buộc khi tiếp nhận (user chốt 2026-10-22). Dữ liệu giả: CCCD bắt đầu 999.
 */
export const filledProfile = (patch = {}) => ({
  idNumber: '',
  premature: 'NO',
  gestationWeeks: '',
  ethnicity: 'Kinh',
  beneficiary: 'Trẻ em dưới 6 tuổi',
  bloodType: '',
  address: { province: 'Hải Phòng', ward: 'Phường Thử', street: 'Số 1 ngõ Thử' },
  ...patch,
});

export const filledMedicalHistory = (patch = {}) => ({
  self: { state: 'NONE_REPORTED', text: '' },
  family: { state: 'NONE_REPORTED', text: '' },
  tbContact: { state: 'NONE_REPORTED', contactDate: '' },
  ...patch,
});

/** Các cột hành chính, tiền sử bắt buộc của file nhập Excel. */
export const filledImportColumns = (patch = {}) => ({
  premature: 'Không',
  ethnicity: 'Kinh',
  beneficiary: 'Trẻ em dưới 6 tuổi',
  province: 'Hải Phòng',
  ward: 'Phường Thử',
  street: 'Số 1 ngõ Thử',
  selfHistory: 'Không',
  familyHistory: 'Không',
  tbContact: 'Không',
  ...patch,
});
