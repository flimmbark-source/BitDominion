import math
import random
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

import pygame


# --- Global Constants ---
WIDTH, HEIGHT = 900, 900
FPS = 60
CASTLE_POS = pygame.math.Vector2(WIDTH / 2, HEIGHT / 2)
CASTLE_RADIUS = 40
CASTLE_SHIELD_EXTRA = 30
CASTLE_WIN_RADIUS = 25
CASTLE_STAY_TIME = 3.0

KNIGHT_SIZE = 10
KNIGHT_ACCEL = 480.0  # pixels per second^2
KNIGHT_MAX_SPEED = 220.0
KNIGHT_FRICTION = 6.0
KNIGHT_HP = 5
KNIGHT_COLLISION_RADIUS = 14
KNIGHT_SPRINT_CLICK_INTERVAL = 0.22

SWING_RANGE = 80
SWING_ARC_DEG = 110
SWING_DURATION = 0.25
SWING_COOLDOWN = 0.55
SWING_ARC_POINTS = 24

SEAL_COUNT = 3
SEAL_MIN_CASTLE_DIST = 140
SEAL_MIN_SEPARATION = 80
SEAL_CHANNEL_RADIUS = 25
SEAL_CHANNEL_TIME = 3.0

FOREST_PATCH_RANGE = (3, 5)
TREES_PER_PATCH_RANGE = (20, 40)
TREE_RADIUS_RANGE = (6, 10)
FOREST_CLUSTER_RADIUS = 70
FOREST_CANOPY_EXTRA = 16
FOREST_CANOPY_TREE_THRESHOLD = 3

VILLAGE_COUNT_RANGE = (2, 3)
VILLAGE_MIN_CASTLE_DIST = 180
VILLAGE_MIN_SEPARATION = 140
VILLAGE_HUT_COUNT_RANGE = (4, 8)
VILLAGE_RADIUS = 90
HUT_SIZE = 10
WELL_SIZE = 8
CHEST_SIZE = 6
SHARD_SIZE = 3
WELL_HEAL_TIME = 1.5
WELL_HEAL_RADIUS = 20
CHEST_OPEN_TIME = 0.8
CHEST_INTERACT_RADIUS = 18
SHARD_COLLECT_RADIUS = 12
WELL_NOISE_STRENGTH = 0.7
CHEST_NOISE_STRENGTH = 1.4
VILLAGER_ALARM_NOISE_STRENGTH = 0.9

ROAD_WIDTH = 4
ROAD_SPEED_MULT = 1.15
KNIGHT_CANOPY_SPEED_MULT = 0.9
ROAD_SAMPLING_RADIUS = 6

VILLAGER_IDLE_RADIUS = 12
VILLAGER_SPEED = 110.0
VILLAGER_FEAR_RADIUS = 70
VILLAGER_ARC_RADIUS = 80
VILLAGER_ROAD_FLEE_TIME = 3.0
VILLAGER_RESPAWN_INTERVAL = 28.0
VILLAGER_RESPAWN_VARIANCE = 0.45
VILLAGER_MANA_REWARD = 18.0

LOS_SAMPLE_STEP = 8

ARENA_PADDING = 40

# Units / Macro AI
MAX_UNITS = 18
ENERGY_PER_SEC = 3.0
SPAWN_INTERVAL = 1.5
UNIT_VILLAGER_HUNT_RADIUS = 320.0
ENEMY_VILLAGER_ATTACK_COOLDOWN = 0.8

UNIT_DATA = {
    "SCOUT": {
        "size": 4,
        "speed": 150.0,
        "hp": 1,
        "detection": 80.0,
        "cost": 10,
        "color": (235, 200, 90),
    },
    "TANK": {
        "size": 5,
        "speed": 95.0,
        "hp": 3,
        "detection": 60.0,
        "cost": 25,
        "color": (210, 80, 70),
    },
    "PRIEST": {
        "size": 4,
        "speed": 120.0,
        "hp": 2,
        "detection": 70.0,
        "cost": 20,
        "color": (210, 210, 255),
    },
}

PRIEST_REVEAL_RADIUS = 40.0
PRIEST_REVEAL_TIME = 0.6
PRIEST_REVEAL_DURATION = 1.5
PRIEST_ATTACK_RANGE = 230.0
PRIEST_ATTACK_COOLDOWN = 1.8
PRIEST_ATTACK_DAMAGE = 0.6

SPIRAL_SEARCH_TIME = 4.0
SPIRAL_RADIUS_SPEED = 35.0
SPIRAL_ANGULAR_SPEED = 3.0

NOISE_RING_DURATION = 0.4
NOISE_RING_MAX_RADIUS = 60
NOISE_RING_MIN_RADIUS = 20

SUS_DECAY_PER_SEC = 0.25
SUS_NOISE_SCALE = 80.0
SUS_SEAL_BONUS = 25.0
SUS_REVEAL_BONUS = 60.0

DEBUG_TOGGLE_KEY = pygame.K_F1
HUD_FONT_NAME = "arial"

random.seed(7)


@dataclass
class Tree:
    pos: pygame.math.Vector2
    radius: float


@dataclass
class ForestPatch:
    center: pygame.math.Vector2
    trees: List[Tree]

    def __post_init__(self) -> None:
        self.max_radius = max((tree.pos - self.center).length() + tree.radius for tree in self.trees)
        min_x = min(tree.pos.x - tree.radius for tree in self.trees)
        max_x = max(tree.pos.x + tree.radius for tree in self.trees)
        min_y = min(tree.pos.y - tree.radius for tree in self.trees)
        max_y = max(tree.pos.y + tree.radius for tree in self.trees)
        self.bounds = pygame.Rect(int(min_x), int(min_y), int(max_x - min_x) + 1, int(max_y - min_y) + 1)

    def under_canopy(self, pos: pygame.math.Vector2) -> bool:
        if (pos - self.center).length() > self.max_radius + FOREST_CANOPY_EXTRA:
            return False
        count = 0
        for tree in self.trees:
            if tree.pos.distance_to(pos) <= tree.radius + FOREST_CANOPY_EXTRA:
                count += 1
                if count >= FOREST_CANOPY_TREE_THRESHOLD:
                    return True
        return False


@dataclass
class Hut:
    center: pygame.math.Vector2

    @property
    def rect(self) -> pygame.Rect:
        rect = pygame.Rect(0, 0, HUT_SIZE, HUT_SIZE)
        rect.center = self.center.xy
        return rect


@dataclass
class Well:
    pos: pygame.math.Vector2
    timer: float = 0.0


@dataclass
class Chest:
    pos: pygame.math.Vector2
    open_timer: float = 0.0
    opened: bool = False


@dataclass
class ValorShard:
    pos: pygame.math.Vector2
    timer: float = 0.0


