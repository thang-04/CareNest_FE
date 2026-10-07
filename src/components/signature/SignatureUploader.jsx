import { useRef, useState } from 'react';
import { ImagePlus, Info, Check } from 'lucide-react';
import { compressImage, isImageFile } from '@/utils/file';
import { useToast } from '@/contexts/ToastContext';
import { Spinner } from '@/components/ui/States';

const MAX_SIZE = 2 * 1024 * 1024;

/**
 * Upload a signature image, preview it, optionally save it to the account.
 * onUse({ url, saveToAccount, makeDefault }) is called when the user confirms.
 */
export function SignatureUploader({ onUse, busy }) {
  const inputRef = useRef(null);
  const toast = useToast();
  const [preview, setPreview] = useState(null);
  const [saveToAccount, setSaveToAccount] = useState(true);
  const [makeDefault, setMakeDefault] = useState(false);
  const [dragging, setDragging] = useState(false);

  const handleFile = async (file) => {
    if (!file) return;
    if (!/^image\/(png|jpe?g)$/i.test(file.type) || !isImageFile(file)) return toast.error('Chỉ chấp nhận ảnh PNG hoặc JPG');
    if (file.size > MAX_SIZE) return toast.error('Ảnh chữ ký tối đa 2MB');
    try {
      setPreview(await compressImage(file, { maxWidth: 600, maxHeight: 300, type: 'image/png' }));
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="stack" style={{ gap: 10 }}>
      <div
        className={`dropzone dropzone--sm ${dragging ? 'dropzone--active' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFile(e.dataTransfer.files[0]);
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
      >
        {preview ? (
          <img src={preview} alt="Xem trước chữ ký" className="signature-preview-img" />
        ) : (
          <>
            <ImagePlus size={22} className="muted" />
            <div className="text-sm">Kéo thả ảnh chữ ký hoặc</div>
          </>
        )}
        <span className="btn btn--sm btn--outline-primary">{preview ? 'Chọn ảnh khác' : 'Chọn file ảnh'}</span>
        <div className="muted text-xs">PNG, JPG (nền trong suốt) - tối đa 2MB, khuyến nghị 200x80 - 600x300</div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg"
          hidden
          onChange={(e) => {
            handleFile(e.target.files[0]);
            e.target.value = '';
          }}
        />
      </div>
      <label className="checkbox">
        <input type="checkbox" checked={saveToAccount} onChange={(e) => setSaveToAccount(e.target.checked)} />
        Lưu chữ ký cho tài khoản này
        <span title="Chữ ký đã lưu được dùng lại cho các phiếu sau, không cần tải lên lại.">
          <Info size={15} className="muted" />
        </span>
      </label>
      {saveToAccount && (
        <label className="checkbox">
          <input type="checkbox" checked={makeDefault} onChange={(e) => setMakeDefault(e.target.checked)} />
          Đặt làm chữ ký mặc định
        </label>
      )}
      <button
        className="btn btn--primary btn--sm"
        disabled={!preview || busy}
        onClick={() => onUse({ url: preview, saveToAccount, makeDefault })}
      >
        {busy ? <Spinner small /> : <Check size={15} />} Dùng chữ ký này
      </button>
    </div>
  );
}
