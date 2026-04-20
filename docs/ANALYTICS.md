# 📊 Servicio Analytics

Microservicio de Machine Learning que utiliza **Regresión Lineal Múltiple** para analizar y predecir scores de jugadores basándose en datos históricos.

## 📍 Información

| Propiedad | Valor |
|-----------|-------|
| **Puerto** | 3002 |
| **Archivo** | `services/analytics.py` |
| **Modelo** | Regresión Lineal Múltiple |
| **Dependencias** | Flask, scikit-learn, NumPy, SciPy |

## 🧠 Modelo Matemático

### Fórmula

```
score = β₀ + β₁·round + β₂·precision + β₃·method
```

### Variables

| Variable | Descripción | Rango |
|----------|-------------|-------|
| `round` | Rondas alcanzadas | 1-∞ |
| `precision` | ducks_hit / ducks_total | 0.0-1.0 |
| `method` | 0=CM, 1=LCG | binario |

### Coeficientes (ejemplo)

| Coeficiente | Valor | Interpretación |
|-------------|-------|----------------|
| β₀ (intercept) | ~86 | Score base |
| β₁ (round) | ~68 | +68 puntos por ronda |
| β₂ (precision) | ~20 | +20 puntos por 100% precisión |
| β₃ (method) | ~-82 | LCG genera ~82 puntos menos |

## 📡 Endpoints

### Health Check
```http
GET /api/health
```

### Información del Modelo
```http
GET /api/model/info
```

Response:
```json
{
  "trained": true,
  "model_type": "Regresión Lineal Múltiple",
  "formula": "score = β₀ + β₁·round + β₂·precision + β₃·method",
  "coefficients": {
    "intercept": 86.08,
    "round": 68.31,
    "precision": 19.82,
    "method_lcg": -81.71
  },
  "interpretation": {
    "intercept": "Score base: 86.1 puntos",
    "round": "Cada ronda adicional: +68.3 puntos",
    "precision": "Precisión perfecta (100%): +19.8 puntos",
    "method": "Usar LCG vs CM: -81.7 puntos"
  },
  "metrics": {
    "r2_train": 0.627,
    "r2_test": 0.940,
    "mae": 70.22,
    "rmse": 97.88
  },
  "training_info": {
    "data_count": 44,
    "last_trained": "2026-04-19T20:54:06"
  }
}
```

### Predecir Score
```http
POST /api/model/predict
Content-Type: application/json

{
  "round": 10,
  "precision": 0.7,
  "method": "lcg"
}
```

Response:
```json
{
  "predicted_score": 701,
  "inputs": {
    "round": 10,
    "precision": 0.7,
    "method": "lcg"
  },
  "breakdown": {
    "base": 86.1,
    "from_rounds": 683.1,
    "from_precision": 13.9,
    "from_method": -81.7
  },
  "confidence": {
    "mae": 70.22,
    "range": "±70 puntos aprox."
  }
}
```

### Re-entrenar Modelo
```http
POST /api/model/retrain
```

Re-entrena el modelo con todos los datos actuales (seed_data + scores reales).

Response:
```json
{
  "success": true,
  "message": "Modelo entrenado con 50 registros",
  "metrics": {
    "r2": 0.94,
    "mae": 68.5,
    "data_count": 50
  }
}
```

### Estadísticas Descriptivas
```http
GET /api/stats
```

Response:
```json
{
  "total_records": 45,
  "valid_records": 44,
  "score": {
    "count": 44,
    "mean": 603.57,
    "std": 391.61,
    "min": 0,
    "max": 1589,
    "median": 555
  },
  "by_method": {
    "lcg": {
      "count": 22,
      "avg_score": 674.7,
      "avg_round": 9.7
    },
    "cm": {
      "count": 22,
      "avg_score": 532.4,
      "avg_round": 6.6
    }
  }
}
```

### Comparación LCG vs CM
```http
GET /api/compare-methods
```

Realiza un **t-test independiente** para comparar estadísticamente ambos métodos.

Response:
```json
{
  "lcg": {
    "count": 22,
    "mean": 674.7,
    "std": 312.5
  },
  "cm": {
    "count": 22,
    "mean": 532.4,
    "std": 285.3
  },
  "statistical_test": {
    "test": "t-test independiente",
    "t_statistic": 1.52,
    "p_value": 0.135,
    "significant": false,
    "cohens_d": 0.47,
    "effect_size": "pequeño"
  },
  "conclusion": "No hay diferencia significativa entre métodos (p=0.135)"
}
```

## 📊 Métricas del Modelo

| Métrica | Descripción | Ideal |
|---------|-------------|-------|
| **R²** | Varianza explicada | > 0.8 |
| **MAE** | Error Absoluto Medio | Menor es mejor |
| **RMSE** | Raíz Error Cuadrático Medio | Menor es mejor |

### Interpretación de R²

- **R² = 0.94** → El modelo explica 94% de la variación en scores
- El 6% restante son factores no capturados (suerte, skill del jugador, etc.)

## 🔄 Flujo de Datos

```
seed_data.json ─┬─→ train_model() ─→ Modelo Entrenado
                │
scores.json ────┘
                    ↓
                Predicciones
                Estadísticas
                Comparaciones
```

## 💡 ¿Por qué Regresión Lineal?

1. **Interpretable**: Los coeficientes tienen significado directo
2. **Datos pequeños**: Funciona bien con ~30-50 registros
3. **Sin overfitting**: Modelo simple = generaliza bien
4. **Rápido**: Entrena en milisegundos

## 🧪 Ejemplo de Uso

```bash
# Ver info del modelo
curl http://localhost:3002/api/model/info

# Predecir score para ronda 15, 80% precisión, CM
curl -X POST http://localhost:3002/api/model/predict \
  -H "Content-Type: application/json" \
  -d '{"round": 15, "precision": 0.8, "method": "cm"}'

# Re-entrenar después de nuevos juegos
curl -X POST http://localhost:3002/api/model/retrain
```

## 🔗 Código Fuente

Ver implementación completa en: `services/analytics.py`
