#include <SoftwareSerial.h>

SoftwareSerial Esp32 = SoftwareSerial(A1,A2);

void setup() {
  Serial.begin(9600);
  Esp32.begin(9600);

}

void loop() {
  if (Serial.available()){
    Esp32.write(Serial.read());
  }
  delay(1000);
}
