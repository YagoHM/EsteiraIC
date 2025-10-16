import cv2
import numpy as np
import socket
import ssl
import threading
import time
from flask import Flask, Response, jsonify
from flask_cors import CORS
import paho.mqtt.client as mqtt
import json
from datetime import datetime

# ==============================
# CONFIGURAÇÕES
# ==============================
MQTT_BROKER = "f36a296472af4ff7bc783d027dcf8cb2.s1.eu.hivemq.cloud"
MQTT_PORT = 8883
MQTT_USER = "yago_ic"
MQTT_PASSWORD = "brokerP&x+e[5&ifZ_R}T"
MQTT_TOPIC = "dados/camera"
SOLICITAR_IP_TOPIC = "dados/solicitar_ip"
APP_CONTROL_TOPIC = "dados/app"

# Configurações de performance
RESOLUTION_WIDTH = 640
RESOLUTION_HEIGHT = 480
FPS_TARGET = 15
MQTT_SEND_INTERVAL = 0.5

cores_e_data = "dados.json"

# ==============================
# CONTROLE DE ESTADO GLOBAL
# ==============================
class SystemState:
    """Armazena estado do sistema"""
    def __init__(self):
        self.esteira_ligada = False
        self.cores_detectadas = []
        self.ultima_cor_detectada = None
        self.timestamp_ultima_deteccao = None
        self.ultimo_frame = None
        
    def atualizar_esteira(self, estado):
        """Atualiza estado da esteira (0 ou 1)"""
        self.esteira_ligada = bool(int(estado))
        print(f"[ESTADO] Esteira: {'LIGADA' if self.esteira_ligada else 'DESLIGADA'}")
        
    def adicionar_cor(self, cor):
        """Adiciona cor detectada ao histórico"""
        if cor not in self.cores_detectadas:
            self.cores_detectadas.append(cor)
        self.ultima_cor_detectada = cor
        # self.timestamp_ultima_deteccao = time.time()
        self.timestamp_ultima_deteccao =  datetime.now()
    def get_status(self):
        """Retorna status completo do sistema"""
        return {
            "esteira_ligada": self.esteira_ligada,
            "cores_detectadas": self.cores_detectadas,
            "ultima_cor": self.ultima_cor_detectada,
            "timestamp": self.timestamp_ultima_deteccao
        }

# ==============================
# CONTROLE GPIO (PREPARADO PARA RASPBERRY PI)
# ==============================
class GPIOController:
    """Controle de GPIO para Raspberry Pi"""
    def __init__(self):
        self.gpio_disponivel = False
        self.pinos_configurados = {}
        self._inicializar_gpio()
        
    def _inicializar_gpio(self):
        """Inicializa GPIO se disponível"""
        try:
            # Descomente as linhas abaixo quando estiver no Raspberry Pi
            import RPi.GPIO as GPIO
            GPIO.setmode(GPIO.BCM)
            GPIO.setwarnings(False)
            self.gpio_disponivel = True
            print("[GPIO] GPIO inicializado com sucesso")
            
            # Temporário: modo simulação
            print("[GPIO] Modo simulação (GPIO não disponível)")
            self.gpio_disponivel = False
            
        except Exception as e:
            print(f"[GPIO] GPIO não disponível: {e}")
            self.gpio_disponivel = False
    
    def configurar_pino(self, pino, modo):
        """Configura um pino GPIO
        
        Args:
            pino (int): Número do pino GPIO
            modo (str): 'OUT' para saída, 'IN' para entrada
        """
        if not self.gpio_disponivel:
            print(f"[GPIO] Simulação: Pino {pino} configurado como {modo}")
            self.pinos_configurados[pino] = modo
            return
            
        # Descomente quando estiver no Raspberry Pi
        import RPi.GPIO as GPIO
        if modo == 'OUT':
             GPIO.setup(22, GPIO.OUT)
        elif modo == 'IN':
             GPIO.setup(22, GPIO.IN)
        self.pinos_configurados[pino] = modo
        print(f"[GPIO] Pino {pino} configurado como {modo}")
    
    def escrever_pino(self, pino, valor):
        """Escreve valor em pino de saída
        
        Args:
            pino (int): Número do pino
            valor (bool): True para HIGH, False para LOW
        """
        
        if not self.gpio_disponivel:
            print(f"[GPIO] Simulação: Pino {22} = {valor}")
            return
            
        # Descomente quando estiver no Raspberry Pi
        import RPi.GPIO as GPIO
        GPIO.output(22, GPIO.HIGH if valor else GPIO.LOW)
    
    def ler_pino(self, pino):
        """Lê valor de pino de entrada"""
        if not self.gpio_disponivel:
            return False
            
        # Descomente quando estiver no Raspberry Pi
        import RPi.GPIO as GPIO
        return GPIO.input(pino)
    
    def cleanup(self):
        """Limpa configurações GPIO"""
        if self.gpio_disponivel:
            import RPi.GPIO as GPIO
            GPIO.cleanup()
            print("[GPIO] GPIO cleanup realizado")

