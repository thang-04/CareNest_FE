import { useState } from 'react';
import { Printer, FileDown, FileSpreadsheet } from '@/components/ui/icons';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/contexts/ToastContext';
import { exportElementToPdf } from '@/utils/exportPdf';

/**
 * Chân hộp xem trước bản in (khuôn "Văn bản trường"), thứ tự cố định: Đóng · Xuất Excel · Xuất PDF · In (nút chính).
 * `onClose` có thì vẽ nút Đóng; `onCsv` có thì vẽ Xuất Excel (nên gọi exportWithPreview).
 *
 * <PrintToolbar sheetRef={ref} fileBase="Phieu_LC006" onClose={close} onCsv={() => exportWithPreview(rows, 'x.xlsx')} />
 */
export function PrintToolbar({ sheetRef, fileBase, onClose, onCsv, printLabel = 'In', compact = false, orientation = 'portrait' }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const size = compact ? 'sm' : undefined;

  const onPdf = async () => {
    setBusy(true);
    try {
      await exportElementToPdf(sheetRef.current, `${fileBase}.pdf`, { orientation });
      toast.success('Đã xuất file PDF');
    } catch (err) {
      toast.error(err, 'Không xuất được PDF');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="row gap-2 no-print">
      {onClose && (
        <Button size={size} onClick={onClose}>
          Đóng
        </Button>
      )}
      {onCsv && (
        <Button size={size} icon={FileSpreadsheet} onClick={onCsv}>
          Xuất Excel
        </Button>
      )}
      <Button size={size} icon={FileDown} loading={busy} onClick={onPdf}>
        Xuất PDF
      </Button>
      <Button variant="primary" size={size} icon={Printer} onClick={() => window.print()}>
        {printLabel}
      </Button>
    </div>
  );
}
