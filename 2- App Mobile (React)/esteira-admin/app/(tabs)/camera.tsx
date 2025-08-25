import { informacoesMqtt } from '@/hooks/useMqtt';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { WebView } from 'react-native-webview';

export default function Camera() {
  const { ultimaMsg } = informacoesMqtt("ngrok/ip", "ngrok/refresh");
  const [serverUrl, setServerUrl] = useState('http://127.0.0.1:5000');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function loadUrl() {
      const savedUrl = await AsyncStorage.getItem('@serverUrl');
      if (savedUrl) setServerUrl(savedUrl);
      setLoading(false);
    }
    loadUrl();
  }, []);

  useEffect(() => {
    if (ultimaMsg) {
      setServerUrl(ultimaMsg);
      AsyncStorage.setItem('@serverUrl', ultimaMsg);
      setError(false);
    }
  }, [ultimaMsg]);

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
        <Text style={{ color: 'red' }}>Erro ao carregar o vídeo</Text>
      ) : Platform.OS === 'web' ? (
        // Para web: iframe funciona melhor
        <iframe
          src={streamUrl}
          style={{ width: '100%', height: 300, border: 'none' }}
        />
      ) : (
        // Para mobile: WebView
        <WebView
          source={{ uri: streamUrl }}
          style={styles.video}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          onError={(e) => {
            console.log("Erro no vídeo:", e.nativeEvent);
            setError(true);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 16, marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#ccc', width: '100%', padding: 10, marginBottom: 20, borderRadius: 5 },
  video: { width: '100%', height: 300, backgroundColor: '#000', borderRadius: 8 },
});
