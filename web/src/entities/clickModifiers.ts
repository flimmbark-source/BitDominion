import type { Vector2 } from '../math/vector2';
import type { DarkUnit } from './darkUnit';

export type ClickModifierEffect =
  | { type: 'multiHit'; hitCount: number; additionalScale: number }
  | { type: 'splash'; radius: number; damageScale: number }
  | { type: 'auto'; damageScale: number; interval: number }
  | { type: 'crit'; chance: number; multiplier: number }
  | { type: 'burn'; dps: number; duration: number }
  | { type: 'freeze'; factor: number; duration: number };

export interface ClickHitContext {
  readonly source: 'click' | 'auto';
  readonly crit: boolean;
  readonly burn?: { readonly dps: number; readonly duration: number };
  readonly freeze?: { readonly factor: number; readonly duration: number };
}

interface ClickModifierDependencies {
  readonly findPrimaryTarget: (position: Vector2, radius: number) => DarkUnit | null;
  readonly findUnitsInRadius: (position: Vector2, radius: number) => DarkUnit[];
  readonly getRandomTarget: () => DarkUnit | null;
  readonly baseDamage: () => number;
  readonly onHit: (target: DarkUnit, damage: number, context: ClickHitContext) => void;
  readonly emitNoise: (position: Vector2, strength: number) => void;
}

interface ClickModifierOptions {
  readonly manualNoise: number;
  readonly autoNoise: number;
  readonly targetRadius: number;
}

export class ClickModifierSystem {
  private readonly manualNoise: number;
  private readonly autoNoise: number;
  private readonly targetRadius: number;

  private multiHitCount = 1;
  private additionalHitScale = 0;
  private splashRadius = 0;
  private splashScale = 0;
  private critChance = 0;
  private critMultiplier = 1;
  private burn: { dps: number; duration: number } | null = null;
  private freeze: { factor: number; duration: number } | null = null;
  private autoDamageScale = 0;
  private autoInterval = 1;
  private autoTimer = 0;

  constructor(private readonly deps: ClickModifierDependencies, options: ClickModifierOptions) {
    this.manualNoise = options.manualNoise;
    this.autoNoise = options.autoNoise;
    this.targetRadius = options.targetRadius;
  }

  reset(): void {
    this.multiHitCount = 1;
    this.additionalHitScale = 0;
    this.splashRadius = 0;
    this.splashScale = 0;
    this.critChance = 0;
    this.critMultiplier = 1;
    this.burn = null;
    this.freeze = null;
    this.autoDamageScale = 0;
    this.autoInterval = 1;
    this.autoTimer = 0;
  }

  addEffect(effect: ClickModifierEffect): void {
    switch (effect.type) {
      case 'multiHit':
        this.multiHitCount = Math.max(this.multiHitCount, Math.max(1, effect.hitCount));
        this.additionalHitScale = Math.max(this.additionalHitScale, Math.max(0, effect.additionalScale));
        break;
      case 'splash':
        this.splashRadius = Math.max(this.splashRadius, Math.max(0, effect.radius));
        this.splashScale = Math.max(this.splashScale, Math.max(0, effect.damageScale));
        break;
      case 'auto':
        this.autoDamageScale = Math.max(this.autoDamageScale, Math.max(0, effect.damageScale));
        this.autoInterval = Math.max(0.2, Math.min(this.autoInterval, Math.max(0.05, effect.interval)));
        break;
      case 'crit':
        this.critChance = Math.max(this.critChance, Math.min(1, Math.max(0, effect.chance)));
        this.critMultiplier = Math.max(this.critMultiplier, Math.max(1, effect.multiplier));
        break;
      case 'burn':
        if (!this.burn || effect.dps > this.burn.dps) {
          this.burn = { dps: Math.max(0, effect.dps), duration: Math.max(0, effect.duration) };
        } else if (this.burn && effect.duration > this.burn.duration) {
          this.burn.duration = Math.max(0, effect.duration);
        }
        break;
      case 'freeze':
        if (!this.freeze || effect.factor < this.freeze.factor) {
          this.freeze = { factor: Math.max(0, Math.min(1, effect.factor)), duration: Math.max(0, effect.duration) };
        } else if (this.freeze && effect.duration > this.freeze.duration) {
          this.freeze.duration = Math.max(0, effect.duration);
        }
        break;
      default:
        break;
    }
  }

  handleClick(position: Vector2): boolean {
    const primary = this.deps.findPrimaryTarget(position, this.targetRadius);
    if (!primary) {
      return false;
    }
    const baseDamage = this.deps.baseDamage();
    this.applyHit(primary, baseDamage, 'click');
    if (this.multiHitCount > 1) {
      for (let i = 1; i < this.multiHitCount; i++) {
        const scaledDamage = baseDamage * (this.additionalHitScale > 0 ? this.additionalHitScale : 1);
        this.applyHit(primary, scaledDamage, 'click');
      }
    }
    if (this.splashRadius > 0 && this.splashScale > 0) {
      const neighbors = this.deps.findUnitsInRadius(primary.pos, this.splashRadius);
      for (const neighbor of neighbors) {
        if (neighbor === primary) {
          continue;
        }
        this.applyHit(neighbor, baseDamage * this.splashScale, 'click');
      }
    }
    this.deps.emitNoise(primary.pos, this.manualNoise);
    return true;
  }

  update(dt: number): void {
    if (this.autoDamageScale <= 0) {
      return;
    }
    this.autoTimer += dt;
    while (this.autoTimer >= this.autoInterval) {
      this.autoTimer -= this.autoInterval;
      const target = this.deps.getRandomTarget();
      if (!target) {
        this.autoTimer = 0;
        return;
      }
      const damage = this.deps.baseDamage() * this.autoDamageScale;
      this.applyHit(target, damage, 'auto');
      this.deps.emitNoise(target.pos, this.autoNoise);
    }
  }

  private applyHit(target: DarkUnit, damage: number, source: ClickHitContext['source']): void {
    if (damage <= 0) {
      return;
    }
    const crit = this.critChance > 0 && Math.random() < this.critChance;
    const totalDamage = damage * (crit ? this.critMultiplier : 1);
    const context: ClickHitContext = {
      source,
      crit,
      burn: this.burn ? { ...this.burn } : undefined,
      freeze: this.freeze ? { ...this.freeze } : undefined
    };
    this.deps.onHit(target, totalDamage, context);
  }
}
