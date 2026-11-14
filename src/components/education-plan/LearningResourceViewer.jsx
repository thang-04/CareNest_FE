import { useEffect, useState } from 'react';
import { learningResourceService } from '@/services/education-plan/learningResourceService';
import { mediaKind, resourceKind, youtubeEmbed } from '@/models/education-plan/learningResources.mjs';
import { Notice } from './eduUi';

/**
 * Xem học liệu qua liên kết có hạn của kho (BE spec 017); hết hạn thì mở lại học liệu để lấy liên kết mới.
 * Học liệu link (BE:EDU-83): YouTube phát khung nhúng không cookie, không tự phát; Google Drive/Docs mở tab mới.
 * `load` thay cách lấy liên kết (trang Kho học liệu); mặc định theo dòng gắn của giáo án ngày.
 */
export function LearningResourceViewer({ user, docKey, resource, load }) {
  const resourceId = resource?.id;
  const isLink = resource?.kind === 'LINK';
  const [state, setState] = useState({ url: null, error: '', id: null });
  useEffect(() => {
    if (!resourceId || isLink) return undefined;
    let alive = true;
    setState({ url: null, error: '', id: resourceId });
    (load ? load() : learningResourceService.contentUrl(user, docKey, resourceId))
      .then((url) => alive && setState({ url, error: '', id: resourceId }))
      .catch((e) => alive && setState({ url: null, error: e.message, id: resourceId }));
    return () => {
      alive = false;
    };
    // load thay đổi theo mỗi lần render của trang cha; chỉ tải lại khi đổi học liệu
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, docKey, resourceId, isLink]);
  if (!resource) return <p className="muted">Chọn học liệu để xem; mục chưa có tệp vẫn dạy được từ nội dung kế hoạch.</p>;
  const title = resource.title || resource.fileName;
  if (isLink) {
    const embed = youtubeEmbed(resource.url);
    return (
      <div className="ga-media-viewer">
        {embed && (
          <iframe
            key={resource.id}
            src={embed}
            title={title}
            width="100%"
            height="360"
            allow="encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        )}
        {!embed && <p>Tài liệu Google thường không cho xem trong trang khi chưa chia sẻ công khai. Mở trong tab mới để xem.</p>}
        <a className="btn btn--ghost" href={resource.url} target="_blank" rel="noreferrer">
          {resourceKind(resource) === 'youtube' ? 'Mở trên YouTube' : 'Mở trong tab mới'}
        </a>
      </div>
    );
  }
  if (state.id !== resource.id || (!state.url && !state.error)) return <p role="status">Đang tải học liệu…</p>;
  if (state.error) return <Notice>{state.error}</Notice>;
  const kind = mediaKind(resource.contentType);
  const name = resource.fileName || title;
  const pdfViewerAvailable = typeof navigator !== 'undefined' && navigator.pdfViewerEnabled === true;
  return (
    <div className="ga-media-viewer">
      {kind === 'image' && <img src={state.url} alt={title} />}
      {kind === 'video' && (
        <video key={resource.id} src={state.url} controls preload="metadata">
          <track kind="captions" />
          Trình duyệt không hỗ trợ video.
        </video>
      )}
      {kind === 'pdf' && <p>Nếu PDF không hiển thị trong trình duyệt, dùng nút tải bên dưới để mở tài liệu bằng ứng dụng PDF.</p>}
      {kind === 'pdf' && pdfViewerAvailable && (
        <object data={state.url} type="application/pdf" aria-label={title}>
          <p>Trình duyệt này chưa hỗ trợ xem PDF trong trang. Dùng nút tải bên dưới để mở tài liệu bằng ứng dụng PDF.</p>
        </object>
      )}
      {kind === 'file' && <p>Tải tệp để mở bằng ứng dụng phù hợp. Với slide, có thể xuất PDF để xem trực tiếp tại đây.</p>}
      <a className="btn btn--ghost" href={state.url} download={name} target="_blank" rel="noreferrer">
        Tải {name}
      </a>
    </div>
  );
}
