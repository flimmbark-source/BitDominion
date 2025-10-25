import math
import random
from typing import List

import pygame


# Constants
WIDTH, HEIGHT = 800, 800
FPS = 60
CASTLE_POS = pygame.math.Vector2(WIDTH / 2, HEIGHT / 2)
CASTLE_SIZE = 20
CASTLE_DAMAGE_RADIUS = 18

HERO_MAX_HP = 10
BASE_ATTACK_DAMAGE = 2
ATTACK_COOLDOWN = 0.35

PATROL_SIZE = 4
PATROL_HP = 3
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

HIT_FLASH_DURATION = 0.2
HIT_PARTICLE_DURATION = 0.25
DAMAGE_NUMBER_DURATION = 0.8
DAMAGE_NUMBER_SPEED = 40
SCREEN_SHAKE_DURATION = 0.25
SCREEN_SHAKE_MAGNITUDE = 8.0

BACKGROUND_COLOR = (0, 0, 0)
PATROL_COLOR = (200, 40, 40)
PATROL_ALERT_COLOR = (255, 90, 90)
CASTLE_COLOR = (130, 0, 180)
HUD_COLOR = (220, 220, 220)
VICTORY_COLOR = (80, 200, 120)
DEFEAT_COLOR = (220, 60, 60)
DAMAGE_NUMBER_COLOR = (255, 218, 185)
HIT_PARTICLE_COLOR = (255, 200, 60)


class DamageNumber:
    """Floating combat text that rises and fades over time."""

    def __init__(self, position: pygame.math.Vector2, amount: float):
        self.position = position.copy()
        self.amount = amount
        self.age = 0.0
        self.duration = DAMAGE_NUMBER_DURATION

    def update(self, dt: float) -> bool:
        self.age += dt
        self.position.y -= DAMAGE_NUMBER_SPEED * dt
        return self.age < self.duration

    def draw(self, surface: pygame.Surface, font: pygame.font.Font) -> None:
        ratio = max(0.0, 1.0 - self.age / self.duration)
        text_surface = font.render(str(int(math.ceil(self.amount))), True, DAMAGE_NUMBER_COLOR)
        text_surface.set_alpha(int(255 * ratio))
        rect = text_surface.get_rect(center=self.position)
        surface.blit(text_surface, rect)


