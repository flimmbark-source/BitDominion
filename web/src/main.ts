class Vector2 {
  constructor(public x = 0, public y = 0) {}

  clone(): Vector2 {
    return new Vector2(this.x, this.y);
  }

  copy(other: Vector2): this {
    this.x = other.x;
    this.y = other.y;
    return this;
  }

  set(x: number, y: number): this {
    this.x = x;
    this.y = y;
    return this;
  }

  add(other: Vector2): this {
    this.x += other.x;
    this.y += other.y;
    return this;
  }

  subtract(other: Vector2): this {
    this.x -= other.x;
    this.y -= other.y;
    return this;
  }

  scale(factor: number): this {
    this.x *= factor;
    this.y *= factor;
    return this;
  }

  length(): number {
    return Math.hypot(this.x, this.y);
  }

  lengthSq(): number {
    return this.x * this.x + this.y * this.y;
  }

  distanceTo(other: Vector2): number {
    return Math.hypot(this.x - other.x, this.y - other.y);
  }

  normalize(): this {
    const len = this.length();
    if (len > 0) {
      this.scale(1 / len);
    }
    return this;
  }

  lerp(target: Vector2, t: number): this {
    this.x += (target.x - this.x) * t;
    this.y += (target.y - this.y) * t;
    return this;
  }

  clamp(minX: number, minY: number, maxX: number, maxY: number): this {
    this.x = Math.max(minX, Math.min(maxX, this.x));
    this.y = Math.max(minY, Math.min(maxY, this.y));
    return this;
  }
}

const WIDTH = 800;
const HEIGHT = 800;
const FPS = 60;
const CASTLE_POS = new Vector2(WIDTH / 2, HEIGHT / 2);
const CASTLE_SIZE = 20;
const CASTLE_WIN_RADIUS = 25;
const CASTLE_STAY_TIME = 3.0;

const KNIGHT_SIZE = 6;
const KNIGHT_ACCEL = 0.5;
const KNIGHT_FRICTION = 0.9;
const KNIGHT_STOP_DISTANCE = 5;
const KNIGHT_HP = 3;

const MELEE_RANGE = 40;
const ARC_WIDTH_DEG = 100;
const SWING_DURATION = 0.25;
const SWING_COOLDOWN = 0.6;
const SWING_ARC_POINTS = 16;

const PATROL_SIZE = 4;
const PATROL_DETECT_RADIUS = 80;
const PATROL_MIN_SPEED = 0.6;
const PATROL_MAX_SPEED = 1.2;
const PATROL_WANDER_INTERVAL: [number, number] = [1.0, 3.0];
const PATROL_MAX_COUNT = 15;
const PATROL_REINFORCEMENT_COUNT = 2;
const PATROL_SPAWN_RADIUS = 50;
const PATROL_DAMAGE_COOLDOWN = 0.5;
const PATROL_DETECTION_LERP = 0.15;

const DETECTION_REQUIRED_TIME = 2.0;

const BACKGROUND_COLOR = '#000000';
const KNIGHT_COLOR = '#14C814';
const PATROL_COLOR = '#C82828';
const PATROL_ALERT_COLOR = '#FF5A5A';
const CASTLE_COLOR = '#8200B4';
const HUD_COLOR = '#DCDCDC';
const ARC_COLOR = '#DCDCDC';
const VICTORY_COLOR = '#50C878';
const DEFEAT_COLOR = '#DC3C3C';

const CASTLE_COLOR_DEC = hexToRgb(CASTLE_COLOR);

type GameState = 'running' | 'victory' | 'defeat';

class Knight {
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

