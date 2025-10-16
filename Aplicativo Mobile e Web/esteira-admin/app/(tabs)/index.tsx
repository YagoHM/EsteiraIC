import MqttPainel from "@/components/mqttPainel";
import { informacoesMqtt } from "@/hooks/useMqtt";
import useGeneratePdf from "@/hooks/usePdf";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { WebView } from "react-native-webview";

type SavedImage = {
  id: string;
  uri: string;
  timestamp: number;
  type: "editor" | "camera";
  specs?: {
    serialNumber: string;
    category: string;
    specifications: string;
    problems: string;
    captureTime: string;
  };
};

export default function Index() {
  const PADRAO_IP = "http://10.153.0.116:5000";

  const [ip, setIp] = useState(PADRAO_IP);
  const [start, setStart] = useState(false);
  const [solicitandoIp, setSolicitandoIp] = useState(false);
  const [showSpecsModal, setShowSpecsModal] = useState(false);
  const [capturedImageUri, setCapturedImageUri] = useState<string>("");
  const [capturandoImagem, setCapturandoImagem] = useState(false);
  
  const [serialNumber, setSerialNumber] = useState("");
  const [category, setCategory] = useState("");
  const [specifications, setSpecifications] = useState("");
  const [problems, setProblems] = useState("");

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

  const formatarIp = (ipInput: string) => {
    let formatted = ipInput.trim();
    if (!formatted.startsWith("http://") && !formatted.startsWith("https://")) {
      formatted = "http://" + formatted;
    }
    return formatted;
  };

  const solicitarIpViaMqtt = () => {
    if (!client || !client.connected) {
      Alert.alert(
        "Erro de Conexão",
        "MQTT não está conectado. Verifique a conexão e tente novamente."
      );
      return;
    }

    setSolicitandoIp(true);
    const ENVIAR_IP_TOPIC = "dados/enviar_ip";
    const SOLICITAR_IP_TOPIC = "dados/solicitar_ip";
    
    let timeoutId: NodeJS.Timeout;
    const handleMessage = (topic: string, message: any) => {
      const payload = typeof message === 'string' ? message : message.toString();
      
      if (topic === ENVIAR_IP_TOPIC) {
        clearTimeout(timeoutId);
        setIp(payload);
        setSolicitandoIp(false);
        
        Alert.alert("Sucesso", `IP configurado automaticamente:\n${payload}`, [{ text: "OK" }]);
        
        try {
          client.removeListener("message", handleMessage);
          client.unsubscribe(ENVIAR_IP_TOPIC);
        } catch (e) {
          console.log("[MQTT] Erro ao remover listener:", e);
        }
      }
    };

    client.on("message", handleMessage);
    client.subscribe(ENVIAR_IP_TOPIC, { qos: 1 }, (err: any) => {
      if (err) {
        setSolicitandoIp(false);
        Alert.alert("Erro", "Erro ao subscrever ao tópico MQTT");
        return;
      }
      
      client.publish(SOLICITAR_IP_TOPIC, "request_ip", { qos: 1 }, (err: any) => {
        if (err) {
          setSolicitandoIp(false);
          Alert.alert("Erro", "Erro ao enviar solicitação");
          client.removeListener("message", handleMessage);
          return;
        }
      });
    });

    timeoutId = setTimeout(() => {
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

  const captureImage = async () => {
    try {
      setCapturandoImagem(true);
      const timestamp = Date.now();
      const captureUrl = `${ip}/camera_ia/capture?t=${timestamp}`;
      
      console.log("[CAMERA] Iniciando captura de:", captureUrl);
      
      const response = await fetch(captureUrl, {
        method: 'GET',
        headers: {
          'Accept': 'image/jpeg, image/png, image/*',
        }
      });
      
      console.log("[CAMERA] Status:", response.status);
      
      if (!response.ok) {
        throw new Error(`Erro HTTP ${response.status}`);
      }
      
      const blob = await response.blob();
      console.log("[CAMERA] Blob recebido:", blob.size, "bytes");
      
      if (blob.size === 0) {
        throw new Error("Imagem vazia recebida do servidor");
      }
      
      const reader = new FileReader();
      
      reader.onload = () => {
        const base64String = reader.result as string;
        console.log("[CAMERA] Imagem convertida para base64");
        
        setCapturedImageUri(base64String);
        setShowSpecsModal(true);
        setCapturandoImagem(false);
        
        Alert.alert("Sucesso", "Imagem capturada!");
      };
      
      reader.onerror = () => {
        console.error("[CAMERA] Erro ao ler arquivo");
        setCapturandoImagem(false);
        Alert.alert("Erro", "Falha ao processar imagem");
      };
      
      reader.readAsDataURL(blob);
      
    } catch (error) {
      console.error("[CAMERA] Erro:", error);
      setCapturandoImagem(false);
      
      const msg = error instanceof Error ? error.message : String(error);
      Alert.alert(
        "Erro ao Capturar",
        `${msg}\n\nVerifique:\n• URL: ${ip}/camera_ia/capture\n• Servidor rodando\n• Câmera conectada`
      );
    }
  };

  const saveImageWithSpecs = async () => {
    if (!serialNumber.trim()) {
      Alert.alert("Atenção", "Por favor, preencha o número de série.");
      return;
    }

    try {
      const now = new Date();
      const captureTime = now.toLocaleString("pt-BR");

      const newImage: SavedImage = {
        id: Date.now().toString(),
        uri: capturedImageUri,
        timestamp: Date.now(),
        type: "camera",
        specs: {
          serialNumber: serialNumber.trim(),
          category: category.trim() || "Sem categoria",
          specifications: specifications.trim() || "Não especificado",
          problems: problems.trim() || "Nenhum",
          captureTime,
        },
      };

      if (Platform.OS === "web") {
        const DB_NAME = "StickerAppDB";
        const STORE_NAME = "images";
        
        const initDB = (): Promise<IDBDatabase> => {
          return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, 1);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
            request.onupgradeneeded = (event) => {
              const db = (event.target as IDBOpenDBRequest).result;
              if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: "id" });
              }
            };
          });
        };

        const db = await initDB();
        const transaction = db.transaction([STORE_NAME], "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        await new Promise((resolve, reject) => {
          const request = store.put(newImage);
          request.onsuccess = () => resolve(undefined);
          request.onerror = () => reject(request.error);
        });
      } else {
        const stored = await AsyncStorage.getItem("saved_images");
        const images = stored ? JSON.parse(stored) : [];
        images.push(newImage);
        await AsyncStorage.setItem("saved_images", JSON.stringify(images));
      }

      setSerialNumber("");
      setCategory("");
      setSpecifications("");
      setProblems("");
      setShowSpecsModal(false);
      setCapturedImageUri("");

      Alert.alert("Sucesso", "Imagem salva na galeria!", [{ text: "OK" }]);
    } catch (error) {
      console.error("Erro ao salvar imagem:", error);
      Alert.alert("Erro", "Não foi possível salvar a imagem.");
    }
  };

  const cameraUrl = `${ip}/camera_ia`;

  return (
    <ScrollView 
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={true}
    >
      <View style={styles.container}>
        <View style={styles.mqttContainer}>
          <MqttPainel />
        </View>

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

            <TouchableOpacity
              style={[styles.button, styles.connectButton, !ip && styles.buttonDisabled]}
              disabled={!ip}
              onPress={conectarCamera}
            >
              <Text style={styles.buttonText}>Conectar</Text>
            </TouchableOpacity>

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
            <View style={styles.streamHeader}>
              <Text style={styles.streamTitle}>Detecção de Cores em Tempo Real</Text>
              <Text style={styles.streamSubtitle}>{ip}/camera_ia</Text>
            </View>

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

            <TouchableOpacity
              style={[styles.button, styles.captureButton, capturandoImagem && styles.buttonDisabled]}
              onPress={captureImage}
              disabled={capturandoImagem}
            >
              <Text style={styles.buttonText}>
                {capturandoImagem ? "Capturando..." : "📸 Capturar Imagem"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.backButton]}
              onPress={() => setStart(false)}
            >
              <Text style={styles.buttonText}>Voltar</Text>
            </TouchableOpacity>
          </View>
        )}

        <Modal
          visible={showSpecsModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowSpecsModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Especificações da Imagem</Text>
              
              <ScrollView style={styles.modalScroll}>
                <Text style={styles.modalLabel}>Número de Série *</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Ex: SN-2025-001"
                  placeholderTextColor="#999"
                  value={serialNumber}
                  onChangeText={setSerialNumber}
                />

                <Text style={styles.modalLabel}>Categoria</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Ex: Eletrônicos, Peças, etc."
                  placeholderTextColor="#999"
                  value={category}
                  onChangeText={setCategory}
                />

                <Text style={styles.modalLabel}>Especificações</Text>
                <TextInput
                  style={[styles.modalInput, styles.modalTextArea]}
                  placeholder="Descreva as especificações..."
                  placeholderTextColor="#999"
                  value={specifications}
                  onChangeText={setSpecifications}
                  multiline
                  numberOfLines={3}
                />

                <Text style={styles.modalLabel}>Problemas Identificados</Text>
                <TextInput
                  style={[styles.modalInput, styles.modalTextArea]}
                  placeholder="Descreva os problemas..."
                  placeholderTextColor="#999"
                  value={problems}
                  onChangeText={setProblems}
                  multiline
                  numberOfLines={3}
                />

                <Text style={styles.modalInfo}>
                  * Campos obrigatórios{"\n"}
                  Hora da captura será salva automaticamente
                </Text>
              </ScrollView>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonCancel]}
                  onPress={() => {
                    setShowSpecsModal(false);
                    setSerialNumber("");
                    setCategory("");
                    setSpecifications("");
                    setProblems("");
                    setCapturedImageUri("");
                  }}
                >
                  <Text style={styles.modalButtonText}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonSave]}
                  onPress={saveImageWithSpecs}
                >
                  <Text style={styles.modalButtonText}>Salvar na Galeria</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </ScrollView>
  );
}

