// ════════════════════════════════════════════════════════════════
//  RANDOMPRO — Cliente REST para el microservicio Python
// ════════════════════════════════════════════════════════════════
const API_URL = 'http://localhost:3000/api/randompro';
let serverAvailable = false;

async function checkServer() {
    try {
        const res = await fetch('http://localhost:3000/api/health');
        serverAvailable = res.ok;
        return serverAvailable;
    } catch {
        serverAvailable = false;
        return false;
    }
}

// Wrapper asíncrono para el RNG del servidor
class RandomProClient {
    constructor(method, seed, options = {}) {
        this.method = method;
        this._seed = seed;
        this.options = options;
        this.sessionId = null;
        this.calls = 0;
        this._state = seed;
        this._useFallback = !serverAvailable;
        
        // Fallback local
        if (method === 'cm') {
            this.digits = options.digits || 6;
            this.modulus = Math.pow(10, this.digits);
            this._current = seed % this.modulus || 1;
        } else {
            this.m = options.m || 4294967296;
            this.a = options.a || 1664525;
            this.c = options.c || 1013904223;
            this._current = seed % this.m;
        }
    }
    
    async init() {
        if (!serverAvailable) {
            this._useFallback = true;
            return;
        }
        
        try {
            const body = {
                method: this.method,
                seed: this._seed,
                ...this.options
            };
            
            const res = await fetch(`${API_URL}/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            
            if (res.ok) {
                const data = await res.json();
                this.sessionId = data.session_id;
                this._seed = data.seed;
                this._useFallback = false;
            } else {
                this._useFallback = true;
            }
        } catch {
            this._useFallback = true;
        }
    }
    
    // Versión síncrona usando caché de números pre-generados
    _localRandom() {
        this.calls++;
        if (this.method === 'cm') {
            const sq = this._current * this._current;
            const str = String(sq).padStart(this.digits * 2, '0');
            const start = Math.floor((str.length - this.digits) / 2);
            this._current = parseInt(str.slice(start, start + this.digits)) || 1;
            this._state = this._current;
            return this._current / this.modulus;
        } else {
            this._current = (this.a * this._current + this.c) % this.m;
            this._state = this._current;
            return this._current / this.m;
        }
    }
    
    // Método síncrono que usa caché o fallback
    random() {
        if (this._useFallback || this._cache.length === 0) {
            return this._localRandom();
        }
        this.calls++;
        const item = this._cache.shift();
        this._state = item.state;
        return item.value;
    }
    
    randint(a, b) {
        return a + Math.floor(this.random() * (b - a + 1));
    }
    
    // Pre-cargar números del servidor
    async preload(n = 50) {
        if (this._useFallback || !this.sessionId) return;
        
        try {
            const res = await fetch(`${API_URL}/sample/${this.sessionId}?n=${n}`);
            if (res.ok) {
                const data = await res.json();
                this._cache = data.values.map((v, i) => ({ value: v, state: data.state }));
                this._state = data.state;
            }
        } catch {
            // Silencioso, usará fallback
        }
    }
    
    _cache = [];
    
    get state() { return this._state; }
    get seedUsed() { return this._seed; }
}

// Clases de conveniencia que mantienen la API original
class CuadradoMedio extends RandomProClient {
    constructor(seed = null, digits = 6) {
        const s = seed !== null ? seed : Date.now() % Math.pow(10, digits);
        super('cm', s, { digits });
    }
}

class CongruenciaLineal extends RandomProClient {
    constructor(seed = null, m = 4294967296, a = 1664525, c = 1013904223) {
        const s = seed !== null ? seed : Date.now() % m;
        super('lcg', s, { m, a, c });
    }
}

// ════════════════════════════════════════════════════════════════
//  GAME ENGINE
// ════════════════════════════════════════════════════════════════
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let W, H;

function resizeCanvas() {
    const hud = document.getElementById('hud');
    const hudHeight = hud ? hud.offsetHeight : 50;
    W = window.innerWidth;
    H = window.innerHeight - hudHeight;
    canvas.width = W;
    canvas.height = H;
}

resizeCanvas();
window.addEventListener('resize', () => {
    resizeCanvas();
    if (gameActive) drawBackground();
});

// ── Pixel art palettes ──
const SKY_TOP = '#6eb4f7';
const SKY_BOT = '#a8d8f0';
const GROUND_COL = '#8b6914';
const GRASS_COL = '#2e9e2e';
const BUSH_DARK = '#1a5c1a';
const BUSH_MID = '#2a8a2a';
const BUSH_LITE = '#3cb83c';

// ── State ──
let rng, methodName;
let score, round, ducksHit, ducksTotal, shots, maxShots;
let ducks = [], effects = [];
let gameActive = false;
let animId;

// ── Dog sprite state ──
let dog = { x: 60, state: 'idle', frame: 0, timer: 0, duck: null };

function selectMethod(m) {
    methodName = m;
    document.querySelectorAll('.method-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.method === m));
}
selectMethod('lcg');

async function startGame() {
    const seed = Date.now();
    rng = methodName === 'lcg'
        ? new CongruenciaLineal(seed)
        : new CuadradoMedio(seed, 6);
    
    // Inicializar conexión con el servidor
    await rng.init();
    
    // Pre-cargar números aleatorios del servidor
    if (!rng._useFallback) {
        await rng.preload(100);
    }

    score = 0; round = 1; ducksHit = 0; ducksTotal = 0;
    shots = 0; maxShots = 3;
    ducks = []; effects = [];
    gameActive = true;
    dog.state = 'idle';

    document.getElementById('screen-start').style.display = 'none';
    document.getElementById('screen-over').style.display = 'none';
    document.getElementById('hud-method-label').textContent =
        methodName === 'lcg' ? 'LCG' : 'CM';

    updateDebug();
    updateHUD();
    spawnDuck();
    if (animId) cancelAnimationFrame(animId);
    loop();
    
    // Recargar números periódicamente
    setInterval(async () => {
        if (gameActive && !rng._useFallback && rng._cache.length < 20) {
            await rng.preload(50);
        }
    }, 2000);
}

function resetGame() {
    document.getElementById('screen-over').style.display = 'none';
    document.getElementById('screen-start').style.display = 'flex';
}

// ════════════════════════════════════════════════════════════════
//  DUCK FACTORY — todo generado por randompro
// ════════════════════════════════════════════════════════════════
const DUCK_COLORS = [
    ['#4a9e4a', '#2e7c2e', '#ffe347', '#ff6b35'],  // verde clásico
    ['#6b5acd', '#4a3a9e', '#ffe347', '#ff3c3c'],  // morado
    ['#cd8b5a', '#9e6a3a', '#ffe347', '#5af0ff'],  // café
];

function spawnDuck() {
    if (!gameActive) return;
    ducksTotal++;

    // ── randompro controla TODO ──
    const side = rng.randint(0, 1);               // izquierda o derecha
    const startY = rng.randint(40, H - 120);        // altura inicial
    const speed = rng.random() * 2.2 + 1.2;        // velocidad
    const size = rng.randint(22, 38);             // tamaño
    const colorI = rng.randint(0, DUCK_COLORS.length - 1);
    const waveAmp = rng.random() * 18 + 8;           // amplitud del vuelo ondulante
    const waveFreq = rng.random() * 0.04 + 0.025;

    const startX = side === 0 ? -size - 10 : W + size + 10;
    const dirX = side === 0 ? 1 : -1;

    updateDebug();

    ducks.push({
        x: startX, y: startY,
        vx: speed * dirX,
        baseY: startY,
        waveAmp, waveFreq,
        t: 0,
        size,
        colors: DUCK_COLORS[colorI],
        alive: true,
        hit: false,
        fallVy: 0,
        frame: 0,
        frameTimer: 0,
        wingUp: true,
        points: Math.round((speed + (42 - size) * 0.3) * 10)
    });
}

// ════════════════════════════════════════════════════════════════
//  DRAW — pixel art rendering
// ════════════════════════════════════════════════════════════════
function drawBackground() {
    // Sky gradient simulation
    const grd = ctx.createLinearGradient(0, 0, 0, H - 60);
    grd.addColorStop(0, SKY_TOP);
    grd.addColorStop(1, SKY_BOT);
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H - 60);

    // Clouds (distributed across width)
    const cloudPositions = [0.08, 0.25, 0.5, 0.72, 0.9];
    cloudPositions.forEach((pos, i) => {
        const sizes = [40, 55, 65, 45, 50];
        const yOffsets = [30, 20, 45, 25, 35];
        drawCloud(W * pos, yOffsets[i % 5], sizes[i % 5]);
    });

    // Ground
    ctx.fillStyle = GROUND_COL;
    ctx.fillRect(0, H - 60, W, 60);

    // Grass strip
    ctx.fillStyle = GRASS_COL;
    ctx.fillRect(0, H - 60, W, 14);

    // Pixel grass tufts
    ctx.fillStyle = '#1e7c1e';
    for (let x = 4; x < W; x += 12) {
        ctx.fillRect(x, H - 66, 3, 6);
        ctx.fillRect(x + 5, H - 63, 3, 4);
    }

    // Bushes (distributed across width)
    const bushPositions = [0.05, 0.2, 0.4, 0.6, 0.8, 0.95];
    bushPositions.forEach(pos => drawBush(W * pos, H - 60));
}

function drawCloud(x, y, w) {
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    const h = Math.round(w * 0.4);
    // pixel-blocky cloud
    ctx.fillRect(x + w * 0.2, y, w * 0.6, h);
    ctx.fillRect(x, y + h * 0.3, w, h * 0.6);
    ctx.fillRect(x + w * 0.1, y + h * 0.5, w * 0.8, h * 0.4);
}

function drawBush(x, y) {
    // 3-tone pixelated bush
    ctx.fillStyle = BUSH_DARK;
    ctx.fillRect(x, y - 28, 48, 28);
    ctx.fillStyle = BUSH_MID;
    ctx.fillRect(x + 3, y - 34, 20, 14);
    ctx.fillRect(x + 26, y - 31, 16, 11);
    ctx.fillStyle = BUSH_LITE;
    ctx.fillRect(x + 6, y - 38, 10, 8);
    ctx.fillRect(x + 28, y - 34, 8, 6);
}

function drawDuck(d) {
    if (!d.alive && !d.hit) return;
    const { x, y, size, colors, wingUp, vx } = d;
    const [body, wing, beak, belly] = colors;
    const flip = vx < 0;
    const s = size / 32; // scale factor

    ctx.save();
    ctx.translate(x, y);
    if (flip) ctx.scale(-1, 1);

    // Wing (back)
    ctx.fillStyle = wing;
    if (wingUp) {
        ctx.fillRect(-size * 0.3, -size * 0.55, size * 0.5, size * 0.25);
    } else {
        ctx.fillRect(-size * 0.3, -size * 0.2, size * 0.5, size * 0.25);
    }

    // Body
    ctx.fillStyle = body;
    ctx.fillRect(-size * 0.38, -size * 0.3, size * 0.76, size * 0.45);

    // Belly
    ctx.fillStyle = belly;
    ctx.fillRect(-size * 0.18, -size * 0.15, size * 0.36, size * 0.28);

    // Head
    ctx.fillStyle = body;
    ctx.fillRect(size * 0.2, -size * 0.52, size * 0.32, size * 0.3);

    // Eye
    ctx.fillStyle = '#000';
    ctx.fillRect(size * 0.38, -size * 0.48, size * 0.08, size * 0.08);
    ctx.fillStyle = '#fff';
    ctx.fillRect(size * 0.40, -size * 0.46, size * 0.04, size * 0.04);

    // Beak
    ctx.fillStyle = beak;
    ctx.fillRect(size * 0.5, -size * 0.42, size * 0.2, size * 0.1);

    // Tail feathers
    ctx.fillStyle = wing;
    ctx.fillRect(-size * 0.48, -size * 0.38, size * 0.14, size * 0.16);

    ctx.restore();

    // Hit X
    if (d.hit) {
        ctx.fillStyle = '#ff0000';
        ctx.font = `bold ${size}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText('✕', x, y + 4);
    }
}

function drawDog() {
    const d = dog;
    if (d.state === 'idle') return;
    const x = d.x, y = H - 62;
    const s = 36;

    ctx.fillStyle = '#c8a45a'; // dog body
    ctx.fillRect(x - s * 0.3, y - s * 0.6, s * 0.6, s * 0.5);

    ctx.fillStyle = '#a0743a';
    ctx.fillRect(x - s * 0.2, y - s * 0.9, s * 0.4, s * 0.35); // head
    ctx.fillRect(x + s * 0.15, y - s * 0.72, s * 0.2, s * 0.15); // ear

    // Eyes
    ctx.fillStyle = '#000';
    ctx.fillRect(x + s * 0.04, y - s * 0.80, 4, 4);

    if (d.state === 'happy' && d.duck) {
        // hold duck above head
        ctx.fillStyle = '#4a9e4a';
        ctx.fillRect(x - 10, y - s * 1.4, 20, 14);
        ctx.fillStyle = '#ffe347';
        ctx.fillRect(x + 8, y - s * 1.32, 8, 5);
    }
    if (d.state === 'laugh') {
        // laughing mouth
        ctx.fillStyle = '#ff3c3c';
        ctx.fillRect(x - 6, y - s * 0.58, 12, 4);
    }
}

// ── Effects ──
function drawEffects() {
    for (let e of effects) {
        ctx.save();
        ctx.globalAlpha = e.alpha;
        ctx.font = `${e.size}px 'Press Start 2P'`;
        ctx.textAlign = 'center';
        ctx.fillStyle = e.color;
        ctx.fillText(e.text, e.x, e.y);
        ctx.restore();
    }
}

// ── Muzzle flash ──
let flash = null;
function drawFlash() {
    if (!flash) return;
    ctx.save();
    ctx.globalAlpha = flash.alpha;
    ctx.fillStyle = '#ffe347';
    ctx.beginPath();
    ctx.arc(flash.x, flash.y, flash.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    flash.alpha -= 0.15;
    flash.r += 3;
    if (flash.alpha <= 0) flash = null;
}

// ════════════════════════════════════════════════════════════════
//  GAME LOOP
// ════════════════════════════════════════════════════════════════
let lastTime = 0;
function loop(ts = 0) {
    const dt = Math.min((ts - lastTime) / 16.67, 3);
    lastTime = ts;

    ctx.clearRect(0, 0, W, H);
    drawBackground();

    // Update + draw ducks
    for (let d of ducks) {
        if (!d.alive && !d.hit) continue;
        if (d.hit) {
            d.fallVy += 0.4 * dt;
            d.y += d.fallVy * dt;
            d.x += d.vx * 0.3 * dt;
            if (d.y > H) { d.alive = false; d.hit = false; }
        } else {
            d.t += dt;
            d.x += d.vx * dt;
            d.y = d.baseY + Math.sin(d.t * d.waveFreq * 60) * d.waveAmp;
            d.frameTimer += dt;
            if (d.frameTimer > 8) { d.wingUp = !d.wingUp; d.frameTimer = 0; }
            // Off screen → escaped
            if (d.x < -80 || d.x > W + 80) {
                d.alive = false;
                if (shots >= maxShots) endRound();
            }
        }
        drawDuck(d);
    }

    // Dog
    dog.timer -= dt;
    if (dog.timer <= 0) dog.state = 'idle';
    drawDog();

    // Effects
    effects = effects.filter(e => e.alpha > 0);
    effects.forEach(e => { e.y -= 0.7 * dt; e.alpha -= 0.018 * dt; });
    drawEffects();
    drawFlash();

    if (gameActive) animId = requestAnimationFrame(loop);
}

// ════════════════════════════════════════════════════════════════
//  SHOOT
// ════════════════════════════════════════════════════════════════
canvas.addEventListener('click', e => {
    if (!gameActive) return;
    if (shots >= maxShots) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = W / rect.width;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleX;

    shots++;
    flash = { x: mx, y: my, r: 10, alpha: 0.9 };

    // Sound effect via AudioContext
    playShot();

    let hit = false;
    for (let d of ducks) {
        if (!d.alive || d.hit) continue;
        const dx = Math.abs(mx - d.x), dy = Math.abs(my - d.y);
        if (dx < d.size * 0.7 && dy < d.size * 0.7) {
            d.hit = true;
            ducksHit++;
            score += d.points;
            hit = true;

            effects.push({
                x: d.x, y: d.y - 30,
                text: `+${d.points}`,
                size: 10, color: '#ffe347',
                alpha: 1.4
            });

            // Dog appears with duck
            dog.state = 'happy'; dog.duck = d; dog.timer = 90;
            playHit();
            break;
        }
    }

    if (!hit) {
        effects.push({
            x: mx, y: my - 10,
            text: 'MISS', size: 7,
            color: '#ff3c3c', alpha: 1.2
        });
    }

    updateHUD();
    updateDebug();

    if (shots >= maxShots) {
        setTimeout(() => endRound(), 800);
    }
});

// ════════════════════════════════════════════════════════════════
//  ROUND MANAGEMENT
// ════════════════════════════════════════════════════════════════
function endRound() {
    ducks = [];
    const hitRatio = ducksHit / ducksTotal;

    if (hitRatio < 0.4 && round > 2) {
        // Dog laughs → game over
        dog.state = 'laugh'; dog.timer = 120;
        setTimeout(() => showGameOver(), 1400);
        return;
    }

    round++;
    shots = 0;
    maxShots = Math.max(1, 3 - Math.floor(round / 4)); // se reduce con rondas

    updateHUD();
    setTimeout(() => spawnDuck(), 600);

    // En rondas avanzadas, 2 patos simultáneos
    if (round >= 4) setTimeout(() => spawnDuck(), 1000);
}

function showGameOver() {
    gameActive = false;
    const accuracy = ducksTotal > 0
        ? Math.round(ducksHit / ducksTotal * 100) : 0;
    const source = rng._useFallback ? 'JavaScript' : 'Python';

    document.getElementById('final-stats').innerHTML = `
PUNTAJE FINAL<br>
<b>${score.toLocaleString()}</b><br><br>
RONDAS: <b>${round - 1}</b><br>
PATOS:  <b>${ducksHit}/${ducksTotal}</b><br>
PRECISIÓN: <b>${accuracy}%</b><br><br>
MÉTODO RNG: <b>${methodName.toUpperCase()}</b><br>
FUENTE: <b>${source} (randompro)</b><br>
LLAMADAS RNG: <b>${rng.calls}</b>
`;
    document.getElementById('screen-over').style.display = 'flex';
}

// ════════════════════════════════════════════════════════════════
//  HUD + DEBUG
// ════════════════════════════════════════════════════════════════
function updateHUD() {
    document.getElementById('hud-score').textContent = score.toLocaleString();
    document.getElementById('hud-round').textContent = round;
    document.getElementById('hud-ducks').textContent = `${ducksHit}/${ducksTotal}`;

    const bulletsEl = document.getElementById('hud-bullets');
    bulletsEl.innerHTML = '';
    for (let i = 0; i < maxShots; i++) {
        const b = document.createElement('div');
        b.className = 'bullet-icon' + (i < maxShots - shots ? '' : ' empty');
        bulletsEl.appendChild(b);
    }
}

function updateDebug() {
    if (!rng) return;
    const source = rng._useFallback ? 'JS' : 'PY';
    document.getElementById('dbg-method').textContent = `${methodName.toUpperCase()} (${source})`;
    document.getElementById('dbg-seed').textContent = rng.seedUsed;
    document.getElementById('dbg-state').textContent = rng.state;
    document.getElementById('dbg-calls').textContent = rng.calls;
}

// ════════════════════════════════════════════════════════════════
//  AUDIO (Web Audio API — sin assets)
// ════════════════════════════════════════════════════════════════
let audioCtx;
function getAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx;
}
function playShot() {
    try {
        const ac = getAudio();
        const buf = ac.createBuffer(1, ac.sampleRate * 0.15, ac.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++)
            d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ac.sampleRate * 0.04));
        const src = ac.createBufferSource();
        src.buffer = buf;
        const g = ac.createGain(); g.gain.value = 0.4;
        src.connect(g); g.connect(ac.destination);
        src.start();
    } catch (e) { }
}
function playHit() {
    try {
        const ac = getAudio();
        const osc = ac.createOscillator();
        const g = ac.createGain();
        osc.connect(g); g.connect(ac.destination);
        osc.frequency.setValueAtTime(880, ac.currentTime);
        osc.frequency.exponentialRampToValueAtTime(220, ac.currentTime + 0.2);
        g.gain.setValueAtTime(0.3, ac.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.3);
        osc.start(); osc.stop(ac.currentTime + 0.3);
    } catch (e) { }
}

// ════════════════════════════════════════════════════════════════
//  CROSSHAIR follows mouse
// ════════════════════════════════════════════════════════════════
const xhair = document.getElementById('crosshair');
document.addEventListener('mousemove', e => {
    xhair.style.left = e.clientX + 'px';
    xhair.style.top = e.clientY + 'px';
});
