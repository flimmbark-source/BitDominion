import {
  DETECTION_TINT_LERP,
  FPS,
  KNIGHT_SIGHT_CONFIRM_TIME,
  NOISE_INVESTIGATE_RADIUS,
  NOISE_INVESTIGATE_TIME,
  PATROL_ANCHOR_RADIUS,
  PRIEST_REVEAL_DURATION,
  PRIEST_REVEAL_RADIUS,
  PRIEST_REVEAL_SUSPICION,
  PRIEST_REVEAL_WARMUP,
  SEARCH_DURATION,
  SEARCH_RADIUS_GROWTH,
  SEARCH_SPIN_SPEED,
  TANK_CHASE_PERSIST_DISTANCE,
  TANK_KNOCKBACK_STRENGTH,
  UNIT_COLORS,
  UNIT_DAMAGE_COOLDOWN,
  UNIT_DETECTION_LERP,
  UNIT_STATS,
  UNIT_WANDER_INTERVAL,
  UnitType
} from '../config/constants';
import { Vector2 } from '../math/vector2';
import { mixColors } from '../utils/color';
import type { Game } from '../game';
import type { World } from '../world';
import type { Knight } from './knight';

export type DarkUnitBehavior = 'idle' | 'chasing' | 'searching' | 'investigating';

export class DarkUnit {
  public velocity = new Vector2();
  public detecting = false;
  public wanderTimer = 0;
  public damageTimer = 0;
  public alive = true;
  public hp: number;
  public behavior: DarkUnitBehavior = 'idle';

  private lineOfSightTimer = 0;
  private searchTimer = 0;
  private searchAngle = 0;
  private searchRadius = 0;
  private searchOrigin: Vector2 | null = null;
  private investigationTimer = 0;
  private investigationTarget: Vector2 | null = null;
  private detectionTint = 0;
  private priestProximityTimer = 0;
  private priestRevealTimer = 0;
  private roadAssistTimer = 0;

  constructor(public pos: Vector2, public readonly type: UnitType) {
    this.hp = UNIT_STATS[type].maxHp;
    this.pickNewDirection();
  }

  update(dt: number, knight: Knight, game: Game, world: World): void {
    if (!this.alive) {
      return;
    }

    const dtRatio = dt * FPS;
    const stats = UNIT_STATS[this.type];
    const toKnight = knight.pos.clone().subtract(this.pos);
    const distance = toKnight.length();
    const previouslyDetecting = this.detecting;
    const seesKnight = distance <= stats.detectionRadius && world.hasLineOfSight(this.pos, knight.pos);
    const tankCanPersist = this.canTankPersist(distance, stats);
    if (seesKnight) {
      this.detecting = true;
    } else if (!tankCanPersist) {
      this.detecting = false;
    }

    if (seesKnight && distance > 0) {
      this.lineOfSightTimer += dt;
      if (this.lineOfSightTimer >= KNIGHT_SIGHT_CONFIRM_TIME && this.lineOfSightTimer - dt < KNIGHT_SIGHT_CONFIRM_TIME) {
        if (this.type === 'scout') {
          console.log(
            `[SCOUT] Howl! Knight spotted at (${knight.pos.x.toFixed(0)}, ${knight.pos.y.toFixed(0)})`
          );
        }
        game.registerKnightSighting(knight.pos);
      }
      this.behavior = 'chasing';
      this.searchTimer = SEARCH_DURATION;
      this.searchOrigin = knight.pos.clone();
    } else {
      if (previouslyDetecting && this.behavior === 'chasing' && !tankCanPersist) {
        this.beginSearch(game);
      }
      if (!tankCanPersist) {
        this.lineOfSightTimer = 0;
      } else {
        this.behavior = 'chasing';
      }
    }

    if (this.behavior === 'investigating' && this.detecting) {
      this.investigationTimer = 0;
      this.investigationTarget = null;
    }

    this.updateDetectionTint(dtRatio);
    this.updatePriestReveal(dt, distance, knight, game);
    if (this.roadAssistTimer > 0) {
      this.roadAssistTimer = Math.max(0, this.roadAssistTimer - dt);
    }

    switch (this.behavior) {
      case 'chasing':
        if (world.isPointOnRoad(this.pos)) {
          this.roadAssistTimer = Math.max(this.roadAssistTimer, 2);
        }
        this.steerTowards(knight.pos, stats.maxSpeed, dtRatio, UNIT_DETECTION_LERP, this.roadAssistTimer > 0);
        break;
      case 'searching':
        if (world.isPointOnRoad(this.pos)) {
          this.roadAssistTimer = Math.max(this.roadAssistTimer, 2);
        }
        this.updateSearch(dt, game, stats, dtRatio, world);
        break;
      case 'investigating':
        this.updateInvestigation(dt, stats, dtRatio);
        break;
      default:
        this.updateIdle(dt, game, stats, dtRatio);
        break;
    }

    world.applyTerrainSteering(this, this.getHalfSize(), dt);
    this.pos.add(this.velocity.clone().scale(dtRatio));
    world.resolveStaticCollisions(this.pos, this.getHalfSize());
    world.constrainToArena(this, this.getHalfSize(), { bounce: true });

    if (this.damageTimer > 0) {
      this.damageTimer = Math.max(0, this.damageTimer - dt);
    }
  }

