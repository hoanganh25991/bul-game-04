/*
  Space Shooter - Canvas + JS Module
  Điều khiển:
  - Di chuyển: ← → hoặc A D
  - Bắn: Space
  - Tạm dừng: P
  - Chơi lại: R
*/

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Trạng thái chung
let running = true;
let gameOver = false;
let lastTime = 0;
let accumulator = 0;
let botEnabled = true;

// Input
const keys = new Set();
window.addEventListener('keydown', (e) => {
  if (['ArrowLeft', 'ArrowRight', 'Space', 'KeyA', 'KeyD'].includes(e.code)) e.preventDefault();
  keys.add(e.code);
  if (e.code === 'KeyP') running = !running;
  if (e.code === 'KeyR') resetGame();
  if (e.code === 'KeyB') { botEnabled = !botEnabled; setHUD(); }
});
window.addEventListener('keyup', (e) => keys.delete(e.code));

// Ngẫu nhiên
const rand = (min, max) => Math.random() * (max - min) + min;
const randInt = (min, max) => Math.floor(rand(min, max + 1));

// Lớp Star cho nền
class Star {
  constructor() {
    this.reset(true);
  }
  reset(fromTop = false) {
    this.x = rand(0, canvas.width);
    this.y = fromTop ? rand(0, canvas.height) : -2;
    this.size = Math.random() < 0.85 ? 1 : 2;
    this.speed = this.size === 1 ? rand(20, 40) : rand(50, 80);
    this.alpha = rand(0.4, 1);
  }
  update(dt) {
    this.y += this.speed * dt;
    if (this.y > canvas.height + 2) this.reset(false);
  }
  draw() {
    ctx.globalAlpha = this.alpha;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(this.x, this.y, this.size, this.size);
    ctx.globalAlpha = 1;
  }
}

// Người chơi
class Player {
  constructor() {
    this.w = 42;
    this.h = 28;
    this.x = (canvas.width - this.w) / 2;
    this.y = canvas.height - this.h - 24;
    this.speed = 260;
    this.cooldown = 0;
    this.cooldownMax = 0.18; // giây giữa 2 phát
    this.lives = 3;
    this.score = 0;
    this.invincible = 0; // giây miễn thương
  }
  update(dt) {
    let dir = 0;

    if (botEnabled) {
      const pcx = this.x + this.w / 2;

      // Né đạn: tìm đạn địch gần và rơi xuống phía trên
      let nearestBullet = null;
      let nbScore = Infinity;
      for (const eb of enemyBullets) {
        if (eb.vy <= 0) continue;
        const bcx = eb.x + eb.w / 2;
        const dx = Math.abs(bcx - pcx);
        const dy = (this.y - (eb.y + eb.h));
        if (dy >= -20 && dy <= 220) {
          const score = dx + Math.max(0, dy * 0.2);
          if (score < nbScore) { nbScore = score; nearestBullet = eb; }
        }
      }

      let desiredX = pcx;
      if (nearestBullet && Math.abs((nearestBullet.x + nearestBullet.w / 2) - pcx) < 28) {
        // Tránh sang phía có khoảng trống
        desiredX = pcx + (pcx < canvas.width / 2 ? 160 : -160);
      } else {
        // Nhắm mục tiêu gần nhất (kẻ địch hoặc trùm)
        let target = null;
        let best = Infinity;
        const targets = boss ? [...enemies, boss] : enemies;
        for (const e of targets) {
          const ecx = e.x + e.w / 2;
          const dx = Math.abs(ecx - pcx);
          const dy = (this.y - (e.y + e.h));
          const s = dx + Math.max(0, 120 - dy);
          if (s < best) { best = s; target = e; }
        }
        desiredX = target ? (target.x + target.w / 2) : canvas.width / 2;
      }

      const delta = desiredX - pcx;
      if (Math.abs(delta) > 6) dir = Math.sign(delta);

      // Bắn tự động khi có mục tiêu
      if (enemies.length > 0 || (boss && boss.alive)) this.shoot();
    } else {
      if (keys.has('ArrowLeft') || keys.has('KeyA')) dir -= 1;
      if (keys.has('ArrowRight') || keys.has('KeyD')) dir += 1;
      if (keys.has('Space')) this.shoot();
    }

    this.x += dir * this.speed * dt;
    this.x = Math.max(6, Math.min(canvas.width - this.w - 6, this.x));

    if (this.cooldown > 0) this.cooldown -= dt;
    if (this.invincible > 0) this.invincible -= dt;
  }
  shoot() {
    if (this.cooldown > 0) return;
    this.cooldown = this.cooldownMax;

    const bx = this.x + this.w / 2 - 3;
    const by = this.y - 10;
    bullets.push(new Bullet(bx, by, 0, -420, '#7CF7FF', true));
    // nòng đôi nhẹ
    bullets.push(new Bullet(bx - 10, by + 6, 0, -420, '#A5F5FF', true));
    bullets.push(new Bullet(bx + 10, by + 6, 0, -420, '#A5F5FF', true));
    spawnMuzzleFlash(bx + 3, this.y);
  }
  hit() {
    if (this.invincible > 0) return;
    this.lives -= 1;
    this.invincible = 2.2;
    spawnExplosion(this.x + this.w / 2, this.y + this.h / 2, '#7CF7FF', 18);
    if (this.lives <= 0) {
      gameOver = true;
      running = false;
    }
  }
  draw() {
    // Nhấp nháy khi invincible
    if (this.invincible > 0 && Math.floor(performance.now() / 100) % 2 === 0) return;

    // Thân tàu
    ctx.fillStyle = '#54A6FF';
    ctx.fillRect(this.x, this.y + 8, this.w, this.h - 8);
    // Mái vòm
    ctx.fillStyle = '#9ED2FF';
    ctx.fillRect(this.x + 10, this.y, this.w - 20, 12);
    // Cánh
    ctx.fillStyle = '#2E69C6';
    ctx.fillRect(this.x - 8, this.y + 14, 8, 8);
    ctx.fillRect(this.x + this.w, this.y + 14, 8, 8);
    // Vệt lửa
    ctx.fillStyle = 'rgba(255,160,61,0.8)';
    ctx.fillRect(this.x + this.w/2 - 3, this.y + this.h, 6, 8);
  }
}

