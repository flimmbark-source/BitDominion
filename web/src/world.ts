import {
  ARENA_PADDING,
  CHEST_CLOSED_COLOR,
  CHEST_OPEN_COLOR,
  CHEST_OPEN_RADIUS,
  CASTLE_POS,
  CASTLE_WIN_RADIUS,
  HEIGHT,
  HUT_FILL_COLOR,
  HUT_OUTLINE_COLOR,
  HUT_STEER_STRENGTH,
  LOS_DEBUG_TTL,
  NOISE_CHEST_STRENGTH,
  NOISE_VILLAGER_ALARM_STRENGTH,
  TREE_COLOR,
  TREE_OUTLINE_COLOR,
  TREE_STEER_STRENGTH,
  VILLAGE_ALERT_RADIUS,
  VILLAGE_FLEE_RADIUS,
  VILLAGE_RADIUS,
  VILLAGER_ALERT_COLOR,
  VILLAGER_FLEE_COLOR,
  VILLAGER_IDLE_COLOR,
  VILLAGER_HP,
  VILLAGER_IDLE_RADIUS,
  VILLAGER_SPEED,
  WIDTH
} from './config/constants';
import { Vector2 } from './math/vector2';

import type { DarkUnit } from './entities/darkUnit';
import type { Knight } from './entities/knight';

export interface Tree {
  position: Vector2;
  radius: number;
}

export interface Hut {
  center: Vector2;
  width: number;
  height: number;
}

export interface Chest {
  position: Vector2;
  opened: boolean;
}

type VillagerState = 'idle' | 'alert' | 'flee';

export interface Villager {
  pos: Vector2;
  home: Vector2;
  state: VillagerState;
  timer: number;
  wanderTarget: Vector2 | null;
  wanderTimer: number;
  panicTarget: Vector2 | null;
  hp: number;
  alive: boolean;
  hurtTimer: number;
}

export interface Village {
  center: Vector2;
  huts: Hut[];
  chests: Chest[];
  villagers: Villager[];
  alarmed: boolean;
  canopyRadius: number;
}

interface LosSegment {
  from: Vector2;
  to: Vector2;
  blocked: boolean;
  ttl: number;
}

export interface TerrainEntity {
  pos: Vector2;
  velocity: Vector2;
}

export interface WorldUpdateContext {
  knight: Knight;
  monsters: readonly DarkUnit[];
  emitNoise: (position: Vector2, strength: number) => void;
}

const VILLAGER_ALERT_DURATION = 1.8;
const VILLAGER_FLEE_DURATION = 2.6;
const VILLAGER_HURT_FLASH = 0.25;

