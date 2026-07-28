export interface ChildDeletionTarget {
  family_id: string;
  profile_id: string | null;
}

export interface AccountDeletionTargets {
  familyIds: string[];
  childProfileIds: string[];
  parentProfileId: string;
}

export function getAccountDeletionTargets(parentProfileId: string, children: ChildDeletionTarget[]): AccountDeletionTargets {
  return {
    familyIds: [...new Set(children.map((child) => child.family_id))],
    childProfileIds: [...new Set(children.map((child) => child.profile_id).filter((id): id is string => Boolean(id)))],
    parentProfileId,
  };
}
