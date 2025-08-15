import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TextInput,
  View,
  ScrollView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { informacoesMqtt } from "@/hooks/useMqtt";

// TensorFlow imports
import * as tf from "@tensorflow/tfjs";
import * as tfReactNative from "@tensorflow/tfjs-react-native";
import * as cocoSsd from "@tensorflow-models/coco-ssd";

type Detection = {
  bbox: [number, number, number, number];
  class: string;
  score: number;
};

export default function Camera() {
  const { ultimaMsg } = informacoesMqtt("ngrok/ip", "ngrok/refresh");

  const [serverUrl, setServerUrl] = useState<string>("http://127.0.0.1:5000");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);

  // TensorFlow/model state
  const [tfReady, setTfReady] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);
  const modelRef = useRef<cocoSsd.ObjectDetection | null>(null);

  // UI / detections
  const [detections, setDetections] = useState<Detection[]>([]);
  const [lastRunMs, setLastRunMs] = useState<number | null>(null);

  const detectionIntervalRef = useRef<number | null>(null);
  const pollingMs = 1200;

  // Carrega URL salva ao montar
  useEffect(() => {
    async function loadUrl() {
      try {
        const savedUrl = await AsyncStorage.getItem("@serverUrl");
        if (savedUrl) {
          setServerUrl(savedUrl);
        }
      } catch (err) {
        console.warn("Erro ao ler AsyncStorage:", err);
      } finally {
        setLoading(false);
      }
    }
    loadUrl();
  }, []);

  // Atualiza URL quando muda no MQTT
  useEffect(() => {
    if (ultimaMsg) {
      setServerUrl(ultimaMsg);
      AsyncStorage.setItem("@serverUrl", ultimaMsg).catch((e) =>
        console.warn("Falha ao salvar URL:", e)
      );
      setError(false);
    }
  }, [ultimaMsg]);

  // Inicializa TF e modelo
  useEffect(() => {
    let mounted = true;

    async function initTfAndModel() {
      try {
        await tfReactNative.ready();
        setTfReady(true);

        const loaded = await cocoSsd.load();
        if (!mounted) return;
        modelRef.current = loaded;
        setModelLoaded(true);
      } catch (err) {
        console.error("Erro ao inicializar TF/model:", err);
        setError(true);
      }
    }
    initTfAndModel();

    return () => {
      mounted = false;
    };
  }, []);

  // Função chamada quando detectar objetos - preencha conforme necessidade
  function onObjectsDetected(detections: Detection[]) {
    // Por exemplo: console.log('Objetos detectados:', detections);
  }

  // Ajusta URL para stream de vídeo
  const streamUrl = serverUrl
    ? serverUrl.endsWith("/video")
      ? serverUrl
      : `${serverUrl.replace(/\/+$/g, "")}/video`
    : "";

  // Busca imagem JPEG e converte para tensor
  async function fetchImageTensor(uri: string) {
    try {
      const url = `${uri}${uri.includes("?") ? "&" : "?"}t=${Date.now()}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Erro ao buscar imagem: ${response.status}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const u8array = new Uint8Array(arrayBuffer);
      const imageTensor = tfReactNative.decodeJpeg(u8array);
      return imageTensor;
    } catch (err) {
      console.warn("fetchImageTensor erro:", err);
      throw err;
    }
  }

  // Roda uma detecção única
  async function runDetectionOnce() {
    if (!modelRef.current || !streamUrl) return;

    const start = Date.now();
    try {
      const imgTensor = await fetchImageTensor(streamUrl);
      const predictions = await modelRef.current.detect(imgTensor as any);

      const mapped: Detection[] = predictions.map((p: any) => ({
        bbox: p.bbox as [number, number, number, number],
        class: p.class,
        score: p.score,
      }));

      setDetections(mapped);
      setLastRunMs(Date.now() - start);

      if (mapped.length > 0) {
        try {
          onObjectsDetected(mapped);
        } catch (e) {
          console.warn("onObjectsDetected erro:", e);
        }
      }

      tf.dispose(imgTensor);
      setError(false); // limpa erros se sucesso
    } catch (err) {
      console.warn("runDetectionOnce erro:", err);
      setError(true);
    }
  }

  // Loop de detecção
  useEffect(() => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }

    if (modelLoaded && streamUrl) {
      runDetectionOnce().catch(console.warn);
      const id = setInterval(() => {
        runDetectionOnce().catch(console.warn);
      }, pollingMs);
      detectionIntervalRef.current = id as unknown as number;
    }

    return () => {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
        detectionIntervalRef.current = null;
      }
    };
  }, [modelLoaded, streamUrl]);

  if (loading || !tfReady) {
    return (
      <View style={[styles.container, { justifyContent: "center" }]}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text style={{ marginTop: 10 }}>
          Inicializando TensorFlow e carregando URL...
        </Text>
      </View>
    );
  }

  if (!serverUrl) {
    return (
      <View style={[styles.container, { justifyContent: "center" }]}>
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

      {error && (
        <Text style={{ color: "red", marginBottom: 8 }}>
          Erro ao carregar a câmera / imagem. Verifique se sua URL fornece
          snapshots JPEG (não somente MJPEG multipart).
        </Text>
      )}

      <Image
        source={{ uri: `${streamUrl}${streamUrl.includes("?") ? "&" : "?"}t=${Date.now()}` }}
        style={styles.image}
        onError={() => setError(true)}
      />

      <View style={{ width: "100%", marginTop: 12 }}>
        <Text>Modelo carregado: {modelLoaded ? "✅" : "❌"}</Text>
        <Text>Última detecção: {lastRunMs !== null ? `${lastRunMs} ms` : "—"}</Text>
        <Text>Objetos detectados: {detections.length}</Text>
      </View>

      <ScrollView style={styles.detectionsList}>
        {detections.map((d, i) => (
          <View key={i} style={styles.detectionItem}>
            <Text style={{ fontWeight: "600" }}>{d.class}</Text>
            <Text>Score: {(d.score * 100).toFixed(1)}%</Text>
            <Text>BBox: [{d.bbox.map((n) => Math.round(n)).join(", ")}]</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#fff",
    alignItems: "center",
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    width: "100%",
    padding: 10,
    marginBottom: 12,
    borderRadius: 5,
  },
  image: {
    width: 500,
    height: 300,
    resizeMode: "contain",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    backgroundColor: "#000",
  },
  detectionsList: {
    marginTop: 10,
    width: "100%",
    maxHeight: 160,
  },
  detectionItem: {
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
});
