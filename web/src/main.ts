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

const SHIELD_RING_RADIUS = CASTLE_SIZE / 2 + 30;
const SHIELD_RING_WIDTH = 6;
const SHIELD_RING_COLOR = 'rgba(130, 60, 200, 0.35)';
const SHIELD_FLASH_COLOR = { r: 200, g: 150, b: 255 } as const;
const SHIELD_FLASH_WIDTH = 8;
const SHIELD_FLASH_DURATION = 0.35;

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

const UNIT_WANDER_INTERVAL: [number, number] = [1.0, 3.0];
const UNIT_DAMAGE_COOLDOWN = 0.5;
const UNIT_DETECTION_LERP = 0.15;
const DETECTION_TINT_LERP = 0.22;

const MAX_UNITS = 16;
const DARK_LORD_ENERGY_PER_SEC = 3;
const DARK_LORD_SPAWN_INTERVAL = 1.5;
const DARK_LORD_REVEAL_MEMORY = 6.0;
const PRIEST_REVEAL_RADIUS = 40;
const PRIEST_REVEAL_WARMUP = 0.6;
const PRIEST_REVEAL_DURATION = 1.5;
const PRIEST_REVEAL_SUSPICION = 18;
const CASTLE_EDGE_SPAWN_RADIUS = 40;
const TANK_CHASE_PERSIST_DISTANCE = 120;
const TANK_KNOCKBACK_STRENGTH = 1.3;

const UNIT_COLORS = {
  scout: { base: '#C82828', alert: '#FF5A5A' },
  tank: { base: '#823E28', alert: '#C85A3C' },
  priest: { base: '#7A2BC8', alert: '#B58CFF' }
} as const;

const UNIT_STATS = {
  scout: {
    cost: 10,
    minSpeed: 1.0,
    maxSpeed: 1.8,
    detectionRadius: 80,
    maxHp: 1,
    size: 4
  },
  tank: {
    cost: 25,
    minSpeed: 0.5,
    maxSpeed: 0.9,
    detectionRadius: 60,
    maxHp: 3,
    size: 5
  },
  priest: {
    cost: 20,
    minSpeed: 0.8,
    maxSpeed: 1.2,
    detectionRadius: 70,
    maxHp: 2,
    size: 4
  }
} as const;

type UnitType = keyof typeof UNIT_STATS;
type UnitStats = (typeof UNIT_STATS)[UnitType];

const UNIT_MAX_HALF_SIZE = Math.max(...Object.values(UNIT_STATS).map((stats) => stats.size)) / 2;

const CHEAPEST_UNIT_COST = Math.min(...Object.values(UNIT_STATS).map((stats) => stats.cost));

const SEAL_COUNT = 3;
const SEAL_MIN_CASTLE_DIST = 140;
const SEAL_MIN_SEPARATION = 80;
const SEAL_CHANNEL_RADIUS = 25;
const SEAL_CHANNEL_TIME = 3.0;
const SEAL_COLOR = '#DCC23C';
const SEAL_PROGRESS_COLOR = '#FFFFFF';
const SEAL_RING_RADIUS = 15;
const SEAL_RING_OFFSET = 22;

const BACKGROUND_COLOR = '#000000';
const KNIGHT_COLOR = '#14C814';
const CASTLE_COLOR = '#8200B4';
const HUD_COLOR = '#DCDCDC';
const ARC_COLOR = '#DCDCDC';
const VICTORY_COLOR = '#50C878';
const DEFEAT_COLOR = '#DC3C3C';

const CASTLE_COLOR_DEC = hexToRgb(CASTLE_COLOR);

const PATROL_ANCHOR_COUNT = 6;
const PATROL_ANCHOR_RADIUS = 280;
const ANCHOR_SUSPICION_DECAY = 1.5;
const ANCHOR_SUSPICION_MAX = 30;
const ANCHOR_SIGHTING_BONUS = 10;
const ANCHOR_SEAL_CHANNEL_RATE = 4;

const KNIGHT_SIGHT_CONFIRM_TIME = 0.5;
const SEARCH_DURATION = 4;
const SEARCH_SPIN_SPEED = Math.PI * 1.6;
const SEARCH_RADIUS_GROWTH = 45;

