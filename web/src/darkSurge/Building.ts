import { Vector2 } from '../math/vector2';

export interface BuildingOptions {
  id: number;
  position: Vector2;
  maxHp: number;
  igniteThreshold: number;
  burnDamagePerSecond: number;
  onDestroyed?: (building: Building) => void;
}

export interface BuildingAttackResult {
  damageApplied: number;
  startedBurning: boolean;
  destroyed: boolean;
}

const DAMAGE_MEMORY_DECAY = 3;

export class Building {
  public readonly id: number;
  public readonly position: Vector2;
  public readonly maxHp: number;
  private readonly igniteThreshold: number;
  private readonly burnDamagePerSecond: number;
  private readonly destroyCallback?: (building: Building) => void;

  private damageMemory = 0;
  private hp: number;
  private burning = false;
  private destroyed = false;

  constructor(options: BuildingOptions) {
    this.id = options.id;
    this.position = options.position.clone();
    this.maxHp = options.maxHp;
    this.igniteThreshold = options.igniteThreshold;
    this.burnDamagePerSecond = options.burnDamagePerSecond;
    this.destroyCallback = options.onDestroyed;
    this.hp = options.maxHp;
  }

  getHp(): number {
    return this.hp;
  }

  getMaxHp(): number {
    return this.maxHp;
  }

  getMissingHp(): number {
    if (this.destroyed) {
      return 0;
    }
    return Math.max(0, this.maxHp - this.hp);
  }

  isBurning(): boolean {
    return this.burning && !this.destroyed;
  }

  isDestroyed(): boolean {
    return this.destroyed;
  }

  getIntegrity(): number {
    return this.maxHp === 0 ? 0 : Math.max(0, this.hp) / this.maxHp;
  }

  onAttack(damage: number): BuildingAttackResult {
    if (this.destroyed || damage <= 0) {
      return { damageApplied: 0, startedBurning: false, destroyed: this.destroyed };
    }

    const applied = Math.max(0, damage);
    this.hp = Math.max(0, this.hp - applied);
    this.damageMemory += applied;
    let startedBurning = false;

    if (!this.burning && this.damageMemory >= this.igniteThreshold) {
      this.burning = true;
      startedBurning = true;
    }

    if (this.hp <= 0) {
      this.onDestroy();
    }

    return { damageApplied: applied, startedBurning, destroyed: this.destroyed };
  }

  update(dt: number): void {
    if (this.destroyed) {
      return;
    }

    this.damageMemory = Math.max(0, this.damageMemory - dt * this.igniteThreshold / DAMAGE_MEMORY_DECAY);

    if (this.burning) {
      const burnDamage = this.burnDamagePerSecond * dt;
      if (burnDamage > 0) {
        this.hp = Math.max(0, this.hp - burnDamage);
      }
      if (this.hp <= 0) {
        this.onDestroy();
      }
    }
  }

  onDestroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.burning = false;
    this.hp = 0;
    if (this.destroyCallback) {
      this.destroyCallback(this);
    }
  }

  repairToFull(): number {
    if (this.destroyed) {
      return 0;
    }
    const missing = this.getMissingHp();
    if (missing <= 0) {
      this.damageMemory = 0;
      this.burning = false;
      return 0;
    }
    this.hp = this.maxHp;
    this.damageMemory = 0;
    this.burning = false;
    return missing;
  }

  beginDowntime(repairFraction: number): void {
    if (this.destroyed) {
      return;
    }
    const missing = this.maxHp - this.hp;
    if (missing > 0 && repairFraction > 0) {
      this.hp = Math.min(this.maxHp, this.hp + missing * repairFraction);
    }
    this.damageMemory = 0;
    this.burning = false;
  }
}
