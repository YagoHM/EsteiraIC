:: Inicia o servidor Flask - Enviar imagens local e depois passa pro ngrok
start "" python server.py

:: Espera o servidor iniciar
timeout /t 10 /nobreak > nul

:: Configura o ngrok
start "" ngrok.exe config add-authtoken 2wNhqWx8JwAhD4O1nxxqJVvtpEB_prCM4myKWKcHd8rpjXmX

:: Abre o túnel
start "" ngrok.exe http 5000

:: Espera o túnel estar pronto
timeout /t 15 /nobreak > nul

:: Envia a info via MQTT
start "" python enviar_info.py

endlocal
pause
