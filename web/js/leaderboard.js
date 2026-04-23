// ════════════════════════════════════════════════════════════════
//  LEADERBOARD SERVICE — Comunicación con el servidor de scores
// ════════════════════════════════════════════════════════════════

const LEADERBOARD_URL = 'http://localhost:3001/api/leaderboard';

/**
 * Servicio para gestionar el leaderboard
 */
export class LeaderboardService {
    constructor() {
        this.currentPlayerRank = null;
    }
    
    /**
     * Guarda un score en el servidor
     */
    async saveScore(data) {
        try {
            const res = await fetch(LEADERBOARD_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: data.playerName,
                    score: data.score,
                    round: data.round,
                    ducks_hit: data.ducksHit,
                    ducks_total: data.ducksTotal,
                    method: data.method,
                    rng_calls: data.rngCalls
                })
            });
            
            if (!res.ok) throw new Error('Server error');
            
            const result = await res.json();
            this.currentPlayerRank = result.rank;
            
            return {
                success: true,
                rank: result.rank
            };
        } catch (e) {
            return {
                success: false,
                error: e.message
            };
        }
    }
    
    /**
     * Obtiene el leaderboard del servidor
     */
    async getLeaderboard(limit = 10) {
        try {
            const res = await fetch(`${LEADERBOARD_URL}?limit=${limit}`);
            if (!res.ok) throw new Error('Server error');
            
            const data = await res.json();
            return {
                success: true,
                entries: data.leaderboard
            };
        } catch (e) {
            return {
                success: false,
                entries: [],
                error: e.message
            };
        }
    }
    
    /**
     * Resetea el rank del jugador actual
     */
    resetCurrentRank() {
        this.currentPlayerRank = null;
    }
    
    get playerRank() {
        return this.currentPlayerRank;
    }
}

/**
 * Componente UI para mostrar el leaderboard
 */
export class LeaderboardUI {
    constructor(service) {
        this.service = service;
    }
    
    /**
     * Escapa HTML para prevenir XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    /**
     * Renderiza el leaderboard compacto (game over)
     */
    renderCompact(entries, containerId = 'leaderboard-list') {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        if (entries.length === 0) {
            container.innerHTML = '<div style="color:#666;font-size:7px">Aún no hay scores</div>';
            return;
        }
        
        container.innerHTML = entries.map((entry, i) => {
            const rank = i + 1;
            const isHighlight = this.service.currentPlayerRank === rank;
            const isTop3 = rank <= 3;
            
            return `
                <div class="leaderboard-entry ${isHighlight ? 'highlight' : ''}">
                    <span class="rank ${isTop3 ? 'top-3' : ''}">#${rank}</span>
                    <span class="name">${this.escapeHtml(entry.name)}</span>
                    <span class="score">${entry.score.toLocaleString()}</span>
                    <span class="method">${entry.method.toUpperCase()}</span>
                </div>
            `;
        }).join('');
    }
    
    /**
     * Renderiza el leaderboard completo (pantalla dedicada)
     */
    renderFull(entries, containerId = 'leaderboard-full') {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        if (entries.length === 0) {
            container.innerHTML = '<div class="no-scores">Aún no hay scores registrados.<br>¡Sé el primero en jugar!</div>';
            return;
        }
        
        const rows = entries.map((entry, i) => {
            const rank = i + 1;
            const rankClass = rank <= 3 ? `rank-${rank}` : '';
            const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
            const accuracy = entry.ducks_total > 0 
                ? Math.round(entry.ducks_hit / entry.ducks_total * 100) 
                : 0;
            
            return `
                <tr class="${rankClass}">
                    <td>${medal}</td>
                    <td>${this.escapeHtml(entry.name)}</td>
                    <td>${entry.score.toLocaleString()}</td>
                    <td>R${entry.round}</td>
                    <td>${accuracy}%</td>
                    <td>${entry.method.toUpperCase()}</td>
                </tr>
            `;
        }).join('');
        
        container.innerHTML = `
            <table class="leaderboard-table">
                <thead>
                    <tr>
                        <th></th>
                        <th>JUGADOR</th>
                        <th>SCORE</th>
                        <th>RONDA</th>
                        <th>PREC.</th>
                        <th>RNG</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
        `;
    }
    
    /**
     * Muestra mensaje de carga
     */
    showLoading(containerId) {
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = '<div style="color:#666;font-size:7px">Cargando...</div>';
        }
    }
    
    /**
     * Muestra mensaje de error
     */
    showError(containerId, message = 'Sin conexión al servidor') {
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = `<div style="color:#ff3c3c;font-size:7px">⚠ ${message}</div>`;
        }
    }
}

// Instancias singleton
export const leaderboardService = new LeaderboardService();
export const leaderboardUI = new LeaderboardUI(leaderboardService);