const { width: screenWidth } = Dimensions.get("window");

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
  captureButton: {
    backgroundColor: "#7b1fa2",
    marginTop: 15,
  },
  backButton: {
    backgroundColor: "#d32f2f",
    marginTop: 5,
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
    width: Math.min(screenWidth - 40, 800),
    height: Math.min((screenWidth - 40) * 0.75, 600),
    backgroundColor: "#000",
  },
  webviewIframe: {
    width: Math.min(screenWidth - 40, 800),
    height: Math.min((screenWidth - 40) * 0.75, 600),
    border: "none",
    display: "block",
    backgroundColor: "#000",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 25,
    width: "100%",
    maxWidth: 500,
    maxHeight: "90%",
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#212529",
    marginBottom: 20,
    textAlign: "center",
  },
  modalScroll: {
    maxHeight: 400,
  },
  modalLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#495057",
    marginBottom: 8,
    marginTop: 12,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: "#ced4da",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: "#f8f9fa",
    color: "#212529",
  },
  modalTextArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  modalInfo: {
    fontSize: 12,
    color: "#6c757d",
    marginTop: 15,
    fontStyle: "italic",
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
    gap: 10,
  },
  modalButton: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
  },
  modalButtonCancel: {
    backgroundColor: "#6c757d",
  },
  modalButtonSave: {
    backgroundColor: "#2e7d32",
  },
  modalButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});