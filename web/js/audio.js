// ════════════════════════════════════════════════════════════════
//  AUDIO MANAGER — Efectos de sonido con Web Audio API
// ════════════════════════════════════════════════════════════════

// Notas musicales (frecuencias en Hz)
const NOTES = {
    C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23,
    G4: 392.00, A4: 440.00, B4: 493.88,
    C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46,
    G5: 783.99, A5: 880.00
};

/**
 * Gestiona todos los efectos de sonido del juego
 * Usa Web Audio API para generar sonidos proceduralmente
 */
export class AudioManager {
    constructor() {
        this.audioCtx = null;
        this.bgmPlaying = false;
        this.bgmNodes = null;
        this.bgmInterval = null;
    }
    
    /**
     * Obtiene o crea el contexto de audio
     */
    getContext() {
        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        return this.audioCtx;
    }
    
    // ════════════════════════════════════════════════════════════
    //  MÚSICA DE FONDO
    // ════════════════════════════════════════════════════════════
    
    /**
     * Inicia la música de fondo
     * Genera una melodía sutil estilo 8-bit
     */
    startBackgroundMusic() {
        if (this.bgmPlaying) return;
        
        try {
            const ac = this.getContext();
            
            // Nodo de ganancia maestro para la música
            const masterGain = ac.createGain();
            masterGain.gain.value = 0.08; // Volumen muy bajo (sutil)
            masterGain.connect(ac.destination);
            
            // Melodía estilo Duck Hunt (alegre, pastoral)
            const melody = [
                { note: 'G4', duration: 0.3 },
                { note: 'E4', duration: 0.3 },
                { note: 'G4', duration: 0.3 },
                { note: 'A4', duration: 0.3 },
                { note: 'G4', duration: 0.6 },
                { note: 'E4', duration: 0.3 },
                { note: 'D4', duration: 0.3 },
                { note: 'E4', duration: 0.6 },
                { note: 'G4', duration: 0.3 },
                { note: 'E4', duration: 0.3 },
                { note: 'G4', duration: 0.3 },
                { note: 'A4', duration: 0.3 },
                { note: 'B4', duration: 0.6 },
                { note: 'A4', duration: 0.3 },
                { note: 'G4', duration: 0.3 },
                { note: 'E4', duration: 0.6 },
            ];
            
            // Bajo de acompañamiento
            const bass = [
                { note: 'C4', duration: 0.6 },
                { note: 'G4', duration: 0.6 },
                { note: 'C4', duration: 0.6 },
                { note: 'G4', duration: 0.6 },
                { note: 'F4', duration: 0.6 },
                { note: 'C4', duration: 0.6 },
                { note: 'G4', duration: 0.6 },
                { note: 'C4', duration: 0.6 },
            ];
            
            let melodyIndex = 0;
            let bassIndex = 0;
            let melodyTime = 0;
            let bassTime = 0;
            
            this.bgmNodes = { masterGain };
            this.bgmPlaying = true;
            
            // Loop de la música
            const playLoop = () => {
                if (!this.bgmPlaying) return;
                
                const currentTime = ac.currentTime;
                
                // Reproducir notas de melodía
                while (melodyTime < currentTime + 0.5) {
                    const { note, duration } = melody[melodyIndex];
                    this._playNote(NOTES[note], melodyTime, duration * 0.9, 'triangle', masterGain, 0.6);
                    melodyTime += duration;
                    melodyIndex = (melodyIndex + 1) % melody.length;
                }
                
                // Reproducir notas de bajo
                while (bassTime < currentTime + 0.5) {
                    const { note, duration } = bass[bassIndex];
                    this._playNote(NOTES[note] / 2, bassTime, duration * 0.8, 'sine', masterGain, 0.4);
                    bassTime += duration;
                    bassIndex = (bassIndex + 1) % bass.length;
                }
            };
            
            // Inicializar tiempos
            melodyTime = ac.currentTime;
            bassTime = ac.currentTime;
            
            // Reproducir inmediatamente y luego cada 200ms
            playLoop();
            this.bgmInterval = setInterval(playLoop, 200);
            
        } catch (e) {
            console.warn('No se pudo iniciar música de fondo:', e);
        }
    }
    
    /**
     * Detiene la música de fondo
     */
    stopBackgroundMusic() {
        this.bgmPlaying = false;
        
        if (this.bgmInterval) {
            clearInterval(this.bgmInterval);
            this.bgmInterval = null;
        }
        
        if (this.bgmNodes?.masterGain) {
            try {
                const ac = this.getContext();
                this.bgmNodes.masterGain.gain.exponentialRampToValueAtTime(
                    0.001, ac.currentTime + 0.5
                );
            } catch (e) {
                // Ignorar errores
            }
        }
        
        this.bgmNodes = null;
    }
    
