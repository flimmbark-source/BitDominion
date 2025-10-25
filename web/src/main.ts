import './style.css';
import { Game, CameraState, NearbyQuestInteraction, QuestLogEntry } from './game';
import type { ClickLoadout, ClickModifierId } from './game/items/ClickModifiers';
import { HEIGHT, WIDTH, VIEWPORT_WIDTH, VIEWPORT_HEIGHT, BuildingType, DOWNTIME_DURATION } from './config/constants';
import { getBuildingDefinition } from './entities/building';
import { ITEM_DEFINITIONS, ITEM_ORDER, ItemId, WeaponItemId } from './config/items';
import {
  META_WEAPON_TRACKS,
  type MetaUpgradeId,
  getMetaUpgradesForWeapon,
  getMetaUpgradeDefinition,
  getWeaponDefinitionForMeta
} from './config/metaProgression';
import {
  createIsoTransform,
  worldToScreen as isoWorldToScreen,
  screenToWorld as isoScreenToWorld,
  projectRadius as isoProjectRadius
} from './utils/isometric';

const BUILDING_DISPLAY: Record<BuildingType, { icon: string; name: string; description: string }> = {
  watchtower: {
    icon: '🏹',
    name: 'Watchtower',
    description: 'Ranged tower that fires at invaders. Gains range from workshop auras.'
  },
  barricade: {
    icon: '🛡️',
    name: 'Barricade',
    description: 'Sturdy barrier that blocks foes and slows the knight when nearby.'
  },
  spike: {
    icon: '✴️',
    name: 'Spike Trap',
    description: 'Single-use trap that harms and slows monsters that pass over it.'
  },
  beacon: {
    icon: '📡',
    name: 'Lure Beacon',
    description: 'Broadcasts false sightings, drawing patrols away from the castle.'
  },
  workshop: {
    icon: '⚙️',
    name: 'Workshop',
    description: 'Empowers structures in a large radius and unlocks advanced tech.'
  }
};

type TutorialStepId = 'movement' | 'combat' | 'building' | 'noise' | 'quests' | 'healing' | 'arsenal';

interface TutorialStepDefinition {
  readonly title: string;
  readonly body: string;
  readonly icon: string;
  readonly keys?: readonly string[];
}

const TUTORIAL_STEPS: Record<TutorialStepId, TutorialStepDefinition> = {
  movement: {
    title: 'Movement Basics',
    body: 'Left-click the ground to guide Rowan. The valley is fully visible, so plan your path at a glance.',
    icon: '🧭',
    keys: ['Left Click']
  },
  combat: {
    title: 'Hold the Line',
    body: 'During waves, stay mobile and kite patrols. Rowan swings at nearby foes automatically when they get close.',
    icon: '⚔️',
    keys: ['Left Click']
  },
  building: {
    title: 'Raise Defenses',
    body: 'Press B or tap the hammer button to open the Workshop. Choose a structure, then left-click to place it.',
    icon: '🏗️',
    keys: ['B', 'Left Click']
  },
  noise: {
    title: 'Noise & Suspicion',
    body: 'Attacks, sprinting, and some buildings create pulses that alert patrols. Watch the orange rings and reposition if things get loud.',
    icon: '🔊'
  },
  quests: {
    title: 'Village Quests',
    body: 'Approach quest givers to accept side objectives. Finish them during downtime for supplies and buffs.',
    icon: '📜'
  },
  healing: {
    title: 'Catch Your Breath',
    body: 'Rest inside the Emberwatch inn during downtime to slowly restore Rowan’s health before the next assault.',
    icon: '💖'
  },
  arsenal: {
    title: 'Check the Inventory',
    body: 'Press I during downtime to open your Inventory and review weapon evolutions.',
    icon: '⚔️',
    keys: ['I']
  }
};

interface TutorialManagerOptions {
  readonly onPause?: () => void;
  readonly onResume?: () => void;
  readonly onComplete?: (id: TutorialStepId) => void;
}

class TutorialManager {
  private readonly completed = new Set<TutorialStepId>();
  private queue: TutorialStepId[] = [];
  private active: TutorialStepId | null = null;
  private activeElement: HTMLDivElement | null = null;

  constructor(private readonly layer: HTMLDivElement, private readonly options: TutorialManagerOptions = {}) {}

  request(id: TutorialStepId, options?: { priority?: boolean }): void {
    if (this.completed.has(id) || this.queue.includes(id) || this.active === id) {
      return;
    }
    if (options?.priority) {
      this.queue.unshift(id);
    } else {
      this.queue.push(id);
    }
    this.maybeShowNext();
  }

  complete(id: TutorialStepId): boolean {
    if (this.completed.has(id)) {
      return false;
    }
    this.completed.add(id);
    this.queue = this.queue.filter((step) => step !== id);
    if (this.active === id) {
      this.removeActiveHint();
    }
    this.options.onComplete?.(id);
    this.maybeShowNext();
    return true;
  }

  isCompleted(id: TutorialStepId): boolean {
    return this.completed.has(id);
  }

  isQueued(id: TutorialStepId): boolean {
    return this.queue.includes(id) || this.active === id;
  }

  private maybeShowNext(): void {
    if (this.active) {
      return;
    }
    while (this.queue.length) {
      const next = this.queue.shift();
      if (!next || this.completed.has(next)) {
        continue;
      }
      this.showHint(next);
      break;
    }
  }

  private showHint(id: TutorialStepId): void {
    const step = TUTORIAL_STEPS[id];
    const card = document.createElement('div');
    card.className = 'tutorial-hint-card';
    card.dataset.step = id;
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');

    const header = document.createElement('div');
    header.className = 'tutorial-hint-header';

    const icon = document.createElement('div');
    icon.className = 'tutorial-hint-icon';
    icon.textContent = step.icon;
    icon.setAttribute('aria-hidden', 'true');

    const title = document.createElement('h2');
    title.className = 'tutorial-hint-title';
    title.textContent = step.title;
    const titleId = `tutorial-${id}-title`;
    title.id = titleId;

    header.append(icon, title);

    const body = document.createElement('p');
    body.className = 'tutorial-hint-body';
    body.textContent = step.body;
    const bodyId = `tutorial-${id}-body`;
    body.id = bodyId;
    card.setAttribute('aria-labelledby', titleId);
    card.setAttribute('aria-describedby', bodyId);

    card.append(header, body);

    if (step.keys && step.keys.length > 0) {
      const keyRow = document.createElement('div');
      keyRow.className = 'tutorial-hint-keys';
      for (const key of step.keys) {
        const keyTag = document.createElement('span');
        keyTag.className = 'tutorial-hint-key';
        keyTag.textContent = key;
        keyRow.appendChild(keyTag);
      }
      card.appendChild(keyRow);
    }

    const actions = document.createElement('div');
    actions.className = 'tutorial-hint-actions';

    const skipButton = document.createElement('button');
    skipButton.type = 'button';
    skipButton.className = 'tutorial-hint-skip';
    skipButton.textContent = 'Skip Tutorial';
    skipButton.addEventListener('click', () => {
      this.skipAll();
    });

    const dismissButton = document.createElement('button');
    dismissButton.type = 'button';
    dismissButton.className = 'tutorial-hint-dismiss';
    dismissButton.textContent = 'Got it';
    dismissButton.addEventListener('click', () => {
      this.complete(id);
    });
    actions.append(skipButton, dismissButton);
    card.appendChild(actions);

    this.layer.appendChild(card);
    this.active = id;
    this.activeElement = card;
    this.options.onPause?.();
    dismissButton.focus();
  }

  private removeActiveHint(): void {
    if (this.activeElement && this.activeElement.parentElement === this.layer) {
      this.layer.removeChild(this.activeElement);
    }
    this.active = null;
    this.activeElement = null;
    this.options.onResume?.();
  }

  private skipAll(): void {
    (Object.keys(TUTORIAL_STEPS) as TutorialStepId[]).forEach((stepId) => {
      this.completed.add(stepId);
    });
    this.queue = [];
    this.removeActiveHint();
  }
}

const INVENTORY_SLOTS = ITEM_ORDER.length + 1;
const GAME_SHELL_GAP = 0;

const appRoot = document.querySelector<HTMLDivElement>('#app');
if (!appRoot) {
  throw new Error('Missing #app root element');
}

const appRootElement: HTMLDivElement = appRoot;

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector(selector);
  if (!element) {
    throw new Error(`Missing element: ${selector}`);
  }
  return element as T;
}

