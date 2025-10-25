import { Vector2 } from '../../math/vector2';
import type { Village, VillageAttackEvent } from '../../darkSurge/Village';

export type EnemySwarmState = 'moving' | 'attackingBuilding' | 'attackingVillager';

export interface SwarmStats {
  hp: number;
  damage: number;
  speed: number;
}

export interface SwarmSpawnParams {
  position: Vector2;
  stats: SwarmStats;
  memberCount: number;
  heading: number;
}

export interface SwarmUpdateContext {
  dt: number;
  neighbors: readonly EnemySwarm[];
  villages: readonly Village[];
}

interface DotEffect {
  remaining: number;
  dps: number;
}

const ARRIVAL_RADIUS = 36;
const MAX_ACCEL = 70;
const VELOCITY_DECAY = 0.9;
const ATTACK_INTERVAL = 1.05;
const SEPARATION_RADIUS = 54;

export class EnemySwarm {
  public readonly id: number;
  public readonly pos = new Vector2();

  private readonly velocity = new Vector2();
  private state: EnemySwarmState = 'moving';
  private target: Village | null = null;
  private aliveFlag = false;
  private stats: SwarmStats | null = null;
  private maxHp = 0;
  private hp = 0;
  private baseMemberCount = 0;
  private attackCooldown = 0;
  private dot: DotEffect | null = null;

  constructor(id: number) {
    this.id = id;
  }

  reset(params: SwarmSpawnParams): void {
    this.pos.copy(params.position);
    this.velocity.set(Math.cos(params.heading), Math.sin(params.heading)).scale(params.stats.speed);
    this.state = 'moving';
    this.target = null;
    this.aliveFlag = true;
    this.stats = { ...params.stats };
    this.baseMemberCount = Math.max(1, Math.round(params.memberCount));
    this.maxHp = this.baseMemberCount * params.stats.hp;
    this.hp = this.maxHp;
    this.attackCooldown = 0;
    this.dot = null;
  }

  get alive(): boolean {
    return this.aliveFlag;
  }

  isAlive(): boolean {
    return this.aliveFlag;
  }

  getCollisionRadius(): number {
    return 14 + this.getEffectiveMembers() * 1.6;
  }

  getHp(): number {
    return this.hp;
  }

  getMaxHp(): number {
    return this.maxHp;
  }

  getEffectiveMembers(): number {
    if (this.baseMemberCount <= 1) {
      return this.aliveFlag ? 1 : 0;
    }
    if (this.maxHp <= 0) {
      return this.baseMemberCount;
    }
    const ratio = Math.max(0, Math.min(1, this.hp / this.maxHp));
    return Math.max(0, Math.round(ratio * this.baseMemberCount));
  }

  takeDamage(amount: number): boolean {
    if (!this.aliveFlag || amount <= 0 || !Number.isFinite(amount)) {
      return false;
    }
    this.hp = Math.max(0, this.hp - amount);
    if (this.hp === 0) {
      this.aliveFlag = false;
      this.state = 'moving';
      return true;
    }
    return false;
  }

  applyDot(dps: number, durationSeconds: number): void {
    if (!this.aliveFlag || dps <= 0 || durationSeconds <= 0) {
      return;
    }
    const duration = durationSeconds;
    if (!this.dot || this.dot.remaining < duration) {
      this.dot = { remaining: duration, dps };
    } else {
      this.dot.dps = Math.max(this.dot.dps, dps);
    }
  }

