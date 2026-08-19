export interface CreateChildAccountInput {
  name: string;
  loginName: string;
  password: string;
  gender: 'boy' | 'girl';
  characterId: string;
}

export const buildCreateChildAccountPayload = (
  familyId: string,
  child: CreateChildAccountInput,
) => ({
  action: 'create' as const,
  familyId,
  childName: child.name,
  loginName: child.loginName,
  password: child.password,
  gender: child.gender,
  characterId: child.characterId,
});