appRootElement.innerHTML = `
  <div class="game-shell">
    <div class="game-container" id="gameContainer">
      <canvas id="gameCanvas" class="game-canvas"></canvas>
      <div class="camp-marker-layer" id="campMarkerLayer"></div>
      <div class="dark-energy ui-panel" id="darkEnergyClock">
        <div class="panel-heading">
          <h2>Dark Energy</h2>
          <button class="info-button" id="downtimeInfo" type="button" aria-label="Downtime timing help">?</button>
        </div>
        <div class="bar"><div class="bar-fill" id="darkEnergyFill"></div></div>
        <p id="darkEnergyText">Gathering energy…</p>
        <div class="next-wave-timer" id="nextWaveTimer">Next wave: --</div>
        <div class="downtime-quest-panel hidden" id="downtimeQuestPanel">
          <div class="quest-header" id="downtimeQuestTitle"></div>
          <div class="quest-body" id="downtimeQuestDescription"></div>
          <div class="quest-progress" id="downtimeQuestProgress"></div>
        </div>
      </div>
      <div class="lore-banner ui-panel" id="loreBanner">
        <div class="lore-banner-header">
          <h2>Emberwatch Briefing</h2>
          <button class="lore-banner-dismiss" id="loreBannerDismiss" type="button" aria-label="Hide story intro">×</button>
        </div>
        <p>
          Sir Rowan, last knight of Emberwatch, holds the breach as waves of dark energy spill from the Hollow Vale.
        </p>
        <p>
          The tavern cellar shelters Mirella's roaming workshop—an artisan crew that brews supplies while you raise defenses for the night.
        </p>
      </div>
      <div class="resource-panel ui-panel stats-panel">
        <div class="stat-row">
          <span class="stat-label gold">Gold</span>
          <span class="stat-value" id="heroGoldText">0</span>
          <span class="resource-gain" id="heroGoldGain" aria-live="polite"></span>
        </div>
        <div class="stat-row">
          <span class="stat-label shards">Relic Shards</span>
          <span class="stat-value" id="heroShardText">0</span>
          <span class="resource-gain" id="heroShardGain" aria-live="polite"></span>
        </div>
      </div>
      <div class="hud">
        <div class="hud-bottom-row">
          <div class="hud-section hud-section--left">
            <div class="ui-panel inventory" id="inventoryPanel"></div>
          </div>
          <div class="hud-section hud-section--center">
            <button class="ui-panel build-toggle" id="buildPrompt" type="button">
              <span class="build-toggle-icon" aria-hidden="true">🔨</span>
              <span class="build-toggle-text">(B)uild</span>
            </button>
            <div class="build-feedback" id="buildErrorMessage" role="status" aria-live="polite"></div>
          </div>
          <div class="hud-section hud-section--right">
            <div class="ui-panel buffs-panel" id="buffsPanel">
              <div class="buffs-title">Temporary Blessings</div>
              <ul class="buffs-list" id="buffList"></ul>
            </div>
          </div>
        </div>
      </div>
      <div class="village-status-panel hidden" id="villageStatusPanel">
        <h3>Village Status</h3>
        <ul class="village-status-list" id="villageStatusList"></ul>
      </div>
      <div class="shop-panel ui-panel hidden" id="buildingShopPanel">
        <h2>Workshop Ledger</h2>
        <div class="shop-items" id="shopItemsContainer"></div>
      </div>
      <div class="tavern-overlay hidden" id="itemShopPanel" aria-hidden="true">
        <div class="tavern-dialog" role="dialog" aria-modal="true" aria-labelledby="tavernDialogTitle">
          <div class="tavern-dialog-header">
            <div class="tavern-dialog-titles">
              <h2 class="tavern-dialog-title" id="tavernDialogTitle">Mirella's Tavern Workshop</h2>
              <p class="tavern-dialog-subtitle">Spend supplies between waves to refit Rowan's arsenal.</p>
            </div>
            <button class="tavern-dialog-close" id="itemShopClose" type="button" aria-label="Leave tavern shop">×</button>
          </div>
          <div class="tavern-dialog-body">
            <aside class="tavern-overview" aria-labelledby="tavernOverviewTitle">
              <h3 class="tavern-overview-title" id="tavernOverviewTitle">Loadout Summary</h3>
              <p class="tavern-overview-description">
                Tune weapons and support relics before the next assault. Upgrades only trade during downtime.
              </p>
              <div class="click-loadout-summary" id="clickLoadoutSummary"></div>
            </aside>
            <div class="tavern-service-area">
              <div class="tavern-service-header">
                <h3>Available Upgrades</h3>
                <p>Choose a weapon or support relic to empower Rowan.</p>
              </div>
              <div class="shop-items" id="itemShopItemsContainer"></div>
            </div>
          </div>
          <div class="tavern-dialog-footer">
            <button class="tavern-footer-button" id="itemShopLeave" type="button">Leave Tavern</button>
            <div class="tavern-footer-hint">Press <span class="key-hint">B</span> or walk away to close.</div>
          </div>
        </div>
      </div>
      <div class="tooltip" id="tooltipPanel"></div>
      <div class="game-over hidden" id="gameOverScreen">
        <h2 id="gameOverTitle">You Have Perished</h2>
        <p id="gameOverSubtext">Press R to try again.</p>
      </div>
      <div class="quest-dialog hidden" id="questDialog" aria-hidden="true">
        <div class="quest-dialog-panel">
          <div class="quest-dialog-header">
            <div class="quest-dialog-icon" id="questDialogIcon" aria-hidden="true">📜</div>
            <div class="quest-dialog-titles">
              <div class="quest-dialog-title" id="questDialogTitle">Quest Offer</div>
              <div class="quest-dialog-subtitle" id="questDialogSubtitle"></div>
            </div>
            <button class="quest-dialog-close" id="questDialogClose" type="button" aria-label="Dismiss quest prompt">×</button>
          </div>
          <div class="quest-dialog-body">
            <p class="quest-dialog-greeting" id="questDialogGreeting"></p>
            <p class="quest-dialog-description" id="questDialogDescription"></p>
            <p class="quest-dialog-reward" id="questDialogReward"></p>
            <div class="quest-dialog-progress hidden" id="questDialogProgress">
              <div class="quest-dialog-progress-bar" id="questDialogProgressFill"></div>
            </div>
          </div>
          <div class="quest-dialog-actions" id="questDialogActions">
            <button class="quest-action-button" id="questDialogPrimary" type="button">Accept Quest</button>
            <button class="quest-action-button secondary" id="questDialogSecondary" type="button">Not now</button>
          </div>
        </div>
      </div>
      <div class="quest-log-overlay hidden" id="questLogOverlay" aria-hidden="true">
        <div class="quest-log-panel">
          <div class="quest-log-header">
            <h2>Quest Log</h2>
            <button class="quest-log-close" id="questLogClose" type="button" aria-label="Close quest log">×</button>
          </div>
          <p class="quest-log-subtitle">Active contracts from allied villages.</p>
          <ul class="quest-log-list" id="questLogList"></ul>
        </div>
      </div>
      <div class="inventory-overlay hidden" id="inventoryOverlay" aria-hidden="true">
        <div class="inventory-modal" role="dialog" aria-modal="true" aria-labelledby="inventoryOverlayTitle">
          <div class="inventory-modal-header">
            <div>
              <h2 class="inventory-modal-title" id="inventoryOverlayTitle">Hero Inventory</h2>
              <p class="inventory-modal-subtitle">Inspect your loadout and monitor evolution progress.</p>
            </div>
            <button class="inventory-modal-close" id="inventoryOverlayClose" type="button" aria-label="Close inventory">×</button>
          </div>
          <div class="inventory-modal-body">
            <div class="inventory-modal-list" id="inventoryOverlayList" role="list"></div>
            <aside class="inventory-preview hidden" id="inventoryOverlayPreview">
              <div class="inventory-preview-header">
                <div class="inventory-preview-icon" id="inventoryPreviewIcon" aria-hidden="true">🗡️</div>
                <div class="inventory-preview-titles">
                  <h3 class="inventory-preview-title" id="inventoryPreviewTitle">Loadout Item</h3>
                  <div class="inventory-preview-progress" id="inventoryPreviewProgress"></div>
                </div>
              </div>
              <p class="inventory-preview-description" id="inventoryPreviewDescription"></p>
              <div class="inventory-preview-evolution hidden" id="inventoryPreviewEvolution">
                <h4 class="inventory-preview-evolution-title">Evolution Preview</h4>
                <div class="inventory-preview-evolution-name" id="inventoryPreviewEvolutionName"></div>
                <p class="inventory-preview-evolution-description" id="inventoryPreviewEvolutionDescription"></p>
              </div>
            </aside>
          </div>
        </div>
      </div>
      <div class="meta-overlay hidden" id="metaProgressionOverlay" aria-hidden="true">
        <div class="meta-panel" role="dialog" aria-modal="true" aria-labelledby="metaOverlayTitle">
          <div class="meta-header">
            <div class="meta-header-titles">
              <h2 class="meta-overlay-title" id="metaOverlayTitle">Relic Forge</h2>
              <p class="meta-overlay-subtitle">Spend Relic Shards to unlock weapon upgrades for future runs.</p>
            </div>
            <div class="meta-header-actions">
              <div class="meta-shard-counter">Relic Shards: <span id="metaShardCount">0</span></div>
              <button class="meta-overlay-close" id="metaOverlayClose" type="button" aria-label="Close relic forge">×</button>
            </div>
          </div>
          <div class="meta-body">
            <div class="meta-weapon-grid" id="metaWeaponList" role="list"></div>
            <div class="meta-weapon-detail hidden" id="metaWeaponDetail">
              <button class="meta-back-button" id="metaWeaponBack" type="button">← Back to Arsenal</button>
              <div class="meta-weapon-detail-header">
                <div class="meta-weapon-detail-icon" id="metaWeaponDetailIcon" aria-hidden="true">🔪</div>
                <div class="meta-weapon-detail-titles">
                  <h3 class="meta-weapon-detail-title" id="metaWeaponDetailTitle">Weapon</h3>
                  <p class="meta-weapon-detail-overview" id="metaWeaponDetailOverview"></p>
                </div>
              </div>
              <div class="meta-upgrade-grid" id="metaUpgradeList"></div>
            </div>
          </div>
        </div>
      </div>
      <div class="item-detail-overlay hidden" id="itemDetailOverlay" aria-hidden="true">
        <div class="item-detail-panel" role="dialog" aria-modal="true" aria-labelledby="itemDetailTitle">
          <button class="item-detail-close" id="itemDetailClose" type="button" aria-label="Close item details">×</button>
          <div class="item-detail-header">
            <div class="item-detail-icon" id="itemDetailIcon" aria-hidden="true">🔥</div>
            <div class="item-detail-titles">
              <h2 class="item-detail-title" id="itemDetailTitle">Item</h2>
              <div class="item-detail-role" id="itemDetailRole"></div>
            </div>
          </div>
          <div class="item-detail-meta" id="itemDetailMeta"></div>
          <p class="item-detail-description" id="itemDetailDescription"></p>
          <div class="item-detail-section hidden" id="itemDetailEvolutionSection">
            <h3 class="item-detail-section-title">Evolution</h3>
            <div class="item-detail-evolution-name" id="itemDetailEvolutionName"></div>
            <p class="item-detail-evolution-description" id="itemDetailEvolutionDescription"></p>
            <p class="item-detail-requirement" id="itemDetailRequirement"></p>
            <p class="item-detail-status" id="itemDetailStatus"></p>
          </div>
          <div class="item-detail-section hidden" id="itemDetailTipsSection">
            <h3 class="item-detail-section-title">Build Paths</h3>
            <ul class="item-detail-tip-list" id="itemDetailTips"></ul>
          </div>
        </div>
      </div>
      <div class="escape-menu hidden" id="escapeMenu" aria-hidden="true">
        <div class="escape-menu-panel" role="dialog" aria-modal="true" aria-labelledby="escapeMenuTitle">
          <div class="escape-menu-header">
            <h2 class="escape-menu-title" id="escapeMenuTitle">Campfire Menu</h2>
            <button class="escape-menu-close" id="escapeMenuClose" type="button" aria-label="Close menu">×</button>
          </div>
          <div class="escape-menu-actions">
            <button class="escape-menu-button primary" id="escapeMenuResume" type="button">Resume Adventure</button>
            <button
              class="escape-menu-button"
              id="escapeMenuHelpToggle"
              type="button"
              aria-expanded="false"
              aria-controls="escapeMenuHelpContent"
            >
              Help &amp; Tips
            </button>
          </div>
          <div class="escape-menu-help hidden" id="escapeMenuHelpContent" aria-hidden="true">
            <div class="escape-menu-help-section">
              <h3>Map Controls</h3>
              <p>The entire battlefield is framed on screen—just click to move Rowan and manage your defenses.</p>
            </div>
            <div class="escape-menu-help-section">
              <h3>Noise &amp; Suspicion</h3>
              <p>Orange pulses mark noise that raises suspicion. Patrols will investigate loud spots, so reposition or lure them away.</p>
            </div>
          </div>
        </div>
      </div>
      <div class="tutorial-hint-layer" id="tutorialHintLayer" aria-live="polite"></div>
    </div>
  </div>
`;

const canvas = requireElement<HTMLCanvasElement>('#gameCanvas');
canvas.width = VIEWPORT_WIDTH;
canvas.height = VIEWPORT_HEIGHT;

const context = canvas.getContext('2d');
if (!context) {
  throw new Error('Unable to create canvas rendering context');
}

const gameContainerElement = requireElement<HTMLDivElement>('#gameContainer');

function updateGameViewportSize(): void {
  const appStyles = getComputedStyle(appRootElement);
  const paddingX = parseFloat(appStyles.paddingLeft) + parseFloat(appStyles.paddingRight);
  const paddingY = parseFloat(appStyles.paddingTop) + parseFloat(appStyles.paddingBottom);
  const availableWidth = Math.max(0, window.innerWidth - paddingX);
  const availableHeight = Math.max(0, window.innerHeight - paddingY - GAME_SHELL_GAP);
  const aspectRatio = VIEWPORT_WIDTH / VIEWPORT_HEIGHT;

  let targetWidth = availableWidth;
  let targetHeight = targetWidth / aspectRatio;

  if (targetHeight > availableHeight) {
    targetHeight = availableHeight;
    targetWidth = targetHeight * aspectRatio;
  }

  if (
    !Number.isFinite(targetWidth) ||
    !Number.isFinite(targetHeight) ||
    targetWidth <= 0 ||
    targetHeight <= 0
  ) {
    gameContainerElement.style.removeProperty('--game-width');
    gameContainerElement.style.removeProperty('--game-height');
    return;
  }

  gameContainerElement.style.setProperty('--game-width', `${targetWidth}px`);
  gameContainerElement.style.setProperty('--game-height', `${targetHeight}px`);
}

window.addEventListener('resize', updateGameViewportSize);
window.addEventListener('orientationchange', updateGameViewportSize);
updateGameViewportSize();

const game = new Game();
game.setCanvasHudEnabled(false);

const CLICK_UPGRADES_STORAGE_KEY = 'bitdominion_click_upgrades';

