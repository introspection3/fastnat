echo "delete dist files"

del /f /s /q "dist\*.*"
 pkg . --no-bytecode --public-packages "*" --public