import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAsync } from '@/hooks/useAsync';
import { getAppearance } from '@/services/appearance/appearanceService';
import { DEFAULT_APPEARANCE, DEFAULT_SCENE_ID, sceneUrl } from '@/models/appearance/scenes';
import { pickEmptyScene, pickScene } from '@/utils/appearance/pickScene';

const AppearanceContext = createContext({ config: null, sceneId: DEFAULT_SCENE_ID, emptySceneUrl: () => '', reload: () => {} });

// Tính lại tranh định kỳ để tự đổi khi sang giờ đêm / sang ngày mới
const TICK_MS = 10 * 60 * 1000;

/** Cấu hình tranh nền chung của trường + tranh đang dùng; đặt biến CSS --scene-bg cho toàn app. */
export function AppearanceProvider({ children }) {
  const { user } = useAuth();
  const { data, reload } = useAsync(() => getAppearance(user), [user?.id], { refreshOnDataChange: true });
  const [now, setNow] = useState(() => new Date());
  // BE cho đọc cấu hình khi chưa đăng nhập (màn đăng nhập, quên mật khẩu). Giữ bản gần nhất khi đang tải lại (đăng nhập/đăng xuất)
  // để nền không nháy về tranh mặc định; chưa có hoặc lỗi ⇒ cấu hình mặc định
  const lastConfig = useRef(null);
  if (data) lastConfig.current = data;
  const config = data || lastConfig.current || DEFAULT_APPEARANCE;

  // Mỗi chu kỳ tính lại giờ và tải lại cấu hình để người dùng đang mở máy thấy thay đổi của Hiệu trưởng
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
      reload({ silent: true });
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [reload]);

  const sceneId = config ? pickScene(config, now) : DEFAULT_SCENE_ID;

  useEffect(() => {
    document.documentElement.style.setProperty('--scene-bg', `url('${sceneUrl(sceneId)}')`);
  }, [sceneId]);

  const value = useMemo(
    () => ({
      config,
      sceneId,
      reload,
      emptySceneUrl: (key) => sceneUrl(config ? pickEmptyScene(config, key, now) : DEFAULT_SCENE_ID),
    }),
    [config, sceneId, reload, now],
  );
  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export const useAppearance = () => useContext(AppearanceContext);
