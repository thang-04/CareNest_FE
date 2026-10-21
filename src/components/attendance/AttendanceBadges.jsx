import {
  CheckCircle2,
  Clock,
  UserCheck,
  UserX,
  UserMinus,
  Lock,
  AlertTriangle,
  ChefHat,
  PackageCheck,
  RefreshCw,
  Unlock,
  Save,
  Send,
} from '@/components/ui/icons';
import { createStatusBadge } from '@/components/ui/StatusBadge';
import { ATTENDANCE_STATUS_LABELS, HANDOVER_STATUS_LABELS, MEAL_COUNT_STATUS_LABELS } from '@/models/attendance/attendanceConstants';

/* Tones follow DESIGN.md §3.2 */
export const AttendanceStatusBadge = createStatusBadge(
  { PRESENT: ['green', UserCheck], EXCUSED: ['orange', UserMinus], UNEXCUSED: ['red', UserX] },
  ATTENDANCE_STATUS_LABELS,
);

export const MealCountStatusBadge = createStatusBadge(
  { OPEN: ['blue', Unlock], PENDING_CONFIRMATION: ['purple', Lock], CONFIRMED: ['green', CheckCircle2] },
  MEAL_COUNT_STATUS_LABELS,
);

export const HandoverStatusBadge = createStatusBadge(
  {
    WAITING_KITCHEN: ['orange', ChefHat],
    READY: ['blue', PackageCheck],
    SHORTAGE_REPORTED: ['red', AlertTriangle],
    SUPPLEMENTED: ['blue', RefreshCw],
    CONFIRMED: ['green', CheckCircle2],
  },
  HANDOVER_STATUS_LABELS,
);

/* Trạng thái gọn của dòng điểm danh: vắng không tách phép / không phép (khớp nút Có mặt / Vắng).
   UNSAVED: dòng trên màn tiếp nhận có thay đổi chưa lưu = cần bấm lưu (orange). */
export const AttendanceRowBadge = createStatusBadge(
  {
    PRESENT: ['green', UserCheck],
    ABSENT: ['gray', UserMinus],
    NONE: ['gray', Clock],
    UNSAVED: ['orange', Save],
  },
  { PRESENT: 'Có mặt', ABSENT: 'Vắng', NONE: 'Chưa điểm danh', UNSAVED: 'Chưa lưu' },
);

export const NotRecordedBadge = () => <AttendanceRowBadge status="NONE" />;

/* Kết quả quan sát giáo viên đã chọn (không phải chẩn đoán): có dấu hiệu = cần để ý (orange). */
export const HealthObservationBadge = createStatusBadge(
  { NO_CONCERN: ['green', CheckCircle2], NOTED: ['orange', AlertTriangle] },
  { NO_CONCERN: 'Bình thường', NOTED: 'Có dấu hiệu' },
);

const PARENT_NOTIFY_STYLE = { PENDING: ['orange', Clock], DEMO_QUEUED: ['blue', Send] };

export const ParentNotifyBadge = createStatusBadge(PARENT_NOTIFY_STYLE, {
  PENDING: 'Chưa gửi được thông báo phụ huynh',
  DEMO_QUEUED: 'Đã gửi thông báo phụ huynh',
});

/** Nhãn ngắn cho dòng thu gọn. */
export const ParentNotifyShortBadge = createStatusBadge(PARENT_NOTIFY_STYLE, { PENDING: 'Chưa gửi PH', DEMO_QUEUED: 'Đã gửi PH' });
