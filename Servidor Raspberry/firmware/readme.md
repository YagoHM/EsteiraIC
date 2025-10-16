==============================
INSTRUÇÕES DE INSTALAÇÃO - RASPBERRY PI
=======================================
deb http://raspbian.raspberrypi.org/raspbian/ bookworm main contrib non-free rpi

# 1️⃣ Atualizar o sistema

sudo apt update
sudo apt upgrade -y
sudo apt install -y python3-pip python3-dev python3-venv
sudo apt install -y libatlas-base-dev libhdf5-dev libhdf5-serial-dev libqtgui4 libqt4-test libjasper-dev libilmbase-dev libopenexr-dev libgstreamer1.0-dev libjpeg-dev libpng-dev libtiff-dev
sudo apt install -y cmake build-essential pkg-config

# 2️⃣ Criar ambiente virtual (opcional, mas recomendado)

python3 -m venv venv
source venv/bin/activate

# 3️⃣ Instalar dependências Python

pip install --upgrade pip setuptools wheel
pip install numpy opencv-python flask paho-mqtt
sudo pip install RPLCD

# Se houver problemas com OpenCV, usar versão leve:

pip install opencv-python-headless

# 4️⃣ Instalar OpenSSL para TLS

sudo apt install -y libssl-dev

# 5️⃣ Habilitar câmera Raspberry Pi (se usar CSI)

sudo raspi-config

# Interface Options → Camera → Enable

sudo reboot

# 6️⃣ Verificar instalação

# Criar arquivo test.py com:

# import cv2

# import numpy as np

# import flask

# import paho.mqtt.client as mqtt

# print("✅ Dependências OK")

python3 test.py
