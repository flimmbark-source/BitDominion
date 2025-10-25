import { Config } from '../config/config';
import { Vector2 } from '../math/vector2';
import type { Village as WorldVillage } from '../world';
import { Building, type BuildingAttackResult } from './Building';

export interface VillageAttackEvent {
  village: Village;
  damageApplied: number;
  buildingResult: BuildingAttackResult | null;
  destroyedBuilding: Building | null;
  villagersLost: number;
  focus: 'buildings' | 'villagers';
  collapsed: boolean;
}

const ATTACK_FLASH_DURATION = 1.2;

export interface VillageConfig {
  buildingHp: number;
  igniteThreshold: number;
  burnDamagePerSecond: number;
  collapseDelay: number;
  incomePerBuilding: number;
  repairFraction: number;
  population: number;
}

export class Village {
  public readonly id: number;
  public readonly center: Vector2;
  public readonly canopyRadius: number;
  public readonly source: WorldVillage;
  public readonly buildings: Building[] = [];

  private readonly config: VillageConfig;
  private readonly onCollapseCallback?: (village: Village) => void;

  private structuralMaxHp: number;
  private structuralHp: number;
  private maxPopulation: number;
  private population: number;
  private destroyed = false;
  private attackFlashTimer = 0;
  private collapseTimer = 0;
  private burnIntensity = 0;
  private underAttackTimer = 0;

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

