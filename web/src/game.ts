import {
  ANCHOR_SEAL_CHANNEL_RATE,
  ANCHOR_SIGHTING_BONUS,
  ANCHOR_SUSPICION_DECAY,
  ANCHOR_SUSPICION_MAX,
  BACKGROUND_COLOR,
  BARRICADE_KNIGHT_SPEED_SCALE,
  BUILDING_CONSTRUCTION_RADIUS,
  BUILDING_DISMANTLE_TIME,
  BUILDING_MIN_SPACING,
  BUILDING_REPAIR_COST,
  BUILDING_REPAIR_TIME,
  BuildingType,
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
  HP_BAR_WIDTH,
  HUD_COLOR,
  KNIGHT_BOW_NOISE,
  KNIGHT_BOW_COOLDOWN_MULTIPLIER,
  KNIGHT_HP,
  KNIGHT_SIZE,
  KNIGHT_SPEED_BOOST_MULTIPLIER,
  LURE_BEACON_NOISE_INTERVAL,
  LURE_BEACON_NOISE_STRENGTH,
  MAX_UNITS,
  NOISE_ATTACK_STRENGTH,
  NOISE_PING_DURATION,
  NOISE_PING_MAX_RADIUS,
  NOISE_PING_MIN_RADIUS,
  NOISE_SEAL_STRENGTH,
  NOISE_SPRINT_STRENGTH,
  NOISE_SPRINT_WINDOW,
  PATROL_ANCHOR_COUNT,
  PATROL_ANCHOR_RADIUS,
  PRIEST_REVEAL_SUSPICION,
  SEAL_CHANNEL_RADIUS,
  SEAL_COUNT,
  SEAL_MIN_CASTLE_DIST,
  SEAL_MIN_SEPARATION,
  SHIELD_FLASH_COLOR,
  SHIELD_FLASH_DURATION,
  SHIELD_FLASH_WIDTH,
  SHIELD_RING_COLOR,
  SHIELD_RING_RADIUS,
  SHIELD_RING_WIDTH,
  SPIKE_TRAP_SLOW_DURATION,
  SPIKE_TRAP_SLOW_FACTOR,
  SUPPLIES_CHEST_BONUS,
  SUPPLIES_PASSIVE_AMOUNT,
  SUPPLIES_PASSIVE_INTERVAL,
  SUPPLIES_SEAL_BONUS,
  UNIT_MAX_HALF_SIZE,
  UNIT_STATS,
  UnitType,
  VICTORY_COLOR,
  WATCHTOWER_AURA_MULTIPLIER,
  WATCHTOWER_DAMAGE,
  WATCHTOWER_FIRE_INTERVAL,
  WATCHTOWER_NOISE_STRENGTH,
  WATCHTOWER_PROJECTILE_SPEED,
  WATCHTOWER_RANGE,
  WIDTH,
  WORKSHOP_AURA_RADIUS,
  HUT_STEER_STRENGTH
} from './config/constants';
import { DarkLordAI } from './ai/darkLordAI';
import { DarkUnit } from './entities/darkUnit';
import {
  BuildingInstance,
  createBuilding,
  getBuildingDefinition,
  getBuildingHalfSize,
  isKnightWithinConstructionRange
} from './entities/building';
import { Knight } from './entities/knight';
import { Seal } from './entities/seal';
import { Vector2 } from './math/vector2';
import { World } from './world';
import { ITEM_DEFINITIONS, ItemId } from './config/items';

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

interface TowerProjectile {
  id: number;
  position: Vector2;
  velocity: Vector2;
  target: DarkUnit | null;
  damage: number;
  sourceId: number;
}

interface KnightProjectile {
  id: number;
  position: Vector2;
  velocity: Vector2;
  target: DarkUnit | null;
  damage: number;
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
  private supplies = 0;
  private supplyTimer = 0;
  private buildings: BuildingInstance[] = [];
  private projectiles: TowerProjectile[] = [];
  private knightProjectiles: KnightProjectile[] = [];
  private buildMode = false;
  private buildSelection: BuildingType = 'watchtower';
  private buildCursor: Vector2 | null = null;
  private dismantleState: { buildingId: number; progress: number } | null = null;
  private hasWorkshopTech = false;
  private projectileIdCounter = 1;
  private knightProjectileIdCounter = 1;
  private readonly buildOrder: BuildingType[] = ['watchtower', 'barricade', 'spike', 'beacon', 'workshop'];
  private canvasHudEnabled = true;
  private ownedItems: Set<ItemId> = new Set();

