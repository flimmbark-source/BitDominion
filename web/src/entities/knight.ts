import { KNIGHT_HP, KNIGHT_SIZE, KNIGHT_SPAWN_POS } from '../config/constants';
import { Vector2 } from '../math/vector2';
import type { World } from '../world';
import type { DarkUnit } from './darkUnit';

export class Knight {
  public pos = KNIGHT_SPAWN_POS.clone();
  public velocity = new Vector2();
  public hp = KNIGHT_HP;
  public castleTimer = 0;

  update(_dt: number, world: World): void {
    this.velocity.set(0, 0);
    world.constrainToArena(this, KNIGHT_SIZE / 2);
  }

  setTarget(_target: Vector2): void {
    // Movement disabled — pointer clicks no longer drive pathing.
  }

  tryAttack(_units: DarkUnit[]): DarkUnit[] {
    return [];
  }

  equipMeleeWeapon(): void {
    // Melee combat removed in favor of click-driven attacks.
  }

  getMeleeDamage(_multiplier = 1): number {
    return 0;
  }

  setTemporarySpeedMultiplier(_multiplier: number): void {
    // Movement modifiers are ignored without pathing.
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
}
