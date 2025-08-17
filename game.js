// Khởi tạo canvas và context
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

/**
 * Thiết lập kích thước canvas:
 * - Hệ tọa độ/logic giữ nguyên theo kích thước gốc 800x480 (không vỡ vật lý game)
 * - Kích thước hiển thị co giãn theo màn hình để "thu nhỏ/phóng to" phù hợp
 */
const BASE_WIDTH = 800;
const BASE_HEIGHT = 480;

// Kích thước nội bộ cho render/logic
canvas.width = BASE_WIDTH;
canvas.height = BASE_HEIGHT;

// Kích thước hiển thị (CSS) theo màn hình, vẫn giữ đúng tỉ lệ 800:480
function applyCanvasSize() {
    const maxW = window.innerWidth;
    const maxH = window.innerHeight * 0.8; // chừa chỗ cho HUD/nút
    const scale = Math.min(maxW / BASE_WIDTH, maxH / BASE_HEIGHT);

    canvas.style.width = Math.floor(BASE_WIDTH * scale) + 'px';
    canvas.style.height = Math.floor(BASE_HEIGHT * scale) + 'px';
}
window.addEventListener('resize', applyCanvasSize);
applyCanvasSize();

// Sprites (SVG data URLs) và helper vẽ
function svgUrl(svg) { return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg); }
function makeImage(url) { const img = new Image(); img.src = url; return img; }
function drawSprite(ctx, img, x, y, w, h, flipX) {
    ctx.save();
    if (flipX) {
        ctx.translate(x + w, y);
        ctx.scale(-1, 1);
        ctx.drawImage(img, 0, 0, w, h);
    } else {
        ctx.translate(x, y);
        ctx.drawImage(img, 0, 0, w, h);
    }
    ctx.restore();
}

function drawSpriteFit(ctx, img, x, y, w, h, flipX) {
    const iw = (img.naturalWidth || img.width || w) || 1;
    const ih = (img.naturalHeight || img.height || h) || 1;
    const scale = Math.min(w / iw, h / ih);
    const dw = Math.max(1, Math.round(iw * scale));
    const dh = Math.max(1, Math.round(ih * scale));
    // Căn dưới (chân chạm đất) và căn giữa theo chiều ngang trong bbox
    const ox = x + Math.floor((w - dw) / 2);
    const oy = y + (h - dh);
    ctx.save();
    if (flipX) {
        ctx.translate(ox + dw, oy);
        ctx.scale(-1, 1);
        ctx.drawImage(img, 0, 0, dw, dh);
    } else {
        ctx.translate(ox, oy);
        ctx.drawImage(img, 0, 0, dw, dh);
    }
    ctx.restore();
}

const PLAYER_IMG = makeImage(svgUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='48' height='64' viewBox='0 0 48 64'>
 <defs>
  <linearGradient id='gBody' x1='0' x2='0' y1='0' y2='1'>
   <stop offset='0' stop-color='#e44'/>
   <stop offset='1' stop-color='#a00'/>
  </linearGradient>
  <linearGradient id='gPants' x1='0' x2='0' y1='0' y2='1'>
   <stop offset='0' stop-color='#611'/>
   <stop offset='1' stop-color='#311'/>
  </linearGradient>
 </defs>
 <ellipse cx='24' cy='60' rx='12' ry='4' fill='rgba(0,0,0,0.25)'/>
 <circle cx='24' cy='12' r='7' fill='#ffccaa' stroke='#8a5a44' stroke-width='1'/>
 <path d='M15 10 Q24 6 33 10' stroke='#331' stroke-width='3' fill='none'/>
 <circle cx='21' cy='12' r='1.2' fill='#222'/>
 <circle cx='27' cy='12' r='1.2' fill='#222'/>
 <rect x='14' y='18' rx='6' ry='6' width='20' height='20' fill='url(#gBody)' stroke='#7a0a0a' stroke-width='1'/>
 <rect x='8' y='20' rx='2' ry='2' width='8' height='12' fill='#ffccaa' stroke='#8a5a44' stroke-width='1'/>
 <rect x='32' y='20' rx='2' ry='2' width='8' height='12' fill='#ffccaa' stroke='#8a5a44' stroke-width='1'/>
 <rect x='14' y='36' width='20' height='3' fill='#222'/>
 <rect x='16' y='39' rx='2' ry='2' width='7' height='18' fill='url(#gPants)' stroke='#200' stroke-width='1'/>
 <rect x='25' y='39' rx='2' ry='2' width='7' height='18' fill='url(#gPants)' stroke='#200' stroke-width='1'/>
 <rect x='14' y='56' width='11' height='3' fill='#222'/>
 <rect x='23' y='56' width='11' height='3' fill='#222'/>
</svg>`));

const ENEMY_GUN_IMG = makeImage(svgUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='48' height='64' viewBox='0 0 48 64'>
 <defs>
  <linearGradient id='gSuit' x1='0' x2='0' y1='0' y2='1'>
   <stop offset='0' stop-color='#3ebd5c'/>
   <stop offset='1' stop-color='#1f7a34'/>
  </linearGradient>
 </defs>
 <ellipse cx='24' cy='60' rx='12' ry='4' fill='rgba(0,0,0,0.25)'/>
 <path d='M10 14 Q24 0 38 14 L38 18 L10 18 Z' fill='#215c2b' stroke='#103a18' stroke-width='1'/>
 <rect x='17' y='12' width='14' height='8' rx='3' ry='3' fill='#e8d0b8' stroke='#8a5a44' stroke-width='1'/>
 <rect x='18' y='15' width='12' height='3' rx='1.5' ry='1.5' fill='#9fe7ff' stroke='#2a6' stroke-width='0.5'/>
 <rect x='14' y='20' width='20' height='20' rx='5' ry='5' fill='url(#gSuit)' stroke='#0e4d22' stroke-width='1'/>
 <rect x='8' y='22' width='8' height='12' rx='2' ry='2' fill='url(#gSuit)' stroke='#0e4d22' stroke-width='1'/>
 <rect x='32' y='22' width='8' height='12' rx='2' ry='2' fill='url(#gSuit)' stroke='#0e4d22' stroke-width='1'/>
 <rect x='28' y='24' width='16' height='3' fill='#444'/>
 <rect x='25' y='23' width='6' height='5' fill='#333' rx='1'/>
 <rect x='16' y='40' width='7' height='18' rx='2' ry='2' fill='#2e8b57' stroke='#0e4d22' stroke-width='1'/>
 <rect x='25' y='40' width='7' height='18' rx='2' ry='2' fill='#2e8b57' stroke='#0e4d22' stroke-width='1'/>
 <rect x='14' y='58' width='11' height='3' fill='#222'/>
 <rect x='23' y='58' width='11' height='3' fill='#222'/>
</svg>`));

const ENEMY_SWORD_IMG = makeImage(svgUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='48' height='64' viewBox='0 0 48 64'>
 <defs>
  <linearGradient id='gBlue' x1='0' x2='0' y1='0' y2='1'>
   <stop offset='0' stop-color='#5aa0ff'/>
   <stop offset='1' stop-color='#1b6fe0'/>
  </linearGradient>
 </defs>
 <ellipse cx='24' cy='60' rx='12' ry='4' fill='rgba(0,0,0,0.25)'/>
 <circle cx='24' cy='12' r='7' fill='#f0d8c0' stroke='#8a5a44' stroke-width='1'/>
 <rect x='14' y='20' width='20' height='20' rx='6' ry='6' fill='url(#gBlue)' stroke='#0a3a9f' stroke-width='1'/>
 <rect x='8' y='22' width='8' height='12' rx='2' ry='2' fill='url(#gBlue)' stroke='#0a3a9f' stroke-width='1'/>
 <rect x='32' y='22' width='8' height='12' rx='2' ry='2' fill='url(#gBlue)' stroke='#0a3a9f' stroke-width='1'/>
 <rect x='34' y='14' width='2' height='20' fill='#ddd' stroke='#aaa' stroke-width='0.5'/>
 <rect x='33' y='14' width='4' height='2' fill='#caa'/>
 <rect x='16' y='40' width='7' height='18' rx='2' ry='2' fill='#2a5bbf' stroke='#0a3a9f' stroke-width='1'/>
 <rect x='25' y='40' width='7' height='18' rx='2' ry='2' fill='#2a5bbf' stroke='#0a3a9f' stroke-width='1'/>
 <rect x='14' y='58' width='11' height='3' fill='#222'/>
 <rect x='23' y='58' width='11' height='3' fill='#222'/>
</svg>`));

const MINITURRET_IMG = makeImage(svgUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 48 48'>
 <defs>
  <linearGradient id='gTurret' x1='0' x2='0' y1='0' y2='1'>
   <stop offset='0' stop-color='#6b7785'/>
   <stop offset='1' stop-color='#3a3f44'/>
  </linearGradient>
 </defs>
 <!-- Bóng đổ -->
 <ellipse cx='24' cy='44' rx='14' ry='4' fill='rgba(0,0,0,0.25)'/>
 <!-- Chân tripod -->
 <rect x='8' y='40' width='32' height='4' rx='2' fill='#2d3238'/>
 <rect x='12' y='28' width='4' height='16' rx='2' fill='#2d3238' transform='rotate(-20 14 36)'/>
 <rect x='32' y='28' width='4' height='16' rx='2' fill='#2d3238' transform='rotate(20 34 36)'/>
 <!-- Thân trụ -->
 <rect x='18' y='22' width='12' height='14' rx='3' fill='url(#gTurret)' stroke='#222' stroke-width='1'/>
 <!-- Nòng súng -->
 <rect x='28' y='24' width='16' height='6' rx='2' fill='#333'/>
 <rect x='44' y='25' width='2' height='4' fill='#222'/>
 <!-- Hộp đạn -->
 <rect x='18' y='24' width='6' height='8' rx='1.5' fill='#50555a'/>
</svg>`));

