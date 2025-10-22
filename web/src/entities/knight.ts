import {
  ARC_WIDTH_DEG,
  CASTLE_POS,
  FPS,
  KNIGHT_ACCEL,
  KNIGHT_BOW_COOLDOWN,
  KNIGHT_BOW_DAMAGE,
  KNIGHT_BOW_PROJECTILE_SPEED,
  KNIGHT_BOW_RANGE,
  KNIGHT_COLOR,
  KNIGHT_FRICTION,
  KNIGHT_SPEED,
  KNIGHT_HP,
  KNIGHT_SIZE,
  KNIGHT_STOP_DISTANCE,
  MELEE_RANGE,
  SWING_COOLDOWN,
  SWING_DURATION
} from '../config/constants';
import { Vector2 } from '../math/vector2';
import type { World } from '../world';
import type { DarkUnit } from './darkUnit';

export class Knight {
  public pos = CASTLE_POS.clone().add(new Vector2(0, 120));
  public velocity = new Vector2();
  public target = this.pos.clone();
  public hp = KNIGHT_HP;
  public swingTimer = 0;
  public swingCooldown = 0;
  public swingAngle: number | null = null;
  private swingHits = new Set<DarkUnit>();
  private lastSwingProgress = 0;
  public castleTimer = 0;
  private bowEquipped = false;
  private bowCooldownTimer = 0;
  private bowCooldownModifier = 1;
  private bowRange = KNIGHT_BOW_RANGE;
  private speedMultiplier = 1;

  setTarget(target: Vector2): void {
    this.target.copy(target);
  }

  update(dt: number, world: World): void {
    const dtRatio = dt * FPS;
    const toTarget = this.target.clone().subtract(this.pos);
    const distance = toTarget.length();

    this.velocity.scale(Math.pow(KNIGHT_FRICTION, dtRatio));
    const steeringStrength = Math.min(1, KNIGHT_ACCEL * dtRatio);

    if (distance > KNIGHT_STOP_DISTANCE) {
      const desiredVelocity = toTarget.normalize().scale(KNIGHT_SPEED * this.speedMultiplier);
      this.velocity.lerp(desiredVelocity, steeringStrength);
    } else {
      this.velocity.lerp(new Vector2(), steeringStrength);
      if (this.velocity.lengthSq() < 0.01) {
        this.velocity.set(0, 0);
      }
    }

    world.applyTerrainSteering(this, KNIGHT_SIZE / 2, dt, { entityType: 'knight' });
    this.velocity.limit(KNIGHT_SPEED);

    if (distance <= KNIGHT_STOP_DISTANCE && this.velocity.lengthSq() < 0.01) {
      this.velocity.set(0, 0);
    }

    this.pos.add(this.velocity.clone().scale(dtRatio));
    world.resolveStaticCollisions(this.pos, KNIGHT_SIZE / 2, { entityType: 'knight' });
    world.constrainToArena(this, KNIGHT_SIZE / 2);

    if (this.swingTimer > 0) {
      this.swingTimer = Math.max(0, this.swingTimer - dt);
      if (this.swingTimer === 0) {
        this.swingAngle = null;
        this.swingCooldown = SWING_COOLDOWN;
        this.lastSwingProgress = 0;
        this.swingHits.clear();
      }
    }

    if (this.swingCooldown > 0) {
      this.swingCooldown = Math.max(0, this.swingCooldown - dt);
    }

    if (this.bowCooldownTimer > 0) {
      this.bowCooldownTimer = Math.max(0, this.bowCooldownTimer - dt);
    }
  }

  tryAttack(units: DarkUnit[]): DarkUnit[] {
    if (this.swingTimer > 0) {
      return this.collectHits(units);
    }
    if (this.swingCooldown > 0) {
      return [];
    }

    let nearest: DarkUnit | null = null;
    let nearestDist = MELEE_RANGE + 1;
    for (const unit of units) {
      if (!unit.alive) continue;
      const dist = unit.pos.distanceTo(this.pos);
      if (dist <= MELEE_RANGE && dist < nearestDist) {
        nearest = unit;
        nearestDist = dist;
      }
    }

    if (!nearest) {
      return [];
    }

    this.swingAngle = Math.atan2(nearest.pos.y - this.pos.y, nearest.pos.x - this.pos.x);
    this.swingTimer = SWING_DURATION;
    this.swingHits.clear();
    this.lastSwingProgress = 0;
    return [];
  }

  hasBowEquipped(): boolean {
    return this.bowEquipped;
  }

  grantBow(): void {
    if (this.bowEquipped) {
      return;
    }
    this.bowEquipped = true;
    this.bowCooldownTimer = 0;
  }

  addSpeedMultiplier(multiplier: number): void {
    if (multiplier <= 0) {
      return;
    }
    this.speedMultiplier *= multiplier;
  }

  multiplyBowCooldown(multiplier: number): void {
    if (multiplier <= 0) {
      return;
    }
    const clampedMultiplier = Math.max(0.2, multiplier);
    const previousModifier = this.bowCooldownModifier;
    this.bowCooldownModifier = Math.max(0.1, this.bowCooldownModifier * clampedMultiplier);
    if (this.bowCooldownTimer > 0) {
      const ratio = this.bowCooldownTimer / (KNIGHT_BOW_COOLDOWN * previousModifier);
      const nextDuration = KNIGHT_BOW_COOLDOWN * this.bowCooldownModifier;
      this.bowCooldownTimer = Math.max(0, nextDuration * ratio);
    }
  }

