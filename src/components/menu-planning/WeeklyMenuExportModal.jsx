import { useMemo, useState } from 'react';
import { FileDown, Printer } from '@/components/ui/icons';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/form/Field';
import { useToast } from '@/contexts/ToastContext';
import { downloadDoc, fileTitle, printDoc } from '@/components/print/docFile';
import { PrintSignerFields } from '@/components/print/PrintSignerFields';
import { weeklyMenuFile } from '@/utils/menu-planning/weeklyMenuDoc';

const POPUP_BLOCKED = 'Trình duyệt chặn cửa sổ in. Cho phép cửa sổ bật lên rồi bấm lại.';

/**
 * Xem trước thực đơn tuần đã công bố rồi Xuất Word hoặc In / Lưu PDF; khung xem trước là đúng HTML sẽ xuất.
 * Họ tên người lập chỉ đổi file xuất, không ghi hệ thống; điền sẵn người đang xuất, để trống thì ký tay.
 */
export function WeeklyMenuExportModal({ plan, week, defaultPreparer = '', onClose }) {
  const toast = useToast();
  const [signers, setSigners] = useState([{ title: 'Người lập', name: defaultPreparer }]);
  const preparer = signers[0].name;
  const file = useMemo(() => weeklyMenuFile(plan, week, { preparerName: preparer }), [plan, week, preparer]);
  const [name, setName] = useState(file.name);
  const baseName = fileTitle(name) || file.name;

  return (
    <Modal
      open
      size="xl"
      title="Xuất thực đơn tuần"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Đóng</Button>
          <Button icon={FileDown} onClick={() => downloadDoc(file.html, baseName)}>
            Xuất Word
          </Button>
          <Button variant="primary" icon={Printer} onClick={() => printDoc(file.html) || toast.warning(POPUP_BLOCKED)}>
            In / Lưu PDF
          </Button>
        </>
      }
    >
      <PrintSignerFields signers={signers} onChange={setSigners}>
        <TextField label="Tên file" value={name} maxLength={180} onChange={(e) => setName(e.target.value)} />
      </PrintSignerFields>
      <div className="td-doc-preview-scroll">
        <iframe className="td-doc-preview" title={`Xem trước ${baseName}`} srcDoc={file.html} />
      </div>
    </Modal>
  );
}