// Các biến trạng thái trò chơi
let score = 0;
let gameOver = false;
let specialReady = true;

// Đạn cho súng + nạp đạn
let ammo = 6;
let reloading = false;
let reloadIntervalId = null;
let reloadRemaining = 0;

 // Camera và thế giới
let cameraX = 0; // vị trí camera theo trục X (cuộn ngang)
let groundEnd = 800; // chiều dài nền đất đã sinh (bắt đầu 800px)
let LEVEL_LENGTH = 6000; // sẽ thay đổi theo màn
let currentLevel = 1;
const LEVELS = {
    1: { length: 6000, boss: 'tank' },
    2: { length: 6500, boss: 'tower' }
};
let levelWon = false; // trạng thái thắng màn

// Tạo nhân vật người chơi
const player = {
    x: 100,
    y: 366,
    width: 48,
    height: 64,
    speed: 5,
    velX: 0,
    velY: 0,
    jumping: false,
    grounded: false,
    shooting: false,
    health: 1000,
    maxHealth: 1000,
    facingRight: true,
    specialAttack: false,
    specialCooldown: 0,
    damageCooldown: 0,
    slashCooldown: 0,
    defending: false,
    color: '#FF0000' // Màu đỏ cho nhân vật
};

// Tạo mảng đạn
const bullets = [];

// Đạn của kẻ địch
const enemyBullets = [];

// Đòn chém (vệt kiếm) của địch cận chiến
const slashes = [];

// Tạo mảng kẻ địch
const enemies = [];
// Trạng thái trùm xe tăng (boss cuối màn)
let boss = null;
let bossActive = false;
let bossSpawned = false;

// Tạo mảng nền đất
const platforms = [
    { x: 0, y: 430, width: 800, height: 50 }, // Nền chính
    { x: 200, y: 350, width: 100, height: 20 }, // Nền nhỏ 1
    { x: 400, y: 300, width: 100, height: 20 }, // Nền nhỏ 2
    { x: 600, y: 250, width: 100, height: 20 }  // Nền nhỏ 3
];

// Cảnh vật (scenery) nhiều lớp với parallax
const scenery = [];
let sceneryEnd = 0;

function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Tạo ngẫu nhiên cảnh vật trong một đoạn [startX, startX+segmentWidth]
function generateScenerySegment(startX, segmentWidth) {
    const segEnd = startX + segmentWidth;

    // Mây (xa)
    const cloudCount = randInt(1, 3);
    for (let i = 0; i < cloudCount; i++) {
        const w = randInt(50, 120);
        const h = randInt(20, 40);
        const x = randInt(startX, segEnd - w);
        const y = randInt(30, 140);
        scenery.push({ kind: 'cloud', x, y, width: w, height: h, color: '#FFFFFF', layer: 'bg', parallax: 0.3 });
    }

    // Đồi nền (xa)
    const hillCount = randInt(0, 2);
    for (let i = 0; i < hillCount; i++) {
        const w = randInt(120, 260);
        const h = randInt(40, 90);
        const x = randInt(startX, segEnd - w);
        const y = 430 - h;
        scenery.push({ kind: 'hill', x, y, width: w, height: h, color: '#8FBC8F', layer: 'bg', parallax: 0.5 });
        // Tạo bề mặt đồi có thể đứng (không vẽ, chỉ va chạm)
        platforms.push({ x: x + 4, y: y, width: Math.max(24, w - 8), height: 6, invisible: true, temp: true });
    }

    // Cây (trung)
    const treeCount = randInt(2, 5);
    for (let i = 0; i < treeCount; i++) {
        const w = randInt(30, 40);
        const h = randInt(60, 90);
        const x = randInt(startX, segEnd - w);
        const y = 430 - h;
        scenery.push({ kind: 'tree', x, y, width: w, height: h, color: '#228B22', layer: 'mg', parallax: 0.8 });
    }

    // Bụi cây (trung)
    const bushCount = randInt(2, 4);
    for (let i = 0; i < bushCount; i++) {
        const w = randInt(25, 50);
        const h = randInt(15, 25);
        const x = randInt(startX, segEnd - w);
        const y = 430 - h;
        scenery.push({ kind: 'bush', x, y, width: w, height: h, color: '#2E8B57', layer: 'mg', parallax: 1.0 });
    }

    // Đá (gần)
    const rockCount = randInt(1, 3);
    for (let i = 0; i < rockCount; i++) {
        const w = randInt(15, 30);
        const h = randInt(10, 18);
        const x = randInt(startX, segEnd - w);
        const y = 430 - h;
        scenery.push({ kind: 'rock', x, y, width: w, height: h, color: '#A9A9A9', layer: 'fg', parallax: 1.1 });
    }

    // Mỏm đá (ledge) làm cảnh nhưng có thể đứng
    const ledgeCount = randInt(0, 2);
    for (let i = 0; i < ledgeCount; i++) {
        const w = randInt(80, 160);
        const h = 14;
        const x = randInt(startX, segEnd - w);
        const y = randInt(240, 380);
        scenery.push({ kind: 'ledge', x, y, width: w, height: h, color: '#8B7D6B', layer: 'mg', parallax: 1.0 });
        // Nền va chạm tương ứng (ẩn)
        platforms.push({ x, y, width: w, height: h, invisible: true, temp: true });
    }
}

// Đảm bảo luôn có cảnh vật sinh ra đủ phía trước camera và dọn phía sau
function ensureScenery() {
    // Sinh dần cho tới khi đủ xa về phía trước
    while (cameraX + canvas.width * 1.5 > sceneryEnd && sceneryEnd < LEVEL_LENGTH + 2000) {
        generateScenerySegment(sceneryEnd, 800);
        sceneryEnd += 800;
    }
    // Dọn dẹp cảnh vật quá xa bên trái
    for (let i = 0; i < scenery.length; i++) {
        const s = scenery[i];
        if (s.x + s.width < cameraX - 1200) {
            scenery.splice(i, 1);
            i--;
        }
    }
    // Dọn dẹp các nền va chạm tạm thời của cảnh vật
    for (let i = 0; i < platforms.length; i++) {
        const p = platforms[i];
        if (p && p.temp && p.x + p.width < cameraX - 1200) {
            platforms.splice(i, 1);
            i--;
        }
    }
}

// Helper: chuẩn hóa góc và kiểm tra thuộc cung
function normalizeAngle(a) {
    while (a <= -Math.PI) a += 2 * Math.PI;
    while (a > Math.PI) a -= 2 * Math.PI;
    return a;
}
function angleInArc(a, start, end) {
    a = normalizeAngle(a);
    start = normalizeAngle(start);
    end = normalizeAngle(end);
    if (start <= end) {
        return a >= start && a <= end;
    } else {
        return a >= start || a <= end;
    }
}

// Xử lý đầu vào từ bàn phím
const keys = {};

document.addEventListener('keydown', function(e) {
    // Chuẩn hóa theo cả keyCode và code để đảm bảo tương thích
    keys[e.keyCode] = true;
    if (e.code === 'Space') keys[32] = true;
    if (e.code === 'Digit1') keys[49] = true;
    if (e.code === 'Numpad1') keys[97] = true;
    if (e.code === 'KeyQ') { try { changeWeapon(currentWeapon === 'gun' ? 'sword' : 'gun'); } catch(_) {} }

    // Ngăn trang web cuộn khi nhấn Space/Phím mũi tên
    if (e.keyCode === 32 || e.keyCode === 37 || e.keyCode === 38 || e.keyCode === 39 || e.code === 'Space') {
        e.preventDefault();
    }
});

