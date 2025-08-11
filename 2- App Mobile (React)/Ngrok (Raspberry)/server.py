from flask import Flask, Response
import cv2

app = Flask(__name__)

def gerar_frames():
    camera = cv2.VideoCapture(0)  # 0 = primeira webcam do sistema

    while True:
        sucesso, frame = camera.read()
        if not sucesso:
            break

        # Codifica o frame como JPEG
        ret, buffer = cv2.imencode('.jpg', frame)
        frame = buffer.tobytes()

        # Monta o frame no formato MJPEG
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')

@app.route('/video')
def video():
    return Response(gerar_frames(),
                    mimetype='multipart/x-mixed-replace; boundary=frame')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
