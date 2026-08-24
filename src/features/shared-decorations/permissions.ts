export interface SharedDecorationActionInput {
  canShareDecorations?: unknown;
  canTransform?: unknown;
  canRemove?: unknown;
  placementScope?: 'owned' | 'shared';
  sharedByMe?: boolean;
}

export interface SharedDecorationActionState {
  canPlace: boolean;
  canTransform: boolean;
  canRemove: boolean;
}

export function getSharedDecorationActionState(input: SharedDecorationActionInput): SharedDecorationActionState {
  return {
    canPlace: input.canShareDecorations === true,
    canTransform: input.canTransform === true,
    canRemove: input.canRemove === true,
  };
}