document.addEventListener('keyup', function(e) {
    keys[e.keyCode] = false;
    if (e.code === 'Space') keys[32] = false;
    if (e.code === 'Digit1') keys[49] = false;
    if (e.code === 'Numpad1') keys[97] = false;
});

/** Đã gỡ bỏ hệ thống điều khiển cảm ứng/chuột cho mobile (nút ảo, "vuốt").
 *  Giữ lại điều khiển bằng bàn phím:
 *  - Trái/Phải: Mũi tên
 *  - Nhảy: Mũi tên lên
 *  - Tấn công: Space
 *  - Tuyệt chiêu: X
 *  - Bất tử: 1
 */

// Nút nạp đạn (5 giây)
const btnReload = document.getElementById('reload');
if (btnReload) {
    const doReload = (e) => { e.preventDefault(); beginReload(5); };
    btnReload.addEventListener('click', doReload);
    btnReload.addEventListener('touchstart', doReload, { passive: false });
}

// Chuyển vũ khí (🔫 súng, ⚔️ kiếm)
let currentWeapon = 'gun';
const btnGun = document.getElementById('weapon-gun');
const btnSword = document.getElementById('weapon-sword');
function changeWeapon(w) {
    currentWeapon = w;
    if (btnGun) btnGun.classList.toggle('active', w === 'gun');
    if (btnSword) btnSword.classList.toggle('active', w === 'sword');

    // Hướng dẫn tấn công giữ mô tả phím
    const attackInstr = document.getElementById('attack-instruction');
    if (attackInstr) attackInstr.textContent = 'Tấn công: Phím Space';
    // Nút mobile hiển thị icon theo vũ khí
    const shootBtn = document.getElementById('shoot');
    if (shootBtn) {
        const icon = shootBtn.querySelector('.icon');
        if (icon) icon.textContent = (w === 'gun' ? '🔫' : '⚔️');
    }
    // Hiển thị dải 6 viên đạn phía trên cụm đổi vũ khí khi dùng súng
    const strip = document.querySelector('.weapon-switch .ammo-strip');
    if (strip) strip.style.display = (w === 'gun') ? 'flex' : 'none';
    // Hiện nút nạp đạn chỉ khi dùng súng
    const r = document.getElementById('reload');
    if (r) r.style.display = (w === 'gun') ? 'inline-flex' : 'none';
    updateAmmoUI();
}
if (btnGun) btnGun.addEventListener('click', () => changeWeapon('gun'));
if (btnSword) btnSword.addEventListener('click', () => changeWeapon('sword'));
changeWeapon('gun');
    
// Ammo UI + Reload logic
function updateAmmoUI() {
    // Cập nhật 6 viên đạn trên dải phía trên cụm đổi vũ khí
    const slots = document.querySelectorAll('.weapon-switch .ammo-strip i');
    for (let i = 0; i < slots.length; i++) {
        slots[i].classList.toggle('off', i >= ammo);
    }

    // Làm mờ nút bắn và icon khi hết đạn (chỉ khi đang dùng súng)
    const isGun = (currentWeapon === 'gun');
    const btn = document.getElementById('shoot');
    if (btn) {
        btn.classList.toggle('ammo-empty', isGun && ammo <= 0);
        btn.classList.toggle('ammo-ok', isGun && ammo > 0);
        const icon = btn.querySelector('.icon');
        if (icon) icon.style.opacity = (isGun && ammo <= 0) ? '0.5' : '1';
        btn.style.opacity = (isGun && ammo <= 0) ? '0.6' : '1';
    }

    // Làm mờ nút chọn súng lớn ở góc phải khi hết đạn
    const wg = document.getElementById('weapon-gun');
    if (wg) wg.classList.toggle('empty', ammo <= 0);

    // Cập nhật trạng thái nút nạp
    updateReloadUI();
}
function updateReloadUI() {
    const rbtn = document.getElementById('reload');
    const isGun = (currentWeapon === 'gun');
    if (!rbtn) return;

    // Hiển thị chỉ khi dùng súng
    rbtn.style.display = isGun ? 'inline-flex' : 'none';
    if (!isGun) return;

    if (reloading) {
        rbtn.disabled = true;
        rbtn.textContent = `Nạp… ${reloadRemaining}s`;
    } else if (ammo >= 6) {
        rbtn.disabled = true;
        rbtn.textContent = 'Đã đầy';
    } else {
        rbtn.disabled = false;
        rbtn.textContent = 'Nạp đạn';
    }
}

function beginReload(seconds = 5) {
    if (reloading || ammo >= 6) return;
    reloading = true;
    reloadRemaining = seconds;
    updateReloadUI();

    if (reloadIntervalId) {
        clearInterval(reloadIntervalId);
        reloadIntervalId = null;
    }
    reloadIntervalId = setInterval(() => {
        reloadRemaining = Math.max(0, reloadRemaining - 1);
        updateReloadUI();
        if (reloadRemaining <= 0) {
            clearInterval(reloadIntervalId);
            reloadIntervalId = null;
            ammo = 6;
            reloading = false;
            updateAmmoUI();
            updateReloadUI();
        }
    }, 1000);
}

// Tự động nạp khi hết đạn: 5 giây
function startAutoReload() { beginReload(5); }

const btnSpawnBoss = document.getElementById('spawn-boss');
if (btnSpawnBoss) btnSpawnBoss.addEventListener('click', () => {
    boss = null; bossActive = false; bossSpawned = false;
    spawnBossTank();
});

// Hàm tạo đạn
function createBullet() {
    if (player.shooting) return;
    if (currentWeapon === 'gun' && ammo <= 0) return;
    
    player.shooting = true;
    setTimeout(() => { player.shooting = false; }, 300); // Thời gian chờ giữa các lần bắn
    
    const direction = player.facingRight ? 1 : -1;
    const bulletX = player.facingRight ? player.x + player.width : player.x;
    
    bullets.push({
        x: bulletX,
        y: player.y + player.height / 2 - 5,
        width: 10,
        height: 5,
        speed: 10 * direction,
        color: '#FFFF00' // Màu vàng cho đạn
    });
    if (currentWeapon === 'gun') {
        ammo = Math.max(0, ammo - 1);
        updateAmmoUI();
        if (ammo === 0) startAutoReload();
    }
}

/** Đòn chém của người chơi (bán nguyệt giống lính xanh) */
function playerSlash() {
    if (player.slashCooldown > 0) return;
    player.slashCooldown = 20; // ~0.33s ở 60fps

    const facingRight = player.facingRight;
    const cx = facingRight ? player.x + player.width + 12 : player.x - 12;
    const cy = player.y + player.height / 2;
    const radius = 46; // hơi lớn để dễ trúng
    const span = Math.PI * 2 / 3; // ~120°
    const centerAngle = facingRight ? 0 : Math.PI;
    const startAngle = centerAngle - span / 2;
    const endAngle = centerAngle + span / 2;

    slashes.push({
        cx,
        cy,
        radius,
        startAngle,
        endAngle,
        angularSpeed: 0,
        vx: facingRight ? 6 : -6,
        life: 20, // ~0.33s
        damage: 40,
        friendly: true
    });
}

// Hàm tạo kẻ địch
function createEnemy() {
    const side = Math.random() > 0.5 ? 1 : -1; // Xuất hiện từ bên trái hoặc phải
    const x = side > 0 ? cameraX + canvas.width : cameraX - 40;
    
    const isSwordsman = Math.random() < 0.35; // 35% là địch cận chiến dùng kiếm
const dir = -side;
enemies.push({
        x: x,
        y: 366,
        width: 48,
        height: 64,
        speed: (isSwordsman ? 1.5 : 2) * dir, // Di chuyển ngược hướng xuất hiện
        health: isSwordsman ? 40 : 30,
        maxHealth: isSwordsman ? 40 : 30,
        type: isSwordsman ? 'swordsman' : 'basic',
        attackCooldown: 0,
        ammo: isSwordsman ? 0 : 6,
        facingRight: dir > 0,
        color: isSwordsman ? '#00BFFF' : '#00FF00' // Xanh dương nhạt cho kiếm, xanh lá cho thường
    });
}

// Tạo kẻ địch mỗi 3 giây
let enemyIntervalId = setInterval(createEnemy, 3000);

// Bảo đảm nền đất được sinh thêm về bên phải khi camera tiến tới
function ensureGround() {
    // Sinh thêm các đoạn nền mới để phủ kín vùng nhìn + đệm
    while (cameraX + canvas.width > groundEnd - 200) {
        platforms.push({ x: groundEnd, y: 430, width: 800, height: 50 });
        groundEnd += 800;
    }
    // Dọn dẹp các đoạn nền quá xa bên trái (chỉ dọn nền y=430)
    for (let i = 0; i < platforms.length; i++) {
        const p = platforms[i];
        if (p.y === 430 && p.x + p.width < cameraX - 1600) {
            platforms.splice(i, 1);
            i--;
        }
    }
}

