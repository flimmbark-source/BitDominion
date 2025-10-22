export type ItemId = 'bow' | 'scoutBoots' | 'lightQuiver';

export interface ItemDefinition {
  readonly id: ItemId;
  readonly name: string;
  readonly description: string;
  readonly cost: number;
  readonly icon: string;
  readonly unique?: boolean;
}

export const ITEM_DEFINITIONS: Record<ItemId, ItemDefinition> = {
  bow: {
    id: 'bow',
    name: 'Waywatch Bow',
    description: 'Grants the knight a ranged attack. You begin the mission with this heirloom.',
    cost: 0,
    icon: '🏹',
    unique: true
  },
  scoutBoots: {
    id: 'scoutBoots',
    name: 'Scout Boots',
    description: 'Soft leather boots that increase the knight\'s stride and movement speed by 15%.',
    cost: 40,
    icon: '🥾',
    unique: true
  },
  lightQuiver: {
    id: 'lightQuiver',
    name: 'Featherlight Quiver',
    description: 'Balanced arrows and a lighter draw reduce bow cooldown by 30%.',
    cost: 45,
    icon: '🎯',
    unique: true
  }
};

export const ITEM_ORDER: readonly ItemId[] = ['bow', 'scoutBoots', 'lightQuiver'];
