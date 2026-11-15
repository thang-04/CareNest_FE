import { GUARDIAN_RELATIONSHIP_LABELS } from '@/models/guardianRelationships';

export const PORTRAIT_MAX_BYTES = 2 * 1024 * 1024;
export const PORTRAIT_ACCEPT = 'image/jpeg,image/png,image/webp';

export function portraitFileError(file) {
  if (!file || file.size === 0) return 'Chọn tệp ảnh có nội dung';
  if (file.size > PORTRAIT_MAX_BYTES) return 'Ảnh tối đa 2 MB';
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return 'Chọn ảnh JPG, PNG hoặc WEBP';
  return '';
}

export function enrollmentPhotoRequest(payload) {
  const { photoFile, photoUrl: _photoUrl, ...child } = payload.child;
  const files = [];
  if (photoFile) files.push(['childPhoto', photoFile]);
  child.guardians = child.guardians.map(({ photoFile: file, photoUrl: _url, ...guardian }, i) => {
    if (file) files.push([`guardianPhoto${i}`, file]);
    const relation = Object.keys(GUARDIAN_RELATIONSHIP_LABELS).find((key) => GUARDIAN_RELATIONSHIP_LABELS[key] === guardian.relation);
    return { ...guardian, relation: relation || guardian.relation };
  });
  const clean = { ...payload, child };
  if (!files.length) return { body: clean };
  const body = new FormData();
  body.append('payload', new Blob([JSON.stringify(clean)], { type: 'application/json' }));
  for (const [key, file] of files) body.append(key, file);
  // Để trình duyệt đặt boundary của multipart, thay mặc định JSON của axiosClient.
  return { body, config: { headers: { 'Content-Type': undefined } } };
}
