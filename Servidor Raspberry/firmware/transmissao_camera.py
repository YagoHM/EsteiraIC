import cv2
import numpy as np
import socket
import ssl
import threading
import time
from flask import Flask, Response
import paho.mqtt.client as mqtt

# ==============================
# CONFIGURAÇÕES
# ==============================
MQTT_BROKER = "f36a296472af4ff7bc783d027dcf8cb2.s1.eu.hivemq.cloud"
MQTT_PORT = 8883  # Porta TCP/TLS padrão
MQTT_USER = "yago_ic"
MQTT_PASSWORD = "brokerP&x+e[5&ifZ_R}T"
MQTT_TOPIC = "dados/camera"
SOLICITAR_IP_TOPIC = "dados/solicitar_ip"
ENVIAR_IP_TOPIC = "dados/enviar_ip"

# Configurações de performance
RESOLUTION_WIDTH = 640
RESOLUTION_HEIGHT = 480
FPS_TARGET = 15
MQTT_SEND_INTERVAL = 0.5

# ==============================
# MQTT SETUP
# ==============================
class MQTTHandler:
    def __init__(self):
        self.client = mqtt.Client(client_id="camera_python", clean_session=True)
        self.client.username_pw_set(MQTT_USER, MQTT_PASSWORD)
        self.client.tls_set(cert_reqs=ssl.CERT_NONE, tls_version=ssl.PROTOCOL_TLS)
        self.client.tls_insecure_set(True)
        self.client.on_connect = self.on_connect
        self.client.on_message = self.on_message
        self.client.on_disconnect = self.on_disconnect
        self.last_colors = []
        self.last_send_time = 0
        self.connected = False
        self.local_ip = ""
        
    def on_connect(self, client, userdata, flags, rc):
        if rc == 0:
            print(f"[MQTT] ✓ Conectado com sucesso!")
            self.connected = True
            # Subscreve ao tópico de solicitação de IP
            client.subscribe(SOLICITAR_IP_TOPIC, qos=1)
            print(f"[MQTT] ✓ Inscrito em: {SOLICITAR_IP_TOPIC}")
        else:
            print(f"[MQTT] ✗ Falha na conexão. Código: {rc}")
            self.connected = False
        
    def on_disconnect(self, client, userdata, rc):
        print(f"[MQTT] Desconectado. Código: {rc}")
        self.connected = False
        if rc != 0:
            print("[MQTT] Tentando reconectar...")
            try:
                client.reconnect()
            except Exception as e:
                print(f"[MQTT] Erro ao reconectar: {e}")
        
    def on_message(self, client, userdata, msg):
        topic = msg.topic
        payload = msg.payload.decode('utf-8')
        print(f"\n[MQTT] >>> Mensagem recebida")
        print(f"[MQTT]     Tópico: {topic}")
        print(f"[MQTT]     Payload: {payload}")
        
        if topic == SOLICITAR_IP_TOPIC:
            print(f"[MQTT] >>> Solicitação de IP detectada!")
            ip_response = f"http://{self.local_ip}:5000"
            print(f"[MQTT] >>> Enviando IP: {ip_response}")
            
            # Publica a resposta
            result = client.publish(ENVIAR_IP_TOPIC, ip_response, qos=1)
            
            if result.rc == mqtt.MQTT_ERR_SUCCESS:
                print(f"[MQTT] ✓ IP enviado com sucesso para: {ENVIAR_IP_TOPIC}")
            else:
                print(f"[MQTT] ✗ Erro ao enviar IP. Código: {result.rc}")
    
    def connect(self, local_ip):
        self.local_ip = local_ip
        try:
            print(f"[MQTT] Conectando ao broker: {MQTT_BROKER}:{MQTT_PORT}")
            self.client.connect(MQTT_BROKER, MQTT_PORT, keepalive=60)
            self.client.loop_start()
            
            # Aguarda conexão
            timeout = 10
            start_time = time.time()
            while not self.connected and (time.time() - start_time) < timeout:
                time.sleep(0.1)
            
            if self.connected:
                print("[MQTT] ✓ Conexão estabelecida!")
                return True
            else:
                print("[MQTT] ✗ Timeout na conexão")
                return False
                
        except Exception as e:
            print(f"[MQTT] ✗ Erro ao conectar: {e}")
            return False
    
    def publish_colors(self, colors):
        """Publica cores detectadas com throttling"""
        current_time = time.time()
        if current_time - self.last_send_time >= MQTT_SEND_INTERVAL:
            if colors and colors != self.last_colors:
                try:
                    msg = ",".join(set(colors))
                    result = self.client.publish(MQTT_TOPIC, msg, qos=0)
                    if result.rc == mqtt.MQTT_ERR_SUCCESS:
                        self.last_colors = colors.copy()
                        self.last_send_time = current_time
                except Exception as e:
                    print(f"[MQTT] Erro ao publicar cores: {e}")

# ==============================
# DETECÇÃO DE CÂMERA
# ==============================
def detect_camera(max_cameras=10):
    """Detecta primeira câmera disponível"""
    for i in range(max_cameras):
        cap = cv2.VideoCapture(i)
        if cap.isOpened():
            ret, _ = cap.read()
            cap.release()
            if ret:
                print(f"[CAMERA] Câmera encontrada no índice {i}")
                return i
    return None

def get_local_ip():
    """Obtém IP local da máquina"""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
    except Exception:
        ip = "127.0.0.1"
    finally:
        s.close()
    return ip