// Địch cận chiến tung đòn chém (vệt kiếm)
function enemySlash(enemy) {
    const facingRight = enemy.facingRight;
    const cx = facingRight ? enemy.x + enemy.width + 10 : enemy.x - 10;
    const cy = enemy.y + enemy.height / 2;
    const radius = 40; // bán kính cung
    const span = Math.PI * 2 / 3; // ~120°
    const centerAngle = facingRight ? 0 : Math.PI;
    const startAngle = centerAngle - span / 2;
    const endAngle = centerAngle + span / 2;

    slashes.push({
        cx,
        cy,
        radius,
        startAngle,
        endAngle,
        angularSpeed: 0,
        vx: facingRight ? 5 : -5,
        life: 20, // ~0.33s ở 60fps
        damage: 15
    });
}

// Bắn đạn cho địch thường (basic)
function enemyShoot(enemy) {
    const dir = enemy.facingRight ? 1 : -1;
    const bx = enemy.facingRight ? enemy.x + enemy.width : enemy.x - 10;
    const by = enemy.y + enemy.height / 2 - 2;
    enemyBullets.push({
        x: bx,
        y: by,
        width: 10,
        height: 4,
        speed: 7 * dir,
        color: '#FF8C00',
        damage: 10
    });
}

/** Trùm cuối: Xe tăng bắn súng máy, tên lửa, đạn sét */
function spawnBossTank() {
    if (bossSpawned) return;
    bossSpawned = true;
    bossActive = true;
    try { clearInterval(enemyIntervalId); } catch (_) {}
    enemies.length = 0; // dọn địch lẻ

    const width = 160, height = 80;
    const bx = Math.max(player.x + 500, LEVEL_LENGTH + 120);
    const by = 430 - height;

    boss = {
        type: 'tank',
        x: bx,
        y: by,
        width,
        height,
        health: 600,
        maxHealth: 600,
        vx: -1.5,
        mgCooldown: 0,
        mgBurst: 0,
        mgBurstCount: 0,
        missileCooldown: 90,  // ~1.5s
        zigCooldown: 70,      // ~1.1s
        hitTimer: 0
    };
    // Mở rộng nền phía trước để có sân đấu
    groundEnd = Math.max(groundEnd, bx + 1600);
}
function updateBossTank() {
    if (!boss) return;
    const b = boss;

    // Di chuyển trái-phải trong khoảng quanh người chơi
    b.x += b.vx;
    if (b.x < player.x + 150) b.vx = Math.abs(b.vx);
    if (b.x > player.x + 700) b.vx = -Math.abs(b.vx);

    // Súng máy: bắn theo loạt nhanh
    if (b.mgBurst > 0) {
        if (b.mgCooldown <= 0) {
            const dir = (player.x + player.width / 2) >= (b.x + b.width / 2) ? 1 : -1;
            const speed = 12 * dir;
            const bx = dir > 0 ? b.x + b.width : b.x - 12;
            const by = b.y + 32 + Math.random() * 24;
            enemyBullets.push({ x: bx, y: by, width: 10, height: 4, speed, color: '#FF4444', damage: 6 });
            b.mgCooldown = 5; // ~12 viên/giây
            b.mgBurstCount++;
            if (b.mgBurstCount >= 16) { b.mgBurst = 0; b.mgBurstCount = 0; b.mgCooldown = 30; }
        } else {
            b.mgCooldown--;
        }
    } else {
        if (b.mgCooldown <= 0) { b.mgBurst = 1; } else { b.mgCooldown--; }
    }

    // Tên lửa: bám mục tiêu nhẹ
    if (b.missileCooldown > 0) b.missileCooldown--;
    else {
        const dir = (player.x + player.width / 2) >= (b.x + b.width / 2) ? 1 : -1;
        for (let i = 0; i < 3; i++) {
            const sx = dir > 0 ? b.x + b.width - 10 : b.x - 10;
            const sy = b.y + 18 + i * 16;
            const sp = 4;
            enemyBullets.push({
                type: 'missile',
                x: sx, y: sy, vx: dir * sp, vy: 0,
                width: 12, height: 6,
                color: '#FFA500', damage: 18
            });
        }
        b.missileCooldown = 180; // ~3s
    }

    // Đạn sét: zigzag
    if (b.zigCooldown > 0) b.zigCooldown--;
    else {
        const dir = (player.x + player.width / 2) >= (b.x + b.width / 2) ? 1 : -1;
        const sx = dir > 0 ? b.x + b.width - 10 : b.x - 10;
        const baseY = b.y + 22;
        for (let i = 0; i < 4; i++) {
            enemyBullets.push({
                type: 'zigzag',
                x: sx, y: baseY,
                baseY: baseY + i * 10,
                vx: dir * 8,
                width: 12, height: 6,
                t: 0, amp: 18 + i * 3, freq: 0.25,
                color: '#7DF9FF', damage: 12
            });
        }
        b.zigCooldown = 150; // ~2.5s
    }

    if (b.hitTimer > 0) b.hitTimer--;
}

function spawnBossTower() {
    if (bossSpawned) return;
    bossSpawned = true;
    bossActive = true;
    try { clearInterval(enemyIntervalId); } catch (_) {}
    enemies.length = 0;

    const width = 120, height = 220;
    const bx = Math.max(player.x + 520, LEVEL_LENGTH + 140);
    const by = 430 - height;

    boss = {
        type: 'tower',
        x: bx,
        y: by,
        width,
        height,
        health: 900,
        maxHealth: 900,
        mgCooldown: 0,
        mgBurst: 0,
        mgBurstCount: 0,
        laserState: 'idle',      // idle -> charge -> fire -> cooldown
        laserTimer: 0,
        laserCooldown: 210,      // ~3.5s
        laserAngle: 0,
        laserTick: 0,            // nhịp gây sát thương laser
        reinforceCooldown: 360,  // ~6s
        hitTimer: 0
    };

    // Spawn 2 trụ súng máy mini hai bên
    const turretY = 430 - 40;
    enemies.push({
        x: bx - 140, y: turretY, width: 30, height: 40,
        speed: 0, health: 80, maxHealth: 80, type: 'miniturret',
        attackCooldown: 20, facingRight: true, color: '#4C6FFF'
    });
    enemies.push({
        x: bx + width + 110, y: turretY, width: 30, height: 40,
        speed: 0, health: 80, maxHealth: 80, type: 'miniturret',
        attackCooldown: 20, facingRight: false, color: '#4C6FFF'
    });

    // Sân đấu rộng
    groundEnd = Math.max(groundEnd, bx + 1600);
}

function pointToSegmentDistance(px, py, x1, y1, x2, y2) {
    const vx = x2 - x1, vy = y2 - y1;
    const wx = px - x1, wy = py - y1;
    const c1 = vx * wx + vy * wy;
    if (c1 <= 0) return Math.hypot(px - x1, py - y1);
    const c2 = vx * vx + vy * vy;
    if (c2 <= c1) return Math.hypot(px - x2, py - y2);
    const b = c1 / c2;
    const bx = x1 + b * vx, by = y1 + b * vy;
    return Math.hypot(px - bx, py - by);
}

