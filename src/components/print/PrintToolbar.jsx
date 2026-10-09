import { useState } from 'react';
import { Printer, FileDown, FileSpreadsheet } from '@/components/ui/icons';
import { useToast } from '@/contexts/ToastContext';
import { exportElementToPdf } from '@/utils/exportPdf';
import { Spinner } from '@/components/ui/States';

/**
 * Standard actions for every printable document: Xuất Excel · Xuất PDF · In.
 * On a print page "In" is the main action (primary); elsewhere use plain buttons.
 *
 * <PrintToolbar sheetRef={ref} fileBase="Phieu_LC006" onCsv={() => downloadCsv(rows, 'x.csv')} printLabel="In phiếu" />
 */
export function PrintToolbar({ sheetRef, fileBase, onCsv, printLabel = 'In', compact = false }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const size = compact ? 'btn--sm' : '';

  const onPdf = async () => {
    setBusy(true);
    try {
      await exportElementToPdf(sheetRef.current, `${fileBase}.pdf`);
      toast.success('Đã xuất file PDF');
    } catch (err) {
      toast.error(`Không xuất được PDF: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  const csv = () => {
    onCsv();
    toast.success('Đã xuất file Excel (CSV)');
  };

  return (
    <div className="row no-print" style={{ gap: 8 }}>
      {onCsv && (
        <button className={`btn ${size}`} onClick={csv}>
          <FileSpreadsheet size={16} /> Xuất Excel
        </button>
      )}
      <button className={`btn ${size}`} onClick={onPdf} disabled={busy}>
        {busy ? <Spinner small /> : <FileDown size={16} />} Xuất PDF
      </button>
      <button className={`btn btn--primary ${size}`} onClick={() => window.print()}>
        <Printer size={16} /> {printLabel}
      </button>
    </div>
  );
}