const NOISE_PING_DURATION = 0.4;
const NOISE_PING_MIN_RADIUS = 20;
const NOISE_PING_MAX_RADIUS = 60;
const NOISE_SPRINT_WINDOW = 0.2;
const NOISE_INVESTIGATE_RADIUS = 160;
const NOISE_INVESTIGATE_TIME = 2;
const NOISE_ATTACK_STRENGTH = 12;
const NOISE_SEAL_STRENGTH = 10;
const NOISE_SPRINT_STRENGTH = 6;

type GameState = 'running' | 'victory' | 'defeat';

interface PatrolAnchor {
  position: Vector2;
  suspicion: number;
}

interface NoisePing {
  position: Vector2;
  age: number;
  duration: number;
}

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

  tryAttack(units: DarkUnit[]): DarkUnit[] {
    if (this.swingTimer > 0) {
      return this._collectHits(units);
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
    return this._collectHits(units);
  }

  private _collectHits(units: DarkUnit[]): DarkUnit[] {
    if (this.swingAngle == null) {
      return [];
    }
    const hits: DarkUnit[] = [];
    for (const unit of units) {
      if (!unit.alive) continue;
      if (unit.pos.distanceTo(this.pos) > MELEE_RANGE) continue;
      if (this._pointInArc(unit.pos)) {
        hits.push(unit);
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

class DarkUnit {
  public velocity = new Vector2();
  public detecting = false;
  public wanderTimer = 0;
  public damageTimer = 0;
  public alive = true;
  public hp: number;
  public behavior: 'idle' | 'chasing' | 'searching' | 'investigating' = 'idle';

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

  constructor(public pos: Vector2, public readonly type: UnitType) {
    this.hp = UNIT_STATS[type].maxHp;
    this._pickNewDirection();
  }

  update(dt: number, knight: Knight, game: Game): void {
    if (!this.alive) {
      return;
    }

    const dtRatio = dt * FPS;
    const stats = UNIT_STATS[this.type];
    const toKnight = knight.pos.clone().subtract(this.pos);
    const distance = toKnight.length();
    const previouslyDetecting = this.detecting;
    this.detecting = distance <= stats.detectionRadius;
    const tankCanPersist = this.type === 'tank' && distance <= stats.detectionRadius + TANK_CHASE_PERSIST_DISTANCE;

    if (this.detecting && distance > 0) {
      this.lineOfSightTimer += dt;
      if (this.lineOfSightTimer >= KNIGHT_SIGHT_CONFIRM_TIME && this.lineOfSightTimer - dt < KNIGHT_SIGHT_CONFIRM_TIME) {
        if (this.type === 'scout') {
          console.log(`[SCOUT] Howl! Knight spotted at (${knight.pos.x.toFixed(0)}, ${knight.pos.y.toFixed(0)})`);
        }
        game.registerKnightSighting(knight.pos);
      }
      this.behavior = 'chasing';
      this.searchTimer = SEARCH_DURATION;
      this.searchOrigin = knight.pos.clone();
    } else {
      if (previouslyDetecting && this.behavior === 'chasing' && !tankCanPersist) {
        this._beginSearch(game);
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

    this._updateDetectionTint(dtRatio);
    this._updatePriestReveal(dt, distance, knight, game);

    switch (this.behavior) {
      case 'chasing':
        this._steerTowards(knight.pos, stats.maxSpeed, dtRatio);
        break;
      case 'searching':
        this._updateSearch(dt, game, stats, dtRatio);
        break;
      case 'investigating':
        this._updateInvestigation(dt, stats, dtRatio);
        break;
      default:
        this._updateIdle(dt, game, stats, dtRatio);
        break;
    }

    this.pos.add(this.velocity.clone().scale(dtRatio));
    this._handleBounds();

    if (this.damageTimer > 0) {
      this.damageTimer = Math.max(0, this.damageTimer - dt);
    }
  }

  private _pickNewDirection(): void {
    const stats = UNIT_STATS[this.type];
    const angle = Math.random() * Math.PI * 2;
    const speed = stats.minSpeed + Math.random() * (stats.maxSpeed - stats.minSpeed);
    this.velocity.set(Math.cos(angle) * speed, Math.sin(angle) * speed);
    this.wanderTimer = UNIT_WANDER_INTERVAL[0] + Math.random() * (UNIT_WANDER_INTERVAL[1] - UNIT_WANDER_INTERVAL[0]);
  }

  private _steerTowards(target: Vector2, speed: number, dtRatio: number, lerpScale = UNIT_DETECTION_LERP): void {
    const desired = target.clone().subtract(this.pos);
    if (desired.lengthSq() === 0) {
      return;
    }
    desired.normalize().scale(speed);
    const blend = Math.min(1, lerpScale * dtRatio);
    this.velocity.lerp(desired, blend);
  }

  private _beginSearch(game: Game): void {
    const known = game.getLastKnownKnightPos();
    this.searchOrigin = known ? known.clone() : this.searchOrigin;
    if (!this.searchOrigin) {
      this.behavior = 'idle';
      return;
    }
    this.behavior = 'searching';
    this.searchTimer = SEARCH_DURATION;
    this.searchAngle = Math.random() * Math.PI * 2;
    this.searchRadius = 16;
  }

  private _updateSearch(dt: number, game: Game, stats: UnitStats, dtRatio: number): void {
    const origin = this.searchOrigin ?? game.getLastKnownKnightPos();
    if (!origin) {
      this.behavior = 'idle';
      return;
    }
    this.searchTimer -= dt;
    if (this.searchTimer <= 0) {
      this.behavior = 'idle';
      this.searchOrigin = null;
      return;
    }
    this.searchAngle += SEARCH_SPIN_SPEED * dt;
    this.searchRadius += SEARCH_RADIUS_GROWTH * dt;
    const offset = new Vector2(Math.cos(this.searchAngle), Math.sin(this.searchAngle)).scale(this.searchRadius);
    const target = origin.clone().add(offset);
    this._steerTowards(target, stats.maxSpeed * 0.9, dtRatio, UNIT_DETECTION_LERP * 0.8);
  }

  private _updateInvestigation(dt: number, stats: UnitStats, dtRatio: number): void {
    if (!this.investigationTarget) {
      this.behavior = 'idle';
      return;
    }
    this.investigationTimer = Math.max(0, this.investigationTimer - dt);
    if (this.investigationTimer <= 0) {
      this.behavior = 'idle';
      this.investigationTarget = null;
      return;
    }
    const distance = this.pos.distanceTo(this.investigationTarget);
    if (distance < 12) {
      this.behavior = 'idle';
      this.investigationTarget = null;
      return;
    }
    this._steerTowards(this.investigationTarget, stats.maxSpeed * 0.75, dtRatio, UNIT_DETECTION_LERP * 0.6);
  }

  private _updateIdle(dt: number, game: Game, stats: UnitStats, dtRatio: number): void {
    let followingAnchor = false;
    const anchor = game.getHighestSuspicionAnchor();
    if (anchor) {
      const toAnchor = anchor.position.clone().subtract(this.pos);
      const buffer = this.type === 'tank' ? 32 : 18;
      if (toAnchor.length() > buffer) {
        followingAnchor = true;
        const boost = this.type === 'scout' ? 1.5 : this.type === 'priest' ? 1.2 : 1.0;
        const speed = Math.min(stats.maxSpeed, Math.max(stats.minSpeed, stats.minSpeed * boost));
        const lerpScale = this.type === 'tank' ? UNIT_DETECTION_LERP * 0.4 : UNIT_DETECTION_LERP * 0.5;
        this._steerTowards(anchor.position, speed, dtRatio, lerpScale);
      }
    }

    if (!followingAnchor) {
      this.wanderTimer -= dt;
      if (this.wanderTimer <= 0) {
        this._pickNewDirection();
      }
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

  private _handleBounds(): void {
    const half = this._getHalfSize();
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

  receiveArcHit(knight: Knight): boolean {
    if (!this.alive) {
      return false;
    }
    this.takeDamage(1);
    if (this.type === 'tank') {
      this._applyTankKnockback(knight);
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
    const half = this._getHalfSize();
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

  private _updateDetectionTint(dtRatio: number): void {
    const target = this.detecting ? 1 : 0;
    const blend = Math.min(1, DETECTION_TINT_LERP * dtRatio);
    this.detectionTint += (target - this.detectionTint) * blend;
    this.detectionTint = Math.max(0, Math.min(1, this.detectionTint));
  }

  private _updatePriestReveal(dt: number, distance: number, knight: Knight, game: Game): void {
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

  private _applyTankKnockback(knight: Knight): void {
    const push = this.pos.clone().subtract(knight.pos);
    if (push.lengthSq() === 0) {
      push.set(Math.random() - 0.5, Math.random() - 0.5);
    }
    push.normalize().scale(TANK_KNOCKBACK_STRENGTH);
    this.velocity.add(push);
  }

  private _getHalfSize(): number {
    return UNIT_STATS[this.type].size / 2;
  }
}

class Seal {
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

class DarkLordAI {
  public evilEnergy = 0;
  private energyAccumulator = 0;
  private spawnTimer = 0;
  private knightRevealPos: Vector2 | null = null;
  private knightRevealTimer = 0;

  update(dt: number, game: Game): void {
    this._accumulateEnergy(dt);
    this._decayReveal(dt);

    this.spawnTimer += dt;
    while (this.spawnTimer >= DARK_LORD_SPAWN_INTERVAL) {
      this.spawnTimer -= DARK_LORD_SPAWN_INTERVAL;
      this._trySpawn(game);
    }
  }

  registerKnightReveal(position: Vector2): void {
    this.knightRevealPos = position.clone();
    this.knightRevealTimer = DARK_LORD_REVEAL_MEMORY;
  }

  private _accumulateEnergy(dt: number): void {
    this.energyAccumulator += dt * DARK_LORD_ENERGY_PER_SEC;
    if (this.energyAccumulator >= 1) {
      const gained = Math.floor(this.energyAccumulator);
      this.evilEnergy += gained;
      this.energyAccumulator -= gained;
    }
  }

  private _decayReveal(dt: number): void {
    if (this.knightRevealTimer > 0) {
      this.knightRevealTimer = Math.max(0, this.knightRevealTimer - dt);
      if (this.knightRevealTimer === 0) {
        this.knightRevealPos = null;
      }
    }
  }

  private _trySpawn(game: Game): void {
    if (this.evilEnergy < CHEAPEST_UNIT_COST) {
      return;
    }
    if (!game.canSpawnMoreUnits()) {
      return;
    }

    if (game.isAnySealChanneling()) {
      this._spawnResponseForSeal(game);
      return;
    }

    if (this.knightRevealPos && this.knightRevealTimer > 0) {
      this._spawnResponseToReveal(game);
      return;
    }

    this._spawnCoverageScout(game);
  }

  private _spawnResponseForSeal(game: Game): void {
    const seal = game.getChannelingSeal();
    const target = seal?.pos ?? CASTLE_POS;
    const spawnPoint = game.getCastleEdgePoint(target);

    for (let i = 0; i < 2; i++) {
      if (!this._spawnUnit(game, 'scout', this._jitter(spawnPoint, 12))) {
        return;
      }
    }

    this._spawnUnit(game, 'tank', this._jitter(spawnPoint, 16));
  }

  private _spawnResponseToReveal(game: Game): void {
    const location = this.knightRevealPos ?? CASTLE_POS;
    const jittered = this._jitter(location, 18);
    if (!this._spawnUnit(game, 'tank', jittered)) {
      return;
    }
    this._spawnUnit(game, 'priest', this._jitter(location, 18));
  }

  private _spawnCoverageScout(game: Game): void {
    const anchor = game.getNextAnchor();
    this._spawnUnit(game, 'scout', this._jitter(anchor, 14));
  }

  private _spawnUnit(game: Game, type: UnitType, position: Vector2): boolean {
    if (!this._canAfford(type)) {
      return false;
    }
    if (!game.spawnUnit(type, position)) {
      return false;
    }
    this.evilEnergy -= UNIT_STATS[type].cost;
    return true;
  }

  private _canAfford(type: UnitType): boolean {
    return this.evilEnergy >= UNIT_STATS[type].cost;
  }

  private _jitter(position: Vector2, radius: number): Vector2 {
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * radius;
    return position.clone().add(new Vector2(Math.cos(angle) * distance, Math.sin(angle) * distance));
  }
}

class Game {
  public knight = new Knight();
  public units: DarkUnit[] = [];
  public darkLord = new DarkLordAI();
  public seals: Seal[] = [];
  public brokenSeals = 0;
  public state: GameState = 'running';
  private anchors: PatrolAnchor[] = [];
  private nextAnchorIndex = 0;
  private lastKnownKnightPos: Vector2 | null = null;
  private noisePings: NoisePing[] = [];
  private debugAnchors = false;
  private lastPointerTime = 0;
  private lastPointerPos: Vector2 | null = null;
  private shieldWasActive = true;
  private shieldFlashTimer = 0;

  constructor() {
    this.anchors = this._generateAnchors();
    this.seals = this._generateSeals();
    this._spawnInitialUnits(5);
    this.shieldWasActive = this._isShieldActive();
  }

  reset(): void {
    this.knight = new Knight();
    this.units = [];
    this.darkLord = new DarkLordAI();
    this.seals = this._generateSeals();
    this.brokenSeals = 0;
    this.state = 'running';
    this.anchors = this._generateAnchors();
    this.nextAnchorIndex = 0;
    this.lastKnownKnightPos = null;
    this.noisePings = [];
    this.lastPointerPos = null;
    this.lastPointerTime = 0;
    this.debugAnchors = false;
    this._spawnInitialUnits(5);
    this.shieldWasActive = this._isShieldActive();
    this.shieldFlashTimer = 0;
  }

  canSpawnMoreUnits(): boolean {
    return this.units.length < MAX_UNITS;
  }

  spawnUnit(type: UnitType, position: Vector2): boolean {
    if (!this.canSpawnMoreUnits()) {
      return false;
    }
    const half = UNIT_STATS[type].size / 2;
    const clamped = position.clone().clamp(half, half, WIDTH - half, HEIGHT - half);
    this.units.push(new DarkUnit(clamped, type));
    return true;
  }

  getCastleEdgePoint(towards?: Vector2): Vector2 {
    const direction = towards ? towards.clone().subtract(CASTLE_POS) : this._randomUnitVector();
    if (direction.lengthSq() === 0) {
      direction.set(Math.random() - 0.5, Math.random() - 0.5);
    }
    direction.normalize();
    const jitter = (Math.random() - 0.5) * 10;
    const offset = direction.scale(CASTLE_EDGE_SPAWN_RADIUS + jitter);
    return CASTLE_POS.clone().add(offset);
  }

  getNextAnchor(): Vector2 {
    if (this.anchors.length === 0) {
      this.anchors = this._generateAnchors();
      this.nextAnchorIndex = 0;
    }
    const anchor = this.anchors[this.nextAnchorIndex % this.anchors.length];
    this.nextAnchorIndex = (this.nextAnchorIndex + 1) % this.anchors.length;
    return anchor.position.clone();
  }

  registerKnightReveal(position: Vector2, options?: { escalateSuspicion?: boolean }): void {
    this.lastKnownKnightPos = position.clone();
    if (options?.escalateSuspicion ?? true) {
      this._increaseSuspicion(position, PRIEST_REVEAL_SUSPICION);
    }
    this.darkLord.registerKnightReveal(position);
  }

  registerKnightSighting(position: Vector2): void {
    this.lastKnownKnightPos = position.clone();
    this._increaseSuspicion(position, ANCHOR_SIGHTING_BONUS);
  }

  getLastKnownKnightPos(): Vector2 | null {
    return this.lastKnownKnightPos ? this.lastKnownKnightPos.clone() : null;
  }

  getHighestSuspicionAnchor(): { position: Vector2; suspicion: number } | null {
    if (!this.anchors.length) {
      return null;
    }
    let mostSuspicious = this.anchors[0];
    for (let i = 1; i < this.anchors.length; i++) {
      if (this.anchors[i].suspicion > mostSuspicious.suspicion) {
        mostSuspicious = this.anchors[i];
      }
    }
    if (mostSuspicious.suspicion <= 0.1) {
      return null;
    }
    return { position: mostSuspicious.position.clone(), suspicion: mostSuspicious.suspicion };
  }

  isAnySealChanneling(): boolean {
    return this.seals.some((seal) => seal.channeling);
  }

  getChannelingSeal(): Seal | null {
    return this.seals.find((seal) => seal.channeling) ?? null;
  }

  private _spawnInitialUnits(count: number): void {
    for (let i = 0; i < count; i++) {
      const position = this.getCastleEdgePoint();
      this.spawnUnit('scout', position);
    }
  }

  private _generateAnchors(): PatrolAnchor[] {
    const anchors: PatrolAnchor[] = [];
    for (let i = 0; i < PATROL_ANCHOR_COUNT; i++) {
      const angle = (i / PATROL_ANCHOR_COUNT) * Math.PI * 2;
      const position = CASTLE_POS.clone().add(
        new Vector2(Math.cos(angle) * PATROL_ANCHOR_RADIUS, Math.sin(angle) * PATROL_ANCHOR_RADIUS)
      );
      position.clamp(UNIT_MAX_HALF_SIZE, UNIT_MAX_HALF_SIZE, WIDTH - UNIT_MAX_HALF_SIZE, HEIGHT - UNIT_MAX_HALF_SIZE);
      anchors.push({ position, suspicion: 0 });
    }
    return anchors;
  }

  private _increaseSuspicion(position: Vector2, amount: number): void {
    if (!this.anchors.length || amount <= 0) {
      return;
    }
    for (const anchor of this.anchors) {
      const weight = 1 / (anchor.position.distanceTo(position) + 1);
      const nextValue = anchor.suspicion + amount * weight;
      anchor.suspicion = Math.min(ANCHOR_SUSPICION_MAX, nextValue);
    }
  }

  private _updateAnchors(dt: number): void {
    if (!this.anchors.length) {
      return;
    }
    for (const anchor of this.anchors) {
      anchor.suspicion = Math.max(0, anchor.suspicion - ANCHOR_SUSPICION_DECAY * dt);
    }
  }

  private _emitNoise(position: Vector2, strength: number): void {
    if (strength <= 0) {
      return;
    }
    const source = position.clone();
    this.noisePings.push({ position: source.clone(), age: 0, duration: NOISE_PING_DURATION });
    this._increaseSuspicion(source, strength);
    for (const unit of this.units) {
      unit.notifyNoise(source);
    }
  }

  private _updateNoise(dt: number): void {
    if (!this.noisePings.length) {
      return;
    }
    for (const ping of this.noisePings) {
      ping.age += dt;
    }
    this.noisePings = this.noisePings.filter((ping) => ping.age < ping.duration);
  }

  private _drawNoisePings(ctx: CanvasRenderingContext2D): void {
    if (!this.noisePings.length) {
      return;
    }
    ctx.save();
    ctx.strokeStyle = 'rgba(220, 80, 80, 0.6)';
    ctx.lineWidth = 2;
    for (const ping of this.noisePings) {
      const progress = Math.min(1, ping.age / ping.duration);
      const radius = NOISE_PING_MIN_RADIUS + (NOISE_PING_MAX_RADIUS - NOISE_PING_MIN_RADIUS) * progress;
      ctx.globalAlpha = 1 - progress;
      ctx.beginPath();
      ctx.arc(ping.position.x, ping.position.y, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  private _drawAnchorDebug(ctx: CanvasRenderingContext2D): void {
    if (!this.anchors.length) {
      return;
    }
    ctx.save();
    for (const anchor of this.anchors) {
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = '#FF8080';
      ctx.beginPath();
      ctx.arc(anchor.position.x, anchor.position.y, 3, 0, Math.PI * 2);
      ctx.fill();

      const barHeight = 20;
      const barWidth = 4;
      const clampedSuspicion = Math.min(ANCHOR_SUSPICION_MAX, anchor.suspicion);
      const ratio = clampedSuspicion / ANCHOR_SUSPICION_MAX;

      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#FF5E5E';
      ctx.fillRect(anchor.position.x + 6, anchor.position.y - barHeight / 2, barWidth, barHeight);

      ctx.globalAlpha = 0.65;
      ctx.fillStyle = '#FF3030';
      ctx.fillRect(
        anchor.position.x + 6,
        anchor.position.y + barHeight / 2 - barHeight * ratio,
        barWidth,
        barHeight * ratio
      );
    }
    ctx.restore();
  }

  private _randomUnitVector(): Vector2 {
    const angle = Math.random() * Math.PI * 2;
    return new Vector2(Math.cos(angle), Math.sin(angle));
  }

  private _generateSeals(): Seal[] {
    const seals: Seal[] = [];
    const maxAttempts = 800;
    const minRadius = SEAL_MIN_CASTLE_DIST;
    const maxRadius = Math.max(minRadius, Math.min(WIDTH, HEIGHT) / 2 - 80);
    const radiusRange = Math.max(0, maxRadius - minRadius);

    for (let attempts = 0; seals.length < SEAL_COUNT && attempts < maxAttempts; attempts++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = minRadius + (radiusRange > 0 ? Math.random() * radiusRange : 0);
      const pos = CASTLE_POS.clone().add(new Vector2(Math.cos(angle) * radius, Math.sin(angle) * radius));
      if (seals.some((seal) => seal.pos.distanceTo(pos) < SEAL_MIN_SEPARATION)) {
        continue;
      }
      seals.push(new Seal(pos));
    }

    if (seals.length < SEAL_COUNT) {
      const fallbackRadius = Math.max(minRadius, minRadius + radiusRange / 2);
      for (let i = seals.length; i < SEAL_COUNT; i++) {
        const angle = (i / SEAL_COUNT) * Math.PI * 2;
        const pos = CASTLE_POS.clone().add(new Vector2(Math.cos(angle) * fallbackRadius, Math.sin(angle) * fallbackRadius));
        seals.push(new Seal(pos));
      }
    }

    return seals;
  }

  private _updateSeals(dt: number): void {
    for (let i = this.seals.length - 1; i >= 0; i--) {
      const seal = this.seals[i];
      const { completed, started } = seal.update(this.knight.pos, dt);
      if (started) {
        this._emitNoise(seal.pos, NOISE_SEAL_STRENGTH);
      }
      if (seal.channeling) {
        this._increaseSuspicion(seal.pos, ANCHOR_SEAL_CHANNEL_RATE * dt);
      }
      if (completed) {
        this.seals.splice(i, 1);
        this.brokenSeals += 1;
      }
    }
  }

  onPointer(x: number, y: number, timeSeconds?: number): void {
    if (this.state !== 'running') {
      return;
    }
    const target = new Vector2(x, y);
    if (
      typeof timeSeconds === 'number' &&
      this.lastPointerTime > 0 &&
      timeSeconds - this.lastPointerTime <= NOISE_SPRINT_WINDOW &&
      this.lastPointerPos &&
      this.lastPointerPos.distanceTo(target) > 35
    ) {
      this._emitNoise(target, NOISE_SPRINT_STRENGTH);
    }

    this.knight.setTarget(target);

    if (typeof timeSeconds === 'number') {
      this.lastPointerTime = timeSeconds;
      this.lastPointerPos = target;
    } else {
      this.lastPointerTime = 0;
      this.lastPointerPos = target;
    }
  }

  toggleAnchorDebug(): void {
    this.debugAnchors = !this.debugAnchors;
  }

  update(dt: number): void {
    if (this.state !== 'running') {
      this._updateShield(dt);
      return;
    }

    this.knight.update(dt);
    this._updateSeals(dt);
    this._updateShield(dt);

    for (const unit of this.units) {
      unit.update(dt, this.knight, this);
      unit.attemptDamage(this.knight);
    }

    this.units = this.units.filter((unit) => unit.alive);

    if (this.knight.hp <= 0) {
      this.state = 'defeat';
      return;
    }

    const hits = this.knight.tryAttack(this.units);
    if (hits.length) {
      let kills = 0;
      for (const unit of hits) {
        const wasAlive = unit.alive;
        const died = unit.receiveArcHit(this.knight);
        if (wasAlive && died) {
          kills += 1;
        }
      }
      if (kills > 0) {
        this._emitNoise(this.knight.pos, NOISE_ATTACK_STRENGTH);
      }
      this.units = this.units.filter((unit) => unit.alive);
    }

    this.darkLord.update(dt, this);

    this._updateAnchors(dt);
    this._updateNoise(dt);

    this._updateVictory(dt);
  }

  private _updateVictory(dt: number): void {
    if (this.brokenSeals < SEAL_COUNT) {
      this.knight.castleTimer = 0;
      return;
    }
    if (this.knight.pos.distanceTo(CASTLE_POS) <= CASTLE_WIN_RADIUS) {
      this.knight.castleTimer += dt;
      if (this.knight.castleTimer >= CASTLE_STAY_TIME) {
        this.state = 'victory';
      }
    } else {
      this.knight.castleTimer = 0;
    }
  }

  private _updateShield(dt: number): void {
    const shieldActive = this._isShieldActive();
    if (this.shieldWasActive && !shieldActive) {
      this.shieldFlashTimer = SHIELD_FLASH_DURATION;
    }
    this.shieldWasActive = shieldActive;

    if (this.shieldFlashTimer > 0) {
      this.shieldFlashTimer = Math.max(0, this.shieldFlashTimer - dt);
    }
  }

  private _isShieldActive(): boolean {
    return this.brokenSeals < SEAL_COUNT;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = BACKGROUND_COLOR;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    this._drawShield(ctx);
    this._drawCastle(ctx);

    for (const seal of this.seals) {
      seal.draw(ctx);
    }

    for (const unit of this.units) {
      unit.draw(ctx);
    }

    this._drawNoisePings(ctx);

    if (this.debugAnchors) {
      this._drawAnchorDebug(ctx);
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

  private _drawShield(ctx: CanvasRenderingContext2D): void {
    const shieldActive = this._isShieldActive();
    if (!shieldActive && this.shieldFlashTimer <= 0) {
      return;
    }

    const radius = SHIELD_RING_RADIUS;
    ctx.save();
    ctx.beginPath();
    ctx.arc(CASTLE_POS.x, CASTLE_POS.y, radius, 0, Math.PI * 2);
    if (shieldActive) {
      ctx.lineWidth = SHIELD_RING_WIDTH;
      ctx.strokeStyle = SHIELD_RING_COLOR;
      ctx.stroke();
      ctx.restore();
      return;
    }

    const progress = this.shieldFlashTimer / SHIELD_FLASH_DURATION;
    const clamped = Math.max(0, Math.min(1, progress));
    ctx.lineWidth = SHIELD_FLASH_WIDTH + 4 * clamped;
    const alpha = 0.25 + 0.55 * clamped;
    const { r, g, b } = SHIELD_FLASH_COLOR;
    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`;
    ctx.stroke();
    ctx.restore();
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
    const text = `HP: ${this.knight.hp}  Evil: ${this.darkLord.evilEnergy}  Units: ${this.units.length}/${MAX_UNITS}  Seals: ${this.brokenSeals}/${SEAL_COUNT}`;
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

function rgbToHex(rgb: { r: number; g: number; b: number }): string {
  const clamp = (value: number) => Math.max(0, Math.min(255, Math.round(value)));
  const toHex = (value: number) => clamp(value).toString(16).padStart(2, '0');
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

function mixColors(colorA: string, colorB: string, t: number): string {
  const clampedT = Math.max(0, Math.min(1, t));
  const a = hexToRgb(colorA);
  const b = hexToRgb(colorB);
  return rgbToHex({
    r: a.r + (b.r - a.r) * clampedT,
    g: a.g + (b.g - a.g) * clampedT,
    b: a.b + (b.b - a.b) * clampedT
  });
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
  game.onPointer(x, y, event.timeStamp / 1000);
});

window.addEventListener('keydown', (event) => {
  if (event.key.toLowerCase() === 'r') {
    game.reset();
  } else if (event.key === 'F1') {
    event.preventDefault();
    game.toggleAnchorDebug();
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