// Đạn
class Bullet {
  constructor(x, y, vx, vy, color, friendly = false) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.w = 6;
    this.h = 10;
    this.color = color;
    this.friendly = friendly;
    this.alive = true;
  }
  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.y < -20 || this.y > canvas.height + 20 || this.x < -20 || this.x > canvas.width + 20) {
      this.alive = false;
    }
  }
  draw() {
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x, this.y, this.w, this.h);
  }
  aabb() {
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  }
}

// Kẻ địch
class Enemy {
  constructor(x, y, type = 'grunt', hp = 3) {
    this.x = x;
    this.y = y;
    this.w = 36;
    this.h = 26;
    this.hp = hp;
    this.type = type;
    this.time = 0;
    this.shootCd = rand(0.6, 1.4);
    this.speed = 40 + wave * 6;
    this.alive = true;
    this.value = 10;
  }
  update(dt) {
    this.time += dt;

    // Di chuyển theo dạng sóng
    const sway = Math.sin(this.time * 2 + this.x * 0.02) * 30;
    this.x += Math.cos(this.time * 0.6) * 10 * dt;
    this.y += (this.speed * dt);
    this.x += sway * dt * 0.4;

    // Bắn
    this.shootCd -= dt;
    if (this.shootCd <= 0) {
      this.shootCd = rand(0.9, 1.8);
      const dirX = Math.sign(player.x + player.w/2 - (this.x + this.w/2));
      enemyBullets.push(new Bullet(this.x + this.w/2 - 3, this.y + this.h, 70 * dirX, 180 + rand(-20, 30), '#FF7A57', false));
    }

    if (this.y > canvas.height + 40) this.alive = false;
  }
  hit(dmg = 1) {
    this.hp -= dmg;
    spawnHit(this.x + this.w/2, this.y + this.h/2, '#FFC36E');
    if (this.hp <= 0) {
      this.alive = false;
      player.score += this.value;
      spawnExplosion(this.x + this.w/2, this.y + this.h/2, '#FFB86B', 16);
    }
  }
  draw() {
    // Thân
    ctx.fillStyle = '#FF5E57';
    ctx.fillRect(this.x, this.y + 6, this.w, this.h - 6);
    // Kính
    ctx.fillStyle = '#FFD0CC';
    ctx.fillRect(this.x + 8, this.y, this.w - 16, 10);
    // Ống súng
    ctx.fillStyle = '#8C2723';
    ctx.fillRect(this.x + this.w/2 - 2, this.y + this.h, 4, 6);
  }
  aabb() {
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  }
}

