import { FileText } from '@/components/ui/icons';
import { formatDate } from '@/utils/format';
import { ROLE_LABELS } from '@/models/User';
import { locationLabel } from '@/models/Location';
import { TRANSFER_TYPE_LABELS, MY_TRANSFER_ROLE_LABELS, TRANSFER_TYPES } from '@/models/facility-transfer/transferConstants';

/** "Thông tin phiếu" block of the staff pages (LuanChuyenTeacher1 mockup). */
export function TransferInfoCard({ transfer, md, myRole }) {
  const from = md.locationById(transfer.fromLocationId);
  const to = md.locationById(transfer.toLocationId);
  const creator = md.userById(transfer.createdBy);
  const inter = transfer.type === TRANSFER_TYPES.INTER_CAMPUS;
  const place = (loc, campusId) => `${locationLabel(loc)}${inter ? ` - ${md.campusById(campusId)?.shortName}` : ''}`;
  return (
    <div className="card card--soft-header">
      <div className="card__header">
        <div className="card__title">
          <FileText size={20} /> Thông tin phiếu
        </div>
      </div>
      <div className="card__body info-columns">
        <dl className="info-list">
          <dt>Mã phiếu:</dt>
          <dd className="fw-600">{transfer.code}</dd>
          <dt>Ngày lập:</dt>
          <dd className="fw-600">{formatDate(transfer.createdDate)}</dd>
          <dt>Ngày dự kiến bàn giao:</dt>
          <dd>{formatDate(transfer.expectedHandoverDate)}</dd>
          <dt>Loại luân chuyển:</dt>
          <dd>{TRANSFER_TYPE_LABELS[transfer.type]}</dd>
        </dl>
        <dl className="info-list">
          <dt>Từ:</dt>
          <dd>{place(from, transfer.fromCampusId)}</dd>
          <dt>Đến:</dt>
          <dd>{place(to, transfer.toCampusId)}</dd>
          <dt>Người tạo phiếu:</dt>
          <dd>
            {creator?.fullName} ({ROLE_LABELS[creator?.role]})
          </dd>
          {myRole && (
            <>
              <dt>Vai trò của tôi:</dt>
              <dd>
                <span className="chip chip--teal text-md">{MY_TRANSFER_ROLE_LABELS[myRole]}</span>
              </dd>
            </>
          )}
        </dl>
        <dl className="info-list">
          <dt>Lý do:</dt>
          <dd>{transfer.reason}</dd>
          <dt>Ghi chú:</dt>
          <dd>{transfer.note || '—'}</dd>
          {transfer.version > 1 && (
            <>
              <dt>Phiên bản:</dt>
              <dd>v{transfer.version}</dd>
            </>
          )}
        </dl>
      </div>
    </div>
  );
}
