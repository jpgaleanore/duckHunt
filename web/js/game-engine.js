// ════════════════════════════════════════════════════════════════
//  GAME ENGINE — Motor principal del juego
// ════════════════════════════════════════════════════════════════

import { Renderer } from './renderer.js';
import { DuckFactory, DuckManager } from './duck-factory.js';
import { audio } from './audio.js';
import { leaderboardService, leaderboardUI } from './leaderboard.js';
import { CongruenciaLineal, CuadradoMedio } from './rng-client.js';

// Configuración del juego
const CONFIG = {
    DUCKS_PER_ROUND: 3,
    INITIAL_SHOTS: 3,
    MAX_ESCAPED_DUCKS: 4,
    PRELOAD_INTERVAL: 2000,
    MIN_CACHE_SIZE: 20,
    PRELOAD_BATCH_SIZE: 50
};

/**
 * Gestor de efectos visuales (texto flotante)
 */
class EffectsManager {
    constructor() {
        this.effects = [];
    }
    
    add(x, y, text, options = {}) {
        this.effects.push({
            x,
            y,
            text,
            size: options.size || 10,
            color: options.color || '#ffe347',
            alpha: options.alpha || 1.4
        });
    }
    
    update(dt) {
        this.effects = this.effects.filter(e => e.alpha > 0);
        this.effects.forEach(e => {
            e.y -= 0.7 * dt;
            e.alpha -= 0.018 * dt;
        });
    }
    
    clear() {
        this.effects = [];
    }
    
    getAll() {
        return this.effects;
    }
}

/**
 * Estado del perro mascota
 */
class Dog {
    constructor() {
        this.x = 60;
        this.state = 'idle';  // 'idle', 'happy', 'laugh'
        this.frame = 0;
        this.timer = 0;
        this.duck = null;
    }
    
    update(dt) {
        this.timer -= dt;
        if (this.timer <= 0) {
            this.state = 'idle';
            this.duck = null;
        }
    }
    
    showHappy(duck) {
        this.state = 'happy';
        this.duck = duck;
        this.timer = 90;
    }
    
    showLaugh() {
        this.state = 'laugh';
        this.timer = 120;
    }
    
    reset() {
        this.state = 'idle';
        this.duck = null;
        this.timer = 0;
    }
}

/**
 * Motor principal del juego Duck Hunt
 */
export class GameEngine {
    constructor(canvas) {
        // Subsistemas
        this.renderer = new Renderer(canvas);
        this.duckFactory = new DuckFactory(null);
        this.duckManager = new DuckManager();
        this.effects = new EffectsManager();
        this.dog = new Dog();
        
        // Estado del juego
        this.rng = null;
        this.methodName = 'lcg';
        this.playerName = 'Hunter';
        this.score = 0;
        this.round = 1;
        this.shots = 0;
        this.maxShots = CONFIG.INITIAL_SHOTS;
        this.ducksInRound = 0;
        this.ducksEscaped = 0;
        this.gameActive = false;
        
        // Control de animación
        this.animId = null;
        this.lastTime = 0;
        this.preloadIntervalId = null;
        
        // Callbacks
        this.onStateChange = null;
        this.onGameOver = null;
        
        // Bind del loop
        this._loop = this._loop.bind(this);
        
        // Setup de eventos
        this._setupEvents(canvas);
    }
    
    /**
     * Configura los eventos del canvas
     */
    _setupEvents(canvas) {
        canvas.addEventListener('click', (e) => this._handleClick(e));
        
        window.addEventListener('resize', () => {
            this.renderer.resize();
            if (this.gameActive) {
                this.renderer.drawBackground();
            }
        });
    }
    
    /**
     * Selecciona el método de RNG
     */
    selectMethod(method) {
        this.methodName = method;
    }
    
