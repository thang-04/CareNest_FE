import { AUTH_USE_MOCK } from '@/config/env';
import { accountPhotoApi } from '@/services/account/api/accountPhotoApi';
import { createPhotoUrlBatcher } from '@/utils/account/photoUrlBatcher';

/** Ảnh đại diện chỉ có khi đăng nhập thật (BE); chế độ mock hiện chữ cái đầu, ẩn nút đổi ảnh. */
export const ACCOUNT_PHOTO_ENABLED = !AUTH_USE_MOCK;

export const ACCOUNT_PHOTO_CHANGED_EVENT = 'carenest:account-photo-changed';

// Quyền xem ảnh phụ thuộc người đang đăng nhập (AUTH-27) ⇒ đổi người đăng nhập thì bỏ cache cũ
let current = { viewerId: null, batcher: null };

function batcherFor(viewerId) {
  if (current.viewerId !== viewerId || !current.batcher) {
    current = { viewerId, batcher: createPhotoUrlBatcher({ fetchUrls: (ids) => accountPhotoApi.findPhotoUrls(ids) }) };
  }
  return current.batcher;
}

/** Link ảnh của `userId` mà người đang xem (`viewerId`) được phép thấy; null nếu không có. */
export function getAccountPhotoUrl(viewerId, userId) {
  if (!ACCOUNT_PHOTO_ENABLED || viewerId == null || userId == null) return Promise.resolve(null);
  return batcherFor(viewerId).get(userId);
}

function announceChange(userId) {
  current.batcher?.invalidate(userId);
  window.dispatchEvent(new CustomEvent(ACCOUNT_PHOTO_CHANGED_EVENT, { detail: { userId } }));
}

export async function uploadMyPhoto(userId, file) {
  const result = await accountPhotoApi.uploadMyPhoto(file);
  announceChange(userId);
  return result;
}

export async function deleteMyPhoto(userId) {
  const result = await accountPhotoApi.deleteMyPhoto();
  announceChange(userId);
  return result;
}