  getBowRange(): number {
    return this.bowRange;
  }

  tryShootBow(target: DarkUnit): { position: Vector2; velocity: Vector2; damage: number } | null {
    if (!this.bowEquipped || this.bowCooldownTimer > 0 || !target.alive) {
      return null;
    }
    const toTarget = target.pos.clone().subtract(this.pos);
    const distance = toTarget.length();
    if (distance <= 0 || distance > this.bowRange) {
      return null;
    }
    if (toTarget.lengthSq() === 0) {
      return null;
    }
    toTarget.normalize();
    const projectileVelocity = toTarget.clone().scale(KNIGHT_BOW_PROJECTILE_SPEED);
    this.bowCooldownTimer = KNIGHT_BOW_COOLDOWN * this.bowCooldownModifier;
    return {
      position: this.pos.clone(),
      velocity: projectileVelocity,
      damage: KNIGHT_BOW_DAMAGE
    };
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = KNIGHT_COLOR;
    ctx.fillRect(this.pos.x - KNIGHT_SIZE / 2, this.pos.y - KNIGHT_SIZE / 2, KNIGHT_SIZE, KNIGHT_SIZE);
  }

  drawSwing(ctx: CanvasRenderingContext2D): void {
    if (this.swingTimer <= 0 || this.swingAngle == null) {
      return;
    }
    const radius = MELEE_RANGE;
    const halfWidth = (ARC_WIDTH_DEG * Math.PI) / 360;
    const baseAngle = this.swingAngle;
    const startAngle = baseAngle - halfWidth;
    const endAngle = baseAngle + halfWidth;
    const duration = Math.max(0.0001, SWING_DURATION);
    const rawProgress = 1 - this.swingTimer / duration;
    const clampedProgress = Math.min(1, Math.max(0, rawProgress));
    const easedProgress = clampedProgress * clampedProgress * (3 - 2 * clampedProgress);
    const currentAngle = startAngle + (endAngle - startAngle) * easedProgress;
    const swooshRadius = radius - 4;
    const swooshOpacity = 0.25 + 0.55 * (1 - easedProgress);
    const highlightOpacity = 0.15 + 0.45 * (1 - easedProgress);

    ctx.save();

    ctx.strokeStyle = `rgba(20, 200, 120, ${swooshOpacity})`;
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(this.pos.x, this.pos.y, swooshRadius, startAngle, currentAngle, false);
    ctx.stroke();

    ctx.strokeStyle = `rgba(220, 220, 220, ${highlightOpacity})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(this.pos.x, this.pos.y, radius - 1, Math.max(startAngle, currentAngle - 0.2), currentAngle, false);
    ctx.stroke();

    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);
    ctx.rotate(currentAngle);

    const guardWidth = 8;
    const guardHeight = 1.6;
    const handleLength = 5;
    const bladeLength = radius - 6;
    const bladeWidth = 3.4;

    ctx.fillStyle = '#2E2E2E';
    ctx.fillRect(-handleLength, -1.4, handleLength, 2.8);

    ctx.fillStyle = '#B5B5B5';
    ctx.fillRect(-guardHeight / 2, -guardWidth / 2, guardHeight, guardWidth);

    ctx.fillStyle = '#F1F1F1';
    ctx.fillRect(0, -bladeWidth / 2, bladeLength, bladeWidth);

    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(bladeLength, 0);
    ctx.lineTo(bladeLength - 4, bladeWidth / 2 + 0.4);
    ctx.lineTo(bladeLength - 4, -(bladeWidth / 2 + 0.4));
    ctx.closePath();
    ctx.fill();

    ctx.restore();
    ctx.restore();
  }

  private collectHits(units: DarkUnit[]): DarkUnit[] {
    if (this.swingAngle == null) {
      return [];
    }
    const hits: DarkUnit[] = [];
    const halfWidth = (ARC_WIDTH_DEG * Math.PI) / 360;
    const duration = Math.max(0.0001, SWING_DURATION);
    const rawProgress = 1 - this.swingTimer / duration;
    const clampedProgress = Math.min(1, Math.max(0, rawProgress));
    const easedProgress = clampedProgress * clampedProgress * (3 - 2 * clampedProgress);

    for (const unit of units) {
      if (!unit.alive) continue;
      if (this.swingHits.has(unit)) continue;
      if (unit.pos.distanceTo(this.pos) > MELEE_RANGE) continue;
      const direction = unit.pos.clone().subtract(this.pos);
      let unitProgress = 0;
      if (direction.lengthSq() !== 0) {
        const angle = Math.atan2(direction.y, direction.x);
        const diff = angle - this.swingAngle;
        const normalizedDiff = ((diff + Math.PI) % (Math.PI * 2)) - Math.PI;
        if (Math.abs(normalizedDiff) > halfWidth) {
          continue;
        }
        unitProgress = (normalizedDiff + halfWidth) / (2 * halfWidth);
      }
      if (unitProgress <= this.lastSwingProgress || unitProgress > easedProgress) {
        continue;
      }
      hits.push(unit);
      this.swingHits.add(unit);
    }
    this.lastSwingProgress = Math.max(this.lastSwingProgress, easedProgress);
    return hits;
  }

}
