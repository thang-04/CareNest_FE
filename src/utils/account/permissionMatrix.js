export const PERMISSION_MATRIX_ROLES = ['VICE_PRINCIPAL', 'TEACHER'];

export const permissionMatrixRows = (catalog = [], roles = []) =>
  catalog.map((permission) => {
    const cells = Object.fromEntries(
      PERMISSION_MATRIX_ROLES.map((role) => {
        const entry = roles.find((item) => item.role === role);
        return [
          role,
          {
            configurable:
              !!entry?.editable &&
              entry.configurablePermissions.includes(permission.code) &&
              (permission.configurableRoles || []).includes(role),
            checked: !!entry?.permissions.includes(permission.code),
          },
        ];
      }),
    );
    return { ...permission, cells };
  });
