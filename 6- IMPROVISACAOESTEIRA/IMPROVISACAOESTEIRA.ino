#include <Arduino.h>
#include <LiquidCrystal_I2C.h>

// Definições de hardware
#define LDR_PIN A0
#define LIMIAR_LDR 100 // Ajuste conforme necessário

// Pinos dos botões
const int btnVermelho = 6;
const int btnVerde = 7;
const int btnAzul = 5;

// Variáveis globais
int quantidade = 0;
String cor = "N/A";

// Instância do LCD
LiquidCrystal_I2C lcd(0x27, 20, 4);

// Controle de debounce para os botões e LDR
unsigned long lastButtonPressTime = 0;
unsigned long lastDebounceTime = 0;
const unsigned long debounceDelay = 50; // Delay para evitar leituras erradas
bool objetoDetectado = false;

void initLcd() {
  lcd.init();
  lcd.backlight();
  lcd.setCursor(3, 0);
  lcd.print("Gugu <3");
  delay(1500);
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Quantidade:");
  lcd.setCursor(0, 1);
  lcd.print("Cor:");
}

void setup() {
  Serial.begin(9600);
  
  // Inicializa o LCD
  initLcd();

  // Configuração dos botões com pull-up interno
  pinMode(btnVermelho, INPUT_PULLUP);
  pinMode(btnVerde, INPUT_PULLUP);
  pinMode(btnAzul, INPUT_PULLUP);
}

void sendData(String c) {
  Serial.print("🔵 Cor enviada: ");
  Serial.println(c);
}

void showData() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Quantidade:");
  lcd.setCursor(11, 0);
  lcd.print(quantidade);
  lcd.setCursor(0, 1);
  lcd.print("Cor:");
  lcd.setCursor(4, 1);
  lcd.print(cor);
}

void loop() {
  unsigned long currentTime = millis();

  // Leitura dos botões com debounce
  if (currentTime - lastButtonPressTime > debounceDelay) {
    if (digitalRead(btnVermelho) == LOW) {
      cor = "Vermelho";
      lastButtonPressTime = currentTime;
    } else if (digitalRead(btnVerde) == LOW) {
      cor = "Verde";
      lastButtonPressTime = currentTime;
    } else if (digitalRead(btnAzul) == LOW) {
      cor = "Azul";
      lastButtonPressTime = currentTime;
    }
  }

  // Leitura do LDR para contar objetos
  int ldrValor = analogRead(LDR_PIN);
  
  if (ldrValor > LIMIAR_LDR) { // Objeto detectado
    if (!objetoDetectado && (currentTime - lastDebounceTime > debounceDelay)) {
      quantidade++;
      showData();
      sendData(cor);
      objetoDetectado = true;
      lastDebounceTime = currentTime;

      while(ldrValor<LIMIAR_LDR)
      {
        return;
      }
    }
  } else {
    objetoDetectado = false;  // Resetar estado
  }
}