  constructor() {
    this.world = new World();
    this.anchors = this._generateAnchors();
    this.seals = this._generateSeals();
    this._spawnInitialUnits(5);
    this.shieldWasActive = this._isShieldActive();
    this.world.setBuildingObstacles([]);
    this._initializeKnightLoadout();
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
    this.supplies = 0;
    this.supplyTimer = 0;
    this.buildings = [];
    this.projectiles = [];
    this.buildMode = false;
    this.buildSelection = 'watchtower';
    this.buildCursor = null;
    this.dismantleState = null;
    this.hasWorkshopTech = false;
    this.projectileIdCounter = 1;
    this._initializeKnightLoadout();
    this._spawnInitialUnits(5);
    this.shieldWasActive = this._isShieldActive();
    this.shieldFlashTimer = 0;
    this.world.setBuildingObstacles([]);
  }

  setCanvasHudEnabled(enabled: boolean): void {
    this.canvasHudEnabled = enabled;
  }

  getSupplies(): number {
    return this.supplies;
  }

  getOwnedItems(): ItemId[] {
    return Array.from(this.ownedItems);
  }

  isItemOwned(itemId: ItemId): boolean {
    return this.ownedItems.has(itemId);
  }

  canPurchaseItem(itemId: ItemId): boolean {
    const definition = ITEM_DEFINITIONS[itemId];
    if (!definition) {
      return false;
    }
    if (definition.unique && this.ownedItems.has(itemId)) {
      return false;
    }
    return this.supplies >= definition.cost;
  }

  purchaseItem(itemId: ItemId): boolean {
    const definition = ITEM_DEFINITIONS[itemId];
    if (!definition) {
      return false;
    }
    if (definition.unique && this.ownedItems.has(itemId)) {
      return false;
    }
    if (this.supplies < definition.cost) {
      return false;
    }
    this.supplies -= definition.cost;
    this._grantItem(itemId);
    return true;
  }

  getBuildOrder(): readonly BuildingType[] {
    return this.buildOrder;
  }

  getSelectedBlueprint(): BuildingType {
    return this.buildSelection;
  }

  getSelectedBlueprintIndex(): number {
    return this.buildOrder.indexOf(this.buildSelection);
  }

  isBuildModeActive(): boolean {
    return this.buildMode;
  }

  setBuildMode(enabled: boolean): void {
    if (this.buildMode === enabled) {
      return;
    }
    this.buildMode = enabled;
    if (this.buildMode) {
      this.buildCursor = this.lastPointerPos ? this.lastPointerPos.clone() : null;
    } else {
      this.buildCursor = null;
    }
  }

  canAffordBlueprint(type: BuildingType): boolean {
    return this._canAfford(type);
  }

  getDarkEnergy(): number {
    return this.darkLord.evilEnergy;
  }

