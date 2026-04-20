"""
Analytics Microservice - Duck Hunt Score Prediction
====================================================
Puerto: 3002

Modelo: Regresión Lineal Múltiple
    score = β₀ + β₁·round + β₂·precision + β₃·method

Variables:
    - round: Número de rondas alcanzadas (numérica)
    - precision: ducks_hit / ducks_total (0.0 - 1.0)
    - method: 0 = CM (Cuadrado Medio), 1 = LCG (Congruencia Lineal)

Métricas:
    - R²: Varianza explicada por el modelo (0-1, mayor = mejor)
    - MAE: Error Absoluto Medio
    - RMSE: Raíz del Error Cuadrático Medio
    - Coeficientes: Impacto de cada variable en el score

Endpoints:
    GET  /api/model/info       - Info del modelo entrenado
    POST /api/model/predict    - Predecir score
    POST /api/model/retrain    - Re-entrenar con datos actuales
    GET  /api/stats            - Estadísticas descriptivas
    GET  /api/compare-methods  - Comparación estadística LCG vs CM
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
import json
import os
import numpy as np
from datetime import datetime

# Scikit-learn para el modelo
from sklearn.linear_model import LinearRegression
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

app = Flask(__name__)
CORS(app)

# ════════════════════════════════════════════════════════════════
#  CONFIGURACIÓN
# ════════════════════════════════════════════════════════════════
# Directorio base del proyecto
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, 'data')

SEED_DATA_FILE = os.path.join(DATA_DIR, 'seed_data.json')
SCORES_FILE = os.path.join(DATA_DIR, 'scores.json')
MODEL_STATE_FILE = os.path.join(DATA_DIR, 'model_state.json')

# Modelo global
model = None
model_metrics = {}
training_data_count = 0
last_trained = None


# ════════════════════════════════════════════════════════════════
#  UTILIDADES DE DATOS
# ════════════════════════════════════════════════════════════════
def load_all_data():
    """Carga datos de seed + scores reales"""
    all_data = []
    
    # Cargar seed data
    if os.path.exists(SEED_DATA_FILE):
        with open(SEED_DATA_FILE, 'r') as f:
            seed = json.load(f)
            all_data.extend(seed)
    
    # Cargar scores reales
    if os.path.exists(SCORES_FILE):
        with open(SCORES_FILE, 'r') as f:
            scores = json.load(f)
            all_data.extend(scores)
    
    return all_data


def prepare_features(data):
    """
    Convierte datos raw a features para el modelo.
    
    Features (X):
        - round: Rondas alcanzadas
        - precision: ducks_hit / ducks_total
        - method: 0=CM, 1=LCG
    
    Target (y):
        - score
    """
    X = []
    y = []
    
    for entry in data:
        # Filtrar entries inválidos
        ducks_total = entry.get('ducks_total', 0)
        if ducks_total == 0:
            continue
        
        # Calcular precision
        precision = entry.get('ducks_hit', 0) / ducks_total
        
        # Codificar método (0=cm, 1=lcg)
        method_code = 1 if entry.get('method', 'lcg').lower() == 'lcg' else 0
        
        # Features
        X.append([
            entry.get('round', 1),
            precision,
            method_code
        ])
        
        # Target
        y.append(entry.get('score', 0))
    
    return np.array(X), np.array(y)


# ════════════════════════════════════════════════════════════════
#  ENTRENAMIENTO DEL MODELO
# ════════════════════════════════════════════════════════════════
def train_model():
    """
    Entrena el modelo de Regresión Lineal Múltiple.
    
    El modelo aprende la relación:
        score = β₀ + β₁·round + β₂·precision + β₃·method
    
    Donde:
        - β₀ (intercept): Score base cuando todas las variables son 0
        - β₁: Puntos adicionales por cada ronda
        - β₂: Impacto de la precisión (0-1) en el score
        - β₃: Diferencia entre usar LCG vs CM
    """
    global model, model_metrics, training_data_count, last_trained
    
    # Cargar datos
    data = load_all_data()
    X, y = prepare_features(data)
    
    if len(X) < 5:
        return False, "Datos insuficientes (mínimo 5 registros válidos)"
    
    # Dividir en train/test (80/20)
    if len(X) >= 10:
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42
        )
    else:
        # Con pocos datos, usar todo para entrenar
        X_train, y_train = X, y
        X_test, y_test = X, y
    
    # Entrenar modelo
    model = LinearRegression()
    model.fit(X_train, y_train)
    
    # Predicciones
    y_pred_train = model.predict(X_train)
    y_pred_test = model.predict(X_test)
    
    # Cross-validation (si hay suficientes datos)
    cv_scores = []
    if len(X) >= 10:
        cv_scores = cross_val_score(model, X, y, cv=min(5, len(X)//2), scoring='r2')
    
    # Calcular métricas
    model_metrics = {
        'r2_train': float(r2_score(y_train, y_pred_train)),
        'r2_test': float(r2_score(y_test, y_pred_test)),
        'r2_cv_mean': float(np.mean(cv_scores)) if len(cv_scores) > 0 else None,
        'r2_cv_std': float(np.std(cv_scores)) if len(cv_scores) > 0 else None,
        'mae': float(mean_absolute_error(y_test, y_pred_test)),
        'rmse': float(np.sqrt(mean_squared_error(y_test, y_pred_test))),
        'coefficients': {
            'intercept': float(model.intercept_),
            'round': float(model.coef_[0]),
            'precision': float(model.coef_[1]),
            'method_lcg': float(model.coef_[2])
        }
    }
    
    training_data_count = len(X)
    last_trained = datetime.now().isoformat()
    
    # Guardar estado
    save_model_state()
    
    return True, f"Modelo entrenado con {len(X)} registros"


def save_model_state():
    """Guarda métricas del modelo para persistencia"""
    state = {
        'metrics': model_metrics,
        'training_data_count': training_data_count,
        'last_trained': last_trained,
        'coefficients': model_metrics.get('coefficients', {}) if model else {}
    }
    with open(MODEL_STATE_FILE, 'w') as f:
        json.dump(state, f, indent=2)


# ════════════════════════════════════════════════════════════════
#  ENDPOINTS
# ════════════════════════════════════════════════════════════════

@app.route('/api/model/info', methods=['GET'])
def get_model_info():
    """
    Retorna información completa del modelo entrenado.
    
    Incluye:
        - Coeficientes con interpretación
        - Métricas de rendimiento
        - Datos de entrenamiento
    """
    if model is None:
        return jsonify({
            'trained': False,
            'message': 'Modelo no entrenado. Usa POST /api/model/retrain'
        }), 200
    
    # Interpretación de coeficientes
    coef = model_metrics['coefficients']
    interpretation = {
        'intercept': f"Score base: {coef['intercept']:.1f} puntos",
        'round': f"Cada ronda adicional: {'+' if coef['round'] > 0 else ''}{coef['round']:.1f} puntos",
        'precision': f"Precisión perfecta (100%): {'+' if coef['precision'] > 0 else ''}{coef['precision']:.1f} puntos",
        'method': f"Usar LCG vs CM: {'+' if coef['method_lcg'] > 0 else ''}{coef['method_lcg']:.1f} puntos"
    }
    
    return jsonify({
        'trained': True,
        'model_type': 'Regresión Lineal Múltiple',
        'formula': 'score = β₀ + β₁·round + β₂·precision + β₃·method',
        'coefficients': coef,
        'interpretation': interpretation,
        'metrics': {
            'r2_train': model_metrics['r2_train'],
            'r2_test': model_metrics['r2_test'],
            'r2_cv': model_metrics.get('r2_cv_mean'),
            'mae': model_metrics['mae'],
            'rmse': model_metrics['rmse']
        },
        'metrics_explanation': {
            'r2': 'Proporción de varianza explicada (0-1, mayor=mejor). R²=0.85 significa que el modelo explica 85% de la variación en scores.',
            'mae': 'Error Absoluto Medio. En promedio, la predicción difiere del valor real por este monto.',
            'rmse': 'Raíz del Error Cuadrático Medio. Penaliza más los errores grandes.'
        },
        'training_info': {
            'data_count': training_data_count,
            'last_trained': last_trained
        }
    })


@app.route('/api/model/predict', methods=['POST'])
def predict_score():
    """
    Predice el score esperado dados los inputs.
    
    Body JSON:
        - round: Número de rondas (requerido)
        - precision: 0.0-1.0 (opcional, default 0.5)
        - method: "lcg" o "cm" (opcional, default "lcg")
    """
    if model is None:
        return jsonify({'error': 'Modelo no entrenado'}), 400
    
    data = request.get_json() or {}
    
    round_num = data.get('round', 5)
    precision = data.get('precision', 0.5)
    method = data.get('method', 'lcg').lower()
    method_code = 1 if method == 'lcg' else 0
    
    # Validar
    precision = max(0, min(1, precision))
    round_num = max(1, round_num)
    
    # Predecir
    X = np.array([[round_num, precision, method_code]])
    predicted_score = float(model.predict(X)[0])
    
    # Desglose de contribución
    coef = model_metrics['coefficients']
    breakdown = {
        'base': coef['intercept'],
        'from_rounds': coef['round'] * round_num,
        'from_precision': coef['precision'] * precision,
        'from_method': coef['method_lcg'] * method_code
    }
    
    return jsonify({
        'predicted_score': round(max(0, predicted_score)),
        'inputs': {
            'round': round_num,
            'precision': precision,
            'method': method
        },
        'breakdown': {k: round(v, 1) for k, v in breakdown.items()},
        'confidence': {
            'mae': model_metrics['mae'],
            'range': f"±{model_metrics['mae']:.0f} puntos aprox."
        }
    })


@app.route('/api/model/retrain', methods=['POST'])
def retrain_model():
    """
    Re-entrena el modelo con todos los datos actuales.
    Combina seed_data.json + scores.json
    """
    success, message = train_model()
    
    if success:
        return jsonify({
            'success': True,
            'message': message,
            'metrics': {
                'r2': model_metrics['r2_test'],
                'mae': model_metrics['mae'],
                'data_count': training_data_count
            }
        })
    else:
        return jsonify({
            'success': False,
            'message': message
        }), 400


@app.route('/api/stats', methods=['GET'])
def get_stats():
    """
    Estadísticas descriptivas de todos los datos.
    """
    data = load_all_data()
    
    if not data:
        return jsonify({'error': 'Sin datos'}), 400
    
    # Filtrar datos válidos
    valid_data = [d for d in data if d.get('ducks_total', 0) > 0]
    
    if not valid_data:
        return jsonify({'error': 'Sin datos válidos'}), 400
    
    # Extraer arrays
    scores = [d['score'] for d in valid_data]
    rounds = [d['round'] for d in valid_data]
    precisions = [d['ducks_hit']/d['ducks_total'] for d in valid_data]
    
    # Por método
    lcg_data = [d for d in valid_data if d.get('method', '').lower() == 'lcg']
    cm_data = [d for d in valid_data if d.get('method', '').lower() == 'cm']
    
    def calc_stats(arr):
        if not arr:
            return None
        return {
            'count': len(arr),
            'mean': round(float(np.mean(arr)), 2),
            'std': round(float(np.std(arr)), 2),
            'min': round(float(np.min(arr)), 2),
            'max': round(float(np.max(arr)), 2),
            'median': round(float(np.median(arr)), 2)
        }
    
    return jsonify({
        'total_records': len(data),
        'valid_records': len(valid_data),
        'score': calc_stats(scores),
        'round': calc_stats(rounds),
        'precision': calc_stats(precisions),
        'by_method': {
            'lcg': {
                'count': len(lcg_data),
                'avg_score': round(np.mean([d['score'] for d in lcg_data]), 1) if lcg_data else 0,
                'avg_round': round(np.mean([d['round'] for d in lcg_data]), 1) if lcg_data else 0
            },
            'cm': {
                'count': len(cm_data),
                'avg_score': round(np.mean([d['score'] for d in cm_data]), 1) if cm_data else 0,
                'avg_round': round(np.mean([d['round'] for d in cm_data]), 1) if cm_data else 0
            }
        }
    })


@app.route('/api/compare-methods', methods=['GET'])
def compare_methods():
    """
    Comparación estadística entre LCG y CM.
    Usa t-test para determinar si hay diferencia significativa.
    """
    from scipy import stats
    
    data = load_all_data()
    valid_data = [d for d in data if d.get('ducks_total', 0) > 0]
    
    lcg_scores = [d['score'] for d in valid_data if d.get('method', '').lower() == 'lcg']
    cm_scores = [d['score'] for d in valid_data if d.get('method', '').lower() == 'cm']
    
    if len(lcg_scores) < 3 or len(cm_scores) < 3:
        return jsonify({
            'error': 'Datos insuficientes para comparación (mínimo 3 por método)',
            'lcg_count': len(lcg_scores),
            'cm_count': len(cm_scores)
        }), 400
    
    # T-test independiente
    t_stat, p_value = stats.ttest_ind(lcg_scores, cm_scores)
    
    # Tamaño del efecto (Cohen's d)
    pooled_std = np.sqrt((np.std(lcg_scores)**2 + np.std(cm_scores)**2) / 2)
    cohens_d = (np.mean(lcg_scores) - np.mean(cm_scores)) / pooled_std if pooled_std > 0 else 0
    
    # Interpretación
    if p_value < 0.05:
        if cohens_d > 0:
            conclusion = f"LCG produce scores significativamente MAYORES que CM (p={p_value:.4f})"
        else:
            conclusion = f"CM produce scores significativamente MAYORES que LCG (p={p_value:.4f})"
    else:
        conclusion = f"No hay diferencia significativa entre métodos (p={p_value:.4f})"
    
    # Interpretar tamaño del efecto
    effect_size = abs(cohens_d)
    if effect_size < 0.2:
        effect_interpretation = "negligible"
    elif effect_size < 0.5:
        effect_interpretation = "pequeño"
    elif effect_size < 0.8:
        effect_interpretation = "mediano"
    else:
        effect_interpretation = "grande"
    
    return jsonify({
        'lcg': {
            'count': len(lcg_scores),
            'mean': round(float(np.mean(lcg_scores)), 1),
            'std': round(float(np.std(lcg_scores)), 1)
        },
        'cm': {
            'count': len(cm_scores),
            'mean': round(float(np.mean(cm_scores)), 1),
            'std': round(float(np.std(cm_scores)), 1)
        },
        'statistical_test': {
            'test': 't-test independiente',
            't_statistic': round(float(t_stat), 4),
            'p_value': round(float(p_value), 4),
            'significant': p_value < 0.05,
            'cohens_d': round(float(cohens_d), 3),
            'effect_size': effect_interpretation
        },
        'conclusion': conclusion,
        'interpretation': {
            'p_value': 'Probabilidad de observar esta diferencia por azar. p<0.05 = diferencia significativa.',
            'cohens_d': 'Tamaño del efecto. |d|<0.2=negligible, <0.5=pequeño, <0.8=mediano, ≥0.8=grande'
        }
    })


@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'ok',
        'service': 'analytics',
        'model_trained': model is not None
    })


# ════════════════════════════════════════════════════════════════
#  INICIALIZACIÓN
# ════════════════════════════════════════════════════════════════
if __name__ == '__main__':
    print("═" * 60)
    print("  ANALYTICS SERVICE - Duck Hunt Score Prediction")
    print("═" * 60)
    print(f"  Puerto: 3002")
    print(f"  Seed data: {SEED_DATA_FILE}")
    print(f"  Scores: {SCORES_FILE}")
    print("─" * 60)
    
    # Entrenar modelo al iniciar
    success, msg = train_model()
    if success:
        print(f"  ✓ Modelo entrenado: {msg}")
        print(f"  ✓ R² = {model_metrics['r2_test']:.3f}")
        print(f"  ✓ MAE = {model_metrics['mae']:.1f} puntos")
        coef = model_metrics['coefficients']
        print(f"  ✓ Fórmula: score = {coef['intercept']:.1f} + {coef['round']:.1f}·round + {coef['precision']:.1f}·precision + {coef['method_lcg']:.1f}·method")
    else:
        print(f"  ⚠ {msg}")
    
    print("─" * 60)
    print("  Endpoints:")
    print("    GET  /api/model/info      - Info del modelo")
    print("    POST /api/model/predict   - Predecir score")
    print("    POST /api/model/retrain   - Re-entrenar")
    print("    GET  /api/stats           - Estadísticas")
    print("    GET  /api/compare-methods - Comparar LCG vs CM")
    print("═" * 60)
    
    app.run(host='0.0.0.0', port=3002, debug=True)
