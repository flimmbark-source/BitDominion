import { KNIGHT_HP, KNIGHT_SIZE, KNIGHT_SPAWN_POS } from '../config/constants';
import { Vector2 } from '../math/vector2';
import type { World } from '../world';
import type { DarkUnit } from './darkUnit';

export class Knight {
  public pos = KNIGHT_SPAWN_POS.clone();
  public velocity = new Vector2();
  public hp = KNIGHT_HP;
  public castleTimer = 0;

  update(_dt: number, world: World): void {
    this.velocity.set(0, 0);
    world.constrainToArena(this, KNIGHT_SIZE / 2);
  }

  setTarget(_target: Vector2): void {
    // Movement disabled — pointer clicks no longer drive pathing.
  }

  tryAttack(_units: DarkUnit[]): DarkUnit[] {
    return [];
  }

  equipMeleeWeapon(): void {
    // Melee combat removed in favor of click-driven attacks.
  }

  getMeleeDamage(_multiplier = 1): number {
    return 0;
  }

  setTemporarySpeedMultiplier(_multiplier: number): void {
    // Movement modifiers are ignored without pathing.
  }

  draw(_ctx: CanvasRenderingContext2D): void {
    // Player pawn hidden on the map.
  }
}