@dataclass
class Villager:
    pos: pygame.math.Vector2
    home: pygame.math.Vector2
    village: "Village"
    state: str = "idle"
    wander_target: Optional[pygame.math.Vector2] = None
    wander_timer: float = 0.0
    flee_direction: Optional[pygame.math.Vector2] = None
    alarmed: bool = False
    road_timer: float = 0.0
    calm_timer: float = 0.0
    was_on_road: bool = False
    hp: int = 1
    alive: bool = True

    def update(
        self,
        dt: float,
        world: "World",
        knight: "Knight",
        threats: List["Unit"],
        game: "Game",
    ) -> None:
        if not self.alive:
            return
        nearest_threat: Optional[pygame.math.Vector2] = None
        nearest_dist = float("inf")
        for threat in threats:
            if not threat.alive:
                continue
            dist = threat.pos.distance_to(self.pos)
            if dist < nearest_dist:
                nearest_dist = dist
                nearest_threat = threat.pos
        knight_threat = None
        if knight.swing_timer > 0.0 and knight.pos.distance_to(self.pos) <= VILLAGER_ARC_RADIUS:
            knight_threat = knight.pos

        danger = False
        danger_pos: Optional[pygame.math.Vector2] = None
        if nearest_dist <= VILLAGER_FEAR_RADIUS:
            danger = True
            danger_pos = nearest_threat
        elif knight_threat is not None:
            danger = True
            danger_pos = knight_threat

        if danger and self.state != "flee":
            self.start_flee(danger_pos, world, game)

        if self.state == "flee":
            self.flee_update(dt, world, danger_pos)
        else:
            if danger and self.state != "flee":
                self.start_flee(danger_pos, world, game)
            self.idle_update(dt, world)

        world.resolve_circle_collisions(self.pos, 5.0)
        world.clamp_to_bounds(self.pos, 4.0)

        if self.state == "flee":
            self.calm_timer = 0.0
        else:
            if self.alarmed:
                self.calm_timer += dt
                if self.calm_timer >= 1.5:
                    self.alarmed = False

    def start_flee(
        self,
        threat_pos: Optional[pygame.math.Vector2],
        world: "World",
        game: "Game",
    ) -> None:
        self.state = "flee"
        base_dir = pygame.math.Vector2()
        if threat_pos is not None:
            base_dir = self.pos - threat_pos
        if base_dir.length_squared() == 0:
            base_dir = self.pos - self.village.center
        if base_dir.length_squared() == 0:
            base_dir = pygame.math.Vector2(1, 0)
        base_dir.normalize_ip()
        self.flee_direction = base_dir
        self.alarmed = True
        self.road_timer = 0.0
        self.calm_timer = 0.0
        self.was_on_road = False
        game.spawn_noise(self.pos, VILLAGER_ALARM_NOISE_STRENGTH)

    def flee_update(
        self,
        dt: float,
        world: "World",
        danger_pos: Optional[pygame.math.Vector2],
    ) -> None:
        speed = VILLAGER_SPEED * world.get_speed_multiplier(self.pos, "villager")
        direction = self.flee_direction or pygame.math.Vector2()
        on_road = world.is_on_road(self.pos)
        if on_road and not self.was_on_road:
            road_dir, _ = world.nearest_road_direction(self.pos, danger_pos)
            if road_dir.length_squared() > 0:
                direction = road_dir
                self.flee_direction = road_dir
            self.road_timer = VILLAGER_ROAD_FLEE_TIME
        if self.road_timer > 0.0:
            self.road_timer = max(0.0, self.road_timer - dt)
        if not on_road and self.road_timer <= 0.0:
            center_dir = self.village.center - self.pos
            if center_dir.length_squared() > 0:
                center_dir.normalize_ip()
                direction = center_dir
        if direction.length_squared() == 0:
            direction = pygame.math.Vector2(1, 0)
        self.pos += direction * speed * dt
        if not on_road and self.road_timer <= 0.0 and danger_pos is None:
            self.state = "idle"
        self.was_on_road = on_road

    def idle_update(self, dt: float, world: "World") -> None:
        self.state = "idle"
        if self.wander_timer <= 0.0 or self.wander_target is None:
            angle = random.uniform(0, 2 * math.pi)
            radius = random.uniform(0, VILLAGER_IDLE_RADIUS)
            offset = pygame.math.Vector2(math.cos(angle), math.sin(angle)) * radius
            self.wander_target = self.home + offset
            self.wander_timer = random.uniform(1.0, 2.5)
        else:
            self.wander_timer -= dt
        target = self.wander_target or self.home
        direction = target - self.pos
        if direction.length_squared() > 4:
            direction.normalize_ip()
            self.pos += direction * VILLAGER_SPEED * 0.35 * dt
        else:
            self.wander_target = None

    def draw(self, surface: pygame.Surface) -> None:
        if not self.alive:
            return
        rect = pygame.Rect(0, 0, 3, 3)
        rect.center = self.pos.xy
        color = (240, 230, 170) if not self.alarmed else (255, 190, 120)
        pygame.draw.rect(surface, color, rect)


@dataclass
class Village:
    center: pygame.math.Vector2
    huts: List[Hut]
    well: Well
    chests: List[Chest]
    villagers: List[Villager]
    max_population: int
    spawn_timer: float = 0.0
    alarm_active: bool = False


@dataclass
class NoisePing:
    pos: pygame.math.Vector2
    strength: float = 1.0
    timer: float = 0.0

    def update(self, dt: float) -> bool:
        self.timer += dt
        return self.timer >= NOISE_RING_DURATION

    def draw(self, surface: pygame.Surface) -> None:
        t = min(1.0, self.timer / NOISE_RING_DURATION)
        radius_scale = 0.7 + 0.6 * self.strength
        radius = (NOISE_RING_MIN_RADIUS + (NOISE_RING_MAX_RADIUS - NOISE_RING_MIN_RADIUS) * t) * radius_scale
        alpha = max(0, int(180 * (1.0 - t)))
        color = (255, 150, 100, alpha)
        self._draw_circle_alpha(surface, color, self.pos, int(radius))

    @staticmethod
    def _draw_circle_alpha(surface: pygame.Surface, color: Tuple[int, int, int, int], pos: pygame.math.Vector2, radius: int) -> None:
        temp = pygame.Surface((radius * 2, radius * 2), pygame.SRCALPHA)
        pygame.draw.circle(temp, color, (radius, radius), radius, 2)
        surface.blit(temp, (pos.x - radius, pos.y - radius))


@dataclass
class PulseEffect:
    pos: pygame.math.Vector2
    timer: float = 0.0
    duration: float = 0.5

    def update(self, dt: float) -> bool:
        self.timer += dt
        return self.timer >= self.duration

    def draw(self, surface: pygame.Surface) -> None:
        t = min(1.0, self.timer / self.duration)
        radius = 16 + 38 * t
        alpha = max(0, int(200 * (1.0 - t)))
        NoisePing._draw_circle_alpha(surface, (255, 230, 120, alpha), self.pos, int(radius))


