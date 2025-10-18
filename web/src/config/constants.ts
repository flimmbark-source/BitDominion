import { Vector2 } from '../math/vector2';
import { hexToRgb } from '../utils/color';

export const WIDTH = 800;
export const HEIGHT = 800;
export const FPS = 60;

export const ARENA_PADDING = 36;

export const CASTLE_POS = new Vector2(WIDTH / 2, HEIGHT / 2);
export const CASTLE_SIZE = 20;
export const CASTLE_WIN_RADIUS = 25;
export const CASTLE_STAY_TIME = 3.0;

export const SHIELD_RING_RADIUS = CASTLE_SIZE / 2 + 30;
export const SHIELD_RING_WIDTH = 6;
export const SHIELD_RING_COLOR = 'rgba(130, 60, 200, 0.35)';
export const SHIELD_FLASH_COLOR = { r: 200, g: 150, b: 255 } as const;
export const SHIELD_FLASH_WIDTH = 8;
export const SHIELD_FLASH_DURATION = 0.35;

export const KNIGHT_SIZE = 6;
export const KNIGHT_ACCEL = 0.5;
export const KNIGHT_FRICTION = 0.9;
export const KNIGHT_STOP_DISTANCE = 5;
export const KNIGHT_HP = 3;

export const MELEE_RANGE = 40;
export const ARC_WIDTH_DEG = 100;
export const SWING_DURATION = 0.25;
export const SWING_COOLDOWN = 0.8;
export const SWING_ARC_POINTS = 16;

export const UNIT_WANDER_INTERVAL: [number, number] = [1.0, 3.0];
export const UNIT_DAMAGE_COOLDOWN = 0.5;
export const UNIT_DETECTION_LERP = 0.15;
export const DETECTION_TINT_LERP = 0.22;

export const MAX_UNITS = 16;
export const DARK_LORD_ENERGY_PER_SEC = 3;
export const DARK_LORD_SPAWN_INTERVAL = 1.5;
export const DARK_LORD_REVEAL_MEMORY = 6.0;
export const PRIEST_REVEAL_RADIUS = 40;
export const PRIEST_REVEAL_WARMUP = 0.6;
export const PRIEST_REVEAL_DURATION = 1.5;
export const PRIEST_REVEAL_SUSPICION = 18;
export const CASTLE_EDGE_SPAWN_RADIUS = 40;
export const TANK_CHASE_PERSIST_DISTANCE = 120;
export const TANK_KNOCKBACK_STRENGTH = 1.3;

export const UNIT_COLORS = {
  scout: { base: '#C82828', alert: '#FF5A5A' },
  tank: { base: '#823E28', alert: '#C85A3C' },
  priest: { base: '#7A2BC8', alert: '#B58CFF' }
} as const;

export const UNIT_STATS = {
  scout: {
    cost: 10,
    minSpeed: 1.0,
    maxSpeed: 1.8,
    detectionRadius: 80,
    maxHp: 1,
    size: 4,
    attackDamage: 1
  },
  tank: {
    cost: 25,
    minSpeed: 0.5,
    maxSpeed: 0.9,
    detectionRadius: 60,
    maxHp: 3,
    size: 5,
    attackDamage: 1.5
  },
  priest: {
    cost: 20,
    minSpeed: 0.8,
    maxSpeed: 1.2,
    detectionRadius: 70,
    maxHp: 2,
    size: 4,
    attackDamage: 1.2
  }
} as const;

export type UnitType = keyof typeof UNIT_STATS;
export type UnitStats = (typeof UNIT_STATS)[UnitType];

export const UNIT_MAX_HALF_SIZE = Math.max(...Object.values(UNIT_STATS).map((stats) => stats.size)) / 2;
export const CHEAPEST_UNIT_COST = Math.min(...Object.values(UNIT_STATS).map((stats) => stats.cost));

