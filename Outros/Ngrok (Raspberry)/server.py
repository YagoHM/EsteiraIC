from flask import Flask, Response
import cv2
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # libera acesso externo (útil para celular / ngrok)

# Abre a câmera uma vez só
camera = cv2.VideoCapture(0)  # 0 = primeira webcam

def gerar_frames():
    while True:
        sucesso, frame = camera.read()
        if not sucesso:
            break

        # Codifica para JPEG
        ret, buffer = cv2.imencode('.jpg', frame)
        frame = buffer.tobytes()

        # Envia no formato de streaming MJPEG
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')

@app.route('/video')
def video():
    return Response(gerar_frames(),
                    mimetype='multipart/x-mixed-replace; boundary=frame')

if __name__ == '__main__':
    # Importante: host 0.0.0.0 para aceitar conexões externas
    app.run(host='0.0.0.0', port=5000)
