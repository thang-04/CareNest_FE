import { axiosClient } from '@/services/http/axiosClient';

/*
 * PROPOSED endpoints only – the backend contract is not agreed yet (CareNest_BE owns it).
 * Same function names and arguments as the mock repository.
 */
export const educationPlanApi = {
  getAll: () => axiosClient.get('/education-plans'),
  saveGoal: (item) => axiosClient.put(`/education-plans/goals/${item.id}`, item),
  deleteGoal: (id) => axiosClient.delete(`/education-plans/goals/${id}`),
  saveTheme: (item) => axiosClient.put(`/education-plans/themes/${item.id}`, item),
  deleteTheme: (id) => axiosClient.delete(`/education-plans/themes/${id}`),
  saveLesson: (item) => axiosClient.put(`/education-plans/lessons/${item.id}`, item),
  deleteLesson: (id) => axiosClient.delete(`/education-plans/lessons/${id}`),
};