# ==============================
# DETECTOR DE CORES LEGO
# ==============================
class LegoColorDetector:
    def __init__(self):
        self.colors = {
            "Vermelho": ([0, 120, 70], [10, 255, 255]),
            "Vermelho2": ([170, 120, 70], [180, 255, 255]),
            "Azul": ([100, 150, 50], [130, 255, 255]),
            "Amarelo": ([20, 100, 100], [35, 255, 255]),
            "Verde": ([35, 50, 50], [85, 255, 255]),
            "Laranja": ([10, 100, 100], [20, 255, 255]),
            "Roxo": ([130, 50, 50], [160, 255, 255])
        }
        
        self.min_area = 400
        self.kernel = np.ones((5, 5), np.uint8)
    
    def detect(self, frame):
        """Detecta cores LEGO no frame"""
        height, width = frame.shape[:2]
        if width > RESOLUTION_WIDTH:
            scale = RESOLUTION_WIDTH / width
            frame = cv2.resize(frame, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
        
        blurred = cv2.GaussianBlur(frame, (5, 5), 0)
        hsv = cv2.cvtColor(blurred, cv2.COLOR_BGR2HSV)
        
        detected_colors = []
        
        for color_name, (lower, upper) in self.colors.items():
            lower = np.array(lower)
            upper = np.array(upper)
            
            mask = cv2.inRange(hsv, lower, upper)
            mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, self.kernel)
            mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, self.kernel)
            
            contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            for cnt in contours:
                area = cv2.contourArea(cnt)
                if area > self.min_area:
                    (x, y), radius = cv2.minEnclosingCircle(cnt)
                    center = (int(x), int(y))
                    radius = int(radius)
                    
                    color_display = color_name.replace("2", "")
                    cv2.circle(frame, center, radius, (0, 255, 0), 2)
                    cv2.putText(frame, color_display, 
                              (center[0] - 30, center[1] - radius - 10),
                              cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
                    
                    detected_colors.append(f"Cor:{color_display}")
        
        return frame, detected_colors

# ==============================
# GERADOR DE STREAM
# ==============================
class CameraStream:
    def __init__(self, camera_index, mqtt_handler):
        self.camera_index = camera_index
        self.mqtt_handler = mqtt_handler
        self.detector = LegoColorDetector()
        self.cap = None
        self.running = False
        
    def start_capture(self):
        """Inicializa captura de vídeo"""
        self.cap = cv2.VideoCapture(self.camera_index)
        
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, RESOLUTION_WIDTH)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, RESOLUTION_HEIGHT)
        self.cap.set(cv2.CAP_PROP_FPS, FPS_TARGET)
        self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        
        if not self.cap.isOpened():
            raise Exception("Erro ao abrir câmera")
        
        self.running = True
        print(f"[CAMERA] Captura iniciada: {RESOLUTION_WIDTH}x{RESOLUTION_HEIGHT} @ {FPS_TARGET}fps")
    
    def generate_frames(self):
        """Gerador de frames para streaming"""
        frame_count = 0
        
        while self.running:
            ret, frame = self.cap.read()
            if not ret:
                print("[CAMERA] Erro ao ler frame")
                time.sleep(0.1)
                continue
            
            processed_frame, detected_colors = self.detector.detect(frame)
            
            frame_count += 1
            cv2.putText(processed_frame, f"FPS: {FPS_TARGET} | Frame: {frame_count}", 
                       (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
            
            if detected_colors:
                self.mqtt_handler.publish_colors(detected_colors)
            
            ret, buffer = cv2.imencode('.jpg', processed_frame, 
                                      [cv2.IMWRITE_JPEG_QUALITY, 85])
            frame_bytes = buffer.tobytes()
            
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
    
    def stop(self):
        """Para captura"""
        self.running = False
        if self.cap:
            self.cap.release()

# ==============================
# FLASK APP
# ==============================
app = Flask(__name__)
mqtt_handler = MQTTHandler()
camera_stream = None

@app.route("/camera_ia")
def camera_ia():
    """Endpoint de streaming com IA"""
    return Response(camera_stream.generate_frames(),
                   mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route("/status")
def status():
    """Endpoint de status do sistema"""
    return {
        "mqtt_connected": mqtt_handler.connected,
        "camera_running": camera_stream.running if camera_stream else False,
        "ip": get_local_ip()
    }

# ==============================
# MAIN
# ==============================
if __name__ == "__main__":
    print("=" * 50)
    print("SISTEMA DE DETECÇÃO LEGO - INICIANDO")
    print("=" * 50)
    
    # Detecta câmera
    camera_index = detect_camera()
    if camera_index is None:
        print("❌ Nenhuma câmera detectada")
        exit(1)
    
    # Obtém IP local
    ip = get_local_ip()
    print(f"\n[SISTEMA] IP Local: {ip}")
    
    # Conecta MQTT
    print("\n[MQTT] Conectando ao broker...")
    if mqtt_handler.connect(ip):
        print("[MQTT] ✓ MQTT conectado e pronto!")
    else:
        print("[MQTT] ⚠️ Falha ao conectar MQTT, continuando sem MQTT")
    
    # Inicializa stream
    camera_stream = CameraStream(camera_index, mqtt_handler)
    camera_stream.start_capture()
    
    # Mostra informações
    print("\n" + "=" * 50)
    print(f"✅ SISTEMA PRONTO!")
    print(f"📹 Acessar câmera IA: http://{ip}:5000/camera_ia")
    print(f"📊 Status do sistema: http://{ip}:5000/status")
    print(f"📡 MQTT Status: {'Conectado' if mqtt_handler.connected else 'Desconectado'}")
    print(f"📡 Aguardando solicitações em: {SOLICITAR_IP_TOPIC}")
    print("=" * 50 + "\n")
    
    try:
        app.run(host="0.0.0.0", port=5000, threaded=True, debug=False)
    except KeyboardInterrupt:
        print("\n[SISTEMA] Encerrando...")
    finally:
        camera_stream.stop()
        mqtt_handler.client.loop_stop()
        cv2.destroyAllWindows()