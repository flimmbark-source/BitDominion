import { Config } from '../../config/config';
import type { DarkUnit } from '../../entities/darkUnit';
import { Vector2 } from '../../math/vector2';
import type { EnemySwarm } from '../enemies/EnemySwarm';
import {
  type ClickLoadout,
  type ClickDotEffect,
  createEmptyClickLoadout
} from '../items/ClickModifiers';

export interface ClickHitContext {
  readonly source: 'click' | 'auto';
  readonly crit: boolean;
  readonly dot?: ClickDotEffect;
}

type ClickTarget = DarkUnit | EnemySwarm;

interface ClickCombatDependencies {
  readonly getAliveEnemies: () => readonly ClickTarget[];
  readonly findUnitsInRadius: (position: Vector2, radius: number) => ClickTarget[];
  readonly getRandomTarget: () => ClickTarget | null;
  readonly applyHit: (target: ClickTarget, damage: number, context: ClickHitContext) => void;
  readonly baseDamage: () => number;
  readonly emitNoise: (position: Vector2, strength: number) => void;
  readonly manualNoise: number;
  readonly autoNoise: number;
}

export class ClickCombat {
  private cooldownRemaining = 0;
  private autoAccumulator = 0;
  private loadout: ClickLoadout = createEmptyClickLoadout();

  constructor(private readonly deps: ClickCombatDependencies) {}

  setLoadout(loadout: ClickLoadout): void {
    this.loadout = loadout;
    this.autoAccumulator = 0;
  }

  update(dt: number): void {
    if (this.cooldownRemaining > 0) {
      this.cooldownRemaining = Math.max(0, this.cooldownRemaining - dt);
    }

    const autoRate = this.loadout.autoClickRate;
    if (autoRate <= 0) {
      this.autoAccumulator = 0;
      return;
    }

    this.autoAccumulator += autoRate * dt;
    while (this.autoAccumulator >= 1) {
      this.autoAccumulator -= 1;
      this.performAutoClick();
    }
  }

  reset(): void {
    this.cooldownRemaining = 0;
    this.autoAccumulator = 0;
  }

  handlePointerDown(position: Vector2): boolean {
    if (this.cooldownRemaining > 0) {
      return false;
    }
    const target = this.findTarget(position);
    if (!target) {
      return false;
    }
    this.resolveManualClick(target);
    this.cooldownRemaining = Config.click.cooldownMs / 1000;
    return true;
  }

  private resolveManualClick(primary: ClickTarget): void {
    const baseDamage = this.deps.baseDamage();
    const multiHits = Math.max(1, Math.floor(this.loadout.multiHitCount));
    for (let i = 0; i < multiHits; i++) {
      this.applyDamage(primary, baseDamage, 'click');
    }

    if (this.loadout.splashRadius > 0 && this.loadout.splashPct > 0) {
      const neighbors = this.deps.findUnitsInRadius(primary.pos, this.loadout.splashRadius);
      for (const neighbor of neighbors) {
        if (neighbor === primary || !neighbor.alive) {
          continue;
        }
        const splashDamage = baseDamage * this.loadout.splashPct;
        this.applyDamage(neighbor, splashDamage, 'click');
      }
    }

    this.deps.emitNoise(primary.pos, this.deps.manualNoise);
  }

  private performAutoClick(): void {
    const target = this.deps.getRandomTarget();
    if (!target) {
      return;
    }
    const damage = this.deps.baseDamage();
    this.applyDamage(target, damage, 'auto');
    this.deps.emitNoise(target.pos, this.deps.autoNoise);
  }

  private applyDamage(target: ClickTarget, damage: number, source: ClickHitContext['source']): void {
    if (damage <= 0 || !target.alive) {
      return;
    }
    const crit = this.loadout.critChance > 0 && Math.random() < this.loadout.critChance;
    const critMultiplier = crit ? this.loadout.critMultiplier : 1;
    const finalDamage = damage * critMultiplier;
    const dot = this.loadout.dot;
    const hasDot = dot && dot.dps > 0 && dot.durationMs > 0;
    const context: ClickHitContext = hasDot
      ? { source, crit, dot: { ...dot } }
      : { source, crit };
    this.deps.applyHit(target, finalDamage, context);
  }

  private findTarget(position: Vector2): ClickTarget | null {
    let hovered: ClickTarget | null = null;
    let closest: ClickTarget | null = null;
    let closestDist = Config.click.clickAssistRadius + 1;

    for (const unit of this.deps.getAliveEnemies()) {
      if (!unit.alive) {
        continue;
      }
      const distance = unit.pos.distanceTo(position);
      const radius = unit.getCollisionRadius();
      if (distance <= radius) {
        if (!hovered || distance < hovered.pos.distanceTo(position)) {
          hovered = unit;
        }
        continue;
      }
      if (distance <= Config.click.clickAssistRadius && distance < closestDist) {
        closest = unit;
        closestDist = distance;
      }
    }

    return hovered ?? closest;
  }
}
