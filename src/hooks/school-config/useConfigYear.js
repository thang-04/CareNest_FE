import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSchoolYear } from '@/contexts/SchoolYearContext';

/**
 * Năm học của các màn Cấu hình trường = năm chọn ở header (không còn ô chọn năm riêng trên trang).
 * Link có ?year= (vd. từ màn Năm học) đổi năm ở header rồi bỏ tham số khỏi URL.
 */
export function useConfigYear() {
  const { schoolYear, setSchoolYear } = useSchoolYear();
  const [params, setParams] = useSearchParams();
  const fromUrl = params.get('year');

  useEffect(() => {
    if (!fromUrl) return;
    // Luôn gọi (kể cả trùng năm mặc định ban đầu) để header coi là năm người dùng đã chọn, không bị đổi khi tải xong danh sách năm
    setSchoolYear(fromUrl);
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('year');
        return next;
      },
      { replace: true },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromUrl]);

  return fromUrl || schoolYear;
}
