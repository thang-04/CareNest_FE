import {
  AlertTriangle,
  CheckCircle2,
  CircleX,
  Clock,
  FileQuestion,
  Hourglass,
  PackageCheck,
  PackageX,
  PauseCircle,
  Timer,
  Trash2,
} from '@/components/ui/icons';
import { StatusBadge, createStatusBadge } from '@/components/ui/StatusBadge';
import {
  FORECAST_DAY_PLAN_LABELS,
  FRESH_CHECK_RESULT_LABELS,
  FRESH_RECEIPT_STATUS_LABELS,
  FRESH_ROUND_STATE_LABELS,
  ISSUE_STATUS_LABELS,
  MEAL_COUNT_STATUS_LABELS,
  PREP_STATUS_LABELS,
  RECEIPT_STATUS_LABELS,
  STOCK_MOVEMENT_LABELS,
  SUPPLIER_STATUS_LABELS,
} from '@/models/kitchen/kitchenConstants';

/* Tones follow DESIGN.md §3.2: orange = waiting for someone else, blue = in progress, purple = waiting for approval, green = done. */
export const IssueStatusBadge = createStatusBadge(
  {
    NO_MENU: ['gray', FileQuestion],
    WAITING_MEAL_COUNT: ['orange', Clock],
    AWAITING_STOCK: ['red', PackageX],
    AWAITING_LOT_ALLOCATION: ['orange', Hourglass],
    PROCESSING: ['blue', Timer],
    POSTED: ['green', PackageCheck],
    FAILED: ['red', PackageX],
    ISSUED: ['green', PackageCheck],
    PENDING_APPROVAL: ['purple', Clock],
    APPROVED: ['orange', Clock],
    RECEIVED: ['green', PackageCheck],
  },
  ISSUE_STATUS_LABELS,
);

export const FreshReceiptStatusBadge = createStatusBadge(
  { NEW: ['gray', FileQuestion], DRAFT: ['blue', Clock], SUBMITTED: ['purple', Clock], CONFIRMED: ['green', CheckCircle2] },
  FRESH_RECEIPT_STATUS_LABELS,
);

// Kết quả kiểm nhận hàng tươi: thiếu = đỏ, thừa = cam (DESIGN §3.2 nhãn phân loại)
export const FreshCheckResultBadge = createStatusBadge(
  { ENOUGH: ['green', CheckCircle2], SHORT: ['red', PackageX], OVER: ['orange', AlertTriangle] },
  FRESH_CHECK_RESULT_LABELS,
);

export const FreshRoundStateBadge = createStatusBadge(
  { RECORDED: ['green', CheckCircle2], PENDING: ['orange', Clock], UNAVAILABLE: ['gray', FileQuestion] },
  FRESH_ROUND_STATE_LABELS,
);

export const ForecastDayPlanBadge = createStatusBadge(
  { NONE: ['gray', FileQuestion], DRAFT: ['orange', Clock], PUBLISHED: ['green', CheckCircle2] },
  FORECAST_DAY_PLAN_LABELS,
);

export const ReceiptStatusBadge = createStatusBadge(
  { DRAFT: ['blue', Clock], CONFIRMED: ['green', CheckCircle2], CANCELLED: ['gray', CircleX] },
  RECEIPT_STATUS_LABELS,
);

// Biến động kho khô: nhập vào = xanh lá, trừ theo suất = xanh ngọc (đã xong, không dùng xanh dương "đang chạy"), điều chỉnh / trừ phần thiếu = cam, hủy phiếu = xám
export const StockMovementBadge = createStatusBadge(
  {
    RECEIPT: ['green', null],
    DEDUCT: ['teal', null],
    ADJUST: ['orange', null],
    SHORTFALL_DEDUCT: ['orange', null],
    RECEIPT_CANCEL: ['gray', null],
  },
  STOCK_MOVEMENT_LABELS,
);

export const SupplierStatusBadge = createStatusBadge(
  { ACTIVE: ['green', CheckCircle2], INACTIVE: ['gray', PauseCircle] },
  SUPPLIER_STATUS_LABELS,
);

export const MealCountStatusBadge = createStatusBadge(
  { NONE: ['gray', FileQuestion], PENDING_CONFIRMATION: ['purple', Clock], CONFIRMED: ['green', CheckCircle2] },
  MEAL_COUNT_STATUS_LABELS,
);

export const PrepStatusBadge = createStatusBadge(
  {
    NOT_STARTED: ['gray', FileQuestion],
    WAITING: ['orange', Clock],
    COOKING: ['blue', Clock],
    READY_FOR_HANDOVER: ['green', CheckCircle2],
  },
  PREP_STATUS_LABELS,
);

/* Mẫu lưu: nhãn kèm giờ lưu/giờ hủy nên dựng trực tiếp từ StatusBadge; trạng thái lạ coi như chưa lưu. */
const FOOD_SAMPLE_STYLE = {
  TODO: ['gray', FileQuestion, 'Chưa lưu'],
  SAVED: ['green', CheckCircle2, 'Đã lưu'],
  DESTROYED: ['gray', Trash2, 'Đã hủy'],
  PENDING_DESTROY: ['orange', Timer, 'Chờ ghi hủy'],
};
export function FoodSampleStatusBadge({ status, time }) {
  const [tone, icon, label] = FOOD_SAMPLE_STYLE[status] || FOOD_SAMPLE_STYLE.TODO;
  return <StatusBadge tone={tone} icon={icon} label={time ? `${label} ${time}` : label} />;
}

/* Mức tồn kho khô: chỉ hiển thị trạng thái và số ngày BE/hook đã tính, không tự tính ngưỡng. */
const STOCK_LEVEL_STYLE = { OUT: ['red', PackageX], LOW: ['orange', Hourglass] };
export function StockLevelBadge({ status, daysLeft }) {
  const style = STOCK_LEVEL_STYLE[status];
  if (!style) return null;
  return <StatusBadge tone={style[0]} icon={style[1]} label={status === 'OUT' ? 'Hết' : `${daysLeft} ngày`} />;
}
