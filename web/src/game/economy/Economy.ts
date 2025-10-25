import { Config } from '../../config/config';
import type { Village } from '../../darkSurge/Village';

interface EconomyHooks {
  readonly getGold: () => number;
  readonly addGold: (amount: number) => void;
  readonly spendGold: (amount: number) => boolean;
}

export interface RepairResult {
  readonly spent: number;
  readonly restoredHp: number;
}

export class Economy {
  private readonly hooks: EconomyHooks;

  constructor(hooks: EconomyHooks) {
    this.hooks = hooks;
  }

  awardSurvivalBonus(villages: readonly Village[]): number {
    const surviving = villages.filter((village) => !village.isDestroyed()).length;
    if (surviving <= 0) {
      return 0;
    }
    const amount = surviving * Config.economy.baseGoldPerVillage;
    if (amount > 0) {
      this.hooks.addGold(amount);
    }
    return amount;
  }

  getVillageRepairCost(village: Village): number {
    if (village.isDestroyed()) {
      return 0;
    }
    const missing = village.getRepairableHp();
    if (missing <= 0) {
      return 0;
    }
    return Math.ceil(missing * Config.economy.repairCostPerHP);
  }

  tryRepairVillage(village: Village): RepairResult | null {
    const cost = this.getVillageRepairCost(village);
    if (cost <= 0) {
      return null;
    }
    if (!this.hooks.spendGold(cost)) {
      return null;
    }
    const restored = village.repairStructuresFully();
    if (restored <= 0) {
      // Nothing to repair after spending; refund to keep state consistent.
      this.hooks.addGold(cost);
      return null;
    }
    return { spent: cost, restoredHp: restored };
  }

  canAfford(amount: number): boolean {
    if (amount <= 0) {
      return true;
    }
    return this.hooks.getGold() >= amount;
  }
}