class World:
    def __init__(self) -> None:
        self.forest_patches: List[ForestPatch] = self._generate_forests()
        self.trees: List[Tree] = [tree for patch in self.forest_patches for tree in patch.trees]
        self.villages: List[Village] = []
        self.villages = self._generate_villages()
        self.road_surface = pygame.Surface((WIDTH, HEIGHT), pygame.SRCALPHA)
        self.road_surface.fill((0, 0, 0, 0))
        self.road_segments: List[Tuple[pygame.math.Vector2, pygame.math.Vector2]] = []
        self._generate_roads()
        self.road_mask = pygame.mask.from_surface(self.road_surface)
        self.canopy_overlay = self._build_canopy_overlay()
        self.valor_shards: List[ValorShard] = []

    # --- Generation helpers ---
    def _generate_forests(self) -> List[ForestPatch]:
        patches: List[ForestPatch] = []
        count = random.randint(*FOREST_PATCH_RANGE)
        for _ in range(count):
            center = pygame.math.Vector2(
                random.uniform(ARENA_PADDING + 60, WIDTH - ARENA_PADDING - 60),
                random.uniform(ARENA_PADDING + 60, HEIGHT - ARENA_PADDING - 60),
            )
            tree_count = random.randint(*TREES_PER_PATCH_RANGE)
            trees: List[Tree] = []
            for _ in range(tree_count):
                angle = random.uniform(0, 2 * math.pi)
                radius = random.uniform(8, FOREST_CLUSTER_RADIUS)
                offset = pygame.math.Vector2(math.cos(angle), math.sin(angle)) * radius
                offset += pygame.math.Vector2(random.gauss(0, 12), random.gauss(0, 12))
                pos = center + offset
                pos.x = max(ARENA_PADDING, min(WIDTH - ARENA_PADDING, pos.x))
                pos.y = max(ARENA_PADDING, min(HEIGHT - ARENA_PADDING, pos.y))
                tree_radius = random.uniform(*TREE_RADIUS_RANGE)
                trees.append(Tree(pos, tree_radius))
            patches.append(ForestPatch(center, trees))
        return patches

    def _generate_villages(self) -> List[Village]:
        villages: List[Village] = []
        desired = random.randint(*VILLAGE_COUNT_RANGE)
        attempts = 0
        while len(villages) < desired and attempts < 400:
            attempts += 1
            center = pygame.math.Vector2(
                random.uniform(ARENA_PADDING + VILLAGE_RADIUS, WIDTH - ARENA_PADDING - VILLAGE_RADIUS),
                random.uniform(ARENA_PADDING + VILLAGE_RADIUS, HEIGHT - ARENA_PADDING - VILLAGE_RADIUS),
            )
            if center.distance_to(CASTLE_POS) < VILLAGE_MIN_CASTLE_DIST:
                continue
            if any(center.distance_to(other.center) < VILLAGE_MIN_SEPARATION for other in villages):
                continue
            if any(tree.pos.distance_to(center) < tree.radius + 40 for tree in self.trees):
                continue
            huts: List[Hut] = []
            hut_target = random.randint(*VILLAGE_HUT_COUNT_RANGE)
            hut_attempts = 0
            while len(huts) < hut_target and hut_attempts < 250:
                hut_attempts += 1
                angle = random.uniform(0, 2 * math.pi)
                radius = random.uniform(18, VILLAGE_RADIUS)
                offset = pygame.math.Vector2(math.cos(angle), math.sin(angle)) * radius
                candidate = center + offset
                if not self._within_bounds(candidate, HUT_SIZE):
                    continue
                if candidate.distance_to(CASTLE_POS) < VILLAGE_MIN_CASTLE_DIST - 20:
                    continue
                if any(candidate.distance_to(hut.center) < HUT_SIZE * 1.8 for hut in huts):
                    continue
                if any(tree.pos.distance_to(candidate) < tree.radius + 18 for tree in self.trees):
                    continue
                huts.append(Hut(candidate))
            if len(huts) < 4:
                continue
            well_pos = self._find_clear_point(center, 14, 34, villages, huts)
            if well_pos is None:
                continue
            chest_count = random.randint(1, 2)
            chests: List[Chest] = []
            for _ in range(chest_count):
                chest_pos = self._find_clear_point(center, 20, VILLAGE_RADIUS, villages, huts, extra=16, chests=chests)
                if chest_pos is not None:
                    chests.append(Chest(chest_pos))
            if not chests:
                continue
            villagers_count = random.randint(3, 6)
            village = Village(
                center,
                huts,
                Well(well_pos),
                chests,
                villagers=[],
                max_population=villagers_count,
            )
            for _ in range(villagers_count):
                hut = random.choice(huts)
                spawn = pygame.math.Vector2(hut.center)
                village.villagers.append(Villager(spawn.copy(), spawn.copy(), village))
            spawn_variation = random.uniform(1.0 - VILLAGER_RESPAWN_VARIANCE, 1.0 + VILLAGER_RESPAWN_VARIANCE)
            village.spawn_timer = VILLAGER_RESPAWN_INTERVAL * spawn_variation
            villages.append(village)
        return villages

    def _find_clear_point(
        self,
        origin: pygame.math.Vector2,
        min_radius: float,
        max_radius: float,
        villages: Optional[List[Village]] = None,
        huts: Optional[List[Hut]] = None,
        extra: float = 12,
        chests: Optional[List[Chest]] = None,
    ) -> Optional[pygame.math.Vector2]:
        for _ in range(80):
            angle = random.uniform(0, 2 * math.pi)
            radius = random.uniform(min_radius, max_radius)
            pos = origin + pygame.math.Vector2(math.cos(angle), math.sin(angle)) * radius
            if not self._within_bounds(pos, extra):
                continue
            if not self.is_clear(pos, extra, villages):
                continue
            if huts and any(hut.rect.inflate(extra * 2, extra * 2).collidepoint(pos.xy) for hut in huts):
                continue
            if chests and any(pygame.math.Vector2(chest.pos).distance_to(pos) < extra for chest in chests):
                continue
            return pos
        return None

    def _within_bounds(self, pos: pygame.math.Vector2, padding: float) -> bool:
        return (
            ARENA_PADDING + padding <= pos.x <= WIDTH - ARENA_PADDING - padding
            and ARENA_PADDING + padding <= pos.y <= HEIGHT - ARENA_PADDING - padding
        )

    def is_clear(
        self,
        pos: pygame.math.Vector2,
        clearance: float,
        villages: Optional[List[Village]] = None,
    ) -> bool:
        for tree in self.trees:
            if tree.pos.distance_to(pos) < tree.radius + clearance:
                return False
        check_villages = villages if villages is not None else self.villages
        for village in check_villages:
            if pos.distance_to(village.center) < clearance + 30:
                return False
            for hut in village.huts:
                if hut.rect.inflate(clearance * 2, clearance * 2).collidepoint(pos.xy):
                    return False
        for start, end in self.road_segments:
            if self._distance_to_segment(pos, start, end) <= ROAD_WIDTH / 2 + clearance:
                return False
        return True

    @staticmethod
    def _distance_to_segment(pos: pygame.math.Vector2, start: pygame.math.Vector2, end: pygame.math.Vector2) -> float:
        seg = end - start
        length_sq = seg.length_squared()
        if length_sq == 0:
            return pos.distance_to(start)
        t = max(0.0, min(1.0, (pos - start).dot(seg) / length_sq))
        projection = start + seg * t
        return pos.distance_to(projection)

    def _generate_roads(self) -> None:
        castle_center = CASTLE_POS
        for village in self.villages:
            self._add_road(castle_center, village.center)
        for i, village in enumerate(self.villages):
            for other in self.villages[i + 1 :]:
                if village.center.distance_to(other.center) <= VILLAGE_MIN_SEPARATION * 1.3:
                    self._add_road(village.center, other.center)
        self.road_mask = pygame.mask.from_surface(self.road_surface)

    def _add_road(self, start: pygame.math.Vector2, end: pygame.math.Vector2) -> None:
        segment = (start.copy(), end.copy())
        self.road_segments.append(segment)
        pygame.draw.line(self.road_surface, (90, 90, 90, 255), start.xy, end.xy, ROAD_WIDTH)

    def _build_canopy_overlay(self) -> pygame.Surface:
        overlay = pygame.Surface((WIDTH, HEIGHT), pygame.SRCALPHA)
        for patch in self.forest_patches:
            for tree in patch.trees:
                pygame.draw.circle(overlay, (10, 60, 20, 90), tree.pos.xy, int(tree.radius + FOREST_CANOPY_EXTRA))
        return overlay

    # --- Utility helpers ---
    def update(self, dt: float, knight: "Knight", units: List["Unit"], game: "Game") -> None:
        for village in self.villages:
            village.villagers = [v for v in village.villagers if v.alive]
            self._update_population(village, dt)
            for villager in list(village.villagers):
                villager.update(dt, self, knight, units, game)
            village.alarm_active = any(v.alarmed for v in village.villagers)
            self._update_well(village, knight, game, dt)
            self._update_chests(village, knight, game, dt)
        for shard in list(self.valor_shards):
            shard.timer += dt
            if knight.pos.distance_to(shard.pos) <= SHARD_COLLECT_RADIUS:
                knight.collect_valor_shard()
                self.valor_shards.remove(shard)

    def _update_well(self, village: Village, knight: "Knight", game: "Game", dt: float) -> None:
        distance = knight.pos.distance_to(village.well.pos)
        if distance <= WELL_HEAL_RADIUS and knight.vel.length() < 6:
            village.well.timer += dt
            if village.well.timer >= WELL_HEAL_TIME and knight.hp < KNIGHT_HP:
                village.well.timer = 0.0
                knight.hp = min(KNIGHT_HP, knight.hp + 1)
                game.spawn_noise(village.well.pos, WELL_NOISE_STRENGTH)
        else:
            village.well.timer = max(0.0, village.well.timer - dt * 0.5)

    def _update_chests(self, village: Village, knight: "Knight", game: "Game", dt: float) -> None:
        for chest in village.chests:
            if chest.opened:
                continue
            distance = knight.pos.distance_to(chest.pos)
            if distance <= CHEST_INTERACT_RADIUS:
                chest.open_timer += dt
                if chest.open_timer >= CHEST_OPEN_TIME:
                    chest.opened = True
                    game.spawn_noise(chest.pos, CHEST_NOISE_STRENGTH)
                    game.anchors.boost_sector(chest.pos, 14.0)
                    self.valor_shards.append(ValorShard(chest.pos.copy()))
            else:
                chest.open_timer = max(0.0, chest.open_timer - dt * 0.5)

    def _update_population(self, village: Village, dt: float) -> None:
        alive_villagers = [v for v in village.villagers if v.alive]
        if len(alive_villagers) < village.max_population:
            village.spawn_timer = max(0.0, village.spawn_timer - dt)
            if village.spawn_timer <= 0.0:
                spawned = self._spawn_villager(village)
                if spawned is not None:
                    alive_villagers.append(spawned)
                variation = random.uniform(1.0 - VILLAGER_RESPAWN_VARIANCE, 1.0 + VILLAGER_RESPAWN_VARIANCE)
                village.spawn_timer = VILLAGER_RESPAWN_INTERVAL * variation
        else:
            village.spawn_timer = min(
                VILLAGER_RESPAWN_INTERVAL,
                village.spawn_timer + dt * 0.5,
            )
        village.villagers = alive_villagers

    def _spawn_villager(self, village: Village) -> Optional[Villager]:
        if not village.huts:
            return None
        hut = random.choice(village.huts)
        spawn = pygame.math.Vector2(hut.center)
        villager = Villager(spawn.copy(), spawn.copy(), village)
        return villager

    def draw_base(self, surface: pygame.Surface) -> None:
        for patch in self.forest_patches:
            for tree in patch.trees:
                pygame.draw.circle(surface, (24, 70, 34), tree.pos.xy, int(tree.radius))
        surface.blit(self.road_surface, (0, 0))
        for village in self.villages:
            for hut in village.huts:
                pygame.draw.rect(surface, (140, 90, 60), hut.rect)
            well_rect = pygame.Rect(0, 0, WELL_SIZE, WELL_SIZE)
            well_rect.center = village.well.pos.xy
            pygame.draw.rect(surface, (70, 140, 200), well_rect)
            for chest in village.chests:
                rect = pygame.Rect(0, 0, CHEST_SIZE, CHEST_SIZE)
                rect.center = chest.pos.xy
                color = (200, 170, 60) if not chest.opened else (160, 130, 50)
                pygame.draw.rect(surface, color, rect)
            if village.alarm_active:
                points = [
                    (village.center.x, village.center.y - 18),
                    (village.center.x - 6, village.center.y - 6),
                    (village.center.x + 6, village.center.y - 6),
                ]
                pygame.draw.polygon(surface, (200, 30, 30), points)
        for shard in self.valor_shards:
            rect = pygame.Rect(0, 0, SHARD_SIZE, SHARD_SIZE)
            rect.center = shard.pos.xy
            color = (220, 220, 240) if int(shard.timer * 6) % 2 == 0 else (255, 255, 255)
            pygame.draw.rect(surface, color, rect)
        for village in self.villages:
            for villager in village.villagers:
                if not villager.alive:
                    continue
                villager.draw(surface)

    def draw_canopy(self, surface: pygame.Surface) -> None:
        surface.blit(self.canopy_overlay, (0, 0))

    def draw_debug(self, surface: pygame.Surface) -> None:
        for patch in self.forest_patches:
            for tree in patch.trees:
                pygame.draw.circle(surface, (40, 160, 70), tree.pos.xy, int(tree.radius), 1)
        for village in self.villages:
            pygame.draw.circle(surface, (240, 120, 120), village.center.xy, 4)
            for hut in village.huts:
                pygame.draw.rect(surface, (220, 160, 120), hut.rect, 1)
        for start, end in self.road_segments:
            pygame.draw.line(surface, (150, 150, 150), start.xy, end.xy, 1)

    def resolve_circle_collisions(
        self,
        pos: pygame.math.Vector2,
        radius: float,
        velocity: Optional[pygame.math.Vector2] = None,
    ) -> None:
        for tree in self.trees:
            delta = pos - tree.pos
            dist = delta.length()
            overlap = radius + tree.radius - dist
            if overlap > 0:
                if dist == 0:
                    delta = pygame.math.Vector2(random.uniform(-1, 1), random.uniform(-1, 1))
                    dist = delta.length()
                delta.scale_to_length(overlap + 0.1)
                pos += delta
                if velocity is not None:
                    velocity -= velocity.project(delta)
        for village in self.villages:
            for hut in village.huts:
                rect = hut.rect.inflate(radius * 2, radius * 2)
                if rect.collidepoint(pos.xy):
                    closest = pygame.math.Vector2(
                        max(rect.left + radius, min(rect.right - radius, pos.x)),
                        max(rect.top + radius, min(rect.bottom - radius, pos.y)),
                    )
                    push = pos - closest
                    if push.length_squared() == 0:
                        push = pygame.math.Vector2(1, 0)
                    push.scale_to_length(radius)
                    pos.update(closest.x + push.x, closest.y + push.y)
                    if velocity is not None:
                        velocity -= velocity.project(push)

    def clamp_to_bounds(self, pos: pygame.math.Vector2, radius: float) -> None:
        pos.x = max(ARENA_PADDING + radius, min(WIDTH - ARENA_PADDING - radius, pos.x))
        pos.y = max(ARENA_PADDING + radius, min(HEIGHT - ARENA_PADDING - radius, pos.y))

    def is_on_road(self, pos: pygame.math.Vector2) -> bool:
        x = int(pos.x)
        y = int(pos.y)
        if 0 <= x < self.road_mask.get_size()[0] and 0 <= y < self.road_mask.get_size()[1]:
            return self.road_mask.get_at((x, y))
        return False

    def get_speed_multiplier(self, pos: pygame.math.Vector2, entity: str) -> float:
        if self.is_on_road(pos):
            return ROAD_SPEED_MULT
        if entity == "knight" and self.knight_under_canopy(pos):
            return KNIGHT_CANOPY_SPEED_MULT
        return 1.0

    def knight_under_canopy(self, pos: pygame.math.Vector2) -> bool:
        return any(patch.under_canopy(pos) for patch in self.forest_patches)

    def nearest_road_direction(
        self, pos: pygame.math.Vector2, away_from: Optional[pygame.math.Vector2]
    ) -> Tuple[pygame.math.Vector2, Optional[pygame.math.Vector2]]:
        best_dist = float("inf")
        best_seg: Optional[Tuple[pygame.math.Vector2, pygame.math.Vector2]] = None
        best_point: Optional[pygame.math.Vector2] = None
        for start, end in self.road_segments:
            seg_vec = end - start
            seg_len_sq = seg_vec.length_squared()
            if seg_len_sq == 0:
                continue
            t = max(0.0, min(1.0, (pos - start).dot(seg_vec) / seg_len_sq))
            point = start + seg_vec * t
            dist = pos.distance_to(point)
            if dist < best_dist:
                best_dist = dist
                best_seg = (start, end)
                best_point = point
        if best_seg is None:
            return pygame.math.Vector2(), None
        direction = (best_seg[1] - best_seg[0])
        if direction.length_squared() > 0:
            direction.normalize_ip()
            if away_from is not None:
                if (pos + direction * 10).distance_to(away_from) < (pos - direction * 10).distance_to(away_from):
                    direction = -direction
        return direction, best_point

    def line_blocked(self, start: pygame.math.Vector2, end: pygame.math.Vector2) -> bool:
        min_x = min(start.x, end.x) - 10
        max_x = max(start.x, end.x) + 10
        min_y = min(start.y, end.y) - 10
        max_y = max(start.y, end.y) + 10
        line_rect = pygame.Rect(int(min_x), int(min_y), int(max_x - min_x) + 1, int(max_y - min_y) + 1)
        for patch in self.forest_patches:
            if not patch.bounds.colliderect(line_rect):
                continue
            for tree in patch.trees:
                if self._line_circle_intersection(start, end, tree.pos, tree.radius):
                    return True
        return False

    @staticmethod
    def _line_circle_intersection(
        start: pygame.math.Vector2,
        end: pygame.math.Vector2,
        center: pygame.math.Vector2,
        radius: float,
    ) -> bool:
        d = end - start
        f = start - center
        a = d.dot(d)
        b = 2 * f.dot(d)
        c = f.dot(f) - radius * radius
        discriminant = b * b - 4 * a * c
        if discriminant < 0:
            return False
        discriminant = math.sqrt(discriminant)
        t1 = (-b - discriminant) / (2 * a)
        t2 = (-b + discriminant) / (2 * a)
        return (0 <= t1 <= 1) or (0 <= t2 <= 1)

    def line_clear(
        self,
        start: pygame.math.Vector2,
        end: pygame.math.Vector2,
        debug_lines: Optional[List[Tuple[Tuple[float, float], Tuple[float, float]]]] = None,
    ) -> bool:
        blocked = self.line_blocked(start, end)
        if not blocked and debug_lines is not None:
            debug_lines.append((start.xy, end.xy))
        return not blocked

    def any_village_alarmed(self) -> bool:
        return any(village.alarm_active for village in self.villages)

    def get_alarm_focus(self) -> Optional[pygame.math.Vector2]:
        for village in self.villages:
            if village.alarm_active:
                return village.center.copy()
        return None

    def nearest_villager(
        self, pos: pygame.math.Vector2, max_distance: Optional[float] = None
    ) -> Optional[Villager]:
        closest: Optional[Villager] = None
        closest_dist = float("inf")
        for village in self.villages:
            for villager in village.villagers:
                if not villager.alive:
                    continue
                dist = villager.pos.distance_to(pos)
                if max_distance is not None and dist > max_distance:
                    continue
                if dist < closest_dist:
                    closest_dist = dist
                    closest = villager
        return closest

    def villager_counts(self) -> Tuple[int, int]:
        total = 0
        alarmed = 0
        for village in self.villages:
            total += sum(1 for v in village.villagers if v.alive)
            alarmed += sum(1 for v in village.villagers if v.alive and v.alarmed)
        return total, alarmed

