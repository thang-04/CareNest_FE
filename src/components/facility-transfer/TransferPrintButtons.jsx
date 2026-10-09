import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FileSearch, Printer } from '@/components/ui/icons';
import { Modal } from '@/components/ui/Modal';
import { PrintPreview } from '@/components/facility-transfer/PrintPreview';
import { buildPrintModel } from '@/utils/facility-transfer/printModel';
import { TRANSFER_STATUS } from '@/models/facility-transfer/transferConstants';

/** "Xem trước PDF" + "In / Xuất" for anyone allowed to view the transfer. */
export function TransferPrintButtons({ transfer, md }) {
  const [preview, setPreview] = useState(false);
  if (transfer.status === TRANSFER_STATUS.DRAFT) return null;
  return (
    <div className="row no-print" style={{ gap: 8 }}>
      <button className="btn" onClick={() => setPreview(true)}>
        <FileSearch size={16} /> Xem trước PDF
      </button>
      <Link className="btn" to={`/facility/transfers/${transfer.id}/print`}>
        <Printer size={16} /> In / Xuất
      </Link>
      <Modal open={preview} title={`Xem trước phiếu ${transfer.code}`} onClose={() => setPreview(false)} size="xl">
        <PrintPreview model={buildPrintModel(transfer, md)} />
      </Modal>
    </div>
  );
}
