import type { ClickModifierEffect } from '../entities/clickModifiers';

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
  readonly clickEffects?: readonly ClickModifierEffect[];
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
    stats: ['Base click damage: 1.5', 'Always equipped at the start of a run']
  },
  scoutBoots: {
    id: 'scoutBoots',
    name: 'Assassin’s Token',
    description:
      'A silver coin etched with fatal intent. Holding it sharpens your reflexes and makes critical ambushes second nature.',
    role: 'Crit engine — rewards precision clicks with massive payoffs.',
    cost: 65,
    icon: '🗡️',
    unique: true,
    category: 'support',
    stats: ['25% critical chance on manual and auto strikes', 'Critical hits deal 2.2× damage'],
    clickEffects: [{ type: 'crit', chance: 0.25, multiplier: 2.2 }]
  },
  hunterJerky: {
    id: 'hunterJerky',
    name: 'Emberbrand Charm',
    description:
      'An ember kept in obsidian glass. It brands every enemy you strike, letting the burn finish what the blade began.',
    role: 'Damage-over-time — leaves foes smoldering after each click.',
    cost: 55,
    icon: '🔥',
    unique: true,
    category: 'support',
    stats: ['Clicks ignite targets for 2.5 DPS', 'Burn duration: 3s'],
    clickEffects: [{ type: 'burn', dps: 2.5, duration: 3 }]
  },
  throwingKnife: {
    id: 'throwingKnife',
    name: 'Splinter Sigil',
    description:
      'Arcane runes fracture each click into a trio of precise strikes, ideal for shredding elites with rapid bursts.',
    role: 'Combo core — multiplies every manual click into a flurry.',
    cost: 45,
    icon: '🔱',
    unique: true,
    category: 'weapon',
    stats: ['Clicks strike 3 times', 'Bonus hits deal 65% damage'],
    clickEffects: [{ type: 'multiHit', hitCount: 3, additionalScale: 0.65 }]
  },
  torch: {
    id: 'torch',
    name: 'Shockwave Band',
    description:
      'A resonant bracer that releases a thunderous ripple whenever you land a hit, softening entire packs at once.',
    role: 'Area control — splashes damage around your primary target.',
    cost: 55,
    icon: '💥',
    unique: true,
    category: 'weapon',
    stats: ['Splash radius: 55', 'Splash hits deal 60% of base click damage'],
    clickEffects: [{ type: 'splash', radius: 55, damageScale: 0.6 }]
  },
  crossbowCharm: {
    id: 'crossbowCharm',
    name: 'Clockwork Familiar',
    description:
      'A mechanical sparrow that mimics your strikes, pecking at foes even while you reposition.',
    role: 'Automation — provides steady passive clicks between manual bursts.',
    cost: 70,
    icon: '🕰️',
    unique: true,
    category: 'weapon',
    stats: ['Auto-click every 0.8s', 'Auto-clicks deal 80% of base damage'],
    clickEffects: [{ type: 'auto', damageScale: 0.8, interval: 0.8 }]
  },
  smokeBombSatchel: {
    id: 'smokeBombSatchel',
    name: 'Frost Reliquary',
    description:
      'A crystal reliquary that chills through contact. Each click leaves foes brittle and sluggish.',
    role: 'Crowd control — freezes targets after repeated hits.',
    cost: 60,
    icon: '❄️',
    unique: true,
    category: 'weapon',
    stats: ['Freezes targets to 35% speed', 'Freeze duration: 1.2s'],
    clickEffects: [{ type: 'freeze', factor: 0.35, duration: 1.2 }]
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
