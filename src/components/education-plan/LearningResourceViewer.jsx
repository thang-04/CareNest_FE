import { useEffect, useState } from 'react';
import { learningResourceService } from '@/services/education-plan/learningResourceService';
import { mediaKind } from '@/models/education-plan/learningResources.mjs';
import { Notice } from './eduUi';

export function LearningResourceViewer({ user, docKey, resource }) {
  const resourceId = resource?.id;
  const [state, setState] = useState({ url: null, error: '', id: null });
  useEffect(() => {
    if (!resourceId) return undefined;
    let alive = true;
    let url;
    const controller = new AbortController();
    setState({ url: null, error: '', id: resourceId });
    learningResourceService
      .content(user, docKey, resourceId, controller.signal)
      .then((blob) => {
        if (!alive) return;
        url = URL.createObjectURL(blob);
        setState({ url, error: '', id: resourceId });
      })
      .catch((e) => alive && setState({ url: null, error: e.message, id: resourceId }));
    return () => {
      alive = false;
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [user, docKey, resourceId]);
  if (!resource) return <p className="muted">Chọn học liệu để xem; hoạt động chưa có tệp vẫn dạy được từ nội dung kế hoạch.</p>;
  if (state.id !== resource.id || (!state.url && !state.error)) return <p role="status">Đang tải học liệu…</p>;
  if (state.error) return <Notice tone="warn">{state.error}</Notice>;
  const kind = mediaKind(resource.contentType);
  const pdfViewerAvailable = typeof navigator !== 'undefined' && navigator.pdfViewerEnabled === true;
  return (
    <div className="ga-media-viewer">
      {kind === 'image' && <img src={state.url} alt={resource.fileName} />}
      {kind === 'video' && (
        <video key={resource.id} src={state.url} controls preload="metadata">
          <track kind="captions" />
          Trình duyệt không hỗ trợ video.
        </video>
      )}
      {kind === 'pdf' && <p>Nếu PDF không hiển thị trong trình duyệt, dùng nút tải bên dưới để mở tài liệu bằng ứng dụng PDF.</p>}
      {kind === 'pdf' && pdfViewerAvailable && (
        <object data={state.url} type="application/pdf" aria-label={resource.fileName}>
          <p>Trình duyệt này chưa hỗ trợ xem PDF trong trang. Dùng nút tải bên dưới để mở tài liệu bằng ứng dụng PDF.</p>
        </object>
      )}
      {kind === 'file' && <p>Tải tệp để mở bằng ứng dụng phù hợp. Với slide, có thể xuất PDF để xem trực tiếp tại đây.</p>}
      <a className="btn btn--ghost" href={state.url} download={resource.fileName}>
        Tải {resource.fileName}
      </a>
    </div>
  );
}
