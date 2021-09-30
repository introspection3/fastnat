echo "delete dist files"

del /f /s /q "dist\*.*"
pkg --compress Brotli .