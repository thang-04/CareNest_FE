import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, Lock } from '@/components/ui/icons';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/States';
import { useAuth } from '@/contexts/AuthContext';
import { useMasterData } from '@/hooks/useMasterData';
import { useTransfer } from '@/hooks/facility-transfer/useTransfers';
import { transferToForm } from '@/models/facility-transfer/FacilityTransfer';
import { TRANSFER_STATUS } from '@/models/facility-transfer/transferConstants';
import { canEditTransfer } from '@/utils/facility-transfer/transferPermissions';
import { formatDateTime } from '@/utils/format';
import { TransferWizard } from '@/components/facility-transfer/wizard/TransferWizard';
import { TransferStatusBadge } from '@/components/facility-transfer/TransferStatusBadge';
import { transferCrumbs } from '@/utils/facility-transfer/breadcrumbs';

/**
 * PHT-07: reopen the wizard with the old data preloaded.
 * DRAFT -> keep editing; REVISION_REQUESTED -> fix and resubmit as a new version.
 */
export default function TransferAdjustmentPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const md = useMasterData();
  const { transfer, loading, error, reload } = useTransfer(id, { live: false });

  // Build the form once per loaded version so background refreshes do not reset edits.
  const initialForm = useMemo(() => {
    if (!transfer) return null;
    const form = transferToForm(transfer);
    if (transfer.status === TRANSFER_STATUS.REVISION_REQUESTED) form.creatorSignatureUrl = null;
    return form;
  }, [transfer?.id, transfer?.version, transfer?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading || md.loading)
    return (
      <div className="page">
        <LoadingState />
      </div>
    );
  if (error || md.error)
    return (
      <div className="page">
        <ErrorState error={error || md.error} onRetry={reload} />
      </div>
    );

  const isRevise = transfer.status === TRANSFER_STATUS.REVISION_REQUESTED;
  const openRequest = transfer.revisionRequests.find((r) => !r.resolvedAt);

  return (
    <div className="page">
      <Breadcrumb items={transferCrumbs(isRevise ? `Điều chỉnh phiếu ${transfer.code}` : `Sửa phiếu nháp ${transfer.code}`)} />
      <div className="row" style={{ gap: 14, alignItems: 'center' }}>
        <h1 className="page__title">{isRevise ? `Điều chỉnh phiếu ${transfer.code}` : `Phiếu nháp ${transfer.code}`}</h1>
        <TransferStatusBadge status={transfer.status} />
      </div>

      {!canEditTransfer(transfer, user) ? (
        <div className="card">
          <EmptyState
            icon={Lock}
            title="Phiếu không thể chỉnh sửa"
            description="Chỉ Phó hiệu trưởng được sửa phiếu nháp hoặc phiếu đang ở trạng thái “Cần điều chỉnh”. Phiếu hoàn thành/đã hủy bị khóa."
            action={
              <Link className="btn" to={`/facility/transfers/${transfer.id}`}>
                Xem chi tiết phiếu
              </Link>
            }
          />
        </div>
      ) : (
        <>
          {isRevise && openRequest && (
            <div className="alert alert--warning mb-16">
              <AlertTriangle size={20} />
              <div>
                <div className="fw-600">
                  {md.userById(openRequest.requestedBy)?.fullName} yêu cầu điều chỉnh lúc {formatDateTime(openRequest.requestedAt)} (phiên
                  bản v{openRequest.version})
                </div>
                <div className="mt-8">“{openRequest.reason}”</div>
                <div className="mt-8 text-sm">
                  Dữ liệu cũ đã được điền sẵn. Chỉ sửa phần cần thiết rồi gửi lại – phiếu sẽ có phiên bản v{transfer.version + 1}, lịch sử
                  cũ được giữ nguyên.
                </div>
              </div>
            </div>
          )}
          <TransferWizard
            key={`${transfer.id}-${transfer.version}`}
            mode={isRevise ? 'revise' : 'draft'}
            initialForm={initialForm}
            md={md}
            transferId={transfer.id}
            lockedCode={transfer.code}
          />
        </>
      )}
    </div>
  );
}
