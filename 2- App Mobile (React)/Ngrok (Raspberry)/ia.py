import cv2
import numpy as np

# URL do seu streaming (substitua pelo IP e porta corretos)
url = "http://127.0.0.1:5000/video"

# Abre o stream com OpenCV
cap = cv2.VideoCapture(url)

if not cap.isOpened():
    print("Erro: Não foi possível abrir o stream.")
    exit()

# Lê um frame do stream
ret, frame = cap.read()

if ret:
    # Salva a imagem capturada
    cv2.imwrite("captura.jpg", frame)
    print("Foto salva como captura.jpg")
else:
    print("Erro: Não foi possível capturar o frame.")

cap.release()

def cor_predominante(imagem_path):
    # Carrega a imagem
    img = cv2.imread(imagem_path)

    if img is None:
        print("Erro ao carregar a imagem.")
        return "Não definido"

    # Converte para RGB (OpenCV lê como BGR)
    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

    # Calcula a média de cada canal (R, G, B)
    media_r = np.mean(img_rgb[:, :, 0])
    media_g = np.mean(img_rgb[:, :, 1])
    media_b = np.mean(img_rgb[:, :, 2])

    print(f"Médias - R: {media_r:.2f}, G: {media_g:.2f}, B: {media_b:.2f}")

    # Decide qual canal é maior
    max_media = max(media_r, media_g, media_b)

    # Um limiar para definir predominância clara (exemplo 10%)
    limiar = 10

    if max_media == media_r and media_r - max(media_g, media_b) > limiar:
        return "Vermelho"
    elif max_media == media_g and media_g - max(media_r, media_b) > limiar:
        return "Verde"
    elif max_media == media_b and media_b - max(media_r, media_g) > limiar:
        return "Azul"
    else:
        return "Não definido"

# Exemplo de uso
cor = cor_predominante("captura.jpg")
print("Cor predominante:", cor)