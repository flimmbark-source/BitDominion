import { Vector2 } from '../math/vector2';
import type { Village, VillageAttackEvent } from './Village';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export interface EnemyRuntimeStats {
  speed: number;
  maxHp: number;
  damage: number;
  attackInterval: number;
  separationRadius: number;
  separationWeight: number;
  alignmentWeight: number;
  cohesionWeight: number;
}

export interface SwarmUpdateContext {
  dt: number;
  villages: Village[];
  neighbors: EnemySwarm[];
}

const ARRIVAL_RADIUS = 18;
const MAX_ACCEL = 60;
const VELOCITY_DECAY = 0.94;

export class EnemySwarm {
  public readonly id: number;
  private readonly position = new Vector2();
  private readonly velocity = new Vector2();

  private stats: EnemyRuntimeStats | null = null;
  private hp = 0;
  private alive = false;
  private attackCooldown = 0;
  private target: Village | null = null;

  constructor(id: number) {
    this.id = id;
  }

  reset(spawn: Vector2, stats: EnemyRuntimeStats): void {
    this.position.copy(spawn);
    this.velocity.set(0, 0);
    this.stats = stats;
    this.hp = stats.maxHp;
    this.alive = true;
    this.attackCooldown = 0;
    this.target = null;
  }

  isAlive(): boolean {
    return this.alive;
  }

  getPosition(): Vector2 {
    return this.position;
  }

  getRadius(): number {
    return 12;
  }

  getVelocity(): Vector2 {
    return this.velocity;
  }

  takeDamage(amount: number): boolean {
    if (!this.alive || !Number.isFinite(amount) || amount <= 0) {
      return false;
    }
    this.hp = Math.max(0, this.hp - amount);
    if (this.hp === 0) {
      this.alive = false;
      return true;
    }
    return false;
  }

  update(context: SwarmUpdateContext): VillageAttackEvent | null {
    if (!this.alive || !this.stats) {
      return null;
    }

    const { dt, villages, neighbors } = context;
    if (!Number.isFinite(dt) || dt <= 0) {
      return null;
    }

    if (!this.target || this.target.isDestroyed()) {
      this.target = this.findNearestVillage(villages);
    }

    if (!this.target) {
      this.velocity.scale(VELOCITY_DECAY);
      return null;
    }

    const acceleration = new Vector2();

    const targetPoint = this.target.getAttackPoint();
    const toTarget = targetPoint.clone().subtract(this.position);
    const distance = toTarget.length();
    if (distance > 1e-3) {
      const desired = toTarget.normalize().scale(this.stats.speed);
      const steering = desired.subtract(this.velocity).limit(MAX_ACCEL);
      acceleration.add(steering);
    }

    const { separation, alignment, cohesion } = this.computeFlocking(neighbors);
    acceleration.add(separation.scale(this.stats.separationWeight));
    acceleration.add(alignment.scale(this.stats.alignmentWeight));
    acceleration.add(cohesion.scale(this.stats.cohesionWeight));

    this.velocity.add(acceleration.scale(dt));
    const speed = this.velocity.length();
    if (speed > this.stats.speed) {
      this.velocity.scale(this.stats.speed / speed);
    }

    this.position.add(this.velocity.clone().scale(dt));

    const distanceToTarget = this.position.distanceTo(targetPoint);
    if (distanceToTarget <= ARRIVAL_RADIUS) {
      this.attackCooldown -= dt;
      if (this.attackCooldown <= 0) {
        this.attackCooldown = this.stats.attackInterval;
        return this.target.receiveAttack(this.stats.damage);
      }
    }

    return null;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (!this.alive) {
      return;
    }
    const radius = this.getRadius();
    const intensity = clamp(1 - this.hp / Math.max(1, this.stats?.maxHp ?? 1), 0.2, 0.95);
    ctx.save();
    ctx.beginPath();
    ctx.fillStyle = `rgba(${Math.round(90 + intensity * 110)}, ${Math.round(20 + intensity * 60)}, 20, 0.85)`;
    ctx.arc(this.position.x, this.position.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255, 170, 40, 0.5)';
    ctx.stroke();
    ctx.restore();
  }

  private findNearestVillage(villages: Village[]): Village | null {
    let nearest: Village | null = null;
    let nearestDistSq = Number.POSITIVE_INFINITY;
    for (const village of villages) {
      if (village.isDestroyed()) {
        continue;
      }
      const distSq = this.position.distanceTo(village.getAttackPoint());
      if (distSq < nearestDistSq) {
        nearestDistSq = distSq;
        nearest = village;
      }
    }
    return nearest;
  }

  private computeFlocking(neighbors: EnemySwarm[]): {
    separation: Vector2;
    alignment: Vector2;
    cohesion: Vector2;
  } {
    const separation = new Vector2();
    const alignment = new Vector2();
    const cohesion = new Vector2();
    let neighborCount = 0;
    if (!this.stats) {
      return { separation, alignment, cohesion };
    }

    const separationRadiusSq = this.stats.separationRadius * this.stats.separationRadius;

    for (const neighbor of neighbors) {
      if (neighbor === this || !neighbor.isAlive()) {
        continue;
      }
      const offset = this.position.clone().subtract(neighbor.getPosition());
      const distSq = offset.lengthSq();
      if (distSq > separationRadiusSq || distSq === 0) {
        continue;
      }
      neighborCount += 1;
      separation.add(offset.normalize().scale(1 / Math.sqrt(distSq)));
      alignment.add(neighbor.getVelocity());
      cohesion.add(neighbor.getPosition());
    }

    if (neighborCount > 0) {
      separation.scale(1 / neighborCount);
      alignment.scale(1 / neighborCount);
      alignment.subtract(this.velocity);
      cohesion.scale(1 / neighborCount);
      cohesion.subtract(this.position);
    }

    return { separation, alignment, cohesion };
  }
}
