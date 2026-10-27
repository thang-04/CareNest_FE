import { ApiError } from '@/mocks/mockDatabase';
import { EDU_ERROR_CODE } from '@/models/education-plan/educationPlanConstants';

/*
 * BE giả: lỗi theo mã tập trung của BE (BE:src/main/java/com/carenest/utils/ApiCode.java, docs/contracts/ERROR_CONTRACT.md).
 * Mỗi lỗi giữ đúng HTTP status, errorCode và câu tiếng Việt như BE; {0}, {1} thay bằng tham số.
 */
const SPECS = {
  REQUIRED_FIELD_MISSING: [400, 'Thiếu thông tin bắt buộc: {0}'],
  YEAR_PLAN_NOT_FOUND: [404, 'Không tìm thấy kế hoạch năm học'],
  YEAR_PLAN_EDIT_FORBIDDEN: [403, 'Bạn không sửa được kế hoạch này'],
  YEAR_PLAN_LOCKED_BY_OTHER: [409, 'Đang được {0} sửa'],
  YEAR_PLAN_INVALID_STATUS: [409, 'Không thể {0} kế hoạch ở trạng thái hiện tại'],
  YEAR_PLAN_DELETE_DRAFT_ONLY: [409, 'Chỉ xóa được kế hoạch đang nháp'],
  EDIT_SESSION_LOST: [409, 'Đã mất quyền sửa: phiên đã hết hạn hoặc kế hoạch đang mở ở tab khác'],
  YEAR_PLAN_REVISION_STALE: [409, 'Kế hoạch đã được thay đổi ở nơi khác. Tải lại để đối chiếu'],
  RETURN_REASON_REQUIRED: [400, 'Cần ghi lý do trả lại'],
  CLASS_DOC_NOT_FOUND: [404, 'Không tìm thấy tài liệu. Lưu bản nháp trước khi gửi'],
  CLASS_DOC_TEACHER_ONLY: [403, 'Chỉ giáo viên được phân công vào lớp mới sửa hoặc gửi được tài liệu'],
  CLASS_DOC_SUBMITTED: [409, 'Tài liệu đã gửi duyệt, không sửa được'],
  WEEKLY_LESSON_VIA_THEME: [400, 'Giáo án tuần được gửi và duyệt cùng kế hoạch chủ đề'],
  CLASS_DOC_NOT_READY: [409, '{0}'],
  BRANCH_WEEKS_UNNAMED: [409, 'Còn {0} tuần chưa đặt tên chủ đề nhánh'],
  NOT_YOUR_REVIEW_STEP: [403, 'Bạn không {0} được ở bước này'],
  INVALID_VALUE: [400, 'Giá trị {0} không hợp lệ'],
  CLASS_DOC_LOCKED: [409, 'Tài liệu đã khóa chỉnh sửa'],
  LEARNING_RESOURCE_NOT_FOUND: [404, 'Không tìm thấy học liệu'],
  ACTIVITY_CHANGED: [409, 'Hoạt động đã thay đổi. Lưu và chọn lại hoạt động trước khi gắn tệp'],
  CLASS_ACCESS_DENIED: [403, 'Bạn không có quyền với lớp này'],
  THEME_PLAN_NOT_FOUND: [404, 'Không tìm thấy kế hoạch chủ đề'],
  UNSUPPORTED_MEDIA_TYPE: [415, 'Định dạng tệp không được hỗ trợ'],
  FILE_TOO_LARGE: [413, 'Tệp vượt quá dung lượng cho phép'],
  FILE_EMPTY: [400, 'Tệp rỗng'],
  EDU_CONFIG_FORBIDDEN: [403, 'Chỉ Hiệu trưởng hoặc Phó Hiệu trưởng sửa được cấu hình'],
  YEAR_PLAN_SIGNER_REQUIRED: [400, 'Kế hoạch năm học phải có Phó Hiệu trưởng ký'],
  CLASS_DOC_APPROVER_REQUIRED: [400, 'Mỗi loại tài liệu lớp cần ít nhất một người duyệt'],
  LESSON_ROW_REQUIRED: [400, 'Không bỏ được dòng giờ học'],
  DOMAIN_NAME_EXISTS: [409, 'Tên lĩnh vực {0} đã tồn tại'],
};

export function eduError(name, ...args) {
  const [status, text] = SPECS[name];
  const error = new ApiError(
    status,
    text.replace(/\{(\d+)\}/g, (_, i) => String(args[Number(i)] ?? '')),
  );
  error.errorCode = EDU_ERROR_CODE[name] ?? null;
  return error;
}
