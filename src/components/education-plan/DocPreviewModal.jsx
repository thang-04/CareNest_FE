import { useMemo, useState } from 'react';
import { FileDown, Plus, Printer, Trash2 } from '@/components/ui/icons';
import { Modal } from '@/components/education-plan/eduUi';
import { useEducationPlan } from '@/hooks/education-plan/useEducationPlan';
import { applySigners, readSigners } from '@/utils/education-plan/docSigners';
import { downloadDoc, fileTitle, printDoc } from '@/utils/education-plan/yearPlanDoc';

const POPUP_BLOCKED = 'Trình duyệt chặn cửa sổ in. Cho phép cửa sổ bật lên rồi bấm lại.';

/**
 * Xem trước tài liệu trước khi xuất Word / in PDF (Tiền 31/10). file = { html, name } từ yearPlanDoc / classPlanDoc:
 * khung xem trước hiển thị đúng HTML sẽ xuất nên bản xem trước trùng bản tải về.
 * Sửa tên file, chức danh / họ tên ở chỗ ký, thêm người ký (Tiền 03/11): chỉ đổi file xuất, không ghi hệ thống.
 */
export default function DocPreviewModal({ file, onClose }) {
  const { toast } = useEducationPlan();
  const original = useMemo(() => readSigners(file.html), [file.html]);
  const [signers, setSigners] = useState(original);
  const [name, setName] = useState(file.name);
  const html = useMemo(() => applySigners(file.html, signers), [file.html, signers]);
  const baseName = fileTitle(name) || file.name;
  const edit = (i, key, value) => setSigners((list) => list.map((s, k) => (k === i ? { ...s, [key]: value } : s)));

  return (
    <Modal
      title="Xem trước"
      width={1100}
      className="ga-doc-preview-modal"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Đóng
          </button>
          <button type="button" className="btn" onClick={() => printDoc(html) || toast(POPUP_BLOCKED, 'warn')}>
            <Printer size={16} aria-hidden /> In / Lưu PDF
          </button>
          <button type="button" className="btn btn--primary" onClick={() => downloadDoc(html, baseName)}>
            <FileDown size={16} aria-hidden /> Xuất Word
          </button>
        </>
      }
    >
      <div className="ga-export-form">
        <label className="field ga-export-name">
          <span className="field__label">Tên file</span>
          <input className="input" value={name} maxLength={180} onChange={(e) => setName(e.target.value)} />
        </label>
        {original.length > 0 && (
          <fieldset className="ga-export-signers">
            <legend className="field__label">Chỗ ký</legend>
            {signers.map((s, i) => (
              <div className="ga-export-signer" key={i}>
                <input
                  className="input"
                  value={s.title}
                  placeholder="Chức danh"
                  aria-label={`Chức danh người ký ${i + 1}`}
                  onChange={(e) => edit(i, 'title', e.target.value)}
                />
                <input
                  className="input"
                  value={s.name}
                  placeholder="Họ tên (để trống để ký tay)"
                  aria-label={`Họ tên người ký ${i + 1}`}
                  onChange={(e) => edit(i, 'name', e.target.value)}
                />
                {i >= original.length ? (
                  <button
                    type="button"
                    className="icon-btn icon-btn--danger"
                    aria-label={`Bỏ người ký ${i + 1}`}
                    onClick={() => setSigners((list) => list.filter((_, k) => k !== i))}
                  >
                    <Trash2 size={16} aria-hidden />
                  </button>
                ) : (
                  <span aria-hidden />
                )}
              </div>
            ))}
            <div>
              <button
                type="button"
                className="btn btn--sm btn--ghost"
                onClick={() => setSigners((list) => [...list, { title: '', name: '' }])}
              >
                <Plus size={16} aria-hidden /> Thêm người ký
              </button>
            </div>
          </fieldset>
        )}
      </div>
      <div className="ga-doc-preview-scroll">
        <iframe className="ga-doc-preview" title={`Xem trước ${baseName}`} srcDoc={html} />
      </div>
    </Modal>
  );
}