@dataclass
class Seal:
    pos: pygame.math.Vector2
    progress: float = 0.0
    channeling: bool = False

    def update(self, knight_pos: pygame.math.Vector2, dt: float) -> Tuple[bool, bool]:
        started = False
        if knight_pos.distance_to(self.pos) <= SEAL_CHANNEL_RADIUS:
            if not self.channeling:
                started = True
            self.channeling = True
            self.progress = min(SEAL_CHANNEL_TIME, self.progress + dt)
        else:
            self.channeling = False
            if self.progress < SEAL_CHANNEL_TIME:
                self.progress = max(0.0, self.progress - dt * 0.5)
        completed = self.progress >= SEAL_CHANNEL_TIME
        return completed, started

    def draw(self, surface: pygame.Surface) -> None:
        rect = pygame.Rect(0, 0, 10, 10)
        rect.center = self.pos.xy
        pygame.draw.rect(surface, (220, 190, 60), rect)
        if self.channeling or self.progress > 0.0:
            pct = min(1.0, self.progress / SEAL_CHANNEL_TIME)
            start_angle = -math.pi / 2
            end_angle = start_angle + pct * 2 * math.pi
            pygame.draw.arc(surface, (255, 255, 255), rect.inflate(20, 20), start_angle, end_angle, 2)