class HitParticle:
    """Radial burst that highlights successful strikes."""

    def __init__(self, position: pygame.math.Vector2):
        self.position = position.copy()
        self.age = 0.0
        self.duration = HIT_PARTICLE_DURATION

    def update(self, dt: float) -> bool:
        self.age += dt
        return self.age < self.duration

    def draw(self, surface: pygame.Surface) -> None:
        if self.age >= self.duration:
            return
        t = max(0.0, min(1.0, self.age / self.duration))
        radius = 6 + t * 18
        alpha = int(220 * (1 - t))
        size = max(2, int(radius * 2))
        particle_surface = pygame.Surface((size, size), pygame.SRCALPHA)
        pygame.draw.circle(
            particle_surface,
            (*HIT_PARTICLE_COLOR, alpha),
            (size // 2, size // 2),
            max(1, int(radius)),
            width=2,
        )
        surface.blit(particle_surface, particle_surface.get_rect(center=self.position))


class Patrol:
    """Autonomous patrol that hunts the castle and can be struck by the player."""

    def __init__(self, position: pygame.math.Vector2):
        self.pos = position
        self.velocity = pygame.math.Vector2(0, 0)
        self.detecting = False
        self.wander_timer = 0.0
        self.damage_timer = 0.0
        self.hit_flash_timer = 0.0
        self.hp = float(PATROL_HP)
        self.alive = True

    def update(self, dt: float, target_pos: pygame.math.Vector2) -> None:
        if not self.alive:
            return
        dt_ratio = dt * FPS
        self.wander_timer -= dt
        if self.wander_timer <= 0:
            self._pick_new_direction()

        to_target = target_pos - self.pos
        distance = to_target.length()
        self.detecting = distance <= PATROL_DETECT_RADIUS
        if distance > 0 and self.detecting:
            desired = to_target.normalize() * max(self.velocity.length(), PATROL_MAX_SPEED)
            self.velocity = self.velocity.lerp(desired, PATROL_DETECTION_LERP * dt_ratio)

        self.pos += self.velocity * dt_ratio
        self._handle_bounds()

        if self.damage_timer > 0.0:
            self.damage_timer = max(0.0, self.damage_timer - dt)

        if self.hit_flash_timer > 0.0:
            self.hit_flash_timer = max(0.0, self.hit_flash_timer - dt)

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

    def attempt_damage(self, target_pos: pygame.math.Vector2, radius: float) -> bool:
        if not self.alive or self.damage_timer > 0.0:
            return False
        if self.pos.distance_to(target_pos) <= radius:
            self.damage_timer = PATROL_DAMAGE_COOLDOWN
            return True
        return False

    def take_damage(self, amount: float) -> float:
        if not self.alive or amount <= 0:
            return 0.0
        pre_hp = self.hp
        self.hp = max(0.0, self.hp - amount)
        self.hit_flash_timer = HIT_FLASH_DURATION
        if self.hp <= 0:
            self.alive = False
        return max(0.0, pre_hp - self.hp)

    def contains_point(self, point: pygame.math.Vector2) -> bool:
        half = PATROL_SIZE / 2
        return (
            self.alive
            and self.pos.x - half <= point.x <= self.pos.x + half
            and self.pos.y - half <= point.y <= self.pos.y + half
        )

    def draw(self, surface: pygame.Surface) -> None:
        if not self.alive:
            return
        base_color = PATROL_ALERT_COLOR if self.detecting else PATROL_COLOR
        if self.hit_flash_timer > 0.0:
            flash_ratio = self.hit_flash_timer / HIT_FLASH_DURATION
            flash = min(1.0, flash_ratio)
            color = (
                min(255, int(base_color[0] + (255 - base_color[0]) * flash)),
                min(255, int(base_color[1] + (255 - base_color[1]) * flash)),
                min(255, int(base_color[2] + (255 - base_color[2]) * flash)),
            )
        else:
            color = base_color
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

        self.patrols: List[Patrol] = []
        self.dark_lord = DarkLord()
        self.state = "running"

        self.hero_hp = HERO_MAX_HP
        self.hero_max_hp = HERO_MAX_HP
        self.attack_cooldown_timer = 0.0
        self.scene_surface = pygame.Surface((WIDTH, HEIGHT)).convert()
        self.damage_numbers: List[DamageNumber] = []
        self.hit_particles: List[HitParticle] = []
        self.screen_shake_timer = 0.0
        self.screen_shake_duration = 0.0
        self.screen_shake_magnitude = 0.0
        self.screen_shake_offset = pygame.math.Vector2(0, 0)

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
                self._handle_attack_input(pygame.math.Vector2(event.pos))
        return True

    def _handle_attack_input(self, position: pygame.math.Vector2) -> None:
        clamped = pygame.math.Vector2(
            max(0, min(WIDTH, position.x)),
            max(0, min(HEIGHT, position.y)),
        )
        self._perform_attack(clamped)

    def _perform_attack(self, position: pygame.math.Vector2) -> None:
        if self.attack_cooldown_timer > 0.0:
            return
        target = self._pick_attack_target(position)
        if not target:
            return
        damage = BASE_ATTACK_DAMAGE
        dealt = target.take_damage(damage)
        if dealt <= 0:
            return
        self.attack_cooldown_timer = ATTACK_COOLDOWN
        self._spawn_hit_particle(target.pos)
        self._spawn_damage_number(target.pos, dealt)
        self._trigger_screen_shake()
        if not target.alive:
            self.patrols = [p for p in self.patrols if p.alive]

    def _pick_attack_target(self, position: pygame.math.Vector2):
        best = None
        best_dist = float("inf")
        for patrol in self.patrols:
            if not patrol.contains_point(position):
                continue
            dist = patrol.pos.distance_to(position)
            if dist < best_dist:
                best = patrol
                best_dist = dist
        if best:
            return best
        for patrol in self.patrols:
            if not patrol.alive:
                continue
            dist = patrol.pos.distance_to(position)
            if dist <= PATROL_SIZE * 1.5 and dist < best_dist:
                best = patrol
                best_dist = dist
        return best

    def _spawn_damage_number(self, position: pygame.math.Vector2, amount: float) -> None:
        self.damage_numbers.append(DamageNumber(position, amount))

    def _spawn_hit_particle(self, position: pygame.math.Vector2) -> None:
        self.hit_particles.append(HitParticle(position))

    def _trigger_screen_shake(self, magnitude: float = SCREEN_SHAKE_MAGNITUDE, duration: float = SCREEN_SHAKE_DURATION) -> None:
        self.screen_shake_timer = duration
        self.screen_shake_duration = duration
        self.screen_shake_magnitude = magnitude

    def _update_effects(self, dt: float) -> None:
        self.damage_numbers = [number for number in self.damage_numbers if number.update(dt)]
        self.hit_particles = [particle for particle in self.hit_particles if particle.update(dt)]
        if self.screen_shake_timer > 0.0:
            self.screen_shake_timer = max(0.0, self.screen_shake_timer - dt)
            if self.screen_shake_duration > 0.0:
                ratio = self.screen_shake_timer / self.screen_shake_duration
            else:
                ratio = 0.0
            magnitude = self.screen_shake_magnitude * ratio
            angle = random.uniform(0, 2 * math.pi)
            self.screen_shake_offset = pygame.math.Vector2(math.cos(angle), math.sin(angle)) * magnitude
            if self.screen_shake_timer <= 0.0:
                self.screen_shake_offset.update(0, 0)
                self.screen_shake_magnitude = 0.0
                self.screen_shake_duration = 0.0
        else:
            if self.screen_shake_offset.length_squared() > 0:
                self.screen_shake_offset.update(0, 0)

    def _damage_hero(self, amount: int) -> None:
        if amount <= 0:
            return
        self.hero_hp = max(0, self.hero_hp - amount)
        self._spawn_hit_particle(CASTLE_POS)
        self._trigger_screen_shake(SCREEN_SHAKE_MAGNITUDE * 0.6, SCREEN_SHAKE_DURATION)

    def update(self, dt: float) -> None:
        if self.state != "running":
            return

        self.attack_cooldown_timer = max(0.0, self.attack_cooldown_timer - dt)
        self._update_effects(dt)

        any_detecting = False
        for patrol in self.patrols:
            patrol.update(dt, CASTLE_POS)
            if patrol.detecting:
                any_detecting = True
            if patrol.attempt_damage(CASTLE_POS, CASTLE_DAMAGE_RADIUS):
                self._damage_hero(1)

        self.patrols = [p for p in self.patrols if p.alive]

        if self.hero_hp <= 0:
            self.state = "defeat"
            return

        reinforcement_ready = self.dark_lord.update(dt, any_detecting)
        if any_detecting and reinforcement_ready:
            self.spawn_patrol_near_castle(PATROL_REINFORCEMENT_COUNT)

        if not self.patrols:
            self.state = "victory"

    def draw(self) -> None:
        self.scene_surface.fill(BACKGROUND_COLOR)
        self._draw_castle(self.scene_surface)
        for patrol in self.patrols:
            patrol.draw(self.scene_surface)
        for particle in self.hit_particles:
            particle.draw(self.scene_surface)
        for number in self.damage_numbers:
            number.draw(self.scene_surface, self.font)

        offset = (int(self.screen_shake_offset.x), int(self.screen_shake_offset.y))
        self.screen.fill(BACKGROUND_COLOR)
        self.screen.blit(self.scene_surface, offset)

        self._draw_hud()
        if self.state == "victory":
            self._draw_overlay("VICTORY", VICTORY_COLOR)
        elif self.state == "defeat":
            self._draw_overlay("DEFEAT", DEFEAT_COLOR)
        pygame.display.flip()

    def _draw_castle(self, surface: pygame.Surface) -> None:
        pulse = (math.sin(pygame.time.get_ticks() / 300.0) + 1) * 0.5
        size = CASTLE_SIZE + pulse * 4
        rect = pygame.Rect(0, 0, size, size)
        rect.center = CASTLE_POS.xy
        color = (
            min(255, int(CASTLE_COLOR[0] + pulse * 40)),
            min(255, int(CASTLE_COLOR[1] + pulse * 40)),
            min(255, int(CASTLE_COLOR[2] + pulse * 40)),
        )
        pygame.draw.rect(surface, color, rect)

    def _draw_hud(self) -> None:
        cooldown_ratio = self.attack_cooldown_timer / ATTACK_COOLDOWN if ATTACK_COOLDOWN > 0 else 0
        cooldown_text = "Ready" if cooldown_ratio <= 0 else f"Cooldown: {cooldown_ratio:.2f}s"
        text = (
            f"HP: {int(self.hero_hp)}/{self.hero_max_hp}  "
            f"Evil: {self.dark_lord.evil_energy}  Patrols: {len(self.patrols)}  "
            f"Attack: {cooldown_text}"
        )
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
