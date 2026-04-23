// ════════════════════════════════════════════════════════════════
//  MAIN — Punto de entrada y coordinación UI
// ════════════════════════════════════════════════════════════════

import { checkServer } from './js/rng-client.js';
import { GameEngine } from './js/game-engine.js';
import { leaderboardService, leaderboardUI } from './js/leaderboard.js';

// ════════════════════════════════════════════════════════════════
//  INICIALIZACIÓN
// ════════════════════════════════════════════════════════════════

const canvas = document.getElementById('game');
const game = new GameEngine(canvas);

// Exponer funciones globales para los onclick del HTML
window.selectMethod = selectMethod;
window.startGame = startGame;
window.resetGame = resetGame;
window.showLeaderboardScreen = showLeaderboardScreen;
window.hideLeaderboardScreen = hideLeaderboardScreen;

// ════════════════════════════════════════════════════════════════
//  CROSSHAIR
// ════════════════════════════════════════════════════════════════

const crosshair = document.getElementById('crosshair');
document.addEventListener('mousemove', (e) => {
    crosshair.style.left = e.clientX + 'px';
    crosshair.style.top = e.clientY + 'px';
});

// ════════════════════════════════════════════════════════════════
//  SELECCIÓN DE MÉTODO RNG
// ════════════════════════════════════════════════════════════════

function selectMethod(method) {
    game.selectMethod(method);
    document.querySelectorAll('.method-btn').forEach(btn =>
        btn.classList.toggle('active', btn.dataset.method === method)
    );
}

// Seleccionar LCG por defecto
selectMethod('lcg');

// ════════════════════════════════════════════════════════════════
//  CONTROL DEL JUEGO
// ════════════════════════════════════════════════════════════════

async function startGame() {
    const nameInput = document.getElementById('player-name');
    const playerName = nameInput.value.trim() || 'Hunter';
    
    // Ocultar pantallas
    document.getElementById('screen-start').style.display = 'none';
    document.getElementById('screen-over').style.display = 'none';
    
    // Configurar callbacks
    game.onStateChange = updateHUD;
    game.onGameOver = showGameOver;
    
    // Iniciar juego
    await game.start(playerName);
    
    // Actualizar debug inicial
    updateDebug();
    updateMethodLabel();
}

function resetGame() {
    game.reset();
    document.getElementById('screen-over').style.display = 'none';
    document.getElementById('screen-start').style.display = 'flex';
}

// ════════════════════════════════════════════════════════════════
//  HUD
// ════════════════════════════════════════════════════════════════

function updateHUD(state) {
    if (!state) return;
    
    document.getElementById('hud-score').textContent = state.score.toLocaleString();
    document.getElementById('hud-round').textContent = state.round;
    document.getElementById('hud-ducks').textContent = `${state.ducksHit}/${state.ducksTotal}`;
    document.getElementById('hud-escaped').textContent = `${state.ducksEscaped}/${state.maxEscaped}`;
    
    // Balas
    const bulletsEl = document.getElementById('hud-bullets');
    bulletsEl.innerHTML = '';
    for (let i = 0; i < state.maxShots; i++) {
        const bullet = document.createElement('div');
        bullet.className = 'bullet-icon' + (i < state.maxShots - state.shots ? '' : ' empty');
        bulletsEl.appendChild(bullet);
    }
    
    // Actualizar debug
    updateDebug();
}

function updateMethodLabel() {
    const info = game.getDebugInfo();
    if (info) {
        document.getElementById('hud-method-label').textContent = info.method;
    }
}

function updateDebug() {
    const info = game.getDebugInfo();
    if (!info) return;
    
    document.getElementById('dbg-method').textContent = `${info.method} (${info.source})`;
    document.getElementById('dbg-seed').textContent = info.seed;
    document.getElementById('dbg-state').textContent = info.state;
    document.getElementById('dbg-calls').textContent = info.calls;
}

