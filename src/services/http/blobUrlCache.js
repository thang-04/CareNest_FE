const cache = new Map();

/**
 * Ảnh riêng tư cần token không dùng được trong `<img src>` trực tiếp: tải blob qua `load()` rồi đổi sang object URL.
 * Cache theo `key` (id chữ ký, mã tệp trên biên bản) vì nội dung ảnh không đổi theo khóa; lỗi không được cache.
 */
export const cachedBlobUrl = (key, load) => {
  if (!cache.has(key)) {
    const pending = load()
      .then((blob) => URL.createObjectURL(blob))
      .catch((err) => {
        cache.delete(key);
        throw err;
      });
    cache.set(key, pending);
  }
  return cache.get(key);
};
