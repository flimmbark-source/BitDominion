import {
  BUILDING_CONSTRUCTION_RADIUS,
  BUILDING_DEFINITIONS,
  BuildingType
} from '../config/constants';
import { Vector2 } from '../math/vector2';

export type BuildingState = 'foundation' | 'active';

let BUILDING_ID = 1;

export interface BuildingInstance {
  id: number;
  type: BuildingType;
  position: Vector2;
  state: BuildingState;
  progress: number;
  hp: number;
  dismantleProgress: number;
  repairProgress: number;
  auraMultiplier: number;
  data: Record<string, unknown>;
}

export function createBuilding(type: BuildingType, position: Vector2): BuildingInstance {
  const definition = BUILDING_DEFINITIONS[type];
  return {
    id: BUILDING_ID++,
    type,
    position: position.clone(),
    state: 'foundation',
    progress: 0,
    hp: definition.maxHp,
    dismantleProgress: 0,
    repairProgress: 0,
    auraMultiplier: 1,
    data: {}
  };
}

export function getBuildingDefinition(type: BuildingType) {
  return BUILDING_DEFINITIONS[type];
}

export function getBuildingHalfSize(type: BuildingType): { halfWidth: number; halfHeight: number } {
  const { width, height } = BUILDING_DEFINITIONS[type];
  return { halfWidth: width / 2, halfHeight: height / 2 };
}

export function isKnightWithinConstructionRange(building: BuildingInstance, knightPos: Vector2): boolean {
  return building.position.distanceTo(knightPos) <= BUILDING_CONSTRUCTION_RADIUS;
}
