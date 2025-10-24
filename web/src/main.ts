import './style.css';
import { Game, CameraState, NearbyQuestInteraction, QuestLogEntry } from './game';
import {
  HEIGHT,
  WIDTH,
  VIEWPORT_HEIGHT,
  KNIGHT_HP,
  BuildingType
} from './config/constants';
import { getBuildingDefinition } from './entities/building';
import { ITEM_DEFINITIONS, ITEM_ORDER, ItemId } from './config/items';

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

const INVENTORY_SLOTS = ITEM_ORDER.length + 1;
const INITIAL_CAMERA_ZOOM = 1.6;
const MIN_CAMERA_ZOOM = 0.75;
const MAX_CAMERA_ZOOM = 2.5;
const CAMERA_PAN_SPEED = 240;
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
        <h2>Dark Energy</h2>
        <div class="bar"><div class="bar-fill" id="darkEnergyFill"></div></div>
        <p id="darkEnergyText">Gathering energy…</p>
      </div>
      <div class="hud">
        <div class="ui-panel stats-panel">
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
          <div class="stat-row">
            <span class="stat-label health">Health</span>
            <div class="health-bar">
              <div class="health-bar-fill" id="heroHealthBar"></div>
            </div>
            <span class="health-text" id="heroHealthText">${KNIGHT_HP}/${KNIGHT_HP}</span>
          </div>
        </div>
        <button class="ui-panel build-toggle" id="buildPrompt" type="button">
          <span class="build-toggle-icon" aria-hidden="true">🔨</span>
          <span class="build-toggle-text">(B)uild</span>
        </button>
        <div class="build-feedback" id="buildErrorMessage" role="status" aria-live="polite"></div>
        <div class="ui-panel inventory" id="inventoryPanel"></div>
        <div class="ui-panel buffs-panel" id="buffsPanel">
          <div class="buffs-title">Temporary Blessings</div>
          <ul class="buffs-list" id="buffList"></ul>
        </div>
      </div>
      <div class="shop-panel ui-panel hidden" id="buildingShopPanel">
        <h2>Workshop Ledger</h2>
        <div class="shop-items" id="shopItemsContainer"></div>
      </div>
      <div class="shop-panel ui-panel hidden" id="itemShopPanel">
        <h2>Hero Arsenal</h2>
        <div class="shop-items" id="itemShopItemsContainer"></div>
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
    </div>
  </div>
