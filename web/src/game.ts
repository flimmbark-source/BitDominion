import {
  ANCHOR_SEAL_CHANNEL_RATE,
  ANCHOR_SIGHTING_BONUS,
  ANCHOR_SUSPICION_DECAY,
  ANCHOR_SUSPICION_MAX,
  BACKGROUND_COLOR,
  CASTLE_COLOR_DEC,
  CASTLE_EDGE_SPAWN_RADIUS,
  CASTLE_POS,
  CASTLE_SIZE,
  CASTLE_STAY_TIME,
  CASTLE_WIN_RADIUS,
  DEFEAT_COLOR,
  HEIGHT,
  HP_BAR_BACKGROUND_COLOR,
  HP_BAR_BORDER_COLOR,
  HP_BAR_FILL_COLOR,
  HP_BAR_HEIGHT,
  HP_BAR_TEXT_COLOR,
  HP_BAR_WIDTH,
  HUD_COLOR,
  KNIGHT_HP,
  MAX_UNITS,
  NOISE_ATTACK_STRENGTH,
  NOISE_PING_DURATION,
  NOISE_PING_MAX_RADIUS,
  NOISE_PING_MIN_RADIUS,
  NOISE_SEAL_STRENGTH,
  NOISE_SPRINT_STRENGTH,
  NOISE_SPRINT_WINDOW,
  PRIEST_REVEAL_SUSPICION,
  PATROL_ANCHOR_COUNT,
  PATROL_ANCHOR_RADIUS,
  SEAL_COUNT,
  SEAL_MIN_CASTLE_DIST,
  SEAL_MIN_SEPARATION,
  SHIELD_FLASH_COLOR,
  SHIELD_FLASH_DURATION,
  SHIELD_FLASH_WIDTH,
  SHIELD_RING_COLOR,
  SHIELD_RING_RADIUS,
  SHIELD_RING_WIDTH,
  UNIT_MAX_HALF_SIZE,
  UNIT_STATS,
  UnitType,
  VICTORY_COLOR,
  WIDTH
} from './config/constants';
import { DarkLordAI } from './ai/darkLordAI';
import { DarkUnit } from './entities/darkUnit';
import { Knight } from './entities/knight';
import { Seal } from './entities/seal';
import { Vector2 } from './math/vector2';
import { World } from './world';

export type GameState = 'running' | 'victory' | 'defeat';

interface PatrolAnchor {
  position: Vector2;
  suspicion: number;
}

interface NoisePing {
  position: Vector2;
  age: number;
  duration: number;
}

export class Game {
  public knight = new Knight();
  public units: DarkUnit[] = [];
  public darkLord = new DarkLordAI();
  public seals: Seal[] = [];
  public brokenSeals = 0;
  public state: GameState = 'running';
  public world = new World();
  private anchors: PatrolAnchor[] = [];
  private nextAnchorIndex = 0;
  private lastKnownKnightPos: Vector2 | null = null;
  private noisePings: NoisePing[] = [];
  private debugOverlay = false;
  private lastPointerTime = 0;
  private lastPointerPos: Vector2 | null = null;
  private shieldWasActive = true;
  private shieldFlashTimer = 0;

