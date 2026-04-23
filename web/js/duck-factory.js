// ════════════════════════════════════════════════════════════════
//  DUCK FACTORY — Creación y gestión de patos
// ════════════════════════════════════════════════════════════════

// Paletas de colores para los patos [cuerpo, ala, pico, panza]
const DUCK_COLORS = [
    ['#4a9e4a', '#2e7c2e', '#ffe347', '#ff6b35'],  // Verde clásico
    ['#6b5acd', '#4a3a9e', '#ffe347', '#ff3c3c'],  // Morado
    ['#cd8b5a', '#9e6a3a', '#ffe347', '#5af0ff'],  // Café
];

/**
 * Representa un pato individual en el juego
 */
export class Duck {
    constructor(config) {
        this.x = config.x;
        this.y = config.y;
        this.vx = config.vx;
        this.baseY = config.baseY;
        this.waveAmp = config.waveAmp;
        this.waveFreq = config.waveFreq;
        this.t = 0;
        this.size = config.size;
        this.colors = config.colors;
        this.points = config.points;
        this.startSide = config.startSide;
        
        // Estado
        this.alive = true;
        this.hit = false;
        this.fallVy = 0;
        
        // Animación
        this.frame = 0;
        this.frameTimer = 0;
        this.wingUp = true;
    }
    
    /**
     * Actualiza la posición y animación del pato
     */
    update(dt, screenWidth, screenHeight) {
        if (this.hit) {
            // Cayendo después de ser golpeado
            this.fallVy += 0.4 * dt;
            this.y += this.fallVy * dt;
            this.x += this.vx * 0.3 * dt;
            
            if (this.y > screenHeight) {
                this.alive = false;
                this.hit = false;
                return 'fallen';
            }
        } else if (this.alive) {
            // Vuelo normal con movimiento ondulante
            this.t += dt;
            this.x += this.vx * dt;
            this.y = this.baseY + Math.sin(this.t * this.waveFreq * 60) * this.waveAmp;
            
            // Animación de alas
            this.frameTimer += dt;
            if (this.frameTimer > 8) {
                this.wingUp = !this.wingUp;
                this.frameTimer = 0;
            }
            
            // Verificar si escapó (cruzó al lado opuesto)
            const margin = this.size * 2;
            const escapedLeft = this.startSide === 1 && this.x < -margin;
            const escapedRight = this.startSide === 0 && this.x > screenWidth + margin;
            
            if (escapedLeft || escapedRight) {
                this.alive = false;
                return 'escaped';
            }
        }
        
        return 'active';
    }
    
    /**
     * Verifica si un punto colisiona con el pato
     */
    checkHit(mx, my) {
        if (!this.alive || this.hit) return false;
        
        const dx = Math.abs(mx - this.x);
        const dy = Math.abs(my - this.y);
        
        return dx < this.size * 0.7 && dy < this.size * 0.7;
    }
    
    /**
     * Marca el pato como golpeado
     */
    markHit() {
        this.hit = true;
    }
    
    /**
     * Verifica si el pato sigue visible
     */
    isVisible() {
        return this.alive || this.hit;
    }
}

/**
 * Fábrica para crear patos con propiedades aleatorias
 */
export class DuckFactory {
    constructor(rng) {
        this.rng = rng;
    }
    
    /**
     * Actualiza el generador de números aleatorios
     */
    setRng(rng) {
        this.rng = rng;
    }
    
    /**
     * Crea un nuevo pato con propiedades aleatorias
     */
    create(screenWidth, screenHeight, round) {
        const rng = this.rng;
        
        // Lado de aparición (izquierda o derecha)
        const side = rng.randint(0, 1);
        
        // Altura inicial
        const startY = rng.randint(40, screenHeight - 120);
        
        // Velocidad escalada al tamaño de pantalla
        const baseSpeed = screenWidth / 400;
        
        // Multiplicador de velocidad por ronda (+10% por ronda)
        const roundMultiplier = 1 + (round - 1) * 0.10;
        
        // Velocidad final con variación aleatoria
        const speed = (baseSpeed + rng.random() * baseSpeed * 0.4) * roundMultiplier;
        
        // Tamaño del pato
        const size = rng.randint(28, 50);
        
        // Color aleatorio
        const colorIndex = rng.randint(0, DUCK_COLORS.length - 1);
        
        // Parámetros de vuelo ondulante
        const waveAmp = rng.random() * 25 + 12;
        const waveFreq = rng.random() * 0.03 + 0.015;
        
        // Posición y dirección inicial
        const startX = side === 0 ? -size * 2 : screenWidth + size * 2;
        const dirX = side === 0 ? 1 : -1;
        
        // Puntos: más por velocidad, tamaño pequeño, y bonus por ronda
        const points = Math.round((speed + (55 - size) * 0.3) * 10 + round * 5);
        
        return new Duck({
            x: startX,
            y: startY,
            vx: speed * dirX,
            baseY: startY,
            waveAmp,
            waveFreq,
            size,
            colors: DUCK_COLORS[colorIndex],
            points,
            startSide: side
        });
    }
}

/**
 * Gestiona la colección de patos activos
 */
export class DuckManager {
    constructor() {
        this.ducks = [];
        this.ducksTotal = 0;
        this.ducksHit = 0;
    }
    
    /**
     * Reinicia el contador de patos
     */
    reset() {
        this.ducks = [];
        this.ducksTotal = 0;
        this.ducksHit = 0;
    }
    
    /**
     * Añade un pato a la colección
     */
    add(duck) {
        this.ducks.push(duck);
        this.ducksTotal++;
    }
    
    /**
     * Actualiza todos los patos
     * @returns {Array} Lista de eventos ('fallen', 'escaped')
     */
    update(dt, screenWidth, screenHeight) {
        const events = [];
        
        for (const duck of this.ducks) {
            const result = duck.update(dt, screenWidth, screenHeight);
            if (result === 'fallen' || result === 'escaped') {
                events.push(result);
            }
        }
        
        return events;
    }
    
    /**
     * Verifica si algún pato fue golpeado
     */
    checkHit(mx, my) {
        for (const duck of this.ducks) {
            if (duck.checkHit(mx, my)) {
                duck.markHit();
                this.ducksHit++;
                return duck;
            }
        }
        return null;
    }
    
    /**
     * Limpia patos que ya no están visibles
     */
    cleanup() {
        this.ducks = this.ducks.filter(d => d.isVisible());
    }
    
    /**
     * Obtiene todos los patos visibles
     */
    getVisible() {
        return this.ducks.filter(d => d.isVisible());
    }
    
    /**
     * Limpia todos los patos
     */
    clear() {
        this.ducks = [];
    }
    
    get hitRatio() {
        return this.ducksTotal > 0 ? this.ducksHit / this.ducksTotal : 0;
    }
}