function loadPersistentClickUpgrades(): ItemId[] {
  try {
    const raw = window.localStorage.getItem(CLICK_UPGRADES_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((value: unknown): value is ItemId =>
      typeof value === 'string' && value in ITEM_DEFINITIONS
    );
  } catch (error) {
    console.warn('Unable to load click modifiers from storage', error);
    return [];
  }
}

function savePersistentClickUpgrades(ids: Iterable<ItemId>): void {
  try {
    const unique = Array.from(new Set(ids));
    window.localStorage.setItem(CLICK_UPGRADES_STORAGE_KEY, JSON.stringify(unique));
  } catch (error) {
    console.warn('Unable to persist click modifiers', error);
  }
}

const persistentClickItems = new Set<ItemId>(loadPersistentClickUpgrades());
game.setPersistentItems([...persistentClickItems]);

const MIN_CAMERA_ZOOM = 0.6;
const MAX_CAMERA_ZOOM = 1.8;
const DEFAULT_CAMERA_ZOOM = 1.2;
let cameraZoom = DEFAULT_CAMERA_ZOOM;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

let isoTransform = createIsoTransform(canvas.width, canvas.height, cameraZoom);

function updateIsoProjection(): void {
  isoTransform = createIsoTransform(canvas.width, canvas.height, cameraZoom);
}

function adjustCameraZoom(multiplier: number): void {
  cameraZoom = clamp(cameraZoom * multiplier, MIN_CAMERA_ZOOM, MAX_CAMERA_ZOOM);
  updateIsoProjection();
}

canvas.addEventListener(
  'wheel',
  (event: WheelEvent) => {
    if (event.ctrlKey) {
      return;
    }
    event.preventDefault();
    const zoomFactor = Math.exp(-event.deltaY * 0.0015);
    adjustCameraZoom(zoomFactor);
  },
  { passive: false }
);

updateIsoProjection();

const tooltipPanel = requireElement<HTMLDivElement>('#tooltipPanel');
const inventoryPanel = requireElement<HTMLDivElement>('#inventoryPanel');
const heroGoldText = requireElement<HTMLSpanElement>('#heroGoldText');
const heroGoldGain = requireElement<HTMLSpanElement>('#heroGoldGain');
const heroShardText = requireElement<HTMLSpanElement>('#heroShardText');
const heroShardGain = requireElement<HTMLSpanElement>('#heroShardGain');
const buildPrompt = requireElement<HTMLButtonElement>('#buildPrompt');
const buildErrorMessage = requireElement<HTMLDivElement>('#buildErrorMessage');
const darkEnergyFill = requireElement<HTMLDivElement>('#darkEnergyFill');
const darkEnergyText = requireElement<HTMLParagraphElement>('#darkEnergyText');
const nextWaveTimerText = requireElement<HTMLDivElement>('#nextWaveTimer');
const villageStatusPanel = requireElement<HTMLDivElement>('#villageStatusPanel');
const villageStatusList = requireElement<HTMLUListElement>('#villageStatusList');
const downtimeQuestPanel = requireElement<HTMLDivElement>('#downtimeQuestPanel');
const downtimeQuestTitle = requireElement<HTMLDivElement>('#downtimeQuestTitle');
const downtimeQuestDescription = requireElement<HTMLDivElement>('#downtimeQuestDescription');
const downtimeQuestProgress = requireElement<HTMLDivElement>('#downtimeQuestProgress');
const downtimeInfoButton = requireElement<HTMLButtonElement>('#downtimeInfo');
const buffList = requireElement<HTMLUListElement>('#buffList');
const campMarkerLayer = requireElement<HTMLDivElement>('#campMarkerLayer');
const buildingShopPanel = requireElement<HTMLDivElement>('#buildingShopPanel');
const buildingShopItemsContainer = requireElement<HTMLDivElement>('#shopItemsContainer');
const itemShopPanel = requireElement<HTMLDivElement>('#itemShopPanel');
const itemShopItemsContainer = requireElement<HTMLDivElement>('#itemShopItemsContainer');
const itemShopCloseButton = requireElement<HTMLButtonElement>('#itemShopClose');
const itemShopLeaveButton = requireElement<HTMLButtonElement>('#itemShopLeave');
const clickLoadoutSummary = requireElement<HTMLDivElement>('#clickLoadoutSummary');
const gameOverScreen = requireElement<HTMLDivElement>('#gameOverScreen');
const gameOverTitle = requireElement<HTMLHeadingElement>('#gameOverTitle');
const gameOverSubtext = requireElement<HTMLParagraphElement>('#gameOverSubtext');
const questLogOverlay = requireElement<HTMLDivElement>('#questLogOverlay');
const questLogList = requireElement<HTMLUListElement>('#questLogList');
const questLogCloseButton = requireElement<HTMLButtonElement>('#questLogClose');
const inventoryOverlay = requireElement<HTMLDivElement>('#inventoryOverlay');
const inventoryOverlayClose = requireElement<HTMLButtonElement>('#inventoryOverlayClose');
const inventoryOverlayList = requireElement<HTMLDivElement>('#inventoryOverlayList');
const inventoryOverlayPreview = requireElement<HTMLDivElement>('#inventoryOverlayPreview');
const inventoryPreviewIcon = requireElement<HTMLDivElement>('#inventoryPreviewIcon');
const inventoryPreviewTitle = requireElement<HTMLHeadingElement>('#inventoryPreviewTitle');
const inventoryPreviewDescription = requireElement<HTMLParagraphElement>('#inventoryPreviewDescription');
const inventoryPreviewProgress = requireElement<HTMLDivElement>('#inventoryPreviewProgress');
const inventoryPreviewEvolution = requireElement<HTMLDivElement>('#inventoryPreviewEvolution');
const inventoryPreviewEvolutionName = requireElement<HTMLDivElement>('#inventoryPreviewEvolutionName');
const inventoryPreviewEvolutionDescription = requireElement<HTMLParagraphElement>(
  '#inventoryPreviewEvolutionDescription'
);
const metaProgressionOverlay = requireElement<HTMLDivElement>('#metaProgressionOverlay');
const metaOverlayClose = requireElement<HTMLButtonElement>('#metaOverlayClose');
const metaShardCount = requireElement<HTMLSpanElement>('#metaShardCount');
const metaWeaponList = requireElement<HTMLDivElement>('#metaWeaponList');
const metaWeaponDetail = requireElement<HTMLDivElement>('#metaWeaponDetail');
const metaWeaponBack = requireElement<HTMLButtonElement>('#metaWeaponBack');
const metaWeaponDetailIcon = requireElement<HTMLDivElement>('#metaWeaponDetailIcon');
const metaWeaponDetailTitle = requireElement<HTMLHeadingElement>('#metaWeaponDetailTitle');
const metaWeaponDetailOverview = requireElement<HTMLParagraphElement>('#metaWeaponDetailOverview');
const metaUpgradeList = requireElement<HTMLDivElement>('#metaUpgradeList');
const itemDetailOverlay = requireElement<HTMLDivElement>('#itemDetailOverlay');
const itemDetailCloseButton = requireElement<HTMLButtonElement>('#itemDetailClose');
const itemDetailIcon = requireElement<HTMLDivElement>('#itemDetailIcon');
const itemDetailTitle = requireElement<HTMLHeadingElement>('#itemDetailTitle');
const itemDetailRole = requireElement<HTMLDivElement>('#itemDetailRole');
const itemDetailMeta = requireElement<HTMLDivElement>('#itemDetailMeta');
const itemDetailDescription = requireElement<HTMLParagraphElement>('#itemDetailDescription');
const itemDetailEvolutionSection = requireElement<HTMLDivElement>('#itemDetailEvolutionSection');
const itemDetailEvolutionName = requireElement<HTMLDivElement>('#itemDetailEvolutionName');
const itemDetailEvolutionDescription = requireElement<HTMLParagraphElement>(
  '#itemDetailEvolutionDescription'
);
const itemDetailRequirement = requireElement<HTMLParagraphElement>('#itemDetailRequirement');
const itemDetailStatus = requireElement<HTMLParagraphElement>('#itemDetailStatus');
const itemDetailTipsSection = requireElement<HTMLDivElement>('#itemDetailTipsSection');
const itemDetailTips = requireElement<HTMLUListElement>('#itemDetailTips');
const questDialogElement = requireElement<HTMLDivElement>('#questDialog');
const questDialogIcon = requireElement<HTMLDivElement>('#questDialogIcon');
const questDialogTitle = requireElement<HTMLDivElement>('#questDialogTitle');
const questDialogSubtitle = requireElement<HTMLDivElement>('#questDialogSubtitle');
const questDialogGreeting = requireElement<HTMLParagraphElement>('#questDialogGreeting');
const questDialogDescription = requireElement<HTMLParagraphElement>('#questDialogDescription');
const questDialogReward = requireElement<HTMLParagraphElement>('#questDialogReward');
const questDialogProgress = requireElement<HTMLDivElement>('#questDialogProgress');
const questDialogProgressFill = requireElement<HTMLDivElement>('#questDialogProgressFill');
const questDialogPrimary = requireElement<HTMLButtonElement>('#questDialogPrimary');
const questDialogSecondary = requireElement<HTMLButtonElement>('#questDialogSecondary');
const questDialogCloseButton = requireElement<HTMLButtonElement>('#questDialogClose');
const tutorialHintLayer = requireElement<HTMLDivElement>('#tutorialHintLayer');
const loreBanner = requireElement<HTMLDivElement>('#loreBanner');
const loreBannerDismissButton = requireElement<HTMLButtonElement>('#loreBannerDismiss');
const escapeMenu = requireElement<HTMLDivElement>('#escapeMenu');
const escapeMenuResumeButton = requireElement<HTMLButtonElement>('#escapeMenuResume');
const escapeMenuCloseButton = requireElement<HTMLButtonElement>('#escapeMenuClose');
const escapeMenuHelpToggle = requireElement<HTMLButtonElement>('#escapeMenuHelpToggle');
const escapeMenuHelpContent = requireElement<HTMLDivElement>('#escapeMenuHelpContent');

const LORE_BANNER_STORAGE_KEY = 'bitdominion.loreBannerDismissed';

function hideLoreBanner(persist: boolean): void {
  loreBanner.classList.add('hidden');
  loreBanner.setAttribute('aria-hidden', 'true');
  if (!persist) {
    return;
  }
  try {
    window.localStorage.setItem(LORE_BANNER_STORAGE_KEY, 'true');
  } catch (error) {
    console.warn('Unable to persist lore banner dismissal', error);
  }
}

function showLoreBanner(): void {
  loreBanner.classList.remove('hidden');
  loreBanner.setAttribute('aria-hidden', 'false');
}

let loreBannerDismissed = false;
try {
  loreBannerDismissed = window.localStorage.getItem(LORE_BANNER_STORAGE_KEY) === 'true';
} catch (error) {
  console.warn('Unable to read lore banner dismissal state', error);
}

if (loreBannerDismissed) {
  hideLoreBanner(false);
} else {
  showLoreBanner();
}

loreBannerDismissButton.addEventListener('click', () => {
  hideLoreBanner(true);
});

escapeMenuResumeButton.addEventListener('click', () => closeEscapeMenu());
escapeMenuCloseButton.addEventListener('click', () => closeEscapeMenu());
escapeMenuHelpToggle.addEventListener('click', () => {
  const expanded = escapeMenuHelpToggle.getAttribute('aria-expanded') === 'true';
  const nextExpanded = !expanded;
  escapeMenuHelpToggle.setAttribute('aria-expanded', String(nextExpanded));
  escapeMenuHelpContent.classList.toggle('hidden', !nextExpanded);
  escapeMenuHelpContent.setAttribute('aria-hidden', nextExpanded ? 'false' : 'true');
});
escapeMenu.addEventListener('click', (event) => {
  if (event.target === escapeMenu) {
    closeEscapeMenu();
  }
});

itemShopCloseButton.addEventListener('click', () => setItemShopOpen(false));
itemShopLeaveButton.addEventListener('click', () => setItemShopOpen(false));
itemShopPanel.addEventListener('click', (event) => {
  if (event.target === itemShopPanel) {
    setItemShopOpen(false);
  }
});

let tutorialPaused = false;

const tutorialManager = new TutorialManager(tutorialHintLayer, {
  onPause: () => {
    tutorialPaused = true;
  },
  onResume: () => {
    tutorialPaused = false;
  }
});
tutorialManager.request('movement', { priority: true });

game.setNoiseListener((strength) => {
  if (
    strength > 0 &&
    tutorialManager.isCompleted('building') &&
    !tutorialManager.isCompleted('noise') &&
    !tutorialManager.isQueued('noise')
  ) {
    tutorialManager.request('noise', { priority: true });
  }
});

let lastSupplies = game.getSupplies();
let lastRelicShards = game.getRelicShards();
let pendingGoldGain = 0;
let pendingShardGain = 0;
let lastKillCount = game.getTotalKills();
let lastAtTavern = game.isKnightAtTavern();

function resetGoldGainIndicator(): void {
  pendingGoldGain = 0;
  heroGoldGain.textContent = '';
  heroGoldGain.classList.remove('resource-gain--active');
}

function showGoldGainIndicator(amount: number): void {
  if (amount <= 0) {
    return;
  }
  pendingGoldGain += amount;
  heroGoldGain.textContent = `+${pendingGoldGain}`;
  heroGoldGain.classList.remove('resource-gain--active');
  void heroGoldGain.offsetWidth;
  heroGoldGain.classList.add('resource-gain--active');
}

heroGoldGain.addEventListener('animationend', resetGoldGainIndicator);

function resetShardGainIndicator(): void {
  pendingShardGain = 0;
  heroShardGain.textContent = '';
  heroShardGain.classList.remove('resource-gain--active');
}

function showShardGainIndicator(amount: number): void {
  if (amount <= 0) {
    return;
  }
  pendingShardGain += amount;
  heroShardGain.textContent = `+${pendingShardGain}`;
  heroShardGain.classList.remove('resource-gain--active');
  void heroShardGain.offsetWidth;
  heroShardGain.classList.add('resource-gain--active');
}

heroShardGain.addEventListener('animationend', resetShardGainIndicator);

const inventorySlots: HTMLDivElement[] = [];
for (let i = 0; i < INVENTORY_SLOTS; i++) {
  const slot = document.createElement('div');
  slot.className = 'inventory-slot empty';
  inventoryPanel.appendChild(slot);
  inventorySlots.push(slot);
}

const buildingShopButtons = new Map<BuildingType, HTMLButtonElement>();
const itemButtons = new Map<ItemId, HTMLButtonElement>();
const campMarkers = new Map<number, HTMLDivElement>();
const campMarkerEmpty = document.createElement('div');
campMarkerEmpty.className = 'camp-marker-empty hidden';
campMarkerEmpty.textContent = 'Scouts report no roaming packs.';
campMarkerLayer.appendChild(campMarkerEmpty);
const defeatedCampIds = new Set<number>();
const campRemovalTimers = new Map<number, number>();

function showTooltip(title: string, body: string) {
  tooltipPanel.innerHTML = `<div class="title">${title}</div><div>${body}</div>`;
  tooltipPanel.style.display = 'block';
}

function hideTooltip() {
  tooltipPanel.style.display = 'none';
}

function bindInfoTooltip(button: HTMLButtonElement, title: string, body: string): void {
  const show = () => showTooltip(title, body);
  const hide = () => hideTooltip();
  button.addEventListener('mouseenter', show);
  button.addEventListener('mouseleave', hide);
  button.addEventListener('focus', show);
  button.addEventListener('blur', hide);
  button.addEventListener('click', show);
}

function formatTimer(seconds: number): string {
  const clamped = Math.max(0, seconds);
  if (clamped < 10) {
    return `${clamped.toFixed(1)}s`;
  }
  const minutes = Math.floor(clamped / 60);
  const secs = Math.floor(clamped % 60);
  if (minutes <= 0) {
    return `${secs}s`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

bindInfoTooltip(
  downtimeInfoButton,
  'Downtime & Waves',
  `This meter counts the ${formatTimer(DOWNTIME_DURATION)} downtime window. Build, heal, and gear up before it fills and the next wave begins.`
);

let isEscapeMenuOpen = false;
let escapeMenuLastFocus: HTMLElement | null = null;

function openEscapeMenu(): void {
  if (isEscapeMenuOpen) {
    return;
  }
  isEscapeMenuOpen = true;
  closeInventoryOverlay();
  closeMetaOverlay();
  setQuestLogOpen(false);
  setItemShopOpen(false);
  closeItemDetail();
  escapeMenuLastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  escapeMenuHelpToggle.setAttribute('aria-expanded', 'false');
  escapeMenuHelpContent.classList.add('hidden');
  escapeMenuHelpContent.setAttribute('aria-hidden', 'true');
  escapeMenu.classList.remove('hidden');
  escapeMenu.setAttribute('aria-hidden', 'false');
  escapeMenuResumeButton.focus();
}

function closeEscapeMenu(options?: { restoreFocus?: boolean }): void {
  if (!isEscapeMenuOpen) {
    return;
  }
  isEscapeMenuOpen = false;
  escapeMenu.classList.add('hidden');
  escapeMenu.setAttribute('aria-hidden', 'true');
  const shouldRestoreFocus = options?.restoreFocus ?? true;
  if (shouldRestoreFocus && escapeMenuLastFocus && document.contains(escapeMenuLastFocus)) {
    escapeMenuLastFocus.focus();
  }
  escapeMenuLastFocus = null;
}

document.addEventListener('pointermove', (event) => {
  if (tooltipPanel.style.display === 'none') {
    return;
  }

  const baseLeft = event.clientX + 16;
  const baseTop = event.clientY + 18;
  tooltipPanel.style.left = `${baseLeft}px`;
  tooltipPanel.style.top = `${baseTop}px`;

  const rect = tooltipPanel.getBoundingClientRect();
  const margin = 8;
  let left = baseLeft;
  let top = baseTop;

  if (left + rect.width > window.innerWidth - margin) {
    left = Math.max(margin, window.innerWidth - rect.width - margin);
  } else if (left < margin) {
    left = margin;
  }

  if (top + rect.height > window.innerHeight - margin) {
    top = event.clientY - rect.height - 12;
  }
  if (top < margin) {
    top = margin;
  }

  tooltipPanel.style.left = `${left}px`;
  tooltipPanel.style.top = `${top}px`;
});

type ItemDetailOptions = { progressText?: string; evolved?: boolean };

let activeItemDetailId: ItemId | null = null;

function closeItemDetail(): void {
  if (!activeItemDetailId) {
    return;
  }
  activeItemDetailId = null;
  itemDetailOverlay.classList.add('hidden');
  itemDetailOverlay.setAttribute('aria-hidden', 'true');
}

function openItemDetail(itemId: ItemId, options?: ItemDetailOptions): void {
  const definition = ITEM_DEFINITIONS[itemId];
  if (!definition) {
    return;
  }
  hideTooltip();
  activeItemDetailId = itemId;
  const costText = definition.cost > 0 ? `${definition.cost} Gold` : 'Starting gear';
  const categoryText = definition.category === 'weapon' ? 'Weapon' : 'Support';
  itemDetailIcon.textContent = definition.icon;
  itemDetailTitle.textContent = definition.name;
  itemDetailRole.textContent = definition.role;
  itemDetailMeta.textContent = `${categoryText} • Cost: ${costText}`;
  itemDetailDescription.textContent = definition.description;

  if (definition.evolution) {
    itemDetailEvolutionSection.classList.remove('hidden');
    itemDetailEvolutionName.textContent = definition.evolution.name;
    itemDetailEvolutionDescription.textContent = definition.evolution.description;
    const requirement = definition.evolveRequirement;
    if (requirement) {
      itemDetailRequirement.textContent = `Requirement: ${requirement.count} ${requirement.label}`;
      itemDetailRequirement.classList.remove('hidden');
    } else {
      itemDetailRequirement.textContent = '';
      itemDetailRequirement.classList.add('hidden');
    }
    if (options?.progressText) {
      const statusLabel = options.evolved ? 'Status' : 'Progress';
      itemDetailStatus.textContent = `${statusLabel}: ${options.progressText}`;
      itemDetailStatus.classList.remove('hidden');
    } else {
      itemDetailStatus.textContent = '';
      itemDetailStatus.classList.add('hidden');
    }
  } else {
    itemDetailEvolutionSection.classList.add('hidden');
    itemDetailRequirement.textContent = '';
    itemDetailRequirement.classList.add('hidden');
    itemDetailStatus.textContent = '';
    itemDetailStatus.classList.add('hidden');
  }

  itemDetailTips.innerHTML = '';
  if (definition.stats.length) {
    for (const stat of definition.stats) {
      const li = document.createElement('li');
      li.textContent = stat;
      itemDetailTips.appendChild(li);
    }
    itemDetailTipsSection.classList.remove('hidden');
  } else {
    itemDetailTipsSection.classList.add('hidden');
  }

  itemDetailOverlay.classList.remove('hidden');
  itemDetailOverlay.setAttribute('aria-hidden', 'false');
  itemDetailCloseButton.focus();
}

itemDetailCloseButton.addEventListener('click', () => {
  closeItemDetail();
});

itemDetailOverlay.addEventListener('click', (event) => {
  if (event.target === itemDetailOverlay) {
    closeItemDetail();
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && activeItemDetailId) {
    event.preventDefault();
    closeItemDetail();
  }
});

function updateInventoryPreview(entry: LoadoutEntry): void {
  inventoryOverlayPreview.classList.remove('hidden');
  inventoryOverlayPreview.setAttribute('aria-hidden', 'false');
  inventoryPreviewIcon.textContent = entry.icon;
  inventoryPreviewTitle.textContent = entry.name;
  inventoryPreviewDescription.textContent = entry.description;
  let progressText: string;
  if (entry.category !== 'weapon') {
    progressText = 'Passive effect active.';
  } else if (entry.evolved) {
    progressText = 'Evolved form active.';
  } else if (entry.progress) {
    progressText = entry.progress.ready
      ? 'Ready to evolve! Visit the workshop or fulfill the trigger to ascend this weapon.'
      : `${entry.progress.current}/${entry.progress.required} ${entry.progress.label} to evolve.`;
  } else {
    progressText = 'Awakening — continue fighting to unlock evolution clues.';
  }
  inventoryPreviewProgress.textContent = progressText;
  inventoryPreviewProgress.classList.toggle('ready', !!entry.progress?.ready && !entry.evolved);
  const definition = ITEM_DEFINITIONS[entry.id];
  if (definition?.evolution) {
    inventoryPreviewEvolution.classList.remove('hidden');
    inventoryPreviewEvolution.setAttribute('aria-hidden', 'false');
    inventoryPreviewEvolutionName.textContent = definition.evolution.name;
    inventoryPreviewEvolutionDescription.textContent = definition.evolution.description;
  } else {
    inventoryPreviewEvolution.classList.add('hidden');
    inventoryPreviewEvolution.setAttribute('aria-hidden', 'true');
    inventoryPreviewEvolutionName.textContent = '';
    inventoryPreviewEvolutionDescription.textContent = '';
  }
}

function setActiveInventoryPreview(itemId: ItemId, entries?: LoadoutEntry[]): void {
  const loadout = entries ?? game.getHeroLoadout();
  const entry = loadout.find((candidate) => candidate.id === itemId);
  if (!entry) {
    return;
  }
  activeInventoryPreviewId = itemId;
  const cards = inventoryOverlayList.querySelectorAll<HTMLButtonElement>('.inventory-card');
  cards.forEach((card) => {
    card.classList.toggle('active', card.dataset.itemId === itemId);
  });
  updateInventoryPreview(entry);
}

function renderInventoryOverlay(): void {
  const loadout = game.getHeroLoadout();
  const signature = loadout
    .map((entry) => {
      const progress = entry.progress
        ? `${entry.progress.current}-${entry.progress.ready ? 'ready' : 'waiting'}`
        : 'none';
      return `${entry.id}:${entry.evolved ? 'evolved' : 'base'}:${progress}`;
    })
    .join('|');

  if (loadout.length > 0 && isInventoryOverlayOpen && signature === lastInventoryOverlaySignature) {
    if (activeInventoryPreviewId && loadout.some((entry) => entry.id === activeInventoryPreviewId)) {
      setActiveInventoryPreview(activeInventoryPreviewId, loadout);
    }
    return;
  }
  lastInventoryOverlaySignature = signature;
  inventoryOverlayList.innerHTML = '';
  if (!loadout.length) {
    const empty = document.createElement('p');
    empty.className = 'inventory-modal-empty';
    empty.textContent = 'You have not collected any gear yet.';
    inventoryOverlayList.appendChild(empty);
    inventoryOverlayPreview.classList.add('hidden');
    inventoryOverlayPreview.setAttribute('aria-hidden', 'true');
    activeInventoryPreviewId = null;
    return;
  }

  for (const entry of loadout) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'inventory-card';
    card.dataset.itemId = entry.id;
    const icon = document.createElement('span');
    icon.className = 'inventory-card-icon';
    icon.textContent = entry.icon;
    icon.setAttribute('aria-hidden', 'true');
    card.appendChild(icon);

    const content = document.createElement('span');
    content.className = 'inventory-card-content';
    card.appendChild(content);

    const name = document.createElement('span');
    name.className = 'inventory-card-name';
    name.textContent = entry.name;
    content.appendChild(name);

    const status = document.createElement('span');
    status.className = 'inventory-card-status';
    if (entry.category === 'weapon' && entry.progress?.ready) {
      status.classList.add('ready');
      status.textContent = 'Ready to evolve!';
    } else if (entry.category === 'weapon' && entry.progress) {
      status.textContent = `${entry.progress.current}/${entry.progress.required} ${entry.progress.label} to evolve`;
    } else if (entry.evolved) {
      status.textContent = 'Evolved form active';
    } else if (entry.category !== 'weapon') {
      status.textContent = 'Passive effect active';
    } else {
      status.textContent = 'Awakening';
    }
    content.appendChild(status);

    const progress = getInventoryProgressText(entry);
    card.title = progress.long;
    card.addEventListener('click', () => setActiveInventoryPreview(entry.id));
    inventoryOverlayList.appendChild(card);
  }

  if (!activeInventoryPreviewId || !loadout.some((entry) => entry.id === activeInventoryPreviewId)) {
    activeInventoryPreviewId = loadout[0]?.id ?? null;
  }
  if (activeInventoryPreviewId) {
    setActiveInventoryPreview(activeInventoryPreviewId, loadout);
  }
}

function openInventoryOverlay(): void {
  closeEscapeMenu({ restoreFocus: false });
  if (isInventoryOverlayOpen) {
    renderInventoryOverlay();
    return;
  }
  isInventoryOverlayOpen = true;
  setItemShopOpen(false);
  closeMetaOverlay();
  inventoryOverlay.classList.remove('hidden');
  inventoryOverlay.setAttribute('aria-hidden', 'false');
  lastInventoryOverlaySignature = '';
  renderInventoryOverlay();
  inventoryOverlayClose.focus();
}

function closeInventoryOverlay(): void {
  if (!isInventoryOverlayOpen) {
    return;
  }
  isInventoryOverlayOpen = false;
  inventoryOverlay.classList.add('hidden');
  inventoryOverlay.setAttribute('aria-hidden', 'true');
  inventoryOverlayPreview.setAttribute('aria-hidden', 'true');
  lastInventoryOverlaySignature = '';
}

function updateMetaShardDisplay(): void {
  metaShardCount.textContent = `${game.getRelicShards()}`;
}

function updateMetaWeaponCard(weaponId: WeaponItemId): void {
  const card = metaWeaponButtons.get(weaponId);
  if (!card) {
    return;
  }
  const track = META_WEAPON_TRACKS.find((candidate) => candidate.weaponId === weaponId);
  if (!track) {
    return;
  }
  const total = track.upgrades.length;
  const unlockedCount = track.upgrades.filter((upgradeId) => game.isMetaUpgradeUnlocked(upgradeId)).length;
  const status = card.querySelector<HTMLSpanElement>('.meta-weapon-card-status');
  if (status) {
    status.textContent = `${unlockedCount}/${total} upgrades unlocked`;
  }
  card.classList.toggle('complete', unlockedCount === total && total > 0);
}

function renderMetaWeaponGrid(): void {
  metaWeaponButtons.clear();
  metaWeaponList.innerHTML = '';
  for (const track of META_WEAPON_TRACKS) {
    const definition = getWeaponDefinitionForMeta(track.weaponId);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'meta-weapon-card';
    button.dataset.weaponId = track.weaponId;

    const icon = document.createElement('span');
    icon.className = 'meta-weapon-card-icon';
    icon.textContent = definition.icon;
    icon.setAttribute('aria-hidden', 'true');
    button.appendChild(icon);

    const content = document.createElement('span');
    content.className = 'meta-weapon-card-text';
    button.appendChild(content);

    const name = document.createElement('span');
    name.className = 'meta-weapon-card-name';
    name.textContent = definition.name;
    content.appendChild(name);

    const role = document.createElement('span');
    role.className = 'meta-weapon-card-role';
    role.textContent = definition.role;
    content.appendChild(role);

    const status = document.createElement('span');
    status.className = 'meta-weapon-card-status';
    content.appendChild(status);

    button.addEventListener('click', () => showMetaWeaponDetail(track.weaponId));
    metaWeaponButtons.set(track.weaponId, button);
    metaWeaponList.appendChild(button);
    updateMetaWeaponCard(track.weaponId);
  }
  metaWeaponList.classList.remove('hidden');
  metaWeaponDetail.classList.add('hidden');
  activeMetaWeaponId = null;
}

function refreshMetaUpgradeButtons(): void {
  const shards = game.getRelicShards();
  for (const [id, button] of metaUpgradeButtons.entries()) {
    const definition = getMetaUpgradeDefinition(id);
    const unlocked = game.isMetaUpgradeUnlocked(id);
    const prereqsMet = definition.prerequisites.every((prereq) => game.isMetaUpgradeUnlocked(prereq));
    const canAfford = shards >= definition.cost;
    const card = button.closest<HTMLDivElement>('.meta-upgrade-card');
    if (card) {
      card.classList.toggle('meta-upgrade-card--unlocked', unlocked);
      card.classList.toggle('meta-upgrade-card--locked', !unlocked);
    }
    if (unlocked) {
      button.disabled = true;
      button.textContent = 'Unlocked';
    } else if (!prereqsMet) {
      button.disabled = true;
      button.textContent = 'Prerequisite required';
    } else {
      button.disabled = !canAfford;
      button.textContent = `Unlock (${definition.cost} shards)`;
    }
    button.classList.toggle('affordable', !unlocked && prereqsMet && canAfford);
  }
}

function renderMetaUpgrades(weaponId: WeaponItemId): void {
  metaUpgradeButtons.clear();
  metaUpgradeList.innerHTML = '';
  const upgrades = getMetaUpgradesForWeapon(weaponId);
  if (!upgrades.length) {
    const empty = document.createElement('p');
    empty.className = 'meta-upgrade-empty';
    empty.textContent = 'No relic upgrades available for this weapon yet.';
    metaUpgradeList.appendChild(empty);
    return;
  }

  for (const upgrade of upgrades) {
    const card = document.createElement('div');
    card.className = 'meta-upgrade-card';
    card.dataset.tier = `${upgrade.tier}`;

    const tier = document.createElement('div');
    tier.className = 'meta-upgrade-tier';
    tier.textContent = `Tier ${upgrade.tier}`;
    card.appendChild(tier);

    const name = document.createElement('div');
    name.className = 'meta-upgrade-name';
    name.textContent = upgrade.name;
    card.appendChild(name);

    const description = document.createElement('p');
    description.className = 'meta-upgrade-description';
    description.textContent = upgrade.description;
    card.appendChild(description);

    const prereq = document.createElement('p');
    prereq.className = 'meta-upgrade-prereq';
    if (upgrade.prerequisites.length) {
      const prerequisiteNames = upgrade.prerequisites
        .map((id) => getMetaUpgradeDefinition(id).name)
        .join(', ');
      prereq.textContent = `Requires: ${prerequisiteNames}`;
    } else {
      prereq.textContent = 'Requires: None';
    }
    card.appendChild(prereq);

    const action = document.createElement('button');
    action.type = 'button';
    action.className = 'meta-upgrade-action';
    action.dataset.upgradeId = upgrade.id;
    action.addEventListener('click', () => {
      if (game.unlockMetaUpgrade(upgrade.id)) {
        updateHud();
        renderMetaUpgrades(weaponId);
        updateMetaShardDisplay();
        updateMetaWeaponCard(weaponId);
      }
    });
    card.appendChild(action);
    metaUpgradeButtons.set(upgrade.id, action);
    metaUpgradeList.appendChild(card);
  }
  refreshMetaUpgradeButtons();
}

function showMetaWeaponDetail(weaponId: WeaponItemId): void {
  activeMetaWeaponId = weaponId;
  const definition = getWeaponDefinitionForMeta(weaponId);
  const track = META_WEAPON_TRACKS.find((candidate) => candidate.weaponId === weaponId);
  metaWeaponDetailIcon.textContent = definition.icon;
  metaWeaponDetailTitle.textContent = definition.name;
  metaWeaponDetailOverview.textContent = track?.overview ?? definition.role;
  metaWeaponList.classList.add('hidden');
  metaWeaponDetail.classList.remove('hidden');
  metaWeaponButtons.forEach((button, id) => {
    button.classList.toggle('active', id === weaponId);
  });
  renderMetaUpgrades(weaponId);
  metaWeaponBack.focus();
}

function openMetaOverlay(): void {
  closeEscapeMenu({ restoreFocus: false });
  if (isMetaOverlayOpen) {
    updateMetaShardDisplay();
    for (const track of META_WEAPON_TRACKS) {
      updateMetaWeaponCard(track.weaponId);
    }
    if (activeMetaWeaponId) {
      renderMetaUpgrades(activeMetaWeaponId);
    } else {
      refreshMetaUpgradeButtons();
    }
    return;
  }
  isMetaOverlayOpen = true;
  closeInventoryOverlay();
  setItemShopOpen(false);
  metaProgressionOverlay.classList.remove('hidden');
  metaProgressionOverlay.setAttribute('aria-hidden', 'false');
  renderMetaWeaponGrid();
  updateMetaShardDisplay();
  metaOverlayClose.focus();
}

function closeMetaOverlay(): void {
  if (!isMetaOverlayOpen) {
    return;
  }
  isMetaOverlayOpen = false;
  metaProgressionOverlay.classList.add('hidden');
  metaProgressionOverlay.setAttribute('aria-hidden', 'true');
  metaWeaponList.classList.remove('hidden');
  metaWeaponDetail.classList.add('hidden');
  activeMetaWeaponId = null;
  metaUpgradeButtons.clear();
  metaUpgradeList.innerHTML = '';
  metaWeaponButtons.forEach((button) => button.classList.remove('active'));
}

function updateInventory() {
  const loadout = game.getHeroLoadout();
  const seenIds = new Set<ItemId>();
  for (let i = 0; i < inventorySlots.length; i++) {
    const slot = inventorySlots[i];
    const entry = loadout[i];
    if (entry) {
      seenIds.add(entry.id);
      slot.innerHTML = '';
      slot.classList.add('has-item');
      slot.classList.remove('empty');
      slot.classList.toggle('item-evolved', entry.evolved);
      const progressLabel = entry.category === 'weapon'
        ? entry.evolved
          ? 'Evolved form active'
          : entry.progress
            ? entry.progress.ready
              ? 'Ready to evolve!'
              : `${entry.progress.current}/${entry.progress.required} ${entry.progress.label} to evolve`
            : 'Awakening'
        : 'Passive effect active';
      const detailProgress = entry.evolved
        ? 'Evolved'
        : entry.progress
          ? `${entry.progress.current}/${entry.progress.required} ${entry.progress.label}`
          : entry.status;

      const iconElement = document.createElement('div');
      iconElement.className = 'item-icon';
      iconElement.textContent = entry.icon;
      slot.appendChild(iconElement);
      const readyToEvolve = !!entry.progress?.ready && !entry.evolved;

      slot.dataset.itemId = entry.id;
      slot.title = `${entry.name} — ${progressLabel}`;
      slot.setAttribute('aria-label', `${entry.name} — ${progressLabel}`);
      slot.classList.toggle('evolution-ready', readyToEvolve);
      const wasReady = evolutionReadyState.get(entry.id) ?? false;
      if (readyToEvolve && !wasReady) {
        playEvolutionReadyCue();
        slot.classList.add('evolution-ready-flash');
        const handleAnimationEnd = () => {
          slot.classList.remove('evolution-ready-flash');
          slot.removeEventListener('animationend', handleAnimationEnd);
        };
        slot.addEventListener('animationend', handleAnimationEnd);
      } else if (!readyToEvolve) {
        slot.classList.remove('evolution-ready-flash');
      }
      evolutionReadyState.set(entry.id, readyToEvolve);

      const tooltipBody = `${entry.description}<br /><em>${progressLabel}</em>`;
      slot.onmouseenter = () => showTooltip(entry.name, tooltipBody);
      slot.onmouseleave = hideTooltip;
      slot.onclick = (event) => {
        if (!(event.target instanceof HTMLElement)) {
          return;
        }
        if (event.target.closest('.item-icon') || event.currentTarget === event.target) {
          openItemDetail(entry.id, { progressText: detailProgress, evolved: entry.evolved });
        }
      };
      iconElement.setAttribute('role', 'button');
      iconElement.setAttribute('aria-label', `${entry.name} details`);
      iconElement.tabIndex = 0;
      const openDetail = () => openItemDetail(entry.id, { progressText: detailProgress, evolved: entry.evolved });
      iconElement.addEventListener('click', (event) => {
        event.stopPropagation();
        openDetail();
      });
      iconElement.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openDetail();
        }
      });
    } else {
      slot.innerHTML = '';
      slot.classList.remove('has-item', 'item-evolved', 'evolution-ready', 'evolution-ready-flash');
      slot.classList.add('empty');
      slot.removeAttribute('data-item-id');
      slot.removeAttribute('title');
      slot.removeAttribute('aria-label');
      slot.onmouseenter = null;
      slot.onmouseleave = null;
      slot.onclick = null;
    }
  }
  for (const itemId of Array.from(evolutionReadyState.keys())) {
    if (!seenIds.has(itemId)) {
      evolutionReadyState.delete(itemId);
    }
  }
  if (isInventoryOverlayOpen) {
    renderInventoryOverlay();
  }
}

