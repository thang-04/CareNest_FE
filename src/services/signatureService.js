import { sourceOf } from '@/services/demoSource';
import { axiosClient } from '@/services/http/axiosClient';
import { cachedBlobUrl } from '@/services/http/blobUrlCache';
import { signatureMockRepository } from '@/mocks/signatureMockRepository';
import { dataUrlToBlob } from '@/utils/file';

const withImage = async (signature) => ({
  ...signature,
  imageUrl: await cachedBlobUrl(`signature:${signature.id}`, () =>
    axiosClient.get(`/signatures/me/${signature.id}/content`, { responseType: 'blob' }),
  ),
});

/**
 * Chữ ký đã lưu của tài khoản hiện tại (dùng chung mọi module cần ký). BE trả `{ id, isDefault, contentType, sizeBytes,
 * createdAt }` không kèm ảnh; adapter tải ảnh qua API có token rồi gắn `imageUrl` để khớp shape mock.
 */
const api = {
  listMine: async () => Promise.all((await axiosClient.get('/signatures/me')).map(withImage)),
  save: async (_user, { imageUrl, isDefault }) => {
    const blob = dataUrlToBlob(imageUrl);
    const form = new FormData();
    form.append('file', blob, blob?.type === 'image/jpeg' ? 'signature.jpg' : 'signature.png');
    form.append('isDefault', String(!!isDefault));
    return withImage(await axiosClient.post('/signatures/me', form));
  },
  setDefault: (_user, id) => axiosClient.patch(`/signatures/me/${id}/default`),
  remove: (_user, id) => axiosClient.delete(`/signatures/me/${id}`),
};

const repo = sourceOf('signatures', signatureMockRepository, api);

export const getMySignatures = (user) => repo.listMine(user);
export const saveSignature = (user, body) => repo.save(user, body);
export const setDefaultSignature = (user, id) => repo.setDefault(user, id);
export const deleteSignature = (user, id) => repo.remove(user, id);
