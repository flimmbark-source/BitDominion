import math
import random
from typing import List, Optional

import pygame


# Constants
WIDTH, HEIGHT = 800, 800
FPS = 60
CASTLE_POS = pygame.math.Vector2(WIDTH / 2, HEIGHT / 2)
CASTLE_SIZE = 20
CASTLE_WIN_RADIUS = 25
CASTLE_STAY_TIME = 3.0

KNIGHT_SIZE = 6
KNIGHT_ACCEL = 0.5  # per frame
KNIGHT_FRICTION = 0.90  # per frame
KNIGHT_STOP_DISTANCE = 5
KNIGHT_HP = 3

MELEE_RANGE = 40
ARC_WIDTH_DEG = 100
SWING_DURATION = 0.25
SWING_COOLDOWN = 0.8
SWING_ARC_POINTS = 16

PATROL_SIZE = 4
PATROL_DETECT_RADIUS = 80
PATROL_MIN_SPEED = 0.6
PATROL_MAX_SPEED = 1.2
PATROL_WANDER_INTERVAL = (1.0, 3.0)
PATROL_MAX_COUNT = 15
PATROL_REINFORCEMENT_COUNT = 2
PATROL_SPAWN_RADIUS = 50
PATROL_DAMAGE_COOLDOWN = 0.5
PATROL_DETECTION_LERP = 0.15

DETECTION_REQUIRED_TIME = 2.0

BACKGROUND_COLOR = (0, 0, 0)
KNIGHT_COLOR = (20, 200, 20)
PATROL_COLOR = (200, 40, 40)
PATROL_ALERT_COLOR = (255, 90, 90)
CASTLE_COLOR = (130, 0, 180)
HUD_COLOR = (220, 220, 220)
ARC_COLOR = (220, 220, 220)
VICTORY_COLOR = (80, 200, 120)
DEFEAT_COLOR = (220, 60, 60)