class Boss {
  constructor(waveNum) {
    this.w = 140;
    this.h = 90;
    this.x = (canvas.width - this.w) / 2;
    this.y = -this.h;
    this.targetY = 70;
    this.maxHp = 60 + Math.max(0, waveNum - 1) * 12;
    this.hp = this.maxHp;
    this.time = 0;
    this.speedX = 120;
    this.shootCd = 1.0;
    this.alive = true;
    this.value = 100 + waveNum * 20;
  }
  update(dt) {
    this.time += dt;

    // Hạ xuống vị trí chiến đấu
    if (this.y < this.targetY) {
      this.y += Math.min(200 * dt, this.targetY - this.y);
    }

    // Lắc trái phải, dội tường
    this.x += this.speedX * dt;
    if (this.x < 8) { this.x = 8; this.speedX *= -1; }
    if (this.x + this.w > canvas.width - 8) {
      this.x = canvas.width - 8 - this.w;
      this.speedX *= -1;
    }

    // Bắn: quạt đạn + bắn nhắm người chơi thỉnh thoảng
    this.shootCd -= dt;
    if (this.shootCd <= 0) {
      this.shootCd = 0.45;
      const cx = this.x + this.w / 2 - 3;
      const baseVy = 200 + (wave * 5);
      for (let i = -2; i <= 2; i++) {
        enemyBullets.push(new Bullet(cx, this.y + this.h, 80 * i, baseVy + Math.abs(i) * 10, '#FFD34D', false));
      }

      if (Math.floor(this.time) % 3 === 0) {
        const pcx = player.x + player.w / 2;
        const pcy = player.y + player.h / 2;
        const dx = pcx - (this.x + this.w / 2);
        const dy = pcy - (this.y + this.h / 2);
        const len = Math.hypot(dx, dy) || 1;
        const sp = 280;
        enemyBullets.push(new Bullet(this.x + this.w / 2 - 3, this.y + this.h, sp * dx / len, sp * dy / len, '#FF9F43', false));
      }
    }
  }
  hit(dmg = 1) {
    this.hp -= dmg;
    spawnHit(this.x + this.w / 2, this.y + this.h / 2, '#FFD34D');
    if (this.hp <= 0) {
      this.alive = false;
      player.score += this.value;
      spawnExplosion(this.x + this.w / 2, this.y + this.h / 2, '#FFD34D', 26);
    }
  }
  draw() {
    // Thân tàu
    ctx.fillStyle = '#7A1B1B';
    ctx.fillRect(this.x, this.y + 20, this.w, this.h - 20);
    // Buồng lái
    ctx.fillStyle = '#FFB1A8';
    ctx.fillRect(this.x + 24, this.y + 6, this.w - 48, 24);
    // Họng súng
    ctx.fillStyle = '#401010';
    ctx.fillRect(this.x + 10, this.y + this.h - 8, 8, 8);
    ctx.fillRect(this.x + this.w - 18, this.y + this.h - 8, 8, 8);
  }
  aabb() {
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  }
}

// Particle
class Particle {
  constructor(x, y, color, life, size, vx, vy) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.life = life;
    this.maxLife = life;
    this.size = size;
    this.vx = vx;
    this.vy = vy;
  }
  update(dt) {
    this.life -= dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vy += 10 * dt; // trọng lực nhẹ
  }
  draw() {
    const a = Math.max(0, this.life / this.maxLife);
    ctx.globalAlpha = a;
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x, this.y, this.size, this.size);
    ctx.globalAlpha = 1;
  }
}

