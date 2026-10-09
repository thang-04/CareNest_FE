import { useRef, useState } from 'react';
import { Camera, X } from '@/components/ui/icons';
import { compressImage, isImageFile } from '@/utils/file';
import { useToast } from '@/contexts/ToastContext';
import { Modal } from '@/components/ui/Modal';

/** Small evidence-photo uploader used in handover / receipt rows. */
export function ImageUploader({ images = [], onChange, disabled, max = 3 }) {
  const inputRef = useRef(null);
  const toast = useToast();
  const [preview, setPreview] = useState(null);

  const add = async (fileList) => {
    const next = [...images];
    for (const file of Array.from(fileList)) {
      if (next.length >= max) {
        toast.warning(`Tối đa ${max} ảnh cho mỗi tài sản`);
        break;
      }
      if (!isImageFile(file)) {
        toast.error(`${file.name} không phải ảnh`);
        continue;
      }
      try {
        next.push(await compressImage(file, { maxWidth: 640, maxHeight: 640, quality: 0.6 }));
      } catch (err) {
        toast.error(err.message);
      }
    }
    onChange(next);
  };

  return (
    <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
      {images.map((src, i) => (
        <span key={i} className="evidence-thumb">
          <img src={src} alt={`Ảnh ${i + 1}`} onClick={() => setPreview(src)} />
          {!disabled && (
            <button className="evidence-thumb__remove" onClick={() => onChange(images.filter((_, idx) => idx !== i))} aria-label="Xóa ảnh">
              <X size={11} />
            </button>
          )}
        </span>
      ))}
      {!disabled && images.length < max && (
        <button type="button" className="evidence-add" onClick={() => inputRef.current?.click()} aria-label="Thêm ảnh">
          <Camera size={16} />
        </button>
      )}
      {disabled && images.length === 0 && <span className="muted">—</span>}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          add(e.target.files);
          e.target.value = '';
        }}
      />
      <Modal open={!!preview} title="Ảnh bằng chứng" onClose={() => setPreview(null)} size="lg">
        {preview && <img src={preview} alt="Ảnh bằng chứng" style={{ width: '100%', borderRadius: 8 }} />}
      </Modal>
    </div>
  );
}
