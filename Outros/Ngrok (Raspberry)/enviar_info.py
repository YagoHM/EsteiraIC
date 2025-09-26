import requests
import json
import paho.mqtt.client as mqtt
import time

def get_ngrok_url():
    url = 'http://localhost:4040/api/tunnels'
    try:
        response = requests.get(url)
        response.raise_for_status()  # vai lançar erro se status diferente de 200
        json_data = response.json()
        
        # Pega o túnel https (mais seguro)
        for tunnel in json_data.get('tunnels', []):
            if tunnel.get('proto') == 'https':
                return tunnel.get('public_url')
    except Exception as e:
        print("Erro ao obter URL do ngrok:", e)
    return None

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("Conectado com sucesso!")
        url = get_ngrok_url()
        if url:
            client.publish("ngrok/ip", url)
            print("URL publicada:", url)
        else:
            print("Não conseguiu obter URL do ngrok")
    else:
        print("Falha na conexão, código:", rc)

def on_publish(client, userdata, mid):
    print("Mensagem publicada, mid:", mid)

client = mqtt.Client()

client.username_pw_set('yago_ic', 'brokerP&x+e[5&ifZ_R}T')
client.tls_set()  # Usa certificados padrão do sistema

client.on_connect = on_connect
client.on_publish = on_publish

client.connect('f36a296472af4ff7bc783d027dcf8cb2.s1.eu.hivemq.cloud', 8883)

client.loop_start()

# Mantém o script vivo para o MQTT funcionar e publicar
try:
    while True:
        time.sleep(60)
        # Atualiza a URL periodicamente
        url = get_ngrok_url()
        if url:
            client.publish("ngrok/ip", url)
            print("URL atualizada publicada:", url)
except KeyboardInterrupt:
    print("Encerrando...")

client.loop_stop()
client.disconnect()
