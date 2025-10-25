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
  CLICK_BASE_DAMAGE,
  CLICK_TARGET_RADIUS,
  CLICK_NOISE_STRENGTH,
  AUTO_CLICK_NOISE_STRENGTH,
  KNIGHT_HP,
  KNIGHT_SIZE,
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
  UNIT_APPEARANCE,
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
  HUT_STEER_STRENGTH,
  DOWNTIME_DURATION,
  WAVE_DURATION,
  QUEST_RADIUS,
  QUEST_REWARD_SUPPLIES,
  QUEST_REWARD_BUFF_MULTIPLIER,
  QUEST_REWARD_SPEED_BONUS,
  CREEP_CAMPS_PER_DOWNTIME,
  CREEP_PACK_SIZE,
  CREEP_REWARD_SUPPLIES,
  CREEP_REWARD_RELIC_SHARDS,
  CREEP_UNIT_TYPES,
  MONSTER_LAIR_RADIUS,
  MONSTER_LAIR_VILLAGE_BUFFER,
  TEMP_BUFF_WAVE_DURATION,
  THROWING_KNIFE_COOLDOWN,
  THROWING_KNIFE_RANGE,
  THROWING_KNIFE_DAMAGE,
  POISON_DAGGER_DPS,
  POISON_DAGGER_DURATION,
  TORCH_ORBIT_COUNT,
  TORCH_ORBIT_RADIUS,
  TORCH_TICK_INTERVAL,
  TORCH_TICK_DAMAGE,
  INFERNO_RING_RADIUS,
  INFERNO_RING_DPS,
  CROSSBOW_CHARM_COOLDOWN,
  CROSSBOW_CHARM_RANGE,
  CROSSBOW_CHARM_DAMAGE,
  REPEATING_ARBALEST_COOLDOWN,
  REPEATING_ARBALEST_PIERCE,
  SMOKE_BOMB_INTERVAL,
  SMOKE_BOMB_RADIUS,
  SMOKE_BOMB_DURATION,
  SMOKE_BOMB_SLOW,
  CLOAK_FIELD_RADIUS,
  CLOAK_FIELD_SLOW,
  CLOAK_FIELD_DURATION,
  CLOAK_FIELD_CLOAK_TIME,
  ENEMY_PROJECTILE_RADIUS,
  VILLAGER_SPEED,
  TAVERN_HEAL_PER_SECOND
} from './config/constants';
import { DarkLordAI } from './ai/darkLordAI';
import { DarkUnit, DarkUnitAllegiance } from './entities/darkUnit';
import {
  BuildingInstance,
  createBuilding,
  getBuildingDefinition,
  getBuildingHalfSize,
  isKnightWithinConstructionRange
} from './entities/building';
import { Knight } from './entities/knight';
import { ClickModifierSystem, type ClickHitContext } from './entities/clickModifiers';
import { Seal } from './entities/seal';
import { Vector2 } from './math/vector2';
import { World } from './world';
import type { Villager } from './world';
import { ITEM_DEFINITIONS, ItemId, ItemCategory } from './config/items';
import {
  type MetaUpgradeId,
  getMetaUpgradeDefinition
} from './config/metaProgression';
import { IsoTransform } from './utils/isometric';
import waveConfigData from './darkSurge/WaveConfig.json';
import {
  WaveController,
  type WaveConfig,
  type WaveSpawnRequest
} from './darkSurge/WaveController';
import { EnemySwarm } from './darkSurge/EnemySwarm';
import { Village as SurgeVillage, type VillageAttackEvent } from './darkSurge/Village';

export interface CameraState {
  viewportWidth: number;
  viewportHeight: number;
  iso: IsoTransform;
}

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
  source: ItemId;
  pierce?: number;
  effects?: {
    dot?: { dps: number; duration: number };
    slow?: { factor: number; duration: number };
  };
  tint?: string;
}

interface PlacementTilePreview {
  left: number;
  top: number;
  width: number;
  height: number;
  valid: boolean;
}

interface PlacementEvaluation {
  valid: boolean;
  reason: string | null;
  tiles: PlacementTilePreview[];
}

interface DarkProjectile {
  id: number;
  position: Vector2;
  velocity: Vector2;
  damage: number;
  radius: number;
  travelled: number;
  maxDistance: number;
  sourceUnitId: number;
}

interface HitFlash {
  id: number;
  position: Vector2;
  radius: number;
  age: number;
  duration: number;
  strong: boolean;
}

interface DamageNumber {
  id: number;
  position: Vector2;
  velocity: Vector2;
  text: string;
  amount: number;
  age: number;
  duration: number;
  color: string;
  emphasis: boolean;
}

interface DeathParticle {
  id: number;
  position: Vector2;
  velocity: Vector2;
  radius: number;
  age: number;
  lifetime: number;
  color: string;
}

type GamePhase = 'downtime' | 'wave';
type QuestType = 'escort' | 'retrieve';

const QUEST_INTERACTION_RADIUS = 96;
const CREEP_APPROACH_BUFFER = 80;
const BUILD_PREVIEW_TILE_SIZE = 12;
const ISO_CASTLE_SCALE = 1.6;

function rectanglesOverlap(
  leftA: number,
  topA: number,
  rightA: number,
  bottomA: number,
  leftB: number,
  topB: number,
  rightB: number,
  bottomB: number
): boolean {
  return leftA < rightB && rightA > leftB && topA < bottomB && bottomA > topB;
}

function rectangleCircleOverlap(
  left: number,
  top: number,
  right: number,
  bottom: number,
  cx: number,
  cy: number,
  radius: number
): boolean {
  const nearestX = Math.max(left, Math.min(cx, right));
  const nearestY = Math.max(top, Math.min(cy, bottom));
  const dx = cx - nearestX;
  const dy = cy - nearestY;
  return dx * dx + dy * dy <= radius * radius;
}

interface QuestReward {
  supplies: number;
  buff: TemporaryBuff | null;
  description: string;
}

interface QuestMarker {
  id: number;
  questId: number;
  icon: string;
  position: Vector2;
  visible: boolean;
}

type QuestObjectiveTemplate = EscortObjectiveTemplate | RetrieveObjectiveTemplate;

interface QuestObjectiveBase {
  id: number;
  questId: number;
  type: QuestType;
  markerId: number | null;
  state: 'pending' | 'completed';
  progress: number;
  required: number;
}

interface EscortObjectiveTemplate {
  type: 'escort';
  spawnPoint: Vector2;
  destination: Vector2;
  npcCount: number;
  escortSpeed: number;
}

interface EscortNpcState {
  id: number;
  position: Vector2;
  state: 'waiting' | 'moving' | 'arrived';
  speed: number;
  arrivalRadius: number;
}

interface EscortQuestObjective extends QuestObjectiveBase {
  type: 'escort';
  destination: Vector2;
  npcs: EscortNpcState[];
}

interface QuestPickupState {
  id: number;
  position: Vector2;
  pickedUp: boolean;
}

interface RetrieveObjectiveTemplate {
  type: 'retrieve';
  spawnPoint: Vector2;
}

interface RetrieveQuestObjective extends QuestObjectiveBase {
  type: 'retrieve';
  pickup: QuestPickupState;
}

type QuestObjectiveState = EscortQuestObjective | RetrieveQuestObjective;

interface Quest {
  id: number;
  giverId: number;
  type: QuestType;
  position: Vector2;
  radius: number;
  requiredTime: number;
  progress: number;
  state: 'available' | 'active' | 'completed';
  description: string;
  icon: string;
  reward: QuestReward;
  objectiveTemplate: QuestObjectiveTemplate;
  objectives: QuestObjectiveState[];
}

interface CreepCamp {
  id: number;
  position: Vector2;
  radius: number;
  unitIds: number[];
  cleared: boolean;
  rewardSupplies: number;
  rewardRelicShards: number;
  name: string;
}

interface TemporaryBuff {
  id: string;
  description: string;
  damageBonus?: number;
  speedBonus?: number;
  expiresAtWave: number;
}

interface QuestGiver {
  id: number;
  villageIndex: number;
  position: Vector2;
  name: string;
  villageName: string;
  greeting: string;
  questOffer: Quest | null;
  activeQuestId: number | null;
}

export interface QuestGiverStatus {
  id: number;
  name: string;
  villageName: string;
  dialog: string;
  state: 'offering' | 'active' | 'turnIn' | 'waiting';
  offer: { description: string; icon: string; rewardText: string } | null;
  activeQuest: {
    id: number;
    description: string;
    icon: string;
    progress: number;
    requiredTime: number;
    rewardText: string;
  } | null;
}

export interface QuestLogEntry {
  id: number;
  giverId: number;
  giverName: string;
  villageName: string;
  description: string;
  icon: string;
  progress: number;
  requiredTime: number;
  state: 'active' | 'completed';
  rewardText: string;
}

export interface NearbyQuestInteraction {
  giverId: number;
  giverName: string;
  villageName: string;
  greeting: string;
  state: QuestGiverStatus['state'];
  offer: QuestGiverStatus['offer'];
  activeQuest: QuestGiverStatus['activeQuest'];
  distance: number;
}

interface WeaponRuntimeState {
  id: ItemId;
  cooldown: number;
  evolved: boolean;
  kills: number;
  rescues: number;
  data: Record<string, unknown>;
}

interface SmokeField {
  id: number;
  position: Vector2;
  radius: number;
  timer: number;
  slowFactor: number;
  cloakTimer: number;
  baseDuration: number;
}

interface LoadoutProgress {
  current: number;
  required: number;
  label: string;
  ready: boolean;
}

interface HeroLoadoutEntry {
  id: ItemId;
  name: string;
  icon: string;
  description: string;
  status: string;
  evolved: boolean;
  category: ItemCategory;
  progress?: LoadoutProgress;
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
  private darkProjectiles: DarkProjectile[] = [];
  private buildMode = false;
  private buildSelection: BuildingType = 'watchtower';
  private buildCursor: Vector2 | null = null;
  private buildErrorMessage: string | null = null;
  private buildErrorTimer = 0;
  private dismantleState: { buildingId: number; progress: number } | null = null;
  private hasWorkshopTech = false;
  private projectileIdCounter = 1;
  private knightProjectileIdCounter = 1;
  private darkProjectileIdCounter = 1;
  private readonly buildOrder: BuildingType[] = ['watchtower', 'barricade', 'spike', 'beacon', 'workshop'];
  private canvasHudEnabled = true;
  private ownedItems: Set<ItemId> = new Set();
  private weaponStates: Map<ItemId, WeaponRuntimeState> = new Map();
  private supportItems: Set<ItemId> = new Set();
  private clickModifiers: ClickModifierSystem;
  private persistentItemIds: Set<ItemId> = new Set();
  private phase: GamePhase = 'downtime';
  private phaseTimer = DOWNTIME_DURATION;
  private waveIndex = 0;
  private quests: Quest[] = [];
  private creepCamps: CreepCamp[] = [];
  private questGivers: QuestGiver[] = [];
  private questIdCounter = 1;
  private creepCampIdCounter = 1;
  private questGiverIdCounter = 1;
  private questMarkers: QuestMarker[] = [];
  private questMarkerIdCounter = 1;
  private questObjectiveIdCounter = 1;
  private questEntityIdCounter = 1;
  private temporaryBuffs: TemporaryBuff[] = [];
  private weaponDamageBonus = 0;
  private temporarySpeedBonus = 0;
  private relicShards = 0;
  private unlockedMetaUpgrades = new Set<MetaUpgradeId>();
  private weaponOrbitVisuals: { position: Vector2; radius: number; alpha: number }[] = [];
  private smokeFields: SmokeField[] = [];
  private smokeFieldIdCounter = 1;
  private hitFlashes: HitFlash[] = [];
  private damageNumbers: DamageNumber[] = [];
  private deathParticles: DeathParticle[] = [];
  private hitFlashIdCounter = 1;
  private damageNumberIdCounter = 1;
  private deathParticleIdCounter = 1;
  private unitLookup: Map<number, DarkUnit> = new Map();
  private unitIdCounter = 1;
  private totalKills = 0;
  private rescueCount = 0;
  private killMasteryBonus = 0;
  private rescueMasteryBonus = 0;
  private waveRallyPoint: Vector2 | null = null;
  private knightInTavern = false;
  private nearbyCreepCampIds: Set<number> = new Set();
  private noiseListener: ((strength: number) => void) | null = null;
  private readonly waveConfig: WaveConfig = waveConfigData as WaveConfig;
  private waveController!: WaveController;
  private surgeVillages: SurgeVillage[] = [];
  private surgeEnemies: EnemySwarm[] = [];
  private surgeEnemyPool: EnemySwarm[] = [];
  private surgeEnemyIdCounter = 1;
  private villageAudioContext: AudioContext | null = null;

