#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>

// Credenciais do Wi-Fi  
const char* ssid = "LDI02";
const char* password = "wifi2021";

// Detalhes do broker MQTT
const char* mqtt_broker = "f36a296472af4ff7bc783d027dcf8cb2.s1.eu.hivemq.cloud";
const int mqtt_port = 8883;
const char* mqtt_username = "yago_ic";
const char* mqtt_password = "brokerP&x+e[5&ifZ_R}T";

// Tópicos MQTT
const char* topic_publish = "esp32/placa_esp"; // Tópico para publicar (do ESP32 para o site)
const char* topic_receive = "esp32/site";      // Tópico para receber (do site para o ESP32)

// Pinos
const int esteira = 5;
const int RXp2 = 16; // Recebe dados do Arduino
const int TXp2 = 17; // Transmite dados

// Instâncias
WiFiClientSecure wifiClient;
PubSubClient mqttClient(wifiClient);

// Função de callback para mensagens MQTT recebidas
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String receivedMessage = "";
  for (int i = 0; i < length; i++) {
    receivedMessage += (char)payload[i];
  }

  if (String(topic) == topic_receive) {
    if (receivedMessage == "1") {
      digitalWrite(esteira, HIGH);
      Serial.println("Esteira Ligada");
    } else if (receivedMessage == "0") {
      digitalWrite(esteira, LOW);
      Serial.println("Esteira Desligada");
    }
  }
}

// Configuração inicial do MQTT
void setupMQTT() {
  mqttClient.setServer(mqtt_broker, mqtt_port);
  mqttClient.setCallback(mqttCallback);
  mqttClient.subscribe(topic_receive);
}

// Reconexão ao broker MQTT
void reconnect() {
  while (!mqttClient.connected()) {
    Serial.println("Conectando ao broker MQTT...");
    String clientId = "ESP32Client-" + String(random(0xffff), HEX);
    
    if (mqttClient.connect(clientId.c_str(), mqtt_username, mqtt_password)) {
      Serial.println("Conectado ao broker MQTT.");
      mqttClient.subscribe(topic_receive);
      mqttClient.publish(topic_publish, "Conectado ao MQTT");
    } else {
      Serial.print("Falha, rc=");
      Serial.print(mqttClient.state());
      Serial.println(" Tentando novamente em 5 segundos...");
      delay(5000);
    }
  }
}

void setup() {
  Serial.begin(115200); // Inicia a comunicação serial para depuração
  Serial2.begin(9600, SERIAL_8N1, RXp2, TXp2); // Configura Serial2

  // Conecta ao Wi-Fi
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print("Conectando ao Wi-Fi...");
  }
  Serial.println("\nConectado ao Wi-Fi");

  // Configura o cliente MQTT
  wifiClient.setInsecure();
  setupMQTT();

  // Configura o pino da esteira
  pinMode(esteira, OUTPUT);
  digitalWrite(esteira, LOW); // Garante que a esteira comece desligada
}

void loop() {
  // Verifica a conexão MQTT e reconecta, se necessário
  if (!mqttClient.connected()) {
    reconnect();
  }
  mqttClient.loop();

  // Verifica se há dados disponíveis na Serial2 (comunicação com o Arduino)
  if (Serial2.available()) {
    String mensagem = Serial2.readStringUntil('\n'); // Lê a mensagem até o caractere de nova linha
    mensagem.trim(); // Remove espaços em branco

    // Processa a mensagem recebida
    if (mensagem == "Vermelho") {
      mqttClient.publish(topic_publish, "4");
      Serial.println("Vermelho");
    } else if (mensagem == "Verde") {
      mqttClient.publish(topic_publish, "2");
      Serial.println("Verde");
    } else if (mensagem == "Azul") {
      mqttClient.publish(topic_publish, "3");
      Serial.println("Azul");
    } else if (mensagem == "Cor N def.") {
      mqttClient.publish(topic_publish, "5");
      Serial.println("Cor N def.");
    }
  }
}