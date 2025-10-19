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

interface Villager {
  pos: Vector2;
  home: Vector2;
  state: VillagerState;
  timer: number;
  wanderTarget: Vector2 | null;
  wanderTimer: number;
  panicTarget: Vector2 | null;
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
    for (const tree of this.trees) {
      if (this.intersectsCircle(from, to, tree.position, tree.radius)) {
        segment.blocked = true;
        break;
      }
    }

    if (!segment.blocked) {
      for (const hut of this.huts) {
        if (this.intersectsRect(from, to, hut)) {
          segment.blocked = true;
          break;
        }
      }
    }

    this.losSegments.push(segment);
    return !segment.blocked;
  }

  getLosSegments(): readonly LosSegment[] {
    return this.losSegments;
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
    const columns = 9;
    const rows = 9;
    const cellWidth = (WIDTH - ARENA_PADDING * 2) / columns;
    const cellHeight = (HEIGHT - ARENA_PADDING * 2) / rows;
    const treePadding = 6;
    const castleClearRadius = CASTLE_WIN_RADIUS + 35;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        const cellCenterX = ARENA_PADDING + cellWidth * (col + 0.5);
        const cellCenterY = ARENA_PADDING + cellHeight * (row + 0.5);
        const densityRoll = rand();
        let treeCount = 0;
        if (densityRoll > 0.25) {
          treeCount = 1;
          if (densityRoll > 0.65) {
            treeCount++;
          }
          if (densityRoll > 0.92) {
            treeCount++;
          }
        }

        if (treeCount === 0) {
          continue;
        }

        const cellCenter = new Vector2(cellCenterX, cellCenterY);
        for (let i = 0; i < treeCount; i++) {
          let attempts = 12;
          while (attempts-- > 0) {
            const offset = new Vector2((rand() - 0.5) * cellWidth * 0.9, (rand() - 0.5) * cellHeight * 0.9);
            const position = cellCenter.clone().add(offset);
            position.x = clamp(position.x, ARENA_PADDING, WIDTH - ARENA_PADDING);
            position.y = clamp(position.y, ARENA_PADDING, HEIGHT - ARENA_PADDING);
            const treeRadius = 12 + rand() * 8;

            if (this.canPlaceTree(position, treeRadius, treePadding, castleClearRadius)) {
              this.trees.push({ position, radius: treeRadius });
              break;
            }
          }
        }
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
          panicTarget: null
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

  private intersectsCircle(from: Vector2, to: Vector2, center: Vector2, radius: number): boolean {
    const startToCenter = center.clone().subtract(from);
    const line = to.clone().subtract(from);
    const lengthSq = line.lengthSq();
    if (lengthSq === 0) {
      return startToCenter.length() <= radius;
    }
    const t = clamp((startToCenter.x * line.x + startToCenter.y * line.y) / lengthSq, 0, 1);
    const closest = new Vector2(from.x + line.x * t, from.y + line.y * t);
    return closest.distanceTo(center) <= radius;
  }

  private intersectsRect(from: Vector2, to: Vector2, hut: Hut): boolean {
    const halfW = hut.width / 2;
    const halfH = hut.height / 2;
    const minX = hut.center.x - halfW;
    const maxX = hut.center.x + halfW;
    const minY = hut.center.y - halfH;
    const maxY = hut.center.y + halfH;

    let t0 = 0;
    let t1 = 1;
    const dx = to.x - from.x;
    const dy = to.y - from.y;

    const checks: Array<[number, number]> = [
      [-dx, from.x - minX],
      [dx, maxX - from.x],
      [-dy, from.y - minY],
      [dy, maxY - from.y]
    ];

    for (const [p, q] of checks) {
      if (p === 0) {
        if (q < 0) {
          return false;
        }
        continue;
      }
      const r = q / p;
      if (p < 0) {
        if (r > t1) {
          return false;
        }
        if (r > t0) {
          t0 = r;
        }
      } else if (p > 0) {
        if (r < t0) {
          return false;
        }
        if (r < t1) {
          t1 = r;
        }
      }
    }
    return true;
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
      }
    }
    ctx.restore();
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

