#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <SoftwareSerial.h>
#include <Adafruit_TCS34725.h>
#include <Ultrasonic.h>

Adafruit_TCS34725 tcs = Adafruit_TCS34725(0x29);
SoftwareSerial Esp = SoftwareSerial(3,2);
LiquidCrystal_I2C lcd(0x27, 16, 2);  

HC_SR04 sensor(13,12);
String cor = " ";  
int objectCount = 0;
long duration, distance;
float r, g, b;
const int rele = 9;
const int envAzul = 9;
const int envVerde = 10;
const int envVermelho = 11;

void setup() {

  lcd.init();
  lcd.backlight();
  
  pinMode(rele, OUTPUT);
  pinMode(envVerde, OUTPUT);
  pinMode(envVermelho, OUTPUT);
  pinMode(envAzul, OUTPUT);

  digitalWrite(rele, HIGH);

  if(tcs.begin()){
    Serial.println("Sensor encontrado");
  }else{
    Serial.println("Sensor não encontrado");
    while(1);
  }


  Serial.begin(9600);
  Esp.begin(9600);
  
}
 
void loop() {

  double distancia = (double)sensor.distance();

  digitalWrite(rele, HIGH);

  lcd.setCursor(0, 0);
  lcd.print("Contagem: ");
  tcs.getRGB(&r, &g, &b);
  
  Serial.println(sensor.distance());
  if(distancia < 9){

    objectCount++;
    delay(1200);
    tcs.getRGB(&r, &g, &b);
    Serial.print("Vermelho");Serial.println(r);
    Serial.print("Verde");Serial.println(g);
    Serial.print("Azul");Serial.println(b);
    if(b > g && b > r){

      digitalWrite(envAzul, HIGH);
      cor = "Blue";


    }else if(r > g && r > b){
      
      digitalWrite(envVermelho, HIGH);
      cor = "Red";

    }else if(g > r && g > b){

      digitalWrite(envVerde, HIGH);
      cor = "Green";

    }

    lcd.clear();
    lcd.setCursor(10, 0); 
    lcd.print(objectCount);
    lcd.setCursor(0,1); 
    lcd.print("Cor:");
    lcd.setCursor(4,1);
    lcd.print(cor);

    }



}