class Knight:
    """Player-controlled Knight that moves with click-to-move and auto-attacks nearby patrols."""

    def __init__(self, position: pygame.math.Vector2):
        self.pos = position
        self.velocity = pygame.math.Vector2(0, 0)
        self.target = position.copy()
        self.hp = KNIGHT_HP
        self.swing_timer = 0.0
        self.swing_cooldown = 0.0
        self.swing_angle: Optional[float] = None
        self.castle_timer = 0.0

    def set_target(self, target: pygame.math.Vector2) -> None:
        self.target = target

    def update(self, dt: float) -> None:
        dt_ratio = dt * FPS
        to_target = self.target - self.pos
        distance = to_target.length()
        if distance > KNIGHT_STOP_DISTANCE:
            desired_dir = to_target.normalize()
            self.velocity += desired_dir * KNIGHT_ACCEL * dt_ratio
        elif self.velocity.length_squared() < 0.05:
            self.velocity.update(0, 0)

        self.velocity *= (KNIGHT_FRICTION ** dt_ratio)

        if distance <= KNIGHT_STOP_DISTANCE and self.velocity.length_squared() < 0.05:
            self.velocity.update(0, 0)

        self.pos += self.velocity * dt_ratio
        self._clamp_to_bounds()

        if self.swing_timer > 0.0:
            self.swing_timer = max(0.0, self.swing_timer - dt)
            if self.swing_timer == 0.0:
                self.swing_angle = None
                self.swing_cooldown = SWING_COOLDOWN

        if self.swing_cooldown > 0.0:
            self.swing_cooldown = max(0.0, self.swing_cooldown - dt)

    def _clamp_to_bounds(self) -> None:
        half = KNIGHT_SIZE / 2
        self.pos.x = max(half, min(WIDTH - half, self.pos.x))
        self.pos.y = max(half, min(HEIGHT - half, self.pos.y))

    def try_attack(self, patrols: List["Patrol"]) -> List["Patrol"]:
        if self.swing_timer > 0.0:
            return self._collect_hits(patrols)

        if self.swing_cooldown > 0.0:
            return []

        nearest: Optional[Patrol] = None
        nearest_dist = MELEE_RANGE + 1
        for patrol in patrols:
            if not patrol.alive:
                continue
            dist = patrol.pos.distance_to(self.pos)
            if dist <= MELEE_RANGE and dist < nearest_dist:
                nearest = patrol
                nearest_dist = dist
        if nearest is None:
            return []

        self.swing_angle = math.atan2(nearest.pos.y - self.pos.y, nearest.pos.x - self.pos.x)
        self.swing_timer = SWING_DURATION
        hits = self._collect_hits(patrols)
        return hits

    def _collect_hits(self, patrols: List["Patrol"]) -> List["Patrol"]:
        if self.swing_angle is None:
            return []
        hits: List[Patrol] = []
        for patrol in patrols:
            if not patrol.alive:
                continue
            if patrol.pos.distance_to(self.pos) > MELEE_RANGE:
                continue
            if self._point_in_arc(patrol.pos):
                hits.append(patrol)
        return hits

    def _point_in_arc(self, point: pygame.math.Vector2) -> bool:
        direction = point - self.pos
        if direction.length_squared() == 0:
            return True
        angle = math.atan2(direction.y, direction.x)
        diff = abs((angle - self.swing_angle + math.pi) % (2 * math.pi) - math.pi)
        return diff <= math.radians(ARC_WIDTH_DEG) / 2

    def draw(self, surface: pygame.Surface) -> None:
        rect = pygame.Rect(0, 0, KNIGHT_SIZE, KNIGHT_SIZE)
        rect.center = self.pos.xy
        pygame.draw.rect(surface, KNIGHT_COLOR, rect)

    def draw_swing(self, surface: pygame.Surface) -> None:
        if self.swing_timer <= 0.0 or self.swing_angle is None:
            return
        radius = MELEE_RANGE
        start_angle = self.swing_angle - math.radians(ARC_WIDTH_DEG) / 2
        end_angle = self.swing_angle + math.radians(ARC_WIDTH_DEG) / 2
        points = [self.pos.xy]
        for i in range(SWING_ARC_POINTS + 1):
            t = i / SWING_ARC_POINTS
            angle = start_angle + (end_angle - start_angle) * t
            point = (self.pos.x + math.cos(angle) * radius, self.pos.y + math.sin(angle) * radius)
            points.append(point)
        pygame.draw.polygon(surface, ARC_COLOR, points, width=1)


class Patrol:
    """Autonomous patrol that wanders and chases the Knight when detected."""

    def __init__(self, position: pygame.math.Vector2):
        self.pos = position
        self.velocity = pygame.math.Vector2(0, 0)
        self.detecting = False
        self.wander_timer = 0.0
        self.damage_timer = 0.0
        self.alive = True

    def update(self, dt: float, knight_pos: pygame.math.Vector2) -> None:
        if not self.alive:
            return
        dt_ratio = dt * FPS
        self.wander_timer -= dt
        if self.wander_timer <= 0:
            self._pick_new_direction()

        to_knight = knight_pos - self.pos
        distance = to_knight.length()
        self.detecting = distance <= PATROL_DETECT_RADIUS
        if self.detecting and distance > 0:
            desired = to_knight.normalize() * max(self.velocity.length(), PATROL_MAX_SPEED)
            self.velocity = self.velocity.lerp(desired, PATROL_DETECTION_LERP * dt_ratio)

        self.pos += self.velocity * dt_ratio
        self._handle_bounds()

        if self.damage_timer > 0.0:
            self.damage_timer = max(0.0, self.damage_timer - dt)

    def _pick_new_direction(self) -> None:
        angle = random.uniform(0, 2 * math.pi)
        speed = random.uniform(PATROL_MIN_SPEED, PATROL_MAX_SPEED)
        self.velocity = pygame.math.Vector2(math.cos(angle), math.sin(angle)) * speed
        self.wander_timer = random.uniform(*PATROL_WANDER_INTERVAL)

    def _handle_bounds(self) -> None:
        half = PATROL_SIZE / 2
        bounced = False
        if self.pos.x < half:
            self.pos.x = half
            self.velocity.x *= -1
            bounced = True
        elif self.pos.x > WIDTH - half:
            self.pos.x = WIDTH - half
            self.velocity.x *= -1
            bounced = True
        if self.pos.y < half:
            self.pos.y = half
            self.velocity.y *= -1
            bounced = True
        elif self.pos.y > HEIGHT - half:
            self.pos.y = HEIGHT - half
            self.velocity.y *= -1
            bounced = True
        if bounced:
            self.velocity *= 0.9

    def attempt_damage(self, knight: Knight) -> bool:
        if not self.alive or self.damage_timer > 0.0:
            return False
        if self.pos.distance_to(knight.pos) < 6.0:
            self.damage_timer = PATROL_DAMAGE_COOLDOWN
            knight.hp = max(0, knight.hp - 1)
            return True
        return False

    def draw(self, surface: pygame.Surface) -> None:
        if not self.alive:
            return
        color = PATROL_ALERT_COLOR if self.detecting else PATROL_COLOR
        rect = pygame.Rect(0, 0, PATROL_SIZE, PATROL_SIZE)
        rect.center = self.pos.xy
        pygame.draw.rect(surface, color, rect)