  constructor() {
    this.world = new World();
    this._initializeDarkSurgeState();
    this.anchors = this._generateAnchors();
    this.seals = this._generateSeals();
    this.shieldWasActive = this._isShieldActive();
    this.clickModifiers = new ClickModifierSystem(
      {
        findPrimaryTarget: (position, radius) => this._findNearestUnitToPoint(position, radius),
        findUnitsInRadius: (position, radius) => this._findUnitsInRadius(position, radius),
        getRandomTarget: () => this._getRandomAliveUnit(),
        baseDamage: () => this._getClickDamage(),
        onHit: (target, damage, context) => this._handleClickHit(target, damage, context),
        emitNoise: (position, strength) => this._emitNoise(position, strength)
      },
      {
        manualNoise: CLICK_NOISE_STRENGTH,
        autoNoise: AUTO_CLICK_NOISE_STRENGTH,
        targetRadius: CLICK_TARGET_RADIUS
      }
    );
    this.world.setBuildingObstacles([]);
    this._initializeQuestGivers();
    this._initializeKnightLoadout();
    this._enterDowntime();
  }

  reset(): void {
    this.knight = new Knight();
    this.units = [];
    this.darkLord = new DarkLordAI();
    this.seals = this._generateSeals();
    this.brokenSeals = 0;
    this.state = 'running';
    this.world = new World();
    this._initializeDarkSurgeState();
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
    this.darkProjectiles = [];
    this.buildMode = false;
    this.buildSelection = 'watchtower';
    this.buildCursor = null;
    this.buildErrorMessage = null;
    this.buildErrorTimer = 0;
    this.dismantleState = null;
    this.hasWorkshopTech = false;
    this.projectileIdCounter = 1;
    this.knightProjectileIdCounter = 1;
    this.darkProjectileIdCounter = 1;
    this._initializeQuestGivers();
    this._initializeKnightLoadout();
    this.shieldWasActive = this._isShieldActive();
    this.shieldFlashTimer = 0;
    this.world.setBuildingObstacles([]);
    this.weaponStates.clear();
    this.supportItems.clear();
    this.phase = 'downtime';
    this.phaseTimer = DOWNTIME_DURATION;
    this.waveIndex = 0;
    this.quests = [];
    this.creepCamps = [];
    this.questIdCounter = 1;
    this.creepCampIdCounter = 1;
    this.questMarkers = [];
    this.questMarkerIdCounter = 1;
    this.questObjectiveIdCounter = 1;
    this.questEntityIdCounter = 1;
    this.temporaryBuffs = [];
    this.weaponDamageBonus = 0;
    this.temporarySpeedBonus = 0;
    this.relicShards = 0;
    this.weaponOrbitVisuals = [];
    this.smokeFields = [];
    this.smokeFieldIdCounter = 1;
    this.hitFlashes = [];
    this.damageNumbers = [];
    this.deathParticles = [];
    this.hitFlashIdCounter = 1;
    this.damageNumberIdCounter = 1;
    this.deathParticleIdCounter = 1;
    this.unitLookup.clear();
    this.unitIdCounter = 1;
    this.totalKills = 0;
    this.rescueCount = 0;
    this.killMasteryBonus = 0;
    this.rescueMasteryBonus = 0;
    this.waveRallyPoint = null;
    this.knightInTavern = false;
    this.nearbyCreepCampIds.clear();
    this._enterDowntime();
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

  setPersistentItems(items: ItemId[]): void {
    this.persistentItemIds = new Set(items);
    this._applyPersistentItems();
  }

  addPersistentItem(itemId: ItemId): void {
    if (!this.persistentItemIds.has(itemId)) {
      this.persistentItemIds.add(itemId);
    }
  }

  getHeroLoadout(): HeroLoadoutEntry[] {
    const entries: HeroLoadoutEntry[] = [];
    for (const itemId of this.ownedItems) {
      const definition = ITEM_DEFINITIONS[itemId];
      if (!definition) {
        continue;
      }
      const isClickModifier = this._isClickModifier(itemId);
      const entry: HeroLoadoutEntry = {
        id: itemId,
        name: definition.name,
        icon: definition.icon,
        description: definition.description,
        status: '',
        evolved: false,
        category: definition.category
      };
      if (definition.category === 'weapon' && !isClickModifier) {
        const state = this.weaponStates.get(itemId);
        const requirement = definition.evolveRequirement;
        if (requirement) {
          const progressValue = state
            ? requirement.type === 'kills'
              ? state.kills
              : state.rescues
            : 0;
          const current = Math.min(Math.floor(progressValue), requirement.count);
          const ready = !!state && !state.evolved && progressValue >= requirement.count;
          entry.progress = {
            current,
            required: requirement.count,
            label: requirement.label,
            ready
          };
          entry.evolved = !!state?.evolved;
          if (state?.evolved) {
            entry.status = 'Evolved';
          } else if (ready) {
            entry.status = 'Ready to evolve';
          } else {
            entry.status = `${current}/${requirement.count} ${requirement.label}`;
          }
        } else {
          entry.status = state?.evolved ? 'Evolved' : 'Awakening';
          entry.evolved = !!state?.evolved;
        }
      } else {
        entry.status = isClickModifier ? 'Click modifier' : 'Passive';
      }
      entries.push(entry);
    }
    return entries;
  }

  isItemOwned(itemId: ItemId): boolean {
    return this.ownedItems.has(itemId);
  }

  getQuests(): readonly Quest[] {
    return this.quests;
  }

  getQuestLogEntries(): QuestLogEntry[] {
    const rewardText = (quest: Quest) => `${quest.reward.supplies} gold • ${quest.reward.description}`;
    return this.quests.map((quest) => {
      const giver = this.questGivers.find((candidate) => candidate.id === quest.giverId) ?? null;
      return {
        id: quest.id,
        giverId: quest.giverId,
        giverName: giver?.name ?? 'Unknown Patron',
        villageName: giver?.villageName ?? 'Unknown Village',
        description: quest.description,
        icon: quest.icon,
        progress: quest.progress,
        requiredTime: quest.requiredTime,
        state: quest.state === 'completed' ? 'completed' : 'active',
        rewardText: rewardText(quest)
      };
    });
  }

  getQuestGivers(): QuestGiverStatus[] {
    return this.questGivers.map((giver) => {
      const { state, activeQuest } = this._resolveQuestGiverState(giver);
      const rewardText = (quest: Quest) => `${quest.reward.supplies} gold • ${quest.reward.description}`;
      return {
        id: giver.id,
        name: giver.name,
        villageName: giver.villageName,
        dialog: giver.greeting,
        state,
        offer: giver.questOffer
          ? {
              description: giver.questOffer.description,
              icon: giver.questOffer.icon,
              rewardText: rewardText(giver.questOffer)
            }
          : null,
        activeQuest: activeQuest
          ? {
              id: activeQuest.id,
              description: activeQuest.description,
              icon: activeQuest.icon,
              progress: activeQuest.progress,
              requiredTime: activeQuest.requiredTime,
              rewardText: rewardText(activeQuest)
            }
          : null
      };
    });
  }

  getNearbyQuestInteraction(): NearbyQuestInteraction | null {
    if (!this.questGivers.length) {
      return null;
    }
    const rewardText = (quest: Quest) => `${quest.reward.supplies} gold • ${quest.reward.description}`;
    const candidates: {
      giver: QuestGiver;
      state: QuestGiverStatus['state'];
      activeQuest: Quest | null;
      distance: number;
    }[] = [];
    for (const giver of this.questGivers) {
      const distance = giver.position.distanceTo(this.knight.pos);
      if (distance > QUEST_INTERACTION_RADIUS) {
        continue;
      }
      const { state, activeQuest } = this._resolveQuestGiverState(giver);
      candidates.push({ giver, state, activeQuest, distance });
    }
    if (!candidates.length) {
      return null;
    }
    const priority = (candidate: (typeof candidates)[number]) => {
      if (candidate.state === 'turnIn') {
        return 0;
      }
      if (candidate.state === 'offering') {
        return 1;
      }
      if (candidate.state === 'active') {
        return 2;
      }
      return 3;
    };
    candidates.sort((a, b) => {
      const diff = priority(a) - priority(b);
      if (diff !== 0) {
        return diff;
      }
      return a.distance - b.distance;
    });
    const { giver, state, activeQuest, distance } = candidates[0];
    return {
      giverId: giver.id,
      giverName: giver.name,
      villageName: giver.villageName,
      greeting: giver.greeting,
      state,
      offer: giver.questOffer
        ? {
            description: giver.questOffer.description,
            icon: giver.questOffer.icon,
            rewardText: rewardText(giver.questOffer)
          }
        : null,
      activeQuest: activeQuest
        ? {
            id: activeQuest.id,
            description: activeQuest.description,
            icon: activeQuest.icon,
            progress: activeQuest.progress,
            requiredTime: activeQuest.requiredTime,
            rewardText: rewardText(activeQuest)
          }
        : null,
      distance
    };
  }

  acceptQuestFromGiver(giverId: number): boolean {
    const giver = this.questGivers.find((candidate) => candidate.id === giverId);
    if (!giver || giver.activeQuestId != null || !giver.questOffer) {
      return false;
    }
    const quest = giver.questOffer;
    quest.state = 'active';
    quest.progress = 0;
    this._activateQuestObjectives(quest);
    this._refreshQuestProgress(quest);
    this.quests.push(quest);
    giver.activeQuestId = quest.id;
    giver.questOffer = null;
    return true;
  }

  turnInQuestFromGiver(giverId: number): boolean {
    const giver = this.questGivers.find((candidate) => candidate.id === giverId);
    if (!giver || giver.activeQuestId == null) {
      return false;
    }
    const questIndex = this.quests.findIndex((quest) => quest.id === giver.activeQuestId);
    if (questIndex < 0) {
      giver.activeQuestId = null;
      return false;
    }
    const quest = this.quests[questIndex];
    if (quest.state !== 'completed') {
      return false;
    }
    this._addSupplies(quest.reward.supplies);
    if (quest.reward.buff) {
      this._addTemporaryBuff(quest.reward.buff);
    }
    this.rescueCount += 1;
    this._recordRescueProgress(1 + this.rescueMasteryBonus);
    this.quests.splice(questIndex, 1);
    giver.activeQuestId = null;
    giver.questOffer = this._createQuestForVillage(giver.id, giver.villageIndex);
    return true;
  }

  getCreepCamps(): readonly CreepCamp[] {
    return this.creepCamps;
  }

  getNearbyCreepCampIds(): readonly number[] {
    return Array.from(this.nearbyCreepCampIds);
  }

  getTemporaryBuffs(): readonly TemporaryBuff[] {
    return this.temporaryBuffs;
  }

  getRelicShards(): number {
    return this.relicShards;
  }

  getUnlockedMetaUpgrades(): readonly MetaUpgradeId[] {
    return Array.from(this.unlockedMetaUpgrades);
  }

  isMetaUpgradeUnlocked(id: MetaUpgradeId): boolean {
    return this.unlockedMetaUpgrades.has(id);
  }

  canUnlockMetaUpgrade(id: MetaUpgradeId): boolean {
    if (this.unlockedMetaUpgrades.has(id)) {
      return false;
    }
    const definition = getMetaUpgradeDefinition(id);
    if (this.relicShards < definition.cost) {
      return false;
    }
    return definition.prerequisites.every((prereq) => this.unlockedMetaUpgrades.has(prereq));
  }

  unlockMetaUpgrade(id: MetaUpgradeId): boolean {
    if (!this.canUnlockMetaUpgrade(id)) {
      return false;
    }
    const definition = getMetaUpgradeDefinition(id);
    this.relicShards -= definition.cost;
    this.unlockedMetaUpgrades.add(id);
    return true;
  }

  getPhaseTimerInfo(): { phase: GamePhase; remaining: number; duration: number; waveIndex: number } {
    const duration = this.phase === 'downtime' ? DOWNTIME_DURATION : WAVE_DURATION;
    return { phase: this.phase, remaining: this.phaseTimer, duration, waveIndex: this.waveIndex };
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

  getBuildErrorMessage(): string | null {
    return this.buildErrorTimer > 0 ? this.buildErrorMessage : null;
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
    this._clearBuildError();
  }

  canAffordBlueprint(type: BuildingType): boolean {
    return this._canAfford(type);
  }

  getPhase(): GamePhase {
    return this.phase;
  }

  isDowntime(): boolean {
    return this.phase === 'downtime';
  }

  isKnightAtTavern(): boolean {
    return this.knightInTavern;
  }

  isWaveActive(): boolean {
    return this.phase === 'wave';
  }

  getDarkEnergy(): number {
    return this.darkLord.evilEnergy;
  }

  getUnitCount(): number {
    return this.units.filter((unit) => unit.allegiance === 'dark' && unit.alive).length;
  }

  getWaveIndex(): number {
    return this.waveIndex;
  }

  getTotalKills(): number {
    return this.totalKills;
  }

  getWaveRallyPoint(): Vector2 | null {
    return this.waveRallyPoint ? this.waveRallyPoint.clone() : null;
  }

  canSpawnMoreUnits(): boolean {
    return this._countDarkUnits() < MAX_UNITS;
  }

  spawnUnit(
    type: UnitType,
    position: Vector2,
    options?: {
      allegiance?: DarkUnitAllegiance;
      ignorePhase?: boolean;
      lairCenter?: Vector2;
      lairRadius?: number;
    }
  ): DarkUnit | null {
    const allegiance = options?.allegiance ?? 'dark';
    if (allegiance === 'dark') {
      if (!options?.ignorePhase && !this.isWaveActive()) {
        return null;
      }
      if (!this.canSpawnMoreUnits()) {
        return null;
      }
    }
    const half = UNIT_STATS[type].size / 2;
    const spawnSource = allegiance === 'dark' ? this.getCastleEdgePoint(position) : position.clone();
    const clamped = spawnSource.clamp(half, half, WIDTH - half, HEIGHT - half);
    const unit = new DarkUnit(clamped, type, this.unitIdCounter++, allegiance, {
      allegiance,
      lairCenter: options?.lairCenter,
      lairRadius: options?.lairRadius
    });
    this.units.push(unit);
    this.unitLookup.set(unit.id, unit);
    return unit;
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
    this.clickModifiers.handleClick(point.clone());

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

  private _setBuildError(message: string): void {
    this.buildErrorMessage = message;
    this.buildErrorTimer = 2.5;
  }

  private _clearBuildError(): void {
    this.buildErrorMessage = null;
    this.buildErrorTimer = 0;
  }

  private _exitBuildMode(): void {
    this.setBuildMode(false);
  }

  toggleCanopy(): void {
    this.world.toggleCanopy();
  }

  update(dt: number): void {
    this.world.beginFrame(dt);
    this._updateVillageStates(dt);
    if (this.buildErrorTimer > 0) {
      this.buildErrorTimer = Math.max(0, this.buildErrorTimer - dt);
      if (this.buildErrorTimer === 0) {
        this.buildErrorMessage = null;
      }
    }
    this._syncWorldObstacles();
    if (this.state !== 'running') {
      this._updateHitFlashes(dt);
      this._updateDeathParticles(dt);
      this._updateDamageNumbers(dt);
      this._updateShield(dt);
      this.world.update(dt, {
        knight: this.knight,
        monsters: this.units,
        emitNoise: (position, strength) => this.emitNoise(position, strength),
        onChestOpened: (position) => this._onChestOpened(position)
      });
      this.knightInTavern = false;
      return;
    }

    this._updatePhase(dt);
    this._updateSupplies(dt);
    this.knight.update(dt, this.world);
    this._updateTavernState();
    this._applyTavernHealing(dt);
    this._applyBarricadeSlowdown();
    this._updateSeals(dt);
    this._updateShield(dt);

    for (const unit of this.units) {
      unit.update(dt, this.knight, this, this.world);
      unit.tryAttack(this.knight, this.world, this, dt);
    }

    this._updateSurgeSystems(dt);

    this._updateWeapons(dt);
    this.clickModifiers.update(dt);
    this._pruneDeadUnits();

    this._updateBuildings(dt);
    this._updateDismantle(dt);
    this._updateProjectiles(dt);
    this._updateDarkProjectiles(dt);
    this._updateKnightProjectiles(dt);
    this._updateSmokeFields(dt);
    this._updateHitFlashes(dt);
    this._updateDeathParticles(dt);
    this._updateDamageNumbers(dt);

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
      const meleeDamage = this.knight.getMeleeDamage(1 + this.weaponDamageBonus);
      if (meleeDamage > 0) {
        let kills = 0;
        for (const unit of hits) {
          const wasAlive = unit.alive;
          const preHp = unit.hp;
          const died = unit.receiveArcHit(this.knight, meleeDamage);
          const damageDealt = Math.max(0, preHp - unit.hp);
          if (damageDealt > 0) {
            this._spawnHitFlash(unit.pos, unit.getCollisionRadius(), { strong: !unit.alive });
            this._spawnDamageNumber(unit.pos, damageDealt, { emphasis: !unit.alive });
          }
          if (wasAlive && died) {
            kills += 1;
            this._onUnitKilled(unit);
          }
        }
        if (kills > 0) {
          this._emitNoise(this.knight.pos, NOISE_ATTACK_STRENGTH);
        }
        this._pruneDeadUnits();
      }
    }

    this.darkLord.update(dt, this);

    this._updateAnchors(dt);
    this._updateNoise(dt);
    this._updateVictory(dt);
  }

  private _updateSurgeSystems(dt: number): void {
    if (!this.waveController) {
      return;
    }
    this.waveController.update(dt, {
      activeEnemies: this.surgeEnemies.length,
      canSpawn: () => this.surgeEnemies.length < this.waveController.getMaxActive(),
      spawn: (request: WaveSpawnRequest) => this._spawnSurgeEnemy(request),
      onWaveComplete: () => this._onSurgeWaveCleared()
    });

    if (!this.surgeEnemies.length) {
      return;
    }

    const villages = this.surgeVillages;
    const neighbors = this.surgeEnemies;
    const survivors: EnemySwarm[] = [];
    for (const enemy of this.surgeEnemies) {
      const event = enemy.update({ dt, villages, neighbors });
      if (event) {
        this._handleVillageAttack(event);
      }
      if (enemy.isAlive()) {
        survivors.push(enemy);
      } else {
        this.surgeEnemyPool.push(enemy);
      }
    }
    this.surgeEnemies = survivors;
  }

  private _updateVillageStates(dt: number): void {
    if (!this.surgeVillages.length) {
      return;
    }
    for (const village of this.surgeVillages) {
      village.update(dt);
    }
  }

  private _spawnSurgeEnemy(request: WaveSpawnRequest): void {
    const enemy = this.surgeEnemyPool.pop() ?? new EnemySwarm(this.surgeEnemyIdCounter++);
    enemy.reset(request.position.clone(), request.stats);
    this.surgeEnemies.push(enemy);
  }

  private _handleVillageAttack(event: VillageAttackEvent): void {
    this._spawnVillageHitEffect(event.village, event);
    this._playVillageAlarm(event.village.center);
  }

  private _spawnVillageHitEffect(village: SurgeVillage, event: VillageAttackEvent): void {
    const radius = Math.max(22, village.canopyRadius * 0.75);
    this._spawnHitFlash(village.center, radius, { strong: false });
    if (event.destroyedBuilding) {
      this._spawnHitFlash(event.destroyedBuilding.position, 18, { strong: true });
    }
  }

  private _handleVillageCollapse(village: SurgeVillage): void {
    this._spawnVillageCollapseEffect(village);
    if (this.surgeVillages.every((entry) => entry.isDestroyed())) {
      this.state = 'defeat';
    }
  }

  private _spawnVillageCollapseEffect(village: SurgeVillage): void {
    const radius = Math.max(32, village.canopyRadius);
    this._spawnHitFlash(village.center, radius, { strong: true });
    this._playVillageAlarm(village.center);
  }

  private _collectVillageIncome(): number {
    let total = 0;
    for (const village of this.surgeVillages) {
      total += village.collectIncome();
    }
    return total;
  }

  private _announceVillageIncome(amount: number): void {
    if (amount <= 0) {
      return;
    }
    this._spawnDamageNumber(CASTLE_POS.clone(), amount, { emphasis: true, color: '#F8E27A' });
  }

  private _onSurgeWaveCleared(): void {
    // Placeholder for future hooks such as achievements or notifications.
  }

  private _playVillageAlarm(_position: Vector2): void {
    if (typeof window === 'undefined') {
      return;
    }
    const AudioCtx =
      (window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) ??
      null;
    if (!AudioCtx) {
      return;
    }
    if (!this.villageAudioContext) {
      this.villageAudioContext = new AudioCtx();
    }
    const context = this.villageAudioContext;
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(260, now);
    oscillator.frequency.exponentialRampToValueAtTime(140, now + 0.4);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.65);
  }

  draw(ctx: CanvasRenderingContext2D, camera: CameraState): void {
    const { viewportWidth, viewportHeight, iso } = camera;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, viewportWidth, viewportHeight);
    ctx.restore();

    ctx.save();
    ctx.setTransform(
      iso.scale * iso.cos,
      iso.scale * iso.sin,
      -iso.scale * iso.cos,
      iso.scale * iso.sin,
      iso.offsetX,
      iso.offsetY
    );

    ctx.fillStyle = BACKGROUND_COLOR;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    this.world.drawTerrain(ctx);
    this._drawVillageDestruction(ctx);
    this._drawShield(ctx);
    this._drawCastle(ctx);
    this._drawBuildings(ctx);
    this._drawTavernInteraction(ctx);
    this._drawCreepLairHighlights(ctx);

    for (const seal of this.seals) {
      seal.draw(ctx);
    }

    for (const unit of this.units) {
      unit.draw(ctx);
    }

    this._drawSurgeEnemies(ctx);

    this._drawProjectiles(ctx);
    this._drawDarkProjectiles(ctx);
    this._drawKnightProjectiles(ctx);
    this._drawSmokeFields(ctx);
    this._drawWeaponOrbits(ctx);

    this.knight.draw(ctx);
    this.knight.drawSwing(ctx);
    this._drawDeathParticles(ctx);
    this._drawHitFlashes(ctx);
    this._drawDamageNumbers(ctx);

    this.world.drawCanopy(ctx);
    this.world.drawVillageAlarms(ctx);
    this._drawQuestObjectives(ctx);
    this._drawQuestMarkers(ctx);
    this._drawQuestGivers(ctx);
    this._drawNoisePings(ctx);
    this._drawBuildPreview(ctx);

    if (this.debugOverlay) {
      this._drawDebugOverlay(ctx);
    }

    ctx.restore();

    this._drawDirectionalIndicators(ctx, camera);

    if (this.canvasHudEnabled) {
      this._drawHud(ctx);
    }

    if (this.state === 'victory') {
      this._drawOverlay(ctx, 'VICTORY', VICTORY_COLOR, 'Press R to restart');
    } else if (this.state === 'defeat') {
      this._drawOverlay(ctx, 'DEFEAT', DEFEAT_COLOR, 'Press R to restart');
    }
  }