function populateBuildingShop() {
  buildingShopItemsContainer.innerHTML = '';
  buildingShopButtons.clear();
  const seen = new Set<BuildingType>();
  for (const type of game.getBuildOrder()) {
    if (seen.has(type)) {
      continue;
    }
    seen.add(type);
    const info = BUILDING_DISPLAY[type];
    const definition = getBuildingDefinition(type);
    const button = document.createElement('button');
    button.className = 'shop-button';
    button.innerHTML = `<span>${info.icon} ${info.name}</span><span class="price">${definition.cost} Gold</span>`;
    button.addEventListener('click', () => {
      const index = game.getBuildOrder().indexOf(type);
      if (index >= 0) {
        game.selectBlueprint(index);
        game.setBuildMode(true);
        hideBuildLedger();
        updateInventory();
      }
    });
    button.addEventListener('mouseenter', () =>
      showTooltip(info.name, `${info.description}<br />Cost: ${definition.cost} supplies.`)
    );
    button.addEventListener('mouseleave', hideTooltip);
    buildingShopItemsContainer.appendChild(button);
    buildingShopButtons.set(type, button);
  }
}

function updateBuildingShopButtons() {
  if (!game.isBuildModeActive() && isBuildLedgerOpen) {
    isBuildLedgerOpen = false;
    hideTooltip();
  }
  const supplies = game.getSupplies();
  const selected = game.getSelectedBlueprint();
  for (const [type, button] of buildingShopButtons.entries()) {
    const definition = getBuildingDefinition(type);
    const affordable = supplies >= definition.cost;
    button.classList.toggle('disabled', !affordable);
    button.classList.toggle('selected', type === selected);
  }
  const shouldHide = !game.isBuildModeActive() || !isBuildLedgerOpen;
  buildingShopPanel.classList.toggle('hidden', shouldHide);
  updateBuildPrompt();
}

