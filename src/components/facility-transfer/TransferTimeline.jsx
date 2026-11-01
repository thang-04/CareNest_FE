import { ProgressSteps } from '@/components/ui/ProgressSteps';
import { TRANSFER_STATUS, SIGNATURE_TYPES } from '@/models/facility-transfer/transferConstants';
import { getValidSignature } from '@/models/facility-transfer/TransferSignature';
import { formatDateTime } from '@/utils/format';

/** 4-step progress: Tạo phiếu → Bàn giao → Xác nhận nhận → Hoàn thành. */
export function TransferTimeline({ transfer, userById }) {
  const s = transfer.status;
  const creator = getValidSignature(transfer, SIGNATURE_TYPES.CREATOR);
  const handover = getValidSignature(transfer, SIGNATURE_TYPES.HANDOVER);
  const receiver = getValidSignature(transfer, SIGNATURE_TYPES.RECEIVER);
  const name = (id) => userById(id)?.fullName || '';

  const steps = [
    {
      label: 'Tạo phiếu',
      done: s !== TRANSFER_STATUS.DRAFT,
      sub: creator ? `${name(creator.signedBy)} · ${formatDateTime(creator.signedAt)}` : 'Bản nháp',
    },
    {
      label: 'Bàn giao',
      done: !!handover,
      warn: s === TRANSFER_STATUS.REVISION_REQUESTED,
      sub: handover
        ? `${name(handover.signedBy)} · ${formatDateTime(handover.signedAt)}`
        : s === TRANSFER_STATUS.REVISION_REQUESTED
          ? 'Yêu cầu điều chỉnh'
          : `Chờ ${name(transfer.handoverUserId)}`,
    },
    {
      label: 'Xác nhận nhận',
      done: !!receiver,
      warn: s === TRANSFER_STATUS.PENDING_RESOLUTION,
      sub: receiver
        ? `${name(receiver.signedBy)} · ${formatDateTime(receiver.signedAt)}`
        : s === TRANSFER_STATUS.PENDING_RESOLUTION
          ? 'Có chênh lệch'
          : `Chờ ${name(transfer.receiverUserId)}`,
    },
    {
      label: 'Hoàn thành',
      done: s === TRANSFER_STATUS.COMPLETED,
      sub: s === TRANSFER_STATUS.COMPLETED ? formatDateTime(transfer.updatedAt) : '',
    },
  ];
  return <ProgressSteps steps={steps} cancelled={s === TRANSFER_STATUS.CANCELLED} />;
}
