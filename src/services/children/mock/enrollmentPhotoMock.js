import { compressImage } from '@/utils/file';
import { portraitFileError } from '@/utils/children/enrollmentPhotos';
import { ApiError } from '@/mocks/mockDatabase';

/** BE giả của CHD-02: ảnh tùy chọn, chỉ lưu ảnh demo đã thu nhỏ; không ghi File vào localStorage. */
export async function prepareMockPortraits(child) {
  const candidates = [[child.photoFile, 'photo'], ...child.guardians.map((g, i) => [g.photoFile, `guardians.${i}.photo`])];
  const errors = {};
  for (const [file, field] of candidates) {
    if (file && portraitFileError(file)) errors[field] = portraitFileError(file);
  }
  if (Object.keys(errors).length) throw new ApiError(422, 'Ảnh chưa hợp lệ', errors);
  const images = [];
  for (const [file, field] of candidates) {
    try {
      images.push(file ? await compressImage(file, { maxWidth: 480, maxHeight: 480, quality: 0.8 }) : null);
    } catch {
      throw new ApiError(422, 'Ảnh chưa hợp lệ', { [field]: 'Không đọc được ảnh, hãy chọn lại tệp' });
    }
  }
  const { photoFile: _file, photoUrl: _url, ...info } = child;
  return {
    ...info,
    ...(images[0] ? { photoUrl: images[0] } : {}),
    guardians: child.guardians.map(({ photoFile: _guardianFile, photoUrl: _guardianUrl, ...guardian }, i) => ({
      ...guardian,
      ...(images[i + 1] ? { photoUrl: images[i + 1] } : {}),
    })),
  };
}
