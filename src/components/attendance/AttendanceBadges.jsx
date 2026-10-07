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
} from 'lucide-react';
import { createStatusBadge } from '@/components/ui/StatusBadge';
import { ATTENDANCE_STATUS_LABELS, HANDOVER_STATUS_LABELS, MEAL_COUNT_STATUS_LABELS } from '@/models/attendance/attendanceConstants';

/* Tones follow DESIGN.md §6 */
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

export const NotRecordedBadge = () => (
  <span className="chip chip--gray">
    <Clock size={14} /> Chưa điểm danh
  </span>
);
