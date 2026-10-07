import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';

/** Read-only evidence photos; click to enlarge. */
export function PhotoGallery({ images = [], title = 'Ảnh hiện trạng' }) {
  const [preview, setPreview] = useState(null);
  if (!images.length) return <span className="muted">Không có ảnh</span>;
  return (
    <>
      <div className="bh-photos">
        {images.map((src, i) => (
          <button key={i} type="button" className="bh-photo" onClick={() => setPreview(src)} aria-label={`Phóng to ảnh ${i + 1}`}>
            <img src={src} alt={`${title} ${i + 1}`} />
          </button>
        ))}
      </div>
      <Modal open={!!preview} title={title} onClose={() => setPreview(null)} size="lg">
        {preview && <img src={preview} alt={title} style={{ width: '100%', borderRadius: 8 }} />}
      </Modal>
    </>
  );
}
