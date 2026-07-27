export type FamilySwitchRole = 'parent' | 'child' | null;

export function canOpenFamilyPicker(input: {
  role: FamilySwitchRole;
  dataReady: boolean;
  childCount: number;
}) {
  return input.role === 'parent' && input.dataReady && input.childCount > 0;
}

export function resolveActiveChildId<T extends { id: string }>(requestedId: string | null | undefined, children: T[]) {
  if (children.length === 0) return null;
  return children.some((child) => child.id === requestedId) ? requestedId! : children[0].id;
}