  private _enterDowntime(): void {
    this.phase = 'downtime';
    this.phaseTimer = this.waveController.getDowntimeDuration();
    this.weaponOrbitVisuals = [];
    this.smokeFields = [];
    this.waveRallyPoint = null;
    this.nearbyCreepCampIds.clear();
    this._generateDowntimeActivities();
    this.waveController.beginDowntime();
    if (this.waveIndex > 0) {
      const income = this._collectVillageIncome();
      if (income > 0) {
        this._addSupplies(income);
        this._announceVillageIncome(income);
      }
    }
    for (const village of this.surgeVillages) {
      village.beginDowntime();
    }
  }

  private _startWave(): void {
    if (this.phase === 'wave') {
      return;
    }
    this.phase = 'wave';
    this.phaseTimer = WAVE_DURATION;
    this.waveIndex += 1;
    this.creepCamps = [];
    this.nearbyCreepCampIds.clear();
    this.weaponOrbitVisuals = [];
    this.smokeFields = [];
    this._expireTemporaryBuffs();
    this._removeRemainingWildUnits();
    this.waveRallyPoint = this._chooseWaveRallyPoint();
    this.waveController.startWave(this.waveIndex);
    this.darkLord.beginWave(this, this.waveIndex);
  }

  private _updatePhase(dt: number): void {
    if (this.phase === 'downtime') {
      this.phaseTimer = Math.max(0, this.phaseTimer - dt);
      this._updateQuests(dt);
      this._updateCreepCamps(dt);
      if (this.phaseTimer <= 0) {
        this._startWave();
      }
    } else {
      this.phaseTimer = Math.max(0, this.phaseTimer - dt);
      if (
        this.phaseTimer <= 0 &&
        this._countDarkUnits() === 0 &&
        this._countSurgeEnemies() === 0 &&
        !this.waveController.isWaveRunning()
      ) {
        this._enterDowntime();
      }
    }
  }

  private _updateTavernState(): void {
    const tavern = this.world.getTavern();
    this.knightInTavern = this.knight.pos.distanceTo(tavern.position) <= tavern.interactRadius;
  }

  private _applyTavernHealing(dt: number): void {
    if (!this.knightInTavern || this.phase !== 'downtime') {
      return;
    }
    if (this.knight.hp >= KNIGHT_HP) {
      return;
    }
    const healAmount = Math.max(0, TAVERN_HEAL_PER_SECOND * dt);
    if (healAmount <= 0) {
      return;
    }
    this.knight.hp = Math.min(KNIGHT_HP, this.knight.hp + healAmount);
  }

