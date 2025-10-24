import type { ItemDefinition, ItemId, WeaponItemId } from './items';
import { ITEM_DEFINITIONS } from './items';

export type MetaUpgradeId =
  | 'throwingKnife_unlock'
  | 'throwingKnife_toxins'
  | 'throwingKnife_masterwork'
  | 'torch_unlock'
  | 'torch_pyrebloom'
  | 'torch_cinderstorm'
  | 'crossbowCharm_unlock'
  | 'crossbowCharm_overdraw'
  | 'crossbowCharm_barbedBolts'
  | 'smokeBombSatchel_unlock'
  | 'smokeBombSatchel_catalyst'
  | 'smokeBombSatchel_midnightVeil';

export interface MetaUpgradeDefinition {
  readonly id: MetaUpgradeId;
  readonly weaponId: WeaponItemId;
  readonly name: string;
  readonly description: string;
  readonly cost: number;
  readonly tier: number;
  readonly prerequisites: readonly MetaUpgradeId[];
}

export interface MetaWeaponTrack {
  readonly weaponId: WeaponItemId;
  readonly overview: string;
  readonly upgrades: readonly MetaUpgradeId[];
}

const getWeaponDefinition = (weaponId: WeaponItemId): ItemDefinition => {
  const definition = ITEM_DEFINITIONS[weaponId as ItemId];
  if (!definition || definition.category !== 'weapon') {
    throw new Error(`Missing weapon definition for ${weaponId}`);
  }
  return definition;
};

export const META_UPGRADES: Record<MetaUpgradeId, MetaUpgradeDefinition> = {
  throwingKnife_unlock: {
    id: 'throwingKnife_unlock',
    weaponId: 'throwingKnife',
    name: 'Armory Draft',
    description: 'Unlock Throwing Knife as an alternate starter loadout in future runs.',
    cost: 35,
    tier: 1,
    prerequisites: []
  },
  throwingKnife_toxins: {
    id: 'throwingKnife_toxins',
    weaponId: 'throwingKnife',
    name: 'Nightshade Coating',
    description: 'Evolved daggers inflict +30% poison damage and extend duration by 3s.',
    cost: 55,
    tier: 2,
    prerequisites: ['throwingKnife_unlock']
  },
  throwingKnife_masterwork: {
    id: 'throwingKnife_masterwork',
    weaponId: 'throwingKnife',
    name: 'Masterwork Blades',
    description: 'Base daggers pierce one extra target before evolving.',
    cost: 80,
    tier: 3,
    prerequisites: ['throwingKnife_toxins']
  },
  torch_unlock: {
    id: 'torch_unlock',
    weaponId: 'torch',
    name: 'Citadel Forge',
    description: 'Unlock Ember Torch as a guaranteed starter option.',
    cost: 30,
    tier: 1,
    prerequisites: []
  },
  torch_pyrebloom: {
    id: 'torch_pyrebloom',
    weaponId: 'torch',
    name: 'Pyrebloom Resin',
    description: 'Evolved Inferno Ring ignites enemies for an additional burn stack.',
    cost: 50,
    tier: 2,
    prerequisites: ['torch_unlock']
  },
  torch_cinderstorm: {
    id: 'torch_cinderstorm',
    weaponId: 'torch',
    name: 'Cinderstorm Patterns',
    description: 'Base flames rotate 20% faster before evolving.',
    cost: 75,
    tier: 3,
    prerequisites: ['torch_pyrebloom']
  },
  crossbowCharm_unlock: {
    id: 'crossbowCharm_unlock',
    weaponId: 'crossbowCharm',
    name: 'Ghostfletching',
    description: 'Unlock Crossbow Charm for the starting arsenal.',
    cost: 40,
    tier: 1,
    prerequisites: []
  },
  crossbowCharm_overdraw: {
    id: 'crossbowCharm_overdraw',
    weaponId: 'crossbowCharm',
    name: 'Overdraw Winch',
    description: 'Evolved Repeating Arbalest bolts deal +25% damage to elites.',
    cost: 60,
    tier: 2,
    prerequisites: ['crossbowCharm_unlock']
  },
  crossbowCharm_barbedBolts: {
    id: 'crossbowCharm_barbedBolts',
    weaponId: 'crossbowCharm',
    name: 'Barbed Bolts',
    description: 'Base charm attacks bleed for 12 damage over 4 seconds before evolving.',
    cost: 85,
    tier: 3,
    prerequisites: ['crossbowCharm_overdraw']
  },
  smokeBombSatchel_unlock: {
    id: 'smokeBombSatchel_unlock',
    weaponId: 'smokeBombSatchel',
    name: 'Pocket Furnace',
    description: 'Unlock Smoke Bomb Satchel as a starting gadget.',
    cost: 32,
    tier: 1,
    prerequisites: []
  },
  smokeBombSatchel_catalyst: {
    id: 'smokeBombSatchel_catalyst',
    weaponId: 'smokeBombSatchel',
    name: 'Catalyst Powder',
    description: 'Evolved Cloak Field Weave slows enemies an additional 20%.',
    cost: 58,
    tier: 2,
    prerequisites: ['smokeBombSatchel_unlock']
  },
  smokeBombSatchel_midnightVeil: {
    id: 'smokeBombSatchel_midnightVeil',
    weaponId: 'smokeBombSatchel',
    name: 'Midnight Veil Stitching',
    description: 'Base smoke clouds grant 0.5s of invisibility before evolving.',
    cost: 78,
    tier: 3,
    prerequisites: ['smokeBombSatchel_catalyst']
  }
};

export const META_WEAPON_TRACKS: readonly MetaWeaponTrack[] = (
  ['throwingKnife', 'torch', 'crossbowCharm', 'smokeBombSatchel'] as const
).map((weaponId) => {
  const definition = getWeaponDefinition(weaponId);
  const upgrades = Object.values(META_UPGRADES)
    .filter((upgrade) => upgrade.weaponId === weaponId)
    .sort((a, b) => a.tier - b.tier);

  return {
    weaponId,
    overview: `${definition.role} Invest Relic Shards to tailor ${definition.name} for future runs.`,
    upgrades: upgrades.map((upgrade) => upgrade.id)
  };
});

export function getMetaUpgradesForWeapon(weaponId: WeaponItemId): readonly MetaUpgradeDefinition[] {
  return Object.values(META_UPGRADES)
    .filter((upgrade) => upgrade.weaponId === weaponId)
    .sort((a, b) => a.tier - b.tier);
}

export function getMetaUpgradeDefinition(id: MetaUpgradeId): MetaUpgradeDefinition {
  const definition = META_UPGRADES[id];
  if (!definition) {
    throw new Error(`Unknown meta upgrade: ${id}`);
  }
  return definition;
}

export function getWeaponDefinitionForMeta(weaponId: WeaponItemId): ItemDefinition {
  return getWeaponDefinition(weaponId);
}
