import { Camera, CheckCircle2, ClipboardList, Clock, Phone, PhoneOff, UserMinus, XCircle } from '@/components/ui/icons';
import { createStatusBadge } from '@/components/ui/StatusBadge';
import { CALL_NOTE_PERSON_LABEL, PICKUP_OUTCOME_LABELS, PICKUP_STATUS_LABELS, VERIFICATION_LABELS } from '@/models/pickup/pickupConstants';

/** Ô "Người đón": lượt trả qua gọi phụ huynh không có tên riêng thì hiện nhãn, người đón đọc ở nội dung cuộc gọi. */
export function PickupPerson({ pickup }) {
  if (!pickup.pickupPersonName) return <span className="muted">{CALL_NOTE_PERSON_LABEL}</span>;
  return (
    <>
      <div>{pickup.pickupPersonName}</div>
      <div className="text-xs muted">{pickup.pickupPersonRelation}</div>
    </>
  );
}

/* Tones follow DESIGN.md §3.2 */
export const PickupStatusBadge = createStatusBadge(
  { WAITING: ['orange', Clock], PICKED_UP: ['green', CheckCircle2], ABSENT: ['gray', UserMinus], UNMARKED: ['gray', ClipboardList] },
  PICKUP_STATUS_LABELS,
);

export const PickupOutcomeBadge = createStatusBadge(
  { HANDED_OVER: ['green', CheckCircle2], NOT_HANDED_OVER: ['red', XCircle] },
  PICKUP_OUTCOME_LABELS,
);

/* Cách xác minh người đón là thông tin (teal); gọi phụ huynh rồi không trả = red; không liên lạc được (bản ghi cũ) = orange. */
export const VerificationBadge = createStatusBadge(
  {
    PHOTO_MATCH: ['teal', Camera],
    PHONE_CONFIRMED: ['teal', Phone],
    PHONE_DECLINED: ['red', XCircle],
    PHONE_UNREACHABLE: ['orange', PhoneOff],
  },
  VERIFICATION_LABELS,
);