// Hiệu ứng
const spawnExplosion = (x, y, color, count = 14) => {
  for (let i = 0; i < count; i++) {
    particles.push(new Particle(
      x + rand(-6, 6), y + rand(-6, 6),
      color, rand(0.3, 0.7),
      rand(2, 3),
      rand(-140, 140), rand(-140, 60)
    ));
  }
};
const spawnHit = (x, y, color) => {
  for (let i = 0; i < 8; i++) {
    particles.push(new Particle(
      x, y,
      color, rand(0.15, 0.35),
      2,
      rand(-100, 100), rand(-60, 40)
    ));
  }
};
const spawnMuzzleFlash = (x, y) => {
  for (let i = 0; i < 4; i++) {
    particles.push(new Particle(
      x + rand(-3, 3), y + rand(-3, 3),
      '#D6F4FF', rand(0.06, 0.12),
      2,
      rand(-20, 20), rand(-40, -10)
    ));
  }
};

// Danh sách đối tượng
const stars = Array.from({ length: 90 }, () => new Star());
const bullets = [];
const enemyBullets = [];
const enemies = [];
const particles = [];

let boss = null;
let bossActive = false;

const player = new Player();
let wave = 1;
let spawnTimer = 0;
let toSpawn = 0;

// Tạo đợt mới
function isBossWave(w) { return w % 5 === 0; }
function spawnBoss() {
  bossActive = true;
  boss = new Boss(wave);
}
function startWave(nWave) {
  wave = nWave;
  boss = null;
  bossActive = false;
  if (isBossWave(wave)) {
    toSpawn = 0;
    spawnTimer = 0;
    spawnBoss();
  } else {
    toSpawn = 6 + (wave - 1) * 2;
    spawnTimer = 0.5;
  }
  setHUD();
}
function setHUD() {
  document.getElementById('score').textContent = `Điểm: ${player.score}`;
  document.getElementById('lives').textContent = `Mạng: ${player.lives}`;
  document.getElementById('wave').textContent = `Đợt: ${wave}${bossActive ? ' (Trùm)' : ''}`;
  const botEl = document.getElementById('bot');
  if (botEl) botEl.textContent = `Bot: ${botEnabled ? 'Bật' : 'Tắt'}`;
}

// Reset game
function resetGame() {
  running = true;
  gameOver = false;
  player.x = (canvas.width - player.w) / 2;
  player.y = canvas.height - player.h - 24;
  player.cooldown = 0;
  player.invincible = 2.2;
  player.lives = 3;
  player.score = 0;
  bullets.length = 0;
  enemyBullets.length = 0;
  enemies.length = 0;
  particles.length = 0;
  boss = null;
  bossActive = false;
  toSpawn = 0;
  startWave(1);
}

// Spawn kẻ địch từng nhịp
function spawnEnemies(dt) {
  if (toSpawn <= 0) return;
  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    spawnTimer = rand(0.22, 0.48);
    const lane = randInt(0, 6);
    const x = 40 + lane * ((canvas.width - 80) / 6);
    const y = -rand(20, 120);
    enemies.push(new Enemy(x, y, 'grunt', 2 + Math.min(4, Math.floor(wave / 2))));
    toSpawn--;
  }
}