function updateBuildPrompt(): void {
  const selected = game.getSelectedBlueprint();
  const info = BUILDING_DISPLAY[selected];
  if (!info) {
    buildPrompt.classList.remove('build-active', 'build-unaffordable');
    buildPrompt.dataset.tooltipTitle = 'Workshop closed';
    buildPrompt.dataset.tooltipBody = 'Select a structure in the workshop to prepare a build plan.';
    buildPrompt.removeAttribute('aria-pressed');
    buildPrompt.title = '(B)uild';
    return;
  }
  const definition = getBuildingDefinition(selected);
  const affordable = game.canAffordBlueprint(selected);
  const buildModeActive = game.isBuildModeActive();
  const summary = `${info.icon} ${info.name} — ${definition.cost} supplies`;
  buildPrompt.dataset.tooltipTitle = info.name;
  buildPrompt.dataset.tooltipBody = `${info.description}<br />Cost: ${definition.cost} supplies.`;
  buildPrompt.title = summary;
  buildPrompt.setAttribute('aria-pressed', buildModeActive ? 'true' : 'false');
  buildPrompt.classList.toggle('build-active', buildModeActive);
  buildPrompt.classList.toggle('build-unaffordable', !affordable);
}

let isItemShopOpen = false;
let lastPhase: 'downtime' | 'wave' | null = null;
let lastVillageStatusHash = '';
let tavernAutoOpen = false;
let isQuestLogOpen = false;
let activeQuestDialog: NearbyQuestInteraction | null = null;
let questDialogPinned = false;
const dismissedQuestInteractions = new Set<number>();
let lastQuestInteractionGiverId: number | null = null;
let isBuildLedgerOpen = false;
let isInventoryOverlayOpen = false;
let activeInventoryPreviewId: ItemId | null = null;
const evolutionReadyState = new Map<ItemId, boolean>();
let isMetaOverlayOpen = false;
let activeMetaWeaponId: WeaponItemId | null = null;
const metaUpgradeButtons = new Map<MetaUpgradeId, HTMLButtonElement>();
const metaWeaponButtons = new Map<WeaponItemId, HTMLButtonElement>();
let evolutionAudioContext: AudioContext | null = null;

