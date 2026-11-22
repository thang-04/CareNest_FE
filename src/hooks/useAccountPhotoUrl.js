import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ACCOUNT_PHOTO_CHANGED_EVENT, getAccountPhotoUrl } from '@/services/account/accountPhotoService';
import { photoUserId } from '@/utils/account/photoUrlBatcher';

/** Link ảnh đại diện của tài khoản `user` theo quyền của người đang đăng nhập; null khi không có/chưa tải. */
export function useAccountPhotoUrl(user) {
  const { user: viewer } = useAuth() || {};
  const userId = photoUserId(user);
  const viewerId = viewer?.id ?? null;
  const key = userId && viewerId != null ? `${viewerId}:${userId}` : null;
  const [loaded, setLoaded] = useState({ key: null, url: null });

  useEffect(() => {
    if (!key) return undefined;
    let alive = true;
    const load = () =>
      getAccountPhotoUrl(viewerId, userId).then((url) => {
        if (alive) setLoaded({ key, url });
      });
    load();
    const onChange = (event) => {
      if (event.detail?.userId === userId) load();
    };
    window.addEventListener(ACCOUNT_PHOTO_CHANGED_EVENT, onChange);
    return () => {
      alive = false;
      window.removeEventListener(ACCOUNT_PHOTO_CHANGED_EVENT, onChange);
    };
  }, [key, viewerId, userId]);

  return loaded.key === key ? loaded.url : null;
}
