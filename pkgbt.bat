echo "delete dist files"  
echo   %cd%
del /f /s /q "dist\*.*"  &&  ncc build client.js  -o dist    && cd /d dist  &&  pkg index.js   && pkg -t node14-linux-arm64 index.js --no-bytecode --public-packages "*" --public --output "fastnat-linux-arm"  && del /f /s /q "F:\nodeprjs\fastnat\dist\index.js"