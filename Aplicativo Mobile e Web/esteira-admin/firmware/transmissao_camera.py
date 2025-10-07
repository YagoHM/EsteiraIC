import cv2
import numpy as np
import socket
import time
import ssl
from flask import Flask, Response
import paho.mqtt.client as mqtt

# ==============================
# MQTT CONFIGURAÇÃO
# ==============================
MQTT_BROKER = "f36a296472af4ff7bc783d027dcf8cb2.s1.eu.hivemq.cloud"
MQTT_PORT = 8884
MQTT_USER = "yago_ic"
MQTT_PASSWORD = "brokerP&x+e[5&ifZ_R}T"
MQTT_TOPIC = "dados/camera"

# Callback quando conecta
def on_connect(client, userdata, flags, rc):
    print(f"[MQTT] Conectado com código {rc}")

# Cria cliente MQTT via WebSocket seguro
client = mqtt.Client(transport="websockets")
client.username_pw_set(MQTT_USER, MQTT_PASSWORD)
client.tls_set(cert_reqs=ssl.CERT_NONE)  # ignora verificação do certificado
client.on_connect = on_connect
client.connect(MQTT_BROKER, MQTT_PORT)
client.loop_start()

# ==============================
# DETECTA PRIMEIRA CÂMERA
# ==============================
def detect_camera(max_cameras=10):
    for i in range(max_cameras):
        cap = cv2.VideoCapture(i)
        if cap.isOpened():
            ret, _ = cap.read()
            if ret:
                return i
        cap.release()
    return None

camera_index = detect_camera()
if camera_index is None:
    print("❌ Nenhuma câmera detectada")
    exit(1)

cap_normal = cv2.VideoCapture(camera_index)
cap_lego = cv2.VideoCapture(camera_index)

# ==============================
# IP LOCAL
# ==============================
def get_local_ip():
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
# FUNÇÃO PARA RESPONDER COM IP
# ==============================
SOLICITAR_IP_TOPIC = "dados/solicitar_ip"
ENVIAR_IP_TOPIC = "dados/enviar_ip"

def on_message(client, userdata, msg):
    topic = msg.topic
    payload = msg.payload.decode()
    print(f"[MQTT] Mensagem recebida: {topic} -> {payload}")

    if topic == SOLICITAR_IP_TOPIC:
        ip = get_local_ip()
        msg_to_send = f"http://{ip}:5000"
        client.publish(ENVIAR_IP_TOPIC, msg_to_send)
        print(f"[MQTT] Enviando IP: {msg_to_send}")

# Registra callback
client.on_message = on_message
client.subscribe(SOLICITAR_IP_TOPIC)

# ==============================
# STREAM NORMAL
# ==============================
def generate_normal():
    while True:
        ret, frame = cap_normal.read()
        if not ret:
            continue
        ret, buffer = cv2.imencode(".jpg", frame)
        frame_bytes = buffer.tobytes()
        yield (b"--frame\r\n"
               b"Content-Type: image/jpeg\r\n\r\n" + frame_bytes + b"\r\n")

# ==============================
# STREAM LEGO (detecção de cores)
# ==============================
def generate_lego_colors():
    while True:
        ret, frame = cap_lego.read()
        if not ret:
            continue

        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)

        # cores de LEGO em HSV
        colors = {
            "Cor:Vermelho": ([0, 100, 100], [10, 255, 255]),
            "Cor:Azul": ([100, 150, 0], [140, 255, 255]),
            "Cor:Amarelo": ([20, 100, 100], [30, 255, 255]),
            "Cor:Verde": ([40, 50, 50], [90, 255, 255])
        }

        detected_colors = []

        for color_name, (lower, upper) in colors.items():
            lower = np.array(lower)
            upper = np.array(upper)
            mask = cv2.inRange(hsv, lower, upper)
            contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

            for cnt in contours:
                area = cv2.contourArea(cnt)
                if area > 500:  # ignora ruídos
                    (x, y), radius = cv2.minEnclosingCircle(cnt)
                    center = (int(x), int(y))
                    radius = int(radius)
                    cv2.circle(frame, center, radius, (0, 0, 255), 2)
                    cv2.putText(frame, color_name, (center[0]-20, center[1]-20),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)
                    detected_colors.append(color_name)

        # envia cores detectadas por MQTT
        if detected_colors:
            msg = ",".join(detected_colors)
            client.publish(MQTT_TOPIC, msg)

        ret, buffer = cv2.imencode(".jpg", frame)
        frame_bytes = buffer.tobytes()
        yield (b"--frame\r\n"
               b"Content-Type: image/jpeg\r\n\r\n" + frame_bytes + b"\r\n")

# ==============================
# FLASK ENDPOINTS
# ==============================
app = Flask(__name__)

@app.route("/camera_normal")
def camera_normal():
    return Response(generate_normal(), mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route("/camera_ia")
def camera_lego():
    return Response(generate_lego_colors(), mimetype='multipart/x-mixed-replace; boundary=frame')

# ==============================
# RODA SERVIDOR
# ==============================
if __name__ == "__main__":
    ip = get_local_ip()
    print(f"Acessar câmera normal: http://{ip}:5000/camera_normal")
    print(f"Acessar câmera LEGO: http://{ip}:5000/camera_ia")
    app.run(host="0.0.0.0", port=5000)
