export const Config = {
  click: {
    baseDamage: 15,
    cooldownMs: 120,
    clickAssistRadius: 32,
    dmgTextLifespanMs: 600,
    screenshakeIntensity: 0.01
  },
  modifiers: {
    costs: {
      multiHit: 30,
      splash: 45,
      dot: 50,
      crit: 60,
      autoClick: 120
    },
    caps: {
      multiHit: 5,
      splashRadiusMax: 96,
      critMax: 0.5,
      autoClickMaxRps: 8
    },
    defaults: {
      multiHit: 2,
      splash: { radius: 48, pct: 0.4 },
      dot: { dps: 6, durationMs: 2000 },
      crit: { chance: 0.1, multiplier: 1.5 },
      autoClick: { ratePerSec: 1 }
    }
  },
  waves: {
    firstDelayMs: 120000,
    prepWindowMs: 25000,
    swarmGroupsByWave: (wave: number) => 3 + Math.floor(wave / 1),
    enemiesPerSwarm: (wave: number) => 6 + 2 * wave,
    firstWaveEnemyHp: 100,
    enemyBase: { hp: 88, atk: 4, speed: 38 },
    buildingHP: 300,
    villagePopulation: 10
  },
  economy: {
    baseGoldPerVillage: 20,
    repairCostPerHP: 0.1,
    questGold: { small: 15, medium: 30 }
  }
} as const;

export type GameConfig = typeof Config;