type LoadoutEntry = ReturnType<Game['getHeroLoadout']>[number];
let lastInventoryOverlaySignature = '';

function getInventoryProgressText(entry: LoadoutEntry): { short: string; long: string } {
  if (entry.category !== 'weapon') {
    return {
      short: 'Passive',
      long: `${entry.name} — Passive effect active`
    };
  }
  if (entry.evolved) {
    return {
      short: 'Evolved',
      long: `${entry.name} — Evolved form active`
    };
  }
  const progress = entry.progress;
  if (!progress) {
    return {
      short: 'Awakening',
      long: `${entry.name} — Awakening`
    };
  }
  if (progress.ready) {
    return {
      short: 'Ready to Evolve',
      long: `${entry.name} — Ready to Evolve!`
    };
  }
  const base = `${progress.current}/${progress.required} ${progress.label}`;
  return {
    short: base,
    long: `${entry.name} — ${base} to Evolve`
  };
}

function playEvolutionReadyCue(): void {
  try {
    if (!evolutionAudioContext) {
      const AudioCtx = (window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) as
        | typeof AudioContext
        | undefined;
      if (!AudioCtx) {
        return;
      }
      evolutionAudioContext = new AudioCtx();
    }
    const context = evolutionAudioContext;
    if (!context) {
      return;
    }
    const now = context.currentTime;
    const duration = 0.3;
    const oscillator = context.createOscillator();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(640, now);
    oscillator.frequency.linearRampToValueAtTime(880, now + duration);

    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    oscillator.connect(gain).connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
  } catch (error) {
    console.warn('Unable to play evolution cue', error);
  }
}

function openBuildLedger(): void {
  if (!game.isBuildModeActive()) {
    game.setBuildMode(true);
  }
  if (!isBuildLedgerOpen) {
    isBuildLedgerOpen = true;
  }
  if (!tutorialManager.isCompleted('building') && !tutorialManager.isQueued('building')) {
    tutorialManager.request('building', { priority: true });
  }
  updateBuildingShopButtons();
}

function hideBuildLedger(): void {
  if (isBuildLedgerOpen) {
    isBuildLedgerOpen = false;
    hideTooltip();
  }
  updateBuildingShopButtons();
}

function disableBuildMode(): void {
  if (game.isBuildModeActive()) {
    game.setBuildMode(false);
  }
  if (isBuildLedgerOpen) {
    isBuildLedgerOpen = false;
    hideTooltip();
  }
  updateBuildingShopButtons();
}

function setItemShopOpen(open: boolean): void {
  const nextState = open && game.isDowntime();
  if (nextState) {
    closeEscapeMenu({ restoreFocus: false });
    closeInventoryOverlay();
    closeMetaOverlay();
  }
  if (isItemShopOpen === nextState) {
    if (!nextState) {
      hideTooltip();
    }
    updateItemShopButtons();
    return;
  }
  isItemShopOpen = nextState;
  if (isItemShopOpen && game.isBuildModeActive()) {
    disableBuildMode();
  }
  if (!isItemShopOpen) {
    hideTooltip();
  } else {
    window.requestAnimationFrame(() => {
      itemShopCloseButton.focus();
    });
  }
  updateItemShopButtons();
}

function renderVillageStatus(phase: 'downtime' | 'wave'): void {
  const statuses = game.getVillageSummaries();
  const normalized = statuses.map((status) => [
    status.id,
    Math.round(status.hp),
    status.maxHp,
    status.population,
    status.maxPopulation,
    status.destroyed,
    status.underAttack,
    status.repairCost
  ]);
  const hash = JSON.stringify({ phase, gold: game.getSupplies(), data: normalized });
  if (hash === lastVillageStatusHash) {
    return;
  }
  lastVillageStatusHash = hash;
  villageStatusList.innerHTML = '';
  villageStatusPanel.classList.toggle('hidden', statuses.length === 0);
  for (const status of statuses) {
    const item = document.createElement('li');
    item.className = 'village-status-item';
    if (status.destroyed) {
      item.classList.add('destroyed');
    } else if (status.underAttack) {
      item.classList.add('under-attack');
    }

    const header = document.createElement('div');
    header.className = 'village-status-header';
    const nameSpan = document.createElement('span');
    nameSpan.className = 'village-name';
    nameSpan.textContent = status.label;
    const hpSpan = document.createElement('span');
    hpSpan.className = 'village-hp';
    hpSpan.textContent = `${Math.round(status.hp)}/${status.maxHp} HP`;
    header.append(nameSpan, hpSpan);
    item.appendChild(header);

    const subtext = document.createElement('div');
    subtext.className = 'village-status-subtext';
    subtext.textContent = status.destroyed
      ? 'Ruined by the swarm'
      : `Population ${status.population}/${status.maxPopulation}`;
    item.appendChild(subtext);

    if (!status.destroyed) {
      const repairButton = document.createElement('button');
      repairButton.type = 'button';
      repairButton.className = 'repair-button';
      if (status.repairCost > 0) {
        repairButton.textContent = `Repair (${status.repairCost})`;
      } else {
        repairButton.textContent = 'Repaired';
        repairButton.disabled = true;
      }
      const canRepair =
        phase === 'downtime' && status.repairCost > 0 && game.getSupplies() >= status.repairCost;
      if (!canRepair) {
        repairButton.disabled = true;
      }
      repairButton.addEventListener('click', () => {
        if (game.repairVillage(status.id)) {
          lastVillageStatusHash = '';
        }
      });
      item.appendChild(repairButton);
    }

    villageStatusList.appendChild(item);
  }
}

function formatModifierLabel(id: ClickModifierId): string {
  switch (id) {
    case 'multiHit':
      return 'Multi-hit';
    case 'splash':
      return 'Splash';
    case 'dot':
      return 'Burn';
    case 'crit':
      return 'Crit';
    case 'autoClick':
      return 'Auto-click';
    default:
      return id;
  }
}

function updateClickLoadoutSummary(): void {
  const loadout: ClickLoadout = game.getClickLoadout();
  const lines: string[] = [];
  lines.push(`Base damage: ${Math.round(game.getClickDamage())}`);
  if (loadout.multiHitCount > 1) {
    lines.push(`Multi-hit: ${loadout.multiHitCount} strikes per click`);
  } else {
    lines.push('Multi-hit: Single strike');
  }
  if (loadout.splashRadius > 0 && loadout.splashPct > 0) {
    lines.push(
      `Splash: ${Math.round(loadout.splashRadius)}px at ${(loadout.splashPct * 100).toFixed(0)}% damage`
    );
  } else {
    lines.push('Splash: None');
  }
  if (loadout.dot && loadout.dot.dps > 0 && loadout.dot.durationMs > 0) {
    lines.push(
      `Burn: ${loadout.dot.dps} DPS for ${(loadout.dot.durationMs / 1000).toFixed(1)}s`
    );
  } else {
    lines.push('Burn: None');
  }
  if (loadout.critChance > 0) {
    lines.push(`Crit: ${(loadout.critChance * 100).toFixed(0)}% ×${loadout.critMultiplier.toFixed(2)}`);
  } else {
    lines.push('Crit: None');
  }
  if (loadout.autoClickRate > 0) {
    lines.push(`Auto-click: ${loadout.autoClickRate.toFixed(1)} strikes / sec`);
  } else {
    lines.push('Auto-click: Off');
  }

  const rankEntries = Object.entries(loadout.ranks) as [ClickModifierId, number][];
  const rankSummary = rankEntries
    .filter(([, count]) => count > 0)
    .map(([id, count]) => `${formatModifierLabel(id)} ×${count}`)
    .join(', ');

  clickLoadoutSummary.innerHTML = `
    <ul>${lines.map((line) => `<li>${line}</li>`).join('')}</ul>
    ${rankSummary ? `<p class="loadout-ranks">${rankSummary}</p>` : ''}
  `;
}

function populateItemShop(): void {
  itemShopItemsContainer.innerHTML = '';
  itemButtons.clear();
  for (const itemId of ITEM_ORDER) {
    const definition = ITEM_DEFINITIONS[itemId];
    const button = document.createElement('button');
    button.className = 'shop-button';
    button.type = 'button';
    const content = document.createElement('div');
    content.className = 'shop-button-content';
    const header = document.createElement('div');
    header.className = 'shop-item-header';
    const label = document.createElement('div');
    label.className = 'shop-button-label';
    const icon = document.createElement('span');
    icon.className = 'shop-item-icon';
    icon.textContent = definition.icon;
    icon.setAttribute('role', 'button');
    icon.setAttribute('aria-label', `${definition.name} details`);
    icon.tabIndex = 0;
    const name = document.createElement('span');
    name.className = 'shop-item-name';
    name.textContent = definition.name;
    label.append(icon, name);
    const price = document.createElement('span');
    price.className = 'price';
    header.append(label, price);
    content.append(header);

    if (definition.stats.length) {
      const statsList = document.createElement('ul');
      statsList.className = 'shop-item-stats';
      for (const stat of definition.stats) {
        const li = document.createElement('li');
        li.textContent = stat;
        statsList.appendChild(li);
      }
      content.append(statsList);
    }

    button.append(content);
    button.addEventListener('click', () => {
      if (game.purchaseItem(itemId)) {
        persistentClickItems.add(itemId);
        game.addPersistentItem(itemId);
        savePersistentClickUpgrades(persistentClickItems);
        updateItemShopButtons();
      }
    });
    button.addEventListener('mouseenter', () =>
      showTooltip(definition.name, `${definition.description}<br /><em>${definition.role}</em>`)
    );
    button.addEventListener('mouseleave', hideTooltip);
    icon.addEventListener('click', (event) => {
      event.stopPropagation();
      openItemDetail(itemId);
    });
    icon.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openItemDetail(itemId);
      }
    });
    itemShopItemsContainer.appendChild(button);
    itemButtons.set(itemId, button);
  }
  updateItemShopButtons();
}

