import type { PetAnimationAction } from './pet-animation';

export const WORLD_INTERACTION_MAX_DISTANCE = 2.2;
export const WORLD_INTERACTION_MAX_ANGLE_RADIANS = Math.PI / 4;

export interface WorldInteractionPet {
  inventoryItemId: string;
  position: { x: number; z: number };
  availableActions: readonly PetAnimationAction[];
  active?: boolean;
}

export interface WorldInteractionTarget {
  inventoryItemId: string;
  distance: number;
  angle: number;
  availableActions: readonly PetAnimationAction[];
}

export interface FacingPetTargetInput {
  playerPosition: { x: number; z: number };
  playerFacing: { x: number; z: number };
  pets: readonly WorldInteractionPet[];
  maxDistance?: number;
  maxAngleRadians?: number;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function findFacingPetTarget({
  playerPosition,
  playerFacing,
  pets,
  maxDistance = WORLD_INTERACTION_MAX_DISTANCE,
  maxAngleRadians = WORLD_INTERACTION_MAX_ANGLE_RADIANS,
}: FacingPetTargetInput): WorldInteractionTarget | null {
  const facingLength = Math.hypot(playerFacing.x, playerFacing.z);
  if (facingLength < 0.0001) return null;

  const facing = {
    x: playerFacing.x / facingLength,
    z: playerFacing.z / facingLength,
  };

  return pets
    .filter((pet) => pet.active !== false)
    .map((pet) => {
      const offset = {
        x: pet.position.x - playerPosition.x,
        z: pet.position.z - playerPosition.z,
      };
      const distance = Math.hypot(offset.x, offset.z);
      if (distance < 0.0001) return null;
      const dot = clamp((offset.x * facing.x + offset.z * facing.z) / distance, -1, 1);
      const angle = Math.acos(dot);
      return { ...pet, distance, angle };
    })
    .filter((pet): pet is WorldInteractionPet & { distance: number; angle: number } => (
      pet !== null && pet.distance <= maxDistance && pet.angle <= maxAngleRadians
    ))
    .sort((left, right) => left.distance - right.distance || left.angle - right.angle)
    .map(({ inventoryItemId, distance, angle, availableActions }) => ({
      inventoryItemId,
      distance,
      angle,
      availableActions,
    }))[0] ?? null;
}

export function getSharedInteractionActions(
  characterActions: readonly PetAnimationAction[],
  petActions: readonly PetAnimationAction[],
): PetAnimationAction[] {
  return characterActions.filter((action) => petActions.includes(action));
}
