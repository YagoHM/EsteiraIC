#!/usr/bin/env python3
"""
Servidor de streaming de câmera para PC (versão melhorada)
Suporta múltiplos métodos de streaming para melhor compatibilidade
"""

import cv2
import socket
import threading
import json
import base64
import io
from flask import Flask, Response, jsonify, send_file
from flask_cors import CORS
import paho.mqtt.client as mqtt
import time
import numpy as np
from PIL import Image

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
use_test_image = False
current_frame = None
frame_lock = threading.Lock()

def get_local_ip():
    """Obtém o IP local da máquina na rede"""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

def create_test_image():
    """Cria uma imagem de teste quando não há câmera"""
    img = np.zeros((480, 640, 3), dtype=np.uint8)
    
    # Fundo gradiente animado
    offset = int(time.time() * 50) % 255
    for i in range(480):
        img[i, :] = [(i + offset) % 255, 100, (255 - i + offset) % 255]
    
    # Texto informativo
    font = cv2.FONT_HERSHEY_SIMPLEX
    text = "CAMERA DE TESTE - PC"
    text_size = cv2.getTextSize(text, font, 1, 2)[0]
    x = (640 - text_size[0]) // 2
    y = (480 + text_size[1]) // 2
    
    cv2.putText(img, text, (x, y), font, 1, (255, 255, 255), 2)
    
    # Timestamp
    timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
    cv2.putText(img, timestamp, (10, 30), font, 0.6, (255, 255, 0), 1)
    
    # Indicador animado
    circle_x = int(320 + 200 * np.cos(time.time() * 2))
    circle_y = int(240 + 100 * np.sin(time.time() * 2))
    cv2.circle(img, (circle_x, circle_y), 20, (0, 255, 0), -1)
    
    return img

def init_camera():
    """Inicializa a câmera ou modo de teste"""
    global camera, use_test_image
    
    try:
        # Tenta diferentes índices de câmera
        for i in range(3):
            camera = cv2.VideoCapture(i)
            if camera.isOpened():
                print(f"Câmera encontrada no índice {i}")
                
                # Configurações da câmera
                camera.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
                camera.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
                camera.set(cv2.CAP_PROP_FPS, 30)
                camera.set(cv2.CAP_PROP_BUFFERSIZE, 1)  # Reduz latência
                
                # Testa se consegue capturar um frame
                ret, frame = camera.read()
                if ret:
                    print("Câmera inicializada com sucesso!")
                    use_test_image = False
                    return True
                else:
                    camera.release()
        
        # Se não encontrou câmera, usa imagem de teste
        print("Nenhuma câmera encontrada. Usando imagem de teste.")
        camera = None
        use_test_image = True
        return True
        
    except Exception as e:
        print(f"Erro ao inicializar câmera: {e}")
        use_test_image = True
        return True

def capture_frames():
    """Thread para capturar frames continuamente"""
    global camera, current_frame, streaming_active, use_test_image, frame_lock
    
    while True:
        try:
            if use_test_image:
                # Gera imagem de teste
                frame = create_test_image()
                time.sleep(0.033)  # ~30 FPS
            else:
                # Captura da câmera real
                if camera is None or not camera.isOpened():
                    if not init_camera():
                        time.sleep(1)
                        continue
                
                success, frame = camera.read()
                if not success:
                    print("Erro ao capturar frame. Mudando para imagem de teste.")
                    use_test_image = True
                    if camera:
                        camera.release()
                        camera = None
                    continue
            
            # Atualiza frame atual de forma thread-safe
            with frame_lock:
                current_frame = frame.copy()
                
        except Exception as e:
            print(f"Erro ao capturar frame: {e}")
            time.sleep(0.1)

def generate_mjpeg_stream():
    """Gera stream MJPEG tradicional"""
    global current_frame, frame_lock
    
    while streaming_active:
        try:
            with frame_lock:
                if current_frame is not None:
                    frame = current_frame.copy()
                else:
                    time.sleep(0.033)
                    continue
            
            # Codifica o frame em JPEG
            ret, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
            if not ret:
                continue
                
            frame_bytes = buffer.tobytes()
            
            # Formato MJPEG stream
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n'
                   b'Content-Length: ' + str(len(frame_bytes)).encode() + b'\r\n\r\n' + 
                   frame_bytes + b'\r\n')
                   
        except Exception as e:
            print(f"Erro ao gerar frame MJPEG: {e}")
            time.sleep(0.1)

def get_current_frame_jpeg():
    """Obtém o frame atual como JPEG"""
    global current_frame, frame_lock
    
    with frame_lock:
        if current_frame is not None:
            frame = current_frame.copy()
        else:
            frame = create_test_image()
    
    # Codifica frame em JPEG
    ret, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 90])
    if ret:
        return buffer.tobytes()
    return None