function updateItemShopButtons(): void {
  const inDowntime = game.isDowntime();
  for (const [itemId, button] of itemButtons.entries()) {
    const definition = ITEM_DEFINITIONS[itemId];
    const owned = game.isItemOwned(itemId);
    const canPurchase = game.canPurchaseItem(itemId);
    const priceSpan = button.querySelector<HTMLSpanElement>('.price');
    if (priceSpan) {
      if (owned) {
        priceSpan.textContent = 'Owned';
      } else if (!inDowntime) {
        priceSpan.textContent = 'Closed during wave';
      } else {
        priceSpan.textContent = `${definition.cost} Gold`;
      }
    }
    const disabled = owned || !canPurchase || !inDowntime;
    button.disabled = disabled;
    const shouldShowDisabledClass = !owned && (!canPurchase || !inDowntime);
    button.classList.toggle('disabled', shouldShowDisabledClass);
    button.classList.toggle('owned', owned);
  }
  const shopVisible = isItemShopOpen && inDowntime;
  itemShopPanel.classList.toggle('hidden', !shopVisible);
  itemShopPanel.setAttribute('aria-hidden', shopVisible ? 'false' : 'true');
  updateClickLoadoutSummary();
}

function renderActivities(): void {
  renderCamps();
  renderBuffs();
}

function renderCamps(): void {
  const camps = game.getCreepCamps();
  const highlightedCampIds = new Set(game.getNearbyCreepCampIds());
  let activeCampCount = 0;
  for (const camp of camps) {
    if (!defeatedCampIds.has(camp.id)) {
      activeCampCount += 1;
    }
  }
  campMarkerEmpty.classList.toggle('hidden', activeCampCount > 0);

  const seen = new Set<number>();
  let scaleX = 1;
  let scaleY = 1;
  let offsetX = 0;
  let offsetY = 0;

  if (activeCampCount > 0) {
    const canvasRect = canvas.getBoundingClientRect();
    const containerRect = gameContainerElement.getBoundingClientRect();
    scaleX = canvasRect.width / canvas.width;
    scaleY = canvasRect.height / canvas.height;
    offsetX = canvasRect.left - containerRect.left;
    offsetY = canvasRect.top - containerRect.top;
  }

  for (const camp of camps) {
    if (defeatedCampIds.has(camp.id)) {
      continue;
    }
    seen.add(camp.id);
    let marker = campMarkers.get(camp.id);
    if (!marker) {
      marker = document.createElement('div');
      marker.className = 'camp-marker';
      marker.innerHTML = `
        <div class="activity-item">
          <span class="activity-icon">🐾</span>
          <div class="activity-body">
            <div class="activity-title"></div>
            <div class="activity-subtext"></div>
          </div>
        </div>
      `;
      campMarkerLayer.appendChild(marker);
      campMarkers.set(camp.id, marker);
    }

    const card = marker.querySelector<HTMLDivElement>('.activity-item');
    const title = marker.querySelector<HTMLDivElement>('.activity-title');
    const statusElement = marker.querySelector<HTMLDivElement>('.activity-subtext');

    if (card) {
      card.classList.toggle('completed', camp.cleared);
    }
    if (title) {
      title.textContent = camp.name;
    }
    if (statusElement) {
      const remaining = camp.unitIds.length;
      const shardLabel = camp.rewardRelicShards === 1 ? 'shard' : 'shards';
      statusElement.textContent = camp.cleared
        ? 'Cleared'
        : `${remaining} foes remain • ${camp.rewardSupplies} gold & ${camp.rewardRelicShards} ${shardLabel}`;
    }

    const { x: screenX, y: screenY } = isoWorldToScreen(camp.position.x, camp.position.y, isoTransform);

    const cssX = offsetX + screenX * scaleX;
    const cssY = offsetY + screenY * scaleY;
    marker.style.left = `${cssX}px`;
    marker.style.top = `${cssY}px`;

    const highlighted = highlightedCampIds.has(camp.id) && !camp.cleared;
    if (highlighted) {
      marker.classList.add('highlighted');
      const { dy } = isoProjectRadius(camp.position, camp.radius, isoTransform);
      const radiusOffset = Math.max(0, dy * scaleY) + 12;
      marker.style.transform = `translate(-50%, -100%) translateY(-${radiusOffset}px)`;
    } else {
      marker.classList.remove('highlighted');
      marker.style.transform = 'translate(-50%, -100%)';
    }

    if (camp.cleared) {
      if (card && !campRemovalTimers.has(camp.id)) {
        card.classList.add('defeated');
        marker.classList.add('defeated');
        const removalDelay = 2100;
        const timerId = window.setTimeout(() => {
          const pendingCard = marker?.querySelector<HTMLDivElement>('.activity-item');
          pendingCard?.classList.remove('defeated');
          marker?.remove();
          campMarkers.delete(camp.id);
          campRemovalTimers.delete(camp.id);
          defeatedCampIds.add(camp.id);
        }, removalDelay);
        campRemovalTimers.set(camp.id, timerId);
      }
    } else if (card) {
      card.classList.remove('defeated');
      marker.classList.remove('defeated');
    }

    const visible = screenX >= 0 && screenX <= canvas.width && screenY >= 0 && screenY <= canvas.height;
    marker.classList.toggle('hidden', !visible);
  }

  for (const [campId, marker] of campMarkers.entries()) {
    if (!seen.has(campId)) {
      const timerId = campRemovalTimers.get(campId);
      if (timerId != null) {
        window.clearTimeout(timerId);
        campRemovalTimers.delete(campId);
      }
      marker.remove();
      campMarkers.delete(campId);
      defeatedCampIds.delete(campId);
    }
  }
}

function renderBuffs(): void {
  const buffs = game.getTemporaryBuffs();
  buffList.innerHTML = '';
  if (!buffs.length) {
    const empty = document.createElement('li');
    empty.className = 'activity-empty';
    empty.textContent = 'No active blessings.';
    buffList.appendChild(empty);
    return;
  }
  for (const buff of buffs) {
    const li = document.createElement('li');
    li.className = 'activity-item';
    li.innerHTML = `
      <span class="activity-icon">✨</span>
      <div class="activity-body">
        <div class="activity-title">${buff.description}</div>
        <div class="activity-subtext">Expires after wave ${buff.expiresAtWave}</div>
      </div>
    `;
    buffList.appendChild(li);
  }
}

function renderQuestLog(): void {
  const entries: QuestLogEntry[] = game.getQuestLogEntries();
  questLogList.innerHTML = '';
  if (!entries.length) {
    const empty = document.createElement('li');
    empty.className = 'quest-log-empty';
    empty.textContent = 'No active quests. Visit a village to discover new contracts.';
    questLogList.appendChild(empty);
    return;
  }
  for (const entry of entries) {
    const li = document.createElement('li');
    li.className = `quest-log-entry ${entry.state}`;

    const header = document.createElement('div');
    header.className = 'quest-log-entry-header';
    const icon = document.createElement('span');
    icon.className = 'quest-log-entry-icon';
    icon.textContent = entry.icon;
    header.appendChild(icon);

    const text = document.createElement('div');
    text.className = 'quest-log-entry-text';
    const title = document.createElement('div');
    title.className = 'quest-log-entry-title';
    title.textContent = `${entry.giverName} — ${entry.villageName}`;
    const description = document.createElement('div');
    description.className = 'quest-log-entry-description';
    description.textContent = entry.description;
    text.appendChild(title);
    text.appendChild(description);
    header.appendChild(text);
    li.appendChild(header);

    const reward = document.createElement('div');
    reward.className = 'quest-log-entry-reward';
    reward.textContent = entry.rewardText;
    li.appendChild(reward);

    const status = document.createElement('div');
    status.className = 'quest-log-entry-status';
    status.textContent = entry.state === 'completed' ? 'Ready to turn in' : 'In progress';
    li.appendChild(status);

    const progress = document.createElement('div');
    progress.className = 'quest-log-entry-progress';
    const bar = document.createElement('span');
    const ratio = entry.requiredTime > 0 ? Math.min(1, entry.progress / entry.requiredTime) : entry.state === 'completed' ? 1 : 0;
    bar.style.width = `${ratio * 100}%`;
    progress.appendChild(bar);
    li.appendChild(progress);

    questLogList.appendChild(li);
  }
}

function setQuestLogOpen(open: boolean): void {
  const nextState = Boolean(open);
  if (isQuestLogOpen === nextState) {
    if (nextState) {
      renderQuestLog();
    }
    return;
  }
  if (nextState) {
    closeEscapeMenu({ restoreFocus: false });
  }
  isQuestLogOpen = nextState;
  questLogOverlay.classList.toggle('hidden', !nextState);
  questLogOverlay.setAttribute('aria-hidden', nextState ? 'false' : 'true');
  if (nextState) {
    renderQuestLog();
  }
}

function showQuestDialog(interaction: NearbyQuestInteraction): void {
  if (
    tutorialManager.isCompleted('noise') &&
    !tutorialManager.isCompleted('quests') &&
    !tutorialManager.isQueued('quests')
  ) {
    tutorialManager.request('quests', { priority: true });
  }
  activeQuestDialog = interaction;
  questDialogElement.classList.remove('hidden');
  questDialogElement.setAttribute('aria-hidden', 'false');
  questDialogIcon.textContent = interaction.offer?.icon ?? interaction.activeQuest?.icon ?? '📜';
  questDialogTitle.textContent = interaction.giverName;
  questDialogSubtitle.textContent = interaction.villageName;
  questDialogGreeting.textContent = interaction.greeting;

  if (interaction.state === 'offering' && interaction.offer) {
    questDialogDescription.textContent = interaction.offer.description;
    questDialogReward.textContent = interaction.offer.rewardText;
    questDialogPrimary.textContent = 'Accept Quest';
    questDialogSecondary.textContent = 'Not now';
  } else if (interaction.state === 'turnIn' && interaction.activeQuest) {
    questDialogDescription.textContent = interaction.activeQuest.description;
    questDialogReward.textContent = interaction.activeQuest.rewardText;
    questDialogPrimary.textContent = 'Turn In Quest';
    questDialogSecondary.textContent = 'Later';
  } else {
    questDialogDescription.textContent = '';
    questDialogReward.textContent = '';
    questDialogPrimary.textContent = 'Close';
    questDialogSecondary.textContent = 'Later';
  }

  const activeQuest = interaction.activeQuest;
  if (activeQuest) {
    const ratio = interaction.state === 'turnIn'
      ? 1
      : activeQuest.requiredTime > 0
        ? Math.min(1, activeQuest.progress / activeQuest.requiredTime)
        : 0;
    questDialogProgress.classList.remove('hidden');
    questDialogProgressFill.style.width = `${ratio * 100}%`;
  } else {
    questDialogProgress.classList.add('hidden');
    questDialogProgressFill.style.width = '0%';
  }
}

function hideQuestDialog(): void {
  questDialogPinned = false;
  if (questDialogElement.classList.contains('hidden')) {
    activeQuestDialog = null;
    return;
  }
  questDialogElement.classList.add('hidden');
  questDialogElement.setAttribute('aria-hidden', 'true');
  activeQuestDialog = null;
}

function updateQuestDialog(): void {
  if (questDialogPinned) {
    if (!activeQuestDialog) {
      questDialogPinned = false;
      return;
    }
    const refreshed = game.getQuestInteractionForGiver(activeQuestDialog.giverId);
    if (!refreshed || (refreshed.state === 'waiting' && !refreshed.offer && !refreshed.activeQuest)) {
      hideQuestDialog();
      return;
    }
    showQuestDialog(refreshed);
    questDialogPinned = true;
    return;
  }

  const interaction = game.getNearbyQuestInteraction();
  const relevant = interaction && (interaction.state === 'offering' || interaction.state === 'turnIn');
  if (!relevant) {
    if (lastQuestInteractionGiverId != null && (!interaction || interaction.giverId !== lastQuestInteractionGiverId)) {
      dismissedQuestInteractions.delete(lastQuestInteractionGiverId);
      lastQuestInteractionGiverId = null;
    }
    hideQuestDialog();
    return;
  }
  if (interaction.giverId !== lastQuestInteractionGiverId) {
    if (lastQuestInteractionGiverId != null) {
      dismissedQuestInteractions.delete(lastQuestInteractionGiverId);
    }
    lastQuestInteractionGiverId = interaction.giverId;
  }
  if (dismissedQuestInteractions.has(interaction.giverId)) {
    hideQuestDialog();
    return;
  }
  showQuestDialog(interaction);
}

function handleQuestDialogPrimary(): void {
  if (!activeQuestDialog) {
    return;
  }
  const giverId = activeQuestDialog.giverId;
  let handled = false;
  if (activeQuestDialog.state === 'offering') {
    handled = game.acceptQuestFromGiver(giverId);
    if (handled) {
      updateInventory();
      renderActivities();
      if (isQuestLogOpen) {
        renderQuestLog();
      }
    }
  } else if (activeQuestDialog.state === 'turnIn') {
    handled = game.turnInQuestFromGiver(giverId);
    if (handled) {
      updateInventory();
      renderActivities();
      if (isQuestLogOpen) {
        renderQuestLog();
      }
    }
  }
  if (handled) {
    dismissedQuestInteractions.delete(giverId);
    lastQuestInteractionGiverId = null;
    hideQuestDialog();
    activeQuestDialog = null;
  }
}

