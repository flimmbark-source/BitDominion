import { Game } from './game';
import { HEIGHT, WIDTH } from './config/constants';

const appRoot = document.querySelector<HTMLDivElement>('#app');
if (!appRoot) {
  throw new Error('Missing #app root element');
}

const canvas = document.createElement('canvas');
canvas.width = WIDTH;
canvas.height = HEIGHT;
appRoot.appendChild(canvas);

const context = canvas.getContext('2d');
if (!context) {
  throw new Error('Unable to create canvas rendering context');
}

const game = new Game();

const toCanvasCoords = (event: PointerEvent) => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (event.clientX - rect.left) * scaleX;
  const y = (event.clientY - rect.top) * scaleY;
  return { x, y };
};

canvas.addEventListener('pointerdown', (event) => {
  const { x, y } = toCanvasCoords(event);
  if (event.button === 2) {
    event.preventDefault();
  }
  game.onPointerDown(x, y, event.button, event.timeStamp / 1000);
});

canvas.addEventListener('pointermove', (event) => {
  const { x, y } = toCanvasCoords(event);
  game.onPointerMove(x, y);
});

canvas.addEventListener('contextmenu', (event) => {
  event.preventDefault();
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
  } else if (key === 'b') {
    event.preventDefault();
    game.toggleBuildMode();
  } else if (key === 'c') {
    game.toggleCanopy();
  } else if (key >= '1' && key <= '5') {
    game.selectBlueprint(Number(key) - 1);
  } else if (key === 'x') {
    game.startDismantle();
  }
});

const ctx = context;
let lastTime = performance.now();
function frame(now: number) {
  const dt = Math.min((now - lastTime) / 1000, 0.2);
  lastTime = now;
  game.update(dt);
  game.draw(ctx);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
