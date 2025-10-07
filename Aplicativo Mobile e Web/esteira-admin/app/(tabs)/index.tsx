import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
// @ts-ignore
import MqttPainel from "@/components/mqttPainel";
import { informacoesMqtt } from "@/hooks/useMqtt";
import useGeneratePdf from "@/hooks/usePdf";
import { WebView } from "react-native-webview";

export default function CameraScreen() {
  const PADRAO_IP = "http://10.153.0.116:5000";

  const [ip, setIp] = useState(PADRAO_IP);
  const [start, setStart] = useState(false);
  const [solicitandoIp, setSolicitandoIp] = useState(false);

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
    client,
  } = informacoesMqtt();

  const { gerarPdf, loading: pdfLoading } = useGeneratePdf(
    logs,
    verde,
    azul,
    vermelho,
    corndef
  );

  // Formata IP adicionando http:// se necessário
  const formatarIp = (ipInput: string) => {
    let formatted = ipInput.trim();
    
    // Adiciona http:// se não tiver protocolo
    if (!formatted.startsWith("http://") && !formatted.startsWith("https://")) {
      formatted = "http://" + formatted;
    }
    
    return formatted;
  };

  // Solicita IP via MQTT
  const solicitarIpViaMqtt = () => {
    if (!client || !client.connected) {
      Alert.alert(
        "Erro de Conexão",
        "MQTT não está conectado. Verifique a conexão e tente novamente."
      );
      return;
    }

    setSolicitandoIp(true);

    // Subscreve ao tópico de resposta
    const ENVIAR_IP_TOPIC = "dados/enviar_ip";
    const SOLICITAR_IP_TOPIC = "dados/solicitar_ip";
    
    console.log("[MQTT] Iniciando solicitação de IP...");
    console.log("[MQTT] Inscrevendo em:", ENVIAR_IP_TOPIC);
    
    // Variável para controlar o timeout
    let timeoutId: NodeJS.Timeout;
    
    const handleMessage = (topic: string, message: any) => {
      // Converte message para string
      const payload = typeof message === 'string' ? message : message.toString();
      
      console.log("[MQTT] Mensagem recebida:");
      console.log("[MQTT] - Tópico:", topic);
      console.log("[MQTT] - Payload:", payload);
      
      if (topic === ENVIAR_IP_TOPIC) {
        console.log("[MQTT] ✓ IP recebido:", payload);
        
        clearTimeout(timeoutId);
        setIp(payload);
        setSolicitandoIp(false);
        
        Alert.alert(
          "Sucesso",
          `IP configurado automaticamente:\n${payload}`,
          [{ text: "OK" }]
        );
        
        // Remove o listener
        try {
          client.removeListener("message", handleMessage);
          client.unsubscribe(ENVIAR_IP_TOPIC);
        } catch (e) {
          console.log("[MQTT] Erro ao remover listener:", e);
        }
      }
    };

    // Adiciona listener
    client.on("message", handleMessage);
    
    // Subscreve ao tópico de resposta
    client.subscribe(ENVIAR_IP_TOPIC, { qos: 1 }, (err: any) => {
      if (err) {
        console.log("[MQTT] Erro ao subscrever:", err);
        setSolicitandoIp(false);
        Alert.alert("Erro", "Erro ao subscrever ao tópico MQTT");
        return;
      }
      
      console.log("[MQTT] ✓ Inscrito em:", ENVIAR_IP_TOPIC);
      
      // Publica solicitação
      console.log("[MQTT] Publicando solicitação em:", SOLICITAR_IP_TOPIC);
      client.publish(SOLICITAR_IP_TOPIC, "request_ip", { qos: 1 }, (err: any) => {
        if (err) {
          console.log("[MQTT] Erro ao publicar:", err);
          setSolicitandoIp(false);
          Alert.alert("Erro", "Erro ao enviar solicitação");
          client.removeListener("message", handleMessage);
          return;
        }
        console.log("[MQTT] ✓ Solicitação enviada!");
      });
    });

    // Timeout de 15 segundos
    timeoutId = setTimeout(() => {
      console.log("[MQTT] Timeout atingido");
      setSolicitandoIp(false);
      try {
        client.removeListener("message", handleMessage);
        client.unsubscribe(ENVIAR_IP_TOPIC);
      } catch (e) {
        console.log("[MQTT] Erro no cleanup:", e);
      }
      Alert.alert(
        "Timeout",
        "Não foi possível obter o IP automaticamente.\n\nVerifique se:\n• O sistema Python está em execução\n• O MQTT está conectado em ambos os lados"
      );
    }, 15000);
  };

  const conectarCamera = () => {
    if (!ip) {
      Alert.alert("Erro", "Digite um endereço IP válido");
      return;
    }
    
    const ipFormatado = formatarIp(ip);
    setIp(ipFormatado);
    setStart(true);
  };

  // URL da câmera (sempre usa IA agora)
  const cameraUrl = `${ip}/camera_ia`;

  return (
    <ScrollView 
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={true}
    >
      <View style={styles.container}>
        {/* Painel MQTT */}
        <View style={styles.mqttContainer}>
          <MqttPainel />
        </View>

        {/* Estatísticas de Cores */}
        <View style={styles.statsContainer}>
          <View style={styles.statsRow}>
            <View style={[styles.statBox, { backgroundColor: "#e53935" }]}>
              <Text style={styles.statLabel}>Vermelho</Text>
              <Text style={styles.statValue}>{vermelho}</Text>
            </View>
            <View style={[styles.statBox, { backgroundColor: "#43a047" }]}>
              <Text style={styles.statLabel}>Verde</Text>
              <Text style={styles.statValue}>{verde}</Text>
            </View>
            <View style={[styles.statBox, { backgroundColor: "#1e88e5" }]}>
              <Text style={styles.statLabel}>Azul</Text>
              <Text style={styles.statValue}>{azul}</Text>
            </View>
            <View style={[styles.statBox, { backgroundColor: "#757575" }]}>
              <Text style={styles.statLabel}>Outras</Text>
              <Text style={styles.statValue}>{corndef}</Text>
            </View>
          </View>
        </View>

        {/* Botão Gerar PDF */}
        <TouchableOpacity
          style={[styles.pdfButton, pdfLoading && styles.buttonDisabled]}
          onPress={gerarPdf}
          disabled={pdfLoading}
        >
          <Text style={styles.buttonText}>
            {pdfLoading ? "Gerando Relatório..." : "Gerar Relatório PDF"}
          </Text>
        </TouchableOpacity>

        {!start ? (
          <View style={styles.form}>
            <Text style={styles.title}>Configuração da Câmera</Text>
            
            <Text style={styles.label}>Endereço IP:</Text>
            <TextInput
              placeholder="192.168.0.50:5000"
              placeholderTextColor="#999"
              style={styles.input}
              value={ip}
              onChangeText={setIp}
              autoCapitalize="none"
              autoCorrect={false}
            />

            {/* Botão Conectar */}
            <TouchableOpacity
              style={[styles.button, styles.connectButton, !ip && styles.buttonDisabled]}
              disabled={!ip}
              onPress={conectarCamera}
            >
              <Text style={styles.buttonText}>Conectar</Text>
            </TouchableOpacity>

            {/* Botão Solicitar IP via MQTT */}
            <TouchableOpacity
              style={[styles.button, styles.mqttButton, solicitandoIp && styles.buttonDisabled]}
              disabled={solicitandoIp}
              onPress={solicitarIpViaMqtt}
            >
              {solicitandoIp ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={[styles.buttonText, { marginLeft: 10 }]}>
                    Solicitando...
                  </Text>
                </View>
              ) : (
                <Text style={styles.buttonText}>Obter IP Automaticamente</Text>
              )}
            </TouchableOpacity>

            {/* Informações */}
            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>Instruções:</Text>
              <Text style={styles.infoText}>
                • Digite o endereço IP manualmente no formato IP:PORTA{"\n"}
                • Ou use a opção automática via MQTT{"\n"}
                • Certifique-se que o servidor está em execução
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.streamContainer}>
            {/* Título da Stream */}
            <View style={styles.streamHeader}>
              <Text style={styles.streamTitle}>Detecção de Cores em Tempo Real</Text>
              <Text style={styles.streamSubtitle}>{ip}/camera_ia</Text>
            </View>

            {/* WebView da Câmera */}
            <View style={styles.webviewWrapper}>
              {isWeb ? (
                <iframe
                  src={cameraUrl}
                  style={styles.webviewIframe as any}
                  title="Camera Stream"
                />
              ) : (
                <WebView 
                  source={{ uri: cameraUrl }} 
                  style={styles.webview}
                  onError={() => {
                    Alert.alert(
                      "Erro de Conexão",
                      "Não foi possível conectar à câmera. Verifique o endereço IP e tente novamente."
                    );
                  }}
                />
              )}
            </View>

            {/* Botão Voltar */}
            <TouchableOpacity
              style={[styles.button, styles.backButton]}
              onPress={() => setStart(false)}
            >
              <Text style={styles.buttonText}>Voltar</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const { width } = Dimensions.get("window");

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "flex-start",
    padding: 20,
  },
  mqttContainer: {
    width: "100%",
    maxWidth: 600,
    marginBottom: 15,
  },
  statsContainer: {
    width: "100%",
    maxWidth: 600,
    marginBottom: 15,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  statBox: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statLabel: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 5,
  },
  statValue: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "bold",
  },
  pdfButton: {
    backgroundColor: "#2e7d32",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    width: "100%",
    maxWidth: 600,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  form: {
    width: "100%",
    maxWidth: 500,
    backgroundColor: "#f8f9fa",
    borderRadius: 12,
    padding: 25,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 20,
    textAlign: "center",
    color: "#212529",
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 10,
    textAlign: "left",
    color: "#495057",
    width: "100%",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ced4da",
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    width: "100%",
    marginBottom: 20,
    backgroundColor: "#ffffff",
    color: "#212529",
  },
  button: {
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 3,
  },
  connectButton: {
    backgroundColor: "#1976d2",
  },
  mqttButton: {
    backgroundColor: "#0288d1",
  },
  backButton: {
    backgroundColor: "#d32f2f",
    marginTop: 15,
  },
  buttonDisabled: {
    backgroundColor: "#bdbdbd",
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  infoBox: {
    backgroundColor: "#e3f2fd",
    borderRadius: 8,
    padding: 16,
    marginTop: 15,
    width: "100%",
    borderLeftWidth: 4,
    borderLeftColor: "#1976d2",
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 10,
    color: "#0d47a1",
  },
  infoText: {
    fontSize: 14,
    color: "#37474f",
    lineHeight: 22,
  },
  streamContainer: {
    flex: 1,
    width: "100%",
    maxWidth: 800,
    alignItems: "center",
    justifyContent: "center",
  },
  streamHeader: {
    width: "100%",
    backgroundColor: "#f8f9fa",
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  streamTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 5,
    color: "#212529",
  },
  streamSubtitle: {
    fontSize: 13,
    color: "#6c757d",
  },
  webviewWrapper: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000",
    borderRadius: 8,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  webview: {
    width: Math.min(width - 40, 800),
    height: Math.min((width - 40) * 0.75, 600),
    backgroundColor: "#000",
  },
  webviewIframe: {
    width: Math.min(width - 40, 800),
    height: Math.min((width - 40) * 0.75, 600),
    border: "none",
    display: "block",
    backgroundColor: "#000",
  },
});