function updateBossTower() {
    if (!boss || boss.type !== 'tower') return;
    const b = boss;

    // Súng máy: loạt nhanh có nghỉ
    if (b.mgBurst > 0) {
        if (b.mgCooldown <= 0) {
            const px = player.x + player.width / 2;
            const py = player.y + player.height / 2;
            const mx = b.x + b.width / 2;
            const my = b.y + 40;
            const dx = px - mx;
            const dy = py - my;
            const ang = Math.atan2(dy, dx);
            const sp = 12;
            enemyBullets.push({
                x: mx, y: my, width: 10, height: 4,
                vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
                type: 'aimed', color: '#FF4444', damage: 6
            });
            b.mgCooldown = 5;
            b.mgBurstCount++;
            if (b.mgBurstCount >= 18) { b.mgBurst = 0; b.mgBurstCount = 0; b.mgCooldown = 35; }
        } else b.mgCooldown--;
    } else {
        if (b.mgCooldown <= 0) b.mgBurst = 1;
        else b.mgCooldown--;
    }

    // Laser: vòng đời idle -> charge -> fire -> cooldown
    if (b.laserTick > 0) b.laserTick--;
    if (b.laserState === 'idle') {
        if (b.laserCooldown > 0) b.laserCooldown--;
        else {
            b.laserState = 'charge';
            b.laserTimer = 45; // 0.75s
            const px = player.x + player.width / 2;
            const py = player.y + player.height / 2;
            const mx = b.x + b.width / 2;
            const my = b.y + 30;
            b.laserAngle = Math.atan2(py - my, px - mx);
        }
    } else if (b.laserState === 'charge') {
        b.laserTimer--;
        // cập nhật góc khóa mục tiêu trong lúc nạp
        const px = player.x + player.width / 2;
        const py = player.y + player.height / 2;
        const mx = b.x + b.width / 2;
        const my = b.y + 30;
        const target = Math.atan2(py - my, px - mx);
        // mượt mà theo dõi
        const da = normalizeAngle(target - b.laserAngle);
        b.laserAngle = b.laserAngle + Math.sign(da) * Math.min(Math.abs(da), 0.08);
        if (b.laserTimer <= 0) { b.laserState = 'fire'; b.laserTimer = 60; }
    } else if (b.laserState === 'fire') {
        b.laserTimer--;
        const mx = b.x + b.width / 2;
        const my = b.y + 30;
        const len = 1400;
        const x2 = mx + Math.cos(b.laserAngle) * len;
        const y2 = my + Math.sin(b.laserAngle) * len;
        const pcx = player.x + player.width / 2;
        const pcy = player.y + player.height / 2;
        const dist = pointToSegmentDistance(pcx, pcy, mx, my, x2, y2);
        if (dist < 14 && player.damageCooldown <= 0 && b.laserTick <= 0) {
            if (!player.defending) {
                player.health -= 12;
                player.damageCooldown = 45;
                document.getElementById('health').textContent = 'HP: ' + player.health;
                if (player.health <= 0) {
                    gameOver = true;
                    alert('Game Over! Điểm của bạn: ' + score);
                    document.location.reload();
                }
            }
            b.laserTick = 10;
        }
        if (b.laserTimer <= 0) { b.laserState = 'idle'; b.laserCooldown = 240; }
    }

    // Tiếp viện trụ mini
    if (b.reinforceCooldown > 0) b.reinforceCooldown--;
    else {
        const existing = enemies.filter(e => e.type === 'miniturret').length;
        if (existing < 2) {
            const tY = 430 - 40;
            const left = { x: b.x - 140, y: tY };
            const right = { x: b.x + b.width + 110, y: tY };
            const spot = (existing === 0) ? left : right;
            enemies.push({
                x: spot.x, y: spot.y, width: 30, height: 40,
                speed: 0, health: 80, maxHealth: 80, type: 'miniturret',
                attackCooldown: 20, facingRight: (spot === left), color: '#4C6FFF'
            });
        }
        b.reinforceCooldown = 420;
    }

    if (b.hitTimer > 0) b.hitTimer--;
}

function startLevel(n) {
    currentLevel = n;
    // đặt chiều dài màn
    LEVEL_LENGTH = (LEVELS[n] || LEVELS[1]).length;

    // reset trạng thái
    boss = null; bossActive = false; bossSpawned = false;
    levelWon = false; gameOver = false;

    // reset camera & nền
    cameraX = 0;
    groundEnd = 800;

    // dọn các mảng
    bullets.length = 0;
    enemyBullets.length = 0;
    slashes.length = 0;
    enemies.length = 0;
    scenery.length = 0;
    sceneryEnd = 0;

    // reset platforms mặc định
    platforms.length = 0;
    platforms.push(
        { x: 0, y: 430, width: 800, height: 50 },
        { x: 200, y: 350, width: 100, height: 20 },
        { x: 400, y: 300, width: 100, height: 20 },
        { x: 600, y: 250, width: 100, height: 20 }
    );

    // restart spawn địch lẻ
    if (typeof enemyIntervalId !== 'undefined' && enemyIntervalId) {
        try { clearInterval(enemyIntervalId); } catch (_) {}
    }
    enemyIntervalId = setInterval(createEnemy, 3000);

    // reset người chơi
    player.x = 100; player.y = 366;
    player.velX = 0; player.velY = 0;
    player.jumping = false; player.grounded = false;
    player.damageCooldown = 0;
    // hồi ít máu nếu quá thấp
    player.health = Math.max(player.health, 60);
    document.getElementById('health').textContent = 'HP: ' + player.health;
}
// Hàm sử dụng tuyệt chiêu
function useSpecialAttack() {
    if (!specialReady || player.specialCooldown > 0) return;
    
    player.specialAttack = true;
    specialReady = false;
    player.specialCooldown = 300; // 5 giây cooldown
    
    // Xóa tất cả kẻ địch trên màn hình
    enemies.forEach(enemy => {
        score += 10;
    });
    enemies.length = 0;
    
    // Cập nhật UI
    document.getElementById('special').textContent = 'Tuyệt chiêu: Đang hồi';
    
    setTimeout(() => {
        specialReady = true;
        document.getElementById('special').textContent = 'Tuyệt chiêu: Sẵn sàng';
    }, 5000);
}

// Hàm kiểm tra va chạm
function checkCollision(obj1, obj2) {
    return obj1.x < obj2.x + obj2.width &&
           obj1.x + obj1.width > obj2.x &&
           obj1.y < obj2.y + obj2.height &&
           obj1.y + obj1.height > obj2.y;
}

