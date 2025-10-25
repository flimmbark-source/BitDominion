import { Config } from '../../config/config';
import { Vector2 } from '../../math/vector2';
import type { SwarmStats } from '../enemies/EnemySwarm';

export type WaveControllerState = 'waiting' | 'wave' | 'prep';

export interface SwarmSpawnRequest {
  spawnPosition: Vector2;
  heading: number;
  stats: SwarmStats;
  memberCount: number;
  waveIndex: number;
}

export interface WaveControllerHooks {
  spawnSwarm: (request: SwarmSpawnRequest) => void;
  onWaveStart?: (waveIndex: number) => void;
  onWaveComplete?: (waveIndex: number) => void;
}

export class WaveController {
  private readonly castlePosition: Vector2;
  private state: WaveControllerState = 'waiting';
  private timer: number;
  private waveIndex = 0;
  private activeSwarms = 0;
  private pendingCompletion = false;

  constructor(options: { castlePosition: Vector2 }) {
    this.castlePosition = options.castlePosition.clone();
    this.timer = Config.waves.firstDelayMs / 1000;
  }

  update(dt: number, hooks: WaveControllerHooks): void {
    if (this.state === 'wave') {
      if (this.pendingCompletion || this.activeSwarms === 0) {
        this.completeWave(hooks);
      }
      return;
    }

    if (dt > 0) {
      this.timer = Math.max(0, this.timer - dt);
    }

    if (this.timer <= 0) {
      this.startNextWave(hooks);
    }
  }

  notifySwarmDestroyed(): void {
    if (this.state !== 'wave') {
      return;
    }
    if (this.activeSwarms <= 0) {
      return;
    }
    this.activeSwarms -= 1;
    if (this.activeSwarms === 0) {
      this.pendingCompletion = true;
    }
  }

  getState(): WaveControllerState {
    return this.state;
  }

  getWaveIndex(): number {
    return this.waveIndex;
  }

  getStateTimer(): number {
    return Math.max(0, this.timer);
  }

  isWaveActive(): boolean {
    return this.state === 'wave';
  }

  getActiveSwarmCount(): number {
    return this.activeSwarms;
  }

  private startNextWave(hooks: WaveControllerHooks): void {
    this.waveIndex += 1;
    this.state = 'wave';
    this.pendingCompletion = false;

    const groupCount = this.clampGroupCount(Config.waves.swarmGroupsByWave(this.waveIndex));
    const memberCount = Math.max(1, Math.round(Config.waves.enemiesPerSwarm(this.waveIndex)));
    const stats = this.buildSwarmStats(this.waveIndex);
    const baseAngle = Math.random() * Math.PI * 2;
    this.activeSwarms = groupCount;

    for (let i = 0; i < groupCount; i++) {
      const spread = (i / groupCount) * Math.PI * 2;
      const jitter = (Math.random() - 0.5) * (Math.PI / Math.max(1, groupCount));
      const angle = baseAngle + spread + jitter;
      const spawnPosition = this.computeSpawnPosition(angle);
      hooks.spawnSwarm({
        spawnPosition,
        heading: angle,
        stats,
        memberCount,
        waveIndex: this.waveIndex
      });
    }

    hooks.onWaveStart?.(this.waveIndex);
  }

  private completeWave(hooks: WaveControllerHooks): void {
    if (this.state !== 'wave') {
      return;
    }
    this.state = 'prep';
    this.pendingCompletion = false;
    this.activeSwarms = 0;
    this.timer = Config.waves.prepWindowMs / 1000;
    hooks.onWaveComplete?.(this.waveIndex);
  }

  private clampGroupCount(count: number): number {
    return Math.max(3, Math.min(6, Math.round(count)));
  }

  private computeSpawnPosition(angle: number): Vector2 {
    const radius = 48;
    const direction = new Vector2(Math.cos(angle), Math.sin(angle));
    return this.castlePosition.clone().add(direction.scale(radius));
  }

  private buildSwarmStats(waveIndex: number): SwarmStats {
    const base = Config.waves.enemyBase;
    const firstWaveHp = Config.waves.firstWaveEnemyHp ?? base.hp + 12;
    const hp =
      waveIndex === 1
        ? firstWaveHp
        : Math.max(1, base.hp + waveIndex * 12);
    const damage = base.atk + waveIndex * 2;
    const speed = base.speed + Math.min(12, waveIndex * 2);
    return { hp, damage, speed };
  }
}
