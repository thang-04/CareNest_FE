export const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Không đọc được file'));
    reader.readAsDataURL(file);
  });

/**
 * Downscales an image so it fits in localStorage.
 * PNG keeps transparency (signatures), JPEG for photos.
 */
export const compressImage = async (file, { maxWidth = 800, maxHeight = 600, type = 'image/jpeg', quality = 0.75 } = {}) => {
  const dataUrl = await readFileAsDataUrl(file);
  const img = await new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('File không phải ảnh hợp lệ'));
    image.src = dataUrl;
  });
  const ratio = Math.min(1, maxWidth / img.width, maxHeight / img.height);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * ratio);
  canvas.height = Math.round(img.height * ratio);
  const ctx = canvas.getContext('2d');
  if (type === 'image/jpeg') {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL(type, quality);
};

export const isImageFile = (file) => /^image\/(png|jpe?g|gif|webp)$/i.test(file?.type || '');

/** Triggers a browser download of a Blob. */
export const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
