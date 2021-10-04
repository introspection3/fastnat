echo "delete dist files"  
echo   %cd%
del /f /s /q "dist\*.*"  &&  ncc build client.js  -o dist    && cd /d dist  &&  pkg index.js -a 'config/**/*'  && del /f /s /q "F:\nodeprjs\fastnat\dist\index.js"