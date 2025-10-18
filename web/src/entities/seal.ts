import {
  SEAL_CHANNEL_RADIUS,
  SEAL_CHANNEL_TIME,
  SEAL_COLOR,
  SEAL_PROGRESS_COLOR,
  SEAL_RING_OFFSET,
  SEAL_RING_RADIUS
} from '../config/constants';
import { Vector2 } from '../math/vector2';

export class Seal {
  public progress = 0;
  public channeling = false;

  constructor(public readonly pos: Vector2) {}

  update(knightPos: Vector2, dt: number): { completed: boolean; started: boolean } {
    let started = false;
    if (knightPos.distanceTo(this.pos) <= SEAL_CHANNEL_RADIUS) {
      if (!this.channeling) {
        started = true;
      }
      this.channeling = true;
      this.progress = Math.min(SEAL_CHANNEL_TIME, this.progress + dt);
    } else {
      this.channeling = false;
      if (this.progress < SEAL_CHANNEL_TIME) {
        this.progress = Math.max(0, this.progress - dt * 0.5);
      }
    }
    const completed = this.progress >= SEAL_CHANNEL_TIME;
    return { completed, started };
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = SEAL_COLOR;
    ctx.fillRect(this.pos.x - 5, this.pos.y - 5, 10, 10);

    if (!this.channeling) {
      return;
    }

    const pct = Math.min(1, this.progress / SEAL_CHANNEL_TIME);
    const startAngle = -Math.PI / 2;
    const endAngle = startAngle + pct * Math.PI * 2;
    const centerY = this.pos.y - SEAL_RING_OFFSET;

    ctx.save();
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.beginPath();
    ctx.arc(this.pos.x, centerY, SEAL_RING_RADIUS, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = SEAL_PROGRESS_COLOR;
    ctx.beginPath();
    ctx.arc(this.pos.x, centerY, SEAL_RING_RADIUS, startAngle, endAngle);
    ctx.stroke();
    ctx.restore();
  }
}
