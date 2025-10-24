import {
  ARC_WIDTH_DEG,
  KNIGHT_SPAWN_POS,
  FPS,
  KNIGHT_ACCEL,
  KNIGHT_BOW_COOLDOWN,
  KNIGHT_BOW_DAMAGE,
  KNIGHT_BOW_PROJECTILE_SPEED,
  KNIGHT_BOW_RANGE,
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
  public pos = KNIGHT_SPAWN_POS.clone();
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
  private temporarySpeedMultiplier = 1;
  private meleeEquipped = false;
  private meleeDamage = 1;

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
      const desiredVelocity = toTarget
        .normalize()
        .scale(KNIGHT_SPEED * this.speedMultiplier * this.temporarySpeedMultiplier);
      this.velocity.lerp(desiredVelocity, steeringStrength);
    } else {
      this.velocity.lerp(new Vector2(), steeringStrength);
      if (this.velocity.lengthSq() < 0.01) {
        this.velocity.set(0, 0);
      }
    }

    world.applyTerrainSteering(this, KNIGHT_SIZE / 2, dt, { entityType: 'knight' });
    this.velocity.limit(KNIGHT_SPEED * this.speedMultiplier * this.temporarySpeedMultiplier);

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
    if (!this.meleeEquipped) {
      return [];
    }
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

  setTemporarySpeedMultiplier(multiplier: number): void {
    if (!Number.isFinite(multiplier) || multiplier <= 0) {
      this.temporarySpeedMultiplier = 1;
      return;
    }
    this.temporarySpeedMultiplier = multiplier;
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
    const spriteScale = 1.12;
    const bodyRadius = KNIGHT_SIZE * 0.45 * spriteScale;
    const headRadius = KNIGHT_SIZE * 0.22 * spriteScale;

    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);

    ctx.shadowColor = 'rgba(250, 220, 120, 0.65)';
    ctx.shadowBlur = 18 * spriteScale;

    ctx.fillStyle = '#1C1C24';
    ctx.beginPath();
    ctx.arc(0, 0, bodyRadius * 1.15, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;

    ctx.fillStyle = '#3A7BFA';
    ctx.beginPath();
    ctx.moveTo(-bodyRadius * 0.95, 0);
    ctx.quadraticCurveTo(-bodyRadius * 0.6, bodyRadius * 1.2, -bodyRadius * 0.15, bodyRadius * 1.25);
    ctx.lineTo(bodyRadius * 0.4, bodyRadius * 1.25);
    ctx.quadraticCurveTo(bodyRadius * 0.95, bodyRadius * 0.7, bodyRadius * 0.85, -bodyRadius * 0.1);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#6EA7FF';
    ctx.beginPath();
    ctx.arc(0, 0, bodyRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineWidth = 3.6 * spriteScale;
    ctx.strokeStyle = '#F5F5F7';
    ctx.stroke();

    ctx.fillStyle = '#5E2B91';
    ctx.beginPath();
    ctx.arc(-bodyRadius * 0.2, -bodyRadius * 0.1, bodyRadius * 0.65, Math.PI * 0.2, Math.PI * 1.05);
    ctx.lineTo(-bodyRadius * 0.05, bodyRadius * 0.85);
    ctx.closePath();
    ctx.fill();

    ctx.lineWidth = 2.2 * spriteScale;
    ctx.strokeStyle = '#F7E36C';
    ctx.beginPath();
    ctx.moveTo(-bodyRadius * 0.55, -bodyRadius * 0.05);
    ctx.lineTo(bodyRadius * 0.65, -bodyRadius * 0.05);
    ctx.stroke();

    ctx.fillStyle = '#F0F3FF';
    ctx.beginPath();
    ctx.arc(0, -bodyRadius * 0.95, headRadius * 1.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#4B5678';
    ctx.lineWidth = 1.8 * spriteScale;
    ctx.stroke();

    ctx.fillStyle = '#2B9B4B';
    ctx.beginPath();
    ctx.moveTo(-bodyRadius * 0.25, -bodyRadius * 0.25);
    ctx.lineTo(bodyRadius * 0.7, -bodyRadius * 0.4);
    ctx.lineTo(bodyRadius * 0.55, bodyRadius * 0.45);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#F9C74F';
    ctx.beginPath();
    ctx.arc(bodyRadius * 0.45, -bodyRadius * 0.2, bodyRadius * 0.26, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#AA6400';
    ctx.lineWidth = 1.6 * spriteScale;
    ctx.stroke();

    ctx.restore();
  }

  drawSwing(ctx: CanvasRenderingContext2D): void {
    if (!this.meleeEquipped || this.swingTimer <= 0 || this.swingAngle == null) {
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

    ctx.globalCompositeOperation = 'lighter';
    const trailCount = 3;
    for (let i = 0; i < trailCount; i++) {
      const trailDelay = i * 0.12;
      const trailProgress = Math.max(0, easedProgress - trailDelay);
      if (trailProgress <= 0) {
        continue;
      }
      const arcAngle = startAngle + (endAngle - startAngle) * trailProgress;
      const intensity = Math.max(0.2, 1 - i * 0.35);
      ctx.strokeStyle = `rgba(40, 230, 170, ${(0.35 + swooshOpacity * 0.9) * intensity})`;
      ctx.lineWidth = 6 - i * 1.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(this.pos.x, this.pos.y, swooshRadius - i * 1.8, startAngle, arcAngle, false);
      ctx.stroke();
    }

    ctx.globalCompositeOperation = 'source-over';

    ctx.strokeStyle = `rgba(240, 255, 255, ${highlightOpacity})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(
      this.pos.x,
      this.pos.y,
      radius - 1,
      Math.max(startAngle, currentAngle - 0.22),
      currentAngle,
      false
    );
    ctx.stroke();

    ctx.fillStyle = `rgba(255, 255, 255, ${0.45 + 0.35 * (1 - easedProgress)})`;
    ctx.beginPath();
    ctx.arc(
      this.pos.x + Math.cos(currentAngle) * (radius - 2),
      this.pos.y + Math.sin(currentAngle) * (radius - 2),
      2.8 + 1.2 * (1 - easedProgress),
      0,
      Math.PI * 2
    );
    ctx.fill();

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
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.6 + 0.3 * (1 - easedProgress)})`;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(0, -bladeWidth * 0.25);
    ctx.lineTo(bladeLength - 1.8, -bladeWidth * 0.25);
    ctx.moveTo(0, bladeWidth * 0.25);
    ctx.lineTo(bladeLength - 1.8, bladeWidth * 0.25);
    ctx.stroke();

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
    if (!this.meleeEquipped || this.swingAngle == null) {
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

  equipMeleeWeapon(damage = 1): void {
    this.meleeEquipped = true;
    this.meleeDamage = Math.max(0.1, damage);
  }

  hasMeleeWeapon(): boolean {
    return this.meleeEquipped;
  }

  getMeleeDamage(multiplier = 1): number {
    if (!this.meleeEquipped) {
      return 0;
    }
    const base = this.meleeDamage * multiplier;
    return Number.isFinite(base) && base > 0 ? base : 0;
  }

}