// Hàm cập nhật trò chơi
function update() {
    if (gameOver) return;
    
    // Xử lý đầu vào
    player.velX = 0;
    
    if (keys[37]) { // Mũi tên trái
        player.velX = -player.speed;
        player.facingRight = false;
    }
    
    if (keys[39]) { // Mũi tên phải
        player.velX = player.speed;
        player.facingRight = true;
    }
    
    if (keys[38] && !player.jumping && player.grounded) { // Mũi tên lên
        player.jumping = true;
        player.grounded = false;
        player.velY = -15;
    }
    
    if (keys[32]) { // Phím Space: bắn súng hoặc chém kiếm
        if (currentWeapon === 'gun') {
            createBullet();
        } else {
            playerSlash();
        }
    }
    
    if (keys[88]) { // Phím X để dùng tuyệt chiêu
        useSpecialAttack();
    }
    // Bất tử: phím số 1 (digit '1') — hỗ trợ cả Numpad 1
    player.defending = !!(keys[49] || keys[97]);
    
    // Áp dụng trọng lực
    player.velY += 0.8;
    
    // Cập nhật vị trí người chơi
    player.x += player.velX;
    player.y += player.velY;
    
    // Kiểm tra va chạm với nền (AABB resolution)
    player.grounded = false;

    platforms.forEach(platform => {
        // Nếu có chồng lấn giữa người chơi và nền, tiến hành xử lý xuyên thấu
        if (checkCollision(player, platform)) {
            const vx = (player.x + player.width / 2) - (platform.x + platform.width / 2);
            const vy = (player.y + player.height / 2) - (platform.y + platform.height / 2);
            const combinedHalfWidths = (player.width / 2) + (platform.width / 2);
            const combinedHalfHeights = (player.height / 2) + (platform.height / 2);

            if (Math.abs(vx) < combinedHalfWidths && Math.abs(vy) < combinedHalfHeights) {
                const overlapX = combinedHalfWidths - Math.abs(vx);
                const overlapY = combinedHalfHeights - Math.abs(vy);

                if (overlapX >= overlapY) {
                    if (vy > 0) {
                        // Va chạm từ dưới lên (đầu người chơi chạm đáy nền)
                        player.y = platform.y + platform.height;
                        if (player.velY < 0) player.velY = 0;
                    } else {
                        // Đáp xuống mặt trên của nền
                        player.y = platform.y - player.height;
                        player.velY = 0;
                        player.grounded = true;
                        player.jumping = false;
                    }
                } else {
                    if (vx > 0) {
                        // Va chạm bên phải nền
                        player.x = platform.x + platform.width;
                    } else {
                        // Va chạm bên trái nền
                        player.x = platform.x - player.width;
                    }
                }
            }
        }
    });
    
    // Giới hạn trái (tọa độ thế giới) và cập nhật camera cuộn ngang
    if (player.x <= 0) {
        player.x = 0;
    }
    // Cập nhật camera để bám người chơi (giữ gần giữa màn hình)
    cameraX = Math.max(0, player.x - (canvas.width / 2 - player.width / 2));
    // Sinh thêm nền đất khi cần
    ensureGround();
    ensureScenery();

    // Kích hoạt trùm khi đến cuối màn
    if (!bossSpawned && player.x + player.width >= LEVEL_LENGTH - 10) {
        const cfg = LEVELS[currentLevel] || LEVELS[1];
        if (cfg.boss === 'tower') spawnBossTower();
        else spawnBossTank();
    }
    
    if (player.y <= 0) {
        player.y = 0;
        player.velY = 0;
    } else if (player.y >= canvas.height - player.height) {
        player.y = canvas.height - player.height;
        player.grounded = true;
        player.jumping = false;
        player.velY = 0;
    }
    
    // Cập nhật đạn
    for (let i = 0; i < bullets.length; i++) {
        bullets[i].x += bullets[i].speed;
        
        // Xóa đạn khi ra khỏi vùng nhìn (theo camera)
        const leftBound = cameraX - 100;
        const rightBound = cameraX + canvas.width + 100;
        if (bullets[i].x < leftBound || bullets[i].x > rightBound) {
            bullets.splice(i, 1);
            i--;
            continue;
        }
        
        // Trúng trùm (boss)
        if (bossActive && boss && checkCollision(bullets[i], boss)) {
            boss.health -= 10;
            boss.hitTimer = 8;
            bullets.splice(i, 1);
            i--;
            if (boss.health <= 0) {
                bossActive = false;
            }
            continue;
        }
        // Kiểm tra va chạm đạn với kẻ địch
        for (let j = 0; j < enemies.length; j++) {
            if (checkCollision(bullets[i], enemies[j])) {
                enemies[j].health -= 10;
                bullets.splice(i, 1);
                i--;
                
                if (enemies[j].health <= 0) {
                    enemies.splice(j, 1);
                    j--;
                    score += 10;
                    document.getElementById('score').textContent = 'Điểm: ' + score;
                }
                
                break;
            }
        }
    }
    
    // Cập nhật đạn của kẻ địch
    for (let i = 0; i < enemyBullets.length; i++) {
    const b = enemyBullets[i];
    // Cập nhật theo loại đạn
    if (b.type === 'missile') {
        // Không còn tự động bám theo người chơi: di chuyển theo vận tốc ban đầu
        b.x += (b.vx || 0);
        b.y += (b.vy || 0);
    } else if (b.type === 'zigzag') {
        b.t = (b.t || 0) + (b.freq || 0.25);
        b.x += b.vx || (b.speed || 8);
        b.y = (b.baseY || b.y) + Math.sin(b.t) * (b.amp || 18);
    } else if (b.type === 'aimed') {
        b.x += b.vx;
        b.y += b.vy;
    } else {
        b.x += b.speed;
    }

    const leftBound = cameraX - 100;
    const rightBound = cameraX + canvas.width + 100;
    if (b.x < leftBound || b.x > rightBound || b.y < -100 || b.y > canvas.height + 100) {
        enemyBullets.splice(i, 1);
        i--;
        continue;
    }

        // Va chạm với người chơi
        if (player.damageCooldown <= 0 && checkCollision(b, player)) {
            if (!player.defending) {
                player.health -= b.damage || 10;
                player.damageCooldown = 60;
                document.getElementById('health').textContent = 'HP: ' + player.health;
                player.velX = b.speed > 0 ? 5 : -5;

                if (player.health <= 0) {
                    gameOver = true;
                    alert('Game Over! Điểm của bạn: ' + score);
                    document.location.reload();
                }
            }
            // Dù chặn hay trúng đều xóa đạn
            enemyBullets.splice(i, 1);
            i--;
        }
    }
    
    // Va chạm trùm với người chơi
    if (bossActive && boss && player.damageCooldown <= 0 && checkCollision(player, boss)) {
        if (!player.defending) {
            player.health -= 15;
            player.damageCooldown = 60;
            document.getElementById('health').textContent = 'HP: ' + player.health;
            player.velX = (player.x < boss.x ? -7 : 7);
            if (player.health <= 0) {
                gameOver = true;
                alert('Game Over! Điểm của bạn: ' + score);
                document.location.reload();
            }
        }
    }

    // Cập nhật vệt kiếm (bán nguyệt)
    for (let i = 0; i < slashes.length; i++) {
        const s = slashes[i];
        s.cx += s.vx;
        if (s.angularSpeed) {
            s.startAngle += s.angularSpeed;
            s.endAngle += s.angularSpeed;
        }
        s.life--;

        // Xóa khi hết thời gian sống hoặc ra khỏi vùng nhìn
        const leftCull = cameraX - 150;
        const rightCull = cameraX + canvas.width + 150;
        if (s.life <= 0 || s.cx + s.radius < leftCull || s.cx - s.radius > rightCull) {
            slashes.splice(i, 1);
            i--;
            continue;
        }

        // Va chạm với người chơi (xấp xỉ theo cung tròn)
        const px = player.x + player.width / 2;
        const py = player.y + player.height / 2;
        const dx = px - s.cx;
        const dy = py - s.cy;
        const dist = Math.hypot(dx, dy);

        const thickness = 12; // độ dày hiệu lực
        const onRing = dist >= s.radius - thickness && dist <= s.radius + thickness;

        const ang = Math.atan2(dy, dx);
        const inArc = angleInArc(ang, s.startAngle, s.endAngle);

        if (!s.friendly && onRing && inArc && player.damageCooldown <= 0) {
            if (!player.defending) {
                player.health -= s.damage;
                player.damageCooldown = 60;
                document.getElementById('health').textContent = 'HP: ' + player.health;
                player.velX = s.vx > 0 ? 7 : -7;
                if (player.health <= 0) {
                    gameOver = true;
                    alert('Game Over! Điểm của bạn: ' + score);
                    document.location.reload();
                }
            }
            // Dù chặn hay trúng đều xóa vệt kiếm
            slashes.splice(i, 1);
            i--;
        }
    }

    // Va chạm vệt kiếm của người chơi với kẻ địch
    for (let i = slashes.length - 1; i >= 0; i--) {
        const s = slashes[i];
        if (!s.friendly) continue;

        // Vệt kiếm trúng trùm
        if (bossActive && boss) {
            const ecx = boss.x + boss.width / 2;
            const ecy = boss.y + boss.height / 2;
            const dx = ecx - s.cx;
            const dy = ecy - s.cy;
            const dist = Math.hypot(dx, dy);
            const thickness = 28;
            const ang = Math.atan2(dy, dx);
            const inArc = angleInArc(ang, s.startAngle, s.endAngle);
            const sectorHit = dist <= s.radius + thickness && inArc;
            const frontRect = (s.vx > 0)
                ? { x: player.x + player.width, y: player.y - 8, width: 72, height: player.height + 16 }
                : { x: player.x - 72, y: player.y - 8, width: 72, height: player.height + 16 };
            const aabbFront = checkCollision(frontRect, boss);
            if (sectorHit || aabbFront) {
                boss.health -= (s.damage || 15);
                boss.hitTimer = 10;
                slashes.splice(i, 1);
                if (boss.health <= 0) {
                    bossActive = false;
                }
                continue;
            }
        }

        // Duyệt qua kẻ địch để kiểm tra trúng cung
        for (let j = enemies.length - 1; j >= 0; j--) {
            const e = enemies[j];
            const ecx = e.x + e.width / 2;
            const ecy = e.y + e.height / 2;
            const dx = ecx - s.cx;
            const dy = ecy - s.cy;
            const dist = Math.hypot(dx, dy);
            const thickness = 28;
            const ang = Math.atan2(dy, dx);
            const inArc = angleInArc(ang, s.startAngle, s.endAngle);
            const sectorHit = dist <= s.radius + thickness && inArc;
            // Vùng AABB phía trước nhân vật theo hướng chém (fallback cho gần sát)
            const frontRect = (s.vx > 0)
                ? { x: player.x + player.width, y: player.y - 8, width: 72, height: player.height + 16 }
                : { x: player.x - 72, y: player.y - 8, width: 72, height: player.height + 16 };
            const aabbFront = checkCollision(frontRect, e);

            if (sectorHit || aabbFront) {
                e.health -= (s.damage || 15);
                e.hitTimer = 12; // hiệu ứng trúng đòn
                e.x += (s.vx > 0 ? 10 : -10); // hất lùi nhẹ theo hướng chém

                // Xóa slash sau khi trúng
                slashes.splice(i, 1);

                // Hạ gục và cộng điểm
                if (e.health <= 0) {
                    enemies.splice(j, 1);
                    score += 10;
                    document.getElementById('score').textContent = 'Điểm: ' + score;
                }
                break;
            }
        }
    }

    // Cập nhật kẻ địch
    for (let i = 0; i < enemies.length; i++) {
        const e = enemies[i];
        if (e.hitTimer > 0) e.hitTimer--; // giảm dần hiệu ứng trúng đòn
        // Hướng nhìn theo vị trí người chơi
        e.facingRight = (player.x >= e.x);

        // Hành vi di chuyển
        if (e.type === 'swordsman') {
            // Tiến lại gần người chơi để tấn công
            const dx = player.x - e.x;
            const step = 1.8;
            e.x += Math.sign(dx) * step;

            // Tấn công khi trong tầm
            const inRange = Math.abs(dx) < 80 && Math.abs((player.y + player.height/2) - (e.y + e.height/2)) < 50;
            if (e.attackCooldown <= 0 && inRange) {
                enemySlash(e);
                e.attackCooldown = 50; // ~0.8s
            }
            if (e.attackCooldown > 0) e.attackCooldown--;
        } else if (e.type === 'miniturret') {
            // Trụ mini: đứng yên, bắn súng máy nhắm người chơi
            const px = player.x + player.width / 2;
            const py = player.y + player.height / 2;
            const cx = e.x + e.width / 2;
            const cy = e.y + e.height * 0.3;
            e.facingRight = (px >= cx);
            if (e.attackCooldown <= 0) {
                const dx2 = px - cx;
                const dy2 = py - cy;
                const ang = Math.atan2(dy2, dx2) + (Math.random() - 0.5) * 0.06; // nhẹ spread
                const sp = 11;
                enemyBullets.push({
                    x: cx, y: cy, width: 8, height: 4,
                    vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
                    type: 'aimed', color: '#FF5555', damage: 6
                });
                e.attackCooldown = 6; // ~10 viên/giây
            } else {
                e.attackCooldown--;
            }
        } else {
            // Địch thường: di chuyển theo speed cố định
            e.x += e.speed;

            // Bắn súng lục nếu còn đạn và trong tầm
            const dx = player.x - e.x;
            const dy = (player.y + player.height / 2) - (e.y + e.height / 2);
            const inRange = Math.abs(dx) < 500 && Math.abs(dy) < 50;

            if (e.attackCooldown <= 0 && e.ammo > 0 && inRange) {
                enemyShoot(e);
                e.ammo--;
                e.attackCooldown = 45; // ~0.75s
            }

            if (e.attackCooldown > 0) e.attackCooldown--;
        }
        
        // Xóa kẻ địch khi ra khỏi vùng nhìn (theo camera)
        if (enemies[i].x < cameraX - enemies[i].width || enemies[i].x > cameraX + canvas.width) {
            enemies.splice(i, 1);
            i--;
            continue;
        }
        
        // Kiểm tra va chạm kẻ địch với người chơi
        if (checkCollision(player, enemies[i])) {
            if (player.damageCooldown <= 0) {
                if (!player.defending) {
                    player.health -= 10;
                    player.damageCooldown = 60; // miễn thương 1 giây (giả sử ~60fps)
                    document.getElementById('health').textContent = 'HP: ' + player.health;
                    
                    // Đẩy người chơi lùi mạnh hơn một chút
                    player.velX = enemies[i].speed > 0 ? -7 : 7;
                    
                    if (player.health <= 0) {
                        gameOver = true;
                        alert('Game Over! Điểm của bạn: ' + score);
                        document.location.reload();
                    }
                }
                // Nếu đang bất tử: không mất máu, có thể giữ nguyên vị trí/không knockback
            }
        }
    }
    
    // Cập nhật trùm
    if (bossActive && boss) {
        if (boss.type === 'tower') updateBossTower();
        else updateBossTank();
    }

    // Giảm thời gian hồi tuyệt chiêu
    if (player.specialCooldown > 0) {
        player.specialCooldown--;
    }
    // Giảm thời gian miễn thương sau khi bị đánh
    if (player.damageCooldown > 0) {
        player.damageCooldown--;
    }
    // Giảm hồi đòn chém
    if (player.slashCooldown > 0) {
        player.slashCooldown--;
    }
    
    // Hiệu ứng tuyệt chiêu
    if (player.specialAttack) {
        player.specialAttack = false;
    }

    // Thắng màn sau khi hạ trùm
    if (!levelWon && bossSpawned && !bossActive && (!boss || boss.health <= 0)) {
        levelWon = true;
        if (currentLevel === 1) {
            // Sang màn 2
            startLevel(2);
        } else {
            gameOver = true;
            alert('Chúc mừng! Bạn đã hoàn thành Màn 2 và hạ trụ pháo khổng lồ!');
            document.location.reload();
        }
    }
}

