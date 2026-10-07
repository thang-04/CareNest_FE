import { readDb, clone, delay } from './mockDatabase';

export const masterDataMockRepository = {
  async getCampuses() {
    await delay(60);
    return clone(readDb().campuses);
  },
  async getLocations() {
    await delay(60);
    return clone(readDb().locations);
  },
  async getUsers() {
    await delay(60);
    return clone(readDb().users);
  },
  async getAssetCategories() {
    await delay(60);
    return clone(readDb().categories);
  },
};
