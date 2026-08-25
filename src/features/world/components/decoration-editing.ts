import type { ChildWorldEntity } from '../contracts';

export interface DecorationDraft {
  x: number;
  z: number;
  rotationY: number;
  scale: number;
}

export function radiansToDegrees(radians: number): number {
  return Number(((radians * 180) / Math.PI).toFixed(1));
}

export function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
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

export function getWorldRevisionAfterRefresh(localRevision: number, serverRevision: number): number {
  return Number.isInteger(serverRevision) && serverRevision >= 0
    ? serverRevision
    : localRevision;
}
