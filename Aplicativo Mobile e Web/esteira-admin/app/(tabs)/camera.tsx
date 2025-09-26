import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { WebView } from 'react-native-webview';

// Importação condicional do hook MQTT para evitar erros
let informacoesMqtt: any;
try {
  const mqttModule = require('@/hooks/useMqtt');
  informacoesMqtt = mqttModule.informacoesMqtt;
} catch (error) {
  console.log('Hook MQTT não disponível:', error);
  informacoesMqtt = () => ({
    ultimaMsg: '',
    ngrokRefresh: () => console.log('MQTT não disponível'),
    loading: false
  });
}

const { width: screenWidth } = Dimensions.get('window');

interface ServerStatus {
  status: string;
  camera: boolean;
  test_mode?: boolean;
  ip: string;
  port: number;
  local_ip?: string;
  network_interfaces?: string[];
}

interface NetworkInterface {
  name: string;
  ip: string;
  type: string;
}

export default function Camera() {
  // Estados básicos
  const [serverUrl, setServerUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [manualUrl, setManualUrl] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [serverStatus, setServerStatus] = useState<ServerStatus | null>(null);
  const [videoMethod, setVideoMethod] = useState<'webview' | 'image'>('webview');
  const [imageRefreshKey, setImageRefreshKey] = useState(0);
  
  // Novos estados para detecção de IP
  const [availableIPs, setAvailableIPs] = useState<NetworkInterface[]>([]);
  const [scanningIPs, setScanningIPs] = useState(false);
  const [autoDiscoveryEnabled, setAutoDiscoveryEnabled] = useState(true);
  
  // Ref para controlar refresh da imagem
  const imageRefreshInterval = useRef<NodeJS.Timeout | null>(null);
  const ipScanInterval = useRef<NodeJS.Timeout | null>(null);

  // Hook MQTT (com fallback)
  const mqttData = informacoesMqtt ? informacoesMqtt("camera/ip", "camera/refresh") : {
    ultimaMsg: '',
    ngrokRefresh: () => {},
    loading: false
  };

  const { ultimaMsg, ngrokRefresh, loading: mqttLoading } = mqttData;

  // Carrega configurações salvas
  useEffect(() => {
    const loadSavedData = async () => {
      try {
        const savedUrl = await AsyncStorage.getItem('@cameraUrl');
        const savedAutoDiscovery = await AsyncStorage.getItem('@autoDiscovery');
        
        if (savedUrl) {
          console.log('URL carregada:', savedUrl);
          setServerUrl(savedUrl);
          checkStatus(savedUrl);
        }
        
        if (savedAutoDiscovery !== null) {
          setAutoDiscoveryEnabled(JSON.parse(savedAutoDiscovery));
        }
      } catch (e) {
        console.log('Erro ao carregar dados:', e);
      }
      setLoading(false);
    };
    loadSavedData();
  }, []);

  // Auto descoberta de câmeras na rede
  useEffect(() => {
    if (autoDiscoveryEnabled && !serverUrl) {
      startAutoDiscovery();
    }
    
    return () => {
      if (ipScanInterval.current) {
        clearInterval(ipScanInterval.current);
      }
    };
  }, [autoDiscoveryEnabled]);

  // Monitora mensagens MQTT para IP da câmera
  useEffect(() => {
    if (ultimaMsg) {
      try {
        const data = JSON.parse(ultimaMsg);
        if (data.camera_ip && data.camera_ip.startsWith('http')) {
          console.log('IP da câmera via MQTT:', data.camera_ip);
          setServerUrl(data.camera_ip);
          AsyncStorage.setItem('@cameraUrl', data.camera_ip);
          setError(false);
          checkStatus(data.camera_ip);
        } else if (ultimaMsg.startsWith('http')) {
          // Fallback para formato antigo
          console.log('URL via MQTT (formato antigo):', ultimaMsg);
          setServerUrl(ultimaMsg);
          AsyncStorage.setItem('@cameraUrl', ultimaMsg);
          setError(false);
          checkStatus(ultimaMsg);
        }
      } catch (e) {
        // Se não for JSON, tenta como URL simples
        if (ultimaMsg.startsWith('http')) {
          setServerUrl(ultimaMsg);
          AsyncStorage.setItem('@cameraUrl', ultimaMsg);
          checkStatus(ultimaMsg);
        }
      }
    }
  }, [ultimaMsg]);

  // Controla refresh da imagem
  useEffect(() => {
    if (videoMethod === 'image' && serverUrl && !error) {
      imageRefreshInterval.current = setInterval(() => {
        setImageRefreshKey(prev => prev + 1);
      }, 100);
    } else {
      if (imageRefreshInterval.current) {
        clearInterval(imageRefreshInterval.current);
        imageRefreshInterval.current = null;
      }
    }

    return () => {
      if (imageRefreshInterval.current) {
        clearInterval(imageRefreshInterval.current);
      }
    };
  }, [videoMethod, serverUrl, error]);

  // Função para obter IPs da rede local
  const getLocalNetworkIPs = (): string[] => {
    // Gera IPs comuns da rede local para scan
    const commonRanges = [
      '192.168.1', '192.168.0', '192.168.2',
      '10.0.0', '10.0.1', '172.16.0'
    ];
    
    const ips: string[] = [];
    commonRanges.forEach(base => {
      // Scan apenas IPs mais comuns (1-10, 100-110, 150-160, 200-210)
      const ranges = [
        [1, 10], [100, 110], [150, 160], [200, 210]
      ];
      
      ranges.forEach(([start, end]) => {
        for (let i = start; i <= end; i++) {
          ips.push(`${base}.${i}`);
        }
      });
    });
    
    return ips;
  };

  // Scan de câmeras na rede
  const scanForCameras = async (ips: string[]): Promise<NetworkInterface[]> => {
    const found: NetworkInterface[] = [];
    const promises = ips.map(async (ip) => {
      try {
        const url = `http://${ip}:5000/status`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        
        const response = await fetch(url, {
          method: 'GET',
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const data = await response.json();
          if (data.camera !== undefined) {
            found.push({
              name: `Câmera em ${ip}`,
              ip: `http://${ip}:5000`,
              type: data.camera ? 'camera_active' : 'camera_inactive'
            });
          }
        }
      } catch (e) {
        // IP não responde ou não tem câmera
      }
    });

    await Promise.all(promises);
    return found;
  };

  // Inicia descoberta automática
  const startAutoDiscovery = async () => {
    setScanningIPs(true);
    console.log('Iniciando descoberta automática de câmeras...');
    
    try {
      const localIPs = getLocalNetworkIPs();
      const cameras = await scanForCameras(localIPs);
      
      setAvailableIPs(cameras);
      
      // Se encontrou apenas uma câmera ativa, conecta automaticamente
      const activeCameras = cameras.filter(cam => cam.type === 'camera_active');
      if (activeCameras.length === 1) {
        const cameraUrl = activeCameras[0].ip + '/video';
        console.log('Conectando automaticamente:', cameraUrl);
        setServerUrl(cameraUrl);
        await AsyncStorage.setItem('@cameraUrl', cameraUrl);
        checkStatus(cameraUrl);
      }
      
    } catch (e) {
      console.log('Erro na descoberta automática:', e);
    } finally {
      setScanningIPs(false);
    }
  };

  // Função para verificar status do servidor
  const checkStatus = async (url: string) => {
    if (!url) return;
    
    try {
      const statusUrl = url.replace('/video', '/status');
      const response = await fetch(statusUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });
      
      if (response.ok) {
        const status = await response.json();
        setServerStatus(status);
        console.log('Status da câmera:', status);
        setError(false);
      } else {
        throw new Error(`Status ${response.status}`);
      }
    } catch (e) {
      console.log('Erro ao verificar status:', e);
      setServerStatus(null);
      setError(true);
      setErrorMessage('Servidor não responde. Verifique conexão.');
    }
  };

  // Formatar URL de entrada
  const formatInputUrl = (input: string): string => {
    if (!input) return '';
    
    let url = input.trim();
    
    if (!url.startsWith('http')) {
      url = 'http://' + url;
    }
    
    if (!url.includes(':5000') && !url.includes(':80')) {
      url = url + ':5000';
    }
    
    if (!url.endsWith('/video')) {
      url = url + '/video';
    }
    
    return url;
  };

  // Conectar a câmera específica
  const connectToCamera = async (cameraUrl: string) => {
    const videoUrl = cameraUrl.endsWith('/video') ? cameraUrl : cameraUrl + '/video';
    console.log('Conectando a câmera:', videoUrl);
    
    setServerUrl(videoUrl);
    await AsyncStorage.setItem('@cameraUrl', videoUrl);
    checkStatus(videoUrl);
    setError(false);
  };

  // Conectar manualmente
  const connectManually = async () => {
    if (!manualUrl.trim()) {
      Alert.alert('Erro', 'Digite um IP válido\nExemplo: 192.168.1.100');
      return;
    }

    const formattedUrl = formatInputUrl(manualUrl);
    await connectToCamera(formattedUrl);
    
    setShowManualInput(false);
    setManualUrl('');
  };

  // Refresh
  const handleRefresh = () => {
    setRefreshing(true);
    
    if (ngrokRefresh) {
      ngrokRefresh();
    }
    
    if (serverUrl) {
      checkStatus(serverUrl);
    }
    
    if (autoDiscoveryEnabled) {
      startAutoDiscovery();
    }
    
    setImageRefreshKey(prev => prev + 1);
    
    setTimeout(() => setRefreshing(false), 3000);
  };

  // Limpar dados
  const clearData = async () => {
    await AsyncStorage.multiRemove(['@cameraUrl', '@autoDiscovery']);
    setServerUrl('');
    setServerStatus(null);
    setAvailableIPs([]);
    setError(false);
    console.log('Dados limpos');
  };

  // Alternar descoberta automática
  const toggleAutoDiscovery = async () => {
    const newValue = !autoDiscoveryEnabled;
    setAutoDiscoveryEnabled(newValue);
    await AsyncStorage.setItem('@autoDiscovery', JSON.stringify(newValue));
    
    if (newValue && !serverUrl) {
      startAutoDiscovery();
    }
  };

  // URLs
  const finalStreamUrl = serverUrl.includes('/video') ? serverUrl : serverUrl + '/video';
  const imageUrl = serverUrl ? finalStreamUrl + `?t=${Date.now()}&r=${imageRefreshKey}` : '';

  // HTML customizado para WebView
  const createVideoHTML = (streamUrl: string) => `
    <!DOCTYPE html>
    <html>
    <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body {
                margin: 0;
                padding: 0;
                background: #000;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
            }
            img {
                max-width: 100%;
                max-height: 100vh;
                object-fit: contain;
            }
            .error {
                color: white;
                text-align: center;
                padding: 20px;
            }
        </style>
    </head>
    <body>
        <img id="stream" src="${streamUrl}" 
             onerror="document.body.innerHTML='<div class=\\"error\\">Erro ao carregar stream</div>'"
             onload="console.log('Stream carregado')" />
    </body>
    </html>
  `;

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.text}>Carregando...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      <View style={styles.container}>
        
        <Text style={styles.title}>🎥 Câmera IP</Text>
        
        {/* Status da câmera */}
        {serverStatus && (
          <View style={[styles.card, styles.statusCard]}>
            <Text style={styles.cardTitle}>Status da Câmera</Text>
            <Text>📡 {serverStatus.status === 'online' ? '🟢 Online' : '🔴 Offline'}</Text>
            <Text>📷 {serverStatus.camera ? '🟢 Câmera Ativa' : '🔴 Câmera Inativa'}</Text>
            <Text>💻 {serverStatus.ip}:{serverStatus.port}</Text>
            {serverStatus.local_ip && (
              <Text>🌐 IP Local: {serverStatus.local_ip}</Text>
            )}
            {serverStatus.test_mode && <Text style={styles.warning}>⚠️ Modo teste</Text>}
          </View>
        )}

        {/* Descoberta automática */}
        <View style={[styles.card, styles.discoveryCard]}>
          <Text style={styles.cardTitle}>🔍 Descoberta Automática</Text>
          
          <View style={styles.buttonRow}>
            <TouchableOpacity 
              style={[styles.button, autoDiscoveryEnabled ? styles.activeButton : styles.secondaryButton]} 
              onPress={toggleAutoDiscovery}
            >
              <Text style={styles.buttonText}>
                {autoDiscoveryEnabled ? '🟢 Ativada' : '🔴 Desativada'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.button} 
              onPress={startAutoDiscovery}
              disabled={scanningIPs}
            >
              <Text style={styles.buttonText}>
                {scanningIPs ? '🔄 Buscando...' : '🔍 Buscar Câmeras'}
              </Text>
            </TouchableOpacity>
          </View>

          {scanningIPs && (
            <View style={styles.scanningIndicator}>
              <ActivityIndicator size="small" color="#007AFF" />
              <Text style={styles.text}>Escaneando rede local...</Text>
            </View>
          )}
        </View>

        {/* Câmeras encontradas */}
        {availableIPs.length > 0 && (
          <View style={[styles.card, styles.camerasCard]}>
            <Text style={styles.cardTitle}>📡 Câmeras Encontradas</Text>
            {availableIPs.map((camera, index) => (
              <TouchableOpacity 
                key={index}
                style={[
                  styles.cameraItem,
                  camera.type === 'camera_active' ? styles.activeCameraItem : styles.inactiveCameraItem,
                  serverUrl === camera.ip + '/video' && styles.selectedCameraItem
                ]}
                onPress={() => connectToCamera(camera.ip)}
              >
                <Text style={styles.cameraName}>{camera.name}</Text>
                <Text style={styles.cameraIp}>{camera.ip}</Text>
                <Text style={styles.cameraStatus}>
                  {camera.type === 'camera_active' ? '🟢 Ativa' : '🟡 Inativa'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* URL atual */}
        {serverUrl && (
          <View style={styles.section}>
            <Text style={styles.label}>📡 URL da Câmera:</Text>
            <TextInput
              style={styles.input}
              value={finalStreamUrl}
              editable={false}
              multiline
            />
            
            <View style={styles.buttonRow}>
              <TouchableOpacity 
                style={styles.button} 
                onPress={handleRefresh}
                disabled={refreshing}
              >
                <Text style={styles.buttonText}>
                  {refreshing ? '🔄 Atualizando...' : '🔄 Atualizar'}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.button, styles.secondaryButton]} 
                onPress={() => setShowManualInput(!showManualInput)}
              >
                <Text style={styles.buttonText}>⚙️ Manual</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Controles de método de vídeo */}
        {serverUrl && (
          <View style={[styles.card, styles.methodCard]}>
            <Text style={styles.cardTitle}>📺 Método de Exibição</Text>
            <View style={styles.buttonRow}>
              <TouchableOpacity 
                style={[styles.button, videoMethod === 'webview' ? styles.activeButton : styles.secondaryButton]} 
                onPress={() => setVideoMethod('webview')}
              >
                <Text style={styles.buttonText}>📺 WebView</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.button, videoMethod === 'image' ? styles.activeButton : styles.secondaryButton]} 
                onPress={() => setVideoMethod('image')}
              >
                <Text style={styles.buttonText}>🖼️ Imagem</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.hint}>
              {videoMethod === 'webview' 
                ? '💡 Melhor qualidade, pode ter problemas em alguns dispositivos' 
                : '💡 Mais compatível, atualização automática'
              }
            </Text>
          </View>
        )}

        {/* Input manual */}
        {showManualInput && (
          <View style={[styles.card, styles.manualCard]}>
            <Text style={styles.cardTitle}>⚙️ Conexão Manual</Text>
            <Text style={styles.label}>Digite o IP da câmera:</Text>
            <TextInput
              style={styles.input}
              value={manualUrl}
              onChangeText={setManualUrl}
              placeholder="192.168.1.100"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.hint}>💡 Digite apenas o IP (ex: 192.168.1.100)</Text>
            
            <View style={styles.buttonRow}>
              <TouchableOpacity style={styles.button} onPress={connectManually}>
                <Text style={styles.buttonText}>✅ Conectar</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.button, styles.secondaryButton]} 
                onPress={() => setShowManualInput(false)}
              >
                <Text style={styles.buttonText}>❌ Fechar</Text>
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity 
              style={[styles.button, styles.dangerButton]} 
              onPress={clearData}
            >
              <Text style={styles.buttonText}>🗑️ Limpar Dados</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Erro */}
        {error && (
          <View style={[styles.card, styles.errorCard]}>
            <Text style={styles.errorTitle}>❌ Erro de Conexão</Text>
            <Text style={styles.errorText}>
              {errorMessage || 'Não foi possível conectar à câmera'}
            </Text>
            <Text style={styles.errorHint}>
              • Câmera ligada e conectada?{'\n'}
              • Celular e câmera na mesma rede Wi-Fi?{'\n'}
              • Firewall bloqueando porta 5000?{'\n'}
              • Tente alternar método de exibição{'\n'}
              • Use a descoberta automática
            </Text>
          </View>
        )}

        {/* Video Player */}
        {serverUrl && !error ? (
          <View style={styles.section}>
            <Text style={styles.label}>📹 Transmissão ao Vivo</Text>
            
            {Platform.OS === 'web' ? (
              <iframe
                src={finalStreamUrl}
                style={{
                  width: '100%',
                  height: 300,
                  border: 'none',
                  borderRadius: 8,
                  backgroundColor: '#000'
                }}
              />
            ) : videoMethod === 'image' ? (
              <View style={styles.videoContainer}>
                <Image
                  source={{ uri: imageUrl }}
                  style={styles.imageStream}
                  onError={(e) => {
                    console.log('Erro na imagem:', e.nativeEvent);
                    setError(true);
                    setErrorMessage('Erro ao carregar stream da câmera');
                  }}
                  onLoad={() => setError(false)}
                />
                <View style={styles.refreshIndicator}>
                  <ActivityIndicator size="small" color="#007AFF" />
                  <Text style={styles.refreshText}>AO VIVO</Text>
                </View>
              </View>
            ) : (
              <View style={styles.videoContainer}>
                <WebView
                  source={{ html: createVideoHTML(finalStreamUrl) }}
                  style={styles.webview}
                  startInLoadingState={true}
                  javaScriptEnabled={true}
                  domStorageEnabled={true}
                  allowsInlineMediaPlayback={true}
                  mediaPlaybackRequiresUserAction={false}
                  mixedContentMode="compatibility"
                  renderLoading={() => (
                    <View style={styles.videoLoading}>
                      <ActivityIndicator size="large" color="#007AFF" />
                      <Text style={styles.text}>Carregando transmissão...</Text>
                    </View>
                  )}
                  onError={(e) => {
                    console.log('WebView Error:', e.nativeEvent);
                    setError(true);
                    setErrorMessage('Erro no WebView. Tente método Imagem.');
                  }}
                  onHttpError={(e) => {
                    console.log('HTTP Error:', e.nativeEvent);
                    setError(true);
                    setErrorMessage('Erro HTTP. Verifique se a câmera está funcionando.');
                  }}
                  onLoadStart={() => setError(false)}
                />
              </View>
            )}
          </View>
        ) : !error && !scanningIPs && availableIPs.length === 0 ? (
          <View style={[styles.card, styles.waitingCard]}>
            <Text style={styles.cardTitle}>⏳ Procurando Câmera</Text>
            <Text style={styles.text}>
              Ative a descoberta automática ou conecte manualmente
            </Text>
            <TouchableOpacity 
              style={[styles.button, { marginTop: 15 }]} 
              onPress={() => setShowManualInput(true)}
            >
              <Text style={styles.buttonText}>⚙️ Conectar Manualmente</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Instruções */}
        <View style={[styles.card, styles.infoCard]}>
          <Text style={styles.cardTitle}>📋 Como Usar</Text>
          <Text style={styles.text}>
            1. 🟢 Ative a descoberta automática{'\n'}
            2. 🔍 App busca câmeras na rede Wi-Fi{'\n'}
            3. 📱 Toque na câmera para conectar{'\n'}
            4. 📺 Escolha método de exibição{'\n'}
            5. ⚙️ Use conexão manual se necessário{'\n'}
            6. 🌐 Certifique-se de estar na mesma rede
          </Text>
        </View>

      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    paddingBottom: 20,
  },
  container: {
    flex: 1,
    padding: 15,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  section: {
    marginBottom: 15,
  },
  card: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  discoveryCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  camerasCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  manualCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#9C27B0',
  },
  methodCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#673AB7',
  },
  errorCard: {
    backgroundColor: '#FFEBEE',
    borderLeftWidth: 4,
    borderLeftColor: '#F44336',
  },
  waitingCard: {
    backgroundColor: '#FFF3E0',
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
    alignItems: 'center',
  },
  infoCard: {
    backgroundColor: '#E3F2FD',
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    fontSize: 14,
    color: '#333',
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 10,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    flex: 1,
    alignItems: 'center',
  },
  secondaryButton: {
    backgroundColor: '#6C757D',
  },
  activeButton: {
    backgroundColor: '#28A745',
  },
  dangerButton: {
    backgroundColor: '#DC3545',
    marginTop: 10,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  text: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  hint: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 5,
  },
  warning: {
    color: '#FF8C00',
    fontWeight: 'bold',
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#D32F2F',
    marginBottom: 8,
  },
  errorText: {
    color: '#D32F2F',
    marginBottom: 8,
  },
  errorHint: {
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
  },
  scanningIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    padding: 10,
  },
});