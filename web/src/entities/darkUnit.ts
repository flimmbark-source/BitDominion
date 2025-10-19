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

const INVESTIGATION_ARRIVE_RADIUS = 6;
const INVESTIGATION_TRAVEL_TIMEOUT = NOISE_INVESTIGATE_TIME * 3;
const INVESTIGATION_ORBIT_SPEED = Math.PI * 0.9;

export type DarkUnitBehavior = 'idle' | 'chasing' | 'searching' | 'investigating';

export class DarkUnit {
  public velocity = new Vector2();
  public detecting = false;
  public wanderTimer = 0;
  public alive = true;
  public hp: number;
  public behavior: DarkUnitBehavior = 'idle';

  private attackCooldownTimer = 0;
  private attackVisualTimer = 0;
  private attackVisualDuration = 0;
  private lastAttackTarget: Vector2 | null = null;
  private lastAttackOrigin: Vector2 | null = null;
  private lineOfSightTimer = 0;
  private searchTimer = 0;
  private searchAngle = 0;
  private searchRadius = 0;
  private searchOrigin: Vector2 | null = null;
  private investigationTimer = 0;
  private investigationTarget: Vector2 | null = null;
  private investigationArrived = false;
  private investigationTravelTimer = 0;
  private investigationOrbitAngle = 0;
  private investigationOrbitRadius = 0;
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
      this.clearInvestigationState();
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

