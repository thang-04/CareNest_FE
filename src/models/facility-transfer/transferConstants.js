export const TRANSFER_STATUS = {
  DRAFT: 'DRAFT',
  PENDING_HANDOVER: 'PENDING_HANDOVER',
  REVISION_REQUESTED: 'REVISION_REQUESTED',
  PENDING_RECEIPT: 'PENDING_RECEIPT',
  PENDING_RESOLUTION: 'PENDING_RESOLUTION',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
};

export const TRANSFER_STATUS_LABELS = {
  DRAFT: 'Bản nháp',
  PENDING_HANDOVER: 'Chờ bàn giao',
  REVISION_REQUESTED: 'Cần điều chỉnh',
  PENDING_RECEIPT: 'Chờ xác nhận nhận',
  PENDING_RESOLUTION: 'Chờ xử lý chênh lệch',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
};

/** Statuses in which the transfer is still being processed (assets reserved). */
export const ACTIVE_STATUSES = [
  TRANSFER_STATUS.PENDING_HANDOVER,
  TRANSFER_STATUS.REVISION_REQUESTED,
  TRANSFER_STATUS.PENDING_RECEIPT,
  TRANSFER_STATUS.PENDING_RESOLUTION,
];

export const TRANSFER_TYPES = {
  INTRA_CAMPUS_ROOM: 'INTRA_CAMPUS_ROOM',
  INTRA_CAMPUS_DEPARTMENT: 'INTRA_CAMPUS_DEPARTMENT',
  INTER_CAMPUS: 'INTER_CAMPUS',
};

export const TRANSFER_TYPE_LABELS = {
  INTRA_CAMPUS_ROOM: 'Giữa các lớp/phòng (cùng campus)',
  INTRA_CAMPUS_DEPARTMENT: 'Giữa các phòng ban (cùng campus)',
  INTER_CAMPUS: 'Giữa các campus',
};

/**
 * Location types allowed for each transfer type.
 * Storerooms (STORAGE) are excluded: issuing from / returning to the storeroom is the allocation flow (BF-08).
 */
export const TRANSFER_TYPE_LOCATION_TYPES = {
  INTRA_CAMPUS_ROOM: ['CLASS', 'FUNCTION_ROOM', 'KITCHEN'],
  INTRA_CAMPUS_DEPARTMENT: ['DEPARTMENT', 'KITCHEN'],
  INTER_CAMPUS: ['CLASS', 'FUNCTION_ROOM', 'KITCHEN', 'DEPARTMENT'],
};

export const TRANSFER_TYPE_SHORT_LABELS = {
  INTRA_CAMPUS_ROOM: 'Lớp/phòng',
  INTRA_CAMPUS_DEPARTMENT: 'Phòng ban',
  INTER_CAMPUS: 'Liên campus',
};

export const SIGNATURE_TYPES = {
  CREATOR: 'CREATOR',
  HANDOVER: 'HANDOVER',
  RECEIVER: 'RECEIVER',
};

export const SIGNATURE_TYPE_LABELS = {
  CREATOR: 'Người tạo phiếu',
  HANDOVER: 'Người bàn giao',
  RECEIVER: 'Người nhận',
};

export const MY_TRANSFER_ROLES = {
  HANDOVER: 'HANDOVER',
  RECEIVER: 'RECEIVER',
};

export const MY_TRANSFER_ROLE_LABELS = {
  HANDOVER: 'Người bàn giao',
  RECEIVER: 'Người nhận',
};

/**
 * Discrepancy handling (agreed with the team, 08/10/2026):
 * each problem part of a line has two choices for the VP – fix it physically, or accept the received quantity.
 */
export const DISCREPANCY_PARTS = ['shortage', 'surplus', 'damaged'];

export const DISCREPANCY_PART_LABELS = {
  shortage: 'Thiếu',
  surplus: 'Thừa',
  damaged: 'Hỏng',
};

export const RESOLUTION_CHOICES = {
  SUPPLEMENT: 'SUPPLEMENT',
  RETURN: 'RETURN',
  REPLACE: 'REPLACE',
  ACCEPT: 'ACCEPT',
};

export const RESOLUTION_CHOICE_LABELS = {
  SUPPLEMENT: 'Yêu cầu giao thêm',
  RETURN: 'Báo giao thừa – trả lại',
  REPLACE: 'Yêu cầu đổi cái tốt',
  ACCEPT: 'Chấp nhận',
};

/** Choices offered for each part; the first one is the default. */
export const PART_CHOICES = {
  shortage: [RESOLUTION_CHOICES.SUPPLEMENT, RESOLUTION_CHOICES.ACCEPT],
  surplus: [RESOLUTION_CHOICES.RETURN, RESOLUTION_CHOICES.ACCEPT],
  damaged: [RESOLUTION_CHOICES.REPLACE, RESOLUTION_CHOICES.ACCEPT],
};

export const PART_CHOICE_HINTS = {
  shortage: {
    SUPPLEMENT: 'Người bàn giao mang thêm phần còn thiếu, người nhận xác nhận lại.',
    ACCEPT: 'Lấy đúng số thực nhận; phần thiếu ghi vào sổ là thiếu hụt.',
  },
  surplus: {
    RETURN: 'Người bàn giao được báo giao thừa và mang phần thừa về; phiếu chỉ chuyển đúng số trên phiếu.',
    ACCEPT: 'Nơi nhận giữ luôn phần thừa; sổ ghi theo số thực nhận.',
  },
  damaged: {
    REPLACE: 'Người bàn giao mang cái tốt sang đổi và lấy cái hỏng về.',
    ACCEPT: 'Không nhận phần hỏng; phần hỏng ở lại nơi đi (báo hỏng riêng).',
  },
};

export const HISTORY_ACTIONS = {
  CREATED: 'Tạo phiếu nháp',
  UPDATED: 'Cập nhật phiếu nháp',
  SUBMITTED: 'Gửi phiếu luân chuyển',
  REVISION_REQUESTED: 'Yêu cầu điều chỉnh',
  RESUBMITTED: 'Gửi lại phiếu đã điều chỉnh',
  HANDOVER_CONFIRMED: 'Xác nhận bàn giao',
  DISCREPANCY_REPORTED: 'Báo chênh lệch',
  DISCREPANCY_RESOLVED: 'Xử lý chênh lệch',
  SIGNATURE_INVALIDATED: 'Vô hiệu chữ ký',
  RECEIPT_CONFIRMED: 'Xác nhận nhận',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Hủy phiếu',
  SUPPLEMENT_DELIVERED: 'Giao thêm / lấy lại theo xử lý chênh lệch',
};