# ==============================
# CONTROLE LCD (PREPARADO PARA FUTURO)
# ==============================
class LCDController:
    """Controle de display LCD"""
    def __init__(self):
        self.lcd_disponivel = False
        self._inicializar_lcd()
        
    def _inicializar_lcd(self):
        """Inicializa LCD se disponível"""
        try:
            from RPLCD.i2c import CharLCD
            self.lcd = CharLCD('PCF8574', 0x27)
            self.lcd_disponivel = True
            
            print("[LCD] LCD não configurado (preparado para implementação futura)")
            self.lcd_disponivel = False
            
        except Exception as e:
            print(f"[LCD] LCD não disponível: {e}")
            self.lcd_disponivel = False
    
    def exibir_mensagem(self, linha1="", linha2=""):
        """Exibe mensagem no LCD
        
        Args:
            linha1 (str): Texto da primeira linha
            linha2 (str): Texto da segunda linha
        """
        if not self.lcd_disponivel:
            print(f"[LCD] Simulação: '{linha1}' | '{linha2}'")
            return
            
        # FUTURO: Implementar exibição no LCD
        self.lcd.clear()
        self.lcd.write_string(linha1)
        self.lcd.crlf()
        self.lcd.write_string(linha2)
    
    def limpar(self):
        """Limpa display LCD"""
        if self.lcd_disponivel:
            self.lcd.clear()
            pass
    
    def atualizar_status(self, esteira_ligada, cor_detectada):
        """Atualiza LCD com status do sistema"""
        linha1 = f"Est: {'ON ' if esteira_ligada else 'OFF'}"
        linha2 = f"Cor: {cor_detectada[:12] if cor_detectada else 'Nenhuma'}"
        self.exibir_mensagem(linha1, linha2)

