// ════════════════════════════════════════════════════════════════
//  RANDOMPRO CLIENT — Cliente REST para el microservicio Python
// ════════════════════════════════════════════════════════════════

const API_URL = 'http://localhost:3000/api/randompro';
let serverAvailable = false;

/**
 * Verifica si el servidor Python está disponible
 */
export async function checkServer() {
    try {
        const res = await fetch('http://localhost:3000/api/health');
        serverAvailable = res.ok;
        return serverAvailable;
    } catch {
        serverAvailable = false;
        return false;
    }
}

export function isServerAvailable() {
    return serverAvailable;
}

/**
 * Cliente para el servicio RandomPro
 * Soporta modo servidor (Python) y fallback local (JavaScript)
 */
export class RandomProClient {
    constructor(method, seed, options = {}) {
        this.method = method;
        this._seed = seed;
        this.options = options;
        this.sessionId = null;
        this.calls = 0;
        this._state = seed;
        this._useFallback = !serverAvailable;
        this._cache = [];
        
        // Inicializar parámetros para fallback local
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
    
    /**
     * Inicializa la sesión con el servidor Python
     */
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
    
    /**
     * Generación local de números aleatorios (fallback)
     * Implementa LCG y Cuadrado Medio en JavaScript
     */
    _localRandom() {
        this.calls++;
        if (this.method === 'cm') {
            // Cuadrado Medio: X² → extraer dígitos centrales
            const sq = this._current * this._current;
            const str = String(sq).padStart(this.digits * 2, '0');
            const start = Math.floor((str.length - this.digits) / 2);
            this._current = parseInt(str.slice(start, start + this.digits)) || 1;
            this._state = this._current;
            return this._current / this.modulus;
        } else {
            // LCG: Xn+1 = (a * Xn + c) mod m
            this._current = (this.a * this._current + this.c) % this.m;
            this._state = this._current;
            return this._current / this.m;
        }
    }
    
    /**
     * Obtiene un número aleatorio [0, 1)
     * Usa cache del servidor o fallback local
     */
    random() {
        if (this._useFallback || this._cache.length === 0) {
            return this._localRandom();
        }
        this.calls++;
        const item = this._cache.shift();
        this._state = item.state;
        return item.value;
    }
    
    /**
     * Obtiene un entero aleatorio en rango [a, b]
     */
    randint(a, b) {
        return a + Math.floor(this.random() * (b - a + 1));
    }
    
    /**
     * Pre-carga números del servidor Python
     */
    async preload(n = 50) {
        if (this._useFallback || !this.sessionId) return;
        
        try {
            const res = await fetch(`${API_URL}/sample/${this.sessionId}?n=${n}`);
            if (res.ok) {
                const data = await res.json();
                this._cache = data.values.map((v) => ({ value: v, state: data.state }));
                this._state = data.state;
            }
        } catch {
            // Silencioso, usará fallback
        }
    }
    
    get state() { return this._state; }
    get seedUsed() { return this._seed; }
    get cacheSize() { return this._cache.length; }
    get usingFallback() { return this._useFallback; }
}

/**
 * Generador Cuadrado Medio
 */
export class CuadradoMedio extends RandomProClient {
    constructor(seed = null, digits = 6) {
        const s = seed !== null ? seed : Date.now() % Math.pow(10, digits);
        super('cm', s, { digits });
    }
}

/**
 * Generador Congruencia Lineal
 */
export class CongruenciaLineal extends RandomProClient {
    constructor(seed = null, m = 4294967296, a = 1664525, c = 1013904223) {
        const s = seed !== null ? seed : Date.now() % m;
        super('lcg', s, { m, a, c });
    }
}
