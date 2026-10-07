import { ROLE_LABELS } from '@/models/User';
import { locationLabel } from '@/models/Location';
import {
  TRANSFER_TYPE_LABELS,
  SIGNATURE_TYPES,
  SIGNATURE_TYPE_LABELS,
  TRANSFER_STATUS,
} from '@/models/facility-transfer/transferConstants';
import { getValidSignature } from '@/models/facility-transfer/TransferSignature';
import { expectedReceiveQuantity } from '@/models/facility-transfer/FacilityTransferItem';

const PRINT_STATUS = {
  DRAFT: ['BẢN NHÁP', 'gray'],
  PENDING_HANDOVER: ['CHỜ BÀN GIAO', 'red'],
  REVISION_REQUESTED: ['CẦN ĐIỀU CHỈNH', 'red'],
  PENDING_RECEIPT: ['CHỜ XÁC NHẬN NHẬN', 'orange'],
  PENDING_RESOLUTION: ['CHỜ XỬ LÝ CHÊNH LỆCH', 'purple'],
  COMPLETED: ['HOÀN THÀNH', 'green'],
  CANCELLED: ['ĐÃ HỦY', 'gray'],
};

/**
 * Builds what the single print template shows. The template is the same for
 * every status; only this model changes (signatures, status stamp, columns).
 * `transfer` may be a saved transfer or the wizard form (preview before sending).
 */
export const buildPrintModel = (transfer, md, previewCreator) => {
  const from = md.locationById(transfer.fromLocationId);
  const to = md.locationById(transfer.toLocationId);
  const fromCampus = md.campusById(transfer.fromCampusId);
  const toCampus = md.campusById(transfer.toCampusId || transfer.fromCampusId);
  const status = transfer.status || TRANSFER_STATUS.DRAFT;
  const [statusLabel, statusTone] = PRINT_STATUS[status];

  const handoverSigned = !!getValidSignature(transfer, SIGNATURE_TYPES.HANDOVER);
  const completed = status === TRANSFER_STATUS.COMPLETED;

  const signerBox = (type, userId) => {
    const sig = getValidSignature(transfer, type);
    const user = md.userById(sig?.signedBy || userId);
    const preview =
      type === SIGNATURE_TYPES.CREATOR && !sig && previewCreator?.url
        ? { signatureUrl: previewCreator.url, signedByName: previewCreator.name, signedAt: null }
        : null;
    return {
      type,
      title: SIGNATURE_TYPE_LABELS[type],
      roleLabel: user ? ROLE_LABELS[user.role] : '',
      name: sig?.signedByName || preview?.signedByName || user?.fullName || '',
      signatureUrl: sig?.signatureUrl || preview?.signatureUrl || null,
      signedAt: sig?.signedAt || null,
      documentVersion: sig?.documentVersion,
      signed: !!sig,
    };
  };

  const items = (transfer.items || [])
    .filter((i) => i.quantity > 0)
    .map((i, idx) => ({
      stt: idx + 1,
      code: i.assetCode,
      name: i.assetName,
      unit: i.unit,
      quantity: i.quantity,
      handoverQuantity: i.handoverQuantity,
      receivedQuantity: completed ? expectedReceiveQuantity(i) : i.receivedQuantity,
    }));

  const placeLabel = (loc, campus) => (loc ? `${locationLabel(loc)} - ${campus?.shortName || ''}` : '—');

  return {
    code: transfer.code || '(Tự động sinh)',
    version: transfer.version || 0,
    status,
    statusLabel,
    statusTone,
    createdDate: transfer.createdDate,
    expectedHandoverDate: transfer.expectedHandoverDate,
    typeLabel: TRANSFER_TYPE_LABELS[transfer.type],
    from: placeLabel(from, fromCampus),
    to: placeLabel(to, toCampus),
    reason: transfer.reason,
    note: transfer.note,
    items,
    total: items.reduce((s, i) => s + i.quantity, 0),
    totalHandover: items.reduce((s, i) => s + (i.handoverQuantity || 0), 0),
    totalReceived: items.reduce((s, i) => s + (i.receivedQuantity || 0), 0),
    showHandoverColumn: handoverSigned,
    showReceivedColumn: completed,
    signers: [
      signerBox(SIGNATURE_TYPES.CREATOR, transfer.createdBy),
      signerBox(SIGNATURE_TYPES.HANDOVER, transfer.handoverUserId),
      signerBox(SIGNATURE_TYPES.RECEIVER, transfer.receiverUserId),
    ],
  };
};
