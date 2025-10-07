#!/bin/bash

echo "🔧 Instalando dependências para Raspberry Pi 3 Model A+"
echo "=================================================="

# Atualiza sistema
echo "📦 Atualizando sistema..."
sudo apt update
sudo apt upgrade -y

# Instala OpenCV (versão leve)
echo "📷 Instalando OpenCV..."
sudo apt install -y python3-opencv

# Instala dependências Python
echo "🐍 Instalando bibliotecas Python..."
sudo apt install -y python3-pip python3-numpy

# Instala Flask e MQTT
pip3 install flask paho-mqtt

# Instala TensorFlow Lite Runtime (MUITO mais leve que TensorFlow completo!)
echo "🤖 Instalando TensorFlow Lite..."
pip3 install --extra-index-url https://google-coral.github.io/py-repo/ tflite_runtime

# Baixa modelo TFLite otimizado
echo "📥 Baixando modelo de detecção..."
cd ~/firmware

# Opção 1: MobileNet SSD (mais rápido, menos preciso)
wget https://storage.googleapis.com/download.tensorflow.org/models/tflite/coco_ssd_mobilenet_v1_1.0_quant_2018_06_29.zip
unzip -o coco_ssd_mobilenet_v1_1.0_quant_2018_06_29.zip
mv detect.tflite detect_mobilenet.tflite

# Opção 2: EfficientDet Lite (melhor balanceamento)
wget https://storage.googleapis.com/coral-models/efficientdet-lite0-320x320-quant.tflite -O detect.tflite

# Limpa arquivos temporários
rm -f coco_ssd_mobilenet_v1_1.0_quant_2018_06_29.zip
rm -f labelmap.txt

echo ""
echo "✅ Instalação concluída!"
echo ""
echo "Para testar:"
echo "  python3 transmissao_camera.py"
echo ""
echo "Acesse:"
echo "  http://$(hostname -I | awk '{print $1}'):5000/camera_normal"
echo "  http://$(hostname -I | awk '{print $1}'):5000/camera_ia"
echo ""