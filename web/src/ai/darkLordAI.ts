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

type UnitDeployment = { type: UnitType; position: Vector2 };

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
    const deployments = this.planWaveFormation(composition, rally);
    for (const { type, position } of deployments) {
      if (!game.canSpawnMoreUnits()) {
        break;
      }
      if (!this.spawnUnit(game, type, position)) {
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

  private planWaveFormation(lineup: UnitType[], rally: Vector2): UnitDeployment[] {
    if (!lineup.length) {
      return [];
    }

    const forward = rally.clone().subtract(CASTLE_POS);
    if (forward.lengthSq() < 1e-4) {
      forward.set(0, 1);
    }
    forward.normalize();
    const right = new Vector2(-forward.y, forward.x).normalize();

    const counts: Record<UnitType, number> = { scout: 0, tank: 0, priest: 0 };
    for (const type of lineup) {
      counts[type] += 1;
    }

    const slotsByType: Record<UnitType, Vector2[]> = {
      tank: this.buildTankFormation(counts.tank, rally, forward, right),
      priest: this.buildPriestFormation(counts.priest, rally, forward, right),
      scout: this.buildScoutFormation(counts.scout, rally, forward, right)
    };

    return lineup.map((type) => {
      const slots = slotsByType[type];
      const position = slots.length ? slots.shift()! : this.jitter(rally, 14);
      return { type, position };
    });
  }

  private buildTankFormation(count: number, rally: Vector2, forward: Vector2, right: Vector2): Vector2[] {
    const slots: Vector2[] = [];
    const rowSize = 2;
    const forwardStart = 34;
    const forwardStep = 20;
    const lateralSpacing = 18;
    for (let i = 0; i < count; i++) {
      const row = Math.floor(i / rowSize);
      const column = i % rowSize;
      const lateralIndex = column - (rowSize - 1) / 2;
      const forwardOffset = forwardStart + row * forwardStep;
      const lateralOffset = lateralIndex * lateralSpacing;
      const base = this.offsetFromRally(rally, forward, right, forwardOffset, lateralOffset);
      slots.push(this.jitter(base, 8));
    }
    return slots;
  }

  private buildPriestFormation(count: number, rally: Vector2, forward: Vector2, right: Vector2): Vector2[] {
    const slots: Vector2[] = [];
    const rowSize = 3;
    const forwardStart = -26;
    const forwardStep = -18;
    const lateralSpacing = 16;
    for (let i = 0; i < count; i++) {
      const row = Math.floor(i / rowSize);
      const column = i % rowSize;
      const lateralIndex = column - (rowSize - 1) / 2;
      const forwardOffset = forwardStart + row * forwardStep;
      const lateralOffset = lateralIndex * lateralSpacing;
      const base = this.offsetFromRally(rally, forward, right, forwardOffset, lateralOffset);
      slots.push(this.jitter(base, 6));
    }
    return slots;
  }

  private buildScoutFormation(count: number, rally: Vector2, forward: Vector2, right: Vector2): Vector2[] {
    const slots: Vector2[] = [];
    const lateralBase = 32;
    const lateralStep = 12;
    const forwardBase = 18;
    const forwardVariance = 10;
    for (let i = 0; i < count; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const lane = Math.floor(i / 2);
      const lateralOffset = side * (lateralBase + lane * lateralStep);
      const forwardOffset = forwardBase + (lane % 3) * forwardVariance;
      const base = this.offsetFromRally(rally, forward, right, forwardOffset, lateralOffset);
      slots.push(this.jitter(base, 12));
    }
    return slots;
  }

  private offsetFromRally(
    rally: Vector2,
    forward: Vector2,
    right: Vector2,
    forwardDistance: number,
    lateralDistance: number
  ): Vector2 {
    return rally
      .clone()
      .add(forward.clone().scale(forwardDistance))
      .add(right.clone().scale(lateralDistance));
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