// AABB check
function aabbHit(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

// Cập nhật
function update(dt) {
  // Nền
  stars.forEach(s => s.update(dt));

  // Player
  player.update(dt);

  // Trùm
  if (boss) {
    boss.update(dt);
    if (!boss.alive) { boss = null; bossActive = false; }
  }

  // Spawn địch
  spawnEnemies(dt);

  // Đạn player
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.update(dt);
    if (!b.alive) { bullets.splice(i, 1); continue; }

    // va chạm trùm
    if (boss && boss.alive && aabbHit(b.aabb(), boss.aabb())) {
      b.alive = false;
      bullets.splice(i, 1);
      boss.hit(1);
      if (!boss.alive) { boss = null; bossActive = false; }
      continue;
    }

    // va chạm kẻ địch
    for (let j = enemies.length - 1; j >= 0; j--) {
      const e = enemies[j];
      if (aabbHit(b.aabb(), e.aabb())) {
        b.alive = false;
        bullets.splice(i, 1);
        e.hit(1);
        break;
      }
    }
  }

  // Đạn địch
  for (let i = enemyBullets.length - 1; i >= 0; i--) {
    const eb = enemyBullets[i];
    eb.update(dt);
    if (!eb.alive) { enemyBullets.splice(i, 1); continue; }

    // va chạm player
    if (player.invincible <= 0) {
      const pr = { x: player.x, y: player.y, w: player.w, h: player.h };
      if (aabbHit(eb.aabb(), pr)) {
        enemyBullets.splice(i, 1);
        player.hit();
      }
    }
  }

  // Kẻ địch
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    e.update(dt);

    // Va chạm player
    const pr = { x: player.x, y: player.y, w: player.w, h: player.h };
    if (player.invincible <= 0 && aabbHit(pr, e.aabb())) {
      enemies.splice(i, 1);
      player.hit();
      continue;
    }

    if (!e.alive) enemies.splice(i, 1);
  }

  // Va chạm trùm - player
  if (boss && boss.alive && player.invincible <= 0) {
    const pr = { x: player.x, y: player.y, w: player.w, h: player.h };
    if (aabbHit(pr, boss.aabb())) {
      player.hit();
    }
  }

  // Particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.update(dt);
    if (p.life <= 0) particles.splice(i, 1);
  }

  // Kiểm tra đợt mới / trùm
  if (!gameOver) {
    if (bossActive) {
      if (!boss) startWave(wave + 1);
    } else if (toSpawn <= 0 && enemies.length === 0) {
      startWave(wave + 1);
    }
  }

  // HUD
  setHUD();
}

// Vẽ
function render() {
  // Làm tối nền nhẹ để tạo chiều sâu
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Sao
  stars.forEach(s => s.draw());

  // Particles dưới sao nhỏ
  particles.forEach(p => p.draw());

  // Đạn
  bullets.forEach(b => b.draw());
  enemyBullets.forEach(b => b.draw());

  // Kẻ địch
  enemies.forEach(e => e.draw());

  // Trùm
  if (boss) {
    boss.draw();
    // Thanh máu trùm
    const barW = canvas.width - 280;
    const barX = 140;
    const barY = 12;
    ctx.fillStyle = 'rgba(22,26,38,0.6)';
    ctx.fillRect(barX, barY, barW, 14);
    if (boss.maxHp > 0) {
      const hpW = Math.max(0, barW * (boss.hp / boss.maxHp));
      ctx.fillStyle = '#FF4D4D';
      ctx.fillRect(barX, barY, hpW, 14);
    }
    ctx.strokeStyle = '#E6EFFF';
    ctx.strokeRect(barX, barY, barW, 14);
  }

  // Player
  player.draw();

  // Overlay khi pause / game over
  if (!running || gameOver) {
    ctx.fillStyle = 'rgba(4,10,25,0.55)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#e6efff';
    ctx.textAlign = 'center';

    if (gameOver) {
      ctx.font = 'bold 36px system-ui, -apple-system, Segoe UI, Roboto, Arial';
      ctx.fillText('Bạn đã bị hạ!', canvas.width / 2, canvas.height / 2 - 12);
      ctx.font = '18px system-ui, -apple-system, Segoe UI, Roboto, Arial';
      ctx.fillText('Nhấn R để chơi lại', canvas.width / 2, canvas.height / 2 + 18);
    } else {
      ctx.font = 'bold 32px system-ui, -apple-system, Segoe UI, Roboto, Arial';
      ctx.fillText('Tạm dừng', canvas.width / 2, canvas.height / 2 - 10);
      ctx.font = '16px system-ui, -apple-system, Segoe UI, Roboto, Arial';
      ctx.fillText('Nhấn P để tiếp tục', canvas.width / 2, canvas.height / 2 + 18);
    }
    ctx.textAlign = 'start';
  }
}

// Game loop (fixed timestep ~60fps)
function loop(ts) {
  const dt = Math.min(0.033, (ts - lastTime) / 1000 || 0);
  lastTime = ts;

  if (running && !gameOver) update(dt);
  render();

  requestAnimationFrame(loop);
}

// Bắt đầu
function init() {
  resetGame();
  player.invincible = 1.2;
  requestAnimationFrame(loop);
}
init();
