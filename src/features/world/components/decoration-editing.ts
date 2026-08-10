import type { ChildWorldEntity } from '../contracts';

export interface DecorationDraft {
  x: number;
  z: number;
  rotationY: number;
  scale: number;
}

export function getActiveDecorationEntities(entities: ChildWorldEntity[], inventoryItemId: string): ChildWorldEntity[] {
  return entities.filter((entity) => entity.isActive && entity.entityKind === 'decoration' && entity.inventoryItemId === inventoryItemId);
}

export function toDecorationDraft(entity: Pick<ChildWorldEntity, 'x' | 'z' | 'rotationY' | 'scale'>): DecorationDraft {
  return {
    x: entity.x,
    z: entity.z,
    rotationY: entity.rotationY,
    scale: entity.scale,
  };
}

export function getWorldRevisionAfterMutation(previousRevision: number, returnedRevision?: number): number {
  return Number.isFinite(returnedRevision) && returnedRevision !== undefined
    ? returnedRevision
    : previousRevision + 1;
}
