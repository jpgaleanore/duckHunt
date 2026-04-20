# 🎲 Servicio randompro

Microservicio REST que expone la librería **randompro** de Python para generar números pseudoaleatorios usando algoritmos clásicos.

## 📍 Información

| Propiedad | Valor |
|-----------|-------|
| **Puerto** | 3000 |
| **Archivo** | `services/rng_service.py` |
| **Dependencias** | Flask, Flask-CORS, randompro |

## 🔧 Algoritmos Disponibles

### 1. Congruencia Lineal (LCG)

```
Xₙ₊₁ = (a·Xₙ + c) mod m
```

- **a** = 1103515245 (multiplicador)
- **c** = 12345 (incremento)  
- **m** = 2³¹ (módulo)

Características:
- Período largo (2³¹)
- Rápido y eficiente
- Buena distribución uniforme

### 2. Cuadrado Medio (CM)

```
1. Elevar al cuadrado el número actual
2. Extraer los dígitos centrales
3. Repetir
```

Características:
- Método histórico (von Neumann, 1946)
- Período más corto
- Puede caer en ciclos degenerados

## 📡 Endpoints

### Health Check
```http
GET /api/health
```

Response:
```json
{
  "status": "ok",
  "service": "randompro"
}
```

### Crear Generador
```http
POST /api/randompro/create
Content-Type: application/json

{
  "method": "lcg",    // "lcg" o "cm"
  "seed": 12345       // Opcional, default: timestamp
}
```

Response:
```json
{
  "session_id": "uuid-string",
  "method": "lcg",
  "seed": 12345,
  "state": 12345
}
```

### Obtener Número Aleatorio
```http
GET /api/randompro/random/:session_id
```

Response:
```json
{
  "value": 0.7234521,
  "state": 987654321,
  "calls": 1
}
```

### Obtener Entero en Rango
```http
GET /api/randompro/randint/:session_id?a=0&b=100
```

Response:
```json
{
  "value": 42,
  "a": 0,
  "b": 100,
  "calls": 2
}
```

### Obtener Múltiples Números
```http
GET /api/randompro/sample/:session_id?n=10
```

Response:
```json
{
  "values": [0.123, 0.456, 0.789, ...],
  "count": 10,
  "calls": 12
}
```

### Ver Estado Actual
```http
GET /api/randompro/state/:session_id
```

Response:
```json
{
  "method": "lcg",
  "state": 987654321,
  "seed_original": 12345,
  "calls": 12
}
```

### Eliminar Sesión
```http
DELETE /api/randompro/delete/:session_id
```

## 🎮 Uso en el Juego

El juego utiliza este servicio para generar:

1. **Posición inicial** del pato (x, y)
2. **Velocidad** del pato
3. **Tamaño** del pato
4. **Frecuencia de onda** del movimiento
5. **Dirección** (izquierda ↔ derecha)

Cada pato consume ~7 números aleatorios del generador.

## 🧪 Ejemplo de Uso

```bash
# Crear generador LCG
curl -X POST http://localhost:3000/api/randompro/create \
  -H "Content-Type: application/json" \
  -d '{"method": "lcg", "seed": 42}'

# Obtener 10 números
curl http://localhost:3000/api/randompro/sample/{session_id}?n=10
```

## 📊 Comparación de Métodos

| Aspecto | LCG | Cuadrado Medio |
|---------|-----|----------------|
| Velocidad | ⚡ Rápido | ⚡ Rápido |
| Período | ~2³¹ | Variable |
| Distribución | Uniforme | Puede sesgarse |
| Predictibilidad | Conociendo a,c,m | Difícil |

## 🔗 Código Fuente

Ver implementación completa en: `services/rng_service.py`