class Knight:
    def __init__(self) -> None:
        self.pos = CASTLE_POS + pygame.math.Vector2(0, 180)
        self.vel = pygame.math.Vector2()
        self.target = self.pos.copy()
        self.hp = KNIGHT_HP
        self.swing_timer = 0.0
        self.swing_angle: Optional[float] = None
        self.swing_cooldown = 0.0
        self.swing_cooldown_modifier = 0.0
        self.swing_cooldown_duration = SWING_COOLDOWN
        self.castle_timer = 0.0
        self.last_click_time = -999.0
        self.on_road = False
        self.under_canopy = False

    def set_target(self, pos: pygame.math.Vector2, now: float, noise_cb) -> None:
        if now - self.last_click_time <= KNIGHT_SPRINT_CLICK_INTERVAL:
            noise_cb(self.pos, 1.0)
        self.last_click_time = now
        self.target = pos

    def update(self, dt: float, world: "World") -> None:
        direction = self.target - self.pos
        distance = direction.length()
        if distance > 2:
            direction.normalize_ip()
            self.vel += direction * KNIGHT_ACCEL * dt
        else:
            self.vel *= max(0.0, 1.0 - KNIGHT_FRICTION * dt)
        self.on_road = world.is_on_road(self.pos)
        self.under_canopy = world.knight_under_canopy(self.pos)
        max_speed = KNIGHT_MAX_SPEED
        if self.on_road:
            max_speed *= ROAD_SPEED_MULT
        elif self.under_canopy:
            max_speed *= KNIGHT_CANOPY_SPEED_MULT
        speed = self.vel.length()
        if speed > max_speed:
            self.vel.scale_to_length(max_speed)
        self.pos += self.vel * dt
        world.resolve_circle_collisions(self.pos, KNIGHT_COLLISION_RADIUS * 0.6, self.vel)
        world.clamp_to_bounds(self.pos, KNIGHT_COLLISION_RADIUS * 0.5)
        self._clamp()

        if self.swing_timer > 0.0:
            self.swing_timer = max(0.0, self.swing_timer - dt)
            if self.swing_timer <= 0.0:
                self.swing_angle = None
                self.swing_cooldown = self.swing_cooldown_duration
        if self.swing_cooldown > 0.0:
            self.swing_cooldown = max(0.0, self.swing_cooldown - dt)

    def collect_valor_shard(self) -> None:
        self.swing_cooldown_modifier = min(0.3, self.swing_cooldown_modifier + 0.1)
        self.swing_cooldown_duration = SWING_COOLDOWN * (1.0 - self.swing_cooldown_modifier)
        self.swing_cooldown = min(self.swing_cooldown, self.swing_cooldown_duration)

    def start_attack(self, units: List["Unit"]) -> List["Unit"]:
        if self.swing_timer > 0.0 or self.swing_cooldown > 0.0:
            return []
        closest: Optional[Unit] = None
        closest_dist = SWING_RANGE + 1
        for unit in units:
            if not unit.alive:
                continue
            dist = unit.pos.distance_to(self.pos)
            if dist <= SWING_RANGE and dist < closest_dist:
                closest = unit
                closest_dist = dist
        if closest is None:
            return []
        self.swing_angle = math.atan2(closest.pos.y - self.pos.y, closest.pos.x - self.pos.x)
        self.swing_timer = SWING_DURATION
        return self.collect_hits(units)

    def collect_hits(self, units: List["Unit"]) -> List["Unit"]:
        if self.swing_angle is None:
            return []
        hits: List["Unit"] = []
        for unit in units:
            if not unit.alive:
                continue
            if unit.pos.distance_to(self.pos) > SWING_RANGE:
                continue
            angle = math.atan2(unit.pos.y - self.pos.y, unit.pos.x - self.pos.x)
            diff = abs((angle - self.swing_angle + math.pi) % (2 * math.pi) - math.pi)
            if diff <= math.radians(SWING_ARC_DEG) / 2:
                hits.append(unit)
        return hits

    def draw(self, surface: pygame.Surface) -> None:
        rect = pygame.Rect(0, 0, KNIGHT_SIZE, KNIGHT_SIZE)
        rect.center = self.pos.xy
        pygame.draw.rect(surface, (60, 220, 80), rect)

    def draw_swing(self, surface: pygame.Surface) -> None:
        if self.swing_timer <= 0.0 or self.swing_angle is None:
            return
        radius = SWING_RANGE
        start_angle = self.swing_angle - math.radians(SWING_ARC_DEG) / 2
        end_angle = self.swing_angle + math.radians(SWING_ARC_DEG) / 2
        center = self.pos.xy
        points = [center]
        for i in range(SWING_ARC_POINTS + 1):
            t = i / SWING_ARC_POINTS
            ang = start_angle + (end_angle - start_angle) * t
            points.append((center[0] + math.cos(ang) * radius, center[1] + math.sin(ang) * radius))
        pygame.draw.polygon(surface, (120, 255, 120, 100), points)

    def _clamp(self) -> None:
        self.pos.x = max(ARENA_PADDING, min(WIDTH - ARENA_PADDING, self.pos.x))
        self.pos.y = max(ARENA_PADDING, min(HEIGHT - ARENA_PADDING, self.pos.y))


