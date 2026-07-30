import type { SkinId } from "@/lib/skins";

export type AsteroidsCallbacks = {
  onScoreChange?: (score: number) => void;
  onLivesChange?: (lives: number) => void;
  onLevelChange?: (level: number) => void;
  onTripleShotChange?: (secondsLeft: number) => void;
  onGameOver?: (finalScore: number) => void;
};

export type AsteroidsOptions = {
  skin?: SkinId;
};

export type AsteroidsGame = {
  pause: () => void;
  resume: () => void;
  destroy: () => void;
  setKey: (code: string, pressed: boolean) => void;
  forceGameOver: () => void;
  setSkin: (skin: SkinId) => void;
};

const W = 800;
const H = 600;

const POWERUP_DROP_CHANCE = 0.15;
const POWERUP_DURATION = 5;
const POWERUP_TTL = 12;
const TRIPLE_SPREAD = 0.18;

const RADII = [0, 16, 30, 50];
const SPEEDS = [0, 85, 55, 32];
const POINTS = [0, 100, 50, 20];

type AsteroidsPalette = {
  ship: string;
  asteroid: string;
  bullet: string;
  powerUp: string;
  particleRgb: string;
  thrust: string;
  lineWidth: number;
  powerUpLineWidth: number;
  haloLineWidth: number;
  glow: number;
};

// Skin visual identities. `clasico` reproduces exactly what the game looked
// like before skins existed (flat white strokes) so the default view never
// changes for existing players. `neon` leans on shadowBlur for the glow
// mold used across the site; `retro` layers a dim halo stroke under the
// bright core stroke to fake CRT phosphor bleed without any shadowBlur.
const SKIN_COLORS: Record<SkinId, AsteroidsPalette> = {
  clasico: {
    ship: "#ffffff",
    asteroid: "#ffffff",
    bullet: "#ffffff",
    powerUp: "#00ffff",
    particleRgb: "255, 255, 255",
    thrust: "rgba(255, 130, 0, 0.85)",
    lineWidth: 1.5,
    powerUpLineWidth: 2,
    haloLineWidth: 0,
    glow: 0,
  },
  neon: {
    ship: "#00f5ff",
    asteroid: "#ff5edb",
    bullet: "#faff00",
    powerUp: "#00ff88",
    particleRgb: "255, 149, 0",
    thrust: "#faff00",
    lineWidth: 2,
    powerUpLineWidth: 2,
    haloLineWidth: 0,
    glow: 14,
  },
  retro: {
    ship: "#ffb000",
    asteroid: "#ffb000",
    bullet: "#ffe08a",
    powerUp: "#7dff5a",
    particleRgb: "255, 138, 30",
    thrust: "#ff5a00",
    lineWidth: 1.5,
    powerUpLineWidth: 2,
    haloLineWidth: 3,
    glow: 0,
  },
};

function shadeHex(hex: string, amount: number): string {
  const num = parseInt(hex.slice(1), 16);
  let r = (num >> 16) + amount;
  let g = ((num >> 8) & 0x00ff) + amount;
  let b = (num & 0x0000ff) + amount;
  r = Math.min(255, Math.max(0, r));
  g = Math.min(255, Math.max(0, g));
  b = Math.min(255, Math.max(0, b));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

// Strokes the current path with the active skin's treatment. Assumes the
// path was already built (beginPath/…/closePath) by the caller, since
// stroke() can be called more than once on the same path without clearing
// it — that's how the retro halo + core double-stroke works.
function strokeWithSkin(
  context: CanvasRenderingContext2D,
  color: string,
  lineWidth: number,
  haloLineWidth: number,
  glow: number,
) {
  if (glow) {
    context.save();
    context.shadowColor = color;
    context.shadowBlur = glow;
    context.strokeStyle = color;
    context.lineWidth = lineWidth;
    context.stroke();
    context.restore();
    context.strokeStyle = color;
    context.lineWidth = Math.max(1, lineWidth - 0.75);
    context.stroke();
    return;
  }
  if (haloLineWidth > 0) {
    context.strokeStyle = shadeHex(color, -110);
    context.lineWidth = lineWidth + haloLineWidth;
    context.stroke();
  }
  context.strokeStyle = color;
  context.lineWidth = lineWidth;
  context.stroke();
}

function fillDotWithSkin(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  glow: number,
) {
  if (glow) {
    context.save();
    context.shadowColor = color;
    context.shadowBlur = glow;
    context.fillStyle = color;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
    context.restore();
    return;
  }
  context.fillStyle = color;
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();
}

function wrap(v: number, max: number) {
  return ((v % max) + max) % max;
}
function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}
function randInt(min: number, max: number) {
  return Math.floor(rand(min, max + 1));
}