    /**
     * Inicia una nueva partida
     */
    async start(playerName) {
        this.playerName = playerName || 'Hunter';
        
        // Crear generador de números aleatorios
        const seed = Date.now();
        this.rng = this.methodName === 'lcg'
            ? new CongruenciaLineal(seed)
            : new CuadradoMedio(seed, 6);
        
        // Inicializar conexión con el servidor
        await this.rng.init();
        
        // Pre-cargar números aleatorios
        if (!this.rng.usingFallback) {
            await this.rng.preload(100);
        }
        
        // Configurar factory
        this.duckFactory.setRng(this.rng);
        
        // Resetear estado
        this.score = 0;
        this.round = 1;
        this.shots = 0;
        this.maxShots = CONFIG.INITIAL_SHOTS;
        this.ducksInRound = 0;
        this.ducksEscaped = 0;
        this.duckManager.reset();
        this.effects.clear();
        this.dog.reset();
        this.gameActive = true;
        
        // Iniciar música de fondo
        audio.startBackgroundMusic();
        
        // Notificar cambio de estado
        this._notifyStateChange();
        
        // Generar primer pato
        this._spawnDuck();
        
        // Iniciar loop
        if (this.animId) {
            cancelAnimationFrame(this.animId);
        }
        this.lastTime = 0;
        this.animId = requestAnimationFrame(this._loop);
        
        // Configurar precarga periódica
        this._setupPreloadInterval();
    }
    
    /**
     * Configura el intervalo de precarga de números
     */
    _setupPreloadInterval() {
        if (this.preloadIntervalId) {
            clearInterval(this.preloadIntervalId);
        }
        
        this.preloadIntervalId = setInterval(async () => {
            if (this.gameActive && this.rng && !this.rng.usingFallback) {
                if (this.rng.cacheSize < CONFIG.MIN_CACHE_SIZE) {
                    try {
                        await this.rng.preload(CONFIG.PRELOAD_BATCH_SIZE);
                    } catch (e) {
                        // Ignorar errores de red
                    }
                }
            }
        }, CONFIG.PRELOAD_INTERVAL);
    }
    
    /**
     * Genera un nuevo pato
     */
    _spawnDuck() {
        if (!this.gameActive) return;
        
        const duck = this.duckFactory.create(
            this.renderer.width,
            this.renderer.height,
            this.round
        );
        
        this.duckManager.add(duck);
        this._notifyStateChange();
    }
    
    /**
     * Maneja el click del jugador (disparo)
     */
    _handleClick(e) {
        // Verificar si hay overlays visibles
        const screenOver = document.getElementById('screen-over');
        if (screenOver && screenOver.style.display === 'flex') {
            return;
        }
        
        if (!this.gameActive) return;
        if (this.shots >= this.maxShots) return;
        
        e.stopPropagation();
        e.preventDefault();
        
        // Calcular posición del click
        const rect = this.renderer.canvas.getBoundingClientRect();
        const scaleX = this.renderer.width / rect.width;
        const mx = (e.clientX - rect.left) * scaleX;
        const my = (e.clientY - rect.top) * scaleX;
        
        // Registrar disparo
        this.shots++;
        this.renderer.createFlash(mx, my);
        audio.playShot();
        
        // Verificar impacto
        const hitDuck = this.duckManager.checkHit(mx, my);
        
        if (hitDuck) {
            this.score += hitDuck.points;
            
            this.effects.add(hitDuck.x, hitDuck.y - 30, `+${hitDuck.points}`, {
                color: '#ffe347'
            });
            
            this.dog.showHappy(hitDuck);
            audio.playHit();
        } else {
            this.effects.add(mx, my - 10, 'MISS', {
                size: 7,
                color: '#ff3c3c',
                alpha: 1.2
            });
        }
        
        this._notifyStateChange();
    }
    
    /**
     * Avanza al siguiente pato
     */
    _nextDuck() {
        if (!this.gameActive) return;
        
        // Limpiar patos muertos
        this.duckManager.cleanup();
        
        this.ducksInRound++;
        
        // Verificar fin de ronda
        if (this.ducksInRound >= CONFIG.DUCKS_PER_ROUND) {
            this.ducksInRound = 0;
            this._endRound();
        } else {
            // Siguiente pato
            this.shots = 0;
            this._notifyStateChange();
            setTimeout(() => this._spawnDuck(), 500);
        }
    }
    
    /**
     * Finaliza la ronda actual
     */
    _endRound() {
        this.duckManager.clear();
        
        // Siguiente ronda
        this.round++;
        this.shots = 0;
        this.maxShots = Math.max(2, CONFIG.INITIAL_SHOTS - Math.floor(this.round / 5));
        
        this._notifyStateChange();
        
        setTimeout(() => this._spawnDuck(), 600);
        
        // Patos simultáneos en rondas avanzadas
        if (this.round >= 5) {
            setTimeout(() => this._spawnDuck(), 1000);
        }
    }
    
