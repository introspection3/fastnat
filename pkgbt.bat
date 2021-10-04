echo "delete dist files"

del /f /s /q "dist\*.*"
ncc build client.js  -o dist  && cd /d dist &&  pkg index.js -a 'config/**/*'  