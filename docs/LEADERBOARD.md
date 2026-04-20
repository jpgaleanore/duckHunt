# 🏆 Servicio Leaderboard

Microservicio REST para gestionar el ranking de jugadores, guardando y recuperando scores de forma persistente.

## 📍 Información

| Propiedad | Valor |
|-----------|-------|
| **Puerto** | 3001 |
| **Archivo** | `services/leaderboard.py` |
| **Persistencia** | `data/scores.json` |
| **Dependencias** | Flask, Flask-CORS |

## 📡 Endpoints

### Health Check
```http
GET /api/health
```

Response:
```json
{
  "status": "ok",
  "service": "leaderboard"
}
```

### Obtener Ranking
```http
GET /api/leaderboard?limit=10
```

Parámetros:
- `limit` (opcional): Número máximo de resultados. Default: 10

Response:
```json
{
  "leaderboard": [
    {
      "name": "player1",
      "score": 1200,
      "round": 15,
      "ducks_hit": 20,
      "ducks_total": 30,
      "method": "lcg",
      "rng_calls": 210,
      "date": "2026-04-19T16:45:48.968390"
    },
    ...
  ],
  "total": 10
}
```

### Agregar Score
```http
POST /api/leaderboard
Content-Type: application/json

{
  "name": "hunter",
  "score": 850,
  "round": 12,
  "ducks_hit": 15,
  "ducks_total": 24,
  "method": "lcg",
  "rng_calls": 168
}
```

Response:
```json
{
  "success": true,
  "rank": 3,
  "message": "Score guardado"
}
```

### Limpiar Ranking
```http
DELETE /api/leaderboard/clear
```

Response:
```json
{
  "success": true,
  "message": "Leaderboard limpiado"
}
```

## 📊 Estructura de Datos

Cada entrada del leaderboard contiene:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `name` | string | Nombre del jugador |
| `score` | int | Puntaje final |
| `round` | int | Rondas completadas |
| `ducks_hit` | int | Patos cazados |
| `ducks_total` | int | Patos totales |
| `method` | string | "lcg" o "cm" |
| `rng_calls` | int | Llamadas al RNG |
| `date` | string | Fecha ISO 8601 |

## 💾 Persistencia

Los scores se guardan en `data/scores.json`:

```json
[
  {
    "name": "alice",
    "score": 850,
    "round": 12,
    "ducks_hit": 15,
    "ducks_total": 24,
    "method": "lcg",
    "rng_calls": 168,
    "date": "2026-04-19T16:45:48.968390"
  }
]
```

El archivo se actualiza automáticamente después de cada nuevo score.

## 🎮 Integración con el Juego

El juego envía automáticamente el score al servidor cuando termina la partida:

1. **Game Over** → Se capturan las estadísticas
2. **POST /api/leaderboard** → Se envía el score
3. **Response** → Se muestra el rank del jugador
4. **GET /api/leaderboard** → Se actualiza la tabla de posiciones

## 🔗 Ordenamiento

Los scores se ordenan por:
1. **Score** (descendente)
2. **Fecha** (más reciente primero, en caso de empate)

## 🧪 Ejemplo de Uso

```bash
# Agregar un score
curl -X POST http://localhost:3001/api/leaderboard \
  -H "Content-Type: application/json" \
  -d '{"name":"TestPlayer","score":1500,"round":10,"method":"lcg"}'

# Ver top 5
curl http://localhost:3001/api/leaderboard?limit=5
```

## 🔗 Código Fuente

Ver implementación completa en: `services/leaderboard.py`
