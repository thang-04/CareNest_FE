export const resolveKitchenCampusId = (user, selectedCampusId, firstCampusId) => {
  if (user?.role === 'PRINCIPAL') return selectedCampusId || user.campusId || firstCampusId || '';
  return user?.campusId || '';
};
