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

canvas.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) {
    return;
  }
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (event.clientX - rect.left) * scaleX;
  const y = (event.clientY - rect.top) * scaleY;
  game.onPointer(x, y, event.timeStamp / 1000);
});

window.addEventListener('keydown', (event) => {
  if (event.key.toLowerCase() === 'r') {
    game.reset();
  } else if (event.key === 'F1') {
    event.preventDefault();
    game.toggleAnchorDebug();
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