function handleQuestDialogSecondary(): void {
  if (activeQuestDialog) {
    dismissedQuestInteractions.add(activeQuestDialog.giverId);
  }
  hideQuestDialog();
}

populateBuildingShop();
populateItemShop();
updateInventory();
updateBuildingShopButtons();
updateItemShopButtons();

type CanvasInteractionEvent = PointerEvent | WheelEvent;

const getCanvasPixelCoords = (event: CanvasInteractionEvent) => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (event.clientX - rect.left) * scaleX;
  const y = (event.clientY - rect.top) * scaleY;
  return { x, y };
};

const toWorldCoords = (event: PointerEvent) => {
  const { x, y } = getCanvasPixelCoords(event);
  const { x: worldX, y: worldY } = isoScreenToWorld(x, y, isoTransform);
  return {
    x: Math.max(0, Math.min(WIDTH, worldX)),
    y: Math.max(0, Math.min(HEIGHT, worldY))
  };
};

canvas.addEventListener('pointerdown', (event) => {
  const { x, y } = toWorldCoords(event);
  if (event.button === 2) {
    event.preventDefault();
  }
  if (event.button === 0 && !game.isBuildModeActive()) {
    const questInteraction = game.getQuestInteractionAtPosition(x, y);
    if (questInteraction) {
      dismissedQuestInteractions.delete(questInteraction.giverId);
      lastQuestInteractionGiverId = questInteraction.giverId;
      showQuestDialog(questInteraction);
      questDialogPinned = true;
      return;
    }
    if (game.isPointInsideTavern(x, y)) {
      setItemShopOpen(true);
      return;
    }
  }
  const buildingCountBefore = game.getBuildings().length;
  const wasBuildModeActive = game.isBuildModeActive();
  game.onPointerDown(x, y, event.button, event.timeStamp / 1000);
  const buildingCountAfter = game.getBuildings().length;
  if (event.button === 0 && !wasBuildModeActive) {
    tutorialManager.complete('movement');
  }
  if (buildingCountAfter > buildingCountBefore) {
    tutorialManager.complete('building');
  }
});

canvas.addEventListener('pointermove', (event) => {
  const { x, y } = toWorldCoords(event);
  game.onPointerMove(x, y);
});

canvas.addEventListener('contextmenu', (event) => {
  event.preventDefault();
});

buildPrompt.addEventListener('click', () => {
  setItemShopOpen(false);
  if (game.isBuildModeActive()) {
    if (isBuildLedgerOpen) {
      disableBuildMode();
    } else {
      openBuildLedger();
    }
  } else {
    openBuildLedger();
  }
});

buildPrompt.addEventListener('mouseenter', () => {
  const title = buildPrompt.dataset.tooltipTitle;
  const body = buildPrompt.dataset.tooltipBody;
  if (title && body) {
    showTooltip(title, body);
  } else {
    showTooltip('(B)uild', 'Select a structure in the workshop to prepare a build plan.');
  }
});

buildPrompt.addEventListener('mouseleave', hideTooltip);

questLogCloseButton.addEventListener('click', () => setQuestLogOpen(false));
questLogOverlay.addEventListener('click', (event) => {
  if (event.target === questLogOverlay) {
    setQuestLogOpen(false);
  }
});
inventoryOverlayClose.addEventListener('click', () => closeInventoryOverlay());
inventoryOverlay.addEventListener('click', (event) => {
  if (event.target === inventoryOverlay) {
    closeInventoryOverlay();
  }
});
metaOverlayClose.addEventListener('click', () => closeMetaOverlay());
metaProgressionOverlay.addEventListener('click', (event) => {
  if (event.target === metaProgressionOverlay) {
    closeMetaOverlay();
  }
});
metaWeaponBack.addEventListener('click', () => {
  const previous = activeMetaWeaponId;
  metaWeaponList.classList.remove('hidden');
  metaWeaponDetail.classList.add('hidden');
  activeMetaWeaponId = null;
  metaUpgradeButtons.clear();
  metaUpgradeList.innerHTML = '';
  metaWeaponButtons.forEach((button) => button.classList.remove('active'));
  updateMetaShardDisplay();
  if (previous) {
    const previousButton = metaWeaponButtons.get(previous);
    previousButton?.focus();
  } else {
    metaOverlayClose.focus();
  }
});
questDialogPrimary.addEventListener('click', handleQuestDialogPrimary);
questDialogSecondary.addEventListener('click', handleQuestDialogSecondary);
questDialogCloseButton.addEventListener('click', handleQuestDialogSecondary);

window.addEventListener('keydown', (event) => {
  if (event.key === 'F1') {
    event.preventDefault();
    game.toggleAnchorDebug();
    return;
  }

  if (event.defaultPrevented) {
    return;
  }

  if (event.key === 'Escape') {
    if (isEscapeMenuOpen) {
      event.preventDefault();
      closeEscapeMenu();
      return;
    }
    if (activeItemDetailId) {
      event.preventDefault();
      closeItemDetail();
      return;
    }
    if (isMetaOverlayOpen) {
      event.preventDefault();
      closeMetaOverlay();
      return;
    }
    if (isInventoryOverlayOpen) {
      event.preventDefault();
      closeInventoryOverlay();
      return;
    }
    if (isQuestLogOpen) {
      event.preventDefault();
      setQuestLogOpen(false);
      return;
    }
    if (!questDialogElement.classList.contains('hidden')) {
      event.preventDefault();
      handleQuestDialogSecondary();
      return;
    }
    if (game.isBuildModeActive()) {
      event.preventDefault();
      disableBuildMode();
      return;
    }
    event.preventDefault();
    openEscapeMenu();
    return;
  }

  const key = event.key.toLowerCase();
  if (key === 'r') {
    game.reset();
    game.setCanvasHudEnabled(false);
    updateInventory();
    updateBuildingShopButtons();
    setItemShopOpen(false);
    tavernAutoOpen = false;
    updateItemShopButtons();
    lastSupplies = game.getSupplies();
    resetGoldGainIndicator();
    lastKillCount = game.getTotalKills();
    lastAtTavern = game.isKnightAtTavern();
  } else if (key === 'b') {
    event.preventDefault();
    setItemShopOpen(false);
    if (game.isBuildModeActive()) {
      if (isBuildLedgerOpen) {
        disableBuildMode();
      } else {
        openBuildLedger();
      }
    } else {
      openBuildLedger();
    }
  } else if (key === 'i') {
    event.preventDefault();
    if (isInventoryOverlayOpen) {
      closeInventoryOverlay();
    } else {
      openInventoryOverlay();
    }
  } else if (key === 't') {
    event.preventDefault();
    if (isMetaOverlayOpen) {
      closeMetaOverlay();
    } else {
      openMetaOverlay();
    }
  } else if (key === 'q') {
    event.preventDefault();
    setQuestLogOpen(!isQuestLogOpen);
  } else if (key === 'c') {
    game.toggleCanopy();
  } else if (key === 'x') {
    game.startDismantle();
  }
});

function updateHud() {
  const supplies = game.getSupplies();
  if (supplies > lastSupplies) {
    showGoldGainIndicator(supplies - lastSupplies);
  } else if (supplies < lastSupplies) {
    resetGoldGainIndicator();
  }
  lastSupplies = supplies;
  heroGoldText.textContent = `${supplies}`;
  const relicShards = game.getRelicShards();
  if (relicShards > lastRelicShards) {
    showShardGainIndicator(relicShards - lastRelicShards);
  } else if (relicShards < lastRelicShards) {
    resetShardGainIndicator();
  }
  lastRelicShards = relicShards;
  heroShardText.textContent = `${relicShards}`;
  updateMetaShardDisplay();
  if (isMetaOverlayOpen) {
    for (const track of META_WEAPON_TRACKS) {
      updateMetaWeaponCard(track.weaponId);
    }
    refreshMetaUpgradeButtons();
  }
  const kills = game.getTotalKills();
  if (
    kills > lastKillCount &&
    tutorialManager.isCompleted('movement') &&
    !tutorialManager.isCompleted('combat')
  ) {
    tutorialManager.request('combat', { priority: true });
  }
  lastKillCount = kills;

  const { phase, remaining, duration, waveIndex } = game.getPhaseTimerInfo();
  const progress = duration > 0 ? 1 - Math.max(0, Math.min(1, remaining / duration)) : 1;
  darkEnergyFill.style.width = `${progress * 100}%`;
  let phaseText: string;
  if (phase === 'downtime') {
    const nextWave = waveIndex + 1;
    phaseText = `Downtime: Wave ${nextWave} begins in ${formatTimer(remaining)}`;
    nextWaveTimerText.textContent = `Next wave: ${formatTimer(remaining)}`;
  } else {
    if (remaining > 0) {
      phaseText = `Wave ${waveIndex} underway — ${formatTimer(remaining)} remaining`;
      nextWaveTimerText.textContent = `Wave ${waveIndex} remaining: ${formatTimer(remaining)}`;
    } else {
      phaseText = `Wave ${waveIndex} underway — clear remaining forces!`;
      nextWaveTimerText.textContent = `Wave ${waveIndex} — clear remaining foes`;
    }
  }
  darkEnergyText.textContent = phaseText;
  renderVillageStatus(phase);
  const downtimeQuest = game.getDowntimeQuestHud();
  if (downtimeQuest && phase === 'downtime') {
    downtimeQuestPanel.classList.remove('hidden');
    downtimeQuestPanel.classList.toggle('completed', downtimeQuest.completed);
    downtimeQuestTitle.textContent = downtimeQuest.title;
    downtimeQuestDescription.textContent = downtimeQuest.description;
    downtimeQuestProgress.textContent = `${downtimeQuest.progressText} • ${downtimeQuest.rewardText}`;
  } else {
    downtimeQuestPanel.classList.add('hidden');
    downtimeQuestPanel.classList.remove('completed');
  }
  const atTavern = game.isKnightAtTavern() && game.isDowntime();
  if (atTavern) {
    tavernAutoOpen = true;
    setItemShopOpen(true);
  } else if (tavernAutoOpen) {
    setItemShopOpen(false);
    tavernAutoOpen = false;
  }

  if (
    atTavern &&
    !lastAtTavern &&
    tutorialManager.isCompleted('quests') &&
    !tutorialManager.isCompleted('healing') &&
    !tutorialManager.isQueued('healing')
  ) {
    tutorialManager.request('healing', { priority: true });
  }
  lastAtTavern = atTavern;

  if (lastPhase !== phase) {
    if (phase === 'wave') {
      setItemShopOpen(false);
      if (
        tutorialManager.isCompleted('movement') &&
        !tutorialManager.isCompleted('combat') &&
        !tutorialManager.isQueued('combat')
      ) {
        tutorialManager.request('combat', { priority: true });
      }
    } else if (phase === 'downtime') {
      if (
        tutorialManager.isCompleted('combat') &&
        !tutorialManager.isCompleted('building') &&
        !tutorialManager.isQueued('building')
      ) {
        tutorialManager.request('building', { priority: true });
      }
    }
    lastPhase = phase;
  }

  const showOverlay = game.state === 'victory' || game.state === 'defeat';
  gameOverScreen.classList.toggle('hidden', !showOverlay);
  if (showOverlay) {
    if (game.state === 'victory') {
      gameOverTitle.textContent = 'Dominion Secured';
      gameOverTitle.style.color = '#34d399';
      gameOverSubtext.textContent = 'Press R to celebrate again.';
    } else {
      gameOverTitle.textContent = 'You Have Perished';
      gameOverTitle.style.color = '#f87171';
      gameOverSubtext.textContent = 'Press R to try again.';
    }
  }

  const buildError = game.getBuildErrorMessage();
  if (buildError) {
    buildErrorMessage.textContent = buildError;
    buildErrorMessage.classList.add('visible');
  } else {
    if (buildErrorMessage.textContent) {
      buildErrorMessage.textContent = '';
    }
    buildErrorMessage.classList.remove('visible');
  }

  updateInventory();
  updateBuildingShopButtons();
  updateItemShopButtons();
  renderActivities();
  if (isQuestLogOpen) {
    renderQuestLog();
  }
  updateQuestDialog();
}

const ctx = context;
let lastTime = performance.now();
function frame(now: number) {
  const elapsed = now - lastTime;
  lastTime = now;
  const dt = Math.min(elapsed / 1000, 0.2);
  if (!tutorialPaused) {
    game.update(dt);
  }
  const cameraState: CameraState = {
    viewportWidth: canvas.width,
    viewportHeight: canvas.height,
    iso: isoTransform
  };
  game.draw(ctx, cameraState);
  updateHud();
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
