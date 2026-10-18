export const getActiveMenuChild = (menu, pathname) => {
  let selected = null;
  let selectedLength = -1;

  for (const group of menu) {
    for (const child of group.children || []) {
      const matches = pathname === child.to || (child.to !== '/' && pathname.startsWith(`${child.to}/`));
      if (matches && child.to.length > selectedLength) {
        selected = { groupKey: group.key, childKey: child.key };
        selectedLength = child.to.length;
      }
    }
  }

  if (selected) return selected;
  const hasPeopleHub = menu.some((group) => group.key === 'people' && group.children?.some((child) => child.key === 'peopleHub'));
  if (
    hasPeopleHub &&
    (pathname.startsWith('/school/staff') ||
      pathname.startsWith('/school/roles') ||
      pathname === '/children' ||
      pathname.startsWith('/children/'))
  )
    return { groupKey: 'people', childKey: 'peopleHub' };
  return null;
};
