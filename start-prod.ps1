# Compila y arranca la app en modo producción.
# Doble click (o clic derecho > "Ejecutar con PowerShell") para lanzarla.
# La ventana se queda abierta mostrando los logs; al cerrarla se detiene el servidor.

$Host.UI.RawUI.WindowTitle = "Fish Audio Frontend - Producción"

# Sitúa el script en la carpeta del proyecto sin importar desde dónde se lance
Set-Location -Path $PSScriptRoot

try {
    Write-Host "==> Compilando y arrancando en modo producción..." -ForegroundColor Cyan
    pnpm run start
}
catch {
    Write-Host "`nOcurrió un error al arrancar la aplicación:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}
finally {
    Write-Host "`nEl servidor se ha detenido. Cierra esta ventana para salir." -ForegroundColor Yellow
    Read-Host "Pulsa Enter para cerrar"
}
