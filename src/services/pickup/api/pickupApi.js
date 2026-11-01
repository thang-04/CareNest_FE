import { axiosClient } from '@/services/http/axiosClient';

/*
 * PROPOSED endpoints only – the backend contract is not agreed yet (CareNest_BE owns it).
 * Same function names and arguments as the mock repository; the user comes from the JWT.
 */
export const pickupApi = {
  getPickupBoard: ({ classId, date }) => axiosClient.get(`/classes/${classId}/pickups`, { params: { date } }),
  getPickupChild: (childId) => axiosClient.get(`/pickups/children/${childId}`),
  recordPickupResult: (form) => axiosClient.post('/pickups', form),
  getPickupResults: ({ date }) => axiosClient.get('/pickups', { params: { date } }),
};
