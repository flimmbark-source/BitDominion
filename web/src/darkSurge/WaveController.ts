import { Vector2 } from '../math/vector2';
import type { EnemyRuntimeStats } from './EnemySwarm';

export interface SpawnConfig {
  baseCount: number;
  countGrowth: number;
  burstSize: number;
  intervalSeconds: number;
  maxActive: number;
}

export interface EnemyConfig {
  baseHp: number;
  hpGrowth: number;
  baseSpeed: number;
  speedGrowth: number;
  baseDamage: number;
  damageGrowth: number;
  attackInterval: number;
  separationRadius: number;
  separationWeight: number;
  alignmentWeight: number;
  cohesionWeight: number;
}

export interface VillageConfig {
  hpPerBuilding: number;
  igniteThreshold: number;
  burnDamagePerSecond: number;
  collapseDelay: number;
  incomePerBuilding: number;
  repairFraction: number;
}

export interface WaveConfig {
  downtimeSeconds: number;
  spawn: SpawnConfig;
  enemy: EnemyConfig;
  village: VillageConfig;
}

export interface WaveSpawnRequest {
  position: Vector2;
  stats: EnemyRuntimeStats;
}

export interface WaveControllerContext {
  activeEnemies: number;
  canSpawn: () => boolean;
  spawn: (request: WaveSpawnRequest) => void;
  onWaveComplete?: () => void;
}

export class WaveController {
  private readonly castlePosition: Vector2;
  private readonly config: WaveConfig;

  private spawnQueue = 0;
  private spawnTimer = 0;
  private state: 'idle' | 'spawning' = 'idle';
  private waveIndex = 0;
  private waveActive = false;

  constructor(config: WaveConfig, options: { castlePosition: Vector2 }) {
    this.config = config;
    this.castlePosition = options.castlePosition.clone();
  }

  getDowntimeDuration(): number {
    return this.config.downtimeSeconds;
  }

  getMaxActive(): number {
    return this.config.spawn.maxActive;
  }

  isWaveRunning(): boolean {
    return this.waveActive;
  }

  startWave(waveIndex: number): void {
    this.waveIndex = waveIndex;
    this.spawnQueue = this.computeSpawnCount(waveIndex);
    this.spawnTimer = 0;
    this.state = 'spawning';
    this.waveActive = true;
  }

  beginDowntime(): void {
    this.state = 'idle';
    this.spawnQueue = 0;
    this.spawnTimer = 0;
    this.waveActive = false;
  }

  update(dt: number, context: WaveControllerContext): void {
    if (this.state !== 'spawning') {
      return;
    }

    this.spawnTimer -= dt;

    while (this.spawnQueue > 0 && this.spawnTimer <= 0) {
      if (!context.canSpawn()) {
        this.spawnTimer = 0;
        break;
      }
      const burst = Math.min(this.config.spawn.burstSize, this.spawnQueue);
      const stats = this.buildEnemyStats(this.waveIndex);
      for (let i = 0; i < burst; i++) {
        const spawnPoint = this.pickSpawnPoint();
        context.spawn({ position: spawnPoint, stats });
      }
      this.spawnQueue -= burst;
      this.spawnTimer += this.config.spawn.intervalSeconds;
    }

    if (this.spawnQueue <= 0 && context.activeEnemies === 0) {
      this.state = 'idle';
      if (this.waveActive) {
        this.waveActive = false;
        context.onWaveComplete?.();
      }
    }
  }

  private computeSpawnCount(waveIndex: number): number {
    const base = this.config.spawn.baseCount;
    const growth = this.config.spawn.countGrowth;
    return Math.max(this.config.spawn.burstSize, Math.round(base + growth * waveIndex));
  }

  private buildEnemyStats(waveIndex: number): EnemyRuntimeStats {
    const enemy = this.config.enemy;
    const hp = Math.max(1, Math.round(enemy.baseHp + enemy.hpGrowth * waveIndex));
    const speed = Math.max(10, enemy.baseSpeed + enemy.speedGrowth * waveIndex);
    const damage = Math.max(1, enemy.baseDamage + enemy.damageGrowth * waveIndex);
    return {
      maxHp: hp,
      speed,
      damage,
      attackInterval: Math.max(0.4, enemy.attackInterval),
      separationRadius: enemy.separationRadius,
      separationWeight: enemy.separationWeight,
      alignmentWeight: enemy.alignmentWeight,
      cohesionWeight: enemy.cohesionWeight
    };
  }

  private pickSpawnPoint(): Vector2 {
    const angle = Math.random() * Math.PI * 2;
    const radius = 26 + Math.random() * 18;
    const offset = new Vector2(Math.cos(angle), Math.sin(angle)).scale(radius);
    return this.castlePosition.clone().add(offset);
  }
}
