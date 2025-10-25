import { Config } from '../../config/config';
import { CASTLE_POS, WIDTH, HEIGHT } from '../../config/constants';
import { Vector2 } from '../../math/vector2';
import type { Village } from '../../darkSurge/Village';

interface QuestSystemHooks {
  readonly grantGold: (amount: number) => void;
  readonly onProgress: (position: Vector2, amount: number) => void;
  readonly onReward: (amount: number) => void;
}

type QuestState = 'inactive' | 'active' | 'completed';

interface QuestTarget {
  readonly id: number;
  readonly position: Vector2;
  readonly radius: number;
  collected: boolean;
}

interface QuestDefinition {
  readonly id: number;
  readonly title: string;
  readonly description: string;
  readonly reward: number;
  readonly icon: string;
  readonly targets: QuestTarget[];
  state: QuestState;
}

export interface QuestHudInfo {
  readonly title: string;
  readonly description: string;
  readonly progressText: string;
  readonly rewardText: string;
  readonly completed: boolean;
}

const PEST_COUNT = 6;
const CACHE_COUNT = 3;
const TARGET_RADIUS = 26;

export class QuestSystem {
  private readonly hooks: QuestSystemHooks;
  private activeQuest: QuestDefinition | null = null;
  private downtimeActive = false;
  private targetIdCounter = 1;
  private questIdCounter = 1;
  private pulseTimer = 0;

  constructor(hooks: QuestSystemHooks) {
    this.hooks = hooks;
  }

  reset(): void {
    this.activeQuest = null;
    this.downtimeActive = false;
    this.targetIdCounter = 1;
    this.questIdCounter = 1;
    this.pulseTimer = 0;
  }

  beginDowntime(villages: readonly Village[]): void {
    this.downtimeActive = true;
    this.activeQuest = this.createQuest(villages);
  }

  endDowntime(): void {
    this.downtimeActive = false;
  }

  update(dt: number): void {
    if (dt > 0) {
      this.pulseTimer += dt;
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (!this.downtimeActive || !this.activeQuest || this.activeQuest.state === 'completed') {
      return;
    }
    ctx.save();
    for (const target of this.activeQuest.targets) {
      if (target.collected) {
        continue;
      }
      const pulse = 0.6 + Math.sin(this.pulseTimer * 4 + target.id) * 0.2;
      const radius = target.radius * pulse;
      ctx.beginPath();
      ctx.fillStyle = 'rgba(244, 114, 182, 0.45)';
      ctx.arc(target.position.x, target.position.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = '16px Inter';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fde68a';
      ctx.fillText(this.activeQuest.icon, target.position.x, target.position.y);
    }
    ctx.restore();
  }

  handlePointerDown(point: Vector2): boolean {
    if (!this.downtimeActive || !this.activeQuest || this.activeQuest.state !== 'active') {
      return false;
    }
    for (const target of this.activeQuest.targets) {
      if (target.collected) {
        continue;
      }
      const distance = target.position.distanceTo(point);
      if (distance > target.radius) {
        continue;
      }
      target.collected = true;
      this.hooks.onProgress(target.position.clone(), 1);
      if (this.activeQuest.targets.every((entry) => entry.collected)) {
        this.completeActiveQuest();
      }
      return true;
    }
    return false;
  }

  getHudInfo(): QuestHudInfo | null {
    if (!this.downtimeActive || !this.activeQuest) {
      return null;
    }
    const collected = this.activeQuest.targets.filter((target) => target.collected).length;
    const total = this.activeQuest.targets.length;
    return {
      title: this.activeQuest.title,
      description: this.activeQuest.description,
      progressText: `${collected}/${total}`,
      rewardText: `Reward: ${this.activeQuest.reward} gold`,
      completed: this.activeQuest.state === 'completed'
    };
  }

  private completeActiveQuest(): void {
    if (!this.activeQuest || this.activeQuest.state !== 'active') {
      return;
    }
    this.activeQuest.state = 'completed';
    if (this.activeQuest.reward > 0) {
      this.hooks.grantGold(this.activeQuest.reward);
      this.hooks.onReward(this.activeQuest.reward);
    }
  }

  private createQuest(villages: readonly Village[]): QuestDefinition {
    const questId = this.questIdCounter++;
    if (Math.random() < 0.5) {
      return this.createPestQuest(questId, villages);
    }
    return this.createCacheQuest(questId, villages);
  }

  private createPestQuest(id: number, villages: readonly Village[]): QuestDefinition {
    const targets = this.generateTargets(villages, PEST_COUNT, 48, 110);
    return {
      id,
      title: 'Pest Patrol',
      description: 'Click the scurrying pests bothering nearby villages.',
      reward: Config.economy.questGold.small,
      icon: '🐀',
      targets,
      state: 'active'
    };
  }

  private createCacheQuest(id: number, villages: readonly Village[]): QuestDefinition {
    const targets = this.generateTargets(villages, CACHE_COUNT, 90, 160);
    return {
      id,
      title: 'Forage Caches',
      description: 'Secure supply caches by clicking the marked crates.',
      reward: Config.economy.questGold.medium,
      icon: '📦',
      targets,
      state: 'active'
    };
  }

  private generateTargets(
    villages: readonly Village[],
    count: number,
    innerRadius: number,
    outerRadius: number
  ): QuestTarget[] {
    const results: QuestTarget[] = [];
    const sources = villages.length ? villages : null;
    for (let i = 0; i < count; i++) {
      const base = sources ? sources[i % sources.length] : null;
      const center = base ? base.center : CASTLE_POS;
      const radius = base ? base.canopyRadius + innerRadius + Math.random() * (outerRadius - innerRadius) : 120;
      const angle = Math.random() * Math.PI * 2;
      const offset = new Vector2(Math.cos(angle), Math.sin(angle)).scale(radius);
      const position = center.clone().add(offset);
      position.x = Math.max(24, Math.min(WIDTH - 24, position.x));
      position.y = Math.max(24, Math.min(HEIGHT - 24, position.y));
      results.push({
        id: this.targetIdCounter++,
        position,
        radius: TARGET_RADIUS,
        collected: false
      });
    }
    return results;
  }
}
