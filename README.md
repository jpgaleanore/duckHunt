# 🦆 Duck Hunt — randompro Edition

Juego de Duck Hunt implementado en HTML5 Canvas que utiliza generadores de números pseudoaleatorios (PRNG) de la librería **randompro** de Python para controlar el comportamiento de los patos.

## 📁 Estructura del Proyecto

```
duckHuntV1/
├── web/                    # Frontend del juego
│   ├── index.html          # Página principal
│   ├── styles.css          # Estilos CSS
│   └── game.js             # Lógica del juego
│
├── services/               # Microservicios Python
│   ├── rng_service.py      # Servicio RNG (puerto 3000)
│   ├── leaderboard.py      # Servicio de scores (puerto 3001)
│   └── analytics.py        # Servicio de predicción (puerto 3002)
│
├── data/                   # Datos persistentes
│   ├── scores.json         # Scores de jugadores
│   ├── seed_data.json      # Datos semilla para el modelo
│   └── model_state.json    # Estado del modelo ML
│
├── docs/                   # Documentación
│   ├── RANDOMPRO.md        # Doc del servicio RNG
│   ├── LEADERBOARD.md      # Doc del servicio de scores
│   └── ANALYTICS.md        # Doc del servicio de predicción
│
├── requirements.txt        # Dependencias Python
├── start_all.sh            # Script para iniciar todos los servicios
└── README.md               # Este archivo
```

## 🚀 Inicio Rápido

### 1. Instalar dependencias

```bash
# Crear entorno virtual
python -m venv .venv
source .venv/bin/activate

# Instalar dependencias
pip install -r requirements.txt
```

### 2. Iniciar servicios

```bash
# Opción A: Iniciar todos los servicios
./start_all.sh

# Opción B: Iniciar individualmente
python services/rng_service.py    # Puerto 3000
python services/leaderboard.py  # Puerto 3001
python services/analytics.py    # Puerto 3002
```

### 3. Abrir el juego

Abrir `web/index.html` en un navegador o usar un servidor local:

```bash
cd web && python -m http.server 8080
```

Luego visitar: http://localhost:8080

## 🎮 Cómo Jugar

1. Ingresa tu nombre
2. Selecciona el método RNG (LCG o CM)
3. Click en **▶ JUGAR**
4. **Click** para disparar a los patos
5. Tienes **3 disparos** por pato
6. Cada **3 patos** se evalúa la ronda
7. Si tu precisión baja del 40% después de la ronda 2 → Game Over

## 🔌 Servicios

| Servicio | Puerto | Descripción |
|----------|--------|-------------|
| **randompro** | 3000 | Genera números aleatorios usando LCG o Cuadrado Medio |
| **leaderboard** | 3001 | Guarda y recupera scores de jugadores |
| **analytics** | 3002 | Modelo de regresión para predecir scores |

Ver documentación detallada en la carpeta `docs/`.

## 📊 Modelo Predictivo

El servicio de analytics utiliza **Regresión Lineal Múltiple** para predecir scores:

```
score = β₀ + β₁·round + β₂·precision + β₃·method
```

Endpoints:
- `GET /api/model/info` — Información del modelo
- `POST /api/model/predict` — Predecir score
- `GET /api/stats` — Estadísticas descriptivas
- `GET /api/compare-methods` — Comparación LCG vs CM

## 🛠 Tecnologías

- **Frontend**: HTML5 Canvas, Vanilla JavaScript, CSS3
- **Backend**: Python 3, Flask, Flask-CORS
- **ML**: scikit-learn, NumPy, SciPy
- **PRNG**: randompro (Congruencia Lineal, Cuadrado Medio)

## 📝 Licencia

MIT
