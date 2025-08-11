import { informacoesMqtt } from '@/hooks/useMqtt'; // hook MQTT
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';

export default function Camera() {
  const { ultimaMsg, ngrokRefresh } = informacoesMqtt("ngrok/ip","ngrok/refresh");  
   const [serverUrl, setServerUrl] = useState('http://127.0.0.1:5000');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Carrega URL salva no AsyncStorage ao montar
  useEffect(() => {
    async function loadUrl() {
      const savedUrl = await AsyncStorage.getItem('@serverUrl');
      if (savedUrl) {
        setServerUrl(savedUrl);
      }
      setLoading(false);
    }
    loadUrl();
  }, []);

  // Atualiza URL quando chega uma nova pelo MQTT
  useEffect(() => {
    if (ultimaMsg) {
      setServerUrl(ultimaMsg);
      AsyncStorage.setItem('@serverUrl', ultimaMsg);
      setError(false); // Resetar erro se veio uma nova URL
    }
  }, [ultimaMsg]);

  // Função para montar URL correta
  const streamUrl = serverUrl.endsWith('/video') ? serverUrl : `${serverUrl}/video`;

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text style={{ marginTop: 10 }}>Carregando URL do servidor...</Text>
      </View>
    );
  }

  if (!serverUrl) {
    return (
      <View style={[styles.container, { justifyContent: 'center' }]}>
        <Text>Nenhuma URL disponível ainda.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>URL do servidor (ngrok):</Text>
      <TextInput
        style={styles.input}
        value={streamUrl}
        placeholder="Esperando a URL do servidor..."
        editable={false}
      />


      {error ? (
        <Text style={{ color: 'red' }}>Erro ao carregar a câmera</Text>
      ) : (
        <Image
          source={{ uri: streamUrl }}
          style={styles.image}
          onError={() => setError(true)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    width: '100%',
    padding: 10,
    marginBottom: 20,
    borderRadius: 5,
  },
  image: {
    width: 500,
    height: 300,
    resizeMode: 'contain',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
  },
});
