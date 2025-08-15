// Khởi tạo canvas và context
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

//
canvas.width = 800;
canvas.height = 480;

// Các biến trạng thái trò chơi
let score = 0;
let gameOver = false;
let specialReady = true;

// Đạn cho súng + nạp đạn
let ammo = 6;
let reloadReady = true;
let reloadSec = 0;

 // Camera và thế giới
let cameraX = 0; // vị trí camera theo trục X (cuộn ngang)
let groundEnd = 800; // chiều dài nền đất đã sinh (bắt đầu 800px)
const LEVEL_LENGTH = 6000; // độ dài màn 1 (có thể điều chỉnh)
let levelWon = false; // trạng thái thắng màn

// Tạo nhân vật người chơi
const player = {
    x: 100,
    y: 380,
    width: 50,
    height: 50,
    speed: 5,
    velX: 0,
    velY: 0,
    jumping: false,
    grounded: false,
    shooting: false,
    health: 100,
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

// Thêm xử lý cho nút trên mobile
document.getElementById('left').addEventListener('touchstart', () => keys[37] = true);
document.getElementById('left').addEventListener('touchend', () => keys[37] = false);
document.getElementById('right').addEventListener('touchstart', () => keys[39] = true);
document.getElementById('right').addEventListener('touchend', () => keys[39] = false);
document.getElementById('jump').addEventListener('touchstart', () => keys[38] = true);
document.getElementById('jump').addEventListener('touchend', () => keys[38] = false);
document.getElementById('shoot').addEventListener('touchstart', () => {
    if (currentWeapon === 'gun' && ammo <= 0) return;
    keys[32] = true;
});
document.getElementById('shoot').addEventListener('touchend', () => keys[32] = false);
document.getElementById('special-attack').addEventListener('touchstart', () => keys[88] = true);
document.getElementById('special-attack').addEventListener('touchend', () => keys[88] = false);
document.getElementById('defend').addEventListener('touchstart', () => { keys[49] = true; keys[97] = true; });
document.getElementById('defend').addEventListener('touchend', () => { keys[49] = false; keys[97] = false; });

// Thêm chuột click cho các nút
document.getElementById('left').addEventListener('mousedown', () => keys[37] = true);
document.getElementById('left').addEventListener('mouseup', () => keys[37] = false);
document.getElementById('right').addEventListener('mousedown', () => keys[39] = true);
document.getElementById('right').addEventListener('mouseup', () => keys[39] = false);
document.getElementById('jump').addEventListener('mousedown', () => keys[38] = true);
document.getElementById('jump').addEventListener('mouseup', () => keys[38] = false);
document.getElementById('shoot').addEventListener('mousedown', () => {
    if (currentWeapon === 'gun' && ammo <= 0) return;
    keys[32] = true;
});
document.getElementById('shoot').addEventListener('mouseup', () => keys[32] = false);
document.getElementById('special-attack').addEventListener('mousedown', () => keys[88] = true);
document.getElementById('special-attack').addEventListener('mouseup', () => keys[88] = false);
document.getElementById('defend').addEventListener('mousedown', () => { keys[49] = true; keys[97] = true; });
document.getElementById('defend').addEventListener('mouseup', () => { keys[49] = false; keys[97] = false; });

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
}
function triggerReload() {
    if (!reloadReady) return;
    // Nạp đạn ngay lập tức
    ammo = 6;
    updateAmmoUI();
    reloadReady = false;
    reloadSec = 5;
    const r = document.getElementById('reload');
    if (r) { r.disabled = true; r.textContent = '⟳ ' + reloadSec; }
    const intId = setInterval(() => {
        reloadSec--;
        const rr = document.getElementById('reload');
        if (rr) rr.textContent = (reloadSec > 0) ? ('⟳ ' + reloadSec) : '⟳';
        if (reloadSec <= 0) {
            clearInterval(intId);
            reloadReady = true;
            if (rr) { rr.disabled = false; rr.textContent = '⟳'; }
        }
    }, 1000);
}
const reloadBtn = document.getElementById('reload');
if (reloadBtn) {
    reloadBtn.addEventListener('click', (e) => { e.preventDefault(); triggerReload(); });
    reloadBtn.addEventListener('touchstart', (e) => { e.preventDefault(); triggerReload(); });
}

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
        y: 380,
        width: 40,
        height: 50,
        speed: (isSwordsman ? 1.5 : 2) * dir, // Di chuyển ngược hướng xuất hiện
        health: isSwordsman ? 40 : 30,
        type: isSwordsman ? 'swordsman' : 'basic',
        attackCooldown: 0,
        ammo: isSwordsman ? 0 : 6,
        facingRight: dir > 0,
        color: isSwordsman ? '#00BFFF' : '#00FF00' // Xanh dương nhạt cho kiếm, xanh lá cho thường
    });
}

