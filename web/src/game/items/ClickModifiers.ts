import { Config } from '../../config/config';

export type ClickModifierId = 'multiHit' | 'splash' | 'dot' | 'crit' | 'autoClick';

export interface MultiHitModifier {
  readonly id: 'multiHit';
  readonly count?: number;
}

export interface SplashModifier {
  readonly id: 'splash';
  readonly radius?: number;
  readonly pct?: number;
}

export interface DotModifier {
  readonly id: 'dot';
  readonly dps?: number;
  readonly durationMs?: number;
}

export interface CritModifier {
  readonly id: 'crit';
  readonly chance?: number;
  readonly multiplier?: number;
}

export interface AutoClickModifier {
  readonly id: 'autoClick';
  readonly ratePerSec?: number;
}

export type ClickModifierEffect =
  | MultiHitModifier
  | SplashModifier
  | DotModifier
  | CritModifier
  | AutoClickModifier;

export interface ClickDotEffect {
  readonly dps: number;
  readonly durationMs: number;
}

export interface ClickLoadout {
  readonly multiHitCount: number;
  readonly splashRadius: number;
  readonly splashPct: number;
  readonly dot: ClickDotEffect | null;
  readonly critChance: number;
  readonly critMultiplier: number;
  readonly autoClickRate: number;
  readonly ranks: Partial<Record<ClickModifierId, number>>;
}

type MutableClickLoadout = {
  multiHitCount: number;
  splashRadius: number;
  splashPct: number;
  dot: ClickDotEffect | null;
  critChance: number;
  critMultiplier: number;
  autoClickRate: number;
  ranks: Record<ClickModifierId, number>;
};

const defaults = Config.modifiers.defaults;
const caps = Config.modifiers.caps;

export function createEmptyClickLoadout(): ClickLoadout {
  return {
    multiHitCount: 1,
    splashRadius: 0,
    splashPct: 0,
    dot: null,
    critChance: 0,
    critMultiplier: 1,
    autoClickRate: 0,
    ranks: {}
  };
}

export const ClickModifiers = {
  multiHit(count: number = defaults.multiHit): MultiHitModifier {
    return { id: 'multiHit', count };
  },
  splash(radius: number = defaults.splash.radius, pct: number = defaults.splash.pct): SplashModifier {
    return { id: 'splash', radius, pct };
  },
  dot(dps: number = defaults.dot.dps, durationMs: number = defaults.dot.durationMs): DotModifier {
    return { id: 'dot', dps, durationMs };
  },
  crit(chance: number = defaults.crit.chance, multiplier: number = defaults.crit.multiplier): CritModifier {
    return { id: 'crit', chance, multiplier };
  },
  autoClick(ratePerSec: number = defaults.autoClick.ratePerSec): AutoClickModifier {
    return { id: 'autoClick', ratePerSec };
  }
} as const;

export function combineClickModifiers(modifiers: readonly ClickModifierEffect[]): ClickLoadout {
  const mutable: MutableClickLoadout = {
    multiHitCount: 1,
    splashRadius: 0,
    splashPct: 0,
    dot: null,
    critChance: 0,
    critMultiplier: 1,
    autoClickRate: 0,
    ranks: {
      multiHit: 0,
      splash: 0,
      dot: 0,
      crit: 0,
      autoClick: 0
    }
  };

  for (const effect of modifiers) {
    mutable.ranks[effect.id] = (mutable.ranks[effect.id] ?? 0) + 1;
    switch (effect.id) {
      case 'multiHit': {
        const count = Math.max(1, effect.count ?? defaults.multiHit);
        mutable.multiHitCount = Math.min(caps.multiHit, Math.max(mutable.multiHitCount, count));
        break;
      }
      case 'splash': {
        const radius = Math.max(0, effect.radius ?? defaults.splash.radius);
        const pct = Math.max(0, Math.min(1, effect.pct ?? defaults.splash.pct));
        mutable.splashRadius = Math.min(caps.splashRadiusMax, Math.max(mutable.splashRadius, radius));
        mutable.splashPct = Math.max(mutable.splashPct, pct);
        break;
      }
      case 'dot': {
        const dps = Math.max(0, effect.dps ?? defaults.dot.dps);
        const durationMs = Math.max(0, effect.durationMs ?? defaults.dot.durationMs);
        if (!mutable.dot || dps > mutable.dot.dps) {
          mutable.dot = { dps, durationMs };
        } else if (mutable.dot && dps === mutable.dot.dps) {
          mutable.dot = { dps, durationMs: Math.max(mutable.dot.durationMs, durationMs) };
        }
        break;
      }
      case 'crit': {
        const chance = Math.max(0, Math.min(caps.critMax, effect.chance ?? defaults.crit.chance));
        const multiplier = Math.max(1, effect.multiplier ?? defaults.crit.multiplier);
        mutable.critChance = Math.max(mutable.critChance, chance);
        mutable.critMultiplier = Math.max(mutable.critMultiplier, multiplier);
        break;
      }
      case 'autoClick': {
        const rate = Math.max(0, effect.ratePerSec ?? defaults.autoClick.ratePerSec);
        mutable.autoClickRate = Math.min(caps.autoClickMaxRps, Math.max(mutable.autoClickRate, rate));
        break;
      }
      default:
        break;
    }
  }

  const ranks: Partial<Record<ClickModifierId, number>> = {};
  for (const [id, value] of Object.entries(mutable.ranks) as [ClickModifierId, number][]) {
    if (value > 0) {
      ranks[id] = value;
    }
  }

  return {
    multiHitCount: mutable.multiHitCount,
    splashRadius: mutable.splashRadius,
    splashPct: mutable.splashPct,
    dot: mutable.dot,
    critChance: mutable.critChance,
    critMultiplier: mutable.critMultiplier,
    autoClickRate: mutable.autoClickRate,
    ranks
  };
}
