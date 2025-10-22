import {
  CASTLE_POS,
  CHEAPEST_UNIT_COST,
  DARK_LORD_ENERGY_PER_SEC,
  MAX_UNITS,
  UNIT_STATS,
  UnitType
} from '../config/constants';
import { Vector2 } from '../math/vector2';
import type { Game } from '../game';

export class DarkLordAI {
  public evilEnergy = 0;
  private energyAccumulator = 0;
  private lastDeployedWave = 0;

  update(dt: number, _game: Game): void {
    this.accumulateEnergy(dt);
  }

  beginWave(game: Game, waveIndex: number): void {
    if (waveIndex <= this.lastDeployedWave) {
      return;
    }
    this.lastDeployedWave = waveIndex;

    if (this.evilEnergy < CHEAPEST_UNIT_COST) {
      return;
    }

    const composition = this.planWaveComposition(game, waveIndex);
    if (!composition.length) {
      return;
    }

    const rally = game.getWaveRallyPoint() ?? CASTLE_POS.clone();
    for (const type of composition) {
      if (!game.canSpawnMoreUnits()) {
        break;
      }
      if (!this.spawnUnit(game, type, this.jitter(rally, 18))) {
        break;
      }
    }
  }

  registerKnightReveal(_position: Vector2): void {
    // Wave deployments are pre-planned, so reactive spawns are ignored.
  }

  private planWaveComposition(game: Game, waveIndex: number): UnitType[] {
    const lineup: UnitType[] = [];
    let budget = this.evilEnergy;
    if (budget < CHEAPEST_UNIT_COST) {
      return lineup;
    }

    const capacity = Math.max(0, MAX_UNITS - game.getUnitCount());
    if (capacity === 0) {
      return lineup;
    }

    const tankGoal = Math.min(capacity, Math.max(1, Math.floor((waveIndex + 1) / 2)));
    const priestGoal = Math.min(capacity, Math.max(1, Math.floor((waveIndex + 2) / 3)));
    const scoutGoal = Math.min(capacity, Math.max(3, 4 + waveIndex));

    const pushType = (type: UnitType, count: number) => {
      for (let i = 0; i < count; i++) {
        if (lineup.length >= capacity) {
          return;
        }
        const cost = UNIT_STATS[type].cost;
        if (budget < cost) {
          return;
        }
        lineup.push(type);
        budget -= cost;
      }
    };

    pushType('tank', tankGoal);
    pushType('priest', priestGoal);
    pushType('scout', scoutGoal);

    while (budget >= UNIT_STATS.scout.cost && lineup.length < capacity) {
      lineup.push('scout');
      budget -= UNIT_STATS.scout.cost;
    }

    return lineup;
  }

  private accumulateEnergy(dt: number): void {
    this.energyAccumulator += dt * DARK_LORD_ENERGY_PER_SEC;
    if (this.energyAccumulator >= 1) {
      const gained = Math.floor(this.energyAccumulator);
      this.evilEnergy += gained;
      this.energyAccumulator -= gained;
    }
  }

  private spawnUnit(game: Game, type: UnitType, position: Vector2): boolean {
    if (!this.canAfford(type)) {
      return false;
    }
    const unit = game.spawnUnit(type, position);
    if (!unit) {
      return false;
    }
    this.evilEnergy -= UNIT_STATS[type].cost;
    return true;
  }

  private canAfford(type: UnitType): boolean {
    return this.evilEnergy >= UNIT_STATS[type].cost;
  }

  private jitter(position: Vector2, radius: number): Vector2 {
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * radius;
    return position
      .clone()
      .add(new Vector2(Math.cos(angle) * distance, Math.sin(angle) * distance));
  }
}