  getUnitCount(): number {
    return this.units.length;
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

  getBuildings(): readonly BuildingInstance[] {
    return this.buildings;
  }

  getBuildingById(id: number): BuildingInstance | null {
    return this.buildings.find((building) => building.id === id) ?? null;
  }

  getActiveWatchtowerCount(): number {
    return this.buildings.filter((building) => building.type === 'watchtower' && building.state === 'active').length;
  }

  hasActiveBeacon(): boolean {
    return this.buildings.some((building) => building.type === 'beacon' && building.state === 'active');
  }

  getActiveBeacons(): BuildingInstance[] {
    return this.buildings.filter((building) => building.type === 'beacon' && building.state === 'active');
  }

  damageBuilding(id: number, amount: number): void {
    const building = this.getBuildingById(id);
    if (!building || amount <= 0) {
      return;
    }
    building.hp = Math.max(0, building.hp - amount);
  }

  onPointerDown(x: number, y: number, button: number, timeSeconds?: number): void {
    const point = new Vector2(x, y);
    if (this.buildMode) {
      this.buildCursor = point.clone();
    }

    if (this.state !== 'running') {
      return;
    }

    if (this.buildMode) {
      if (button === 0) {
        if (this._tryPlaceBuilding(point)) {
          this.knight.setTarget(point.clone());
          if (typeof timeSeconds === 'number') {
            this.lastPointerTime = timeSeconds;
          } else {
            this.lastPointerTime = 0;
          }
          this.lastPointerPos = point.clone();
          return;
        }
      } else if (button === 2) {
        this._exitBuildMode();
        return;
      }
    }

    if (button === 2) {
      this._exitBuildMode();
      return;
    }

    if (button !== 0) {
      return;
    }

    if (
      typeof timeSeconds === 'number' &&
      this.lastPointerTime > 0 &&
      timeSeconds - this.lastPointerTime <= NOISE_SPRINT_WINDOW &&
      this.lastPointerPos &&
      this.lastPointerPos.distanceTo(point) > 35
    ) {
      this._emitNoise(point, NOISE_SPRINT_STRENGTH);
    }

    this.knight.setTarget(point.clone());

    if (typeof timeSeconds === 'number') {
      this.lastPointerTime = timeSeconds;
      this.lastPointerPos = point.clone();
    } else {
      this.lastPointerTime = 0;
      this.lastPointerPos = point.clone();
    }
  }

  onPointerMove(x: number, y: number): void {
    if (!this.buildMode) {
      return;
    }
    this.buildCursor = new Vector2(x, y);
  }

  toggleAnchorDebug(): void {
    this.debugOverlay = !this.debugOverlay;
  }

  toggleBuildMode(): void {
    this.setBuildMode(!this.buildMode);
  }

  selectBlueprint(index: number): void {
    if (index < 0 || index >= this.buildOrder.length) {
      return;
    }
    this.buildSelection = this.buildOrder[index];
  }

  cancelBuildPreview(): void {
    this.setBuildMode(false);
  }

  startDismantle(): void {
    let nearest: BuildingInstance | null = null;
    let nearestDist = Number.POSITIVE_INFINITY;
    for (const building of this.buildings) {
      if (building.state !== 'active') {
        continue;
      }
      const distance = building.position.distanceTo(this.knight.pos);
      if (distance <= BUILDING_CONSTRUCTION_RADIUS && distance < nearestDist) {
        nearest = building;
        nearestDist = distance;
      }
    }
    if (!nearest) {
      return;
    }
    this.dismantleState = { buildingId: nearest.id, progress: 0 };
    nearest.dismantleProgress = 0;
  }

  private _exitBuildMode(): void {
    this.setBuildMode(false);
  }

  toggleCanopy(): void {
    this.world.toggleCanopy();
  }

  update(dt: number): void {
    this.world.beginFrame(dt);
    this._syncWorldObstacles();
    if (this.state !== 'running') {
      this._updateShield(dt);
      this.world.update(dt, {
        knight: this.knight,
        monsters: this.units,
        emitNoise: (position, strength) => this.emitNoise(position, strength),
        onChestOpened: (position) => this._onChestOpened(position)
      });
      return;
    }

    this._updateSupplies(dt);
    this.knight.update(dt, this.world);
    this._applyBarricadeSlowdown();
    this._updateSeals(dt);
    this._updateShield(dt);

    for (const unit of this.units) {
      unit.update(dt, this.knight, this, this.world);
      unit.tryAttack(this.knight, this.world, this, dt);
    }

    this.units = this.units.filter((unit) => unit.alive);

    this._updateKnightBow();
    this._updateBuildings(dt);
    this._updateDismantle(dt);
    this._updateProjectiles(dt);
    this._updateKnightProjectiles(dt);

    this.world.update(dt, {
      knight: this.knight,
      monsters: this.units,
      emitNoise: (position, strength) => this.emitNoise(position, strength),
      onChestOpened: (position) => this._onChestOpened(position)
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
    this._drawBuildings(ctx);

    for (const seal of this.seals) {
      seal.draw(ctx);
    }

    for (const unit of this.units) {
      unit.draw(ctx);
    }

    this._drawProjectiles(ctx);
    this._drawKnightProjectiles(ctx);

    this.knight.draw(ctx);
    this.knight.drawSwing(ctx);

    this.world.drawCanopy(ctx);
    this.world.drawVillageAlarms(ctx);
    this._drawNoisePings(ctx);
    this._drawBuildPreview(ctx);

    if (this.debugOverlay) {
      this._drawDebugOverlay(ctx);
    }

    if (this.canvasHudEnabled) {
      this._drawHud(ctx);
    }

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
        this._addSupplies(SUPPLIES_SEAL_BONUS);
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

  private _drawBuildings(ctx: CanvasRenderingContext2D): void {
    for (const building of this.buildings) {
      const { halfWidth, halfHeight } = getBuildingHalfSize(building.type);
      const x = building.position.x - halfWidth;
      const y = building.position.y - halfHeight;

      if (building.state === 'foundation') {
        ctx.save();
        ctx.strokeStyle = 'rgba(180, 180, 220, 0.6)';
        ctx.setLineDash([3, 3]);
        ctx.strokeRect(x, y, halfWidth * 2, halfHeight * 2);
        ctx.restore();
      } else {
        switch (building.type) {
          case 'watchtower': {
            ctx.fillStyle = '#6D6D75';
            ctx.fillRect(x, y, halfWidth * 2, halfHeight * 2);
            const blink = Math.sin(performance.now() / 180) > 0 ? '#FFFFFF' : '#D0D0FF';
            ctx.fillStyle = blink;
            ctx.fillRect(building.position.x - 1, building.position.y - halfHeight - 1, 2, 2);
            if (building.auraMultiplier > 1) {
              ctx.strokeStyle = 'rgba(120, 190, 255, 0.6)';
              ctx.lineWidth = 1.5;
              ctx.beginPath();
              ctx.arc(building.position.x, building.position.y, halfWidth + 4, 0, Math.PI * 2);
              ctx.stroke();
            }
            break;
          }
          case 'barricade':
            ctx.fillStyle = '#8C5B32';
            ctx.fillRect(x, y, halfWidth * 2, halfHeight * 2);
            break;
          case 'spike':
            ctx.fillStyle = '#1E1E24';
            ctx.fillRect(x, y, halfWidth * 2, halfHeight * 2);
            break;
          case 'beacon': {
            const pulse = 0.4 + 0.3 * (Math.sin(performance.now() / 160) + 1) * 0.5;
            ctx.fillStyle = `rgba(200, 220, 255, ${pulse.toFixed(2)})`;
            ctx.beginPath();
            ctx.arc(building.position.x, building.position.y, halfWidth, 0, Math.PI * 2);
            ctx.fill();
            break;
          }
          case 'workshop':
            ctx.fillStyle = '#3A3A42';
            ctx.fillRect(x, y, halfWidth * 2, halfHeight * 2);
            ctx.fillStyle = '#555566';
            ctx.fillRect(building.position.x - 2, building.position.y - 2, 4, 4);
            break;
        }
      }

      if (building.state === 'foundation') {
        const progress = Math.max(0, Math.min(1, building.progress));
        if (progress > 0) {
          ctx.save();
          ctx.strokeStyle = 'rgba(200, 220, 255, 0.8)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(building.position.x, building.position.y, Math.max(halfWidth, halfHeight) + 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
          ctx.stroke();
          ctx.restore();
        }
      } else {
        const definition = getBuildingDefinition(building.type);
        if (definition.maxHp > 1) {
          const width = 18;
          const height = 4;
          const ratio = Math.max(0, Math.min(1, building.hp / definition.maxHp));
          const barX = building.position.x - width / 2;
          const barY = y - 6;
          ctx.fillStyle = 'rgba(20, 20, 20, 0.6)';
          ctx.fillRect(barX, barY, width, height);
          ctx.fillStyle = '#5CD46C';
          ctx.fillRect(barX, barY, width * ratio, height);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
          ctx.strokeRect(barX, barY, width, height);
        }
        if (building.repairProgress > 0) {
          ctx.strokeStyle = 'rgba(110, 200, 255, 0.7)';
          ctx.lineWidth = 2;
          const radius = Math.max(halfWidth, halfHeight) + 6;
          ctx.beginPath();
          ctx.arc(
            building.position.x,
            building.position.y,
            radius,
            -Math.PI / 2,
            -Math.PI / 2 + Math.PI * 2 * Math.max(0, Math.min(1, building.repairProgress))
          );
          ctx.stroke();
        }
        if (building.dismantleProgress > 0) {
          ctx.strokeStyle = 'rgba(255, 120, 120, 0.8)';
          ctx.lineWidth = 2;
          const radius = Math.max(halfWidth, halfHeight) + 8;
          ctx.beginPath();
          ctx.arc(
            building.position.x,
            building.position.y,
            radius,
            -Math.PI / 2,
            -Math.PI / 2 + Math.PI * 2 * Math.max(0, Math.min(1, building.dismantleProgress))
          );
          ctx.stroke();
        }
      }
    }
  }

  private _drawProjectiles(ctx: CanvasRenderingContext2D): void {
    if (!this.projectiles.length) {
      return;
    }
    ctx.fillStyle = '#FFFFFF';
    for (const projectile of this.projectiles) {
      ctx.beginPath();
      ctx.arc(projectile.position.x, projectile.position.y, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private _drawBuildPreview(ctx: CanvasRenderingContext2D): void {
    if (!this.buildMode || !this.buildCursor) {
      return;
    }
    const position = this.buildCursor;
    const { halfWidth, halfHeight } = getBuildingHalfSize(this.buildSelection);
    const valid = this._canAfford(this.buildSelection) && this._isPlacementValid(this.buildSelection, position);
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = valid ? 'rgba(120, 220, 140, 0.6)' : 'rgba(220, 100, 100, 0.6)';
    ctx.fillRect(position.x - halfWidth, position.y - halfHeight, halfWidth * 2, halfHeight * 2);
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = valid ? 'rgba(120, 220, 140, 0.9)' : 'rgba(220, 100, 100, 0.9)';
    ctx.beginPath();
    ctx.moveTo(position.x - 8, position.y);
    ctx.lineTo(position.x + 8, position.y);
    ctx.moveTo(position.x, position.y - 8);
    ctx.lineTo(position.x, position.y + 8);
    ctx.stroke();
    ctx.restore();
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

    const statsY = hpBarY + HP_BAR_HEIGHT + 12;
    ctx.font = '18px Consolas, monospace';
    ctx.fillStyle = HUD_COLOR;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const statsText = `HP: ${this.knight.hp}  Evil: ${this.darkLord.evilEnergy}  Units: ${this.units.length}/${MAX_UNITS}  Seals: ${this.brokenSeals}/${SEAL_COUNT}  Supplies: ${this.supplies}`;
    ctx.fillText(statsText, hpBarX, statsY);

    const helperText =
      'B=Build  [1]Tower(20) [2]Barr(12) [3]Spike(10) [4]Beacon(15) [5]Workshop(25)   X=Dismantle';
    ctx.font = '14px Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(helperText, WIDTH / 2, HEIGHT - 12);

    ctx.restore();
  }

  private _syncWorldObstacles(): void {
    const obstacles = this.buildings
      .filter((building) => building.type !== 'spike')
      .map((building) => {
        const { halfWidth, halfHeight } = getBuildingHalfSize(building.type);
        const blocksKnight = building.type !== 'barricade';
        const blocksVision = building.type !== 'beacon';
        return {
          center: building.position.clone(),
          halfWidth,
          halfHeight,
          steerStrength: HUT_STEER_STRENGTH,
          solid: true,
          blocksKnight,
          blocksVision,
          type: building.type
        };
    });
    this.world.setBuildingObstacles(obstacles);
  }

  private _initializeKnightLoadout(): void {
    this.ownedItems.clear();
    this.knightProjectiles = [];
    this.knightProjectileIdCounter = 1;
    this._grantItem('bow');
  }

  private _grantItem(itemId: ItemId): void {
    const definition = ITEM_DEFINITIONS[itemId];
    if (!definition) {
      return;
    }
    if (definition.unique && this.ownedItems.has(itemId)) {
      return;
    }
    this.ownedItems.add(itemId);
    this._applyItemEffect(itemId);
  }

  private _applyItemEffect(itemId: ItemId): void {
    switch (itemId) {
      case 'bow':
        this.knight.grantBow();
        break;
      case 'scoutBoots':
        this.knight.addSpeedMultiplier(KNIGHT_SPEED_BOOST_MULTIPLIER);
        break;
      case 'lightQuiver':
        this.knight.multiplyBowCooldown(KNIGHT_BOW_COOLDOWN_MULTIPLIER);
        break;
      default:
        break;
    }
  }

  private _addSupplies(amount: number): void {
    if (amount <= 0) {
      return;
    }
    this.supplies += amount;
  }

  private _updateSupplies(dt: number): void {
    this.supplyTimer += dt;
    while (this.supplyTimer >= SUPPLIES_PASSIVE_INTERVAL) {
      this.supplyTimer -= SUPPLIES_PASSIVE_INTERVAL;
      this._addSupplies(SUPPLIES_PASSIVE_AMOUNT);
    }
  }

  private _onChestOpened(_position: Vector2): void {
    this._addSupplies(SUPPLIES_CHEST_BONUS);
  }

  private _applyBarricadeSlowdown(): void {
    const knightHalf = KNIGHT_SIZE / 2;
    for (const building of this.buildings) {
      if (building.type !== 'barricade' || building.state !== 'active') {
        continue;
      }
      const { halfWidth, halfHeight } = getBuildingHalfSize(building.type);
      const dx = Math.abs(this.knight.pos.x - building.position.x);
      const dy = Math.abs(this.knight.pos.y - building.position.y);
      if (dx <= halfWidth + knightHalf && dy <= halfHeight + knightHalf) {
        this.knight.velocity.scale(BARRICADE_KNIGHT_SPEED_SCALE);
        break;
      }
    }
  }

  private _initializeBuilding(building: BuildingInstance): void {
    switch (building.type) {
      case 'watchtower':
        building.data.cooldown = WATCHTOWER_FIRE_INTERVAL;
        break;
      case 'beacon':
        building.data.timer = 0;
        break;
      case 'spike':
        building.data.used = false;
        break;
      default:
        break;
    }
  }

  private _onBuildingActivated(building: BuildingInstance): void {
    switch (building.type) {
      case 'watchtower':
        building.data.cooldown = 0;
        break;
      case 'beacon':
        building.data.timer = 0;
        break;
      case 'spike':
        building.data.used = false;
        break;
      default:
        break;
    }
  }

  private _removeBuildingsById(ids: Set<number>): void {
    if (!ids.size) {
      return;
    }
    this.buildings = this.buildings.filter((building) => !ids.has(building.id));
    if (this.dismantleState && ids.has(this.dismantleState.buildingId)) {
      this.dismantleState = null;
    }
    this.projectiles = this.projectiles.filter((projectile) => !ids.has(projectile.sourceId));
    this._syncWorldObstacles();
  }

  private _updateBuildings(dt: number): void {
    if (!this.buildings.length) {
      this.hasWorkshopTech = false;
      return;
    }

    const removals = new Set<number>();

    for (const building of this.buildings) {
      if (building.hp <= 0) {
        removals.add(building.id);
        continue;
      }
      const definition = getBuildingDefinition(building.type);
      if (building.state === 'foundation') {
        if (isKnightWithinConstructionRange(building, this.knight.pos)) {
          building.progress = Math.min(1, building.progress + dt / definition.buildTime);
          if (building.progress >= 1) {
            building.state = 'active';
            building.progress = 1;
            building.hp = definition.maxHp;
            this._onBuildingActivated(building);
          }
        }
      } else {
        building.progress = Math.min(1, building.progress);
      }

      if (building.state !== 'active' || building.hp >= definition.maxHp) {
        building.repairProgress = 0;
      }
    }

    const activeWorkshops = this.buildings.filter(
      (building) => !removals.has(building.id) && building.state === 'active' && building.type === 'workshop'
    );
    this.hasWorkshopTech = activeWorkshops.length > 0;

    for (const building of this.buildings) {
      if (removals.has(building.id) || building.state !== 'active') {
        continue;
      }

      const definition = getBuildingDefinition(building.type);
      if (
        building.hp < definition.maxHp &&
        this.hasWorkshopTech &&
        this.supplies >= BUILDING_REPAIR_COST &&
        isKnightWithinConstructionRange(building, this.knight.pos)
      ) {
        building.repairProgress += dt / BUILDING_REPAIR_TIME;
        while (
          building.repairProgress >= 1 &&
          this.supplies >= BUILDING_REPAIR_COST &&
          building.hp < definition.maxHp
        ) {
          building.repairProgress -= 1;
          this.supplies -= BUILDING_REPAIR_COST;
          building.hp = Math.min(definition.maxHp, building.hp + 1);
        }
      } else {
        building.repairProgress = 0;
      }

      switch (building.type) {
        case 'watchtower':
          this._updateWatchtower(building, dt, activeWorkshops);
          break;
        case 'beacon':
          this._updateBeacon(building, dt);
          break;
        case 'spike':
          if (this._updateSpike(building)) {
            removals.add(building.id);
          }
          break;
        default:
          break;
      }
    }

    if (removals.size > 0) {
      this._removeBuildingsById(removals);
    }

    this.units = this.units.filter((unit) => unit.alive);
  }

  private _updateDismantle(dt: number): void {
    if (!this.dismantleState) {
      for (const building of this.buildings) {
        building.dismantleProgress = 0;
      }
      return;
    }

    const target = this.buildings.find((building) => building.id === this.dismantleState?.buildingId);
    for (const building of this.buildings) {
      if (!target || building.id !== target.id) {
        building.dismantleProgress = 0;
      }
    }

    if (!target || target.state !== 'active') {
      this.dismantleState = null;
      return;
    }

    if (!isKnightWithinConstructionRange(target, this.knight.pos)) {
      target.dismantleProgress = 0;
      this.dismantleState = null;
      return;
    }

    target.dismantleProgress += dt / BUILDING_DISMANTLE_TIME;
    if (target.dismantleProgress >= 1) {
      const refund = Math.floor(getBuildingDefinition(target.type).cost * 0.75);
      this._addSupplies(refund);
      this._removeBuildingsById(new Set([target.id]));
      this.dismantleState = null;
    }
  }

  private _updateProjectiles(dt: number): void {
    if (!this.projectiles.length) {
      return;
    }

    const survivors: TowerProjectile[] = [];
    for (const projectile of this.projectiles) {
      if (!this.buildings.some((building) => building.id === projectile.sourceId)) {
        continue;
      }

      const direction = projectile.velocity.clone();
      const speed = direction.length();
      if (speed <= 0) {
        continue;
      }
      direction.scale(1 / speed);
      const distance = speed * dt;
      const hit = this.world.raycastObstacles(projectile.position, direction, distance);
      if (hit + 0.001 < distance) {
        continue;
      }
      projectile.position.add(direction.clone().scale(distance));

      const hitUnit = this._findProjectileHit(projectile);
      if (hitUnit) {
        hitUnit.takeDamage(projectile.damage);
        if (!hitUnit.alive) {
          this.units = this.units.filter((unit) => unit.alive);
        }
        continue;
      }

      if (
        projectile.position.x < 0 ||
        projectile.position.x > WIDTH ||
        projectile.position.y < 0 ||
        projectile.position.y > HEIGHT
      ) {
        continue;
      }

      survivors.push(projectile);
    }

    this.projectiles = survivors;
  }

  private _updateKnightProjectiles(dt: number): void {
    if (!this.knightProjectiles.length) {
      return;
    }

    const survivors: KnightProjectile[] = [];
    for (const projectile of this.knightProjectiles) {
      const direction = projectile.velocity.clone();
      const speed = direction.length();
      if (speed <= 0) {
        continue;
      }
      direction.scale(1 / speed);
      const distance = speed * dt;
      const hit = this.world.raycastObstacles(projectile.position, direction, distance);
      if (hit + 0.001 < distance) {
        continue;
      }

      projectile.position.add(direction.clone().scale(distance));

      const target = projectile.target;
      if (
        target &&
        target.alive &&
        target.pos.distanceTo(projectile.position) <= target.getCollisionRadius() + 2.5
      ) {
        target.takeDamage(projectile.damage);
        if (!target.alive) {
          this.units = this.units.filter((unit) => unit.alive);
        }
        continue;
      }

      const hitUnit = this._findKnightProjectileHit(projectile);
      if (hitUnit) {
        hitUnit.takeDamage(projectile.damage);
        if (!hitUnit.alive) {
          this.units = this.units.filter((unit) => unit.alive);
        }
        continue;
      }

      if (
        projectile.position.x < 0 ||
        projectile.position.x > WIDTH ||
        projectile.position.y < 0 ||
        projectile.position.y > HEIGHT
      ) {
        continue;
      }

      survivors.push(projectile);
    }

    this.knightProjectiles = survivors;
  }

  private _findKnightProjectileHit(projectile: KnightProjectile): DarkUnit | null {
    const radius = 2.5;
    for (const unit of this.units) {
      if (!unit.alive) {
        continue;
      }
      const distance = unit.pos.distanceTo(projectile.position);
      if (distance <= unit.getCollisionRadius() + radius) {
        return unit;
      }
    }
    return null;
  }

  private _findBowTarget(): DarkUnit | null {
    const range = this.knight.getBowRange();
    let nearest: DarkUnit | null = null;
    let nearestDist = range + 1;
    for (const unit of this.units) {
      if (!unit.alive) {
        continue;
      }
      const distance = unit.pos.distanceTo(this.knight.pos);
      if (distance > range || distance >= nearestDist) {
        continue;
      }
      if (!this.world.hasLineOfSight(this.knight.pos, unit.pos)) {
        continue;
      }
      nearest = unit;
      nearestDist = distance;
    }
    return nearest;
  }

  private _updateKnightBow(): void {
    if (!this.knight.hasBowEquipped()) {
      return;
    }
    const target = this._findBowTarget();
    if (!target) {
      return;
    }
    const shot = this.knight.tryShootBow(target);
    if (!shot) {
      return;
    }
    const projectile: KnightProjectile = {
      id: this.knightProjectileIdCounter++,
      position: shot.position,
      velocity: shot.velocity,
      target,
      damage: shot.damage
    };
    this.knightProjectiles.push(projectile);
    this._emitNoise(this.knight.pos, KNIGHT_BOW_NOISE);
  }

  private _drawKnightProjectiles(ctx: CanvasRenderingContext2D): void {
    if (!this.knightProjectiles.length) {
      return;
    }
    ctx.save();
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.fillStyle = '#fde68a';
    for (const projectile of this.knightProjectiles) {
      const direction = projectile.velocity.clone();
      const speed = direction.length();
      if (speed <= 0) {
        continue;
      }
      direction.scale(1 / speed);
      const tail = projectile.position.clone().subtract(direction.clone().scale(6));
      ctx.beginPath();
      ctx.moveTo(projectile.position.x, projectile.position.y);
      ctx.lineTo(tail.x, tail.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(projectile.position.x, projectile.position.y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private _updateWatchtower(
    building: BuildingInstance,
    dt: number,
    workshops: BuildingInstance[]
  ): void {
    const hasAura = workshops.some(
      (workshop) => workshop.position.distanceTo(building.position) <= WORKSHOP_AURA_RADIUS
    );
    building.auraMultiplier = hasAura ? WATCHTOWER_AURA_MULTIPLIER : 1;
    const interval = WATCHTOWER_FIRE_INTERVAL / building.auraMultiplier;
    const current = typeof building.data.cooldown === 'number' ? building.data.cooldown : interval;
    const next = Math.max(0, current - dt);
    building.data.cooldown = next;
    if (next > 0) {
      return;
    }
    const target = this._findTowerTarget(building);
    if (!target) {
      return;
    }
    this._fireWatchtower(building, target);
    building.data.cooldown = interval;
  }

  private _updateBeacon(building: BuildingInstance, dt: number): void {
    const timer = typeof building.data.timer === 'number' ? building.data.timer : 0;
    let nextTimer = timer + dt;
    while (nextTimer >= LURE_BEACON_NOISE_INTERVAL) {
      nextTimer -= LURE_BEACON_NOISE_INTERVAL;
      this._emitNoise(building.position, LURE_BEACON_NOISE_STRENGTH);
    }
    building.data.timer = nextTimer;
  }

  private _updateSpike(building: BuildingInstance): boolean {
    if (building.data.used) {
      return true;
    }
    const { halfWidth, halfHeight } = getBuildingHalfSize('spike');
    for (const unit of this.units) {
      if (!unit.alive) {
        continue;
      }
      const radius = unit.getCollisionRadius();
      const dx = Math.abs(unit.pos.x - building.position.x);
      const dy = Math.abs(unit.pos.y - building.position.y);
      if (dx <= halfWidth + radius && dy <= halfHeight + radius) {
        if (unit.type === 'scout') {
          unit.takeDamage(unit.hp);
        } else {
          unit.takeDamage(1);
          if (unit.type === 'tank') {
            unit.applySlow(SPIKE_TRAP_SLOW_FACTOR, SPIKE_TRAP_SLOW_DURATION);
          }
        }
        building.data.used = true;
        return true;
      }
    }
    return false;
  }

  private _findTowerTarget(building: BuildingInstance): DarkUnit | null {
    let nearest: DarkUnit | null = null;
    let nearestDist = WATCHTOWER_RANGE + 1;
    for (const unit of this.units) {
      if (!unit.alive) {
        continue;
      }
      const distance = unit.pos.distanceTo(building.position);
      if (distance > WATCHTOWER_RANGE || distance >= nearestDist) {
        continue;
      }
      if (!this.world.hasLineOfSight(building.position, unit.pos)) {
        continue;
      }
      nearest = unit;
      nearestDist = distance;
    }
    return nearest;
  }

  private _fireWatchtower(building: BuildingInstance, target: DarkUnit): void {
    const direction = target.pos.clone().subtract(building.position);
    if (direction.lengthSq() === 0) {
      return;
    }
    direction.normalize();
    const velocity = direction.clone().scale(WATCHTOWER_PROJECTILE_SPEED);
    const projectile: TowerProjectile = {
      id: this.projectileIdCounter++,
      position: building.position.clone(),
      velocity,
      target,
      damage: WATCHTOWER_DAMAGE,
      sourceId: building.id
    };
    this.projectiles.push(projectile);
    this._emitNoise(building.position, WATCHTOWER_NOISE_STRENGTH);
  }

  private _findProjectileHit(projectile: TowerProjectile): DarkUnit | null {
    const radius = 3;
    for (const unit of this.units) {
      if (!unit.alive) {
        continue;
      }
      const distance = unit.pos.distanceTo(projectile.position);
      if (distance <= unit.getCollisionRadius() + radius) {
        return unit;
      }
    }
    return null;
  }

  private _canAfford(type: BuildingType): boolean {
    return this.supplies >= getBuildingDefinition(type).cost;
  }

  private _tryPlaceBuilding(position: Vector2): boolean {
    const type = this.buildSelection;
    if (!this._canAfford(type)) {
      return false;
    }
    if (!this._isPlacementValid(type, position)) {
      return false;
    }
    const building = createBuilding(type, position);
    this._initializeBuilding(building);
    this.buildings.push(building);
    this.supplies -= getBuildingDefinition(type).cost;
    this._syncWorldObstacles();
    return true;
  }

  private _isPlacementValid(type: BuildingType, position: Vector2): boolean {
    const { halfWidth, halfHeight } = getBuildingHalfSize(type);
    if (
      position.x - halfWidth < 0 ||
      position.x + halfWidth > WIDTH ||
      position.y - halfHeight < 0 ||
      position.y + halfHeight > HEIGHT
    ) {
      return false;
    }

    const castleHalf = CASTLE_SIZE / 2 + BUILDING_CONSTRUCTION_RADIUS;
    if (
      Math.abs(position.x - CASTLE_POS.x) <= castleHalf + halfWidth &&
      Math.abs(position.y - CASTLE_POS.y) <= castleHalf + halfHeight
    ) {
      return false;
    }

    for (const seal of this.seals) {
      if (seal.pos.distanceTo(position) <= SEAL_CHANNEL_RADIUS + Math.max(halfWidth, halfHeight)) {
        return false;
      }
    }

    for (const hut of this.world.getHuts()) {
      const hutHalfW = hut.width / 2;
      const hutHalfH = hut.height / 2;
      if (
        Math.abs(position.x - hut.center.x) <= halfWidth + hutHalfW &&
        Math.abs(position.y - hut.center.y) <= halfHeight + hutHalfH
      ) {
        return false;
      }
    }

    const treeThreshold = Math.max(halfWidth, halfHeight) + 6;
    let denseCount = 0;
    for (const tree of this.world.getTrees()) {
      const dx = Math.abs(position.x - tree.position.x);
      const dy = Math.abs(position.y - tree.position.y);
      if (dx <= halfWidth + tree.radius && dy <= halfHeight + tree.radius) {
        return false;
      }
      if (tree.position.distanceTo(position) <= tree.radius + treeThreshold) {
        denseCount += 1;
      }
    }
    if (denseCount >= 3) {
      return false;
    }

    const selfRadius = Math.max(halfWidth, halfHeight);
    for (const building of this.buildings) {
      const otherSize = getBuildingHalfSize(building.type);
      const dx = Math.abs(position.x - building.position.x);
      const dy = Math.abs(position.y - building.position.y);
      if (dx <= halfWidth + otherSize.halfWidth && dy <= halfHeight + otherSize.halfHeight) {
        return false;
      }
      const distance = position.distanceTo(building.position);
      const otherRadius = Math.max(otherSize.halfWidth, otherSize.halfHeight);
      if (distance < selfRadius + otherRadius + BUILDING_MIN_SPACING) {
        return false;
      }
    }

    return true;
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
