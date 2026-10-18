export const createRosterRequestGate = (load) => {
  let generation = 0;
  return {
    async run(campusId, actor, onSuccess, onError) {
      const request = ++generation;
      try {
        const roster = await load(campusId, actor);
        if (request !== generation) return;
        if (String(roster?.campusId) !== String(campusId)) throw new Error('Dữ liệu phân công không khớp điểm trường đã chọn');
        onSuccess(roster);
      } catch (error) {
        if (request === generation) onError(error);
      }
    },
    cancel() {
      generation += 1;
    },
  };
};
