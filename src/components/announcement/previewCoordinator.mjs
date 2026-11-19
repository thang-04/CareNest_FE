export function createPreviewCoordinator(fetchPreview) {
  let sequence = 0;
  let controller;
  return {
    invalidate() {
      sequence += 1;
      controller?.abort();
    },
    async run(target) {
      const current = ++sequence;
      controller?.abort();
      controller = new AbortController();
      try {
        const result = await fetchPreview(target, { signal: controller.signal });
        return current === sequence ? result : null;
      } catch (error) {
        if (current !== sequence || error.code === 'ERR_CANCELED') return null;
        throw error;
      }
    },
  };
}
