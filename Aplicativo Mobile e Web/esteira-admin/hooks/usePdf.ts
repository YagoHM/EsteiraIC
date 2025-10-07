import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { PDFDocument, rgb } from 'react-native-pdf-lib';
import { useState } from 'react';
import { Alert, Platform } from 'react-native';

export type LogEntry = { time: string; value: string };

const useGeneratePdf = (
  logs: LogEntry[],
  verde: number,
  azul: number,
  vermelho: number,
  corndef: number
) => {
  const [loading, setLoading] = useState(false);

  const gerarPdf = async () => {
    try {
      setLoading(true);

      // Cria o PDF
      const pdfDoc = await PDFDocument.create();
      let page = pdfDoc.addPage([595.28, 841.89]);

      // Cabeçalho
      page.drawText('Relatório de Cores - Esteira IOT', {
        x: 50,
        y: 785,
        size: 20,
        color: rgb(0, 0, 0),
      });

      // Estatísticas
      let y = 735;
      page.drawText(`Verde: ${verde}`, { x: 50, y, size: 14 });
      y -= 20;
      page.drawText(`Azul: ${azul}`, { x: 50, y, size: 14 });
      y -= 20;
      page.drawText(`Vermelho: ${vermelho}`, { x: 50, y, size: 14 });
      y -= 20;
      page.drawText(`Cor N. Definida: ${corndef}`, { x: 50, y, size: 14 });

      // Histórico
      y -= 40;
      page.drawText('Histórico', { x: 50, y, size: 14 });
      y -= 20;
      page.drawText('Horário', { x: 50, y, size: 12, color: rgb(0.2, 0.2, 0.2) });
      page.drawText('Mensagem', { x: 250, y, size: 12, color: rgb(0.2, 0.2, 0.2) });
      y -= 20;

      logs.forEach(log => {
        if (y < 50) {
          page = pdfDoc.addPage([595.28, 841.89]);
          y = 785;
        }
        page.drawText(log.time, { x: 50, y, size: 10 });
        const colorText =
          log.value === '5'
            ? 'Cor N. Definida'
            : log.value === '4'
            ? 'Vermelho'
            : log.value === '3'
            ? 'Azul'
            : 'Verde';
        page.drawText(colorText, { x: 250, y, size: 10 });
        y -= 20;
      });

      // Salvar PDF
      const pdfBytes = await pdfDoc.save();

      if (Platform.OS === 'web') {
        // Web: baixa direto
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'relatorio.pdf';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        // Mobile: salva no FileSystem e compartilha
        const base64 = Buffer.from(pdfBytes).toString('base64');
        const fileUri = FileSystem.documentDirectory + 'relatorio.pdf';
        await FileSystem.writeAsStringAsync(fileUri, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        await Sharing.shareAsync(fileUri, { mimeType: 'application/pdf' });
      }
    } catch (err) {
      console.error('Erro ao gerar PDF:', err);
      Alert.alert('Erro', 'Não foi possível gerar o PDF.');
    } finally {
      setLoading(false);
    }
  };

  return { gerarPdf, loading };
};

export default useGeneratePdf;