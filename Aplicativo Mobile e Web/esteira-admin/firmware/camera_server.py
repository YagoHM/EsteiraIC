#!/usr/bin/env python3
"""
Servidor de Câmera IP para acesso pelo celular
Detecta automaticamente o IP local e permite acesso remoto
"""

import cv2
import socket
import json
import threading
import time
from flask import Flask, Response, jsonify, request
from flask_cors import CORS
import logging
import os
import subprocess
import platform

class CameraServer:
    def __init__(self, camera_index=0, port=5000):
        self.app = Flask(__name__)
        CORS(self.app)  # Permite acesso de outros dispositivos
        
        self.camera_index = camera_index
        self.port = port
        self.camera = None
        self.is_streaming = False
        self.camera_available = False
        
        # Configurar logging
        logging.basicConfig(level=logging.INFO)
        self.logger = logging.getLogger(__name__)
        
        # Detectar IPs da máquina
        self.local_ips = self.get_local_ips()
        self.primary_ip = self.get_primary_ip()
        
        print(f"🎥 Servidor de Câmera IP iniciando...")
        print(f"📡 IP Principal: {self.primary_ip}")
        print(f"🌐 Todos os IPs: {', '.join(self.local_ips)}")
        
        # Configurar rotas
        self.setup_routes()
        
        # Tentar inicializar câmera
        self.init_camera()
        
    def get_local_ips(self):
        """Obtém todos os IPs locais da máquina"""
        ips = []
        
        # Método 1: usando socket
        try:
            # Conecta a um servidor externo para descobrir IP local
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            primary_ip = s.getsockname()[0]
            s.close()
            ips.append(primary_ip)
        except:
            pass
            
        # Método 2: listar todas as interfaces de rede
        try:
            import psutil
            for interface, addrs in psutil.net_if_addrs().items():
                for addr in addrs:
                    if addr.family == socket.AF_INET and not addr.address.startswith('127.'):
                        if addr.address not in ips:
                            ips.append(addr.address)
        except ImportError:
            # Fallback se psutil não estiver disponível
            try:
                if platform.system() == "Windows":
                    result = subprocess.run(['ipconfig'], capture_output=True, text=True)
                    lines = result.stdout.split('\n')
                    for line in lines:
                        if 'IPv4' in line and '192.168' in line:
                            ip = line.split(':')[-1].strip()
                            if ip not in ips:
                                ips.append(ip)
                else:
                    result = subprocess.run(['hostname', '-I'], capture_output=True, text=True)
                    for ip in result.stdout.split():
                        if not ip.startswith('127.') and ip not in ips:
                            ips.append(ip)
            except:
                pass
        
        # Fallback para IPs comuns se não encontrou nenhum
        if not ips:
            ips = ['192.168.1.100']  # IP padrão como fallback
            
        return ips
    
    def get_primary_ip(self):
        """Obtém o IP principal da máquina"""
        if self.local_ips:
            # Priorizar IPs 192.168.x.x
            for ip in self.local_ips:
                if ip.startswith('192.168.'):
                    return ip
            return self.local_ips[0]
        return '127.0.0.1'
    
    def init_camera(self):
        """Inicializa a câmera"""
        try:
            print(f"🔍 Tentando inicializar câmera {self.camera_index}...")
            
            # Tentar diferentes backends
            backends_to_try = [
                cv2.CAP_DSHOW,    # Windows DirectShow
                cv2.CAP_V4L2,     # Linux Video4Linux2
                cv2.CAP_AVFOUNDATION,  # macOS AVFoundation
                cv2.CAP_ANY       # Qualquer backend disponível
            ]
            
            for backend in backends_to_try:
                try:
                    self.camera = cv2.VideoCapture(self.camera_index, backend)
                    if self.camera.isOpened():
                        print(f"✅ Câmera inicializada com backend {backend}")
                        break
                except:
                    continue
            
            if not self.camera or not self.camera.isOpened():
                print("⚠️ Não foi possível abrir a câmera. Usando imagem de teste.")
                self.camera_available = False
                return
            
            # Configurar qualidade da câmera
            self.camera.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
            self.camera.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
            self.camera.set(cv2.CAP_PROP_FPS, 30)
            
            # Testar se consegue capturar um frame
            ret, frame = self.camera.read()
            if ret:
                self.camera_available = True
                print("✅ Câmera funcionando corretamente!")
            else:
                print("❌ Câmera conectada mas não consegue capturar imagens")
                self.camera_available = False
                
        except Exception as e:
            print(f"❌ Erro ao inicializar câmera: {e}")
            self.camera_available = False
    
    def generate_frames(self):
        """Gera frames da câmera para streaming"""
        while True:
            if self.camera_available and self.camera and self.camera.isOpened():
                ret, frame = self.camera.read()
                if ret:
                    # Redimensionar frame se necessário
                    height, width = frame.shape[:2]
                    if width > 800:
                        scale = 800 / width
                        new_width = 800
                        new_height = int(height * scale)
                        frame = cv2.resize(frame, (new_width, new_height))
                    
                    # Converter para JPEG
                    ret, buffer = cv2.imencode('.jpg', frame, 
                        [cv2.IMWRITE_JPEG_QUALITY, 85])
                    if ret:
                        frame_bytes = buffer.tobytes()
                        yield (b'--frame\r\n'
                               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
                else:
                    print("⚠️ Falha ao capturar frame da câmera")
                    time.sleep(0.1)
            else:
                # Gerar imagem de teste se câmera não disponível
                test_frame = self.generate_test_image()
                ret, buffer = cv2.imencode('.jpg', test_frame)
                if ret:
                    frame_bytes = buffer.tobytes()
                    yield (b'--frame\r\n'
                           b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
                time.sleep(0.1)
    
    def generate_test_image(self):
        """Gera uma imagem de teste quando a câmera não está disponível"""
        import numpy as np
        
        # Criar imagem preta com texto
        height, width = 480, 640
        frame = np.zeros((height, width, 3), dtype=np.uint8)
        
        # Adicionar texto
        font = cv2.FONT_HERSHEY_SIMPLEX
        text_lines = [
            "CAMERA NAO DISPONIVEL",
            f"IP: {self.primary_ip}:{self.port}",
            "Conecte uma camera",
            f"Tempo: {time.strftime('%H:%M:%S')}"
        ]
        
        for i, line in enumerate(text_lines):
            y = 150 + (i * 50)
            cv2.putText(frame, line, (50, y), font, 0.8, (0, 255, 0), 2)
        
        # Adicionar retângulo decorativo
        cv2.rectangle(frame, (30, 100), (610, 350), (0, 255, 0), 2)
        
        return frame
    
    def setup_routes(self):
        """Configura as rotas da API"""
        
        @self.app.route('/')
        def index():
            return f"""
            <html>
            <head><title>Camera IP Server</title></head>
            <body style="font-family: Arial; text-align: center; padding: 50px;">
                <h1>🎥 Servidor de Câmera IP</h1>
                <h2>Status: {'🟢 Online' if self.camera_available else '🟡 Sem Câmera'}</h2>
                <p><strong>IP Principal:</strong> {self.primary_ip}:{self.port}</p>
                <p><strong>Todos os IPs:</strong> {', '.join(self.local_ips)}</p>
                <h3>Endpoints:</h3>
                <ul style="text-align: left; max-width: 300px; margin: 0 auto;">
                    <li><a href="/video">/video</a> - Stream da câmera</li>
                    <li><a href="/status">/status</a> - Status do servidor</li>
                    <li><a href="/test">/test</a> - Página de teste</li>
                </ul>
                <br>
                <img src="/video" style="max-width: 100%; border: 2px solid #ccc;">
            </body>
            </html>
            """
        
        @self.app.route('/video')
        def video_feed():
            """Endpoint para stream de vídeo"""
            return Response(
                self.generate_frames(),
                mimetype='multipart/x-mixed-replace; boundary=frame'
            )
        
        @self.app.route('/status')
        def status():
            """Endpoint para status do servidor"""
            return jsonify({
                'status': 'online',
                'camera': self.camera_available,
                'ip': self.primary_ip,
                'port': self.port,
                'local_ip': self.primary_ip,
                'all_ips': self.local_ips,
                'test_mode': not self.camera_available,
                'network_interfaces': self.local_ips
            })
        
        @self.app.route('/test')
        def test_page():
            """Página de teste para verificar funcionamento"""
            return f"""
            <html>
            <head>
                <title>Teste de Câmera</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body {{ font-family: Arial; margin: 20px; }}
                    .status {{ padding: 10px; border-radius: 5px; margin: 10px 0; }}
                    .online {{ background-color: #d4edda; color: #155724; }}
                    .offline {{ background-color: #f8d7da; color: #721c24; }}
                    img {{ max-width: 100%; border: 1px solid #ccc; }}
                </style>
            </head>
            <body>
                <h1>🧪 Teste da Câmera IP</h1>
                <div class="status {'online' if self.camera_available else 'offline'}">
                    Status: {'🟢 Câmera Ativa' if self.camera_available else '🔴 Câmera Inativa'}
                </div>
                <p><strong>Acesse pelo celular:</strong></p>
                <ul>
                    {''.join([f'<li>http://{ip}:{self.port}</li>' for ip in self.local_ips])}
                </ul>
                <h3>Stream ao Vivo:</h3>
                <img src="/video" alt="Stream da câmera">
                <script>
                    // Recarrega a página a cada 30 segundos
                    setTimeout(() => location.reload(), 30000);
                </script>
            </body>
            </html>
            """
    
    def print_access_info(self):
        """Imprime informações de acesso"""
        print("\n" + "="*50)
        print("🎥 SERVIDOR DE CÂMERA INICIADO")
        print("="*50)
        print(f"📡 Status da Câmera: {'🟢 Ativa' if self.camera_available else '🔴 Inativa (modo teste)'}")
        print(f"💻 IP Principal: {self.primary_ip}:{self.port}")
        print("\n🌐 Acesse pelo celular (mesma rede Wi-Fi):")
        for ip in self.local_ips:
            print(f"   • http://{ip}:{self.port}")
        
        print(f"\n📱 No app mobile, use qualquer um destes IPs:")
        for ip in self.local_ips:
            print(f"   • {ip}")
            
        print(f"\n🔗 Endpoints disponíveis:")
        print(f"   • /video - Stream da câmera")
        print(f"   • /status - Status JSON")
        print(f"   • /test - Página de teste")
        print("="*50)
        
        if not self.camera_available:
            print("\n⚠️  AVISO: Câmera não detectada!")
            print("   • Verifique se uma câmera está conectada")
            print("   • O servidor funcionará em modo teste")
            print("   • Conecte uma câmera e reinicie o servidor")
    
    def run(self, host='0.0.0.0', debug=False):
        """Executa o servidor"""
        try:
            self.print_access_info()
            
            # Configurar Flask para não mostrar logs desnecessários
            if not debug:
                log = logging.getLogger('werkzeug')
                log.setLevel(logging.ERROR)
            
            # Iniciar servidor
            self.app.run(
                host=host,
                port=self.port,
                debug=debug,
                threaded=True,
                use_reloader=False
            )
            
        except KeyboardInterrupt:
            print("\n🛑 Servidor interrompido pelo usuário")
        except Exception as e:
            print(f"❌ Erro ao iniciar servidor: {e}")
        finally:
            self.cleanup()
    
    def cleanup(self):
        """Limpa recursos ao encerrar"""
        if self.camera:
            self.camera.release()
            print("📷 Câmera liberada")

def main():
    """Função principal"""
    print("🚀 Iniciando Servidor de Câmera IP...")
    
    # Verificar dependências
    try:
        import cv2
        import flask
        import flask_cors
        print("✅ Todas as dependências encontradas")
    except ImportError as e:
        print(f"❌ Dependência faltando: {e}")
        print("💡 Execute: pip install opencv-python flask flask-cors")
        return
    
    # Configurações
    camera_index = 0  # Índice da câmera (0 = padrão)
    port = 5000       # Porta do servidor
    
    # Permitir configuração via argumentos de linha de comando
    import sys
    if len(sys.argv) > 1:
        try:
            camera_index = int(sys.argv[1])
            print(f"📷 Usando câmera índice: {camera_index}")
        except:
            pass
    
    if len(sys.argv) > 2:
        try:
            port = int(sys.argv[2])
            print(f"🌐 Usando porta: {port}")
        except:
            pass
    
    # Criar e executar servidor
    server = CameraServer(camera_index=camera_index, port=port)
    server.run()

if __name__ == "__main__":
    main()