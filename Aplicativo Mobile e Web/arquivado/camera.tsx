import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Dimensions, Platform } from "react-native";

export default function CameraScreen() {
  const [ip, setIp] = useState("");
  const [start, setStart] = useState(false);

  const isWeb = Platform.OS === "web";
  const { width } = Dimensions.get("window");

  return (
    <View style={styles.container}>
      {!start ? (
        <View style={styles.form}>
          <Text style={styles.label}>Digite o IP da câmera:</Text>
          <TextInput
            placeholder="ex: http://192.168.0.50:5000/camera_normal"
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
          {isWeb ? (
            <iframe
              src={ip}
              style={{ width: width - 40, height: 400, borderRadius: 10, border: "none", marginBottom: 20 }}
            />
          ) : (
            // @ts-ignore
            <WebView source={{ uri: ip }} style={styles.webview} />
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
    backgroundColor: "#f8f9fa",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  form: {
    width: "100%",
    maxWidth: 400,
  },
  label: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  button: {
    backgroundColor: "#007bff",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
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
});
