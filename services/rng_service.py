"""
Microservicio REST para randompro
Expone los generadores de números aleatorios via HTTP
"""
from flask import Flask, jsonify, request
from flask_cors import CORS
from randompro import CuadradoMedio, CongruenciaLineal

app = Flask(__name__)
CORS(app)  # Permitir llamadas desde el navegador

# Almacén de instancias activas (por sesión/id)
sessions = {}


@app.route('/api/randompro/create', methods=['POST'])
def create_generator():
    """
    Crear una nueva instancia del generador.
    
    Body JSON:
    {
        "method": "lcg" | "cm",
        "seed": int (opcional),
        "digits": int (solo para cm, default 6),
        "m": int (solo para lcg, default 2^32),
        "a": int (solo para lcg, default 1664525),
        "c": int (solo para lcg, default 1013904223)
    }
    
    Response:
    {
        "session_id": str,
        "method": str,
        "seed": int
    }
    """
    data = request.get_json() or {}
    method = data.get('method', 'lcg')
    seed = data.get('seed')
    
    import uuid
    session_id = str(uuid.uuid4())
    
    if method == 'cm':
        digits = data.get('digits', 6)
        rng = CuadradoMedio(seed=seed, digits=digits)
    else:  # lcg
        m = data.get('m', 4294967296)
        a = data.get('a', 1664525)
        c = data.get('c', 1013904223)
        rng = CongruenciaLineal(seed=seed, m=m, a=a, c=c)
    
    # Guardar el seed inicial (es el estado actual antes de cualquier llamada)
    initial_seed = rng.state
    
    sessions[session_id] = {
        'rng': rng,
        'method': method,
        'calls': 0,
        'seed': initial_seed
    }
    
    return jsonify({
        'session_id': session_id,
        'method': method,
        'seed': initial_seed
    })


@app.route('/api/randompro/random/<session_id>', methods=['GET'])
def get_random(session_id):
    """
    Obtener un número aleatorio [0, 1).
    
    Response:
    {
        "value": float,
        "state": int,
        "calls": int
    }
    """
    if session_id not in sessions:
        return jsonify({'error': 'Session not found'}), 404
    
    session = sessions[session_id]
    value = session['rng'].random()
    session['calls'] += 1
    
    return jsonify({
        'value': value,
        'state': session['rng'].state,
        'calls': session['calls']
    })


@app.route('/api/randompro/randint/<session_id>', methods=['GET'])
def get_randint(session_id):
    """
    Obtener un entero aleatorio en rango [a, b].
    
    Query params: ?a=0&b=100
    
    Response:
    {
        "value": int,
        "state": int,
        "calls": int
    }
    """
    if session_id not in sessions:
        return jsonify({'error': 'Session not found'}), 404
    
    a = request.args.get('a', 0, type=int)
    b = request.args.get('b', 100, type=int)
    
    session = sessions[session_id]
    value = session['rng'].randint(a, b)
    session['calls'] += 1
    
    return jsonify({
        'value': value,
        'state': session['rng'].state,
        'calls': session['calls']
    })


@app.route('/api/randompro/sample/<session_id>', methods=['GET'])
def get_sample(session_id):
    """
    Obtener múltiples números aleatorios.
    
    Query params: ?n=10
    
    Response:
    {
        "values": [float, ...],
        "state": int,
        "calls": int
    }
    """
    if session_id not in sessions:
        return jsonify({'error': 'Session not found'}), 404
    
    n = request.args.get('n', 1, type=int)
    
    session = sessions[session_id]
    values = session['rng'].sample(n)
    session['calls'] += n
    
    return jsonify({
        'values': values,
        'state': session['rng'].state,
        'calls': session['calls']
    })


@app.route('/api/randompro/state/<session_id>', methods=['GET'])
def get_state(session_id):
    """
    Obtener el estado actual del generador.
    
    Response:
    {
        "method": str,
        "seed": int,
        "state": int,
        "calls": int
    }
    """
    if session_id not in sessions:
        return jsonify({'error': 'Session not found'}), 404
    
    session = sessions[session_id]
    
    return jsonify({
        'method': session['method'],
        'seed': session['seed'],
        'state': session['rng'].state,
        'calls': session['calls']
    })


@app.route('/api/randompro/delete/<session_id>', methods=['DELETE'])
def delete_session(session_id):
    """Eliminar una sesión."""
    if session_id in sessions:
        del sessions[session_id]
    return jsonify({'deleted': True})


@app.route('/api/health', methods=['GET'])
def health():
    """Health check."""
    return jsonify({'status': 'ok', 'service': 'randompro-api'})


if __name__ == '__main__':
    print("🎲 Microservicio randompro iniciando...")
    print("📍 Endpoints disponibles:")
    print("   POST /api/randompro/create     - Crear generador")
    print("   GET  /api/randompro/random/:id - Número aleatorio")
    print("   GET  /api/randompro/randint/:id?a=0&b=100 - Entero aleatorio")
    print("   GET  /api/randompro/sample/:id?n=10 - Múltiples números")
    print("   GET  /api/randompro/state/:id  - Estado actual")
    print("   DELETE /api/randompro/delete/:id - Eliminar sesión")
    app.run(host='0.0.0.0', port=3000, debug=True)