  private _generateDowntimeActivities(): void {
    this._refreshQuestOffers();
    this.creepCamps = this._createCreepCamps();
  }

  private _createQuestForVillage(giverId: number, villageIndex: number): Quest {
    const type: QuestType = Math.random() < 0.5 ? 'escort' : 'retrieve';
    const questId = this.questIdCounter++;
    const position = this._chooseQuestLocation(type, villageIndex);
    const reward = this._createQuestReward(type, questId);
    const objectiveTemplate: QuestObjectiveTemplate =
      type === 'escort'
        ? {
            type: 'escort',
            spawnPoint: position.clone(),
            destination: CASTLE_POS.clone(),
            npcCount: 3,
            escortSpeed: VILLAGER_SPEED
          }
        : {
            type: 'retrieve',
            spawnPoint: position.clone()
          };
    const requiredTime = objectiveTemplate.type === 'escort' ? objectiveTemplate.npcCount : 1;
    const description =
      type === 'escort'
        ? 'Escort the villagers safely back toward the sanctuary.'
        : 'Recover relic shards from the forest shrine before the next assault.';
    const icon = type === 'escort' ? '🛡️' : '🔮';
    return {
      id: questId,
      giverId,
      type,
      position,
      radius: QUEST_RADIUS,
      requiredTime,
      progress: 0,
      state: 'available',
      description,
      icon,
      reward,
      objectiveTemplate,
      objectives: []
    };
  }

  private _refreshQuestOffers(): void {
    if (!this.questGivers.length) {
      return;
    }
    for (const giver of this.questGivers) {
      if (giver.activeQuestId != null) {
        const activeQuest = this.quests.find((quest) => quest.id === giver.activeQuestId) ?? null;
        if (!activeQuest) {
          giver.activeQuestId = null;
        }
      }
      if (giver.activeQuestId != null) {
        continue;
      }
      if (!giver.questOffer) {
        giver.questOffer = this._createQuestForVillage(giver.id, giver.villageIndex);
      }
    }
  }

  private _activateQuestObjectives(quest: Quest): void {
    quest.objectives = [];
    const template = quest.objectiveTemplate;
    switch (template.type) {
      case 'escort':
        quest.objectives.push(this._instantiateEscortObjective(quest, template));
        break;
      case 'retrieve':
        quest.objectives.push(this._instantiateRetrieveObjective(quest, template));
        break;
      default:
        break;
    }
  }

  private _instantiateEscortObjective(
    quest: Quest,
    template: EscortObjectiveTemplate
  ): EscortQuestObjective {
    const markerId = this._createQuestMarker(template.spawnPoint, quest.id, quest.icon);
    const npcs: EscortNpcState[] = [];
    for (let i = 0; i < template.npcCount; i++) {
      const angle = (i / Math.max(1, template.npcCount)) * Math.PI * 2;
      const offset = new Vector2(Math.cos(angle), Math.sin(angle)).scale(12);
      const spawn = template.spawnPoint.clone().add(offset);
      npcs.push({
        id: this.questEntityIdCounter++,
        position: spawn,
        state: 'waiting',
        speed: template.escortSpeed,
        arrivalRadius: 24
      });
    }
    return {
      id: this.questObjectiveIdCounter++,
      questId: quest.id,
      type: 'escort',
      markerId,
      state: 'pending',
      destination: template.destination.clone(),
      npcs,
      progress: 0,
      required: npcs.length
    };
  }

  private _instantiateRetrieveObjective(
    quest: Quest,
    template: RetrieveObjectiveTemplate
  ): RetrieveQuestObjective {
    const markerId = this._createQuestMarker(template.spawnPoint, quest.id, quest.icon);
    const pickup: QuestPickupState = {
      id: this.questEntityIdCounter++,
      position: template.spawnPoint.clone(),
      pickedUp: false
    };
    return {
      id: this.questObjectiveIdCounter++,
      questId: quest.id,
      type: 'retrieve',
      markerId,
      state: 'pending',
      pickup,
      progress: 0,
      required: 1
    };
  }

  private _createQuestMarker(position: Vector2, questId: number, icon: string): number {
    const marker: QuestMarker = {
      id: this.questMarkerIdCounter++,
      questId,
      icon,
      position: position.clone(),
      visible: true
    };
    this.questMarkers.push(marker);
    return marker.id;
  }

  private _getQuestMarker(markerId: number | null): QuestMarker | null {
    if (markerId == null) {
      return null;
    }
    return this.questMarkers.find((marker) => marker.id === markerId) ?? null;
  }

  private _updateQuestMarkerPosition(markerId: number | null, position: Vector2): void {
    const marker = this._getQuestMarker(markerId);
    if (!marker) {
      return;
    }
    marker.position.copy(position);
  }

  private _removeQuestMarker(markerId: number | null): void {
    if (markerId == null) {
      return;
    }
    const index = this.questMarkers.findIndex((marker) => marker.id === markerId);
    if (index >= 0) {
      this.questMarkers.splice(index, 1);
    }
  }

  private _refreshQuestProgress(quest: Quest): void {
    if (!quest.objectives.length) {
      quest.progress = 0;
      quest.requiredTime = 1;
      return;
    }
    let totalRequired = 0;
    let totalProgress = 0;
    for (const objective of quest.objectives) {
      totalRequired += objective.required;
      totalProgress += objective.progress;
    }
    quest.requiredTime = Math.max(1, totalRequired);
    quest.progress = Math.min(totalProgress, quest.requiredTime);
  }

  private _cleanupQuestObjectives(quest: Quest): void {
    if (!quest.objectives.length) {
      return;
    }
    for (const objective of quest.objectives) {
      if (objective.markerId != null) {
        this._removeQuestMarker(objective.markerId);
        objective.markerId = null;
      }
    }
  }

  private _updateEscortObjective(objective: EscortQuestObjective, dt: number): void {
    let arrivedCount = 0;
    let markerPosition: Vector2 | null = null;
    for (const npc of objective.npcs) {
      if (npc.state === 'arrived') {
        arrivedCount += 1;
        continue;
      }
      if (!markerPosition) {
        markerPosition = npc.position;
      }
      const distanceToKnight = npc.position.distanceTo(this.knight.pos);
      if (distanceToKnight <= QUEST_INTERACTION_RADIUS) {
        npc.state = 'moving';
      }
      if (npc.state === 'moving') {
        const toDestination = objective.destination.clone().subtract(npc.position);
        const distanceToDestination = toDestination.length();
        if (distanceToDestination <= npc.arrivalRadius) {
          npc.position.copy(objective.destination);
          npc.state = 'arrived';
          arrivedCount += 1;
          continue;
        }
        if (distanceToDestination > 0) {
          toDestination.normalize();
          const step = Math.min(distanceToDestination, npc.speed * dt);
          npc.position.add(toDestination.scale(step));
        }
      }
    }
    if (markerPosition && objective.markerId != null) {
      this._updateQuestMarkerPosition(objective.markerId, markerPosition);
    }
    objective.progress = arrivedCount;
    objective.required = Math.max(1, objective.npcs.length);
    if (arrivedCount >= objective.npcs.length) {
      objective.state = 'completed';
      if (objective.markerId != null) {
        this._removeQuestMarker(objective.markerId);
        objective.markerId = null;
      }
    } else {
      objective.state = 'pending';
    }
  }

  private _updateRetrieveObjective(objective: RetrieveQuestObjective): void {
    if (objective.pickup.pickedUp) {
      objective.progress = objective.required;
      objective.state = 'completed';
      if (objective.markerId != null) {
        this._removeQuestMarker(objective.markerId);
        objective.markerId = null;
      }
      return;
    }
    if (objective.markerId != null) {
      this._updateQuestMarkerPosition(objective.markerId, objective.pickup.position);
    }
    const distance = objective.pickup.position.distanceTo(this.knight.pos);
    if (distance <= QUEST_INTERACTION_RADIUS * 0.75) {
      objective.pickup.pickedUp = true;
      objective.progress = objective.required;
      objective.state = 'completed';
      if (objective.markerId != null) {
        this._removeQuestMarker(objective.markerId);
        objective.markerId = null;
      }
    } else {
      objective.progress = 0;
      objective.state = 'pending';
    }
  }

  private _resolveQuestGiverState(giver: QuestGiver): {
    state: QuestGiverStatus['state'];
    activeQuest: Quest | null;
  } {
    const activeQuest =
      giver.activeQuestId != null
        ? this.quests.find((quest) => quest.id === giver.activeQuestId) ?? null
        : null;
    if (activeQuest) {
      return {
        state: activeQuest.state === 'completed' ? 'turnIn' : 'active',
        activeQuest
      };
    }
    return { state: giver.questOffer ? 'offering' : 'waiting', activeQuest: null };
  }

