import math
import random
from dataclasses import dataclass
from typing import List, Optional, Tuple

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

ARENA_PADDING = 40

# Units / Macro AI
MAX_UNITS = 18
ENERGY_PER_SEC = 3.0
SPAWN_INTERVAL = 1.5

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
class NoisePing:
    pos: pygame.math.Vector2
    timer: float = 0.0

    def update(self, dt: float) -> bool:
        self.timer += dt
        return self.timer >= NOISE_RING_DURATION

    def draw(self, surface: pygame.Surface) -> None:
        t = min(1.0, self.timer / NOISE_RING_DURATION)
        radius = NOISE_RING_MIN_RADIUS + (NOISE_RING_MAX_RADIUS - NOISE_RING_MIN_RADIUS) * t
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
        self.castle_timer = 0.0
        self.last_click_time = -999.0

    def set_target(self, pos: pygame.math.Vector2, now: float, noise_cb) -> None:
        if now - self.last_click_time <= KNIGHT_SPRINT_CLICK_INTERVAL:
            noise_cb(self.pos)
        self.last_click_time = now
        self.target = pos

    def update(self, dt: float) -> None:
        direction = self.target - self.pos
        distance = direction.length()
        if distance > 2:
            direction.normalize_ip()
            self.vel += direction * KNIGHT_ACCEL * dt
        else:
            self.vel *= max(0.0, 1.0 - KNIGHT_FRICTION * dt)
        speed = self.vel.length()
        if speed > KNIGHT_MAX_SPEED:
            self.vel.scale_to_length(KNIGHT_MAX_SPEED)
        self.pos += self.vel * dt
        self._clamp()

        if self.swing_timer > 0.0:
            self.swing_timer = max(0.0, self.swing_timer - dt)
            if self.swing_timer <= 0.0:
                self.swing_angle = None
                self.swing_cooldown = SWING_COOLDOWN
        if self.swing_cooldown > 0.0:
            self.swing_cooldown = max(0.0, self.swing_cooldown - dt)

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

    def update(self, dt: float, knight: Knight, last_known: Optional[pygame.math.Vector2]) -> Tuple[bool, bool]:
        if not self.alive:
            return False, False
        detected = False
        just_revealed = False

        distance = self.pos.distance_to(knight.pos)
        if distance <= self.detection:
            self.detect_timer += dt
        else:
            self.detect_timer = max(0.0, self.detect_timer - dt * 0.5)
            if self.detect_timer <= 1e-4:
                self.detect_timer = 0.0
                self.howled = False

        if self.unit_type == "PRIEST":
            if distance <= PRIEST_REVEAL_RADIUS:
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

        if self.state == "idle":
            self.idle_to_anchor(dt)
        elif self.state == "chase":
            self.chase_target(knight.pos, dt)
            self.state_timer = max(0.0, self.state_timer - dt)
        elif self.state == "investigate":
            self.chase_target(self.target, dt)
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
                self.chase_target(origin + offset, dt)

        self.pos += self.vel * dt
        self._clamp()
        return detected, just_revealed

    def idle_to_anchor(self, dt: float) -> None:
        if self.unit_type == "SCOUT":
            anchor_pos = self.anchor_manager.highest_anchor().copy()
        else:
            if self.target not in self.anchors or self.pos.distance_to(self.target) < 18:
                anchor_pos = random.choice(self.anchors)
            else:
                anchor_pos = self.target
        if self.unit_type == "SCOUT" and self.pos.distance_to(anchor_pos) < 18:
            anchor_pos = self.anchor_manager.highest_anchor().copy()
        self.target = anchor_pos
        self.chase_target(self.target, dt)

    def chase_target(self, target: pygame.math.Vector2, dt: float) -> None:
        direction = target - self.pos
        if direction.length_squared() > 4:
            direction.normalize_ip()
            self.vel = direction * self.speed
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

    def update(self, dt: float, knight: Knight, seals: List[Seal], now: float) -> None:
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
        priority: List[str] = []
        if seal_channeling:
            priority.extend(["SCOUT", "SCOUT", "TANK"])
        elif self.last_reveal_pos is not None and now - self.last_reveal_time < 4.0:
            priority.extend(["TANK", "PRIEST"])
        else:
            priority.append("SCOUT")
        spawned_any = False
        for unit_type in priority:
            if len(self.units) >= MAX_UNITS:
                break
            cost = UNIT_DATA[unit_type]["cost"]
            if self.energy >= cost:
                spawn_pos = self.choose_spawn_position(unit_type)
                self.energy -= cost
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
                spawned_any = True
        if not spawned_any and self.energy >= UNIT_DATA["SCOUT"]["cost"] and len(self.units) < MAX_UNITS:
            self.energy -= UNIT_DATA["SCOUT"]["cost"]
            unit = Unit("SCOUT", self.choose_spawn_position("SCOUT"), self.anchors)
            self.units.append(unit)

    def choose_spawn_position(self, unit_type: str) -> pygame.math.Vector2:
        if unit_type in ("TANK", "PRIEST") and self.last_reveal_pos is not None and random.random() < 0.6:
            offset = pygame.math.Vector2(random.uniform(-30, 30), random.uniform(-30, 30))
            return self.last_reveal_pos + offset
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


