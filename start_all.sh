#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  Duck Hunt - Start All Services
# ═══════════════════════════════════════════════════════════════

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Directorio base
BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_PATH="${BASE_DIR}/../.venv/bin/python"

# Si no existe el venv en ../, buscar en el directorio actual
if [ ! -f "$VENV_PATH" ]; then
    VENV_PATH="${BASE_DIR}/.venv/bin/python"
fi

# Si aún no existe, usar python del sistema
if [ ! -f "$VENV_PATH" ]; then
    VENV_PATH="python3"
fi

echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  🦆 Duck Hunt - Iniciando Servicios${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# Función para matar proceso en puerto
kill_port() {
    lsof -ti:$1 | xargs kill -9 2>/dev/null
}

# Función para iniciar servicio
start_service() {
    local name=$1
    local port=$2
    local script=$3
    
    echo -e "${YELLOW}▶ Iniciando $name en puerto $port...${NC}"
    kill_port $port
    $VENV_PATH "${BASE_DIR}/services/${script}" &
    sleep 1
    
    # Verificar si está corriendo
    if lsof -ti:$port > /dev/null 2>&1; then
        echo -e "${GREEN}✓ $name corriendo en http://localhost:$port${NC}"
    else
        echo -e "${RED}✗ Error iniciando $name${NC}"
    fi
}

# Matar servicios anteriores
echo -e "${YELLOW}Deteniendo servicios anteriores...${NC}"
kill_port 3000
kill_port 3001
kill_port 3002
echo ""

# Iniciar servicios
start_service "randompro" 3000 "rng_service.py"
start_service "leaderboard" 3001 "leaderboard.py"
start_service "analytics" 3002 "analytics.py"

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✓ Todos los servicios iniciados${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  Servicios:"
echo -e "    • randompro:   ${YELLOW}http://localhost:3000${NC}"
echo -e "    • leaderboard: ${YELLOW}http://localhost:3001${NC}"
echo -e "    • analytics:   ${YELLOW}http://localhost:3002${NC}"
echo ""
echo -e "  Para abrir el juego:"
echo -e "    ${YELLOW}cd web && python3 -m http.server 8080${NC}"
echo -e "    Luego visita: ${YELLOW}http://localhost:8080${NC}"
echo ""
echo -e "  Presiona ${RED}Ctrl+C${NC} para detener todos los servicios"
echo ""

# Esperar a que el usuario cancele
wait
