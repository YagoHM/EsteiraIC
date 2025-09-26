import MqttPainel from '@/components/mqttPainel';
import { informacoesMqtt } from '@/hooks/useMqtt';
import React from 'react';
import { StyleSheet, View } from 'react-native';

export default function HomeScreen() {
  const {
    azul,
    verde,
    vermelho,
    corndef,
    logs,
  } = informacoesMqtt();
  const PlaceholderImage = require('@/assets/images/placeholder-modal.jpg');


  return (
    <View style={styles.container}>
      <MqttPainel />
             {/* <TouchableOpacity style={styles.button} onPress={gerarPdf} disabled={pdfLoading}>
       <Text style={styles.buttonText}>
         {pdfLoading ? 'Gerando...' : 'Gerar Relatório'}
       </Text>
     </TouchableOpacity>
  const { gerarPdf, loading: pdfLoading } = useGeneratePdf(logs, verde, azul, vermelho, corndef); */}

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
  button: {
    width: '50%',
    paddingVertical: 10,
    marginTop: 20,
    backgroundColor: '#007BFF',
    borderRadius: 5,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
  },
});
