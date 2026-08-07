#!/usr/bin/env bash
# Compila y arranca la app en modo producción.
# Doble click (con el gestor de archivos configurado para ejecutar) o "./start-prod.sh" para lanzarla.
# La terminal se queda abierta mostrando los logs; al cerrarla se detiene el servidor.

set -uo pipefail

# Sitúa el script en la carpeta del proyecto sin importar desde dónde se lance
cd "$(dirname "${BASH_SOURCE[0]}")"

echo -e "\e[36m==> Compilando y arrancando en modo producción...\e[0m"
pnpm run start
status=$?

if [ $status -ne 0 ]; then
    echo -e "\e[31m\nOcurrió un error al arrancar la aplicación (código $status).\e[0m"
else
    echo -e "\e[33m\nEl servidor se ha detenido.\e[0m"
fi

read -rp "Pulsa Enter para cerrar"