  startInvestigation(position: Vector2): void {
    if (!this.alive || this.behavior === 'chasing') {
      return;
    }
    this.behavior = 'investigating';
    this.investigationTimer = NOISE_INVESTIGATE_TIME;
    this.investigationTarget = position.clone();
  }

  notifyNoise(position: Vector2): void {
    if (!this.alive || this.type !== 'scout' || this.behavior !== 'idle') {
      return;
    }
    if (this.pos.distanceTo(position) <= NOISE_INVESTIGATE_RADIUS) {
      this.startInvestigation(position);
    }
  }

  receiveArcHit(knight: Knight): boolean {
    if (!this.alive) {
      return false;
    }
    this.takeDamage(1);
    if (this.type === 'tank') {
      this.applyTankKnockback(knight);
    }
    return !this.alive;
  }

  attemptDamage(knight: Knight): boolean {
    if (!this.alive || this.damageTimer > 0) {
      return false;
    }
    if (this.pos.distanceTo(knight.pos) < 6) {
      this.damageTimer = UNIT_DAMAGE_COOLDOWN;
      knight.hp = Math.max(0, knight.hp - 1);
      return true;
    }
    return false;
  }

  takeDamage(amount: number): void {
    this.hp = Math.max(0, this.hp - amount);
    if (this.hp === 0) {
      this.alive = false;
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (!this.alive) {
      return;
    }
    const colors = UNIT_COLORS[this.type];
    const half = this.getHalfSize();
    const blended = mixColors(colors.base, colors.alert, this.detectionTint);
    const fill = this.detecting ? mixColors(blended, '#FFFFFF', Math.min(0.5, this.detectionTint * 0.6)) : blended;
    ctx.fillStyle = fill;
    ctx.fillRect(this.pos.x - half, this.pos.y - half, half * 2, half * 2);

    if (this.type === 'priest' && this.priestRevealTimer > 0) {
      const haloStrength = Math.min(1, this.priestRevealTimer / PRIEST_REVEAL_DURATION);
      ctx.save();
      ctx.strokeStyle = `rgba(255, 255, 255, ${(0.35 + haloStrength * 0.35).toFixed(2)})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(this.pos.x, this.pos.y, half + 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  private pickNewDirection(): void {
    const stats = UNIT_STATS[this.type];
    const angle = Math.random() * Math.PI * 2;
    const speed = stats.minSpeed + Math.random() * (stats.maxSpeed - stats.minSpeed);
    this.velocity.set(Math.cos(angle) * speed, Math.sin(angle) * speed);
    this.wanderTimer = UNIT_WANDER_INTERVAL[0] + Math.random() * (UNIT_WANDER_INTERVAL[1] - UNIT_WANDER_INTERVAL[0]);
  }

  private steerTowards(
    target: Vector2,
    maxSpeed: number,
    dtRatio: number,
    lerpScale = UNIT_DETECTION_LERP,
    roadAssist = false
  ): void {
    const desired = target.clone().subtract(this.pos).normalize().scale(maxSpeed);
    const lerpFactor = Math.min(1, lerpScale * dtRatio * (roadAssist ? 0.65 : 1));
    this.velocity.lerp(desired, lerpFactor);
    if (roadAssist) {
      const currentSpeed = this.velocity.length();
      if (currentSpeed > 0.0001) {
        const forward = this.velocity.clone().normalize().scale(Math.max(currentSpeed, maxSpeed * 0.65));
        this.velocity.lerp(forward, Math.min(1, 0.12 * dtRatio));
      }
    }
  }

  private updateIdle(dt: number, game: Game, stats: (typeof UNIT_STATS)[keyof typeof UNIT_STATS], dtRatio: number): void {
    const anchor = game.getHighestSuspicionAnchor();
    let followingAnchor = false;
    if (anchor) {
      const distance = this.pos.distanceTo(anchor.position);
      const suspicionThreshold = Math.max(4, anchor.suspicion * 0.6);
      if (distance <= PATROL_ANCHOR_RADIUS || anchor.suspicion >= suspicionThreshold) {
        followingAnchor = true;
        const boost = 1 + Math.min(0.6, anchor.suspicion / PRIEST_REVEAL_SUSPICION);
        const speed = Math.min(stats.maxSpeed, Math.max(stats.minSpeed, stats.minSpeed * boost));
        const lerpScale = this.type === 'tank' ? UNIT_DETECTION_LERP * 0.4 : UNIT_DETECTION_LERP * 0.5;
        this.steerTowards(anchor.position, speed, dtRatio, lerpScale);
      }
    }

    if (!followingAnchor) {
      this.wanderTimer -= dt;
      if (this.wanderTimer <= 0) {
        this.pickNewDirection();
      }
    }
  }

  private updateSearch(
    dt: number,
    game: Game,
    stats: (typeof UNIT_STATS)[keyof typeof UNIT_STATS],
    dtRatio: number,
    world: World
  ): void {
    this.searchTimer = Math.max(0, this.searchTimer - dt);
    if (this.searchTimer === 0 || !this.searchOrigin) {
      this.behavior = 'idle';
      return;
    }

    this.searchAngle += SEARCH_SPIN_SPEED * dt;
    this.searchRadius += SEARCH_RADIUS_GROWTH * dt;
    const target = this.searchOrigin
      .clone()
      .add(new Vector2(Math.cos(this.searchAngle), Math.sin(this.searchAngle)).scale(this.searchRadius));
    const onRoad = world.isPointOnRoad(this.pos);
    if (onRoad) {
      this.roadAssistTimer = Math.max(this.roadAssistTimer, 2);
    }
    this.steerTowards(target, stats.maxSpeed * 0.9, dtRatio, UNIT_DETECTION_LERP * 0.6, onRoad || this.roadAssistTimer > 0);

    if (Math.random() < dt * 0.6) {
      game.registerKnightSighting(target);
    }
  }

  private updateInvestigation(dt: number, stats: (typeof UNIT_STATS)[keyof typeof UNIT_STATS], dtRatio: number): void {
    if (!this.investigationTarget) {
      this.behavior = 'idle';
      return;
    }

    this.investigationTimer = Math.max(0, this.investigationTimer - dt);
    if (this.investigationTimer === 0) {
      this.behavior = 'idle';
      return;
    }

    const distance = this.pos.distanceTo(this.investigationTarget);
    if (distance < 6) {
      this.behavior = 'idle';
      return;
    }

    this.steerTowards(this.investigationTarget, stats.maxSpeed * 0.85, dtRatio);
  }

  private beginSearch(game: Game): void {
    this.behavior = 'searching';
    const anchor = game.getHighestSuspicionAnchor();
    if (anchor) {
      this.searchOrigin = anchor.position.clone();
    }
    this.searchAngle = Math.random() * Math.PI * 2;
    this.searchRadius = 0;
    this.searchTimer = SEARCH_DURATION;
  }

  private canTankPersist(distance: number, stats: (typeof UNIT_STATS)[keyof typeof UNIT_STATS]): boolean {
    return this.type === 'tank' && distance <= stats.detectionRadius + TANK_CHASE_PERSIST_DISTANCE;
  }

  private updateDetectionTint(dtRatio: number): void {
    const target = this.detecting ? 1 : 0;
    const blend = Math.min(1, DETECTION_TINT_LERP * dtRatio);
    this.detectionTint += (target - this.detectionTint) * blend;
    this.detectionTint = Math.max(0, Math.min(1, this.detectionTint));
  }

  private updatePriestReveal(dt: number, distance: number, knight: Knight, game: Game): void {
    if (this.type !== 'priest') {
      this.priestProximityTimer = 0;
      this.priestRevealTimer = 0;
      return;
    }

    let startedReveal = false;
    if (distance <= PRIEST_REVEAL_RADIUS) {
      this.priestProximityTimer = Math.min(PRIEST_REVEAL_WARMUP, this.priestProximityTimer + dt);
      if (this.priestProximityTimer >= PRIEST_REVEAL_WARMUP) {
        startedReveal = this.priestRevealTimer <= 0;
        this.priestRevealTimer = PRIEST_REVEAL_DURATION;
      }
    } else {
      this.priestProximityTimer = Math.max(0, this.priestProximityTimer - dt);
    }

    if (this.priestRevealTimer > 0) {
      this.priestRevealTimer = Math.max(0, this.priestRevealTimer - dt);
      game.registerKnightReveal(knight.pos, { escalateSuspicion: startedReveal });
    }
  }

  private applyTankKnockback(knight: Knight): void {
    const push = this.pos.clone().subtract(knight.pos);
    if (push.lengthSq() === 0) {
      push.set(Math.random() - 0.5, Math.random() - 0.5);
    }
    push.normalize().scale(TANK_KNOCKBACK_STRENGTH);
    this.velocity.add(push);
  }

  private getHalfSize(): number {
    return UNIT_STATS[this.type].size / 2;
  }
}