    /**
     * Reproduce una nota individual
     */
    _playNote(frequency, startTime, duration, waveform, destination, volume = 1) {
        try {
            const ac = this.getContext();
            
            const osc = ac.createOscillator();
            const gain = ac.createGain();
            
            osc.type = waveform;
            osc.frequency.setValueAtTime(frequency, startTime);
            
            // Envelope ADSR simplificado
            gain.gain.setValueAtTime(0.001, startTime);
            gain.gain.exponentialRampToValueAtTime(volume, startTime + 0.02);
            gain.gain.exponentialRampToValueAtTime(volume * 0.7, startTime + duration * 0.3);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
            
            osc.connect(gain);
            gain.connect(destination);
            
            osc.start(startTime);
            osc.stop(startTime + duration + 0.1);
        } catch (e) {
            // Ignorar errores
        }
    }
    
    /**
     * Ajusta el volumen de la música de fondo
     */
    setMusicVolume(volume) {
        if (this.bgmNodes?.masterGain) {
            this.bgmNodes.masterGain.gain.value = Math.max(0, Math.min(0.2, volume));
        }
    }
    
    /**
     * Reproduce el sonido de disparo
     * Genera ruido blanco con decay exponencial
     */
    playShot() {
        try {
            const ac = this.getContext();
            const duration = 0.15;
            
            // Crear buffer de ruido
            const buf = ac.createBuffer(1, ac.sampleRate * duration, ac.sampleRate);
            const data = buf.getChannelData(0);
            
            // Llenar con ruido blanco decayendo
            for (let i = 0; i < data.length; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ac.sampleRate * 0.04));
            }
            
            // Crear nodos
            const source = ac.createBufferSource();
            source.buffer = buf;
            
            const gain = ac.createGain();
            gain.gain.value = 0.4;
            
            // Conectar y reproducir
            source.connect(gain);
            gain.connect(ac.destination);
            source.start();
        } catch (e) {
            // Silenciar errores de audio
        }
    }
    
    /**
     * Reproduce el sonido de impacto
     * Genera un tono descendente
     */
    playHit() {
        try {
            const ac = this.getContext();
            
            // Crear oscilador
            const osc = ac.createOscillator();
            const gain = ac.createGain();
            
            osc.connect(gain);
            gain.connect(ac.destination);
            
            // Frecuencia descendente (880Hz → 220Hz)
            osc.frequency.setValueAtTime(880, ac.currentTime);
            osc.frequency.exponentialRampToValueAtTime(220, ac.currentTime + 0.2);
            
            // Volumen con fade out
            gain.gain.setValueAtTime(0.3, ac.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.3);
            
            // Reproducir
            osc.start();
            osc.stop(ac.currentTime + 0.3);
        } catch (e) {
            // Silenciar errores de audio
        }
    }
    
    /**
     * Reproduce sonido de game over
     * Genera un tono triste descendente
     */
    playGameOver() {
        try {
            const ac = this.getContext();
            
            const osc = ac.createOscillator();
            const gain = ac.createGain();
            
            osc.type = 'triangle';
            osc.connect(gain);
            gain.connect(ac.destination);
            
            // Secuencia de notas descendentes
            osc.frequency.setValueAtTime(440, ac.currentTime);
            osc.frequency.setValueAtTime(392, ac.currentTime + 0.2);
            osc.frequency.setValueAtTime(349, ac.currentTime + 0.4);
            osc.frequency.setValueAtTime(294, ac.currentTime + 0.6);
            
            gain.gain.setValueAtTime(0.2, ac.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.8);
            
            osc.start();
            osc.stop(ac.currentTime + 0.8);
        } catch (e) {
            // Silenciar errores de audio
        }
    }
    
    /**
     * Reproduce sonido de nueva ronda
     */
    playRoundStart() {
        try {
            const ac = this.getContext();
            
            const osc = ac.createOscillator();
            const gain = ac.createGain();
            
            osc.type = 'square';
            osc.connect(gain);
            gain.connect(ac.destination);
            
            // Tono ascendente rápido
            osc.frequency.setValueAtTime(440, ac.currentTime);
            osc.frequency.setValueAtTime(660, ac.currentTime + 0.1);
            
            gain.gain.setValueAtTime(0.15, ac.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.15);
            
            osc.start();
            osc.stop(ac.currentTime + 0.15);
        } catch (e) {
            // Silenciar errores de audio
        }
    }
}

// Instancia singleton
export const audio = new AudioManager();
