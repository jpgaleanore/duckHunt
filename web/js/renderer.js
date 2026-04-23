// ════════════════════════════════════════════════════════════════
//  RENDERER — Renderizado pixel art del juego
// ════════════════════════════════════════════════════════════════

// Paleta de colores pixel art
const COLORS = {
    SKY_TOP: '#6eb4f7',
    SKY_BOT: '#a8d8f0',
    GROUND: '#8b6914',
    GRASS: '#2e9e2e',
    GRASS_DARK: '#1e7c1e',
    BUSH_DARK: '#1a5c1a',
    BUSH_MID: '#2a8a2a',
    BUSH_LITE: '#3cb83c'
};

/**
 * Clase encargada de todo el renderizado del juego
 */
export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.W = 0;
        this.H = 0;
        this.flash = null;
        
        this.resize();
    }
    
    /**
     * Ajusta el canvas al tamaño de la ventana
     */
    resize() {
        const hud = document.getElementById('hud');
        const hudHeight = hud ? hud.offsetHeight : 50;
        this.W = window.innerWidth;
        this.H = window.innerHeight - hudHeight;
        this.canvas.width = this.W;
        this.canvas.height = this.H;
    }
    
    /**
     * Limpia el canvas
     */
    clear() {
        this.ctx.clearRect(0, 0, this.W, this.H);
    }
    
    // ════════════════════════════════════════════════════════════
    //  FONDO
    // ════════════════════════════════════════════════════════════
    
    /**
     * Dibuja el fondo completo (cielo, nubes, suelo, arbustos)
     */
    drawBackground() {
        this._drawSky();
        this._drawClouds();
        this._drawGround();
        this._drawBushes();
    }
    
    _drawSky() {
        const grd = this.ctx.createLinearGradient(0, 0, 0, this.H - 60);
        grd.addColorStop(0, COLORS.SKY_TOP);
        grd.addColorStop(1, COLORS.SKY_BOT);
        this.ctx.fillStyle = grd;
        this.ctx.fillRect(0, 0, this.W, this.H - 60);
    }
    
    _drawClouds() {
        const positions = [0.08, 0.25, 0.5, 0.72, 0.9];
        const sizes = [40, 55, 65, 45, 50];
        const yOffsets = [30, 20, 45, 25, 35];
        
        positions.forEach((pos, i) => {
            this._drawCloud(this.W * pos, yOffsets[i], sizes[i]);
        });
    }
    
    _drawCloud(x, y, w) {
        this.ctx.fillStyle = 'rgba(255,255,255,0.75)';
        const h = Math.round(w * 0.4);
        this.ctx.fillRect(x + w * 0.2, y, w * 0.6, h);
        this.ctx.fillRect(x, y + h * 0.3, w, h * 0.6);
        this.ctx.fillRect(x + w * 0.1, y + h * 0.5, w * 0.8, h * 0.4);
    }
    
    _drawGround() {
        // Suelo
        this.ctx.fillStyle = COLORS.GROUND;
        this.ctx.fillRect(0, this.H - 60, this.W, 60);
        
        // Franja de pasto
        this.ctx.fillStyle = COLORS.GRASS;
        this.ctx.fillRect(0, this.H - 60, this.W, 14);
        
        // Mechones de pasto
        this.ctx.fillStyle = COLORS.GRASS_DARK;
        for (let x = 4; x < this.W; x += 12) {
            this.ctx.fillRect(x, this.H - 66, 3, 6);
            this.ctx.fillRect(x + 5, this.H - 63, 3, 4);
        }
    }
    
    _drawBushes() {
        const positions = [0.05, 0.2, 0.4, 0.6, 0.8, 0.95];
        positions.forEach(pos => this._drawBush(this.W * pos, this.H - 60));
    }
    
    _drawBush(x, y) {
        this.ctx.fillStyle = COLORS.BUSH_DARK;
        this.ctx.fillRect(x, y - 28, 48, 28);
        this.ctx.fillStyle = COLORS.BUSH_MID;
        this.ctx.fillRect(x + 3, y - 34, 20, 14);
        this.ctx.fillRect(x + 26, y - 31, 16, 11);
        this.ctx.fillStyle = COLORS.BUSH_LITE;
        this.ctx.fillRect(x + 6, y - 38, 10, 8);
        this.ctx.fillRect(x + 28, y - 34, 8, 6);
    }
    
    // ════════════════════════════════════════════════════════════
    //  PATO
    // ════════════════════════════════════════════════════════════
    
    /**
     * Dibuja un pato con estilo pixel art
     */
    drawDuck(duck) {
        if (!duck.alive && !duck.hit) return;
        
        const { x, y, size, colors, wingUp, vx } = duck;
        const [body, wing, beak, belly] = colors;
        const flip = vx < 0;
        
        this.ctx.save();
        this.ctx.translate(x, y);
        if (flip) this.ctx.scale(-1, 1);
        
        // Ala (atrás)
        this.ctx.fillStyle = wing;
        if (wingUp) {
            this.ctx.fillRect(-size * 0.3, -size * 0.55, size * 0.5, size * 0.25);
        } else {
            this.ctx.fillRect(-size * 0.3, -size * 0.2, size * 0.5, size * 0.25);
        }
        
        // Cuerpo
        this.ctx.fillStyle = body;
        this.ctx.fillRect(-size * 0.38, -size * 0.3, size * 0.76, size * 0.45);
        
        // Panza
        this.ctx.fillStyle = belly;
        this.ctx.fillRect(-size * 0.18, -size * 0.15, size * 0.36, size * 0.28);
        
        // Cabeza
        this.ctx.fillStyle = body;
        this.ctx.fillRect(size * 0.2, -size * 0.52, size * 0.32, size * 0.3);
        
        // Ojo
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(size * 0.38, -size * 0.48, size * 0.08, size * 0.08);
        this.ctx.fillStyle = '#fff';
        this.ctx.fillRect(size * 0.40, -size * 0.46, size * 0.04, size * 0.04);
        
        // Pico
        this.ctx.fillStyle = beak;
        this.ctx.fillRect(size * 0.5, -size * 0.42, size * 0.2, size * 0.1);
        
        // Cola
        this.ctx.fillStyle = wing;
        this.ctx.fillRect(-size * 0.48, -size * 0.38, size * 0.14, size * 0.16);
        
        this.ctx.restore();
        
        // Marca de impacto
        if (duck.hit) {
            this.ctx.fillStyle = '#ff0000';
            this.ctx.font = `bold ${size}px monospace`;
            this.ctx.textAlign = 'center';
            this.ctx.fillText('✕', x, y + 4);
        }
    }
    
    // ════════════════════════════════════════════════════════════
    //  PERRO
    // ════════════════════════════════════════════════════════════
    
    /**
     * Dibuja el perro del juego
     */
    drawDog(dog) {
        if (dog.state === 'idle') return;
        
        const x = dog.x;
        const y = this.H - 62;
        const s = 36;
        
        // Cuerpo
        this.ctx.fillStyle = '#c8a45a';
        this.ctx.fillRect(x - s * 0.3, y - s * 0.6, s * 0.6, s * 0.5);
        
        // Cabeza y oreja
        this.ctx.fillStyle = '#a0743a';
        this.ctx.fillRect(x - s * 0.2, y - s * 0.9, s * 0.4, s * 0.35);
        this.ctx.fillRect(x + s * 0.15, y - s * 0.72, s * 0.2, s * 0.15);
        
        // Ojos
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(x + s * 0.04, y - s * 0.80, 4, 4);
        
        if (dog.state === 'happy' && dog.duck) {
            // Sosteniendo pato
            this.ctx.fillStyle = '#4a9e4a';
            this.ctx.fillRect(x - 10, y - s * 1.4, 20, 14);
            this.ctx.fillStyle = '#ffe347';
            this.ctx.fillRect(x + 8, y - s * 1.32, 8, 5);
        }
        
        if (dog.state === 'laugh') {
            // Boca riendo
            this.ctx.fillStyle = '#ff3c3c';
            this.ctx.fillRect(x - 6, y - s * 0.58, 12, 4);
        }
    }
    
    // ════════════════════════════════════════════════════════════
    //  EFECTOS
    // ════════════════════════════════════════════════════════════
    
    /**
     * Dibuja efectos de texto flotante
     */
    drawEffects(effects) {
        for (const e of effects) {
            this.ctx.save();
            this.ctx.globalAlpha = e.alpha;
            this.ctx.font = `${e.size}px 'Press Start 2P'`;
            this.ctx.textAlign = 'center';
            this.ctx.fillStyle = e.color;
            this.ctx.fillText(e.text, e.x, e.y);
            this.ctx.restore();
        }
    }
    
    /**
     * Crea un flash de disparo
     */
    createFlash(x, y) {
        this.flash = { x, y, r: 10, alpha: 0.9 };
    }
    
    /**
     * Dibuja y actualiza el flash de disparo
     */
    drawFlash() {
        if (!this.flash) return;
        
        this.ctx.save();
        this.ctx.globalAlpha = this.flash.alpha;
        this.ctx.fillStyle = '#ffe347';
        this.ctx.beginPath();
        this.ctx.arc(this.flash.x, this.flash.y, this.flash.r, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
        
        this.flash.alpha -= 0.15;
        this.flash.r += 3;
        
        if (this.flash.alpha <= 0) {
            this.flash = null;
        }
    }
    
    get width() { return this.W; }
    get height() { return this.H; }
}
