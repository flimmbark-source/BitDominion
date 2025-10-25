import { Config } from './config';
import { ClickModifiers, type ClickModifierEffect } from '../game/items/ClickModifiers';

export type WeaponItemId = 'steelSword' | 'throwingKnife' | 'torch' | 'crossbowCharm' | 'smokeBombSatchel';
export type SupportItemId = 'scoutBoots' | 'hunterJerky';
export type ItemId = WeaponItemId | SupportItemId;

export type ItemCategory = 'weapon' | 'support';

export interface ItemDefinition {
  readonly id: ItemId;
  readonly name: string;
  readonly description: string;
  readonly role: string;
  readonly cost: number;
  readonly icon: string;
  readonly unique?: boolean;
  readonly category: ItemCategory;
  readonly evolveRequirement?: {
    readonly type: 'kills' | 'rescues';
    readonly count: number;
    readonly label: string;
  };
  readonly evolution?: {
    readonly name: string;
    readonly description: string;
  };
  readonly stats: readonly string[];
  readonly modifiers?: readonly ClickModifierEffect[];
}

export const ITEM_DEFINITIONS: Record<ItemId, ItemDefinition> = {
  steelSword: {
    id: 'steelSword',
    name: 'Knightblade',
    description:
      'Tempered steel blade that anchors your fundamentals. Every strike channels through this heirloom to deliver a dependable opening hit.',
    role: 'Starter focus — unlocks manual strikes and baseline damage.',
    cost: 0,
    icon: '🗡️',
    unique: true,
    category: 'weapon',
    stats: ['Base click damage: 10', 'Always equipped at the start of a run']
  },
  scoutBoots: {
    id: 'scoutBoots',
    name: 'Assassin’s Token',
    description:
      'A silver coin etched with fatal intent. Holding it sharpens your reflexes and makes critical ambushes second nature.',
    role: 'Crit engine — rewards precision clicks with massive payoffs.',
    cost: Config.modifiers.costs.crit,
    icon: '🗡️',
    unique: true,
    category: 'support',
    stats: ['Critical chance: 25%', 'Critical damage: 2.2×'],
    modifiers: [ClickModifiers.crit(0.25, 2.2)]
  },
  hunterJerky: {
    id: 'hunterJerky',
    name: 'Fangfeast Jerky',
    description:
      'Spiced wolf jerky that fuels relentless combos. Each bite primes Rowan to flurry every strike beyond mortal pacing.',
    role: 'Combo extender — pushes multi-hit chains even further.',
    cost: Config.modifiers.costs.multiHit + 15,
    icon: '🍖',
    unique: true,
    category: 'support',
    stats: ['Multi-hit finisher: 4 strikes per click'],
    modifiers: [ClickModifiers.multiHit(4)]
  },
  throwingKnife: {
    id: 'throwingKnife',
    name: 'Splinter Sigil',
    description:
      'Arcane runes fracture each click into a trio of precise strikes, ideal for shredding elites with rapid bursts.',
    role: 'Combo core — multiplies every manual click into a flurry.',
    cost: Config.modifiers.costs.multiHit,
    icon: '🔱',
    unique: true,
    category: 'weapon',
    stats: ['Multi-hit opener: 3 strikes per click'],
    modifiers: [ClickModifiers.multiHit(3)]
  },
  torch: {
    id: 'torch',
    name: 'Ember Torch',
    description:
      'A resonant bracer that releases a burning ripple whenever you land a hit, softening entire packs at once.',
    role: 'Area control — cleaves crowds and leaves them smoldering.',
    cost: Config.modifiers.costs.splash,
    icon: '💥',
    unique: true,
    category: 'weapon',
    stats: [
      `Splash radius: ${Config.modifiers.defaults.splash.radius}px`,
      `Splash damage: ${(Config.modifiers.defaults.splash.pct * 100).toFixed(0)}% of base`,
      `Burn: ${Config.modifiers.defaults.dot.dps} DPS for ${(Config.modifiers.defaults.dot.durationMs / 1000).toFixed(1)}s`
    ],
    modifiers: [
      ClickModifiers.splash(
        Config.modifiers.defaults.splash.radius,
        Config.modifiers.defaults.splash.pct
      ),
      ClickModifiers.dot(
        Config.modifiers.defaults.dot.dps,
        Config.modifiers.defaults.dot.durationMs
      )
    ]
  },
  crossbowCharm: {
    id: 'crossbowCharm',
    name: 'Clockwork Familiar',
    description:
      'A mechanical sparrow that mimics your strikes, pecking at foes even while you reposition.',
    role: 'Automation — provides steady passive clicks between manual bursts.',
    cost: Config.modifiers.costs.autoClick,
    icon: '🕰️',
    unique: true,
    category: 'weapon',
    stats: ['Auto-click cadence: 1.4 strikes per second'],
    modifiers: [ClickModifiers.autoClick(1.4)]
  },
  smokeBombSatchel: {
    id: 'smokeBombSatchel',
    name: 'Frost Reliquary',
    description:
      'A crystal reliquary that bursts into hoarfrost with every strike, rattling entire packs at once.',
    role: 'Area escalation — widens splash impact across the front line.',
    cost: Config.modifiers.costs.splash + 10,
    icon: '❄️',
    unique: true,
    category: 'weapon',
    stats: ['Splash radius: 72px', 'Splash damage: 35% of base'],
    modifiers: [ClickModifiers.splash(72, 0.35)]
  }
};

export const ITEM_ORDER: readonly ItemId[] = [
  'throwingKnife',
  'torch',
  'crossbowCharm',
  'smokeBombSatchel',
  'scoutBoots',
  'hunterJerky'
];