    if (this.attackCooldownTimer > 0) {
      this.attackCooldownTimer = Math.max(0, this.attackCooldownTimer - dt);
    }
    if (this.attackVisualTimer > 0) {
      this.attackVisualTimer = Math.max(0, this.attackVisualTimer - dt);
      if (this.attackVisualTimer === 0) {
        this.lastAttackTarget = null;
        this.lastAttackOrigin = null;
        this.attackVisualDuration = 0;
      }
    }
  }

  startInvestigation(position: Vector2): void {
    if (!this.alive || this.behavior === 'chasing') {
      return;
    }
    this.behavior = 'investigating';
    this.investigationTarget = position.clone();
    this.investigationTimer = NOISE_INVESTIGATE_TIME;
    this.investigationArrived = false;
    this.investigationTravelTimer = 0;
    this.investigationOrbitAngle = Math.random() * Math.PI * 2;
    this.investigationOrbitRadius = 5 + Math.random() * 6;
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

  tryAttack(knight: Knight, world: World): void {
    if (!this.alive || this.attackCooldownTimer > 0) {
      return;
    }

    const stats = UNIT_STATS[this.type];
    const isRanged = stats.attackType === 'ranged';
    const attackRange = stats.attackRange;

    let target: 'knight' | 'villager' | null = null;
    let targetPos: Vector2 | null = null;
    let villagerTarget: ReturnType<World['findClosestVillager']> = null;

    const knightDistance = this.pos.distanceTo(knight.pos);
    if (knightDistance <= attackRange && (!isRanged || world.hasLineOfSight(this.pos, knight.pos))) {
      target = 'knight';
      targetPos = knight.pos.clone();
    } else {
      villagerTarget = world.findClosestVillager(this.pos, attackRange);
      if (villagerTarget && (!isRanged || world.hasLineOfSight(this.pos, villagerTarget.pos))) {
        target = 'villager';
        targetPos = villagerTarget.pos.clone();
      }
    }

    if (!target || !targetPos) {
      return;
    }

    this.attackCooldownTimer = stats.attackCooldown;
    this.attackVisualTimer = stats.attackVisualDuration;
    this.attackVisualDuration = stats.attackVisualDuration;
    this.lastAttackTarget = targetPos.clone();
    this.lastAttackOrigin = this.pos.clone();

    if (target === 'knight') {
      knight.hp = Math.max(0, knight.hp - stats.attackDamage);
    } else if (villagerTarget) {
      world.damageVillager(villagerTarget, stats.attackDamage);
    }
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
    const fillBase = this.detecting
      ? mixColors(blended, '#FFFFFF', Math.min(0.5, this.detectionTint * 0.6))
      : blended;
    let fill = fillBase;
    if (this.attackVisualTimer > 0 && this.attackVisualDuration > 0) {
      const completion = 1 - this.attackVisualTimer / this.attackVisualDuration;
      const flashStrength = Math.max(0, Math.min(1, 0.6 * (1 - completion)));
      fill = mixColors(fillBase, '#FFFFFF', flashStrength);
    }
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

    if (this.attackVisualTimer > 0 && this.lastAttackTarget) {
      this.drawAttackVisual(ctx);
    }
  }

  private drawAttackVisual(ctx: CanvasRenderingContext2D): void {
    if (!this.lastAttackTarget) {
      return;
    }
    const stats = UNIT_STATS[this.type];
    const origin = this.lastAttackOrigin ?? this.pos;
    const duration = this.attackVisualDuration > 0 ? this.attackVisualDuration : 1;
    const completion = Math.min(1, Math.max(0, 1 - this.attackVisualTimer / duration));
    const opacity = 1 - completion;

    ctx.save();
    switch (this.type) {
      case 'scout': {
        const direction = this.lastAttackTarget.clone().subtract(origin);
        if (direction.lengthSq() === 0) {
          direction.set(1, 0);
        } else {
          direction.normalize();
        }
        const reach = Math.min(stats.attackRange + 6, 18);
        const start = origin.clone().add(direction.clone().scale(2));
        const end = origin.clone().add(direction.clone().scale(reach));
        ctx.strokeStyle = `rgba(255, 220, 200, ${0.85 * opacity})`;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();

        ctx.globalAlpha = 0.4 * opacity;
        ctx.fillStyle = '#FFD6D6';
        ctx.beginPath();
        ctx.arc(this.lastAttackTarget.x, this.lastAttackTarget.y, 2.5 + 1.5 * (1 - opacity), 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'tank': {
        const radius = 5 + 4 * (1 - opacity);
        ctx.strokeStyle = `rgba(210, 120, 80, ${0.7 * opacity})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(this.lastAttackTarget.x, this.lastAttackTarget.y, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 0.3 * opacity;
        ctx.fillStyle = '#D87448';
        ctx.beginPath();
        ctx.arc(this.lastAttackTarget.x, this.lastAttackTarget.y, radius * 0.7, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'priest': {
        ctx.strokeStyle = `rgba(200, 170, 255, ${0.75 * opacity})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(origin.x, origin.y);
        ctx.lineTo(this.lastAttackTarget.x, this.lastAttackTarget.y);
        ctx.stroke();

        ctx.globalAlpha = 0.45 * opacity;
        ctx.fillStyle = '#E6D8FF';
        ctx.beginPath();
        ctx.arc(this.lastAttackTarget.x, this.lastAttackTarget.y, 3.2, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
    }
    ctx.restore();
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
      this.finishInvestigation();
      return;
    }

    this.investigationTravelTimer += dt;
    const distance = this.pos.distanceTo(this.investigationTarget);

    if (!this.investigationArrived) {
      if (distance <= INVESTIGATION_ARRIVE_RADIUS) {
        this.investigationArrived = true;
        this.investigationTravelTimer = 0;
        this.investigationTimer = NOISE_INVESTIGATE_TIME;
      } else {
        if (this.investigationTravelTimer > INVESTIGATION_TRAVEL_TIMEOUT) {
          this.finishInvestigation();
          return;
        }
        this.steerTowards(
          this.investigationTarget,
          stats.maxSpeed * 0.95,
          dtRatio,
          UNIT_DETECTION_LERP * 0.8
        );
        return;
      }
    }

    this.investigationTimer = Math.max(0, this.investigationTimer - dt);
    if (this.investigationTimer === 0) {
      this.finishInvestigation();
      return;
    }

    this.investigationOrbitAngle += dt * INVESTIGATION_ORBIT_SPEED;
    const wobble = Math.sin(this.investigationOrbitAngle * 1.7) * 1.2;
    const radius = Math.max(3, this.investigationOrbitRadius + wobble);
    const offset = new Vector2(Math.cos(this.investigationOrbitAngle), Math.sin(this.investigationOrbitAngle)).scale(radius);
    const inspectPoint = this.investigationTarget.clone().add(offset);
    this.steerTowards(inspectPoint, stats.maxSpeed * 0.7, dtRatio, UNIT_DETECTION_LERP * 0.6);
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

  private finishInvestigation(): void {
    this.behavior = 'idle';
    this.clearInvestigationState();
  }

  private clearInvestigationState(): void {
    this.investigationTimer = 0;
    this.investigationTarget = null;
    this.investigationArrived = false;
    this.investigationTravelTimer = 0;
    this.investigationOrbitAngle = 0;
    this.investigationOrbitRadius = 0;
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
