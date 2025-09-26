#include <WiFi.h>
#include <PubSubClient.h>
#include <HardwareSerial.h>

String message;

const char* SSID = "LDI2";
const char* PASS = "wifi2021";
const char* brokerMQTT = "broker.hivemq.com";
const int verde = 19;
const int vermelho = 22;
const int azul = 23;
int brokerPORT = 1883;



WiFiClient espClient;
PubSubClient MQTT(espClient);

void initWIFI(){

  if(WiFi.status() == WL_CONNECTED){
    return;
  }
  Serial.println("Conectando-se a internet");
  WiFi.begin(SSID,PASS);

  while(WiFi.status() != WL_CONNECTED){
    Serial.print(".");
    delay(1000);
  }
  Serial.println("Conexão bem sucedida! ");
}
void mqttCALLBACK(char* topic, byte* payload, unsigned int length){
  String msg;

  for(int i =0; i<length;i++){
    char c = (char)payload[i];
    msg+=c;
  }
  Serial.print("[MQTT] Mensagem recebida: ");
  if(msg == "ligar"){
    digitalWrite(19, LOW);
  }
  if(msg == "desligar"){
    digitalWrite(19, HIGH);
  }
  Serial.println(msg);
}
void initMQTT(){
  MQTT.setServer(brokerMQTT, brokerPORT);
  MQTT.setCallback(mqttCALLBACK);
}
void reconnect_mqtt(void) {
    while (!MQTT.connected()) 
    {
        Serial.print("* Tentando se conectar ao Broker MQTT: ");
        Serial.println(brokerMQTT);
        if (MQTT.connect("EDUARDO")) 
        {
            Serial.println("Conectado com sucesso ao broker MQTT!");
            MQTT.subscribe("/esteira/receber/"); 
        } 
        else
        {
            Serial.println("Falha ao reconectar no broker.");
            Serial.println("Havera nova tentatica de conexao em 2s");
            delay(2000);
        }
    }
}

void setup() {
  Serial.begin(9600);
  Serial2.begin(9600,SERIAL_8N1,17,16);
  pinMode(19, OUTPUT);
  pinMode(18,INPUT);
  pinMode(22, INPUT);
  pinMode(23, INPUT);
  digitalWrite(19, HIGH);
  initWIFI();
  initMQTT();
}
char* payload;
String msgAnt;

void loop() {
  if (!MQTT.connected()) {reconnect_mqtt(); } 

  //MQTT.publish("/esteira/enviar/",enviar);
  


  
  MQTT.loop();
}









