import {
  CASTLE_POS,
  CHEAPEST_UNIT_COST,
  DARK_LORD_ENERGY_PER_SEC,
  DARK_LORD_REVEAL_MEMORY,
  DARK_LORD_SPAWN_INTERVAL,
  UNIT_STATS,
  UnitType
} from '../config/constants';
import { Vector2 } from '../math/vector2';
import type { Game } from '../game';

export class DarkLordAI {
  public evilEnergy = 0;
  private energyAccumulator = 0;
  private spawnTimer = 0;
  private knightRevealPos: Vector2 | null = null;
  private knightRevealTimer = 0;

  update(dt: number, game: Game): void {
    this.accumulateEnergy(dt);
    this.decayReveal(dt);

    this.spawnTimer += dt;
    while (this.spawnTimer >= DARK_LORD_SPAWN_INTERVAL) {
      this.spawnTimer -= DARK_LORD_SPAWN_INTERVAL;
      this.trySpawn(game);
    }
  }

  registerKnightReveal(position: Vector2): void {
    this.knightRevealPos = position.clone();
    this.knightRevealTimer = DARK_LORD_REVEAL_MEMORY;
  }

  private accumulateEnergy(dt: number): void {
    this.energyAccumulator += dt * DARK_LORD_ENERGY_PER_SEC;
    if (this.energyAccumulator >= 1) {
      const gained = Math.floor(this.energyAccumulator);
      this.evilEnergy += gained;
      this.energyAccumulator -= gained;
    }
  }

  private decayReveal(dt: number): void {
    if (this.knightRevealTimer > 0) {
      this.knightRevealTimer = Math.max(0, this.knightRevealTimer - dt);
      if (this.knightRevealTimer === 0) {
        this.knightRevealPos = null;
      }
    }
  }

  private trySpawn(game: Game): void {
    if (this.evilEnergy < CHEAPEST_UNIT_COST) {
      return;
    }
    if (!game.canSpawnMoreUnits()) {
      return;
    }

    if (game.isAnySealChanneling()) {
      this.spawnResponseForSeal(game);
      return;
    }

    if (this.knightRevealPos && this.knightRevealTimer > 0) {
      this.spawnResponseToReveal(game);
      return;
    }

    this.spawnCoverageScout(game);
  }

  private spawnResponseForSeal(game: Game): void {
    const seal = game.getChannelingSeal();
    const target = seal?.pos ?? CASTLE_POS;
    const spawnPoint = game.getCastleEdgePoint(target);

    for (let i = 0; i < 2; i++) {
      if (!this.spawnUnit(game, 'scout', this.jitter(spawnPoint, 12))) {
        return;
      }
    }

    this.spawnUnit(game, 'tank', this.jitter(spawnPoint, 16));
  }

  private spawnResponseToReveal(game: Game): void {
    const location = this.knightRevealPos ?? CASTLE_POS;
    const jittered = this.jitter(location, 18);
    if (!this.spawnUnit(game, 'tank', jittered)) {
      return;
    }
    this.spawnUnit(game, 'priest', this.jitter(location, 18));
  }

  private spawnCoverageScout(game: Game): void {
    const anchor = game.getNextAnchor();
    this.spawnUnit(game, 'scout', this.jitter(anchor, 14));
  }

  private spawnUnit(game: Game, type: UnitType, position: Vector2): boolean {
    if (!this.canAfford(type)) {
      return false;
    }
    if (!game.spawnUnit(type, position)) {
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
    return position.clone().add(new Vector2(Math.cos(angle) * distance, Math.sin(angle) * distance));
  }
}