class Unit:
    def __init__(self, unit_type: str, pos: pygame.math.Vector2, anchor_manager: "AnchorManager") -> None:
        data = UNIT_DATA[unit_type]
        self.unit_type = unit_type
        self.pos = pos
        self.vel = pygame.math.Vector2()
        self.speed = data["speed"]
        self.size = data["size"]
        self.detection = data["detection"]
        self.max_hp = float(data["hp"])
        self.hp = float(data["hp"])
        self.color = data["color"]
        self.alive = True
        self.state = "idle"
        self.target = pos.copy()
        self.anchor_manager = anchor_manager
        self.anchors = anchor_manager.anchors
        self.state_timer = 0.0
        self.detect_timer = 0.0
        self.reveal_timer = 0.0
        self.reveal_active = 0.0
        self.howled = False
        self.spiral_origin: Optional[pygame.math.Vector2] = None
        self.spiral_angle = 0.0
        self.spiral_radius = 12.0
        self.road_persist = 0.0
        self.villager_target: Optional[Villager] = None
        self.villager_attack_cooldown = 0.0
        self.priest_attack_cooldown = 0.0

    def update(
        self,
        dt: float,
        knight: Knight,
        last_known: Optional[pygame.math.Vector2],
        world: World,
        los_debug: Optional[List[Tuple[Tuple[float, float], Tuple[float, float]]]],
    ) -> Tuple[bool, bool, Optional[Villager]]:
        if not self.alive:
            return False, False, None
        detected = False
        just_revealed = False
        killed_villager: Optional[Villager] = None

        self.villager_attack_cooldown = max(0.0, self.villager_attack_cooldown - dt)
        self.priest_attack_cooldown = max(0.0, self.priest_attack_cooldown - dt)

        distance = self.pos.distance_to(knight.pos)
        effective_detection = self.detection
        if world.knight_under_canopy(knight.pos):
            effective_detection *= 0.65
        los_clear = False
        if distance <= effective_detection:
            los_clear = world.line_clear(self.pos, knight.pos, los_debug)
        if los_clear:
            self.detect_timer += dt
        else:
            self.detect_timer = max(0.0, self.detect_timer - dt * 0.5)
            if self.detect_timer <= 1e-4:
                self.detect_timer = 0.0
                self.howled = False

        if self.unit_type == "PRIEST":
            if distance <= PRIEST_REVEAL_RADIUS and (los_clear or world.line_clear(self.pos, knight.pos)):
                self.reveal_timer += dt
                if self.reveal_timer >= PRIEST_REVEAL_TIME:
                    self.reveal_timer = PRIEST_REVEAL_TIME
                    if self.reveal_active <= 0.0:
                        self.reveal_active = PRIEST_REVEAL_DURATION
                        just_revealed = True
            else:
                self.reveal_timer = max(0.0, self.reveal_timer - dt)
            if self.reveal_active > 0.0:
                self.reveal_active = max(0.0, self.reveal_active - dt)
            self._attempt_priest_attack(knight, world, los_clear)
        else:
            self.reveal_timer = max(0.0, self.reveal_timer - dt)

        if self.detect_timer >= 0.5:
            detected = True
            self.state = "chase"
            self.state_timer = 1.5
            if self.unit_type == "SCOUT" and not self.howled:
                print("Scout howl!")
                self.howled = True
        elif self.state == "chase" and self.state_timer <= 0.0:
            self.start_spiral(last_known)

        if world.is_on_road(self.pos):
            self.road_persist = 2.0
        else:
            self.road_persist = max(0.0, self.road_persist - dt)

        if self.state not in ("idle", "hunt"):
            self.villager_target = None

        handled_hunt = False
        if self.state in ("idle", "hunt"):
            handled_hunt, villager_kill = self._update_villager_hunt(dt, world)
            if villager_kill is not None:
                killed_villager = villager_kill

        if self.state == "idle":
            if not handled_hunt:
                self.idle_to_anchor(dt, world)
        elif self.state == "chase":
            self.chase_target(knight.pos, dt, world)
            self.state_timer = max(0.0, self.state_timer - dt)
        elif self.state == "investigate":
            self.chase_target(self.target, dt, world)
            self.state_timer = max(0.0, self.state_timer - dt)
            if self.state_timer <= 0.0:
                self.state = "idle"
        elif self.state == "spiral":
            if self.state_timer <= 0.0:
                self.state = "idle"
            else:
                self.state_timer = max(0.0, self.state_timer - dt)
                self.spiral_angle += SPIRAL_ANGULAR_SPEED * dt
                self.spiral_radius += SPIRAL_RADIUS_SPEED * dt
                origin = self.spiral_origin or self.pos
                offset = pygame.math.Vector2(math.cos(self.spiral_angle), math.sin(self.spiral_angle)) * self.spiral_radius
                self.chase_target(origin + offset, dt, world)
        elif self.state == "hunt":
            if not handled_hunt:
                self.state = "idle"
                self.idle_to_anchor(dt, world)

        self.pos += self.vel * dt
        self._clamp()
        world.resolve_circle_collisions(self.pos, self.size * 1.4, self.vel)
        world.clamp_to_bounds(self.pos, self.size)
        return detected, just_revealed, killed_villager

    def idle_to_anchor(self, dt: float, world: World) -> None:
        if self.road_persist > 0.0 and self.target in self.anchors:
            anchor_pos = self.target
        elif self.unit_type == "SCOUT":
            anchor_pos = self.anchor_manager.highest_anchor().copy()
        else:
            if self.target not in self.anchors or self.pos.distance_to(self.target) < 18:
                anchor_pos = random.choice(self.anchors)
            else:
                anchor_pos = self.target
        if self.unit_type == "SCOUT" and self.pos.distance_to(anchor_pos) < 18:
            anchor_pos = self.anchor_manager.highest_anchor().copy()
        self.target = anchor_pos
        self.chase_target(self.target, dt, world)

    def chase_target(self, target: pygame.math.Vector2, dt: float, world: World) -> None:
        direction = target - self.pos
        if direction.length_squared() > 4:
            direction.normalize_ip()
            speed = self.speed * world.get_speed_multiplier(self.pos, "unit")
            self.vel = direction * speed
        else:
            self.vel *= max(0.0, 1.0 - 5 * dt)

    def damage(self, amount: float, knock_dir: Optional[pygame.math.Vector2] = None) -> None:
        if not self.alive:
            return
        self.hp -= amount
        if knock_dir is not None:
            self.pos += knock_dir * 6
        if self.hp <= 0:
            self.alive = False

    def _attempt_priest_attack(
        self, knight: Knight, world: World, los_clear: bool
    ) -> bool:
        if self.unit_type != "PRIEST":
            return False
        if self.priest_attack_cooldown > 0.0:
            return False
        distance = self.pos.distance_to(knight.pos)
        if distance > PRIEST_ATTACK_RANGE:
            return False
        if not los_clear and not world.line_clear(self.pos, knight.pos):
            return False
        knight.hp = max(0.0, knight.hp - PRIEST_ATTACK_DAMAGE)
        self.priest_attack_cooldown = PRIEST_ATTACK_COOLDOWN
        return True

    def _update_villager_hunt(
        self, dt: float, world: World
    ) -> Tuple[bool, Optional[Villager]]:
        if self.state not in ("idle", "hunt"):
            return False, None
        if self.villager_target is None or not self.villager_target.alive:
            self.villager_target = world.nearest_villager(self.pos, UNIT_VILLAGER_HUNT_RADIUS)
        if self.villager_target is None:
            if self.state == "hunt":
                self.state = "idle"
            return False, None
        target_pos = self.villager_target.pos
        self.state = "hunt"
        self.chase_target(target_pos, dt, world)
        killed: Optional[Villager] = None
        if (
            self.pos.distance_to(target_pos) <= self.size + 6
            and self.villager_attack_cooldown <= 0.0
        ):
            self.villager_attack_cooldown = ENEMY_VILLAGER_ATTACK_COOLDOWN
            killed = self.villager_target
            self.villager_target = None
            self.state = "idle"
        return True, killed

    def start_spiral(self, last_known: Optional[pygame.math.Vector2]) -> None:
        if last_known is None:
            self.state = "idle"
            return
        self.state = "spiral"
        self.state_timer = SPIRAL_SEARCH_TIME
        self.spiral_origin = last_known.copy()
        self.spiral_angle = random.random() * 2 * math.pi
        self.spiral_radius = 12.0

    def investigate(self, pos: pygame.math.Vector2) -> None:
        if not self.alive:
            return
        self.state = "investigate"
        self.target = pos.copy()
        self.state_timer = 2.0

    def draw(self, surface: pygame.Surface) -> None:
        if not self.alive:
            return
        rect = pygame.Rect(0, 0, self.size, self.size)
        rect.center = self.pos.xy
        color = self.color
        if self.state == "chase":
            color = tuple(min(255, int(c * 1.4)) for c in self.color)
        pygame.draw.rect(surface, color, rect)
        if self.unit_type == "PRIEST" and self.reveal_active > 0.0:
            pygame.draw.circle(surface, (255, 255, 255), rect.center, 10, 1)

    def _clamp(self) -> None:
        self.pos.x = max(ARENA_PADDING, min(WIDTH - ARENA_PADDING, self.pos.x))
        self.pos.y = max(ARENA_PADDING, min(HEIGHT - ARENA_PADDING, self.pos.y))


