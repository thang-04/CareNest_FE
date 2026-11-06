import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchChildPhoto } from '@/services/privatePhotoService';

/** Ảnh riêng tư cần token; ảnh đang chọn và ảnh demo không gửi lên API đọc. */
export function usePhotoUrl(source) {
  const { user } = useAuth() || {};
  const [loaded, setLoaded] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    let objectUrl;
    const showBlob = (blob) => {
      if (controller.signal.aborted) return;
      objectUrl = URL.createObjectURL(blob);
      setLoaded({ source, userId: user?.id, url: objectUrl });
    };
    if (source instanceof Blob) showBlob(source);
    else if (typeof source === 'string' && /^data:image\/(?:jpeg|png|webp);base64,/.test(source)) {
      setLoaded({ source, userId: user?.id, url: source });
    } else if (source) {
      fetchChildPhoto(source, controller.signal)
        .then(showBlob)
        .catch(() => {
          // Ảnh lỗi/ngoài phạm vi hiển thị fallback; không giữ ảnh của người dùng trước.
          if (!controller.signal.aborted) setLoaded(null);
        });
    }
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [source, user?.id]);
  return loaded && loaded.source === source && loaded.userId === user?.id ? loaded.url : null;
}
