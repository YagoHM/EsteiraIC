#!/usr/bin/env python3
"""
Servidor de streaming de câmera para Raspberry Pi
Envia o IP automaticamente via MQTT quando iniciado
"""

import cv2
import socket
import threading
import json
from flask import Flask, Response, jsonify
from flask_cors import CORS
import paho.mqtt.client as mqtt
import time

app = Flask(__name__)
CORS(app)

# Configurações MQTT
MQTT_BROKER = "f36a296472af4ff7bc783d027dcf8cb2.s1.eu.hivemq.cloud"
MQTT_PORT = 8883
MQTT_USER = "yago_ic"
MQTT_PASS = "brokerP&x+e[5&ifZ_R}T"
MQTT_TOPIC_IP = "ngrok/ip"
MQTT_TOPIC_REFRESH = "ngrok/refresh"

# Configurações da câmera
camera = None
streaming_active = False

def get_local_ip():
    """Obtém o IP local da máquina na rede"""
    try:
        # Conecta a um endereço externo para descobrir o IP local
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

def init_camera():
    """Inicializa a câmera"""
    global camera
    try:
        # Para Raspberry Pi, geralmente é 0
        camera = cv2.VideoCapture(0)
        
        # Configurações da câmera
        camera.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        camera.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        camera.set(cv2.CAP_PROP_FPS, 30)
        
        # Verifica se a câmera foi inicializada
        if not camera.isOpened():
            print("Erro: Não foi possível abrir a câmera")
            return False
            
        print("Câmera inicializada com sucesso!")
        return True
    except Exception as e:
        print(f"Erro ao inicializar câmera: {e}")
        return False

def generate_frames():
    """Gera frames da câmera em formato MJPEG"""
    global camera, streaming_active
    
    while streaming_active:
        if camera is None:
            if not init_camera():
                time.sleep(1)
                continue
        
        try:
            success, frame = camera.read()
            if not success:
                print("Erro ao capturar frame da câmera")
                time.sleep(0.1)
                continue
            
            # Codifica o frame em JPEG
            ret, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
            if not ret:
                continue
                
            frame_bytes = buffer.tobytes()
            
            # Formato MJPEG stream
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
                   
        except Exception as e:
            print(f"Erro ao gerar frame: {e}")
            time.sleep(0.1)

@app.route('/video')
def video_feed():
    """Endpoint para stream de vídeo"""
    global streaming_active
    streaming_active = True
    return Response(generate_frames(),
                    mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/status')
def status():
    """Endpoint para verificar status do servidor"""
    return jsonify({
        "status": "online",
        "camera": camera is not None and camera.isOpened(),
        "ip": get_local_ip(),
        "port": 5000
    })

@app.route('/stop')
def stop_streaming():
    """Para o streaming (para economizar recursos)"""
    global streaming_active
    streaming_active = False
    return jsonify({"message": "Streaming parado"})

def setup_mqtt():
    """Configura e conecta ao MQTT"""
    def on_connect(client, userdata, flags, rc):
        if rc == 0:
            print("Conectado ao MQTT broker!")
            client.subscribe(MQTT_TOPIC_REFRESH)
            # Envia IP automaticamente ao conectar
            send_ip_via_mqtt(client)
        else:
            print(f"Falha ao conectar ao MQTT. Código: {rc}")

    def on_message(client, userdata, msg):
        message = msg.payload.decode()
        print(f"Mensagem recebida no tópico {msg.topic}: {message}")
        
        # Se receber comando de refresh, reenvia o IP
        if msg.topic == MQTT_TOPIC_REFRESH and message == "Refresh":
            send_ip_via_mqtt(client)

    def send_ip_via_mqtt(client):
        """Envia o IP do servidor via MQTT"""
        local_ip = get_local_ip()
        server_url = f"http://{local_ip}:5000"
        
        try:
            client.publish(MQTT_TOPIC_IP, server_url)
            print(f"IP enviado via MQTT: {server_url}")
        except Exception as e:
            print(f"Erro ao enviar IP via MQTT: {e}")

    # Configurar cliente MQTT
    mqtt_client = mqtt.Client()
    mqtt_client.username_pw_set(MQTT_USER, MQTT_PASS)
    mqtt_client.tls_set()  # SSL/TLS
    mqtt_client.on_connect = on_connect
    mqtt_client.on_message = on_message

    try:
        mqtt_client.connect(MQTT_BROKER, MQTT_PORT, 60)
        mqtt_client.loop_start()
        return mqtt_client
    except Exception as e:
        print(f"Erro ao conectar MQTT: {e}")
        return None

def cleanup():
    """Limpeza de recursos ao encerrar"""
    global camera, streaming_active
    streaming_active = False
    if camera:
        camera.release()
    cv2.destroyAllWindows()

if __name__ == '__main__':
    print("=== Servidor de Câmera Raspberry Pi ===")
    print(f"IP Local: {get_local_ip()}")
    
    # Inicializa câmera
    if not init_camera():
        print("AVISO: Câmera não inicializada. Verifique a conexão.")
    
    # Conecta ao MQTT
    mqtt_client = setup_mqtt()
    
    try:
        # Inicia o servidor Flask
        print("Iniciando servidor na porta 5000...")
        print(f"Acesso local: http://{get_local_ip()}:5000/video")
        
        app.run(
            host='0.0.0.0',  # Permite acesso de qualquer IP na rede
            port=5000,
            debug=False,
            threaded=True
        )
        
    except KeyboardInterrupt:
        print("\nEncerrando servidor...")
    finally:
        cleanup()
        if mqtt_client:
            mqtt_client.loop_stop()
            mqtt_client.disconnect()