  update(dt: number): void {
    const dtRatio = dt * FPS;
    const toTarget = this.target.clone().subtract(this.pos);
    const distance = toTarget.length();

    if (distance > KNIGHT_STOP_DISTANCE) {
      const desiredDir = toTarget.normalize();
      this.velocity.add(desiredDir.scale(KNIGHT_ACCEL * dtRatio));
    } else if (this.velocity.lengthSq() < 0.05) {
      this.velocity.set(0, 0);
    }

    this.velocity.scale(Math.pow(KNIGHT_FRICTION, dtRatio));

    if (distance <= KNIGHT_STOP_DISTANCE && this.velocity.lengthSq() < 0.05) {
      this.velocity.set(0, 0);
    }

    this.pos.add(this.velocity.clone().scale(dtRatio));
    this._clampToBounds();

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

  private _clampToBounds(): void {
    const half = KNIGHT_SIZE / 2;
    this.pos.clamp(half, half, WIDTH - half, HEIGHT - half);
  }

  tryAttack(patrols: Patrol[]): Patrol[] {
    if (this.swingTimer > 0) {
      return this._collectHits(patrols);
    }
    if (this.swingCooldown > 0) {
      return [];
    }

    let nearest: Patrol | null = null;
    let nearestDist = MELEE_RANGE + 1;
    for (const patrol of patrols) {
      if (!patrol.alive) continue;
      const dist = patrol.pos.distanceTo(this.pos);
      if (dist <= MELEE_RANGE && dist < nearestDist) {
        nearest = patrol;
        nearestDist = dist;
      }
    }

    if (!nearest) {
      return [];
    }

    this.swingAngle = Math.atan2(nearest.pos.y - this.pos.y, nearest.pos.x - this.pos.x);
    this.swingTimer = SWING_DURATION;
    return this._collectHits(patrols);
  }

  private _collectHits(patrols: Patrol[]): Patrol[] {
    if (this.swingAngle == null) {
      return [];
    }
    const hits: Patrol[] = [];
    for (const patrol of patrols) {
      if (!patrol.alive) continue;
      if (patrol.pos.distanceTo(this.pos) > MELEE_RANGE) continue;
      if (this._pointInArc(patrol.pos)) {
        hits.push(patrol);
      }
    }
    return hits;
  }

  private _pointInArc(point: Vector2): boolean {
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
}

class Patrol {
  public velocity = new Vector2();
  public detecting = false;
  public wanderTimer = 0;
  public damageTimer = 0;
  public alive = true;

  constructor(public pos: Vector2) {
    this._pickNewDirection();
  }

  update(dt: number, knightPos: Vector2): void {
    if (!this.alive) {
      return;
    }
    const dtRatio = dt * FPS;
    this.wanderTimer -= dt;
    if (this.wanderTimer <= 0) {
      this._pickNewDirection();
    }

    const toKnight = knightPos.clone().subtract(this.pos);
    const distance = toKnight.length();
    this.detecting = distance <= PATROL_DETECT_RADIUS;

    if (this.detecting && distance > 0) {
      const desired = toKnight.normalize().scale(Math.max(this.velocity.length(), PATROL_MAX_SPEED));
      this.velocity.lerp(desired, PATROL_DETECTION_LERP * dtRatio);
    }

    this.pos.add(this.velocity.clone().scale(dtRatio));
    this._handleBounds();

    if (this.damageTimer > 0) {
      this.damageTimer = Math.max(0, this.damageTimer - dt);
    }
  }

  private _pickNewDirection(): void {
    const angle = Math.random() * Math.PI * 2;
    const speed = PATROL_MIN_SPEED + Math.random() * (PATROL_MAX_SPEED - PATROL_MIN_SPEED);
    this.velocity.set(Math.cos(angle) * speed, Math.sin(angle) * speed);
    this.wanderTimer = PATROL_WANDER_INTERVAL[0] + Math.random() * (PATROL_WANDER_INTERVAL[1] - PATROL_WANDER_INTERVAL[0]);
  }

  private _handleBounds(): void {
    const half = PATROL_SIZE / 2;
    let bounced = false;
    if (this.pos.x < half) {
      this.pos.x = half;
      this.velocity.x *= -1;
      bounced = true;
    } else if (this.pos.x > WIDTH - half) {
      this.pos.x = WIDTH - half;
      this.velocity.x *= -1;
      bounced = true;
    }
    if (this.pos.y < half) {
      this.pos.y = half;
      this.velocity.y *= -1;
      bounced = true;
    } else if (this.pos.y > HEIGHT - half) {
      this.pos.y = HEIGHT - half;
      this.velocity.y *= -1;
      bounced = true;
    }
    if (bounced) {
      this.velocity.scale(0.9);
    }
  }

  attemptDamage(knight: Knight): boolean {
    if (!this.alive || this.damageTimer > 0) {
      return false;
    }
    if (this.pos.distanceTo(knight.pos) < 6) {
      this.damageTimer = PATROL_DAMAGE_COOLDOWN;
      knight.hp = Math.max(0, knight.hp - 1);
      return true;
    }
    return false;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (!this.alive) {
      return;
    }
    ctx.fillStyle = this.detecting ? PATROL_ALERT_COLOR : PATROL_COLOR;
    ctx.fillRect(this.pos.x - PATROL_SIZE / 2, this.pos.y - PATROL_SIZE / 2, PATROL_SIZE, PATROL_SIZE);
  }
}

class DarkLord {
  public detectionTimer = 0;
  public evilEnergy = 0;
  private evilAccumulator = 0;

  update(dt: number, detecting: boolean): boolean {
    if (detecting) {
      this.detectionTimer += dt;
      this.evilAccumulator += dt;
      if (this.evilAccumulator >= 1) {
        const gained = Math.floor(this.evilAccumulator);
        this.evilEnergy += gained;
        this.evilAccumulator -= gained;
      }
    } else {
      this.detectionTimer = 0;
      this.evilAccumulator = 0;
    }

    if (this.detectionTimer > DETECTION_REQUIRED_TIME) {
      this.detectionTimer = 0;
      return true;
    }
    return false;
  }
}

class Game {
  public knight = new Knight();
  public patrols: Patrol[] = [];
  public darkLord = new DarkLord();
  public state: GameState = 'running';

  constructor() {
    this._spawnInitialPatrols(5);
  }

  reset(): void {
    this.knight = new Knight();
    this.patrols = [];
    this.darkLord = new DarkLord();
    this.state = 'running';
    this._spawnInitialPatrols(5);
  }

  private _spawnInitialPatrols(count: number): void {
    for (let i = 0; i < count; i++) {
      this.spawnPatrolRandom();
    }
  }

  spawnPatrolRandom(): void {
    for (let i = 0; i < 100; i++) {
      const pos = new Vector2(Math.random() * WIDTH, Math.random() * HEIGHT);
      if (pos.distanceTo(CASTLE_POS) >= 60) {
        this.patrols.push(new Patrol(pos));
        return;
      }
    }
  }

  spawnPatrolNearCastle(count: number): void {
    for (let i = 0; i < count; i++) {
      if (this.patrols.length >= PATROL_MAX_COUNT) {
        break;
      }
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * PATROL_SPAWN_RADIUS;
      const pos = CASTLE_POS.clone().add(new Vector2(Math.cos(angle) * radius, Math.sin(angle) * radius));
      pos.clamp(PATROL_SIZE / 2, PATROL_SIZE / 2, WIDTH - PATROL_SIZE / 2, HEIGHT - PATROL_SIZE / 2);
      this.patrols.push(new Patrol(pos));
    }
  }

  onPointer(x: number, y: number): void {
    if (this.state !== 'running') {
      return;
    }
    this.knight.setTarget(new Vector2(x, y));
  }

  update(dt: number): void {
    if (this.state !== 'running') {
      return;
    }

    this.knight.update(dt);

    let anyDetecting = false;
    for (const patrol of this.patrols) {
      patrol.update(dt, this.knight.pos);
      if (patrol.detecting) {
        anyDetecting = true;
      }
      patrol.attemptDamage(this.knight);
    }

    this.patrols = this.patrols.filter((p) => p.alive);

    if (this.knight.hp <= 0) {
      this.state = 'defeat';
      return;
    }

    const reinforcementReady = this.darkLord.update(dt, anyDetecting);
    if (anyDetecting && reinforcementReady) {
      this.spawnPatrolNearCastle(PATROL_REINFORCEMENT_COUNT);
    }

    const hits = this.knight.tryAttack(this.patrols);
    if (hits.length) {
      for (const patrol of hits) {
        patrol.alive = false;
      }
      this.patrols = this.patrols.filter((p) => p.alive);
    }

    this._updateVictory(dt);
  }

  private _updateVictory(dt: number): void {
    if (this.knight.pos.distanceTo(CASTLE_POS) <= CASTLE_WIN_RADIUS) {
      this.knight.castleTimer += dt;
      if (this.knight.castleTimer >= CASTLE_STAY_TIME) {
        this.state = 'victory';
      }
    } else {
      this.knight.castleTimer = 0;
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = BACKGROUND_COLOR;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    this._drawCastle(ctx);

    for (const patrol of this.patrols) {
      patrol.draw(ctx);
    }

    this.knight.draw(ctx);
    this.knight.drawSwing(ctx);

    this._drawHud(ctx);

    if (this.state === 'victory') {
      this._drawOverlay(ctx, 'VICTORY', VICTORY_COLOR, 'Press R to restart');
    } else if (this.state === 'defeat') {
      this._drawOverlay(ctx, 'DEFEAT', DEFEAT_COLOR, 'Press R to restart');
    }
  }

  private _drawCastle(ctx: CanvasRenderingContext2D): void {
    const pulse = (Math.sin(performance.now() / 300) + 1) * 0.5;
    const size = CASTLE_SIZE + pulse * 4;
    const color = {
      r: Math.min(255, CASTLE_COLOR_DEC.r + pulse * 40),
      g: Math.min(255, CASTLE_COLOR_DEC.g + pulse * 40),
      b: Math.min(255, CASTLE_COLOR_DEC.b + pulse * 40)
    };
    ctx.fillStyle = `rgb(${color.r.toFixed(0)}, ${color.g.toFixed(0)}, ${color.b.toFixed(0)})`;
    ctx.fillRect(CASTLE_POS.x - size / 2, CASTLE_POS.y - size / 2, size, size);
  }

  private _drawHud(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = HUD_COLOR;
    ctx.font = '18px Consolas, monospace';
    ctx.textBaseline = 'top';
    const text = `HP: ${this.knight.hp}  Evil: ${this.darkLord.evilEnergy}  Patrols: ${this.patrols.length}`;
    ctx.fillText(text, 12, 12);
  }

  private _drawOverlay(ctx: CanvasRenderingContext2D, text: string, color: string, subtitle: string): void {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.fillStyle = color;
    ctx.font = '48px Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, WIDTH / 2, HEIGHT / 2 - 30);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '20px Consolas, monospace';
    ctx.fillText(subtitle, WIDTH / 2, HEIGHT / 2 + 20);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace('#', '');
  const value = parseInt(normalized, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255
  };
}

const appRoot = document.querySelector<HTMLDivElement>('#app');
if (!appRoot) {
  throw new Error('Missing #app root element');
}

const canvas = document.createElement('canvas');
canvas.width = WIDTH;
canvas.height = HEIGHT;
appRoot.appendChild(canvas);

const context = canvas.getContext('2d');
if (!context) {
  throw new Error('Unable to create canvas rendering context');
}
const ctx = context;

const game = new Game();

canvas.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) {
    return;
  }
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (event.clientX - rect.left) * scaleX;
  const y = (event.clientY - rect.top) * scaleY;
  game.onPointer(x, y);
});

window.addEventListener('keydown', (event) => {
  if (event.key.toLowerCase() === 'r') {
    game.reset();
  }
});

let lastTime = performance.now();
function frame(now: number) {
  const dt = Math.min((now - lastTime) / 1000, 0.2);
  lastTime = now;
  game.update(dt);
  game.draw(ctx);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
