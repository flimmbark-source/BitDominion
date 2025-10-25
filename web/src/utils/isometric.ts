import { WIDTH, HEIGHT } from '../config/constants';
import { Vector2 } from '../math/vector2';

const ISO_ANGLE = Math.PI / 6;
const COS = Math.cos(ISO_ANGLE);
const SIN = Math.sin(ISO_ANGLE);

export interface IsoTransform {
  readonly cos: number;
  readonly sin: number;
  readonly scale: number;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly minX: number;
  readonly minY: number;
}

interface IsoBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

function computeIsoBounds(): IsoBounds {
  const corners: Vector2[] = [
    new Vector2(0, 0),
    new Vector2(WIDTH, 0),
    new Vector2(0, HEIGHT),
    new Vector2(WIDTH, HEIGHT)
  ];
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const corner of corners) {
    const isoX = COS * (corner.x - corner.y);
    const isoY = SIN * (corner.x + corner.y);
    minX = Math.min(minX, isoX);
    minY = Math.min(minY, isoY);
    maxX = Math.max(maxX, isoX);
    maxY = Math.max(maxY, isoY);
  }
  return { minX, minY, maxX, maxY };
}

const ISO_BOUNDS = computeIsoBounds();

export function createIsoTransform(viewportWidth: number, viewportHeight: number): IsoTransform {
  const isoWidth = ISO_BOUNDS.maxX - ISO_BOUNDS.minX;
  const isoHeight = ISO_BOUNDS.maxY - ISO_BOUNDS.minY;
  const scale = Math.min(viewportWidth / isoWidth, viewportHeight / isoHeight);
  const offsetX = (viewportWidth - isoWidth * scale) / 2 - ISO_BOUNDS.minX * scale;
  const offsetY = (viewportHeight - isoHeight * scale) / 2 - ISO_BOUNDS.minY * scale;
  return {
    cos: COS,
    sin: SIN,
    scale,
    offsetX,
    offsetY,
    minX: ISO_BOUNDS.minX,
    minY: ISO_BOUNDS.minY
  };
}

export function worldToScreen(x: number, y: number, transform: IsoTransform): { x: number; y: number } {
  const isoX = transform.scale * transform.cos * (x - y) + transform.offsetX;
  const isoY = transform.scale * transform.sin * (x + y) + transform.offsetY;
  return { x: isoX, y: isoY };
}

export function screenToWorld(x: number, y: number, transform: IsoTransform): { x: number; y: number } {
  const normalizedX = (x - transform.offsetX) / (transform.scale * transform.cos);
  const normalizedY = (y - transform.offsetY) / (transform.scale * transform.sin);
  const worldX = (normalizedX + normalizedY) / 2;
  const worldY = (normalizedY - normalizedX) / 2;
  return { x: worldX, y: worldY };
}

export function vectorWorldToScreen(position: Vector2, transform: IsoTransform): Vector2 {
  const projected = worldToScreen(position.x, position.y, transform);
  return new Vector2(projected.x, projected.y);
}

export function projectRadius(
  position: Vector2,
  radius: number,
  transform: IsoTransform
): { dx: number; dy: number } {
  const center = vectorWorldToScreen(position, transform);
  const top = vectorWorldToScreen(new Vector2(position.x, position.y - radius), transform);
  return { dx: center.x - top.x, dy: center.y - top.y };
}