// Hàm vẽ trò chơi
function render() {
    // Xóa canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Bật làm mịn ảnh để sprite rõ nét hơn khi co giãn
    ctx.imageSmoothingEnabled = true;
    
    // Bầu trời + cảnh vật xa
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Vẽ cảnh vật xa (parallax)
    scenery.forEach(obj => {
        if (obj.layer !== 'bg') return;
        const screenX = obj.x - cameraX * obj.parallax;
        switch (obj.kind) {
            case 'cloud':
                ctx.fillStyle = obj.color;
                ctx.fillRect(screenX, obj.y, obj.width, obj.height);
                break;
            case 'hill':
                ctx.fillStyle = obj.color;
                ctx.fillRect(screenX, obj.y, obj.width, obj.height);
                break;
        }
    });

    // Vẽ nền
    ctx.fillStyle = '#663300'; // Màu nâu cho đất
    platforms.forEach(platform => {
        if (!platform.invisible) {
            ctx.fillRect(platform.x - cameraX, platform.y, platform.width, platform.height);
        }
    });

    // Vẽ cảnh vật trung (parallax)
    scenery.forEach(obj => {
        if (obj.layer !== 'mg') return;
        const screenX = obj.x - cameraX * obj.parallax;
        switch (obj.kind) {
            case 'tree': {
                const trunkW = Math.max(8, Math.floor(obj.width * 0.25));
                const trunkH = Math.max(30, Math.floor(obj.height * 0.45));
                const trunkX = screenX + (obj.width - trunkW) / 2;
                const trunkY = obj.y + obj.height - trunkH;
                // Thân cây
                ctx.fillStyle = '#8B4513';
                ctx.fillRect(trunkX, trunkY, trunkW, trunkH);
                // Tán lá
                ctx.fillStyle = obj.color;
                const canopyH = obj.height - trunkH + 6;
                ctx.fillRect(screenX, obj.y, obj.width, canopyH);
                break;
            }
            case 'bush':
                ctx.fillStyle = obj.color;
                ctx.fillRect(screenX, obj.y, obj.width, obj.height);
                break;
            case 'ledge':
                ctx.fillStyle = obj.color || '#8B7D6B';
                ctx.fillRect(screenX, obj.y, obj.width, obj.height);
                break;
        }
    });

    // Vẽ vạch đích của màn 1
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(LEVEL_LENGTH - cameraX, 0, 6, canvas.height);
    
    // Vẽ người chơi (sprite fit theo bbox, căn chân)
    drawSpriteFit(ctx, PLAYER_IMG, player.x - cameraX, player.y, player.width, player.height, !player.facingRight);

    // Thanh HP người chơi (nằm ngang)
    const hpRatio = Math.max(0, Math.min(1, player.health / (player.maxHealth || 1000)));
    const pBarW = 60, pBarH = 6;
    const pBarX = (player.x - cameraX) + Math.floor((player.width - pBarW) / 2);
    const pBarY = player.y - 12;
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1;
    ctx.strokeRect(pBarX, pBarY, pBarW, pBarH);
    ctx.fillStyle = '#00FF00';
    ctx.fillRect(pBarX + 1, pBarY + 1, Math.floor((pBarW - 2) * hpRatio), pBarH - 2);

    
    // Vẽ đạn
    ctx.fillStyle = '#FFFF00'; // Màu vàng cho đạn
    bullets.forEach(bullet => {
        ctx.fillRect(bullet.x - cameraX, bullet.y, bullet.width, bullet.height);
    });

    // Vẽ đạn địch
    enemyBullets.forEach(b => {
        ctx.fillStyle = b.color || '#FF8C00';
        ctx.fillRect(b.x - cameraX, b.y, b.width, b.height);
    });

    // Vẽ vệt kiếm (bán nguyệt)
    slashes.forEach(s => {
        const alpha = Math.max(0.3, Math.min(0.9, s.life / 20));
        ctx.save();
        ctx.shadowColor = 'rgba(173, 216, 230, 0.8)';
        ctx.shadowBlur = 18;

        // Nét chính
        ctx.strokeStyle = `rgba(173, 216, 230, ${alpha})`;
        ctx.lineWidth = 18;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(s.cx - cameraX, s.cy, s.radius, s.startAngle, s.endAngle, false);
        ctx.stroke();

        // Nét ngoài tạo glow dày hơn
        ctx.shadowBlur = 0;
        ctx.strokeStyle = `rgba(173, 216, 230, ${Math.max(0.15, alpha * 0.5)})`;
        ctx.lineWidth = 28;
        ctx.beginPath();
        ctx.arc(s.cx - cameraX, s.cy, s.radius, s.startAngle, s.endAngle, false);
        ctx.stroke();

        ctx.restore();
    });
    
    // Vẽ kẻ địch
    enemies.forEach(enemy => {
        // Thân địch (sprite)
        const ex = enemy.x - cameraX;
        const ey = enemy.y;
        const sprite = (enemy.type === 'swordsman')
            ? ENEMY_SWORD_IMG
            : (enemy.type === 'miniturret' ? MINITURRET_IMG : ENEMY_GUN_IMG);
        drawSpriteFit(ctx, sprite, ex, ey, enemy.width, enemy.height, !enemy.facingRight);
        // Hiệu ứng trúng đòn (tô sáng lại chính sprite, không che hình bằng khối vuông)
        if (enemy.hitTimer && enemy.hitTimer > 0) {
            ctx.save();
            ctx.globalAlpha = 0.6;
            drawSpriteFit(ctx, sprite, ex, ey, enemy.width, enemy.height, !enemy.facingRight);
            ctx.restore();
        }

        // Thanh HP kẻ địch (nằm ngang)
        {
            const eHpRatio = Math.max(0, Math.min(1, (enemy.health || 0) / (enemy.maxHealth || (enemy.health || 1))));
            const ehBarW = 34, ehBarH = 5;
            const ehBarX = ex + Math.floor((enemy.width - ehBarW) / 2);
            const ehBarY = ey - 18;
            ctx.strokeStyle = '#222';
            ctx.lineWidth = 1;
            ctx.strokeRect(ehBarX, ehBarY, ehBarW, ehBarH);
            ctx.fillStyle = '#00FF00';
            ctx.fillRect(ehBarX + 1, ehBarY + 1, Math.floor((ehBarW - 2) * eHpRatio), ehBarH - 2);
        }

        // Địch thường (xanh lá) cầm súng lục
        if (enemy.type === 'basic') {

            // Cột đạn nằm ngang trên đầu
            const barW = 36, barH = 6;
            const barX = ex + Math.floor((enemy.width - barW) / 2);
            const barY = ey - 10;
            // Viền
            ctx.strokeStyle = '#222222';
            ctx.lineWidth = 1;
            ctx.strokeRect(barX, barY, barW, barH);

            const ammo = Math.max(0, Math.min(6, enemy.ammo || 0));
            // Màu theo ngưỡng: >2 xanh, ==2 vàng, ==1 đỏ, ==0 đen
            let ammoColor = '#00FF00';
            if (ammo === 2) ammoColor = '#FFD700';
            else if (ammo === 1) ammoColor = '#FF0000';
            else if (ammo === 0) ammoColor = '#000000';

            // Chiều rộng theo tỷ lệ đạn còn
            const fillW = Math.floor((ammo / 6) * barW);
            ctx.fillStyle = ammoColor;
            ctx.fillRect(barX + 1, barY + 1, Math.max(0, fillW - 2), barH - 2);
        }
    });

    // Vẽ trùm/boss
    if (bossActive && boss) {
        const bx = boss.x - cameraX;
        const by = boss.y;

        if (boss.type === 'tank' || !boss.type) {
            // Xích (treads)
            ctx.fillStyle = '#444';
            ctx.fillRect(bx, by + boss.height - 18, boss.width, 18);

            // Thân xe
            ctx.fillStyle = '#556B2F';
            ctx.fillRect(bx + 8, by + 16, boss.width - 16, boss.height - 34);

            // Tháp pháo
            ctx.fillStyle = '#6B8E23';
            const turretW = boss.width * 0.5;
            const turretH = 24;
            const tx = bx + (boss.width - turretW) / 2;
            const ty = by + 12;
            ctx.fillRect(tx, ty, turretW, turretH);

            // Nòng súng máy
            ctx.fillStyle = '#333';
            const dir = (player.x + player.width / 2) >= (boss.x + boss.width / 2) ? 1 : -1;
            const mgX = dir > 0 ? tx + turretW : tx;
            ctx.fillRect(mgX - (dir < 0 ? 8 : 0), ty + 8, 40, 8);

            // Nhấp nháy khi trúng đòn
            if (boss.hitTimer && boss.hitTimer > 0) {
                ctx.fillStyle = 'rgba(255,255,255,0.35)';
                ctx.fillRect(bx, by, boss.width, boss.height);
            }
        } else if (boss.type === 'tower') {
            // Đế
            ctx.fillStyle = '#444';
            ctx.fillRect(bx - 10, by + boss.height - 12, boss.width + 20, 12);
            // Thân trụ
            ctx.fillStyle = '#5B6770';
            ctx.fillRect(bx + 20, by + 20, boss.width - 40, boss.height - 32);
            // Đầu pháo
            ctx.fillStyle = '#3A3F44';
            ctx.fillRect(bx + 10, by, boss.width - 20, 34);
            // Nòng súng máy phía trước
            ctx.fillStyle = '#333';
            ctx.fillRect(bx + boss.width / 2 - 8, by + 10, 16, 26);

            // Laser render
            if (boss.laserState === 'charge' || boss.laserState === 'fire') {
                const mx = boss.x + boss.width / 2 - cameraX;
                const my = boss.y + 30;
                const len = 1400;
                const x2 = mx + Math.cos(boss.laserAngle) * len;
                const y2 = my + Math.sin(boss.laserAngle) * len;

                if (boss.laserState === 'charge') {
                    ctx.strokeStyle = 'rgba(255, 255, 0, 0.6)';
                    ctx.lineWidth = 2;
                } else {
                    ctx.strokeStyle = 'rgba(255, 0, 0, 0.9)';
                    ctx.lineWidth = 8;
                    ctx.shadowColor = 'rgba(255, 0, 0, 0.6)';
                    ctx.shadowBlur = 14;
                }
                ctx.beginPath();
                ctx.moveTo(mx, my);
                ctx.lineTo(x2, y2);
                ctx.stroke();
                ctx.shadowBlur = 0;
            }

            if (boss.hitTimer && boss.hitTimer > 0) {
                ctx.fillStyle = 'rgba(255,255,255,0.35)';
                ctx.fillRect(bx, by, boss.width, boss.height);
            }
        }

        // Thanh máu trùm
        const barW = 420;
        const barH = 12;
        const barX = Math.floor((canvas.width - barW) / 2);
        const barY = 16;
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(barX, barY, barW, barH);
        const ratio = Math.max(0, boss.health / boss.maxHealth);
        ctx.fillStyle = '#FF4D4D';
        ctx.fillRect(barX, barY, Math.floor(barW * ratio), barH);
        ctx.strokeStyle = '#222';
        ctx.strokeRect(barX, barY, barW, barH);
    }

    // Vẽ cảnh vật gần (parallax)
    scenery.forEach(obj => {
        if (obj.layer !== 'fg') return;
        const screenX = obj.x - cameraX * obj.parallax;
        ctx.fillStyle = obj.color;
        ctx.fillRect(screenX, obj.y, obj.width, obj.height);
    });
    
    // Vẽ hiệu ứng tuyệt chiêu
    if (player.specialAttack) {
        ctx.fillStyle = 'rgba(255, 215, 0, 0.3)'; // Màu vàng trong suốt
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    
    // Cập nhật UI
    document.getElementById('health').textContent = 'HP: ' + player.health;
    document.getElementById('score').textContent = 'Điểm: ' + score;
    const defEl = document.getElementById('defense-status');
    if (defEl) defEl.textContent = 'Bất tử: ' + (player.defending ? 'Bật' : 'Tắt');

    // Cập nhật chỉ dẫn và icon tấn công theo vũ khí
    const instr = document.getElementById('attack-instruction');
    if (instr) instr.textContent = 'Tấn công: Phím Space';
    const shootBtn = document.getElementById('shoot');
    if (shootBtn) {
        const icon = shootBtn.querySelector('.icon');
        if (icon) icon.textContent = (currentWeapon === 'gun' ? '🔫' : '⚔️');
    }
    const strip = document.querySelector('.weapon-switch .ammo-strip');
    if (strip) strip.style.display = (currentWeapon === 'gun') ? 'flex' : 'none';
    // Hiện nút nạp đạn chỉ khi dùng súng
    const r = document.getElementById('reload');
    if (r) r.style.display = (currentWeapon === 'gun') ? 'inline-flex' : 'none';
    updateAmmoUI();
}

// Hàm kiểm tra va chạm chi tiết
function checkCollision(obj1, obj2) {
    return obj1.x < obj2.x + obj2.width &&
           obj1.x + obj1.width > obj2.x &&
           obj1.y < obj2.y + obj2.height &&
           obj1.y + obj1.height > obj2.y;
}

// Vòng lặp trò chơi
function gameLoop() {
    update();
    render();
    requestAnimationFrame(gameLoop);
}

// Bắt đầu trò chơi sau khi tải xong sprite
function waitImage(img) {
    return new Promise((resolve) => {
        if (img && img.complete) return resolve();
        if (!img) return resolve();
        img.onload = () => resolve();
        img.onerror = () => resolve();
    });
}
let spritesReady = false;
Promise.all([
    waitImage(PLAYER_IMG),
    waitImage(ENEMY_GUN_IMG),
    waitImage(ENEMY_SWORD_IMG)
]).then(() => {
    spritesReady = true;
    startLevel(1);
    gameLoop();
});
