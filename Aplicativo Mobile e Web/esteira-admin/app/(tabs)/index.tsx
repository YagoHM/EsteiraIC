import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
  Switch,
} from "react-native";
// @ts-ignore
import { WebView } from "react-native-webview";
import MqttPainel from "@/components/mqttPainel";
import useGeneratePdf from "@/hooks/usePdf";
import { informacoesMqtt } from "@/hooks/useMqtt";
export default function CameraScreen() {
  const [ip, setIp] = useState("http://192.168.0.100:5000");
  const [start, setStart] = useState(false);
  const [useIa, setUseIa] = useState(false);
  const isWeb = Platform.OS === "web";
  const { width } = Dimensions.get("window");
  const {
    loading,
    estado,
    ligarDesligarEstado,
    azul,
    vermelho,
    verde,
    corndef,
    logs,
    alterarEstadoEsteira,
  } = informacoesMqtt();
  // Endpoints da câmera
  const cameraNormal = `${ip}/camera_normal`;
  const cameraIa = `${ip}/camera_ia`;
  const currentIp = useIa ? cameraIa : cameraNormal;
  const {gerarPdf, loading: pdfLoading } = useGeneratePdf(logs, verde, azul, vermelho, corndef);

  return (
    <View style={styles.container}>
      {/* Painel MQTT sempre visível */}
      <View style={styles.mqttContainer}>
        <MqttPainel />
      </View>

      <TouchableOpacity style={styles.button} onPress={gerarPdf} disabled={pdfLoading}>
        <Text style={styles.buttonText}>
          {pdfLoading ? 'Gerando...' : 'Gerar Relatório'}
        </Text>
      </TouchableOpacity>
      
      {!start ? (
        <View style={styles.form}>
          <Text style={styles.label}>IP da câmera:</Text>
          <TextInput
            placeholder="ex: http://192.168.0.50:5000"
            style={styles.input}
            value={ip}
            onChangeText={setIp}
            autoCapitalize="none"
          />

          <TouchableOpacity
            style={[styles.button, !ip && styles.buttonDisabled]}
            disabled={!ip}
            onPress={() => setStart(true)}
          >
            <Text style={styles.buttonText}>Conectar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.streamContainer}>
          {/* Switch para alternar câmera IA */}
          <View style={styles.switchContainer}>
            <Text style={styles.label}>Usar câmera com IA:</Text>
            <Switch value={useIa} onValueChange={setUseIa} />
          </View>

          {/* Stream */}
          {isWeb ? (
            <iframe
              src={currentIp}
              style={{
                width: width - 40,
                height: 400,
                borderRadius: 10,
                border: "none",
                marginBottom: 20,
              }}
            />
          ) : (
            <WebView
              source={{ uri: currentIp }}
              style={styles.webview}
            />
          )}
          <TouchableOpacity style={styles.backButton} onPress={() => setStart(false)}>
            <Text style={styles.backButtonText}>Voltar</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const { width } = Dimensions.get("window");

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff", // tela toda branca
    alignItems: "center",
    justifyContent: "flex-start",
    padding: 20,
  },
  mqttContainer: {
    width: "100%",
    marginBottom: 20,
  },
  form: {
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
    textAlign: "center",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    width: "100%",
    marginBottom: 15,
    textAlign: "center",
  },
  button: {
    backgroundColor: "#007bff",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    width: "100%",
    marginBottom: 15,
  },
  buttonDisabled: {
    backgroundColor: "#aaa",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  streamContainer: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center", // centraliza a câmera
  },
  webview: {
    width: width - 40,
    height: 400,
    borderRadius: 10,
    overflow: "hidden",
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: "#dc3545",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    width: "100%",
    maxWidth: 400,
  },
  backButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  switchContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "80%",
    marginBottom: 15,
  },
});