    /**
     * Termina el juego
     */
    async _gameOver() {
        this.gameActive = false;
        
        // Detener música de fondo
        audio.stopBackgroundMusic();
        
        // Limpiar intervalo de precarga
        if (this.preloadIntervalId) {
            clearInterval(this.preloadIntervalId);
            this.preloadIntervalId = null;
        }
        
        // Calcular estadísticas
        const stats = this.getStats();
        
        // Guardar score
        const saveResult = await leaderboardService.saveScore({
            playerName: this.playerName,
            score: this.score,
            round: this.round - 1,
            ducksHit: this.duckManager.ducksHit,
            ducksTotal: this.duckManager.ducksTotal,
            method: this.methodName,
            rngCalls: this.rng.calls
        });
        
        // Callback de game over
        if (this.onGameOver) {
            this.onGameOver(stats, saveResult);
        }
    }
    
    /**
     * Obtiene las estadísticas actuales
     */
    getStats() {
        const accuracy = this.duckManager.ducksTotal > 0
            ? Math.round(this.duckManager.ducksHit / this.duckManager.ducksTotal * 100)
            : 0;
        
        return {
            playerName: this.playerName,
            score: this.score,
            round: this.round - 1,
            ducksHit: this.duckManager.ducksHit,
            ducksTotal: this.duckManager.ducksTotal,
            ducksEscaped: this.ducksEscaped,
            accuracy,
            method: this.methodName,
            source: this.rng?.usingFallback ? 'JavaScript' : 'Python',
            rngCalls: this.rng?.calls || 0
        };
    }
    
    /**
     * Obtiene información de debug del RNG
     */
    getDebugInfo() {
        if (!this.rng) return null;
        
        return {
            method: this.methodName.toUpperCase(),
            source: this.rng.usingFallback ? 'JS' : 'PY',
            seed: this.rng.seedUsed,
            state: this.rng.state,
            calls: this.rng.calls,
            cacheSize: this.rng.cacheSize
        };
    }
    
    /**
     * Obtiene el estado actual del HUD
     */
    getHUDState() {
        return {
            score: this.score,
            round: this.round,
            ducksHit: this.duckManager.ducksHit,
            ducksTotal: this.duckManager.ducksTotal,
            ducksEscaped: this.ducksEscaped,
            maxEscaped: CONFIG.MAX_ESCAPED_DUCKS,
            shots: this.shots,
            maxShots: this.maxShots,
            method: this.methodName
        };
    }
    
    /**
     * Notifica cambios de estado
     */
    _notifyStateChange() {
        if (this.onStateChange) {
            this.onStateChange(this.getHUDState());
        }
    }
    
    /**
     * Loop principal del juego
     */
    _loop(ts = 0) {
        const dt = Math.min((ts - this.lastTime) / 16.67, 3);
        this.lastTime = ts;
        
        // Limpiar y dibujar fondo
        this.renderer.clear();
        this.renderer.drawBackground();
        
        // Actualizar y dibujar patos
        const events = this.duckManager.update(
            dt,
            this.renderer.width,
            this.renderer.height
        );
        
        // Procesar eventos de patos
        for (const event of events) {
            if (event === 'escaped') {
                this.ducksEscaped++;
                this._notifyStateChange();
                
                // Game over si se escaparon 4 o más patos
                if (this.ducksEscaped >= CONFIG.MAX_ESCAPED_DUCKS) {
                    this.dog.showLaugh();
                    setTimeout(() => this._gameOver(), 1400);
                    return;
                }
            }
            
            if (event === 'fallen' || event === 'escaped') {
                this._nextDuck();
            }
        }
        
        // Dibujar patos visibles
        for (const duck of this.duckManager.getVisible()) {
            this.renderer.drawDuck(duck);
        }
        
        // Actualizar y dibujar perro
        this.dog.update(dt);
        this.renderer.drawDog(this.dog);
        
        // Actualizar y dibujar efectos
        this.effects.update(dt);
        this.renderer.drawEffects(this.effects.getAll());
        this.renderer.drawFlash();
        
        // Continuar loop si el juego está activo
        if (this.gameActive) {
            this.animId = requestAnimationFrame(this._loop);
        }
    }
    
    /**
     * Reinicia el juego
     */
    reset() {
        // Detener música de fondo
        audio.stopBackgroundMusic();
        
        if (this.preloadIntervalId) {
            clearInterval(this.preloadIntervalId);
            this.preloadIntervalId = null;
        }
        
        if (this.animId) {
            cancelAnimationFrame(this.animId);
            this.animId = null;
        }
        
        this.gameActive = false;
        leaderboardService.resetCurrentRank();
    }
}