class AnchorManager:
    def __init__(self) -> None:
        self.anchors: List[pygame.math.Vector2] = []
        self.suspicion: List[float] = []
        for i in range(6):
            angle = (2 * math.pi / 6) * i
            point = CASTLE_POS + pygame.math.Vector2(math.cos(angle), math.sin(angle)) * 280
            self.anchors.append(point)
            self.suspicion.append(10.0)

    def decay(self, dt: float) -> None:
        for i in range(len(self.suspicion)):
            self.suspicion[i] = max(0.0, self.suspicion[i] - SUS_DECAY_PER_SEC * dt)

    def boost_from_pos(self, pos: pygame.math.Vector2, amount: float) -> None:
        for i, anchor in enumerate(self.anchors):
            dist = pos.distance_to(anchor)
            self.suspicion[i] += amount / (dist + 1.0)

    def boost_sector(self, pos: pygame.math.Vector2, amount: float) -> None:
        idx = min(range(len(self.anchors)), key=lambda i: self.anchors[i].distance_to(pos))
        self.suspicion[idx] += amount

    def highest_anchor(self) -> pygame.math.Vector2:
        idx = max(range(len(self.anchors)), key=lambda i: self.suspicion[i])
        return self.anchors[idx].copy()

    def nearest_anchor_to(self, pos: pygame.math.Vector2) -> pygame.math.Vector2:
        idx = min(range(len(self.anchors)), key=lambda i: self.anchors[i].distance_to(pos))
        return self.anchors[idx].copy()

    def draw_debug(self, surface: pygame.Surface, font: pygame.font.Font) -> None:
        for i, anchor in enumerate(self.anchors):
            pygame.draw.circle(surface, (200, 80, 80), anchor, 4)
            bar_height = 40
            bar_width = 5
            pct = min(1.0, self.suspicion[i] / 100.0)
            bg = pygame.Rect(int(anchor.x + 10), int(anchor.y - bar_height), bar_width, bar_height)
            pygame.draw.rect(surface, (60, 0, 0), bg, 1)
            fill = pygame.Rect(int(anchor.x + 10), int(anchor.y - bar_height * pct), bar_width, int(bar_height * pct))
            pygame.draw.rect(surface, (220, 40, 40), fill)
            txt = font.render(str(int(self.suspicion[i])), True, (255, 255, 255))
            surface.blit(txt, (anchor.x + 18, anchor.y - 12))


class DarkLordAI:
    def __init__(self, anchors: AnchorManager) -> None:
        self.energy = 0.0
        self.units: List["Unit"] = []
        self.spawn_timer = SPAWN_INTERVAL
        self.anchors = anchors
        self.last_reveal_pos: Optional[pygame.math.Vector2] = None
        self.last_reveal_time = -999.0
        self.alarm_target: Optional[pygame.math.Vector2] = None
        self.alarm_active = False
        self.last_spawn_type: Optional[str] = None

    def update(self, dt: float, knight: Knight, seals: List[Seal], now: float, world: World) -> None:
        self.alarm_target = world.get_alarm_focus()
        self.alarm_active = self.alarm_target is not None
        self.energy += ENERGY_PER_SEC * dt
        self.spawn_timer -= dt
        self.units = [u for u in self.units if u.alive]
        if self.spawn_timer <= 0.0:
            self.spawn_timer += SPAWN_INTERVAL
            self.try_spawn(seals, now)

    def try_spawn(self, seals: List[Seal], now: float) -> None:
        if len(self.units) >= MAX_UNITS:
            return
        seal_channeling = any(seal.channeling for seal in seals)
        weights: Dict[str, float] = {"SCOUT": 1.0}
        if self.alarm_active:
            weights["SCOUT"] = weights.get("SCOUT", 0.0) + 0.8
        if seal_channeling:
            weights["TANK"] = weights.get("TANK", 0.0) + 1.4
        if self.last_reveal_pos is not None and now - self.last_reveal_time < 4.0:
            weights["PRIEST"] = weights.get("PRIEST", 0.0) + 1.2
        affordable: Dict[str, float] = {
            unit_type: weight
            for unit_type, weight in weights.items()
            if self.energy >= UNIT_DATA[unit_type]["cost"]
        }
        if not affordable:
            return
        if len(affordable) > 1 and self.last_spawn_type in affordable:
            affordable[self.last_spawn_type] *= 0.45
        choices = list(affordable.keys())
        chance = list(affordable.values())
        unit_type = random.choices(choices, weights=chance)[0]
        spawn_pos = self.choose_spawn_position(unit_type)
        self.energy -= UNIT_DATA[unit_type]["cost"]
        unit = Unit(unit_type, spawn_pos, self.anchors)
        if seal_channeling and unit_type == "TANK":
            closest = min(seals, key=lambda s: s.pos.distance_to(spawn_pos), default=None)
            if closest is not None:
                unit.state = "investigate"
                unit.target = closest.pos.copy()
                unit.state_timer = 4.0
        if unit_type == "SCOUT" and seal_channeling:
            unit.state = "investigate"
            active = [s for s in seals if s.channeling]
            if active:
                unit.target = active[0].pos.copy()
                unit.state_timer = 3.0
        if self.last_reveal_pos is not None and now - self.last_reveal_time < 4.0:
            unit.state = "investigate"
            unit.target = self.last_reveal_pos.copy()
            unit.state_timer = 3.5
        self.units.append(unit)
        self.last_spawn_type = unit_type

    def choose_spawn_position(self, unit_type: str) -> pygame.math.Vector2:
        if unit_type in ("TANK", "PRIEST") and self.last_reveal_pos is not None and random.random() < 0.6:
            offset = pygame.math.Vector2(random.uniform(-30, 30), random.uniform(-30, 30))
            return self.last_reveal_pos + offset
        if self.alarm_target is not None and random.random() < 0.65:
            anchor = self.anchors.nearest_anchor_to(self.alarm_target)
            offset = pygame.math.Vector2(random.uniform(-25, 25), random.uniform(-25, 25))
            return anchor + offset
        angle = random.random() * 2 * math.pi
        base = CASTLE_POS + pygame.math.Vector2(math.cos(angle), math.sin(angle)) * (CASTLE_RADIUS + 40)
        if random.random() < 0.4:
            anchor = random.choice(self.anchors.anchors)
            base = anchor + pygame.math.Vector2(random.uniform(-30, 30), random.uniform(-30, 30))
        return base

    def register_reveal(self, pos: pygame.math.Vector2, now: float) -> None:
        self.last_reveal_pos = pos.copy()
        self.last_reveal_time = now
        self.anchors.boost_from_pos(pos, SUS_REVEAL_BONUS)

    def on_villager_killed(self, pos: pygame.math.Vector2) -> None:
        self.energy += VILLAGER_MANA_REWARD
        self.anchors.boost_sector(pos, 6.0)