  constructor() {
    this.world = new World();
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
    this.world = new World();
    this.anchors = this._generateAnchors();
    this.nextAnchorIndex = 0;
    this.lastKnownKnightPos = null;
    this.noisePings = [];
    this.lastPointerPos = null;
    this.lastPointerTime = 0;
    this.debugOverlay = false;
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
    const castleSpawn = this.getCastleEdgePoint(position);
    const half = UNIT_STATS[type].size / 2;
    const clamped = castleSpawn.clamp(half, half, WIDTH - half, HEIGHT - half);
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

  getNearestAnchorTo(position: Vector2): Vector2 {
    if (!this.anchors.length) {
      this.anchors = this._generateAnchors();
      this.nextAnchorIndex = 0;
    }
    let nearest = this.anchors[0];
    const initialDx = nearest.position.x - position.x;
    const initialDy = nearest.position.y - position.y;
    let nearestDistSq = initialDx * initialDx + initialDy * initialDy;
    for (let i = 1; i < this.anchors.length; i++) {
      const dx = this.anchors[i].position.x - position.x;
      const dy = this.anchors[i].position.y - position.y;
      const distSq = dx * dx + dy * dy;
      if (distSq < nearestDistSq) {
        nearest = this.anchors[i];
        nearestDistSq = distSq;
      }
    }
    return nearest.position.clone();
  }

  isAnySealChanneling(): boolean {
    return this.seals.some((seal) => seal.channeling);
  }

  getChannelingSeal(): Seal | null {
    return this.seals.find((seal) => seal.channeling) ?? null;
  }

  isAnyVillageAlarmed(): boolean {
    return this.world.isAnyVillageAlarmed();
  }

  getAlarmedVillageCenter(): Vector2 | null {
    const village = this.world.getAlarmedVillage();
    return village ? village.center.clone() : null;
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
    this.debugOverlay = !this.debugOverlay;
  }

  toggleCanopy(): void {
    this.world.toggleCanopy();
  }

  update(dt: number): void {
    this.world.beginFrame(dt);
    if (this.state !== 'running') {
      this._updateShield(dt);
      this.world.update(dt, {
        knight: this.knight,
        monsters: this.units,
        emitNoise: (position, strength) => this.emitNoise(position, strength)
      });
      return;
    }

    this.knight.update(dt, this.world);
    this._updateSeals(dt);
    this._updateShield(dt);

    for (const unit of this.units) {
      unit.update(dt, this.knight, this, this.world);
      unit.attemptDamage(this.knight);
    }

    this.units = this.units.filter((unit) => unit.alive);

    this.world.update(dt, {
      knight: this.knight,
      monsters: this.units,
      emitNoise: (position, strength) => this.emitNoise(position, strength)
    });

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

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = BACKGROUND_COLOR;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    this.world.drawTerrain(ctx);
    this._drawShield(ctx);
    this._drawCastle(ctx);

    for (const seal of this.seals) {
      seal.draw(ctx);
    }

    for (const unit of this.units) {
      unit.draw(ctx);
    }

    this.knight.draw(ctx);
    this.knight.drawSwing(ctx);

    this.world.drawCanopy(ctx);
    this.world.drawVillageAlarms(ctx);
    this._drawNoisePings(ctx);

    if (this.debugOverlay) {
      this._drawDebugOverlay(ctx);
    }

    this._drawHud(ctx);

    if (this.state === 'victory') {
      this._drawOverlay(ctx, 'VICTORY', VICTORY_COLOR, 'Press R to restart');
    } else if (this.state === 'defeat') {
      this._drawOverlay(ctx, 'DEFEAT', DEFEAT_COLOR, 'Press R to restart');
    }
  }

  private _spawnInitialUnits(count: number): void {
    for (let i = 0; i < count; i++) {
      this.spawnUnit('scout', CASTLE_POS);
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

  emitNoise(position: Vector2, strength: number): void {
    this._emitNoise(position, strength);
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

  private _drawDebugOverlay(ctx: CanvasRenderingContext2D): void {
    this.world.drawDebug(ctx);
    this._drawAnchorDebug(ctx);
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
    ctx.save();

    const hpBarX = 12;
    const hpBarY = 12;
    const hpRatio = Math.max(0, Math.min(1, this.knight.hp / KNIGHT_HP));

    ctx.fillStyle = HP_BAR_BACKGROUND_COLOR;
    ctx.fillRect(hpBarX, hpBarY, HP_BAR_WIDTH, HP_BAR_HEIGHT);

    if (hpRatio > 0) {
      ctx.fillStyle = HP_BAR_FILL_COLOR;
      ctx.fillRect(hpBarX, hpBarY, HP_BAR_WIDTH * hpRatio, HP_BAR_HEIGHT);
    }

    ctx.lineWidth = 2;
    ctx.strokeStyle = HP_BAR_BORDER_COLOR;
    ctx.strokeRect(hpBarX, hpBarY, HP_BAR_WIDTH, HP_BAR_HEIGHT);

    ctx.font = '14px Consolas, monospace';
    ctx.fillStyle = HP_BAR_TEXT_COLOR;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`HP ${this.knight.hp}/${KNIGHT_HP}`, hpBarX + HP_BAR_WIDTH / 2, hpBarY + HP_BAR_HEIGHT / 2);

    const statsY = hpBarY + HP_BAR_HEIGHT + 12;
    ctx.font = '18px Consolas, monospace';
    ctx.fillStyle = HUD_COLOR;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const statsText = `Evil: ${this.darkLord.evilEnergy}  Units: ${this.units.length}/${MAX_UNITS}  Seals: ${this.brokenSeals}/${SEAL_COUNT}`;
    ctx.fillText(statsText, hpBarX, statsY);

    ctx.restore();
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
