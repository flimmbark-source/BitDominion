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
  readonly buildPaths: readonly string[];
}

export const ITEM_DEFINITIONS: Record<ItemId, ItemDefinition> = {
  steelSword: {
    id: 'steelSword',
    name: 'Knightblade',
    description:
      'Tempered steel blade that keeps the knight lethal up close with wide melee sweeps and reliable crowd control.',
    role: 'Melee core — anchors bruiser builds and rewards staying in the fray.',
    cost: 0,
    icon: '🗡️',
    unique: true,
    category: 'weapon',
    buildPaths: [
      'Pair with Ember Torch or barricades to create a burning front line.',
      'Stack Hunter Jerky for heavy-hitting melee crits.'
    ]
  },
  scoutBoots: {
    id: 'scoutBoots',
    name: 'Scout Boots',
    description:
      'Supple leather boots that grant +15% stride speed and convert completed rescues into bonus evolution progress.',
    role: 'Mobility support — rewards questing and map control playstyles.',
    cost: 55,
    icon: '🥾',
    unique: true,
    category: 'support',
    buildPaths: [
      'Rush ranged items like Throwing Knives or Crossbow Charm to kite efficiently.',
      'Chain with Smoke Bomb Satchel for escape-heavy trap builds.'
    ]
  },
  hunterJerky: {
    id: 'hunterJerky',
    name: 'Hunter Jerky',
    description:
      'Smoked stag strips fortify resolve with +20% weapon damage and increased kill mastery gains.',
    role: 'Damage support — accelerates offensive evolutions.',
    cost: 60,
    icon: '🥩',
    unique: true,
    category: 'support',
    buildPaths: [
      'Combine with Throwing Knives for rapid Poison Dagger unlocks.',
      'Feed Ember Torch or Knightblade with extra burn damage.'
    ]
  },
  throwingKnife: {
    id: 'throwingKnife',
    name: 'Throwing Knife',
    description:
      'Launches an automatic flurry of daggers toward the nearest foe, shredding front lines from range.',
    role: 'Ranged pressure — excels at thinning waves before they reach you.',
    cost: 0,
    icon: '🔪',
    unique: true,
    category: 'weapon',
    evolveRequirement: { type: 'kills', count: 25, label: 'Knife kills' },
    evolution: {
      name: 'Poison Daggers',
      description: 'Adds a third dagger, inflicts venom DoT, and increases spread for lane coverage.'
    },
    buildPaths: [
      'Pair with mobility from Scout Boots to kite while blades clean up.',
      'Add Hunter Jerky to accelerate kill requirements and boost damage.'
    ]
  },
  torch: {
    id: 'torch',
    name: 'Ember Torch',
    description:
      'Three flames orbit the knight, burning anything that ventures into melee range.',
    role: 'Zone control — locks down melee clusters around the hero.',
    cost: 35,
    icon: '🔥',
    unique: true,
    category: 'weapon',
    evolveRequirement: { type: 'rescues', count: 3, label: 'Village rescues' },
    evolution: {
      name: 'Inferno Ring',
      description: 'Expands the orbit, increases burn damage, and brands enemies with lingering fire.'
    },
    buildPaths: [
      'Layer with Knightblade for an aggressive melee bruiser setup.',
      'Guard choke points with traps while flames mop up stragglers.'
    ]
  },
  crossbowCharm: {
    id: 'crossbowCharm',
    name: 'Crossbow Charm',
    description:
      'Summons an ethereal arbalest that stalks the nearest target with precise bolts.',
    role: 'Precision ranged — excels at sniping elite threats before they reach your lines.',
    cost: 70,
    icon: '🏹',
    unique: true,
    category: 'weapon',
    evolveRequirement: { type: 'kills', count: 35, label: 'Charm kills' },
    evolution: {
      name: 'Repeating Arbalest',
      description: 'Fires twin piercing bolts and shortens the reload for relentless boss pressure.'
    },
    buildPaths: [
      'Anchor a pure ranged kit with Throwing Knives for crossfire coverage.',
      'Combine with Smoke Bomb Satchel to slow enemies into its firing lane.'
    ]
  },
  smokeBombSatchel: {
    id: 'smokeBombSatchel',
    name: 'Smoke Bomb Satchel',
    description:
      'Deploys periodic smoke clouds that slow pursuers and break line of sight.',
    role: 'Control & traps — manipulates patrols and protects objective play.',
    cost: 45,
    icon: '💨',
    unique: true,
    category: 'weapon',
    evolveRequirement: { type: 'rescues', count: 4, label: 'Rescued villagers' },
    evolution: {
      name: 'Cloak Field Weave',
      description: 'Creates larger, longer-lasting fields that grant brief invisibility and stronger slows.'
    },
    buildPaths: [
      'Layer traps with Spike structures for a denial-heavy defense.',
      'Pair with ranged weapons so slowed enemies stay inside damage zones.'
    ]
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
