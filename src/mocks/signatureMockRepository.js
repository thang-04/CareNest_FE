import { readDb, writeDb, clone, delay, ApiError } from './mockDatabase';
import { uid } from '@/utils/id';

const MAX_SIGNATURES = 5;

export const signatureMockRepository = {
  async listMine(user) {
    await delay(80);
    return clone(
      readDb()
        .signatures.filter((s) => s.userId === user.id)
        .sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || b.createdAt.localeCompare(a.createdAt)),
    );
  },

  async save(user, { imageUrl, isDefault }) {
    await delay(150);
    if (!imageUrl) throw new ApiError(422, 'Chưa có ảnh chữ ký');
    return writeDb((db) => {
      const mine = db.signatures.filter((s) => s.userId === user.id);
      if (mine.length >= MAX_SIGNATURES)
        throw new ApiError(422, `Mỗi tài khoản lưu tối đa ${MAX_SIGNATURES} chữ ký. Hãy xóa bớt chữ ký cũ.`);
      const makeDefault = isDefault || mine.length === 0;
      if (makeDefault)
        mine.forEach((s) => {
          s.isDefault = false;
        });
      const signature = { id: uid('sig'), userId: user.id, imageUrl, isDefault: makeDefault, createdAt: new Date().toISOString() };
      db.signatures.push(signature);
      return clone(signature);
    });
  },

  async setDefault(user, signatureId) {
    await delay(100);
    return writeDb((db) => {
      db.signatures
        .filter((s) => s.userId === user.id)
        .forEach((s) => {
          s.isDefault = s.id === signatureId;
        });
    });
  },

  async remove(user, signatureId) {
    await delay(100);
    return writeDb((db) => {
      const index = db.signatures.findIndex((s) => s.id === signatureId && s.userId === user.id);
      if (index < 0) throw new ApiError(404, 'Không tìm thấy chữ ký');
      const [removed] = db.signatures.splice(index, 1);
      if (removed.isDefault) {
        const next = db.signatures.find((s) => s.userId === user.id);
        if (next) next.isDefault = true;
      }
    });
  },
};