  update(context: SwarmUpdateContext): VillageAttackEvent | null {
    if (!this.aliveFlag || !this.stats) {
      return null;
    }

    this.updateDot(context.dt);

    const { villages } = context;
    if (!this.target || this.target.isDestroyed()) {
      this.target = this.findNearestVillage(villages);
      this.state = 'moving';
    }

    if (!this.target) {
      this.velocity.scale(VELOCITY_DECAY);
      return null;
    }

    if (this.state === 'moving') {
      this.seekTarget(context);
      const distance = this.pos.distanceTo(this.target.getAttackPoint());
      if (distance <= ARRIVAL_RADIUS) {
        this.state = this.target.hasIntactBuildings() ? 'attackingBuilding' : 'attackingVillager';
        this.attackCooldown = 0;
      }
      return null;
    }

    this.attackCooldown = Math.max(0, this.attackCooldown - context.dt);
    if (this.attackCooldown > 0) {
      return null;
    }
    this.attackCooldown = ATTACK_INTERVAL;

    if (this.state === 'attackingBuilding') {
      const result = this.target.receiveAttack(this.getAttackDamage());
      if (result?.village && !this.target.hasIntactBuildings() && this.target.hasPopulation()) {
        this.state = 'attackingVillager';
      }
      if (result?.collapsed) {
        this.target = null;
      }
      return result;
    }

    const raidResult = this.target.receiveVillagerRaid(this.getAttackDamage());
    if (raidResult?.collapsed) {
      this.target = null;
    }
    return raidResult;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (!this.aliveFlag) {
      return;
    }
    const radius = this.getCollisionRadius();
    const healthRatio = this.maxHp === 0 ? 0 : 1 - this.hp / this.maxHp;
    ctx.save();
    ctx.beginPath();
    const tint = Math.round(80 + healthRatio * 140);
    ctx.fillStyle = `rgba(${tint}, ${30 + healthRatio * 80}, 32, 0.85)`;
    ctx.arc(this.pos.x, this.pos.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = this.state === 'attackingVillager' ? 'rgba(255, 220, 120, 0.9)' : 'rgba(255, 120, 80, 0.6)';
    ctx.stroke();

    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.font = 'bold 12px Inter';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${this.getEffectiveMembers()}`, this.pos.x, this.pos.y);
    ctx.restore();
  }

  private getAttackDamage(): number {
    if (!this.stats) {
      return 0;
    }
    const memberFactor = Math.max(1, this.getEffectiveMembers());
    return this.stats.damage * memberFactor;
  }

  private updateDot(dt: number): void {
    if (!this.dot || dt <= 0 || !this.aliveFlag) {
      return;
    }
    const damage = this.dot.dps * dt;
    this.takeDamage(damage);
    this.dot.remaining = Math.max(0, this.dot.remaining - dt);
    if (this.dot.remaining === 0 || !this.aliveFlag) {
      this.dot = null;
    }
  }

  private seekTarget(context: SwarmUpdateContext): void {
    if (!this.target || !this.stats) {
      return;
    }
    const targetPoint = this.target.getAttackPoint();
    const toTarget = targetPoint.clone().subtract(this.pos);
    const distance = toTarget.length();
    const desired = distance > 0 ? toTarget.normalize().scale(this.stats.speed) : new Vector2();
    const steering = desired.subtract(this.velocity).limit(MAX_ACCEL);

    const flocking = this.computeFlocking(context.neighbors);
    steering.add(flocking.separation.scale(24));
    steering.add(flocking.alignment.scale(8));
    steering.add(flocking.cohesion.scale(6));

    this.velocity.add(steering.scale(context.dt));
    const speed = this.velocity.length();
    if (speed > this.stats.speed) {
      this.velocity.scale(this.stats.speed / speed);
    }
    this.pos.add(this.velocity.clone().scale(context.dt));
  }

  private computeFlocking(neighbors: readonly EnemySwarm[]): {
    separation: Vector2;
    alignment: Vector2;
    cohesion: Vector2;
  } {
    const separation = new Vector2();
    const alignment = new Vector2();
    const cohesion = new Vector2();
    let count = 0;

    for (const neighbor of neighbors) {
      if (neighbor === this || !neighbor.isAlive()) {
        continue;
      }
      const offset = this.pos.clone().subtract(neighbor.pos);
      const distSq = offset.lengthSq();
      if (distSq === 0 || distSq > SEPARATION_RADIUS * SEPARATION_RADIUS) {
        continue;
      }
      count += 1;
      separation.add(offset.normalize().scale(1 / Math.max(1, Math.sqrt(distSq))));
      alignment.add(neighbor.velocity);
      cohesion.add(neighbor.pos);
    }

    if (count > 0) {
      alignment.scale(1 / count);
      cohesion.scale(1 / count).subtract(this.pos);
    }

    return { separation, alignment, cohesion };
  }

  private findNearestVillage(villages: readonly Village[]): Village | null {
    let nearest: Village | null = null;
    let nearestDist = Number.POSITIVE_INFINITY;
    for (const village of villages) {
      if (village.isDestroyed()) {
        continue;
      }
      const distance = this.pos.distanceTo(village.getAttackPoint());
      if (distance < nearestDist) {
        nearestDist = distance;
        nearest = village;
      }
    }
    return nearest;
  }
}
