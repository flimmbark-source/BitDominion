import './style.css';
import { Game, CameraState } from './game';
import {
  HEIGHT,
  WIDTH,
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

const INVENTORY_SLOTS = 6;
const CYCLE_LENGTH = 120;

const INITIAL_CAMERA_ZOOM = 1.25;
const MIN_CAMERA_ZOOM = 0.75;
const MAX_CAMERA_ZOOM = 2.5;

const appRoot = document.querySelector<HTMLDivElement>('#app');
if (!appRoot) {
  throw new Error('Missing #app root element');
}

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector(selector);
  if (!element) {
    throw new Error(`Missing element: ${selector}`);
  }
  return element as T;
}

appRoot.innerHTML = `
  <div class="game-shell">
    <div class="game-header">
      <h1>Grimm Dominion – Prototype</h1>
      <p>
        Mode: <strong>Countdown</strong> |
        Loop: <strong>Setup → Quests → Wave → Rest</strong>
      </p>
      <div class="header-actions">
        <button class="header-button" id="workshopButton">Workshop (B)</button>
        <button class="header-button" id="arsenalButton">Arsenal (I)</button>
        <button class="header-button" id="canopyButton">Toggle Canopy (C)</button>
        <button class="header-button" id="resetButton">Reset (R)</button>
      </div>
    </div>
    <div class="game-container" id="gameContainer">
      <canvas id="gameCanvas" class="game-canvas"></canvas>
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
          </div>
          <div class="stat-row">
            <span class="stat-label health">Health</span>
            <div class="health-bar">
              <div class="health-bar-fill" id="heroHealthBar"></div>
            </div>
            <span class="health-text" id="heroHealthText">${KNIGHT_HP}/${KNIGHT_HP}</span>
          </div>
        </div>
        <div class="ui-panel inventory" id="inventoryPanel"></div>
        <div class="ui-panel hero-items" id="heroItemsPanel">
          <div class="hero-items-title">Hero Gear</div>
          <div class="hero-items-grid" id="heroItemsContainer"></div>
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
    </div>
  </div>
`;

const canvas = requireElement<HTMLCanvasElement>('#gameCanvas');
canvas.width = WIDTH;
canvas.height = HEIGHT;

const context = canvas.getContext('2d');
if (!context) {
  throw new Error('Unable to create canvas rendering context');
}

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

clampCamera();

const game = new Game();
game.setCanvasHudEnabled(false);

const tooltipPanel = requireElement<HTMLDivElement>('#tooltipPanel');
const inventoryPanel = requireElement<HTMLDivElement>('#inventoryPanel');
const heroGoldText = requireElement<HTMLSpanElement>('#heroGoldText');
const heroHealthBar = requireElement<HTMLDivElement>('#heroHealthBar');
const heroHealthText = requireElement<HTMLSpanElement>('#heroHealthText');
const darkEnergyFill = requireElement<HTMLDivElement>('#darkEnergyFill');
const darkEnergyText = requireElement<HTMLParagraphElement>('#darkEnergyText');
const heroItemsContainer = requireElement<HTMLDivElement>('#heroItemsContainer');
const buildingShopPanel = requireElement<HTMLDivElement>('#buildingShopPanel');
const buildingShopItemsContainer = requireElement<HTMLDivElement>('#shopItemsContainer');
const itemShopPanel = requireElement<HTMLDivElement>('#itemShopPanel');
const itemShopItemsContainer = requireElement<HTMLDivElement>('#itemShopItemsContainer');
const gameOverScreen = requireElement<HTMLDivElement>('#gameOverScreen');
const gameOverTitle = requireElement<HTMLHeadingElement>('#gameOverTitle');
const gameOverSubtext = requireElement<HTMLParagraphElement>('#gameOverSubtext');
const workshopButton = requireElement<HTMLButtonElement>('#workshopButton');
const arsenalButton = requireElement<HTMLButtonElement>('#arsenalButton');
const canopyButton = requireElement<HTMLButtonElement>('#canopyButton');
const resetButton = requireElement<HTMLButtonElement>('#resetButton');

const inventorySlots: HTMLDivElement[] = [];
for (let i = 0; i < INVENTORY_SLOTS; i++) {
  const slot = document.createElement('div');
  slot.className = 'inventory-slot';
  inventoryPanel.appendChild(slot);
  inventorySlots.push(slot);
}

