import { useMemo, useState } from 'react';
import { FileDown, Plus, Printer, Trash2 } from '@/components/ui/icons';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/contexts/ToastContext';
import { downloadDoc, printDoc } from '@/utils/assessment/themeEvaluationDoc';

/**
 * Xem trước bản in đánh giá (cuối chủ đề, học kỳ) rồi In / Lưu PDF hoặc Xuất Word; khung xem trước là đúng HTML sẽ in.
 * file.signers + file.withSigners: sửa chức danh, họ tên, thêm, bỏ người ký như tài liệu kế hoạch (Cần yêu cầu 10/11/2026);
 * chỉ đổi file in, không ghi hệ thống.
 */
export default function ThemeEvaluationPreviewModal({ file, onClose }) {
  const toast = useToast();
  const original = file.signers || [];
  const [signers, setSigners] = useState(original);
  const html = useMemo(() => (file.withSigners ? file.withSigners(signers) : file.html), [file, signers]);
  const edit = (i, key, value) => setSigners((list) => list.map((s, k) => (k === i ? { ...s, [key]: value } : s)));

  return (
    <Modal
      open
      size="xl"
      title="Xem trước bản in"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Đóng
          </button>
          <button
            type="button"
            className="btn"
            onClick={() =>
              printDoc(html) || toast.error('Trình duyệt chặn cửa sổ in. Cho phép cửa sổ bật lên rồi bấm lại.', 'Chưa mở được trang in')
            }
          >
            <Printer size={16} aria-hidden /> In / Lưu PDF
          </button>
          <button type="button" className="btn btn--primary" onClick={() => downloadDoc(html, file.name)}>
            <FileDown size={16} aria-hidden /> Xuất Word
          </button>
        </>
      }
    >
      {file.withSigners && (
        <fieldset className="dg-signers">
          <legend className="field__label">Chỗ ký ({signers.length})</legend>
          <div className="dg-signers__list">
            {signers.map((s, i) => (
              <div className="dg-signer" key={i} role="group" aria-label={`Người ký ${i + 1}`}>
                <span className="dg-signer__no">{i + 1}.</span>
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
                  placeholder="Để trống để ký tay"
                  aria-label={`Họ tên người ký ${i + 1}`}
                  onChange={(e) => edit(i, 'name', e.target.value)}
                />
                {/* Bỏ được mọi người ký, giữ ít nhất một chỗ ký (Cần yêu cầu 10/11/2026) */}
                {signers.length > 1 ? (
                  <button
                    type="button"
                    className="icon-btn icon-btn--danger"
                    aria-label={`Bỏ người ký ${i + 1}`}
                    title="Bỏ người ký"
                    onClick={() => setSigners((list) => list.filter((_, k) => k !== i))}
                  >
                    <Trash2 size={16} aria-hidden />
                  </button>
                ) : (
                  <span />
                )}
              </div>
            ))}
          </div>
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
      <div className="dg-doc-preview-scroll">
        <iframe className="dg-doc-preview" title={`Xem trước ${file.name}`} srcDoc={html} />
      </div>
    </Modal>
  );
}
