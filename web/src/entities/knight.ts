import {
  ARC_COLOR,
  ARC_WIDTH_DEG,
  CASTLE_POS,
  FPS,
  KNIGHT_ACCEL,
  KNIGHT_COLOR,
  KNIGHT_FRICTION,
  KNIGHT_SPEED,
  KNIGHT_HP,
  KNIGHT_SIZE,
  KNIGHT_STOP_DISTANCE,
  MELEE_RANGE,
  SWING_ARC_POINTS,
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
  public castleTimer = 0;

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
      const desiredVelocity = toTarget.normalize().scale(KNIGHT_SPEED);
      this.velocity.lerp(desiredVelocity, steeringStrength);
    } else {
      this.velocity.lerp(new Vector2(), steeringStrength);
      if (this.velocity.lengthSq() < 0.01) {
        this.velocity.set(0, 0);
      }
    }

    world.applyTerrainSteering(this, KNIGHT_SIZE / 2, dt);
    this.velocity.limit(KNIGHT_SPEED);

    if (distance <= KNIGHT_STOP_DISTANCE && this.velocity.lengthSq() < 0.01) {
      this.velocity.set(0, 0);
    }

    this.pos.add(this.velocity.clone().scale(dtRatio));
    world.resolveStaticCollisions(this.pos, KNIGHT_SIZE / 2);
    world.constrainToArena(this, KNIGHT_SIZE / 2);

    if (this.swingTimer > 0) {
      this.swingTimer = Math.max(0, this.swingTimer - dt);
      if (this.swingTimer === 0) {
        this.swingAngle = null;
        this.swingCooldown = SWING_COOLDOWN;
      }
    }

    if (this.swingCooldown > 0) {
      this.swingCooldown = Math.max(0, this.swingCooldown - dt);
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
    return this.collectHits(units);
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
    const startAngle = this.swingAngle - halfWidth;
    const endAngle = this.swingAngle + halfWidth;

    ctx.strokeStyle = ARC_COLOR;
    ctx.beginPath();
    ctx.moveTo(this.pos.x, this.pos.y);
    for (let i = 0; i <= SWING_ARC_POINTS; i++) {
      const t = i / SWING_ARC_POINTS;
      const angle = startAngle + (endAngle - startAngle) * t;
      const x = this.pos.x + Math.cos(angle) * radius;
      const y = this.pos.y + Math.sin(angle) * radius;
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  }

  private collectHits(units: DarkUnit[]): DarkUnit[] {
    if (this.swingAngle == null) {
      return [];
    }
    const hits: DarkUnit[] = [];
    for (const unit of units) {
      if (!unit.alive) continue;
      if (unit.pos.distanceTo(this.pos) > MELEE_RANGE) continue;
      if (this.pointInArc(unit.pos)) {
        hits.push(unit);
      }
    }
    return hits;
  }

  private pointInArc(point: Vector2): boolean {
    const direction = point.clone().subtract(this.pos);
    if (direction.lengthSq() === 0) {
      return true;
    }
    const angle = Math.atan2(direction.y, direction.x);
    const baseAngle = this.swingAngle ?? 0;
    let diff = angle - baseAngle;
    diff = Math.abs(((diff + Math.PI) % (Math.PI * 2)) - Math.PI);
    return diff <= (ARC_WIDTH_DEG * Math.PI) / 360;
  }
}