  private _drawQuestObjectives(ctx: CanvasRenderingContext2D): void {
    if (!this.quests.length) {
      return;
    }
    ctx.save();
    for (const quest of this.quests) {
      if (quest.state !== 'active') {
        continue;
      }
      for (const objective of quest.objectives) {
        if (objective.type === 'escort') {
          for (const npc of objective.npcs) {
            ctx.globalAlpha = npc.state === 'arrived' ? 0.5 : 0.95;
            ctx.fillStyle = npc.state === 'arrived' ? 'rgba(252, 211, 77, 0.4)' : '#fcd34d';
            ctx.strokeStyle = '#b45309';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(npc.position.x, npc.position.y, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          }
        } else if (objective.type === 'retrieve') {
          if (objective.pickup.pickedUp) {
            continue;
          }
          ctx.globalAlpha = 0.9;
          ctx.fillStyle = '#a855f7';
          ctx.strokeStyle = '#6b21a8';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          const { x, y } = objective.pickup.position;
          ctx.moveTo(x, y - 6);
          ctx.lineTo(x + 6, y);
          ctx.lineTo(x, y + 6);
          ctx.lineTo(x - 6, y);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  }

  private _drawQuestMarkers(ctx: CanvasRenderingContext2D): void {
    if (!this.questMarkers.length) {
      return;
    }
    ctx.save();
    ctx.font = '16px Inter';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const marker of this.questMarkers) {
      if (!marker.visible) {
        continue;
      }
      ctx.globalAlpha = 0.95;
      const anchorY = marker.position.y - 22;
      ctx.fillStyle = 'rgba(253, 224, 71, 0.9)';
      ctx.beginPath();
      ctx.arc(marker.position.x, anchorY, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.95)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#1f2937';
      ctx.fillText(marker.icon, marker.position.x, anchorY);
      ctx.beginPath();
      ctx.moveTo(marker.position.x, anchorY + 11);
      ctx.lineTo(marker.position.x, marker.position.y - 4);
      ctx.stroke();
    }
    ctx.restore();
  }

  private _drawQuestGivers(ctx: CanvasRenderingContext2D): void {
    if (!this.questGivers.length) {
      return;
    }
    ctx.save();
    ctx.font = '12px Inter';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const giver of this.questGivers) {
      const { state } = this._resolveQuestGiverState(giver);
      let fill = '#9ca3af';
      if (state === 'offering') {
        fill = '#fbbf24';
      } else if (state === 'active') {
        fill = '#60a5fa';
      } else if (state === 'turnIn') {
        fill = '#34d399';
      }
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.arc(giver.position.x, giver.position.y - 18, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillText('📜', giver.position.x, giver.position.y - 18);
    }
    ctx.restore();
  }

  private _drawTavernInteraction(ctx: CanvasRenderingContext2D): void {
    if (!this.isDowntime()) {
      return;
    }
    const tavern = this.world.getTavern();
    ctx.save();
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.65)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.arc(tavern.position.x, tavern.position.y, tavern.interactRadius, 0, Math.PI * 2);
    ctx.stroke();
    if (this.knightInTavern) {
      ctx.fillStyle = 'rgba(253, 230, 138, 0.25)';
      ctx.beginPath();
      ctx.arc(tavern.position.x, tavern.position.y, tavern.interactRadius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.setLineDash([]);
    ctx.restore();
  }

  private _drawCreepLairHighlights(ctx: CanvasRenderingContext2D): void {
    if (!this.nearbyCreepCampIds.size) {
      return;
    }
    ctx.save();
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 8]);
    ctx.strokeStyle = 'rgba(252, 211, 77, 0.85)';
    ctx.fillStyle = 'rgba(252, 211, 77, 0.15)';
    for (const camp of this.creepCamps) {
      if (camp.cleared || !this.nearbyCreepCampIds.has(camp.id)) {
        continue;
      }
      ctx.beginPath();
      ctx.arc(camp.position.x, camp.position.y, camp.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();
  }

  private _chooseQuestLocation(type: QuestType, index: number): Vector2 {
    if (type === 'escort') {
      const villages = this.world.getVillages();
      if (villages.length) {
        const village = villages[index % villages.length];
        return village.center.clone();
      }
    }
    if (type === 'retrieve') {
      const trees = this.world.getTrees();
      if (trees.length) {
        const tree = trees[Math.floor(Math.random() * trees.length)];
        return tree.position.clone();
      }
    }
    return this._randomEncounterPoint();
  }

  private _createQuestReward(type: QuestType, questId: number): QuestReward {
    const expiresAtWave = this.waveIndex + TEMP_BUFF_WAVE_DURATION;
    if (type === 'escort') {
      return {
        supplies: QUEST_REWARD_SUPPLIES,
        description: 'Fleetfoot blessing: temporary speed boost.',
        buff: {
          id: `speed-${questId}`,
          description: 'Fleetfoot blessing (+speed until next wave)',
          speedBonus: QUEST_REWARD_SPEED_BONUS,
          expiresAtWave
        }
      };
    }
    return {
      supplies: QUEST_REWARD_SUPPLIES,
      description: 'Radiant oil: weapons burn brighter.',
      buff: {
        id: `damage-${questId}`,
        description: 'Radiant oil (+weapon damage until next wave)',
        damageBonus: QUEST_REWARD_BUFF_MULTIPLIER,
        expiresAtWave
      }
    };
  }

  private _chooseWaveRallyPoint(): Vector2 {
    const villages = this.world.getVillages();
    if (!villages.length) {
      return CASTLE_POS.clone();
    }
    const index = (this.waveIndex - 1) % villages.length;
    return villages[index].center.clone();
  }

  private _createCreepCamps(): CreepCamp[] {
    const camps: CreepCamp[] = [];
    for (let i = 0; i < CREEP_CAMPS_PER_DOWNTIME; i++) {
      const campId = this.creepCampIdCounter++;
      const position = this._randomEncounterPoint();
      const radius = MONSTER_LAIR_RADIUS;
      const packSize = Math.floor(
        CREEP_PACK_SIZE[0] + Math.random() * (CREEP_PACK_SIZE[1] - CREEP_PACK_SIZE[0] + 1)
      );
      const unitIds: number[] = [];
      for (let n = 0; n < packSize; n++) {
        const angle = (Math.PI * 2 * n) / Math.max(1, packSize);
        const distance = 12 + Math.random() * 18;
        const spawnPos = position
          .clone()
          .add(new Vector2(Math.cos(angle) * distance, Math.sin(angle) * distance));
        const type = CREEP_UNIT_TYPES[Math.floor(Math.random() * CREEP_UNIT_TYPES.length)];
        const unit = this.spawnUnit(type, spawnPos, {
          allegiance: 'wild',
          ignorePhase: true,
          lairCenter: position,
          lairRadius: radius
        });
        if (unit) {
          unitIds.push(unit.id);
        }
      }
      camps.push({
        id: campId,
        position,
        radius,
        unitIds,
        cleared: false,
        rewardSupplies: CREEP_REWARD_SUPPLIES,
        rewardRelicShards: CREEP_REWARD_RELIC_SHARDS,
        name: `Roaming pack ${campId}`
      });
    }
    return camps;
  }

  private _removeRemainingWildUnits(): void {
    if (!this.units.length) {
      return;
    }
    const survivors: DarkUnit[] = [];
    for (const unit of this.units) {
      if (unit.allegiance !== 'dark') {
        this.unitLookup.delete(unit.id);
        continue;
      }
      survivors.push(unit);
    }
    this.units = survivors;
  }

  private _updateQuests(dt: number): void {
    if (!this.quests.length) {
      return;
    }
    for (const quest of this.quests) {
      if (quest.state !== 'active') {
        continue;
      }
      for (const objective of quest.objectives) {
        switch (objective.type) {
          case 'escort':
            this._updateEscortObjective(objective, dt);
            break;
          case 'retrieve':
            this._updateRetrieveObjective(objective);
            break;
          default:
            break;
        }
      }
      this._refreshQuestProgress(quest);
      if (quest.objectives.length && quest.objectives.every((objective) => objective.state === 'completed')) {
        this._completeQuest(quest);
      }
    }
  }

  private _completeQuest(quest: Quest): void {
    if (quest.state !== 'active') {
      return;
    }
    quest.state = 'completed';
    for (const objective of quest.objectives) {
      objective.state = 'completed';
      objective.progress = objective.required;
      if (objective.markerId != null) {
        this._removeQuestMarker(objective.markerId);
        objective.markerId = null;
      }
    }
    this._refreshQuestProgress(quest);
    this._cleanupQuestObjectives(quest);
  }

  private _recordRescueProgress(amount: number): void {
    for (const state of this.weaponStates.values()) {
      state.rescues += amount;
      this._checkWeaponEvolution(state);
    }
  }

  private _addTemporaryBuff(buff: TemporaryBuff): void {
    this.temporaryBuffs.push(buff);
    if (buff.damageBonus) {
      this.weaponDamageBonus += buff.damageBonus;
    }
    if (buff.speedBonus) {
      this.temporarySpeedBonus += buff.speedBonus;
    }
    this._applyTemporarySpeedBonus();
  }

  private _expireTemporaryBuffs(): void {
    if (!this.temporaryBuffs.length) {
      this._applyTemporarySpeedBonus();
      return;
    }
    let damageAdjustment = 0;
    let speedAdjustment = 0;
    const survivors: TemporaryBuff[] = [];
    for (const buff of this.temporaryBuffs) {
      if (buff.expiresAtWave > this.waveIndex) {
        survivors.push(buff);
        continue;
      }
      if (buff.damageBonus) {
        damageAdjustment += buff.damageBonus;
      }
      if (buff.speedBonus) {
        speedAdjustment += buff.speedBonus;
      }
    }
    this.temporaryBuffs = survivors;
    if (damageAdjustment !== 0) {
      this.weaponDamageBonus = Math.max(0, this.weaponDamageBonus - damageAdjustment);
    }
    if (speedAdjustment !== 0) {
      this.temporarySpeedBonus = Math.max(0, this.temporarySpeedBonus - speedAdjustment);
    }
    this._applyTemporarySpeedBonus();
  }

  private _applyTemporarySpeedBonus(): void {
    this.knight.setTemporarySpeedMultiplier(1 + this.temporarySpeedBonus);
  }

  private _updateCreepCamps(_dt: number): void {
    if (!this.creepCamps.length) {
      this.nearbyCreepCampIds.clear();
      return;
    }
    this.nearbyCreepCampIds.clear();
    for (const camp of this.creepCamps) {
      if (camp.cleared) {
        continue;
      }
      const survivors: number[] = [];
      for (const id of camp.unitIds) {
        const unit = this.unitLookup.get(id);
        if (unit && unit.alive) {
          survivors.push(id);
        }
      }
      camp.unitIds = survivors;
      const distanceToKnight = camp.position.distanceTo(this.knight.pos);
      if (distanceToKnight <= camp.radius + CREEP_APPROACH_BUFFER) {
        this.nearbyCreepCampIds.add(camp.id);
      }
      if (!camp.unitIds.length) {
        this._completeCreepCamp(camp);
      }
    }
  }

  private _completeCreepCamp(camp: CreepCamp): void {
    if (camp.cleared) {
      return;
    }
    camp.cleared = true;
    this._addSupplies(camp.rewardSupplies);
    this.relicShards += camp.rewardRelicShards;
  }

  private _updateWeapons(dt: number): void {
    if (!this.weaponStates.size) {
      return;
    }
    this.weaponOrbitVisuals = [];
    for (const state of this.weaponStates.values()) {
      switch (state.id) {
        case 'throwingKnife':
          this._updateThrowingKnife(state, dt);
          break;
        case 'torch':
          this._updateTorch(state, dt);
          break;
        case 'crossbowCharm':
          this._updateCrossbowCharm(state, dt);
          break;
        case 'smokeBombSatchel':
          this._updateSmokeSatchel(state, dt);
          break;
        default:
          break;
      }
    }
  }

  private _updateThrowingKnife(state: WeaponRuntimeState, dt: number): void {
    state.cooldown = Math.max(0, state.cooldown - dt);
    const cadence = state.evolved ? THROWING_KNIFE_COOLDOWN * 0.75 : THROWING_KNIFE_COOLDOWN;
    if (state.cooldown > 0) {
      return;
    }
    const target = this._findNearestEnemy(THROWING_KNIFE_RANGE, { requireLineOfSight: false });
    if (!target) {
      return;
    }
    const toTarget = target.pos.clone().subtract(this.knight.pos);
    if (toTarget.lengthSq() === 0) {
      return;
    }
    toTarget.normalize();
    const daggerCount = state.evolved ? 3 : 2;
    const spread = state.evolved ? 0.25 : 0.18;
    for (let i = 0; i < daggerCount; i++) {
      const offset = (i - (daggerCount - 1) / 2) * spread;
      const direction = this._rotateVector(toTarget, offset);
      const velocity = direction.scale(THROWING_KNIFE_RANGE * 4.2);
      const effects = state.evolved
        ? { dot: { dps: POISON_DAGGER_DPS, duration: POISON_DAGGER_DURATION } }
        : undefined;
      this._spawnKnightProjectile({
        position: this.knight.pos.clone(),
        velocity,
        damage: THROWING_KNIFE_DAMAGE,
        source: 'throwingKnife',
        effects,
        tint: state.evolved ? '#8ef3a0' : '#facc15'
      });
    }
    state.cooldown = cadence;
  }

  private _updateTorch(state: WeaponRuntimeState, dt: number): void {
    const angle = (typeof state.data.angle === 'number' ? state.data.angle : 0) + dt * Math.PI * 0.9;
    state.data.angle = angle;
    const radius = state.evolved ? INFERNO_RING_RADIUS : TORCH_ORBIT_RADIUS;
    const interval = TORCH_TICK_INTERVAL;
    const tickTimer = (typeof state.data.tickTimer === 'number' ? state.data.tickTimer : 0) + dt;
    state.data.tickTimer = tickTimer;
    for (let i = 0; i < TORCH_ORBIT_COUNT; i++) {
      const flameAngle = angle + (i / TORCH_ORBIT_COUNT) * Math.PI * 2;
      const position = this.knight.pos.clone().add(
        new Vector2(Math.cos(flameAngle) * radius, Math.sin(flameAngle) * radius)
      );
      this.weaponOrbitVisuals.push({ position, radius: 8, alpha: state.evolved ? 0.65 : 0.4 });
    }
    if (tickTimer < interval) {
      return;
    }
    state.data.tickTimer = tickTimer - interval;
    const baseDamage = TORCH_TICK_DAMAGE * (1 + this.weaponDamageBonus);
    for (const unit of this.units) {
      if (!unit.alive) {
        continue;
      }
      if (unit.pos.distanceTo(this.knight.pos) <= radius + unit.getCollisionRadius()) {
        const preHp = unit.hp;
        unit.takeDamage(baseDamage);
        const damageDealt = Math.max(0, preHp - unit.hp);
        if (damageDealt > 0) {
          this._spawnHitFlash(unit.pos, unit.getCollisionRadius(), { strong: !unit.alive });
          this._spawnDamageNumber(unit.pos, damageDealt, {
            emphasis: state.evolved || !unit.alive,
            color: state.evolved ? '#FFB86C' : '#FFD37A'
          });
        }
        if (!unit.alive) {
          this._onUnitKilled(unit);
        } else if (state.evolved) {
          unit.applyDot(INFERNO_RING_DPS, interval * 2);
        }
      }
    }
  }

  private _updateCrossbowCharm(state: WeaponRuntimeState, dt: number): void {
    state.cooldown = Math.max(0, state.cooldown - dt);
    const cadence = state.evolved ? REPEATING_ARBALEST_COOLDOWN : CROSSBOW_CHARM_COOLDOWN;
    if (state.cooldown > 0) {
      return;
    }
    const target = this._findNearestEnemy(CROSSBOW_CHARM_RANGE, { requireLineOfSight: true });
    if (!target) {
      return;
    }
    const toTarget = target.pos.clone().subtract(this.knight.pos);
    if (toTarget.lengthSq() === 0) {
      return;
    }
    toTarget.normalize();
    const shots = state.evolved ? 2 : 1;
    const spread = state.evolved ? 0.12 : 0;
    for (let i = 0; i < shots; i++) {
      const offset = spread * (i - (shots - 1) / 2);
      const direction = this._rotateVector(toTarget, offset);
      const velocity = direction.scale(CROSSBOW_CHARM_RANGE * 3.4);
      this._spawnKnightProjectile({
        position: this.knight.pos.clone(),
        velocity,
        damage: CROSSBOW_CHARM_DAMAGE,
        source: 'crossbowCharm',
        pierce: state.evolved ? REPEATING_ARBALEST_PIERCE : undefined,
        tint: state.evolved ? '#c0f2ff' : '#fde68a',
        target
      });
    }
    this._emitNoise(this.knight.pos, KNIGHT_BOW_NOISE * 0.6);
    state.cooldown = cadence;
  }

  private _updateSmokeSatchel(state: WeaponRuntimeState, dt: number): void {
    state.cooldown = Math.max(0, state.cooldown - dt);
    const interval = state.evolved ? Math.max(3, SMOKE_BOMB_INTERVAL - 1.5) : SMOKE_BOMB_INTERVAL;
    if (state.cooldown > 0) {
      return;
    }
    this.smokeFields.push({
      id: this.smokeFieldIdCounter++,
      position: this.knight.pos.clone(),
      radius: state.evolved ? CLOAK_FIELD_RADIUS : SMOKE_BOMB_RADIUS,
      timer: state.evolved ? CLOAK_FIELD_DURATION : SMOKE_BOMB_DURATION,
      slowFactor: state.evolved ? CLOAK_FIELD_SLOW : SMOKE_BOMB_SLOW,
      cloakTimer: state.evolved ? CLOAK_FIELD_CLOAK_TIME : 0,
      baseDuration: state.evolved ? CLOAK_FIELD_DURATION : SMOKE_BOMB_DURATION
    });
    state.cooldown = interval;
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

  private _countDarkUnits(): number {
    let count = 0;
    for (const unit of this.units) {
      if (unit.allegiance === 'dark' && unit.alive) {
        count += 1;
      }
    }
    return count;
  }

  private _countSurgeEnemies(): number {
    return this.surgeEnemies.length;
  }

  private _syncUnitLookup(): void {
    for (const [id, unit] of this.unitLookup) {
      if (!unit.alive) {
        this.unitLookup.delete(id);
      }
    }
  }

  private _randomEncounterPoint(): Vector2 {
    const margin = 70;
    const villages = this.world.getVillages();
    for (let attempt = 0; attempt < 20; attempt++) {
      const point = new Vector2(
        margin + Math.random() * (WIDTH - margin * 2),
        margin + Math.random() * (HEIGHT - margin * 2)
      );
      if (point.distanceTo(CASTLE_POS) < 120) {
        continue;
      }
      let nearVillage = false;
      for (const village of villages) {
        if (point.distanceTo(village.center) < MONSTER_LAIR_VILLAGE_BUFFER) {
          nearVillage = true;
          break;
        }
      }
      if (nearVillage) {
        continue;
      }
      if (point.distanceTo(this.knight.pos) < 80) {
        continue;
      }
      return point;
    }
    return new Vector2(WIDTH / 2, HEIGHT / 2);
  }

  private _findNearestEnemy(
    range: number,
    options?: { requireLineOfSight?: boolean }
  ): DarkUnit | null {
    const requireLine = options?.requireLineOfSight ?? false;
    let nearest: DarkUnit | null = null;
    let nearestDist = range;
    for (const unit of this.units) {
      if (!unit.alive) {
        continue;
      }
      const distance = unit.pos.distanceTo(this.knight.pos);
      if (distance > range || distance >= nearestDist) {
        continue;
      }
      if (requireLine && !this.world.hasLineOfSight(this.knight.pos, unit.pos)) {
        continue;
      }
      nearest = unit;
      nearestDist = distance;
    }
    return nearest;
  }

  private _findNearestUnitToPoint(position: Vector2, radius: number): DarkUnit | null {
    let nearest: DarkUnit | null = null;
    let nearestDist = radius;
    for (const unit of this.units) {
      if (!unit.alive) {
        continue;
      }
      const distance = unit.pos.distanceTo(position);
      if (distance > radius || distance >= nearestDist) {
        continue;
      }
      nearest = unit;
      nearestDist = distance;
    }
    return nearest;
  }

  private _findUnitsInRadius(position: Vector2, radius: number): DarkUnit[] {
    if (radius <= 0) {
      return [];
    }
    const results: DarkUnit[] = [];
    for (const unit of this.units) {
      if (!unit.alive) {
        continue;
      }
      if (unit.pos.distanceTo(position) <= radius) {
        results.push(unit);
      }
    }
    return results;
  }

  private _getRandomAliveUnit(): DarkUnit | null {
    const alive = this.units.filter((unit) => unit.alive);
    if (!alive.length) {
      return null;
    }
    const index = Math.floor(Math.random() * alive.length);
    return alive[index] ?? null;
  }

  private _getClickDamage(): number {
    return CLICK_BASE_DAMAGE * (1 + this.weaponDamageBonus);
  }

  private _handleClickHit(target: DarkUnit, damage: number, context: ClickHitContext): void {
    if (!target.alive || damage <= 0) {
      return;
    }
    const preHp = target.hp;
    target.takeDamage(damage);
    const dealt = Math.max(0, preHp - target.hp);
    if (dealt <= 0) {
      return;
    }
    const strong = !target.alive;
    const color = context.crit ? '#fde68a' : undefined;
    this._spawnHitFlash(target.pos, target.getCollisionRadius(), { strong });
    this._spawnDamageNumber(target.pos, dealt, { emphasis: context.crit || strong, color });
    if (context.burn && target.alive) {
      target.applyDot(context.burn.dps, context.burn.duration);
    }
    if (context.freeze && target.alive) {
      target.applySlow(context.freeze.factor, context.freeze.duration);
    }
    if (!target.alive) {
      this._onUnitKilled(target);
    }
    this._pruneDeadUnits();
  }

  private _pruneDeadUnits(): void {
    if (!this.units.length) {
      return;
    }
    this.units = this.units.filter((unit) => unit.alive);
    this._syncUnitLookup();
  }

  private _rotateVector(vector: Vector2, angle: number): Vector2 {
    if (angle === 0) {
      return vector.clone();
    }
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return new Vector2(vector.x * cos - vector.y * sin, vector.x * sin + vector.y * cos);
  }

  private _onUnitKilled(unit: DarkUnit): void {
    this._spawnDeathBurst(unit);
    this.totalKills += 1;
    for (const state of this.weaponStates.values()) {
      state.kills += 1 + this.killMasteryBonus;
      this._checkWeaponEvolution(state);
    }
  }

  private _checkWeaponEvolution(state: WeaponRuntimeState): void {
    if (state.evolved) {
      return;
    }
    const definition = ITEM_DEFINITIONS[state.id];
    const requirement = definition?.evolveRequirement;
    if (!requirement) {
      return;
    }
    const meetsRequirement =
      (requirement.type === 'kills' && state.kills >= requirement.count) ||
      (requirement.type === 'rescues' && state.rescues >= requirement.count);
    if (meetsRequirement) {
      state.evolved = true;
      state.cooldown = 0;
    }
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
    if (this.noiseListener) {
      this.noiseListener(strength);
    }
  }

  emitNoise(position: Vector2, strength: number): void {
    this._emitNoise(position, strength);
  }

  setNoiseListener(listener: ((strength: number) => void) | null): void {
    this.noiseListener = listener ?? null;
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

  private _drawVillageDestruction(ctx: CanvasRenderingContext2D): void {
    if (!this.surgeVillages.length) {
      return;
    }
    ctx.save();
    for (const village of this.surgeVillages) {
      const center = village.center;
      const radius = Math.max(30, village.canopyRadius * 0.85);
      const burn = village.getBurnIntensity();
      if (burn > 0) {
        ctx.fillStyle = `rgba(255, 90, 32, ${(0.18 + burn * 0.5).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
      const flash = village.getAttackFlash();
      if (flash > 0) {
        ctx.fillStyle = `rgba(255, 196, 74, ${(0.22 + flash * 0.45).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(center.x, center.y, radius * 0.9, 0, Math.PI * 2);
        ctx.fill();
      }
      const collapse = village.getCollapseProgress();
      if (collapse > 0) {
        ctx.fillStyle = `rgba(32, 18, 12, ${(0.35 + collapse * 0.55).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(center.x, center.y, radius * (0.7 + collapse * 0.3), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
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
    const size = (CASTLE_SIZE + pulse * 4) * ISO_CASTLE_SCALE;
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

  private _drawSurgeEnemies(ctx: CanvasRenderingContext2D): void {
    if (!this.surgeEnemies.length) {
      return;
    }
    for (const enemy of this.surgeEnemies) {
      enemy.draw(ctx);
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

  private _drawDarkProjectiles(ctx: CanvasRenderingContext2D): void {
    if (!this.darkProjectiles.length) {
      return;
    }
    ctx.save();
    ctx.strokeStyle = 'rgba(200, 170, 255, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.fillStyle = '#d8c6ff';
    for (const projectile of this.darkProjectiles) {
      const direction = projectile.velocity.clone();
      const speed = direction.length();
      if (speed > 0) {
        direction.scale(1 / speed);
        const tail = projectile.position.clone().subtract(direction.clone().scale(projectile.radius * 2.5));
        ctx.beginPath();
        ctx.moveTo(projectile.position.x, projectile.position.y);
        ctx.lineTo(tail.x, tail.y);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(projectile.position.x, projectile.position.y, projectile.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private _drawDirectionalIndicators(_ctx: CanvasRenderingContext2D, _camera: CameraState): void {
    // The single-screen isometric view keeps every point of interest visible.
  }

  private _drawBuildPreview(ctx: CanvasRenderingContext2D): void {
    if (!this.buildMode || !this.buildCursor) {
      return;
    }
    const position = this.buildCursor;
    const { halfWidth, halfHeight } = getBuildingHalfSize(this.buildSelection);
    const evaluation = this._evaluatePlacement(this.buildSelection, position);
    const canAfford = this._canAfford(this.buildSelection);
    const overallValid = canAfford && evaluation.valid;
    ctx.save();
    ctx.globalAlpha = 0.55;
    for (const tile of evaluation.tiles) {
      const tileValid = canAfford && tile.valid;
      ctx.fillStyle = tileValid ? 'rgba(120, 220, 140, 0.55)' : 'rgba(220, 100, 100, 0.6)';
      ctx.fillRect(tile.left, tile.top, tile.width, tile.height);
    }
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = overallValid ? 'rgba(120, 220, 140, 0.9)' : 'rgba(220, 100, 100, 0.9)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(position.x - halfWidth, position.y - halfHeight, halfWidth * 2, halfHeight * 2);
    ctx.beginPath();
    for (const tile of evaluation.tiles) {
      ctx.rect(tile.left, tile.top, tile.width, tile.height);
    }
    ctx.strokeStyle = overallValid ? 'rgba(120, 220, 140, 0.4)' : 'rgba(220, 100, 100, 0.4)';
    ctx.stroke();
    ctx.strokeStyle = overallValid ? 'rgba(120, 220, 140, 0.9)' : 'rgba(220, 100, 100, 0.9)';
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
    const statsText = `HP: ${this.knight.hp}  Evil: ${this.darkLord.evilEnergy}  Units: ${this.units.length}/${MAX_UNITS}  Seals: ${this.brokenSeals}/${SEAL_COUNT}  Gold: ${this.supplies}`;
    ctx.fillText(statsText, hpBarX, statsY);

    const helperText =
      'B=Build  [1]Tower(20) [2]Barr(12) [3]Spike(10) [4]Beacon(15) [5]Workshop(25)   X=Dismantle';
    ctx.font = '14px Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(helperText, ctx.canvas.width / 2, ctx.canvas.height - 12);

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

  private _initializeQuestGivers(): void {
    this.questGivers = [];
    this.questGiverIdCounter = 1;
    const villages = this.world.getVillages();
    const namePool = ['Rowan', 'Elara', 'Thorne', 'Maris', 'Galen', 'Bryn'];
    for (let i = 0; i < villages.length; i++) {
      const village = villages[i];
      const id = this.questGiverIdCounter++;
      const name = `Elder ${namePool[i % namePool.length]}`;
      const villageName = `Village ${i + 1}`;
      const greeting = `The people of ${villageName} look to you for aid.`;
      const quest = this._createQuestForVillage(id, i);
      this.questGivers.push({
        id,
        villageIndex: i,
        position: village.center.clone(),
        name,
        villageName,
        greeting,
        questOffer: quest,
        activeQuestId: null
      });
    }
  }

  private _initializeDarkSurgeState(): void {
    this.waveController = new WaveController(this.waveConfig, { castlePosition: CASTLE_POS.clone() });
    this.surgeEnemies = [];
    this.surgeEnemyPool = [];
    this.surgeEnemyIdCounter = 1;
    this._rebuildSurgeVillages();
  }

  private _rebuildSurgeVillages(): void {
    const villages = Array.from(this.world.getVillages());
    this.surgeVillages = villages.map(
      (village, index) =>
        new SurgeVillage(index + 1, village, this.waveConfig.village, (collapsed) =>
          this._handleVillageCollapse(collapsed)
        )
    );
  }

  private _initializeKnightLoadout(): void {
    this.ownedItems.clear();
    this.weaponStates.clear();
    this.supportItems.clear();
    this.weaponDamageBonus = 0;
    this.temporarySpeedBonus = 0;
    this.killMasteryBonus = 0;
    this.rescueMasteryBonus = 0;
    this.knightProjectiles = [];
    this.knightProjectileIdCounter = 1;
    this.knight.setTemporarySpeedMultiplier(1);
    this.clickModifiers.reset();
    this._grantItem('steelSword');
    this._applyPersistentItems();
  }

  private _applyPersistentItems(): void {
    if (!this.persistentItemIds.size) {
      return;
    }
    for (const itemId of this.persistentItemIds) {
      if (itemId === 'steelSword') {
        continue;
      }
      this._grantItem(itemId);
    }
  }

  private _isClickModifier(itemId: ItemId): boolean {
    const definition = ITEM_DEFINITIONS[itemId];
    return !!definition?.clickEffects && definition.clickEffects.length > 0;
  }

  private _grantItem(itemId: ItemId): void {
    const definition = ITEM_DEFINITIONS[itemId];
    if (!definition) {
      return;
    }
    if (definition.unique && this.ownedItems.has(itemId)) {
      return;
    }
    const isClickModifier = this._isClickModifier(itemId);
    this.ownedItems.add(itemId);
    if (definition.category === 'weapon' && !isClickModifier && !this.weaponStates.has(itemId)) {
      this.weaponStates.set(itemId, {
        id: itemId,
        cooldown: 0,
        evolved: false,
        kills: 0,
        rescues: 0,
        data: {}
      });
    }
    if (definition.category === 'support' || isClickModifier) {
      this.supportItems.add(itemId);
    }
    if (definition.clickEffects) {
      for (const effect of definition.clickEffects) {
        this.clickModifiers.addEffect(effect);
      }
    }
    this._applyItemEffect(itemId);
  }

  private _applyItemEffect(itemId: ItemId): void {
    switch (itemId) {
      case 'steelSword':
        this.knight.equipMeleeWeapon();
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

    this._pruneDeadUnits();
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
        const wasAlive = hitUnit.alive;
        const preHp = hitUnit.hp;
        hitUnit.takeDamage(projectile.damage);
        const damageDealt = Math.max(0, preHp - hitUnit.hp);
        if (damageDealt > 0) {
          this._spawnHitFlash(hitUnit.pos, hitUnit.getCollisionRadius(), { strong: !hitUnit.alive });
          this._spawnDamageNumber(hitUnit.pos, damageDealt, { emphasis: !hitUnit.alive });
        }
        if (wasAlive && !hitUnit.alive) {
          this._onUnitKilled(hitUnit);
          this._pruneDeadUnits();
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

  private _updateDarkProjectiles(dt: number): void {
    if (!this.darkProjectiles.length) {
      return;
    }

    const survivors: DarkProjectile[] = [];
    for (const projectile of this.darkProjectiles) {
      const velocity = projectile.velocity.clone();
      const speed = velocity.length();
      if (speed <= 0) {
        continue;
      }

      const direction = velocity.scale(1 / speed);
      const remaining = projectile.maxDistance - projectile.travelled;
      if (remaining <= 0) {
        continue;
      }

      const step = Math.min(speed * dt, remaining);
      const obstacleDistance = this.world.raycastObstacles(projectile.position, direction, step);
      const travel = Math.min(step, obstacleDistance);
      projectile.position.add(direction.clone().scale(travel));
      projectile.travelled += travel;

      if (obstacleDistance + 0.001 < step) {
        continue;
      }

      let hit = false;
      if (this.knight.hp > 0) {
        const knightRadius = KNIGHT_SIZE / 2;
        if (projectile.position.distanceTo(this.knight.pos) <= knightRadius + projectile.radius) {
          this.knight.hp = Math.max(0, this.knight.hp - projectile.damage);
          hit = true;
        }
      }

      if (!hit) {
        const villager = this._findVillagerHit(projectile.position, projectile.radius);
        if (villager) {
          this.world.damageVillager(villager, projectile.damage);
          hit = true;
        }
      }

      if (hit) {
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

      if (projectile.travelled >= projectile.maxDistance - 0.001) {
        continue;
      }

      survivors.push(projectile);
    }

    this.darkProjectiles = survivors;
  }

  spawnDarkProjectile(options: {
    position: Vector2;
    direction: Vector2;
    damage: number;
    speed: number;
    maxDistance: number;
    radius?: number;
    sourceUnitId: number;
  }): void {
    const direction = options.direction.clone();
    if (direction.lengthSq() === 0) {
      return;
    }
    direction.normalize();
    const velocity = direction.clone().scale(options.speed);
    const projectile: DarkProjectile = {
      id: this.darkProjectileIdCounter++,
      position: options.position.clone(),
      velocity,
      damage: options.damage,
      radius: options.radius ?? ENEMY_PROJECTILE_RADIUS,
      travelled: 0,
      maxDistance: options.maxDistance,
      sourceUnitId: options.sourceUnitId
    };
    this.darkProjectiles.push(projectile);
  }

  private _spawnKnightProjectile(options: {
    position: Vector2;
    velocity: Vector2;
    damage: number;
    source: ItemId;
    pierce?: number;
    effects?: KnightProjectile['effects'];
    tint?: string;
    target?: DarkUnit | null;
  }): void {
    const projectile: KnightProjectile = {
      id: this.knightProjectileIdCounter++,
      position: options.position.clone(),
      velocity: options.velocity.clone(),
      target: options.target ?? null,
      damage: options.damage * (1 + this.weaponDamageBonus),
      source: options.source,
      pierce: options.pierce,
      effects: options.effects,
      tint: options.tint
    };
    this.knightProjectiles.push(projectile);
  }

  private _applyProjectileHit(projectile: KnightProjectile, unit: DarkUnit): void {
    const wasAlive = unit.alive;
    const preHp = unit.hp;
    unit.takeDamage(projectile.damage);
    const damageDealt = Math.max(0, preHp - unit.hp);
    if (damageDealt > 0) {
      this._spawnHitFlash(unit.pos, unit.getCollisionRadius(), { strong: !unit.alive });
      this._spawnDamageNumber(unit.pos, damageDealt, {
        emphasis: !unit.alive || projectile.damage >= 5,
        color: projectile.tint
      });
    }
    if (projectile.effects?.dot) {
      unit.applyDot(projectile.effects.dot.dps, projectile.effects.dot.duration);
    }
    if (projectile.effects?.slow) {
      unit.applySlow(projectile.effects.slow.factor, projectile.effects.slow.duration);
    }
    if (wasAlive && !unit.alive) {
      this._onUnitKilled(unit);
    }
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
      const obstacleDistance = this.world.raycastObstacles(
        projectile.position,
        direction,
        distance,
      );
      if (obstacleDistance + 0.001 < distance) {
        continue;
      }

      projectile.position.add(direction.clone().scale(distance));

      const target = projectile.target;
      let didHit = false;
      if (
        target &&
        target.alive &&
        target.pos.distanceTo(projectile.position) <= target.getCollisionRadius() + 2.5
      ) {
        this._applyProjectileHit(projectile, target);
        didHit = true;
      } else {
        const hitUnit = this._findKnightProjectileHit(projectile);
        if (hitUnit) {
          this._applyProjectileHit(projectile, hitUnit);
          didHit = true;
        }
      }
      if (didHit) {
        if (projectile.pierce && projectile.pierce > 0) {
          projectile.pierce -= 1;
          survivors.push(projectile);
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

  private _findVillagerHit(position: Vector2, radius: number): Villager | null {
    const villages = this.world.getVillages();
    for (const village of villages) {
      for (const villager of village.villagers) {
        if (!villager.alive) {
          continue;
        }
        if (villager.pos.distanceTo(position) <= radius + 3) {
          return villager;
        }
      }
    }
    return null;
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

  private _updateSmokeFields(dt: number): void {
    if (!this.smokeFields.length) {
      return;
    }
    const survivors: SmokeField[] = [];
    for (const field of this.smokeFields) {
      field.timer = Math.max(0, field.timer - dt);
      field.cloakTimer = Math.max(0, field.cloakTimer - dt);
      for (const unit of this.units) {
        if (!unit.alive) {
          continue;
        }
        if (unit.pos.distanceTo(field.position) <= field.radius) {
          unit.applySlow(field.slowFactor, 0.6);
          if (field.cloakTimer > 0) {
            unit.detecting = false;
          }
        }
      }
      if (field.timer > 0) {
        survivors.push(field);
      }
    }
    this.smokeFields = survivors;
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

  private _drawSmokeFields(ctx: CanvasRenderingContext2D): void {
    if (!this.smokeFields.length) {
      return;
    }
    ctx.save();
    for (const field of this.smokeFields) {
      const progress = field.baseDuration > 0 ? field.timer / field.baseDuration : 0;
      const alpha = Math.max(0, Math.min(0.45, progress * 0.45));
      ctx.fillStyle = `rgba(148, 163, 184, ${alpha.toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(field.position.x, field.position.y, field.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private _drawWeaponOrbits(ctx: CanvasRenderingContext2D): void {
    if (!this.weaponOrbitVisuals.length) {
      return;
    }
    ctx.save();
    for (const flame of this.weaponOrbitVisuals) {
      ctx.fillStyle = `rgba(252, 211, 77, ${flame.alpha.toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(flame.position.x, flame.position.y, flame.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private _updateHitFlashes(dt: number): void {
    if (!this.hitFlashes.length) {
      return;
    }
    for (const flash of this.hitFlashes) {
      flash.age += dt;
    }
    this.hitFlashes = this.hitFlashes.filter((flash) => flash.age < flash.duration);
  }

  private _updateDeathParticles(dt: number): void {
    if (!this.deathParticles.length) {
      return;
    }
    for (const particle of this.deathParticles) {
      particle.age += dt;
      particle.position.x += particle.velocity.x * dt;
      particle.position.y += particle.velocity.y * dt;
      particle.velocity.x *= 0.88;
      particle.velocity.y = particle.velocity.y * 0.88 + 120 * dt;
    }
    this.deathParticles = this.deathParticles.filter((particle) => particle.age < particle.lifetime);
  }

  private _updateDamageNumbers(dt: number): void {
    if (!this.damageNumbers.length) {
      return;
    }
    for (const number of this.damageNumbers) {
      number.age += dt;
      number.position.x += number.velocity.x * dt;
      number.position.y += number.velocity.y * dt;
      number.velocity.x *= 0.92;
      number.velocity.y = number.velocity.y * 0.9 + 14 * dt;
    }
    this.damageNumbers = this.damageNumbers.filter((number) => number.age < number.duration);
  }

  private _spawnHitFlash(position: Vector2, radius: number, options: { strong?: boolean } = {}): void {
    const strong = options.strong ?? false;
    const flash: HitFlash = {
      id: this.hitFlashIdCounter++,
      position: position.clone(),
      radius: Math.max(14, radius * (strong ? 1.5 : 1.2)),
      age: 0,
      duration: strong ? 0.3 : 0.2,
      strong
    };
    this.hitFlashes.push(flash);
  }

  private _spawnDeathBurst(unit: DarkUnit): void {
    const appearance = UNIT_APPEARANCE[unit.type];
    const colors = appearance
      ? [appearance.accent, appearance.detail, '#FFECC6']
      : ['#FFECC6', '#FFD4A1'];
    const baseRadius = Math.max(10, unit.getCollisionRadius() * 1.8);
    const count = 9 + Math.floor(Math.random() * 5);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 120;
      const velocity = new Vector2(Math.cos(angle) * speed, Math.sin(angle) * speed - 30);
      const particle: DeathParticle = {
        id: this.deathParticleIdCounter++,
        position: unit.pos.clone(),
        velocity,
        radius: baseRadius * (0.25 + Math.random() * 0.55),
        age: 0,
        lifetime: 0.6 + Math.random() * 0.35,
        color: colors[Math.floor(Math.random() * colors.length)]
      };
      this.deathParticles.push(particle);
    }
  }

  private _spawnDamageNumber(
    position: Vector2,
    amount: number,
    options: { color?: string; emphasis?: boolean } = {}
  ): void {
    if (!Number.isFinite(amount) || amount <= 0) {
      return;
    }
    const emphasis = options.emphasis ?? amount >= 5;
    const color = options.color ?? (emphasis ? '#FFE08A' : '#F6E7C2');
    const entry: DamageNumber = {
      id: this.damageNumberIdCounter++,
      position: position.clone(),
      velocity: new Vector2((Math.random() - 0.5) * 22, -46 - Math.random() * 14),
      text: this._formatDamage(amount),
      amount,
      age: 0,
      duration: emphasis ? 0.95 : 0.75,
      color,
      emphasis
    };
    this.damageNumbers.push(entry);
  }

  private _drawHitFlashes(ctx: CanvasRenderingContext2D): void {
    if (!this.hitFlashes.length) {
      return;
    }
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const flash of this.hitFlashes) {
      const progress = flash.duration > 0 ? flash.age / flash.duration : 1;
      const clamped = Math.max(0, Math.min(1, progress));
      const alpha = (flash.strong ? 0.7 : 0.5) * (1 - clamped);
      if (alpha <= 0) {
        continue;
      }
      const radius = flash.radius * (0.8 + 0.3 * clamped);
      const gradient = ctx.createRadialGradient(
        flash.position.x,
        flash.position.y,
        Math.max(1, radius * 0.15),
        flash.position.x,
        flash.position.y,
        radius
      );
      gradient.addColorStop(0, `rgba(255, 255, 230, ${(alpha * 1.1).toFixed(3)})`);
      gradient.addColorStop(0.45, `rgba(255, 210, 140, ${(alpha * 0.7).toFixed(3)})`);
      gradient.addColorStop(1, 'rgba(255, 140, 80, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(flash.position.x, flash.position.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private _drawDeathParticles(ctx: CanvasRenderingContext2D): void {
    if (!this.deathParticles.length) {
      return;
    }
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const particle of this.deathParticles) {
      const progress = particle.lifetime > 0 ? particle.age / particle.lifetime : 1;
      const clamped = Math.max(0, Math.min(1, progress));
      const alpha = (1 - clamped) * 0.85;
      if (alpha <= 0) {
        continue;
      }
      const radius = particle.radius * (0.9 + 0.4 * (1 - clamped));
      const gradient = ctx.createRadialGradient(
        particle.position.x,
        particle.position.y,
        Math.max(1, radius * 0.2),
        particle.position.x,
        particle.position.y,
        radius
      );
      gradient.addColorStop(0, `rgba(255, 255, 255, ${(alpha * 0.9).toFixed(3)})`);
      gradient.addColorStop(0.5, this._withAlpha(particle.color, alpha * 0.9));
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(particle.position.x, particle.position.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private _drawDamageNumbers(ctx: CanvasRenderingContext2D): void {
    if (!this.damageNumbers.length) {
      return;
    }
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const number of this.damageNumbers) {
      const progress = number.duration > 0 ? number.age / number.duration : 1;
      const clamped = Math.max(0, Math.min(1, progress));
      const alpha = 1 - clamped;
      if (alpha <= 0) {
        continue;
      }
      const scale = number.emphasis ? 1.1 + 0.2 * (1 - clamped) : 1 + 0.12 * (1 - clamped);
      ctx.save();
      ctx.translate(number.position.x, number.position.y);
      ctx.scale(scale, scale);
      ctx.globalAlpha = alpha;
      ctx.font = `${number.emphasis ? '700' : '600'} 12px "Inter", sans-serif`;
      ctx.strokeStyle = 'rgba(17, 24, 39, 0.55)';
      ctx.lineWidth = 2.2 / scale;
      ctx.strokeText(number.text, 0, 0);
      ctx.fillStyle = number.color;
      ctx.fillText(number.text, 0, 0);
      ctx.restore();
    }
    ctx.restore();
  }

  private _withAlpha(color: string, alpha: number): string {
    const normalized = Math.max(0, Math.min(1, alpha));
    if (/^#([0-9a-f]{3}){1,2}$/i.test(color)) {
      let hex = color.slice(1);
      if (hex.length === 3) {
        hex = hex
          .split('')
          .map((char) => char + char)
          .join('');
      }
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${normalized.toFixed(3)})`;
    }
    return `rgba(255, 244, 220, ${normalized.toFixed(3)})`;
  }

  private _formatDamage(amount: number): string {
    const rounded = Math.round(amount);
    if (Math.abs(amount - rounded) < 0.01) {
      return `${rounded}`;
    }
    if (amount >= 1) {
      return amount.toFixed(1).replace(/\.0$/, '');
    }
    return amount.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
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
        const wasAlive = unit.alive;
        const preHp = unit.hp;
        const damage = unit.type === 'scout' ? unit.hp : 1;
        unit.takeDamage(damage);
        if (unit.type === 'tank' && unit.alive) {
          unit.applySlow(SPIKE_TRAP_SLOW_FACTOR, SPIKE_TRAP_SLOW_DURATION);
        }
        const damageDealt = Math.max(0, preHp - unit.hp);
        if (damageDealt > 0) {
          this._spawnHitFlash(unit.pos, unit.getCollisionRadius(), { strong: !unit.alive });
          this._spawnDamageNumber(unit.pos, damageDealt, { emphasis: !unit.alive });
        }
        if (wasAlive && !unit.alive) {
          this._onUnitKilled(unit);
        }
        this._pruneDeadUnits();
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
      this._setBuildError('Not enough supplies for this structure.');
      return false;
    }
    const evaluation = this._evaluatePlacement(type, position);
    if (!evaluation.valid) {
      this._setBuildError(evaluation.reason ?? 'Cannot place that structure here.');
      return false;
    }
    const building = createBuilding(type, position);
    this._initializeBuilding(building);
    this.buildings.push(building);
    this.supplies -= getBuildingDefinition(type).cost;
    this._syncWorldObstacles();
    this._clearBuildError();
    return true;
  }

  private _evaluatePlacement(type: BuildingType, position: Vector2): PlacementEvaluation {
    const { halfWidth, halfHeight } = getBuildingHalfSize(type);
    const width = halfWidth * 2;
    const height = halfHeight * 2;
    const startX = position.x - halfWidth;
    const startY = position.y - halfHeight;
    const cols = Math.max(1, Math.ceil(width / BUILD_PREVIEW_TILE_SIZE));
    const rows = Math.max(1, Math.ceil(height / BUILD_PREVIEW_TILE_SIZE));
    const tiles: PlacementTilePreview[] = [];

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const left = startX + col * BUILD_PREVIEW_TILE_SIZE;
        const top = startY + row * BUILD_PREVIEW_TILE_SIZE;
        const tileWidth = Math.min(BUILD_PREVIEW_TILE_SIZE, startX + width - left);
        const tileHeight = Math.min(BUILD_PREVIEW_TILE_SIZE, startY + height - top);
        tiles.push({ left, top, width: tileWidth, height: tileHeight, valid: true });
      }
    }

    let reason: string | null = null;
    let placementValid = true;
    const applyIssue = (
      triggered: boolean,
      text: string,
      predicate?: (tile: PlacementTilePreview) => boolean
    ) => {
      if (!triggered) {
        return;
      }
      placementValid = false;
      if (!reason) {
        reason = text;
      }
      if (!predicate) {
        for (const tile of tiles) {
          tile.valid = false;
        }
        return;
      }
      let marked = false;
      for (const tile of tiles) {
        if (predicate(tile)) {
          tile.valid = false;
          marked = true;
        }
      }
      if (!marked) {
        for (const tile of tiles) {
          tile.valid = false;
        }
      }
    };

    const buildingLeft = startX;
    const buildingTop = startY;
    const buildingRight = startX + width;
    const buildingBottom = startY + height;

    const boundsIssue =
      buildingLeft < 0 || buildingTop < 0 || buildingRight > WIDTH || buildingBottom > HEIGHT;
    applyIssue(boundsIssue, 'Must build within the valley bounds.', (tile) => {
      const tileRight = tile.left + tile.width;
      const tileBottom = tile.top + tile.height;
      return tile.left < 0 || tile.top < 0 || tileRight > WIDTH || tileBottom > HEIGHT;
    });

    const castleHalf = CASTLE_SIZE / 2 + BUILDING_CONSTRUCTION_RADIUS;
    const castleLeft = CASTLE_POS.x - castleHalf;
    const castleTop = CASTLE_POS.y - castleHalf;
    const castleRight = CASTLE_POS.x + castleHalf;
    const castleBottom = CASTLE_POS.y + castleHalf;
    const castleOverlap = rectanglesOverlap(
      buildingLeft,
      buildingTop,
      buildingRight,
      buildingBottom,
      castleLeft,
      castleTop,
      castleRight,
      castleBottom
    );
    applyIssue(castleOverlap, 'Too close to the castle grounds.', (tile) => {
      const tileRight = tile.left + tile.width;
      const tileBottom = tile.top + tile.height;
      return rectanglesOverlap(tile.left, tile.top, tileRight, tileBottom, castleLeft, castleTop, castleRight, castleBottom);
    });

    const maxHalf = Math.max(halfWidth, halfHeight);
    for (const seal of this.seals) {
      const limit = SEAL_CHANNEL_RADIUS + maxHalf;
      const tooClose = seal.pos.distanceTo(position) <= limit;
      applyIssue(tooClose, 'Interferes with a seal ritual.', (tile) => {
        const tileRight = tile.left + tile.width;
        const tileBottom = tile.top + tile.height;
        return rectangleCircleOverlap(
          tile.left,
          tile.top,
          tileRight,
          tileBottom,
          seal.pos.x,
          seal.pos.y,
          SEAL_CHANNEL_RADIUS
        );
      });
    }

    for (const hut of this.world.getHuts()) {
      const hutHalfW = hut.width / 2;
      const hutHalfH = hut.height / 2;
      const hutLeft = hut.center.x - hutHalfW;
      const hutTop = hut.center.y - hutHalfH;
      const hutRight = hut.center.x + hutHalfW;
      const hutBottom = hut.center.y + hutHalfH;
      const overlap = rectanglesOverlap(
        buildingLeft,
        buildingTop,
        buildingRight,
        buildingBottom,
        hutLeft,
        hutTop,
        hutRight,
        hutBottom
      );
      applyIssue(overlap, 'Cannot block village huts.', (tile) => {
        const tileRight = tile.left + tile.width;
        const tileBottom = tile.top + tile.height;
        return rectanglesOverlap(tile.left, tile.top, tileRight, tileBottom, hutLeft, hutTop, hutRight, hutBottom);
      });
    }

    const treeThreshold = maxHalf + 6;
    const denseTrees: { position: Vector2; radius: number }[] = [];
    for (const tree of this.world.getTrees()) {
      const overlap = rectangleCircleOverlap(
        buildingLeft,
        buildingTop,
        buildingRight,
        buildingBottom,
        tree.position.x,
        tree.position.y,
        tree.radius
      );
      applyIssue(overlap, 'Blocked by a tree.', (tile) => {
        const tileRight = tile.left + tile.width;
        const tileBottom = tile.top + tile.height;
        return rectangleCircleOverlap(
          tile.left,
          tile.top,
          tileRight,
          tileBottom,
          tree.position.x,
          tree.position.y,
          tree.radius
        );
      });
      if (tree.position.distanceTo(position) <= tree.radius + treeThreshold) {
        denseTrees.push({ position: tree.position.clone(), radius: tree.radius });
      }
    }

    if (denseTrees.length >= 3) {
      applyIssue(true, 'Too many trees crowd this site.', (tile) => {
        const tileRight = tile.left + tile.width;
        const tileBottom = tile.top + tile.height;
        return denseTrees.some((tree) =>
          rectangleCircleOverlap(
            tile.left,
            tile.top,
            tileRight,
            tileBottom,
            tree.position.x,
            tree.position.y,
            tree.radius + treeThreshold
          )
        );
      });
    }

    const selfRadius = maxHalf;
    for (const building of this.buildings) {
      const otherSize = getBuildingHalfSize(building.type);
      const otherLeft = building.position.x - otherSize.halfWidth;
      const otherTop = building.position.y - otherSize.halfHeight;
      const otherRight = building.position.x + otherSize.halfWidth;
      const otherBottom = building.position.y + otherSize.halfHeight;
      const overlap = rectanglesOverlap(
        buildingLeft,
        buildingTop,
        buildingRight,
        buildingBottom,
        otherLeft,
        otherTop,
        otherRight,
        otherBottom
      );
      applyIssue(overlap, 'Overlaps with another structure.', (tile) => {
        const tileRight = tile.left + tile.width;
        const tileBottom = tile.top + tile.height;
        return rectanglesOverlap(tile.left, tile.top, tileRight, tileBottom, otherLeft, otherTop, otherRight, otherBottom);
      });
      const distance = position.distanceTo(building.position);
      const otherRadius = Math.max(otherSize.halfWidth, otherSize.halfHeight);
      const spacingIssue = distance < selfRadius + otherRadius + BUILDING_MIN_SPACING;
      applyIssue(spacingIssue, 'Needs more space from nearby structures.', () => true);
    }

    return {
      valid: placementValid,
      reason,
      tiles
    };
  }

  private _drawOverlay(ctx: CanvasRenderingContext2D, text: string, color: string, subtitle: string): void {
    const { width, height } = ctx.canvas;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = color;
    ctx.font = '48px Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, width / 2, height / 2 - 30);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '20px Consolas, monospace';
    ctx.fillText(subtitle, width / 2, height / 2 + 20);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }
}