export const SEAL_COUNT = 3;
export const SEAL_MIN_CASTLE_DIST = 140;
export const SEAL_MIN_SEPARATION = 80;
export const SEAL_CHANNEL_RADIUS = 25;
export const SEAL_CHANNEL_TIME = 3.0;
export const SEAL_COLOR = '#DCC23C';
export const SEAL_PROGRESS_COLOR = '#FFFFFF';
export const SEAL_RING_RADIUS = 15;
export const SEAL_RING_OFFSET = 22;

export const BACKGROUND_COLOR = '#000000';
export const KNIGHT_COLOR = '#14C814';
export const CASTLE_COLOR = '#8200B4';
export const HUD_COLOR = '#DCDCDC';
export const HP_BAR_WIDTH = 220;
export const HP_BAR_HEIGHT = 16;
export const HP_BAR_BACKGROUND_COLOR = 'rgba(220, 220, 220, 0.2)';
export const HP_BAR_BORDER_COLOR = 'rgba(220, 220, 220, 0.75)';
export const HP_BAR_FILL_COLOR = KNIGHT_COLOR;
export const HP_BAR_TEXT_COLOR = '#061206';
export const ARC_COLOR = '#DCDCDC';
export const VICTORY_COLOR = '#50C878';
export const DEFEAT_COLOR = '#DC3C3C';

export const TREE_COLOR = '#1E5B31';
export const TREE_OUTLINE_COLOR = 'rgba(46, 120, 70, 0.9)';
export const TREE_CANOPY_SHADE = 'rgba(20, 60, 30, 0.42)';
export const HUT_FILL_COLOR = '#9C6D3C';
export const HUT_OUTLINE_COLOR = 'rgba(220, 170, 110, 0.9)';
export const CHEST_CLOSED_COLOR = '#D9B357';
export const CHEST_OPEN_COLOR = '#F2D48A';
export const ROAD_COLOR = '#3A3731';
export const ROAD_EDGE_COLOR = 'rgba(200, 190, 150, 0.2)';
export const VILLAGER_IDLE_COLOR = '#E8DBA9';
export const VILLAGER_ALERT_COLOR = '#FFB86C';
export const VILLAGER_FLEE_COLOR = '#FFA552';

export const CASTLE_COLOR_DEC = hexToRgb(CASTLE_COLOR);

export const PATROL_ANCHOR_COUNT = 6;
export const PATROL_ANCHOR_RADIUS = 280;
export const ANCHOR_SUSPICION_DECAY = 1.5;
export const ANCHOR_SUSPICION_MAX = 30;
export const ANCHOR_SIGHTING_BONUS = 10;
export const ANCHOR_SEAL_CHANNEL_RATE = 4;

export const KNIGHT_SIGHT_CONFIRM_TIME = 0.5;
export const SEARCH_DURATION = 4;
export const SEARCH_SPIN_SPEED = Math.PI * 1.6;
export const SEARCH_RADIUS_GROWTH = 45;

export const NOISE_PING_DURATION = 0.4;
export const NOISE_PING_MIN_RADIUS = 20;
export const NOISE_PING_MAX_RADIUS = 60;
export const NOISE_SPRINT_WINDOW = 0.2;
export const NOISE_INVESTIGATE_RADIUS = 160;
export const NOISE_INVESTIGATE_TIME = 2;
export const NOISE_ATTACK_STRENGTH = 12;
export const NOISE_SEAL_STRENGTH = 10;
export const NOISE_SPRINT_STRENGTH = 6;
export const NOISE_VILLAGER_ALARM_STRENGTH = 9;
export const NOISE_CHEST_STRENGTH = 16;

export const TREE_STEER_STRENGTH = 18;
export const HUT_STEER_STRENGTH = 22;
export const VILLAGE_RADIUS = 70;
export const VILLAGE_ALERT_RADIUS = 75;
export const VILLAGE_FLEE_RADIUS = 90;
export const VILLAGER_IDLE_RADIUS = 24;
export const VILLAGER_SPEED = 32;
export const ROAD_WIDTH = 18;
export const CHEST_OPEN_RADIUS = 14;
export const LOS_DEBUG_TTL = 0.3;