function mulberry32(seed: number): () => number {
  return function random() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export class World {
  public readonly trees: Tree[] = [];
  public readonly villages: Village[] = [];

  private readonly huts: Hut[] = [];
  private readonly losSegments: LosSegment[] = [];
  private canopyEnabled = true;

  constructor() {
    const rand = mulberry32(0x5123abcd);
    this.buildVillages(rand);
    this.buildForests(rand);
  }

  beginFrame(dt: number): void {
    for (const segment of this.losSegments) {
      segment.ttl = Math.max(0, segment.ttl - dt);
    }
    for (let i = this.losSegments.length - 1; i >= 0; i--) {
      if (this.losSegments[i].ttl <= 0) {
        this.losSegments.splice(i, 1);
      }
    }
  }

  update(dt: number, context: WorldUpdateContext): void {
    this.updateVillages(dt, context);
    this.updateChests(context);
  }

  toggleCanopy(): void {
    this.canopyEnabled = !this.canopyEnabled;
  }

  isCanopyVisible(): boolean {
    return this.canopyEnabled;
  }

  isAnyVillageAlarmed(): boolean {
    return this.villages.some((village) => village.alarmed);
  }

  getAlarmedVillage(): Village | null {
    for (const village of this.villages) {
      if (village.alarmed) {
        return village;
      }
    }
    return null;
  }

  applyTerrainSteering(entity: TerrainEntity, radius: number, dt: number): void {
    const steer = new Vector2();
    for (const tree of this.trees) {
      const push = this.computeTreePush(entity.pos, tree, radius);
      if (push) {
        steer.add(push);
      }
    }
    for (const hut of this.huts) {
      const push = this.computeHutPush(entity.pos, hut, radius);
      if (push) {
        steer.add(push);
      }
    }
    if (steer.lengthSq() > 0) {
      const force = Math.min(1.2, dt * 60) * 0.6;
      entity.velocity.add(steer.scale(force));
    }
  }

  resolveStaticCollisions(position: Vector2, radius: number): void {
    for (const tree of this.trees) {
      const minDistance = tree.radius + radius;
      const toEntity = position.clone().subtract(tree.position);
      const distanceSq = toEntity.lengthSq();
      if (distanceSq === 0) {
        const randomAngle = Math.random() * Math.PI * 2;
        position.add(new Vector2(Math.cos(randomAngle), Math.sin(randomAngle)).scale(minDistance * 0.2));
        continue;
      }
      if (distanceSq < minDistance * minDistance) {
        const distance = Math.sqrt(distanceSq);
        toEntity.scale(1 / distance);
        const correction = minDistance - distance;
        position.add(toEntity.scale(correction + 0.1));
      }
    }

    for (const hut of this.huts) {
      const correction = this.computeHutCorrection(position, hut, radius);
      if (correction) {
        position.add(correction);
      }
    }

    const minX = radius;
    const minY = radius;
    const maxX = WIDTH - radius;
    const maxY = HEIGHT - radius;
    position.clamp(minX, minY, maxX, maxY);
  }

  constrainToArena(entity: TerrainEntity, radius: number, options?: { bounce?: boolean }): void {
    const { bounce = false } = options ?? {};
    const minX = radius;
    const minY = radius;
    const maxX = WIDTH - radius;
    const maxY = HEIGHT - radius;

    if (entity.pos.x < minX) {
      entity.pos.x = minX;
      if (bounce) {
        entity.velocity.x = Math.abs(entity.velocity.x) * 0.7;
      } else {
        entity.velocity.x = 0;
      }
    } else if (entity.pos.x > maxX) {
      entity.pos.x = maxX;
      if (bounce) {
        entity.velocity.x = -Math.abs(entity.velocity.x) * 0.7;
      } else {
        entity.velocity.x = 0;
      }
    }

    if (entity.pos.y < minY) {
      entity.pos.y = minY;
      if (bounce) {
        entity.velocity.y = Math.abs(entity.velocity.y) * 0.7;
      } else {
        entity.velocity.y = 0;
      }
    } else if (entity.pos.y > maxY) {
      entity.pos.y = maxY;
      if (bounce) {
        entity.velocity.y = -Math.abs(entity.velocity.y) * 0.7;
      } else {
        entity.velocity.y = 0;
      }
    }
  }

  hasLineOfSight(from: Vector2, to: Vector2): boolean {
    const segment: LosSegment = { from: from.clone(), to: to.clone(), blocked: false, ttl: LOS_DEBUG_TTL };
    const delta = to.clone().subtract(from);
    const distance = delta.length();
    if (distance === 0) {
      this.losSegments.push(segment);
      return true;
    }

    const direction = delta.scale(1 / distance);
    const hitDistance = this.castVisionRay(from, direction, distance);
    const blocked = hitDistance + 0.001 < distance;
    segment.blocked = blocked;
    this.losSegments.push(segment);
    return !blocked;
  }

  computeVisibilityPolygon(origin: Vector2, radius: number): Vector2[] {
    if (radius <= 0) {
      return [];
    }

    const baseRayCount = 160;
    const epsilon = 0.0006;
    const twoPi = Math.PI * 2;
    const rawAngles: number[] = [];

    const addAngle = (angle: number) => {
      let normalized = angle % twoPi;
      if (normalized < 0) {
        normalized += twoPi;
      }
      rawAngles.push(normalized);
    };

    for (let i = 0; i < baseRayCount; i++) {
      addAngle((i / baseRayCount) * twoPi);
    }

    for (const tree of this.trees) {
      const dx = tree.position.x - origin.x;
      const dy = tree.position.y - origin.y;
      const distance = Math.hypot(dx, dy);
      if (distance === 0) {
        continue;
      }

      const angle = Math.atan2(dy, dx);
      addAngle(angle);
      addAngle(angle - epsilon);
      addAngle(angle + epsilon);

      if (distance > tree.radius) {
        const clamped = Math.min(0.9999, tree.radius / distance);
        const spread = Math.asin(clamped);
        addAngle(angle - spread);
        addAngle(angle + spread);
      }
    }

    for (const hut of this.huts) {
      const halfW = hut.width / 2;
      const halfH = hut.height / 2;
      const corners = [
        { x: hut.center.x - halfW, y: hut.center.y - halfH },
        { x: hut.center.x + halfW, y: hut.center.y - halfH },
        { x: hut.center.x + halfW, y: hut.center.y + halfH },
        { x: hut.center.x - halfW, y: hut.center.y + halfH }
      ];
      for (const corner of corners) {
        const angle = Math.atan2(corner.y - origin.y, corner.x - origin.x);
        addAngle(angle);
        addAngle(angle - epsilon);
        addAngle(angle + epsilon);
      }

      const edges = [
        { x: hut.center.x - halfW, y: hut.center.y },
        { x: hut.center.x + halfW, y: hut.center.y },
        { x: hut.center.x, y: hut.center.y - halfH },
        { x: hut.center.x, y: hut.center.y + halfH }
      ];
      for (const edge of edges) {
        const angle = Math.atan2(edge.y - origin.y, edge.x - origin.x);
        addAngle(angle - epsilon * 2);
        addAngle(angle + epsilon * 2);
      }
    }

    rawAngles.sort((a, b) => a - b);

    const angles: number[] = [];
    const minSeparation = 0.0001;
    for (const angle of rawAngles) {
      if (!angles.length || angle - angles[angles.length - 1] > minSeparation) {
        angles.push(angle);
      }
    }

    const polygon: Vector2[] = [];
    for (const angle of angles) {
      const dir = new Vector2(Math.cos(angle), Math.sin(angle));
      let distance = this.castVisionRay(origin, dir, radius);
      const boundaryDistance = this.rayAabbDistance(origin, dir, 0, 0, WIDTH, HEIGHT);
      if (boundaryDistance != null) {
        distance = Math.min(distance, boundaryDistance);
      }
      distance = Math.min(distance, radius);
      const finalDistance = Math.max(0, distance - 0.01);
      polygon.push(new Vector2(origin.x + dir.x * finalDistance, origin.y + dir.y * finalDistance));
    }

    return polygon;
  }

  getLosSegments(): readonly LosSegment[] {
    return this.losSegments;
  }

  private castVisionRay(origin: Vector2, direction: Vector2, maxDistance: number): number {
    let closest = maxDistance;
    for (const tree of this.trees) {
      const distance = this.rayCircleDistance(origin, direction, tree.position, tree.radius);
      if (distance != null && distance >= 0 && distance < closest) {
        closest = distance;
      }
    }

    for (const hut of this.huts) {
      const distance = this.rayRectDistance(origin, direction, hut);
      if (distance != null && distance >= 0 && distance < closest) {
        closest = distance;
      }
    }

    return closest;
  }

  private rayCircleDistance(
    origin: Vector2,
    direction: Vector2,
    center: Vector2,
    radius: number
  ): number | null {
    const ox = origin.x - center.x;
    const oy = origin.y - center.y;
    const dx = direction.x;
    const dy = direction.y;
    const b = 2 * (dx * ox + dy * oy);
    const c = ox * ox + oy * oy - radius * radius;
    const discriminant = b * b - 4 * c;
    if (discriminant < 0) {
      return null;
    }
    const sqrt = Math.sqrt(discriminant);
    const t1 = (-b - sqrt) / 2;
    const t2 = (-b + sqrt) / 2;
    if (t2 < 0) {
      return null;
    }
    if (t1 >= 0) {
      return t1;
    }
    return t2;
  }

  private rayRectDistance(origin: Vector2, direction: Vector2, hut: Hut): number | null {
    const halfW = hut.width / 2;
    const halfH = hut.height / 2;
    const minX = hut.center.x - halfW;
    const maxX = hut.center.x + halfW;
    const minY = hut.center.y - halfH;
    const maxY = hut.center.y + halfH;
    return this.rayAabbDistance(origin, direction, minX, minY, maxX, maxY);
  }

  private rayAabbDistance(
    origin: Vector2,
    direction: Vector2,
    minX: number,
    minY: number,
    maxX: number,
    maxY: number
  ): number | null {
    const epsilon = 1e-8;
    let tMin = 0;
    let tMax = Number.POSITIVE_INFINITY;

    if (Math.abs(direction.x) < epsilon) {
      if (origin.x < minX || origin.x > maxX) {
        return null;
      }
    } else {
      let tx1 = (minX - origin.x) / direction.x;
      let tx2 = (maxX - origin.x) / direction.x;
      if (tx1 > tx2) {
        [tx1, tx2] = [tx2, tx1];
      }
      tMin = Math.max(tMin, tx1);
      tMax = Math.min(tMax, tx2);
    }

    if (Math.abs(direction.y) < epsilon) {
      if (origin.y < minY || origin.y > maxY) {
        return null;
      }
    } else {
      let ty1 = (minY - origin.y) / direction.y;
      let ty2 = (maxY - origin.y) / direction.y;
      if (ty1 > ty2) {
        [ty1, ty2] = [ty2, ty1];
      }
      tMin = Math.max(tMin, ty1);
      tMax = Math.min(tMax, ty2);
    }

    if (tMax < tMin) {
      return null;
    }

    if (tMax < 0) {
      return null;
    }

    if (tMin >= 0) {
      return tMin;
    }

    return tMax >= 0 ? tMax : null;
  }

  isPointOnRoad(_point: Vector2): boolean {
    return false;
  }

  drawTerrain(ctx: CanvasRenderingContext2D): void {
    this.drawHuts(ctx);
    this.drawChests(ctx);
    this.drawTrees(ctx);
    this.drawVillagers(ctx);
  }

  drawCanopy(_ctx: CanvasRenderingContext2D): void {
    // Canopy rendering has been disabled to remove the green overlay.
  }

  drawDebug(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.strokeStyle = TREE_OUTLINE_COLOR;
    ctx.lineWidth = 1;
    for (const tree of this.trees) {
      ctx.beginPath();
      ctx.arc(tree.position.x, tree.position.y, tree.radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.strokeStyle = HUT_OUTLINE_COLOR;
    for (const hut of this.huts) {
      const halfW = hut.width / 2;
      const halfH = hut.height / 2;
      ctx.strokeRect(hut.center.x - halfW, hut.center.y - halfH, hut.width, hut.height);
    }

    ctx.fillStyle = '#FF5555';
    for (const village of this.villages) {
      ctx.beginPath();
      ctx.arc(village.center.x, village.center.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 1;
    for (const segment of this.losSegments) {
      ctx.beginPath();
      ctx.moveTo(segment.from.x, segment.from.y);
      ctx.lineTo(segment.to.x, segment.to.y);
      ctx.strokeStyle = segment.blocked ? 'rgba(255, 120, 120, 0.9)' : 'rgba(120, 200, 255, 0.8)';
      ctx.stroke();
    }
    ctx.restore();
  }

  private buildForests(rand: () => number): void {
    const columns = 11;
    const rows = 11;
    const cellWidth = (WIDTH - ARENA_PADDING * 2) / columns;
    const cellHeight = (HEIGHT - ARENA_PADDING * 2) / rows;
    const treePadding = 4.5;
    const castleClearRadius = CASTLE_WIN_RADIUS + 35;

    const denseZones = Array.from({ length: 7 }, () => ({
      center: new Vector2(
        ARENA_PADDING + rand() * (WIDTH - ARENA_PADDING * 2),
        ARENA_PADDING + rand() * (HEIGHT - ARENA_PADDING * 2)
      ),
      radius: 140 + rand() * 90,
      strength: 0.6 + rand() * 0.35
    }));

    const sparseZones = Array.from({ length: 4 }, () => ({
      center: new Vector2(
        ARENA_PADDING + rand() * (WIDTH - ARENA_PADDING * 2),
        ARENA_PADDING + rand() * (HEIGHT - ARENA_PADDING * 2)
      ),
      radius: 160 + rand() * 110,
      strength: 0.5 + rand() * 0.25
    }));

    const computeZoneInfluence = (point: Vector2, zones: typeof denseZones, invert = false): number => {
      let influence = 0;
      for (const zone of zones) {
        const distance = point.distanceTo(zone.center);
        if (distance >= zone.radius) {
          continue;
        }
        const falloff = 1 - distance / zone.radius;
        influence += falloff * zone.strength * (invert ? -1 : 1);
      }
      return influence;
    };

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        const cellCenterX = ARENA_PADDING + cellWidth * (col + 0.5);
        const cellCenterY = ARENA_PADDING + cellHeight * (row + 0.5);
        const cellCenter = new Vector2(cellCenterX, cellCenterY);

        let densityScore = rand() * 0.26;
        densityScore += computeZoneInfluence(cellCenter, denseZones);
        densityScore += computeZoneInfluence(cellCenter, sparseZones, true);
        densityScore = clamp(densityScore, 0, 1);

        let treeCount = 0;
        if (densityScore > 0.08) {
          treeCount = 1;
          if (densityScore > 0.25) {
            treeCount++;
          }
          if (densityScore > 0.45) {
            treeCount++;
          }
          if (densityScore > 0.65) {
            treeCount++;
          }
          if (densityScore > 0.82) {
            treeCount++;
          }
        }

        if (treeCount === 0) {
          continue;
        }

        const localPadding = treePadding * (1.05 - densityScore * 0.45);

        for (let i = 0; i < treeCount; i++) {
          let attempts = 14;
          while (attempts-- > 0) {
            const offset = new Vector2((rand() - 0.5) * cellWidth * 0.95, (rand() - 0.5) * cellHeight * 0.95);
            const position = cellCenter.clone().add(offset);
            position.x = clamp(position.x, ARENA_PADDING, WIDTH - ARENA_PADDING);
            position.y = clamp(position.y, ARENA_PADDING, HEIGHT - ARENA_PADDING);
            const treeRadius = 12 + rand() * 8;

            if (this.canPlaceTree(position, treeRadius, Math.max(2, localPadding), castleClearRadius)) {
              this.trees.push({ position, radius: treeRadius });
              break;
            }
          }
        }
      }
    }

    const scatterAttempts = Math.round(columns * rows * 1.4);
    for (let i = 0; i < scatterAttempts; i++) {
      const position = new Vector2(
        ARENA_PADDING + rand() * (WIDTH - ARENA_PADDING * 2),
        ARENA_PADDING + rand() * (HEIGHT - ARENA_PADDING * 2)
      );
      const scatterRadius = 10 + rand() * 8;
      const scatterPadding = treePadding * 0.75;
      if (this.canPlaceTree(position, scatterRadius, Math.max(2, scatterPadding), castleClearRadius)) {
        this.trees.push({ position, radius: scatterRadius });
      }
    }
  }

  private canPlaceTree(position: Vector2, radius: number, padding: number, castleClearRadius: number): boolean {
    if (position.distanceTo(CASTLE_POS) < castleClearRadius + radius) {
      return false;
    }

    for (const village of this.villages) {
      const minVillageDistance = village.canopyRadius + radius + padding;
      if (position.distanceTo(village.center) < minVillageDistance) {
        return false;
      }
    }

    for (const hut of this.huts) {
      const halfW = hut.width / 2 + radius + padding;
      const halfH = hut.height / 2 + radius + padding;
      if (Math.abs(position.x - hut.center.x) <= halfW && Math.abs(position.y - hut.center.y) <= halfH) {
        return false;
      }
    }

    for (const tree of this.trees) {
      const minDistance = tree.radius + radius + padding;
      if (position.distanceTo(tree.position) < minDistance) {
        return false;
      }
    }

    return true;
  }

  private buildVillages(rand: () => number): void {
    const templates: Array<{ center: Vector2; hutOffsets: Vector2[]; chestOffsets: Vector2[]; villagers: number }> = [
      {
        center: new Vector2(210, 520),
        hutOffsets: [
          new Vector2(-26, -12),
          new Vector2(22, -14),
          new Vector2(-20, 18),
          new Vector2(28, 20),
          new Vector2(0, 30)
        ],
        chestOffsets: [new Vector2(-8, 0), new Vector2(20, -32)],
        villagers: 5
      },
      {
        center: new Vector2(590, 340),
        hutOffsets: [
          new Vector2(-28, -18),
          new Vector2(24, -12),
          new Vector2(-22, 20),
          new Vector2(18, 24),
          new Vector2(0, 32)
        ],
        chestOffsets: [new Vector2(-18, 6), new Vector2(24, -24)],
        villagers: 4
      }
    ];

    for (const template of templates) {
      const huts: Hut[] = [];
      for (const offset of template.hutOffsets) {
        const hutCenter = template.center.clone().add(offset);
        const width = 18 + rand() * 6;
        const height = 16 + rand() * 6;
        huts.push({ center: hutCenter, width, height });
        this.huts.push({ center: hutCenter.clone(), width, height });
      }

      const chests: Chest[] = template.chestOffsets.map((offset) => ({
        position: template.center.clone().add(offset),
        opened: false
      }));

      const villagers: Villager[] = [];
      for (let i = 0; i < template.villagers; i++) {
        const hut = huts[i % huts.length];
        const jitter = new Vector2((rand() - 0.5) * 10, (rand() - 0.5) * 10);
        const spawn = hut.center.clone().add(jitter);
        villagers.push({
          pos: spawn,
          home: hut.center.clone(),
          state: 'idle',
          timer: 0,
          wanderTarget: null,
          wanderTimer: 0,
          panicTarget: null,
          hp: VILLAGER_HP,
          alive: true,
          hurtTimer: 0
        });
      }

      const village: Village = {
        center: template.center.clone(),
        huts,
        chests,
        villagers,
        alarmed: false,
        canopyRadius: VILLAGE_RADIUS
      };
      this.villages.push(village);
    }
  }

  private updateVillages(dt: number, context: WorldUpdateContext): void {
    const knightPos = context.knight.pos;
    for (const village of this.villages) {
      const knightNear = knightPos.distanceTo(village.center) <= VILLAGE_ALERT_RADIUS;
      let nearestMonster: DarkUnit | null = null;
      let nearestMonsterDist = Number.POSITIVE_INFINITY;
      for (const monster of context.monsters) {
        if (!monster.alive) {
          continue;
        }
        const distance = monster.pos.distanceTo(village.center);
        if (distance <= VILLAGE_FLEE_RADIUS && distance < nearestMonsterDist) {
          nearestMonster = monster;
          nearestMonsterDist = distance;
        }
      }

      let villageAlarmed = false;
      for (const villager of village.villagers) {
        if (villager.hurtTimer > 0) {
          villager.hurtTimer = Math.max(0, villager.hurtTimer - dt);
        }
        if (!villager.alive) {
          continue;
        }
        const previousState = villager.state;
        if (nearestMonster) {
          villager.state = 'flee';
          villager.timer = VILLAGER_FLEE_DURATION;
          villager.panicTarget = nearestMonster.pos.clone();
        } else if (knightNear) {
          villager.state = 'alert';
          villager.timer = VILLAGER_ALERT_DURATION;
          villager.panicTarget = knightPos.clone();
        } else if (villager.timer > 0) {
          villager.timer = Math.max(0, villager.timer - dt);
          if (villager.timer === 0) {
            villager.state = 'idle';
            villager.panicTarget = null;
          }
        } else {
          villager.state = 'idle';
          villager.panicTarget = null;
        }

        const enteringFlee = villager.state === 'flee' && previousState !== 'flee';
        if (enteringFlee) {
          context.emitNoise(villager.pos, NOISE_VILLAGER_ALARM_STRENGTH);
        }

        if (villager.state !== 'idle') {
          villageAlarmed = true;
        }

        this.updateVillagerMovement(villager, dt, village, nearestMonster, knightPos);
      }

      village.alarmed = villageAlarmed;
    }
  }

  private updateChests(context: WorldUpdateContext): void {
    const knightPos = context.knight.pos;
    for (const village of this.villages) {
      for (const chest of village.chests) {
        if (!chest.opened && chest.position.distanceTo(knightPos) <= CHEST_OPEN_RADIUS) {
          chest.opened = true;
          context.emitNoise(chest.position, NOISE_CHEST_STRENGTH);
        }
      }
    }
  }

  private updateVillagerMovement(
    villager: Villager,
    dt: number,
    village: Village,
    monster: DarkUnit | null,
    knightPos: Vector2
  ): void {
    if (!villager.alive) {
      return;
    }
    const speed = VILLAGER_SPEED * dt;
    switch (villager.state) {
      case 'idle':
        this.updateIdleVillager(villager, dt, speed);
        break;
      case 'alert': {
        const target = village.center.clone().add(knightPos.clone().subtract(village.center).scale(0.25));
        const direction = target.subtract(villager.pos);
        if (direction.lengthSq() > 1) {
          direction.normalize().scale(speed * 0.8);
          villager.pos.add(direction);
        }
        break;
      }
      case 'flee': {
        const threat = monster?.pos ?? villager.panicTarget ?? knightPos;
        const direction = villager.pos.clone().subtract(threat);
        if (direction.lengthSq() === 0) {
          direction.set(Math.random() - 0.5, Math.random() - 0.5);
        }
        direction.normalize().scale(speed * 1.4);
        villager.pos.add(direction);
        break;
      }
    }

    const offset = villager.pos.clone().subtract(village.center);
    const distance = offset.length();
    if (distance > VILLAGE_RADIUS - 6) {
      offset.normalize().scale(VILLAGE_RADIUS - 6);
      villager.pos.copy(village.center.clone().add(offset));
    }
    this.resolveStaticCollisions(villager.pos, 3);
  }

  private updateIdleVillager(villager: Villager, dt: number, speed: number): void {
    villager.wanderTimer -= dt;
    if (!villager.wanderTarget || villager.wanderTimer <= 0) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * VILLAGER_IDLE_RADIUS;
      villager.wanderTarget = villager.home.clone().add(new Vector2(Math.cos(angle), Math.sin(angle)).scale(radius));
      villager.wanderTimer = 1.2 + Math.random() * 1.5;
    }
    const target = villager.wanderTarget;
    if (target) {
      const direction = target.clone().subtract(villager.pos);
      if (direction.lengthSq() < 9) {
        villager.wanderTarget = null;
      } else {
        direction.normalize().scale(speed * 0.5);
        villager.pos.add(direction);
      }
    }
  }

  private computeTreePush(position: Vector2, tree: Tree, radius: number): Vector2 | null {
    const minDistance = tree.radius + radius;
    const toEntity = position.clone().subtract(tree.position);
    const distanceSq = toEntity.lengthSq();
    if (distanceSq === 0) {
      return new Vector2((Math.random() - 0.5) * TREE_STEER_STRENGTH, (Math.random() - 0.5) * TREE_STEER_STRENGTH);
    }
    if (distanceSq >= minDistance * minDistance) {
      return null;
    }
    const distance = Math.sqrt(distanceSq);
    const strength = (minDistance - distance) / minDistance;
    return toEntity
      .scale(1 / distance)
      .scale(strength * TREE_STEER_STRENGTH);
  }

  private computeHutPush(position: Vector2, hut: Hut, radius: number): Vector2 | null {
    const halfW = hut.width / 2 + radius;
    const halfH = hut.height / 2 + radius;
    const dx = position.x - hut.center.x;
    const dy = position.y - hut.center.y;
    if (Math.abs(dx) > halfW || Math.abs(dy) > halfH) {
      return null;
    }
    const overlapX = halfW - Math.abs(dx);
    const overlapY = halfH - Math.abs(dy);
    if (overlapX < overlapY) {
      const dir = dx >= 0 ? 1 : -1;
      return new Vector2(dir * (overlapX / radius) * HUT_STEER_STRENGTH, 0);
    }
    const dir = dy >= 0 ? 1 : -1;
    return new Vector2(0, dir * (overlapY / radius) * HUT_STEER_STRENGTH);
  }

  private computeHutCorrection(position: Vector2, hut: Hut, radius: number): Vector2 | null {
    const halfW = hut.width / 2 + radius;
    const halfH = hut.height / 2 + radius;
    const dx = position.x - hut.center.x;
    const dy = position.y - hut.center.y;
    if (Math.abs(dx) > halfW || Math.abs(dy) > halfH) {
      return null;
    }
    const overlapX = halfW - Math.abs(dx);
    const overlapY = halfH - Math.abs(dy);
    if (overlapX < overlapY) {
      const dir = dx >= 0 ? 1 : -1;
      return new Vector2(dir * overlapX, 0);
    }
    const dir = dy >= 0 ? 1 : -1;
    return new Vector2(0, dir * overlapY);
  }

  private drawHuts(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.fillStyle = HUT_FILL_COLOR;
    for (const hut of this.huts) {
      ctx.fillRect(hut.center.x - hut.width / 2, hut.center.y - hut.height / 2, hut.width, hut.height);
    }
    ctx.restore();
  }

  private drawChests(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    for (const village of this.villages) {
      for (const chest of village.chests) {
        ctx.fillStyle = chest.opened ? CHEST_OPEN_COLOR : CHEST_CLOSED_COLOR;
        ctx.fillRect(chest.position.x - 4, chest.position.y - 3, 8, 6);
      }
    }
    ctx.restore();
  }

  private drawTrees(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.fillStyle = TREE_COLOR;
    for (const tree of this.trees) {
      ctx.beginPath();
      ctx.arc(tree.position.x, tree.position.y, tree.radius * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawVillagers(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    for (const village of this.villages) {
      for (const villager of village.villagers) {
        if (!villager.alive) {
          continue;
        }
        switch (villager.state) {
          case 'alert':
            ctx.fillStyle = VILLAGER_ALERT_COLOR;
            break;
          case 'flee':
            ctx.fillStyle = VILLAGER_FLEE_COLOR;
            break;
          default:
            ctx.fillStyle = VILLAGER_IDLE_COLOR;
            break;
        }
        ctx.fillRect(villager.pos.x - 2, villager.pos.y - 2, 4, 4);
        if (villager.hurtTimer > 0) {
          const ratio = Math.min(1, villager.hurtTimer / VILLAGER_HURT_FLASH);
          ctx.globalAlpha = 0.6 * ratio;
          ctx.strokeStyle = '#FF5C5C';
          ctx.lineWidth = 1;
          ctx.strokeRect(villager.pos.x - 3, villager.pos.y - 3, 6, 6);
          ctx.globalAlpha = 1;
        }
      }
    }
    ctx.restore();
  }

  findClosestVillager(position: Vector2, range: number): Villager | null {
    let closest: Villager | null = null;
    let closestDistSq = range * range;
    for (const village of this.villages) {
      for (const villager of village.villagers) {
        if (!villager.alive) {
          continue;
        }
        const dx = villager.pos.x - position.x;
        const dy = villager.pos.y - position.y;
        const distSq = dx * dx + dy * dy;
        if (distSq <= closestDistSq) {
          closest = villager;
          closestDistSq = distSq;
        }
      }
    }
    return closest;
  }

  damageVillager(villager: Villager, amount: number): void {
    if (!villager.alive || amount <= 0) {
      return;
    }
    villager.hp = Math.max(0, villager.hp - amount);
    villager.hurtTimer = VILLAGER_HURT_FLASH;
    if (villager.hp === 0) {
      villager.alive = false;
      villager.state = 'idle';
      villager.timer = 0;
      villager.panicTarget = null;
      villager.wanderTarget = null;
    }
  }

  drawVillageAlarms(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.fillStyle = 'rgba(255, 70, 70, 0.95)';
    for (const village of this.villages) {
      if (!village.alarmed) {
        continue;
      }
      const top = village.center.y - village.canopyRadius - 14;
      ctx.beginPath();
      ctx.moveTo(village.center.x, top);
      ctx.lineTo(village.center.x - 6, top + 11);
      ctx.lineTo(village.center.x + 6, top + 11);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(village.center.x - 1.5, top + 11, 3, 4);
    }
    ctx.restore();
  }
}