`;

const canvas = requireElement<HTMLCanvasElement>('#gameCanvas');
canvas.width = WIDTH;
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
  const aspectRatio = WIDTH / VIEWPORT_HEIGHT;

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

const camera = {
  center: { x: WIDTH / 2, y: HEIGHT / 2 },
  zoom: INITIAL_CAMERA_ZOOM
};

function clampCamera() {
  const halfViewWidth = (canvas.width / camera.zoom) / 2;
  const halfViewHeight = (canvas.height / camera.zoom) / 2;

  const minX = halfViewWidth;
  const maxX = WIDTH - halfViewWidth;
  if (minX > maxX) {
    camera.center.x = WIDTH / 2;
  } else {
    camera.center.x = Math.max(minX, Math.min(maxX, camera.center.x));
  }

  const minY = halfViewHeight;
  const maxY = HEIGHT - halfViewHeight;
  if (minY > maxY) {
    camera.center.y = HEIGHT / 2;
  } else {
    camera.center.y = Math.max(minY, Math.min(maxY, camera.center.y));
  }
}

const cameraPan = { up: false, down: false, left: false, right: false };

function updateCameraPosition(dt: number): void {
  let dx = 0;
  let dy = 0;
  if (cameraPan.left) {
    dx -= 1;
  }
  if (cameraPan.right) {
    dx += 1;
  }
  if (cameraPan.up) {
    dy -= 1;
  }
  if (cameraPan.down) {
    dy += 1;
  }
  if (dx === 0 && dy === 0) {
    return;
  }
  const length = Math.hypot(dx, dy);
  if (length > 0) {
    dx /= length;
    dy /= length;
  }
  const speed = CAMERA_PAN_SPEED / camera.zoom;
  camera.center.x += dx * speed * dt;
  camera.center.y += dy * speed * dt;
  clampCamera();
}

clampCamera();

const game = new Game();
game.setCanvasHudEnabled(false);

function focusCameraOnKnight(options?: { zoom?: number }): void {
  if (options && typeof options.zoom === 'number') {
    camera.zoom = Math.max(MIN_CAMERA_ZOOM, Math.min(MAX_CAMERA_ZOOM, options.zoom));
  }
  const { x, y } = game.knight.pos;
  camera.center.x = x;
  camera.center.y = y;
  clampCamera();
}

focusCameraOnKnight({ zoom: INITIAL_CAMERA_ZOOM });

const tooltipPanel = requireElement<HTMLDivElement>('#tooltipPanel');
const inventoryPanel = requireElement<HTMLDivElement>('#inventoryPanel');
inventoryPanel.style.setProperty('--inventory-columns', `${INVENTORY_SLOTS}`);
const heroGoldText = requireElement<HTMLSpanElement>('#heroGoldText');
const heroGoldGain = requireElement<HTMLSpanElement>('#heroGoldGain');
const heroShardText = requireElement<HTMLSpanElement>('#heroShardText');
const heroShardGain = requireElement<HTMLSpanElement>('#heroShardGain');
const heroHealthBar = requireElement<HTMLDivElement>('#heroHealthBar');
const heroHealthText = requireElement<HTMLSpanElement>('#heroHealthText');
const buildPrompt = requireElement<HTMLButtonElement>('#buildPrompt');
const buildErrorMessage = requireElement<HTMLDivElement>('#buildErrorMessage');
const darkEnergyFill = requireElement<HTMLDivElement>('#darkEnergyFill');
const darkEnergyText = requireElement<HTMLParagraphElement>('#darkEnergyText');
const buffList = requireElement<HTMLUListElement>('#buffList');
const campMarkerLayer = requireElement<HTMLDivElement>('#campMarkerLayer');
const buildingShopPanel = requireElement<HTMLDivElement>('#buildingShopPanel');
const buildingShopItemsContainer = requireElement<HTMLDivElement>('#shopItemsContainer');
const itemShopPanel = requireElement<HTMLDivElement>('#itemShopPanel');
const itemShopItemsContainer = requireElement<HTMLDivElement>('#itemShopItemsContainer');
const gameOverScreen = requireElement<HTMLDivElement>('#gameOverScreen');
const gameOverTitle = requireElement<HTMLHeadingElement>('#gameOverTitle');
const gameOverSubtext = requireElement<HTMLParagraphElement>('#gameOverSubtext');
const questLogOverlay = requireElement<HTMLDivElement>('#questLogOverlay');
const questLogList = requireElement<HTMLUListElement>('#questLogList');
const questLogCloseButton = requireElement<HTMLButtonElement>('#questLogClose');
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

let lastSupplies = game.getSupplies();
let lastRelicShards = game.getRelicShards();
let pendingGoldGain = 0;
let pendingShardGain = 0;

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
  const costText = definition.cost > 0 ? `${definition.cost} Supplies` : 'Starting gear';
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
  if (definition.buildPaths.length) {
    for (const tip of definition.buildPaths) {
      const li = document.createElement('li');
      li.textContent = tip;
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

function updateInventory() {
  const loadout = game.getHeroLoadout();
  for (let i = 0; i < inventorySlots.length; i++) {
    const slot = inventorySlots[i];
    const entry = loadout[i];
    if (entry) {
      slot.innerHTML = `<div class="item-icon">${entry.icon}</div>`;
      slot.classList.add('has-item');
      slot.classList.remove('empty');
      slot.classList.toggle('item-evolved', entry.evolved);
      slot.onmouseenter = () =>
        showTooltip(entry.name, `${entry.description}<br /><em>${entry.status}</em>`);
      slot.onmouseleave = hideTooltip;
      slot.onclick = (event) => {
        if (!(event.target instanceof HTMLElement)) {
          return;
        }
        if (event.target.closest('.item-icon')) {
          openItemDetail(entry.id, { progressText: entry.status, evolved: entry.evolved });
        }
      };
      const iconElement = slot.querySelector<HTMLDivElement>('.item-icon');
      if (iconElement) {
        iconElement.setAttribute('role', 'button');
        iconElement.setAttribute('aria-label', `${entry.name} details`);
        iconElement.tabIndex = 0;
        iconElement.addEventListener('click', (event) => {
          event.stopPropagation();
          openItemDetail(entry.id, { progressText: entry.status, evolved: entry.evolved });
        });
        iconElement.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openItemDetail(entry.id, { progressText: entry.status, evolved: entry.evolved });
          }
        });
      }
    } else {
      slot.innerHTML = '';
      slot.classList.remove('has-item', 'item-evolved');
      slot.classList.add('empty');
      slot.onmouseenter = null;
      slot.onmouseleave = null;
      slot.onclick = null;
    }
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
    button.innerHTML = `<span>${info.icon} ${info.name}</span><span class="price">${definition.cost} Supplies</span>`;
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
let tavernAutoOpen = false;
let isQuestLogOpen = false;
let activeQuestDialog: NearbyQuestInteraction | null = null;
const dismissedQuestInteractions = new Set<number>();
let lastQuestInteractionGiverId: number | null = null;
let isBuildLedgerOpen = false;

function openBuildLedger(): void {
  if (!game.isBuildModeActive()) {
    game.setBuildMode(true);
  }
  if (!isBuildLedgerOpen) {
    isBuildLedgerOpen = true;
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
  }
  updateItemShopButtons();
}

function populateItemShop(): void {
  itemShopItemsContainer.innerHTML = '';
  itemButtons.clear();
  for (const itemId of ITEM_ORDER) {
    const definition = ITEM_DEFINITIONS[itemId];
    const button = document.createElement('button');
    button.className = 'shop-button';
    const label = document.createElement('span');
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
    button.append(label, price);
    button.addEventListener('click', () => {
      if (game.purchaseItem(itemId)) {
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
        priceSpan.textContent = `${definition.cost} Supplies`;
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

    const screenX = (camp.position.x - camera.center.x) * camera.zoom + canvas.width / 2;
    const screenY = (camp.position.y - camera.center.y) * camera.zoom + canvas.height / 2;

    const cssX = offsetX + screenX * scaleX;
    const cssY = offsetY + screenY * scaleY;
    marker.style.left = `${cssX}px`;
    marker.style.top = `${cssY}px`;

    const highlighted = highlightedCampIds.has(camp.id) && !camp.cleared;
    if (highlighted) {
      marker.classList.add('highlighted');
      const radiusOffset = camp.radius * camera.zoom * scaleY + 12;
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
  isQuestLogOpen = nextState;
  questLogOverlay.classList.toggle('hidden', !nextState);
  questLogOverlay.setAttribute('aria-hidden', nextState ? 'false' : 'true');
  if (nextState) {
    renderQuestLog();
  }
}

function showQuestDialog(interaction: NearbyQuestInteraction): void {
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
  if (questDialogElement.classList.contains('hidden')) {
    activeQuestDialog = null;
    return;
  }
  questDialogElement.classList.add('hidden');
  questDialogElement.setAttribute('aria-hidden', 'true');
  activeQuestDialog = null;
}

function updateQuestDialog(): void {
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

const screenToWorld = (x: number, y: number) => {
  const worldX = (x - canvas.width / 2) / camera.zoom + camera.center.x;
  const worldY = (y - canvas.height / 2) / camera.zoom + camera.center.y;
  return { x: worldX, y: worldY };
};

const toWorldCoords = (event: PointerEvent) => {
  const { x, y } = getCanvasPixelCoords(event);
  const { x: worldX, y: worldY } = screenToWorld(x, y);
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
  game.onPointerDown(x, y, event.button, event.timeStamp / 1000);
});

canvas.addEventListener('pointermove', (event) => {
  const { x, y } = toWorldCoords(event);
  game.onPointerMove(x, y);
});

canvas.addEventListener(
  'wheel',
  (event) => {
    event.preventDefault();
    const { x, y } = getCanvasPixelCoords(event);
    const focus = screenToWorld(x, y);
    const zoomFactor = Math.exp(-event.deltaY * 0.001);
    const nextZoom = Math.max(MIN_CAMERA_ZOOM, Math.min(MAX_CAMERA_ZOOM, camera.zoom * zoomFactor));
    if (nextZoom === camera.zoom) {
      return;
    }

    camera.zoom = nextZoom;

    const offsetX = x - canvas.width / 2;
    const offsetY = y - canvas.height / 2;
    camera.center.x = focus.x - offsetX / camera.zoom;
    camera.center.y = focus.y - offsetY / camera.zoom;

    clampCamera();
  },
  { passive: false }
);

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
questDialogPrimary.addEventListener('click', handleQuestDialogPrimary);
questDialogSecondary.addEventListener('click', handleQuestDialogSecondary);
questDialogCloseButton.addEventListener('click', handleQuestDialogSecondary);

window.addEventListener('keydown', (event) => {
  if (event.key === 'F1') {
    event.preventDefault();
    game.toggleAnchorDebug();
    return;
  }

  const key = event.key.toLowerCase();
  const code = event.code;
  if (key === 'escape') {
    if (isQuestLogOpen) {
      setQuestLogOpen(false);
      event.preventDefault();
      return;
    }
    if (!questDialogElement.classList.contains('hidden')) {
      handleQuestDialogSecondary();
      event.preventDefault();
      return;
    }
    if (game.isBuildModeActive()) {
      disableBuildMode();
      event.preventDefault();
      return;
    }
  }

  if (key === 'r') {
    game.reset();
    game.setCanvasHudEnabled(false);
    focusCameraOnKnight({ zoom: INITIAL_CAMERA_ZOOM });
    cameraPan.up = cameraPan.down = cameraPan.left = cameraPan.right = false;
    updateInventory();
    updateBuildingShopButtons();
    setItemShopOpen(false);
    tavernAutoOpen = false;
    updateItemShopButtons();
    lastSupplies = game.getSupplies();
    resetGoldGainIndicator();
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
    setItemShopOpen(!isItemShopOpen);
  } else if (key === 'q') {
    event.preventDefault();
    setQuestLogOpen(!isQuestLogOpen);
  } else if (key === 'c') {
    game.toggleCanopy();
  } else if (code === 'Space') {
    event.preventDefault();
    focusCameraOnKnight();
  } else if (code === 'KeyW') {
    event.preventDefault();
    cameraPan.up = true;
  } else if (code === 'KeyS') {
    event.preventDefault();
    cameraPan.down = true;
  } else if (code === 'KeyA') {
    event.preventDefault();
    cameraPan.left = true;
  } else if (code === 'KeyD') {
    event.preventDefault();
    cameraPan.right = true;
  } else if (key === 'x') {
    game.startDismantle();
  }
});

window.addEventListener('keyup', (event) => {
  switch (event.code) {
    case 'KeyW':
      cameraPan.up = false;
      break;
    case 'KeyS':
      cameraPan.down = false;
      break;
    case 'KeyA':
      cameraPan.left = false;
      break;
    case 'KeyD':
      cameraPan.right = false;
      break;
    default:
      break;
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
  const hp = Math.max(0, game.knight.hp);
  const hpRatio = Math.max(0, Math.min(1, hp / KNIGHT_HP));
  heroHealthBar.style.width = `${hpRatio * 100}%`;
  heroHealthText.textContent = `${Math.ceil(hp)}/${KNIGHT_HP}`;

  const { phase, remaining, duration, waveIndex } = game.getPhaseTimerInfo();
  const progress = duration > 0 ? 1 - Math.max(0, Math.min(1, remaining / duration)) : 1;
  darkEnergyFill.style.width = `${progress * 100}%`;
  let phaseText: string;
  if (phase === 'downtime') {
    const nextWave = waveIndex + 1;
    phaseText = `Downtime: Wave ${nextWave} begins in ${formatTimer(remaining)}`;
  } else {
    if (remaining > 0) {
      phaseText = `Wave ${waveIndex} underway — ${formatTimer(remaining)} remaining`;
    } else {
      phaseText = `Wave ${waveIndex} underway — clear remaining forces!`;
    }
  }
  darkEnergyText.textContent = phaseText;
  const atTavern = game.isKnightAtTavern() && game.isDowntime();
  if (atTavern) {
    tavernAutoOpen = true;
    setItemShopOpen(true);
  } else if (tavernAutoOpen) {
    setItemShopOpen(false);
    tavernAutoOpen = false;
  }

  if (lastPhase !== phase) {
    if (phase === 'wave') {
      setItemShopOpen(false);
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
  const dt = Math.min((now - lastTime) / 1000, 0.2);
  lastTime = now;
  updateCameraPosition(dt);
  game.update(dt);
  const cameraState: CameraState = {
    center: camera.center,
    zoom: camera.zoom,
    viewportWidth: canvas.width,
    viewportHeight: canvas.height
  };
  game.draw(ctx, cameraState);
  updateHud();
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
