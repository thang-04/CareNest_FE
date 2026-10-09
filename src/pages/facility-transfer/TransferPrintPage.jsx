import { useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from '@/components/ui/icons';
import { useTransfer } from '@/hooks/facility-transfer/useTransfers';
import { useMasterData } from '@/hooks/useMasterData';
import { LoadingState, ErrorState } from '@/components/ui/States';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { PrintSheet, PrintActions } from '@/components/facility-transfer/PrintPreview';
import { buildPrintModel } from '@/utils/facility-transfer/printModel';
import { transferCrumbs } from '@/utils/facility-transfer/breadcrumbs';

/** Print / export page. Same template for every status (PhieuIn mockup). */
export default function TransferPrintPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const md = useMasterData();
  const { transfer, loading, error, reload } = useTransfer(id);
  const sheetRef = useRef(null);

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

  const model = buildPrintModel(transfer, md);
  return (
    <div className="page">
      <Breadcrumb items={transferCrumbs(`In phiếu ${transfer.code}`)} />
      <div className="row row--between no-print" style={{ margin: '12px 0 16px' }}>
        <button className="btn" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} /> Quay lại
        </button>
        <PrintActions model={model} sheetRef={sheetRef} />
      </div>
      <div className="print-preview__paper">
        <PrintSheet ref={sheetRef} model={model} />
      </div>
    </div>
  );
}