    const buildingHp = Math.max(1, config.buildingHp ?? Config.waves.buildingHP);
    this.structuralMaxHp = Math.max(buildingHp, buildingHp * source.huts.length);
    this.structuralHp = this.structuralMaxHp;
    this.maxPopulation = Math.max(0, Math.round(config.population ?? Config.waves.villagePopulation));
    this.population = this.maxPopulation;

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
    return this.structuralMaxHp === 0
      ? 0
      : Math.max(0, this.structuralHp) / this.structuralMaxHp;
  }

  getStructuralHp(): number {
    return Math.max(0, this.structuralHp);
  }

  getStructuralMaxHp(): number {
    return this.structuralMaxHp;
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

    if (this.underAttackTimer > 0) {
      this.underAttackTimer = Math.max(0, this.underAttackTimer - dt);
    }

    if (this.destroyed) {
      this.collapseTimer += dt;
      this.source.alarmed = false;
    } else {
      this.source.alarmed = burning || this.attackFlashTimer > 0 || this.underAttackTimer > 0;
    }
  }

  receiveAttack(damage: number): VillageAttackEvent | null {
    if (damage <= 0 || this.destroyed) {
      return null;
    }

    this.attackFlashTimer = ATTACK_FLASH_DURATION;
    this.underAttackTimer = ATTACK_FLASH_DURATION;
    const applied = Math.max(0, damage);
    this.structuralHp = Math.max(0, this.structuralHp - applied);

    const intact = this.buildings.filter((building) => !building.isDestroyed());
    let destroyedBuilding: Building | null = null;
    let buildingResult: BuildingAttackResult | null = null;

    if (intact.length > 0) {
      const target = intact[Math.floor(Math.random() * intact.length)];
      buildingResult = target.onAttack(applied);
      if (buildingResult.destroyed) {
        destroyedBuilding = target;
      }
    }

    const allDestroyed = this.buildings.every((building) => building.isDestroyed());
    if (this.structuralHp <= 0 || allDestroyed) {
      this.structuralHp = 0;
      if (!this.hasPopulation()) {
        this.destroyVillage();
      }
    }

    return {
      village: this,
      damageApplied: applied,
      buildingResult,
      destroyedBuilding,
      villagersLost: 0,
      focus: 'buildings',
      collapsed: this.destroyed
    };
  }

  receiveVillagerRaid(damage: number): VillageAttackEvent | null {
    if (damage <= 0 || this.destroyed || this.population <= 0) {
      return null;
    }

    this.attackFlashTimer = ATTACK_FLASH_DURATION;
    this.underAttackTimer = ATTACK_FLASH_DURATION;
    const applied = Math.max(0, damage);
    const estimatedLoss = Math.max(1, Math.round(applied / 2));
    const villagersLost = Math.min(this.population, estimatedLoss);
    this.population = Math.max(0, this.population - villagersLost);

    if (this.population <= 0 && this.structuralHp <= 0) {
      this.destroyVillage();
    }

    return {
      village: this,
      damageApplied: applied,
      buildingResult: null,
      destroyedBuilding: null,
      villagersLost,
      focus: 'villagers',
      collapsed: this.destroyed
    };
  }

  hasPopulation(): boolean {
    return this.population > 0;
  }

  getPopulationRatio(): number {
    return this.maxPopulation === 0 ? 0 : this.population / this.maxPopulation;
  }

  getPopulation(): number {
    return this.population;
  }

  getMaxPopulation(): number {
    return this.maxPopulation;
  }

  getRemainingStructures(): number {
    return this.structuralHp;
  }

  hasIntactBuildings(): boolean {
    return this.structuralHp > 0 && this.buildings.some((building) => !building.isDestroyed());
  }

  getUnderAttackIntensity(): number {
    if (this.destroyed) {
      return 0;
    }
    return Math.max(0, Math.min(1, this.underAttackTimer / ATTACK_FLASH_DURATION));
  }

  beginDowntime(): void {
    if (this.destroyed) {
      return;
    }
    const missing = this.structuralMaxHp - this.structuralHp;
    if (missing > 0) {
      this.structuralHp = Math.min(
        this.structuralMaxHp,
        this.structuralHp + missing * this.config.repairFraction
      );
    }
    for (const building of this.buildings) {
      building.beginDowntime(this.config.repairFraction);
    }
    this.attackFlashTimer = 0;
    this.burnIntensity = 0;
    this.source.alarmed = false;
    this.underAttackTimer = 0;
  }

  getRepairableHp(): number {
    if (this.destroyed) {
      return 0;
    }
    const structuralMissing = Math.max(0, this.structuralMaxHp - this.structuralHp);
    let buildingMissing = 0;
    for (const building of this.buildings) {
      if (building.isDestroyed()) {
        continue;
      }
      buildingMissing += building.getMissingHp();
    }
    return Math.max(structuralMissing, buildingMissing);
  }

  repairStructuresFully(): number {
    if (this.destroyed) {
      return 0;
    }
    let restored = 0;
    for (const building of this.buildings) {
      if (building.isDestroyed()) {
        continue;
      }
      restored += building.repairToFull();
    }
    if (restored > 0) {
      this.structuralHp = Math.min(this.structuralMaxHp, this.structuralHp + restored);
      this.attackFlashTimer = 0;
      this.underAttackTimer = 0;
      this.burnIntensity = 0;
    }
    return restored;
  }

  collectIncome(): number {
    if (this.destroyed) {
      return 0;
    }
    const intact = this.buildings.filter((building) => !building.isDestroyed()).length;
    if (intact === 0 || this.population <= 0) {
      return 0;
    }
    return Math.round(intact * this.config.incomePerBuilding);
  }

  private handleBuildingDestroyed(): void {
    if (this.destroyed) {
      return;
    }
    if (this.buildings.every((building) => building.isDestroyed())) {
      this.structuralHp = 0;
      if (!this.hasPopulation()) {
        this.destroyVillage();
      }
    }
  }

  private destroyVillage(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.collapseTimer = 0;
    this.structuralHp = 0;
    this.population = 0;
    this.underAttackTimer = 0;
    for (const building of this.buildings) {
      if (!building.isDestroyed()) {
        building.onDestroy();
      }
    }
    this.source.alarmed = false;
    if (this.onCollapseCallback) {
      this.onCollapseCallback(this);
    }
  }
}