@app.route('/video')
def video_feed():
    """Endpoint para stream MJPEG tradicional"""
    global streaming_active
    streaming_active = True
    return Response(generate_mjpeg_stream(),
                    mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/frame')
def single_frame():
    """Endpoint para frame único (melhor compatibilidade mobile)"""
    frame_data = get_current_frame_jpeg()
    if frame_data:
        return Response(frame_data, mimetype='image/jpeg')
    else:
        return "Erro ao capturar frame", 500

@app.route('/frame_base64')
def frame_base64():
    """Endpoint para frame em base64 (para JavaScript)"""
    frame_data = get_current_frame_jpeg()
    if frame_data:
        b64_data = base64.b64encode(frame_data).decode('utf-8')
        return jsonify({
            "image": f"data:image/jpeg;base64,{b64_data}",
            "timestamp": time.time()
        })
    else:
        return jsonify({"error": "Erro ao capturar frame"}), 500

@app.route('/video_html')
def video_html():
    """HTML otimizado para mobile com múltiplos métodos"""
    html_content = f'''
    <!DOCTYPE html>
    <html>
    <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Camera Stream</title>
        <style>
            body {{
                margin: 0;
                padding: 10px;
                background: #000;
                font-family: Arial, sans-serif;
                color: white;
            }}
            .container {{
                max-width: 100%;
                text-align: center;
            }}
            .video-container {{
                margin: 10px 0;
                border: 2px solid #333;
                border-radius: 8px;
                overflow: hidden;
                background: #111;
            }}
            img {{
                max-width: 100%;
                height: auto;
                display: block;
            }}
            .controls {{
                margin: 20px 0;
            }}
            button {{
                margin: 5px;
                padding: 10px 20px;
                background: #007AFF;
                color: white;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                font-size: 14px;
            }}
            button:hover {{
                background: #0056CC;
            }}
            button:disabled {{
                background: #666;
                cursor: not-allowed;
            }}
            .status {{
                margin: 10px 0;
                padding: 10px;
                background: #333;
                border-radius: 5px;
            }}
            .method-info {{
                font-size: 12px;
                color: #999;
                margin: 5px 0;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <h1>📹 Camera Stream</h1>
            
            <div class="status">
                <div id="status">Iniciando...</div>
                <div class="method-info" id="method-info"></div>
            </div>
            
            <div class="controls">
                <button onclick="useMethod('mjpeg')">MJPEG Stream</button>
                <button onclick="useMethod('refresh')">Auto Refresh</button>
                <button onclick="useMethod('manual')">Manual Refresh</button>
                <button onclick="refreshFrame()" id="refresh-btn">🔄 Atualizar</button>
            </div>
            
            <div class="video-container">
                <img id="video-stream" src="/frame" alt="Camera Stream">
            </div>
            
            <div id="fps-counter" style="font-size: 12px; color: #666;"></div>
        </div>

        <script>
            let currentMethod = 'refresh';
            let refreshInterval = null;
            let frameCount = 0;
            let lastFpsTime = Date.now();
            
            const img = document.getElementById('video-stream');
            const status = document.getElementById('status');
            const methodInfo = document.getElementById('method-info');
            const fpsCounter = document.getElementById('fps-counter');
            const refreshBtn = document.getElementById('refresh-btn');
            
            function updateFPS() {{
                frameCount++;
                const now = Date.now();
                if (now - lastFpsTime >= 1000) {{
                    const fps = Math.round(frameCount * 1000 / (now - lastFpsTime));
                    fpsCounter.textContent = `FPS: ${{fps}}`;
                    frameCount = 0;
                    lastFpsTime = now;
                }}
            }}
            
            function useMethod(method) {{
                currentMethod = method;
                clearInterval(refreshInterval);
                refreshInterval = null;
                
                switch(method) {{
                    case 'mjpeg':
                        img.src = '/video?' + Date.now();
                        methodInfo.textContent = 'Método: MJPEG Stream (tradicional)';
                        refreshBtn.disabled = true;
                        status.textContent = 'MJPEG Stream ativo';
                        break;
                        
                    case 'refresh':
                        startAutoRefresh();
                        methodInfo.textContent = 'Método: Auto Refresh (compatível)';
                        refreshBtn.disabled = false;
                        status.textContent = 'Auto refresh ativo (10 FPS)';
                        break;
                        
                    case 'manual':
                        img.src = '/frame?' + Date.now();
                        methodInfo.textContent = 'Método: Manual (clique para atualizar)';
                        refreshBtn.disabled = false;
                        status.textContent = 'Modo manual - clique para atualizar';
                        break;
                }}
            }}
            
            function startAutoRefresh() {{
                refreshInterval = setInterval(() => {{
                    refreshFrame();
                }}, 100); // 10 FPS
            }}
            
            function refreshFrame() {{
                if (currentMethod === 'mjpeg') return;
                
                const timestamp = Date.now();
                img.src = '/frame?t=' + timestamp;
                updateFPS();
            }}
            
            // Event listeners
            img.onload = function() {{
                if (currentMethod !== 'mjpeg') {{
                    status.textContent = 'Frame carregado com sucesso';
                }}
            }};
            
            img.onerror = function() {{
                status.textContent = 'Erro ao carregar frame';
                console.error('Erro ao carregar imagem');
            }};
            
            // Inicia com método auto refresh (mais compatível)
            useMethod('refresh');
            
            // Log para debug
            console.log('Player HTML carregado');
        </script>
    </body>
    </html>
    '''
    return html_content

@app.route('/status')
def status():
    """Endpoint para verificar status do servidor"""
    return jsonify({
        "status": "online",
        "camera": not use_test_image,
        "test_mode": use_test_image,
        "ip": get_local_ip(),
        "port": 5000,
        "methods": ["video", "frame", "frame_base64", "video_html"],
        "streaming_active": streaming_active
    })

@app.route('/toggle_test')
def toggle_test():
    """Alterna entre câmera real e imagem de teste"""
    global use_test_image, camera
    
    use_test_image = not use_test_image
    
    if use_test_image and camera:
        camera.release()
        camera = None
    elif not use_test_image:
        init_camera()
    
    return jsonify({
        "test_mode": use_test_image,
        "message": "Modo de teste " + ("ativado" if use_test_image else "desativado")
    })

@app.route('/stop')
def stop_streaming():
    """Para o streaming"""
    global streaming_active
    streaming_active = False
    return jsonify({"message": "Streaming parado"})

@app.route('/start')
def start_streaming():
    """Inicia o streaming"""
    global streaming_active
    streaming_active = True
    return jsonify({"message": "Streaming iniciado"})

@app.route('/')
def index():
    """Página inicial com links"""
    return f'''
    <html>
    <head>
        <title>Servidor de Camera</title>
        <style>
            body {{ font-family: Arial, sans-serif; margin: 40px; }}
            .endpoint {{ margin: 10px 0; padding: 10px; background: #f5f5f5; border-radius: 5px; }}
            .endpoint a {{ text-decoration: none; color: #007AFF; font-weight: bold; }}
            .endpoint a:hover {{ text-decoration: underline; }}
        </style>
    </head>
    <body>
        <h1>🎥 Servidor de Camera - {get_local_ip()}:5000</h1>
        
        <h2>📺 Visualização:</h2>
        <div class="endpoint">
            <a href="/video_html">📱 Player Otimizado (Recomendado)</a> - Interface HTML com múltiplos métodos
        </div>
        
        <h2>🔗 Endpoints para Apps:</h2>
        <div class="endpoint">
            <a href="/video">/video</a> - Stream MJPEG tradicional
        </div>
        <div class="endpoint">
            <a href="/frame">/frame</a> - Frame único (melhor para mobile)
        </div>
        <div class="endpoint">
            <a href="/frame_base64">/frame_base64</a> - Frame em base64 JSON
        </div>
        
        <h2>⚙️ Controle:</h2>
        <div class="endpoint">
            <a href="/status">/status</a> - Status do servidor
        </div>
        <div class="endpoint">
            <a href="/toggle_test">/toggle_test</a> - Alternar modo teste
        </div>
        <div class="endpoint">
            <a href="/stop">/stop</a> - Parar streaming
        </div>
        <div class="endpoint">
            <a href="/start">/start</a> - Iniciar streaming
        </div>
        
        <hr>
        <p><strong>💡 Dicas:</strong></p>
        <ul>
            <li>Use <strong>/video_html</strong> para visualização direta no navegador</li>
            <li>Use <strong>/frame</strong> para apps mobile (melhor compatibilidade)</li>
            <li>Use <strong>/video</strong> para apps desktop ou streaming tradicional</li>
        </ul>
    </body>
    </html>
    '''

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
    print("=== Servidor de Câmera PC (Versão Melhorada) ===")
    print(f"IP Local: {get_local_ip()}")
    
    # Inicializa câmera
    init_camera()
    
    # Inicia thread de captura contínua
    capture_thread = threading.Thread(target=capture_frames, daemon=True)
    capture_thread.start()
    
    # Conecta ao MQTT
    mqtt_client = setup_mqtt()
    
    try:
        # Inicia o servidor Flask
        print("Iniciando servidor na porta 5000...")
        print(f"Acesso direto: http://{get_local_ip()}:5000")
        print(f"Player otimizado: http://{get_local_ip()}:5000/video_html")
        print("\nEndpoints disponíveis:")
        print("  / - Página inicial com todos os links")
        print("  /video_html - Player HTML otimizado para mobile")
        print("  /video - Stream MJPEG tradicional")
        print("  /frame - Frame único (recomendado para apps)")
        print("  /frame_base64 - Frame em base64 JSON")
        print("  /status - Status do servidor")
        print("  /toggle_test - Alternar modo teste")
        print("  /start - Iniciar streaming")
        print("  /stop - Parar streaming")
        
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