// ════════════════════════════════════════════════════════════════
//  GAME OVER
// ════════════════════════════════════════════════════════════════

async function showGameOver(stats, saveResult) {
    const statusEl = document.getElementById('save-status');
    
    // Mostrar estadísticas finales
    document.getElementById('final-stats').innerHTML = `
        <b>${stats.playerName}</b><br><br>
        PUNTAJE FINAL<br>
        <b>${stats.score.toLocaleString()}</b><br><br>
        RONDAS: <b>${stats.round}</b><br>
        PATOS:  <b>${stats.ducksHit}/${stats.ducksTotal}</b><br>
        ESCAPADOS: <b>${stats.ducksEscaped}</b><br>
        PRECISIÓN: <b>${stats.accuracy}%</b>
    `;
    
    // Mostrar estado del guardado
    if (saveResult.success) {
        statusEl.textContent = `✓ Score guardado - RANK #${saveResult.rank}`;
        statusEl.style.color = '#00ff41';
    } else {
        statusEl.textContent = '⚠ No se pudo guardar (servidor offline)';
        statusEl.style.color = '#ff3c3c';
    }
    
    document.getElementById('screen-over').style.display = 'flex';
    
    // Desactivar botón temporalmente
    const retryBtn = document.getElementById('btn-retry');
    if (retryBtn) {
        retryBtn.disabled = true;
        retryBtn.style.opacity = '0.5';
        retryBtn.style.pointerEvents = 'none';
        setTimeout(() => {
            retryBtn.disabled = false;
            retryBtn.style.opacity = '1';
            retryBtn.style.pointerEvents = 'auto';
        }, 2000);
    }
    
    // Cargar leaderboard
    await loadAndShowLeaderboard();
}

async function loadAndShowLeaderboard() {
    leaderboardUI.showLoading('leaderboard-list');
    
    const result = await leaderboardService.getLeaderboard(10);
    
    if (result.success) {
        leaderboardUI.renderCompact(result.entries, 'leaderboard-list');
    } else {
        leaderboardUI.showError('leaderboard-list');
    }
}

// ════════════════════════════════════════════════════════════════
//  PANTALLA DE LEADERBOARD
// ════════════════════════════════════════════════════════════════

async function showLeaderboardScreen() {
    leaderboardUI.showLoading('leaderboard-full');
    
    document.getElementById('screen-start').style.display = 'none';
    document.getElementById('screen-leaderboard').style.display = 'flex';
    
    const result = await leaderboardService.getLeaderboard(20);
    
    if (result.success) {
        leaderboardUI.renderFull(result.entries, 'leaderboard-full');
    } else {
        leaderboardUI.showError('leaderboard-full');
    }
}

function hideLeaderboardScreen() {
    document.getElementById('screen-leaderboard').style.display = 'none';
    document.getElementById('screen-start').style.display = 'flex';
}

// ════════════════════════════════════════════════════════════════
//  BLOQUEAR CLICKS EN OVERLAY
// ════════════════════════════════════════════════════════════════

document.getElementById('screen-over').addEventListener('click', (e) => {
    if (e.target.id !== 'btn-retry') {
        e.stopPropagation();
        e.preventDefault();
    }
}, true);

// ════════════════════════════════════════════════════════════════
//  VERIFICAR SERVIDOR AL CARGAR
// ════════════════════════════════════════════════════════════════

checkServer().then(available => {
    const statusEl = document.getElementById('pyodide-status');
    const startBtn = document.getElementById('btn-start');
    
    if (available) {
        console.log('✓ Servidor randompro conectado');
        statusEl.textContent = '✓ Servidor Python conectado';
        statusEl.style.color = '#00ff41';
    } else {
        console.warn('⚠ Servidor no disponible, usando fallback JS');
        statusEl.textContent = '⚠ Servidor offline (usando JS)';
        statusEl.style.color = '#ffe347';
    }
    
    startBtn.disabled = false;
    startBtn.textContent = '▶ INICIAR';
});
