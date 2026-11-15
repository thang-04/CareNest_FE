import { axiosClient } from '@/services/http/axiosClient';

/** Ảnh đại diện tài khoản trên BE (AUTH-27): tự đổi/xóa ảnh của mình, lấy link ảnh nhiều người một lần. */
export const accountPhotoApi = {
  // Bỏ Content-Type mặc định JSON để trình duyệt tự đặt multipart + boundary
  uploadMyPhoto: (file) => {
    const form = new FormData();
    form.append('file', file);
    return axiosClient.put('/accounts/me/photo', form, { headers: { 'Content-Type': undefined } });
  },
  deleteMyPhoto: () => axiosClient.delete('/accounts/me/photo'),
  findPhotoUrls: (userIds) => axiosClient.post('/accounts/photos/urls', { userIds }),
};