class DarkLord:
    """Manages reinforcements and evil energy tracking while patrols detect the Knight."""

    def __init__(self):
        self.detection_timer = 0.0
        self.evil_energy = 0
        self._evil_accumulator = 0.0

    def update(self, dt: float, detecting: bool) -> bool:
        if detecting:
            self.detection_timer += dt
            self._evil_accumulator += dt
            if self._evil_accumulator >= 1.0:
                gained = int(self._evil_accumulator // 1)
                self.evil_energy += gained
                self._evil_accumulator -= gained
        else:
            self.detection_timer = 0.0
            self._evil_accumulator = 0.0
        if self.detection_timer > DETECTION_REQUIRED_TIME:
            self.detection_timer = 0.0
            return True
        return False


class Game:
    """Main game orchestrating entities, input, updates, and rendering."""

    def __init__(self) -> None:
        pygame.init()
        pygame.display.set_caption("Grimm Dominion – Bitfield Prototype")
        self.screen = pygame.display.set_mode((WIDTH, HEIGHT))
        self.clock = pygame.time.Clock()
        self.font = pygame.font.SysFont("consolas", 18)
        self.large_font = pygame.font.SysFont("consolas", 48)

        self.knight = Knight(CASTLE_POS + pygame.math.Vector2(0, 120))
        self.patrols: List[Patrol] = []
        self.dark_lord = DarkLord()
        self.state = "running"

        self._spawn_initial_patrols(5)

    def _spawn_initial_patrols(self, count: int) -> None:
        for _ in range(count):
            self.spawn_patrol_random()

    def spawn_patrol_random(self) -> None:
        for _ in range(100):
            pos = pygame.math.Vector2(random.uniform(0, WIDTH), random.uniform(0, HEIGHT))
            if pos.distance_to(CASTLE_POS) >= 60:
                patrol = Patrol(pos)
                patrol._pick_new_direction()
                self.patrols.append(patrol)
                return

    def spawn_patrol_near_castle(self, count: int) -> None:
        for _ in range(count):
            if len(self.patrols) >= PATROL_MAX_COUNT:
                break
            angle = random.uniform(0, 2 * math.pi)
            radius = random.uniform(0, PATROL_SPAWN_RADIUS)
            pos = CASTLE_POS + pygame.math.Vector2(math.cos(angle), math.sin(angle)) * radius
            pos.x = max(PATROL_SIZE / 2, min(WIDTH - PATROL_SIZE / 2, pos.x))
            pos.y = max(PATROL_SIZE / 2, min(HEIGHT - PATROL_SIZE / 2, pos.y))
            patrol = Patrol(pos)
            patrol._pick_new_direction()
            self.patrols.append(patrol)

    def run(self) -> None:
        while True:
            dt = self.clock.tick(FPS) / 1000.0
            if not self.handle_events():
                break
            self.update(dt)
            self.draw()

    def handle_events(self) -> bool:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                return False
            if event.type == pygame.KEYDOWN and event.key == pygame.K_ESCAPE:
                return False
            if event.type == pygame.MOUSEBUTTONDOWN and event.button == 1 and self.state == "running":
                self.knight.set_target(pygame.math.Vector2(event.pos))
        return True

    def update(self, dt: float) -> None:
        if self.state != "running":
            return

        self.knight.update(dt)

        any_detecting = False
        for patrol in self.patrols:
            patrol.update(dt, self.knight.pos)
            if patrol.detecting:
                any_detecting = True
            patrol.attempt_damage(self.knight)

        self.patrols = [p for p in self.patrols if p.alive]

        if self.knight.hp <= 0:
            self.state = "defeat"
            return

        reinforcement_ready = self.dark_lord.update(dt, any_detecting)
        if any_detecting and reinforcement_ready:
            self.spawn_patrol_near_castle(PATROL_REINFORCEMENT_COUNT)

        hits = self.knight.try_attack(self.patrols)
        for patrol in hits:
            patrol.alive = False
        if hits:
            self.patrols = [p for p in self.patrols if p.alive]

        self._update_victory(dt)

    def _update_victory(self, dt: float) -> None:
        if self.knight.pos.distance_to(CASTLE_POS) <= CASTLE_WIN_RADIUS:
            self.knight.castle_timer += dt
            if self.knight.castle_timer >= CASTLE_STAY_TIME:
                self.state = "victory"
        else:
            self.knight.castle_timer = 0.0

    def draw(self) -> None:
        self.screen.fill(BACKGROUND_COLOR)
        self._draw_castle()
        for patrol in self.patrols:
            patrol.draw(self.screen)
        self.knight.draw(self.screen)
        self.knight.draw_swing(self.screen)
        self._draw_hud()
        if self.state == "victory":
            self._draw_overlay("VICTORY", VICTORY_COLOR)
        elif self.state == "defeat":
            self._draw_overlay("DEFEAT", DEFEAT_COLOR)
        pygame.display.flip()

    def _draw_castle(self) -> None:
        pulse = (math.sin(pygame.time.get_ticks() / 300.0) + 1) * 0.5
        size = CASTLE_SIZE + pulse * 4
        rect = pygame.Rect(0, 0, size, size)
        rect.center = CASTLE_POS.xy
        color = (
            min(255, int(CASTLE_COLOR[0] + pulse * 40)),
            min(255, int(CASTLE_COLOR[1] + pulse * 40)),
            min(255, int(CASTLE_COLOR[2] + pulse * 40)),
        )
        pygame.draw.rect(self.screen, color, rect)

    def _draw_hud(self) -> None:
        text = f"HP: {self.knight.hp}  Evil: {self.dark_lord.evil_energy}  Patrols: {len(self.patrols)}"
        surface = self.font.render(text, True, HUD_COLOR)
        self.screen.blit(surface, (12, 12))

    def _draw_overlay(self, text: str, color: tuple[int, int, int]) -> None:
        overlay = pygame.Surface((WIDTH, HEIGHT), pygame.SRCALPHA)
        overlay.fill((0, 0, 0, 160))
        self.screen.blit(overlay, (0, 0))
        rendered = self.large_font.render(text, True, color)
        rect = rendered.get_rect(center=(WIDTH / 2, HEIGHT / 2))
        self.screen.blit(rendered, rect)


def main() -> None:
    game = Game()
    try:
        game.run()
    finally:
        pygame.quit()


if __name__ == "__main__":
    main()
