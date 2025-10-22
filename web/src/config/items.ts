export type WeaponItemId = 'throwingKnife' | 'torch' | 'crossbowCharm' | 'smokeBombSatchel';
export type SupportItemId = 'scoutBoots' | 'hunterJerky';
export type ItemId = WeaponItemId | SupportItemId;

export type ItemCategory = 'weapon' | 'support';

export interface ItemDefinition {
  readonly id: ItemId;
  readonly name: string;
  readonly description: string;
  readonly cost: number;
  readonly icon: string;
  readonly unique?: boolean;
  readonly category: ItemCategory;
  readonly evolveRequirement?: {
    readonly type: 'kills' | 'rescues';
    readonly count: number;
    readonly label: string;
  };
}

export const ITEM_DEFINITIONS: Record<ItemId, ItemDefinition> = {
  scoutBoots: {
    id: 'scoutBoots',
    name: 'Scout Boots',
    description:
      'Supple leather boots that increase stride speed by 15% and convert each completed quest into bonus weapon mastery.',
    cost: 55,
    icon: '🥾',
    unique: true,
    category: 'support'
  },
  hunterJerky: {
    id: 'hunterJerky',
    name: 'Hunter Jerky',
    description:
      'Smoked stag strips that harden resolve. Grants +20% weapon damage and adds a kill streak bonus toward evolutions.',
    cost: 60,
    icon: '🥩',
    unique: true,
    category: 'support'
  },
  throwingKnife: {
    id: 'throwingKnife',
    name: 'Throwing Knife',
    description:
      'Automatic flurry of forward daggers. Evolves into Poison Daggers after 25 kills, applying venom over time.',
    cost: 0,
    icon: '🔪',
    unique: true,
    category: 'weapon',
    evolveRequirement: { type: 'kills', count: 25, label: 'Knife kills' }
  },
  torch: {
    id: 'torch',
    name: 'Ember Torch',
    description:
      'A trio of flames orbit the hero, scorching nearby foes. Complete 3 rescues to upgrade into the Inferno Ring.',
    cost: 35,
    icon: '🔥',
    unique: true,
    category: 'weapon',
    evolveRequirement: { type: 'rescues', count: 3, label: 'Village rescues' }
  },
  crossbowCharm: {
    id: 'crossbowCharm',
    name: 'Crossbow Charm',
    description:
      'Summons an ethereal arbalest that shoots the nearest enemy. Score 35 kills to craft the Repeating Arbalest.',
    cost: 70,
    icon: '🏹',
    unique: true,
    category: 'weapon',
    evolveRequirement: { type: 'kills', count: 35, label: 'Charm kills' }
  },
  smokeBombSatchel: {
    id: 'smokeBombSatchel',
    name: 'Smoke Bomb Satchel',
    description:
      'Periodic smoke clouds slow pursuers. Complete 4 rescues to weave cloaking fields around the hero.',
    cost: 45,
    icon: '💨',
    unique: true,
    category: 'weapon',
    evolveRequirement: { type: 'rescues', count: 4, label: 'Rescued villagers' }
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