// Tạo kẻ địch mỗi 3 giây
const enemyInterval = setInterval(createEnemy, 3000);

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
    try { clearInterval(enemyInterval); } catch (_) {}
    enemies.length = 0; // dọn địch lẻ

    const width = 160, height = 80;
    const bx = Math.max(player.x + 500, LEVEL_LENGTH + 120);
    const by = 430 - height;

    boss = {
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
            const dx = (player.x + player.width / 2) - sx;
            const dy = (player.y + player.height / 2) - sy;
            const ang = Math.atan2(dy, dx);
            const sp = 4;
            enemyBullets.push({
                type: 'missile',
                x: sx, y: sy, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
                width: 12, height: 6,
                color: '#FFA500', damage: 18,
                turn: 0.06, maxSpeed: 6
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
        spawnBossTank();
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
        const px = player.x + player.width / 2;
        const py = player.y + player.height / 2;
        const dx = px - b.x;
        const dy = py - b.y;
        const len = Math.hypot(dx, dy) || 1;
        const nx = dx / len;
        const ny = dy / len;
        const turn = b.turn || 0.05;
        b.vx = (b.vx || 0) * (1 - turn) + nx * (b.maxSpeed || 6) * turn;
        b.vy = (b.vy || 0) * (1 - turn) + ny * (b.maxSpeed || 6) * turn;
        const spd = Math.hypot(b.vx, b.vy) || 1;
        const maxS = b.maxSpeed || 6;
        if (spd > maxS) { b.vx = b.vx / spd * maxS; b.vy = b.vy / spd * maxS; }
        b.x += b.vx;
        b.y += b.vy;
    } else if (b.type === 'zigzag') {
        b.t = (b.t || 0) + (b.freq || 0.25);
        b.x += b.vx || (b.speed || 8);
        b.y = (b.baseY || b.y) + Math.sin(b.t) * (b.amp || 18);
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
                document.getElementById('health').textContent = 'Máu: ' + player.health;
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
            document.getElementById('health').textContent = 'Máu: ' + player.health;
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
                document.getElementById('health').textContent = 'Máu: ' + player.health;
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
                    document.getElementById('health').textContent = 'Máu: ' + player.health;
                    
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
    
    // Cập nhật trùm xe tăng
    if (bossActive && boss) updateBossTank();

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
        gameOver = true;
        alert('Chúc mừng! Bạn đã HẠ TRÙM xe tăng!');
        document.location.reload();
    }
}

// Hàm vẽ trò chơi
function render() {
    // Xóa canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
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
        ctx.fillRect(platform.x - cameraX, platform.y, platform.width, platform.height);
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
        }
    });

    // Vẽ vạch đích của màn 1
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(LEVEL_LENGTH - cameraX, 0, 6, canvas.height);
    
    // Vẽ người chơi
    ctx.fillStyle = player.color;
    ctx.fillRect(player.x - cameraX, player.y, player.width, player.height);

    
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
        // Thân địch
        ctx.fillStyle = enemy.color || '#00FF00'; // màu theo loại địch
        const ex = enemy.x - cameraX;
        const ey = enemy.y;
        ctx.fillRect(ex, ey, enemy.width, enemy.height);
        if (enemy.hitTimer && enemy.hitTimer > 0) {
            ctx.fillStyle = 'rgba(255,255,255,0.6)';
            ctx.fillRect(ex, ey, enemy.width, enemy.height);
        }

        // Địch thường (xanh lá) cầm súng lục
        if (enemy.type === 'basic') {
            // Vẽ súng lục đơn giản gắn bên mặt đang nhìn
            ctx.fillStyle = '#333333';
            const gunW = 10, gunH = 4;
            const gunY = ey + Math.floor(enemy.height * 0.35);
            const gunX = enemy.facingRight ? ex + enemy.width : ex - gunW;
            ctx.fillRect(gunX, gunY, gunW, gunH);

            // Cột đạn trên đầu
            const barW = 6, barH = 30;
            const barX = ex + Math.floor((enemy.width - barW) / 2);
            const barY = ey - 8 - barH;
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

            // Chiều cao theo tỷ lệ đạn còn
            const fillH = Math.floor((ammo / 6) * barH);
            const fillY = barY + (barH - fillH);
            ctx.fillStyle = ammoColor;
            ctx.fillRect(barX + 1, fillY + 1, barW - 2, Math.max(0, fillH - 2));
        }
    });

    // Vẽ trùm xe tăng
    if (bossActive && boss) {
        const bx = boss.x - cameraX;
        const by = boss.y;

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
    document.getElementById('health').textContent = 'Máu: ' + player.health;
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

// Bắt đầu trò chơi
gameLoop();