function getContext2D(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("2D context not available");
  return context;
}

type GameState = "playing" | "dead" | "gameover";

export function createAsteroidsGame(
  canvas: HTMLCanvasElement,
  callbacks: AsteroidsCallbacks,
  options: AsteroidsOptions = {},
): AsteroidsGame {
  const ctx = getContext2D(canvas);

  let skin: SkinId = options.skin ?? "clasico";

  const keys: Record<string, boolean> = {};
  const justPressed: Record<string, boolean> = {};
  const CAPTURED_CODES = new Set([
    "ArrowLeft",
    "ArrowRight",
    "ArrowUp",
    "Space",
  ]);

  function setKey(code: string, isPressed: boolean) {
    if (isPressed) {
      if (!keys[code]) justPressed[code] = true;
      keys[code] = true;
    } else {
      keys[code] = false;
    }
  }

  function pressed(code: string) {
    const val = !!justPressed[code];
    justPressed[code] = false;
    return val;
  }

  function onKeyDown(e: KeyboardEvent) {
    if (paused || state === "gameover") return;
    if (CAPTURED_CODES.has(e.code)) e.preventDefault();
    setKey(e.code, true);
  }
  function onKeyUp(e: KeyboardEvent) {
    setKey(e.code, false);
  }

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  class Bullet {
    x: number;
    y: number;
    vx: number;
    vy: number;
    ttl = 1.1;
    radius = 2;
    dead = false;
    constructor(x: number, y: number, angle: number) {
      this.x = x;
      this.y = y;
      const SPEED = 520;
      this.vx = Math.cos(angle) * SPEED;
      this.vy = Math.sin(angle) * SPEED;
    }
    update(dt: number) {
      this.x = wrap(this.x + this.vx * dt, W);
      this.y = wrap(this.y + this.vy * dt, H);
      this.ttl -= dt;
      if (this.ttl <= 0) this.dead = true;
    }
    draw() {
      const palette = SKIN_COLORS[skin];
      fillDotWithSkin(
        ctx,
        this.x,
        this.y,
        this.radius,
        palette.bullet,
        palette.glow,
      );
    }
  }

  class Asteroid {
    x: number;
    y: number;
    size: number;
    radius: number;
    dead = false;
    vx: number;
    vy: number;
    rotSpeed: number;
    rot: number;
    verts: [number, number][];
    constructor(x: number, y: number, size = 3) {
      this.x = x;
      this.y = y;
      this.size = size;
      this.radius = RADII[size];

      const angle = rand(0, Math.PI * 2);
      const speed = SPEEDS[size] + rand(-15, 15);
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
      this.rotSpeed = rand(-1.2, 1.2);
      this.rot = rand(0, Math.PI * 2);

      const n = randInt(8, 13);
      this.verts = [];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const r = this.radius * rand(0.6, 1.0);
        this.verts.push([Math.cos(a) * r, Math.sin(a) * r]);
      }
    }
    update(dt: number) {
      this.x = wrap(this.x + this.vx * dt, W);
      this.y = wrap(this.y + this.vy * dt, H);
      this.rot += this.rotSpeed * dt;
    }
    split(): Asteroid[] {
      if (this.size <= 1) return [];
      return [
        new Asteroid(this.x, this.y, this.size - 1),
        new Asteroid(this.x, this.y, this.size - 1),
      ];
    }
    draw() {
      const palette = SKIN_COLORS[skin];
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rot);
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(this.verts[0][0], this.verts[0][1]);
      for (let i = 1; i < this.verts.length; i++)
        ctx.lineTo(this.verts[i][0], this.verts[i][1]);
      ctx.closePath();
      strokeWithSkin(
        ctx,
        palette.asteroid,
        palette.lineWidth,
        palette.haloLineWidth,
        palette.glow,
      );
      ctx.restore();
    }
  }

  class PowerUp {
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius = 12;
    ttl = POWERUP_TTL;
    dead = false;
    constructor(x: number, y: number) {
      this.x = x;
      this.y = y;
      const angle = rand(0, Math.PI * 2);
      const speed = rand(20, 40);
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
    }
    update(dt: number) {
      this.x = wrap(this.x + this.vx * dt, W);
      this.y = wrap(this.y + this.vy * dt, H);
      this.ttl -= dt;
      if (this.ttl <= 0) this.dead = true;
    }
    draw() {
      if (this.ttl < 2 && Math.floor(this.ttl * 8) % 2 === 0) return;
      const palette = SKIN_COLORS[skin];
      const pulse = 0.85 + Math.sin(performance.now() / 150) * 0.15;
      const r = this.radius * pulse;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(Math.PI / 4);
      ctx.beginPath();
      ctx.rect(-r, -r, r * 2, r * 2);
      strokeWithSkin(
        ctx,
        palette.powerUp,
        palette.powerUpLineWidth,
        palette.haloLineWidth,
        palette.glow,
      );
      ctx.restore();
      ctx.save();
      if (palette.glow) {
        ctx.shadowColor = palette.powerUp;
        ctx.shadowBlur = palette.glow;
      }
      ctx.fillStyle = palette.powerUp;
      ctx.font = "bold 12px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("3x", this.x, this.y);
      ctx.restore();
    }
  }

  class Ship {
    x = W / 2;
    y = H / 2;
    angle = -Math.PI / 2;
    vx = 0;
    vy = 0;
    radius = 12;
    thrusting = false;
    invincible = 3;
    shootCooldown = 0;
    dead = false;
    tripleShot = 0;
    constructor() {
      this.reset();
    }
    reset() {
      this.x = W / 2;
      this.y = H / 2;
      this.angle = -Math.PI / 2;
      this.vx = 0;
      this.vy = 0;
      this.thrusting = false;
      this.invincible = 3;
      this.shootCooldown = 0;
      this.dead = false;
    }
    update(dt: number) {
      if (this.dead) return;
      if (this.invincible > 0) this.invincible -= dt;
      if (this.shootCooldown > 0) this.shootCooldown -= dt;
      if (this.tripleShot > 0) this.tripleShot -= dt;

      const ROT = 3.5;
      const THRUST = 260;
      const DRAG = 0.987;

      if (keys["ArrowLeft"]) this.angle -= ROT * dt;
      if (keys["ArrowRight"]) this.angle += ROT * dt;

      this.thrusting = !!keys["ArrowUp"];
      if (this.thrusting) {
        this.vx += Math.cos(this.angle) * THRUST * dt;
        this.vy += Math.sin(this.angle) * THRUST * dt;
      }

      this.vx *= DRAG;
      this.vy *= DRAG;
      this.x = wrap(this.x + this.vx * dt, W);
      this.y = wrap(this.y + this.vy * dt, H);
    }
    tryShoot(): Bullet[] {
      if (this.shootCooldown > 0 || this.dead) return [];
      this.shootCooldown = 0.2;
      const NOSE = 21;
      const ox = this.x + Math.cos(this.angle) * NOSE;
      const oy = this.y + Math.sin(this.angle) * NOSE;
      if (this.tripleShot > 0) {
        return [
          new Bullet(ox, oy, this.angle - TRIPLE_SPREAD),
          new Bullet(ox, oy, this.angle),
          new Bullet(ox, oy, this.angle + TRIPLE_SPREAD),
        ];
      }
      return [new Bullet(ox, oy, this.angle)];
    }
    draw() {
      if (this.dead) return;
      if (this.invincible > 0 && Math.floor(this.invincible * 8) % 2 === 0)
        return;

      const palette = SKIN_COLORS[skin];
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);
      ctx.lineJoin = "round";

      ctx.beginPath();
      ctx.moveTo(20, 0);
      ctx.lineTo(-12, -9);
      ctx.lineTo(-7, 0);
      ctx.lineTo(-12, 9);
      ctx.closePath();
      strokeWithSkin(
        ctx,
        palette.ship,
        palette.lineWidth,
        palette.haloLineWidth,
        palette.glow,
      );

      if (this.thrusting && Math.random() > 0.35) {
        ctx.beginPath();
        ctx.moveTo(-8, -4);
        ctx.lineTo(-8 - rand(6, 14), 0);
        ctx.lineTo(-8, 4);
        ctx.strokeStyle = palette.thrust;
        ctx.lineWidth = palette.lineWidth;
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  class Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    ttl: number;
    dead = false;
    constructor(x: number, y: number) {
      this.x = x;
      this.y = y;
      const angle = rand(0, Math.PI * 2);
      const speed = rand(30, 130);
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
      this.life = rand(0.4, 1.1);
      this.ttl = this.life;
    }
    update(dt: number) {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.ttl -= dt;
      if (this.ttl <= 0) this.dead = true;
    }
    draw() {
      const palette = SKIN_COLORS[skin];
      const alpha = this.ttl / this.life;
      ctx.strokeStyle = `rgba(${palette.particleRgb}, ${alpha.toFixed(2)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.x - this.vx * 0.05, this.y - this.vy * 0.05);
      ctx.stroke();
    }
  }

  let ship = new Ship();
  let bullets: Bullet[] = [];
  let asteroids: Asteroid[] = [];
  let particles: Particle[] = [];
  let powerUps: PowerUp[] = [];
  let score = 0;
  let lives = 3;
  let level = 1;
  let state: GameState = "playing";
  let deadTimer = 0;
  let powerUpSpawned = false;
  let killsSinceSpawn = 0;
  let lastReportedTripleShot = 0;

  function spawnAsteroids(count: number) {
    const SAFE_DIST = 130;
    for (let i = 0; i < count; i++) {
      let x: number, y: number;
      do {
        x = rand(0, W);
        y = rand(0, H);
      } while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST);
      asteroids.push(new Asteroid(x, y, 3));
    }
  }

  function initGame() {
    ship = new Ship();
    bullets = [];
    asteroids = [];
    particles = [];
    powerUps = [];
    powerUpSpawned = false;
    killsSinceSpawn = 0;
    score = 0;
    lives = 3;
    level = 1;
    state = "playing";
    spawnAsteroids(4);

    lastReportedTripleShot = 0;
    callbacks.onScoreChange?.(score);
    callbacks.onLivesChange?.(lives);
    callbacks.onLevelChange?.(level);
    callbacks.onTripleShotChange?.(0);
  }

  function nextLevel() {
    level++;
    bullets = [];
    particles = [];
    powerUps = [];
    powerUpSpawned = false;
    killsSinceSpawn = 0;
    ship.reset();
    spawnAsteroids(3 + level);
    callbacks.onLevelChange?.(level);
  }

  function explode(x: number, y: number, count = 8) {
    for (let i = 0; i < count; i++) particles.push(new Particle(x, y));
  }

  function killShip() {
    explode(ship.x, ship.y, 14);
    ship.dead = true;
    lives--;
    callbacks.onLivesChange?.(lives);
    if (lives <= 0) {
      state = "gameover";
      callbacks.onGameOver?.(score);
    } else {
      state = "dead";
      deadTimer = 2;
    }
  }

  function forceGameOver() {
    if (state === "gameover") return;
    explode(ship.x, ship.y, 14);
    ship.dead = true;
    lives = 0;
    callbacks.onLivesChange?.(lives);
    state = "gameover";
    callbacks.onGameOver?.(score);
  }

  function update(dt: number) {
    if (state === "gameover") {
      particles.forEach((p) => p.update(dt));
      particles = particles.filter((p) => !p.dead);
      return;
    }

    if (state === "dead") {
      deadTimer -= dt;
      particles.forEach((p) => p.update(dt));
      particles = particles.filter((p) => !p.dead);
      asteroids.forEach((a) => a.update(dt));
      if (deadTimer <= 0) {
        state = "playing";
        ship.reset();
      }
      return;
    }

    if (pressed("Space")) {
      bullets.push(...ship.tryShoot());
    }

    ship.update(dt);
    bullets.forEach((b) => b.update(dt));
    asteroids.forEach((a) => a.update(dt));
    particles.forEach((p) => p.update(dt));
    powerUps.forEach((p) => p.update(dt));

    bullets = bullets.filter((b) => !b.dead);
    particles = particles.filter((p) => !p.dead);
    powerUps = powerUps.filter((p) => !p.dead);

    for (const p of powerUps) {
      if (!p.dead && dist(ship, p) < ship.radius + p.radius) {
        p.dead = true;
        ship.tripleShot = POWERUP_DURATION;
      }
    }

    const newAsteroids: Asteroid[] = [];
    for (const b of bullets) {
      for (const a of asteroids) {
        if (!a.dead && !b.dead && dist(b, a) < a.radius) {
          b.dead = true;
          a.dead = true;
          score += POINTS[a.size];
          callbacks.onScoreChange?.(score);
          explode(a.x, a.y, a.size * 5);
          newAsteroids.push(...a.split());
          if (!powerUpSpawned) {
            killsSinceSpawn++;
            const guaranteed = killsSinceSpawn >= 5;
            if (guaranteed || Math.random() < POWERUP_DROP_CHANCE) {
              powerUps.push(new PowerUp(a.x, a.y));
              powerUpSpawned = true;
            }
          }
        }
      }
    }
    asteroids = asteroids.filter((a) => !a.dead).concat(newAsteroids);
    bullets = bullets.filter((b) => !b.dead);

    if (ship.invincible <= 0) {
      for (const a of asteroids) {
        if (dist(ship, a) < ship.radius + a.radius * 0.82) {
          killShip();
          break;
        }
      }
    }

    if (asteroids.length === 0) nextLevel();

    const roundedTripleShot = Math.max(
      0,
      Math.round(ship.tripleShot * 10) / 10,
    );
    if (roundedTripleShot !== lastReportedTripleShot) {
      lastReportedTripleShot = roundedTripleShot;
      callbacks.onTripleShotChange?.(roundedTripleShot);
    }
  }

  function draw() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);

    particles.forEach((p) => p.draw());
    asteroids.forEach((a) => a.draw());
    powerUps.forEach((p) => p.draw());
    bullets.forEach((b) => b.draw());
    ship.draw();
  }

  let paused = false;
  let destroyed = false;
  let lastTime: number | null = null;
  let rafId = 0;

  function loop(ts: number) {
    if (destroyed) return;
    const dt =
      paused || lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = ts;
    if (!paused) update(dt);
    draw();
    rafId = requestAnimationFrame(loop);
  }

  initGame();
  rafId = requestAnimationFrame(loop);

  return {
    pause() {
      paused = true;
    },
    resume() {
      paused = false;
      lastTime = null;
    },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    },
    setKey,
    forceGameOver,
    setSkin(newSkin: SkinId) {
      skin = newSkin;
    },
  };
}