const buildingShopButtons = new Map<BuildingType, HTMLButtonElement>();
const itemButtons = new Map<ItemId, HTMLButtonElement>();

function showTooltip(title: string, body: string) {
  tooltipPanel.innerHTML = `<div class="title">${title}</div><div>${body}</div>`;
  tooltipPanel.style.display = 'block';
}

function hideTooltip() {
  tooltipPanel.style.display = 'none';
}

document.addEventListener('pointermove', (event) => {
  if (tooltipPanel.style.display === 'none') {
    return;
  }
  tooltipPanel.style.left = `${event.clientX + 16}px`;
  tooltipPanel.style.top = `${event.clientY + 18}px`;
});

function updateInventory() {
  const order = game.getBuildOrder();
  const selectedIndex = game.getSelectedBlueprintIndex();
  for (let i = 0; i < inventorySlots.length; i++) {
    const slot = inventorySlots[i];
    const type = order[i];
    if (type) {
      const info = BUILDING_DISPLAY[type];
      slot.innerHTML = `<div class="item-icon">${info.icon}</div>`;
      slot.classList.add('available');
      slot.classList.toggle('selected', i === selectedIndex);
      slot.onclick = () => {
        game.selectBlueprint(i);
        updateInventory();
        updateBuildingShopButtons();
        setItemShopOpen(false);
        if (!game.isBuildModeActive()) {
          game.setBuildMode(true);
        }
      };
      slot.onmouseenter = () => showTooltip(info.name, info.description);
      slot.onmouseleave = hideTooltip;
    } else {
      slot.innerHTML = '';
      slot.classList.remove('available', 'selected');
      slot.onclick = null;
      slot.onmouseenter = null;
      slot.onmouseleave = null;
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
        updateInventory();
        updateBuildingShopButtons();
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
  const supplies = game.getSupplies();
  const selected = game.getSelectedBlueprint();
  for (const [type, button] of buildingShopButtons.entries()) {
    const definition = getBuildingDefinition(type);
    const affordable = supplies >= definition.cost;
    button.classList.toggle('disabled', !affordable);
    button.classList.toggle('selected', type === selected);
  }
  buildingShopPanel.classList.toggle('hidden', !game.isBuildModeActive());
  workshopButton.classList.toggle('selected', game.isBuildModeActive());
}

let isItemShopOpen = false;
let lastHeroItemsKey = '';

function setItemShopOpen(open: boolean): void {
  if (isItemShopOpen === open) {
    return;
  }
  isItemShopOpen = open;
  if (open && game.isBuildModeActive()) {
    game.setBuildMode(false);
    updateBuildingShopButtons();
  }
  if (!open) {
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
    button.innerHTML = `<span>${definition.icon} ${definition.name}</span><span class="price"></span>`;
    button.addEventListener('click', () => {
      if (game.purchaseItem(itemId)) {
        updateItemShopButtons();
        updateHeroItems(true);
      }
    });
    button.addEventListener('mouseenter', () => showTooltip(definition.name, definition.description));
    button.addEventListener('mouseleave', hideTooltip);
    itemShopItemsContainer.appendChild(button);
    itemButtons.set(itemId, button);
  }
  updateItemShopButtons();
}

function updateItemShopButtons(): void {
  for (const [itemId, button] of itemButtons.entries()) {
    const definition = ITEM_DEFINITIONS[itemId];
    const owned = game.isItemOwned(itemId);
    const canPurchase = game.canPurchaseItem(itemId);
    const priceSpan = button.querySelector<HTMLSpanElement>('.price');
    if (priceSpan) {
      priceSpan.textContent = owned ? 'Owned' : `${definition.cost} Supplies`;
    }
    button.classList.toggle('disabled', !canPurchase);
    button.classList.toggle('owned', owned);
  }
  itemShopPanel.classList.toggle('hidden', !isItemShopOpen);
  arsenalButton.classList.toggle('selected', isItemShopOpen);
}

function updateHeroItems(force = false): void {
  const items = game.getOwnedItems();
  const key = items.join('|');
  if (!force && key === lastHeroItemsKey) {
    return;
  }
  lastHeroItemsKey = key;
  heroItemsContainer.innerHTML = '';
  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'hero-item hero-item-empty';
    empty.textContent = 'None';
    heroItemsContainer.appendChild(empty);
    return;
  }
  for (const itemId of items) {
    const definition = ITEM_DEFINITIONS[itemId];
    const itemElement = document.createElement('div');
    itemElement.className = 'hero-item';
    itemElement.innerHTML = `<span class="item-icon">${definition.icon}</span>`;
    itemElement.addEventListener('mouseenter', () => showTooltip(definition.name, definition.description));
    itemElement.addEventListener('mouseleave', hideTooltip);
    heroItemsContainer.appendChild(itemElement);
  }
}

populateBuildingShop();
populateItemShop();
updateInventory();
updateBuildingShopButtons();
updateItemShopButtons();
updateHeroItems(true);

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

workshopButton.addEventListener('click', () => {
  setItemShopOpen(false);
  game.toggleBuildMode();
  updateBuildingShopButtons();
});

arsenalButton.addEventListener('click', () => {
  setItemShopOpen(!isItemShopOpen);
});

canopyButton.addEventListener('click', () => {
  game.toggleCanopy();
});

resetButton.addEventListener('click', () => {
  game.reset();
  game.setCanvasHudEnabled(false);
  updateInventory();
  updateBuildingShopButtons();
  setItemShopOpen(false);
  updateItemShopButtons();
  updateHeroItems(true);
});

window.addEventListener('keydown', (event) => {
  if (event.key === 'F1') {
    event.preventDefault();
    game.toggleAnchorDebug();
    return;
  }

  const key = event.key.toLowerCase();
  if (key === 'r') {
    game.reset();
    game.setCanvasHudEnabled(false);
    updateInventory();
    updateBuildingShopButtons();
    setItemShopOpen(false);
    updateItemShopButtons();
    updateHeroItems(true);
  } else if (key === 'b') {
    event.preventDefault();
    setItemShopOpen(false);
    game.toggleBuildMode();
    updateBuildingShopButtons();
  } else if (key === 'i') {
    event.preventDefault();
    setItemShopOpen(!isItemShopOpen);
  } else if (key === 'c') {
    game.toggleCanopy();
  } else if (key >= '1' && key <= '5') {
    game.selectBlueprint(Number(key) - 1);
    updateInventory();
    updateBuildingShopButtons();
    setItemShopOpen(false);
  } else if (key === 'x') {
    game.startDismantle();
  }
});

function computePhase(energy: number): 'GATHERING' | 'QUEST' | 'WAVE' | 'REST' {
  if (game.state !== 'running') {
    return 'REST';
  }
  if (game.getUnitCount() >= 12) {
    return 'WAVE';
  }
  if (game.isAnyVillageAlarmed() || game.isAnySealChanneling()) {
    return 'QUEST';
  }
  const energyInCycle = energy % CYCLE_LENGTH;
  if (energyInCycle > CYCLE_LENGTH * 0.75) {
    return 'REST';
  }
  return 'GATHERING';
}

function updateHud() {
  heroGoldText.textContent = `${game.getSupplies()}`;
  const hp = Math.max(0, game.knight.hp);
  const hpRatio = Math.max(0, Math.min(1, hp / KNIGHT_HP));
  heroHealthBar.style.width = `${hpRatio * 100}%`;
  heroHealthText.textContent = `${Math.ceil(hp)}/${KNIGHT_HP}`;

  const energy = game.getDarkEnergy();
  const cycle = Math.max(1, Math.floor(energy / CYCLE_LENGTH) + 1);
  const energyInCycle = energy % CYCLE_LENGTH;
  const phase = computePhase(energy);
  const fillRatio = Math.max(0, Math.min(1, energyInCycle / CYCLE_LENGTH));
  darkEnergyFill.style.width = `${fillRatio * 100}%`;
  const phaseText =
    phase === 'WAVE'
      ? '⚔️ Dark wave in progress!'
      : phase === 'QUEST'
      ? 'Quests & incursions active'
      : phase === 'REST'
      ? 'Rest & rebuild'
      : 'Gathering energy…';
  darkEnergyText.textContent = `Cycle ${cycle}: ${phaseText}`;

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

  updateInventory();
  updateBuildingShopButtons();
  updateItemShopButtons();
  updateHeroItems();
}

const ctx = context;
let lastTime = performance.now();
function frame(now: number) {
  const dt = Math.min((now - lastTime) / 1000, 0.2);
  lastTime = now;
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
