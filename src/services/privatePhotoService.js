import { axiosClient } from '@/services/http/axiosClient';

export function fetchChildPhoto(url, signal) {
  if (!/^\/children\/\d+\/(?:photo|guardian-photos\/\d+|guardians\/\d+\/photo)$/.test(url)) {
    return Promise.reject(new Error('Đường dẫn ảnh không hợp lệ'));
  }
  return axiosClient.get(url, { responseType: 'blob', signal });
}