# ==============================
# MQTT SETUP
# ==============================
class MQTTHandler:
    def __init__(self, system_state, lcd_controller):
        self.client = mqtt.Client(client_id="camera_python", clean_session=True)
        self.client.username_pw_set(MQTT_USER, MQTT_PASSWORD)
        self.client.tls_set(cert_reqs=ssl.CERT_NONE, tls_version=ssl.PROTOCOL_TLS)
        self.client.tls_insecure_set(True)
        self.client.on_connect = self.on_connect
        self.client.on_message = self.on_message
        self.client.on_disconnect = self.on_disconnect
        
        self.system_state = system_state
        self.lcd_controller = lcd_controller
        self.last_colors = []
        self.last_send_time = 0
        self.connected = False
        self.local_ip = ""
        
    def on_connect(self, client, userdata, flags, rc):
        if rc == 0:
            print(f"[MQTT] ✓ Conectado com sucesso!")
            self.connected = True
            
            # Subscreve aos tópicos necessários
            client.subscribe(SOLICITAR_IP_TOPIC, qos=1)
            print(f"[MQTT] ✓ Inscrito em: {SOLICITAR_IP_TOPIC}")
            
            client.subscribe(APP_CONTROL_TOPIC, qos=1)
            print(f"[MQTT] ✓ Inscrito em: {APP_CONTROL_TOPIC}")
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
        
        # Solicitação de IP - envia para dados/camera
        if topic == SOLICITAR_IP_TOPIC:
            print(f"[MQTT] >>> Solicitação de IP detectada!")
            ip_response = f"http://{self.local_ip}:5000"
            print(f"[MQTT] >>> Enviando IP: {ip_response}")
            
            result = client.publish(MQTT_TOPIC, ip_response, qos=1)
            
            if result.rc == mqtt.MQTT_ERR_SUCCESS:
                print(f"[MQTT] ✓ IP enviado com sucesso para: {MQTT_TOPIC}")
            else:
                print(f"[MQTT] ✗ Erro ao enviar IP. Código: {result.rc}")
        
        # Controle da esteira de dados/app
        elif topic == APP_CONTROL_TOPIC:
            print(f"[MQTT] >>> Comando de esteira recebido: {payload}")
            try:
                estado = payload.strip()
                if estado in ['0', '1']:
                    self.system_state.atualizar_esteira(estado)
                    
                    # Atualiza LCD
                    self.lcd_controller.atualizar_status(
                        self.system_state.esteira_ligada,
                        self.system_state.ultima_cor_detectada
                    )
                else:
                    print(f"[MQTT] ⚠️ Valor inválido para esteira: {estado}")
            except Exception as e:
                print(f"[MQTT] ✗ Erro ao processar comando de esteira: {e}")
    
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
        """Publica a cor predominante detectada com throttling e delay"""
        current_time = time.time()
        if current_time - self.last_send_time >= MQTT_SEND_INTERVAL:
            if colors and colors != self.last_colors:
                try:
                    predominant_color = colors[0]
                    
                    result = self.client.publish(MQTT_TOPIC, predominant_color, qos=0)
                    
                    if result.rc == mqtt.MQTT_ERR_SUCCESS:
                        self.last_colors = [predominant_color]
                        self.last_send_time = current_time
                        
                        # Atualiza estado do sistema
                        cor_nome = predominant_color.replace("Cor:", "")
                        self.system_state.adicionar_cor(cor_nome)
                        
                        # Atualiza LCD
                        self.lcd_controller.atualizar_status(
                            self.system_state.esteira_ligada,
                            self.system_state.ultima_cor_detectada
                        )
                        
                except Exception as e:
                    print(f"[MQTT] Erro ao publicar cores: {e}")
                    
    def __init__(self, system_state, lcd_controller):
        self.client = mqtt.Client(client_id="camera_python", clean_session=True)
        self.client.username_pw_set(MQTT_USER, MQTT_PASSWORD)
        self.client.tls_set(cert_reqs=ssl.CERT_NONE, tls_version=ssl.PROTOCOL_TLS)
        self.client.tls_insecure_set(True)
        self.client.on_connect = self.on_connect
        self.client.on_message = self.on_message
        self.client.on_disconnect = self.on_disconnect
        
        self.system_state = system_state
        self.lcd_controller = lcd_controller
        self.last_colors = []
        self.last_send_time = 0
        self.connected = False
        self.local_ip = ""
        
    def on_connect(self, client, userdata, flags, rc):
        if rc == 0:
            print(f"[MQTT] ✓ Conectado com sucesso!")
            self.connected = True
            
            # Subscreve aos tópicos necessários
            client.subscribe(SOLICITAR_IP_TOPIC, qos=1)
            print(f"[MQTT] ✓ Inscrito em: {SOLICITAR_IP_TOPIC}")
            
            client.subscribe(APP_CONTROL_TOPIC, qos=1)
            print(f"[MQTT] ✓ Inscrito em: {APP_CONTROL_TOPIC}")
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
        
        # Solicitação de IP - envia para dados/camera
        if topic == SOLICITAR_IP_TOPIC:
            print(f"[MQTT] >>> Solicitação de IP detectada!")
            ip_response = f"http://{self.local_ip}:5000"
            print(f"[MQTT] >>> Enviando IP: {ip_response}")
            
            result = client.publish(MQTT_TOPIC, ip_response, qos=1)
            
            if result.rc == mqtt.MQTT_ERR_SUCCESS:
                print(f"[MQTT] ✓ IP enviado com sucesso para: {MQTT_TOPIC}")
            else:
                print(f"[MQTT] ✗ Erro ao enviar IP. Código: {result.rc}")
        
        # Controle da esteira de dados/app
        elif topic == APP_CONTROL_TOPIC:
            print(f"[MQTT] >>> Comando de esteira recebido: {payload}")
            try:
                estado = payload.strip()
                if estado in ['0', '1']:
                    self.system_state.atualizar_esteira(estado)
                    
                    # Atualiza LCD
                    self.lcd_controller.atualizar_status(
                        self.system_state.esteira_ligada,
                        self.system_state.ultima_cor_detectada
                    )
                else:
                    print(f"[MQTT] ⚠️ Valor inválido para esteira: {estado}")
            except Exception as e:
                print(f"[MQTT] ✗ Erro ao processar comando de esteira: {e}")
    
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
        """Publica a cor predominante detectada com throttling e delay"""
        current_time = time.time()
        if current_time - self.last_send_time >= MQTT_SEND_INTERVAL:
            if colors and colors != self.last_colors:
                try:
                    msg = ",".join(set(colors))
                    result = self.client.publish(MQTT_TOPIC, msg, qos=0)
                    
                    if result.rc == mqtt.MQTT_ERR_SUCCESS:
                        self.last_colors = colors.copy()
                        self.last_send_time = current_time
                        
                        # Atualiza estado do sistema
                        for cor in colors:
                            cor_nome = cor.replace("Cor:", "")
                            self.system_state.adicionar_cor(cor_nome)
                        
                        # Atualiza LCD
                        self.lcd_controller.atualizar_status(
                            self.system_state.esteira_ligada,
                            self.system_state.ultima_cor_detectada
                        )
                        
                except Exception as e:
                    print(f"[MQTT] Erro ao publicar cores: {e}")

    def __init__(self, system_state, lcd_controller):
        self.client = mqtt.Client(client_id="camera_python", clean_session=True)
        self.client.username_pw_set(MQTT_USER, MQTT_PASSWORD)
        self.client.tls_set(cert_reqs=ssl.CERT_NONE, tls_version=ssl.PROTOCOL_TLS)
        self.client.tls_insecure_set(True)
        self.client.on_connect = self.on_connect
        self.client.on_message = self.on_message
        self.client.on_disconnect = self.on_disconnect
        
        self.system_state = system_state
        self.lcd_controller = lcd_controller
        self.last_colors = []
        self.last_send_time = 0
        self.connected = False
        self.local_ip = ""
        
    def on_connect(self, client, userdata, flags, rc):
        if rc == 0:
            print(f"[MQTT] ✓ Conectado com sucesso!")
            self.connected = True
            
            # Subscreve aos tópicos necessários
            client.subscribe(SOLICITAR_IP_TOPIC, qos=1)
            print(f"[MQTT] ✓ Inscrito em: {SOLICITAR_IP_TOPIC}")
            
            client.subscribe(APP_CONTROL_TOPIC, qos=1)
            print(f"[MQTT] ✓ Inscrito em: {APP_CONTROL_TOPIC}")
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
        
        # Solicitação de IP - envia para dados/camera
        if topic == SOLICITAR_IP_TOPIC:
            print(f"[MQTT] >>> Solicitação de IP detectada!")
            ip_response = f"http://{self.local_ip}:5000"
            print(f"[MQTT] >>> Enviando IP: {ip_response}")
            
            result = client.publish(MQTT_TOPIC, ip_response, qos=1)
            
            if result.rc == mqtt.MQTT_ERR_SUCCESS:
                print(f"[MQTT] ✓ IP enviado com sucesso para: {MQTT_TOPIC}")
            else:
                print(f"[MQTT] ✗ Erro ao enviar IP. Código: {result.rc}")
        
        # Controle da esteira de dados/app
        elif topic == APP_CONTROL_TOPIC:
            print(f"[MQTT] >>> Comando de esteira recebido: {payload}")
            try:
                estado = payload.strip()
                if estado in ['0', '1']:
                    self.system_state.atualizar_esteira(estado)
                    
                    # Atualiza LCD
                    self.lcd_controller.atualizar_status(
                        self.system_state.esteira_ligada,
                        self.system_state.ultima_cor_detectada
                    )
                else:
                    print(f"[MQTT] ⚠️ Valor inválido para esteira: {estado}")
            except Exception as e:
                print(f"[MQTT] ✗ Erro ao processar comando de esteira: {e}")
    
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
                    ##AQUI QUE PUBLICA COR##
                    novo_item = {
                        "cores": msg,
                        "timestamp": datetime.now().isoformat()
                    }

                    result = self.client.publish(MQTT_TOPIC, msg, qos=0)

                    if result.rc == mqtt.MQTT_ERR_SUCCESS:
                        self.last_colors = colors.copy()
                        self.last_send_time = current_time
                        
                        # Atualiza estado do sistema
                        for cor in colors:
                            cor_nome = cor.replace("Cor:", "")
                            self.system_state.adicionar_cor(cor_nome)
                        
                        # Atualiza LCD
                        self.lcd_controller.atualizar_status(
                            self.system_state.esteira_ligada,
                            self.system_state.ultima_cor_detectada
                        )
                        
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
        areas = []  # Lista para armazenar as áreas das cores detectadas
        
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
                    areas.append((color_display, area))  # Adiciona a cor e sua área

        # Agora, escolhemos a cor com a maior área
        if areas:
            predominant_color = max(areas, key=lambda item: item[1])[0]  # Cor com maior área
            return frame, [predominant_color]  # Retorna apenas a cor predominante
        
        return frame, []
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
        areas = []  # Lista para armazenar as áreas das cores detectadas
        
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
                    areas.append((color_display, area))  # Adiciona a cor e sua área

        # Agora, escolhemos a cor com a maior área
        if areas:
            predominant_color = max(areas, key=lambda item: item[1])[0]
            return frame, [predominant_color]
        
        return frame, []

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
    def __init__(self, camera_index, mqtt_handler, system_state):
        self.camera_index = camera_index
        self.mqtt_handler = mqtt_handler
        self.system_state = system_state
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
        while self.running:
            ret, frame = self.cap.read()
            if not ret:
                print("[CAMERA] Erro ao ler frame")
                time.sleep(0.1)
                continue
            
            processed_frame, detected_colors = self.detector.detect(frame)
            
            # Armazena último frame para captura
            self.system_state.ultimo_frame = processed_frame.copy()
            
            # Adiciona informações no frame
            status_esteira = "ON" if self.system_state.esteira_ligada else "OFF"
            cv2.putText(processed_frame, f"FPS: {FPS_TARGET} | Esteira: {status_esteira}", 
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
# FLASK APP COM CORS
# ==============================
app = Flask(__name__)

# Configurar CORS
CORS(app, resources={
    r"/*": {
        "origins": ["*"],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Accept"],
        "max_age": 3600
    }
})

system_state = SystemState()
gpio_controller = GPIOController()
lcd_controller = LCDController()
mqtt_handler = MQTTHandler(system_state, lcd_controller)
camera_stream = None

@app.route("/camera_ia")
def camera_ia():
    """Endpoint de streaming com IA"""
    if not camera_stream or not camera_stream.running:
        return jsonify({"error": "Camera not running"}), 503
    
    return Response(camera_stream.generate_frames(),
                   mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route("/camera_ia")
@app.route("/camera_ia/capture")
def capture_frame():
    """Captura um frame individual em JPEG"""
    if not system_state.ultimo_frame is None:
        ret, buffer = cv2.imencode('.jpg', system_state.ultimo_frame, 
                                  [cv2.IMWRITE_JPEG_QUALITY, 95])
        frame_bytes = buffer.tobytes()
        
        return Response(frame_bytes, 
                       mimetype='image/jpeg',
                       headers={
                           'Content-Type': 'image/jpeg',
                           'Cache-Control': 'no-cache, no-store, must-revalidate',
                           'Pragma': 'no-cache',
                           'Expires': '0'
                       })
    
    return jsonify({"error": "No frame available"}), 503

@app.route("/status")
def status():
    """Endpoint de status do sistema"""
    return jsonify({
        "mqtt_connected": mqtt_handler.connected,
        "camera_running": camera_stream.running if camera_stream else False,
        "ip": get_local_ip(),
        "esteira_ligada": system_state.esteira_ligada,
        "cores_detectadas": system_state.cores_detectadas,
        "ultima_cor": system_state.ultima_cor_detectada,
        "gpio_disponivel": gpio_controller.gpio_disponivel,
        "lcd_disponivel": lcd_controller.lcd_disponivel
    })

@app.route("/health")
def health():
    """Health check"""
    return jsonify({"status": "ok"}), 200

@app.before_request
def handle_preflight():
    """Handle CORS preflight requests"""
    from flask import request
    if request.method == "OPTIONS":
        response = jsonify({"status": "ok"})
        response.headers.add("Access-Control-Allow-Origin", "*")
        response.headers.add("Access-Control-Allow-Headers", "Content-Type,Accept")
        response.headers.add("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        return response

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
    camera_stream = CameraStream(camera_index, mqtt_handler, system_state)
    camera_stream.start_capture()
    
    # Mostra informações
    print("\n" + "=" * 50)
    print(f"✅ SISTEMA PRONTO!")
    print(f"📹 Acessar câmera IA: http://{ip}:5000/camera_ia")
    print(f"📸 Capturar frame: http://{ip}:5000/camera_ia/capture")
    print(f"📊 Status do sistema: http://{ip}:5000/status")
    print(f"📡 MQTT Status: {'Conectado' if mqtt_handler.connected else 'Desconectado'}")
    print(f"📡 Tópico de cores e IP: {MQTT_TOPIC}")
    print(f"📡 Tópico de controle: {APP_CONTROL_TOPIC}")
    print(f"📡 Tópico de solicitação: {SOLICITAR_IP_TOPIC}")
    print(f"🎛️  GPIO: {'Disponível' if gpio_controller.gpio_disponivel else 'Simulação'}")
    print(f"📺 LCD: {'Configurado' if lcd_controller.lcd_disponivel else 'Preparado'}")
    print("=" * 50 + "\n")
    
    try:
        app.run(host="0.0.0.0", port=5000, threaded=True, debug=False)
    except KeyboardInterrupt:
        print("\n[SISTEMA] Encerrando...")
    finally:
        camera_stream.stop()
        mqtt_handler.client.loop_stop()
        gpio_controller.cleanup()
        cv2.destroyAllWindows()