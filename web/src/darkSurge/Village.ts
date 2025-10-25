import { Vector2 } from '../math/vector2';
import type { Village as WorldVillage } from '../world';
import { Building, type BuildingAttackResult } from './Building';
import type { VillageConfig } from './WaveController';

export interface VillageAttackEvent {
  village: Village;
  damageApplied: number;
  buildingResult: BuildingAttackResult | null;
  destroyedBuilding: Building | null;
  collapsed: boolean;
}

const ATTACK_FLASH_DURATION = 1.2;

export class Village {
  public readonly id: number;
  public readonly center: Vector2;
  public readonly canopyRadius: number;
  public readonly source: WorldVillage;
  public readonly buildings: Building[] = [];

  private readonly config: VillageConfig;
  private readonly onCollapseCallback?: (village: Village) => void;

  private maxHp: number;
  private hp: number;
  private destroyed = false;
  private attackFlashTimer = 0;
  private collapseTimer = 0;
  private burnIntensity = 0;

  constructor(
    id: number,
    source: WorldVillage,
    config: VillageConfig,
    onCollapse?: (village: Village) => void
  ) {
    this.id = id;
    this.source = source;
    this.center = source.center.clone();
    this.canopyRadius = source.canopyRadius;
    this.config = config;
    this.onCollapseCallback = onCollapse;

    const buildingHp = Math.max(1, config.hpPerBuilding);
    this.maxHp = Math.max(buildingHp, buildingHp * source.huts.length);
    this.hp = this.maxHp;

    let buildingId = 1;
    for (const hut of source.huts) {
      const building = new Building({
        id: buildingId++,
        position: hut.center.clone(),
        maxHp: buildingHp,
        igniteThreshold: config.igniteThreshold,
        burnDamagePerSecond: config.burnDamagePerSecond,
        onDestroyed: () => this.handleBuildingDestroyed()
      });
      this.buildings.push(building);
    }
  }

  getIntegrity(): number {
    return this.maxHp === 0 ? 0 : Math.max(0, this.hp) / this.maxHp;
  }

  isDestroyed(): boolean {
    return this.destroyed;
  }

  isBurning(): boolean {
    if (this.destroyed) {
      return false;
    }
    return this.buildings.some((building) => building.isBurning());
  }

  getBurnIntensity(): number {
    return this.destroyed ? 0 : this.burnIntensity;
  }

  getCollapseProgress(): number {
    if (!this.destroyed) {
      return 0;
    }
    return Math.min(1, this.collapseTimer / Math.max(0.01, this.config.collapseDelay));
  }

  getAttackFlash(): number {
    if (this.destroyed) {
      return 0;
    }
    return Math.max(0, Math.min(1, this.attackFlashTimer / ATTACK_FLASH_DURATION));
  }

  getAttackPoint(): Vector2 {
    return this.center.clone();
  }

  update(dt: number): void {
    if (!Number.isFinite(dt) || dt <= 0) {
      return;
    }

    let burning = false;
    for (const building of this.buildings) {
      building.update(dt);
      if (building.isBurning()) {
        burning = true;
      }
    }

    if (burning) {
      this.burnIntensity = Math.min(1, this.burnIntensity + dt / Math.max(0.1, this.config.collapseDelay));
    } else {
      this.burnIntensity = Math.max(0, this.burnIntensity - dt * 0.6);
    }

    if (this.attackFlashTimer > 0) {
      this.attackFlashTimer = Math.max(0, this.attackFlashTimer - dt);
    }

    if (this.destroyed) {
      this.collapseTimer += dt;
      this.source.alarmed = false;
    } else {
      this.source.alarmed = burning || this.attackFlashTimer > 0;
    }
  }

  receiveAttack(damage: number): VillageAttackEvent | null {
    if (damage <= 0 || this.destroyed) {
      return null;
    }

    this.attackFlashTimer = ATTACK_FLASH_DURATION;
    this.hp = Math.max(0, this.hp - damage);

    const intact = this.buildings.filter((building) => !building.isDestroyed());
    let destroyedBuilding: Building | null = null;
    let buildingResult: BuildingAttackResult | null = null;

    if (intact.length > 0) {
      const target = intact[Math.floor(Math.random() * intact.length)];
      buildingResult = target.onAttack(damage);
      if (buildingResult.destroyed) {
        destroyedBuilding = target;
      }
    }

    if (this.hp <= 0 || this.buildings.every((building) => building.isDestroyed())) {
      this.destroyVillage();
    }

    return {
      village: this,
      damageApplied: damage,
      buildingResult,
      destroyedBuilding,
      collapsed: this.destroyed
    };
  }

  beginDowntime(): void {
    if (this.destroyed) {
      return;
    }
    const missing = this.maxHp - this.hp;
    if (missing > 0) {
      this.hp = Math.min(this.maxHp, this.hp + missing * this.config.repairFraction);
    }
    for (const building of this.buildings) {
      building.beginDowntime(this.config.repairFraction);
    }
    this.attackFlashTimer = 0;
    this.burnIntensity = 0;
    this.source.alarmed = false;
  }

  collectIncome(): number {
    if (this.destroyed) {
      return 0;
    }
    const intact = this.buildings.filter((building) => !building.isDestroyed()).length;
    if (intact === 0) {
      return 0;
    }
    return Math.round(intact * this.config.incomePerBuilding);
  }

  private handleBuildingDestroyed(): void {
    if (this.destroyed) {
      return;
    }
    if (this.buildings.every((building) => building.isDestroyed())) {
      this.destroyVillage();
    }
  }

  private destroyVillage(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.collapseTimer = 0;
    for (const building of this.buildings) {
      if (!building.isDestroyed()) {
        building.onDestroy();
      }
    }
    if (this.onCollapseCallback) {
      this.onCollapseCallback(this);
    }
  }
}