class Game:
    def __init__(self) -> None:
        pygame.init()
        self.screen = pygame.display.set_mode((WIDTH, HEIGHT))
        pygame.display.set_caption("bitfield_prototype_v3_objectives_ai")
        self.clock = pygame.time.Clock()
        self.font = pygame.font.SysFont(HUD_FONT_NAME, 18)
        self.big_font = pygame.font.SysFont(HUD_FONT_NAME, 48)
        self.world = World()
        self.knight = Knight()
        self.anchors = AnchorManager()
        self.ai = DarkLordAI(self.anchors)
        self.seals: List[Seal] = self.generate_seals()
        self.broken_seals = 0
        self.pulses: List[PulseEffect] = []
        self.noise_pings: List[NoisePing] = []
        self.last_known_pos: Optional[pygame.math.Vector2] = None
        self.last_known_timer = 0.0
        self.shield_active = True
        self.victory = False
        self.defeat = False
        self.running = True
        self.debug_overlay = False
        self.show_canopy = False
        self.los_debug_lines: List[Tuple[Tuple[float, float], Tuple[float, float]]] = []

    def generate_seals(self) -> List[Seal]:
        seals: List[Seal] = []
        attempts = 0
        while len(seals) < SEAL_COUNT and attempts < 800:
            attempts += 1
            angle = random.uniform(0, 2 * math.pi)
            radius = random.uniform(SEAL_MIN_CASTLE_DIST, min(WIDTH, HEIGHT) / 2 - 80)
            pos = CASTLE_POS + pygame.math.Vector2(math.cos(angle), math.sin(angle)) * radius
            if any(pos.distance_to(s.pos) < SEAL_MIN_SEPARATION for s in seals):
                continue
            if not self.world.is_clear(pos, 30):
                continue
            if self.world.is_on_road(pos):
                continue
            seals.append(Seal(pos))
        return seals

    def run(self) -> None:
        total_time = 0.0
        while self.running:
            dt = self.clock.tick(FPS) / 1000.0
            total_time += dt
            self.handle_events(total_time)
            if not (self.victory or self.defeat):
                self.update(dt, total_time)
            self.draw()
        pygame.quit()

    def handle_events(self, now: float) -> None:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                self.running = False
            elif event.type == pygame.KEYDOWN:
                if event.key == pygame.K_ESCAPE:
                    self.running = False
                elif event.key == DEBUG_TOGGLE_KEY:
                    self.debug_overlay = not self.debug_overlay
                elif event.key == pygame.K_b:
                    self.show_canopy = not self.show_canopy
            elif event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
                self.knight.set_target(pygame.math.Vector2(event.pos), now, self.spawn_noise)

    def spawn_noise(self, pos: pygame.math.Vector2, strength: float = 1.0) -> None:
        self.noise_pings.append(NoisePing(pos.copy(), strength=strength))
        self.anchors.boost_from_pos(pos, SUS_NOISE_SCALE * strength)
        for unit in self.ai.units:
            if unit.unit_type == "SCOUT" and unit.state == "idle":
                if unit.pos.distance_to(pos) < 180:
                    unit.investigate(pos)

    def on_villager_killed(self, villager: Villager, unit: Unit) -> None:
        if not villager.alive:
            return
        villager.alive = False
        village = villager.village
        if village:
            village.villagers = [v for v in village.villagers if v.alive]
            variation = random.uniform(1.0 - VILLAGER_RESPAWN_VARIANCE, 1.0 + VILLAGER_RESPAWN_VARIANCE)
            village.spawn_timer = VILLAGER_RESPAWN_INTERVAL * variation
        self.spawn_noise(villager.pos, 0.6)
        self.ai.on_villager_killed(villager.pos)

    def update(self, dt: float, now: float) -> None:
        self.knight.update(dt, self.world)
        self.anchors.decay(dt)
        self.world.update(dt, self.knight, self.ai.units, self)

        for seal in list(self.seals):
            completed, started = seal.update(self.knight.pos, dt)
            if started:
                self.spawn_noise(seal.pos)
                self.anchors.boost_sector(seal.pos, SUS_SEAL_BONUS)
            if completed:
                self.broken_seals += 1
                self.pulses.append(PulseEffect(seal.pos.copy()))
                self.seals.remove(seal)
        if self.shield_active and self.broken_seals >= SEAL_COUNT:
            self.shield_active = False
            self.pulses.append(PulseEffect(CASTLE_POS.copy(), duration=0.6))

        self.ai.update(dt, self.knight, self.seals, now, self.world)

        reveal_triggered = False
        self.los_debug_lines = [] if self.debug_overlay else []
        los_list = self.los_debug_lines if self.debug_overlay else None
        for unit in self.ai.units:
            detected, just_revealed, killed_villager = unit.update(
                dt, self.knight, self.last_known_pos, self.world, los_list
            )
            if detected:
                self.last_known_pos = self.knight.pos.copy()
                self.last_known_timer = 4.0
                self.anchors.boost_sector(self.knight.pos, 18.0)
            if just_revealed:
                reveal_triggered = True
                self.last_known_pos = self.knight.pos.copy()
                self.last_known_timer = PRIEST_REVEAL_DURATION
            if killed_villager is not None:
                self.on_villager_killed(killed_villager, unit)
        if reveal_triggered:
            print("Priest reveal!")
            self.ai.register_reveal(self.knight.pos, now)

        if self.last_known_timer > 0.0:
            self.last_known_timer = max(0.0, self.last_known_timer - dt)
            if self.last_known_timer <= 0.0:
                self.last_known_pos = None

        hits: List["Unit"]
        if self.knight.swing_timer > 0.0:
            hits = self.knight.collect_hits(self.ai.units)
        elif self.knight.swing_cooldown <= 0.0:
            hits = self.knight.start_attack(self.ai.units)
        else:
            hits = []
        killed_positions: List[pygame.math.Vector2] = []
        for unit in hits:
            knock = None
            if unit.unit_type == "TANK":
                knock = (unit.pos - self.knight.pos)
                if knock.length_squared() > 0:
                    knock.scale_to_length(1.0)
            unit.damage(1, knock)
            if not unit.alive:
                killed_positions.append(unit.pos.copy())
                if unit.unit_type == "PRIEST":
                    print("Priest defeated, silence!")
            elif unit.unit_type == "TANK" and knock is not None:
                unit.pos += knock * 8
        if killed_positions:
            for pos in killed_positions:
                self.spawn_noise(pos)

        self.resolve_knight_collisions(dt)

        self.noise_pings = [ping for ping in self.noise_pings if not ping.update(dt)]
        self.pulses = [pulse for pulse in self.pulses if not pulse.update(dt)]

        if self.shield_active:
            self.knight.castle_timer = 0.0
        else:
            if self.knight.pos.distance_to(CASTLE_POS) <= CASTLE_WIN_RADIUS:
                self.knight.castle_timer += dt
                if self.knight.castle_timer >= CASTLE_STAY_TIME:
                    self.victory = True
            else:
                self.knight.castle_timer = 0.0

        if self.knight.hp <= 0:
            self.defeat = True

    def resolve_knight_collisions(self, dt: float) -> None:
        for unit in self.ai.units:
            if not unit.alive:
                continue
            if unit.pos.distance_to(self.knight.pos) <= KNIGHT_COLLISION_RADIUS:
                self.knight.hp = max(0, self.knight.hp - dt * 0.4)
                push = (self.knight.pos - unit.pos)
                if push.length_squared() > 0:
                    push.scale_to_length(1.0)
                    self.knight.pos += push * 20 * dt

    def draw(self) -> None:
        self.screen.fill((18, 18, 24))
        self.world.draw_base(self.screen)
        if self.show_canopy:
            self.world.draw_canopy(self.screen)
        pygame.draw.circle(self.screen, (130, 0, 180), CASTLE_POS, CASTLE_RADIUS)
        if self.shield_active:
            pygame.draw.circle(self.screen, (150, 90, 220), CASTLE_POS, CASTLE_RADIUS + CASTLE_SHIELD_EXTRA, 2)
        for pulse in self.pulses:
            pulse.draw(self.screen)
        for seal in self.seals:
            seal.draw(self.screen)
        for ping in self.noise_pings:
            ping.draw(self.screen)
        for unit in self.ai.units:
            unit.draw(self.screen)
        self.knight.draw(self.screen)
        self.knight.draw_swing(self.screen)
        if self.debug_overlay:
            self.world.draw_debug(self.screen)
            self.anchors.draw_debug(self.screen, self.font)
            for start, end in self.los_debug_lines:
                pygame.draw.line(self.screen, (120, 200, 200), start, end, 1)
        if self.victory:
            text = self.big_font.render("Victory!", True, (120, 255, 120))
            self.screen.blit(text, (WIDTH / 2 - text.get_width() / 2, HEIGHT / 2 - text.get_height() / 2))
        elif self.defeat:
            text = self.big_font.render("Defeat", True, (255, 80, 80))
            self.screen.blit(text, (WIDTH / 2 - text.get_width() / 2, HEIGHT / 2 - text.get_height() / 2))
        self.draw_hud()
        pygame.display.flip()

    def draw_hud(self) -> None:
        total_villagers, alarmed = self.world.villager_counts()
        hud_text = (
            f"HP: {int(self.knight.hp)}  Evil: {int(self.ai.energy)}  Units: {len(self.ai.units)}/{MAX_UNITS}"
            f"  Seals: {self.broken_seals}/{SEAL_COUNT}  Villagers: {total_villagers}  Alarmed: {alarmed}"
        )
        text = self.font.render(hud_text, True, (220, 220, 220))
        self.screen.blit(text, (12, 12))
        if self.knight.castle_timer > 0.0:
            pct = min(1.0, self.knight.castle_timer / CASTLE_STAY_TIME)
            bar_bg = pygame.Rect(12, 36, 160, 12)
            pygame.draw.rect(self.screen, (50, 50, 50), bar_bg)
            pygame.draw.rect(self.screen, (120, 255, 120), pygame.Rect(12, 36, int(160 * pct), 12))
        if self.last_known_pos is not None:
            pygame.draw.circle(self.screen, (255, 50, 50), self.last_known_pos, 6, 1)


def main() -> None:
    game = Game()
    game.run()


if __name__ == "__main__":
    main()