class Game:
    def __init__(self) -> None:
        pygame.init()
        self.screen = pygame.display.set_mode((WIDTH, HEIGHT))
        pygame.display.set_caption("bitfield_prototype_v3_objectives_ai")
        self.clock = pygame.time.Clock()
        self.font = pygame.font.SysFont(HUD_FONT_NAME, 18)
        self.big_font = pygame.font.SysFont(HUD_FONT_NAME, 48)
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
            elif event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
                self.knight.set_target(pygame.math.Vector2(event.pos), now, self.spawn_noise)

    def spawn_noise(self, pos: pygame.math.Vector2) -> None:
        self.noise_pings.append(NoisePing(pos.copy()))
        self.anchors.boost_from_pos(pos, SUS_NOISE_SCALE)
        for unit in self.ai.units:
            if unit.unit_type == "SCOUT" and unit.state == "idle":
                if unit.pos.distance_to(pos) < 180:
                    unit.investigate(pos)

    def update(self, dt: float, now: float) -> None:
        self.knight.update(dt)
        self.anchors.decay(dt)

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

        self.ai.update(dt, self.knight, self.seals, now)

        reveal_triggered = False
        for unit in self.ai.units:
            detected, just_revealed = unit.update(dt, self.knight, self.last_known_pos)
            if detected:
                self.last_known_pos = self.knight.pos.copy()
                self.last_known_timer = 4.0
                self.anchors.boost_sector(self.knight.pos, 18.0)
            if just_revealed:
                reveal_triggered = True
                self.last_known_pos = self.knight.pos.copy()
                self.last_known_timer = PRIEST_REVEAL_DURATION
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
            self.anchors.draw_debug(self.screen, self.font)
        if self.victory:
            text = self.big_font.render("Victory!", True, (120, 255, 120))
            self.screen.blit(text, (WIDTH / 2 - text.get_width() / 2, HEIGHT / 2 - text.get_height() / 2))
        elif self.defeat:
            text = self.big_font.render("Defeat", True, (255, 80, 80))
            self.screen.blit(text, (WIDTH / 2 - text.get_width() / 2, HEIGHT / 2 - text.get_height() / 2))
        self.draw_hud()
        pygame.display.flip()

    def draw_hud(self) -> None:
        hud_text = f"HP: {int(self.knight.hp)}  Evil: {int(self.ai.energy)}  Units: {len(self.ai.units)}/{MAX_UNITS}  Seals: {self.broken_seals}/{SEAL_COUNT}"
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
