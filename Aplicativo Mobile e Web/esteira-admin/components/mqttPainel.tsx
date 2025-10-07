import ImageViewer from '@/components/imageViewer';
import { informacoesMqtt } from '@/hooks/useMqtt';
import { ActivityIndicator, Button, StyleSheet, View } from 'react-native';

export default function MqttPainel() {
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

  if (loading) return <ActivityIndicator size="large" style={styles.loading} />;

  const img = require('@/assets/images/placeHolder.jpg');

  return (
    <View style={styles.container}>
      <ImageViewer imgSource={img} />
      <Button title={ligarDesligarEstado} onPress={alterarEstadoEsteira} />
      {/* <Text style={styles.text}>Vermelho: {vermelho}</Text>
      <Text style={styles.text}>Verde: {verde}</Text>
      <Text style={styles.text}>Azul: {azul}</Text>
      <Text style={styles.text}>Cor N. Definida: {corndef}</Text> */}
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  text: {
    fontSize: 16,
    marginVertical: 4,
  },
});
