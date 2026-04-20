"""
Microservicio REST para Leaderboard
Guarda y recupera los scores de los jugadores
"""
from flask import Flask, jsonify, request
from flask_cors import CORS
from datetime import datetime
import json
import os

app = Flask(__name__)
CORS(app)

# Directorio base del proyecto
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, 'data')

# Archivo para persistir los scores
SCORES_FILE = os.path.join(DATA_DIR, 'scores.json')

def load_scores():
    """Cargar scores desde archivo"""
    if os.path.exists(SCORES_FILE):
        try:
            with open(SCORES_FILE, 'r') as f:
                return json.load(f)
        except:
            return []
    return []

def save_scores(scores):
    """Guardar scores a archivo"""
    with open(SCORES_FILE, 'w') as f:
        json.dump(scores, f, indent=2)

# Cargar scores al iniciar
scores = load_scores()


@app.route('/api/health', methods=['GET'])
def health():
    """Health check"""
    return jsonify({'status': 'ok', 'service': 'leaderboard'})


@app.route('/api/leaderboard', methods=['GET'])
def get_leaderboard():
    """
    Obtener el leaderboard ordenado por score.
    
    Query params: ?limit=10
    
    Response:
    {
        "leaderboard": [
            {"name": str, "score": int, "round": int, "method": str, "date": str},
            ...
        ],
        "total": int
    }
    """
    limit = request.args.get('limit', 10, type=int)
    sorted_scores = sorted(scores, key=lambda x: x['score'], reverse=True)
    
    return jsonify({
        'leaderboard': sorted_scores[:limit],
        'total': len(scores)
    })


@app.route('/api/leaderboard', methods=['POST'])
def add_score():
    """
    Agregar un nuevo score al leaderboard.
    
    Body JSON:
    {
        "name": str,
        "score": int,
        "round": int (opcional),
        "ducks_hit": int (opcional),
        "ducks_total": int (opcional),
        "method": str (opcional, "lcg" o "cm"),
        "rng_calls": int (opcional)
    }
    
    Response:
    {
        "success": true,
        "rank": int,
        "entry": {...}
    }
    """
    data = request.get_json() or {}
    
    name = data.get('name', 'Anonymous').strip()
    if not name:
        name = 'Anonymous'
    
    score_value = data.get('score', 0)
    
    entry = {
        'name': name[:20],  # Limitar a 20 caracteres
        'score': score_value,
        'round': data.get('round', 0),
        'ducks_hit': data.get('ducks_hit', 0),
        'ducks_total': data.get('ducks_total', 0),
        'method': data.get('method', 'unknown'),
        'rng_calls': data.get('rng_calls', 0),
        'date': datetime.now().isoformat()
    }
    
    scores.append(entry)
    save_scores(scores)
    
    # Calcular el ranking
    sorted_scores = sorted(scores, key=lambda x: x['score'], reverse=True)
    rank = next((i + 1 for i, s in enumerate(sorted_scores) if s == entry), len(scores))
    
    return jsonify({
        'success': True,
        'rank': rank,
        'entry': entry
    })


@app.route('/api/leaderboard/clear', methods=['DELETE'])
def clear_leaderboard():
    """Limpiar todo el leaderboard (admin)"""
    global scores
    scores = []
    save_scores(scores)
    return jsonify({'success': True, 'message': 'Leaderboard cleared'})


if __name__ == '__main__':
    print('🏆 Microservicio Leaderboard iniciando...')
    print('📍 Endpoints disponibles:')
    print('   GET  /api/leaderboard       - Obtener ranking')
    print('   POST /api/leaderboard       - Agregar score')
    print('   DELETE /api/leaderboard/clear - Limpiar ranking')
    app.run(host='0.0.0.0', port=3001, debug=True)
