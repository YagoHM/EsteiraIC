import cv2
import time

cap = cv2.VideoCapture(0)

while True:
    ret, frame = cap.read()
    if ret:
        cv2.imwrite("captura.jpg", frame)
    time.sleep(1)  # tira 1 foto por segundo

cap.release()
