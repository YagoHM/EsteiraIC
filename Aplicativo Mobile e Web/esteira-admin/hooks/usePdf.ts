import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { useState } from 'react';
import { Alert, Platform } from 'react-native';
type LogEntry = { time: string; value: string };

const arrayBufferToBase64 = (buffer: Uint8Array) => {
  let binary = '';
  const bytes = buffer;
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

const useGeneratePdf = (logs: LogEntry[], verde: number, azul: number, vermelho: number, corndef: number) => {
  const [loading, setLoading] = useState(false);

  const gerarPdf = async () => {
    try {
      setLoading(true);
      const pdfDoc = await PDFDocument.create();
      let page = pdfDoc.addPage([595.28, 841.89]);
      const { width, height } = page.getSize();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

      // Cabeçalho
      page.drawText('Relatório de Cores - Esteira IOT', {
        x: 50,
        y: height - 50,
        size: 20,
        font,
        color: rgb(0, 0, 0),
      });

      let y = height - 100;
      page.drawText(`Verde: ${verde}`, { x: 50, y, size: 14, font });
      y -= 20;
      page.drawText(`Azul: ${azul}`, { x: 50, y, size: 14, font });
      y -= 20;
      page.drawText(`Vermelho: ${vermelho}`, { x: 50, y, size: 14, font });
      y -= 20;
      page.drawText(`Cor N. Definida: ${corndef}`, { x: 50, y, size: 14, font });

      // Histórico
      y -= 40;
      page.drawText('Histórico', { x: 50, y, size: 14, font });
      y -= 20;
      page.drawText('Horário', { x: 50, y, size: 12, font, color: rgb(0.2, 0.2, 0.2) });
      page.drawText('Mensagem', { x: 250, y, size: 12, font, color: rgb(0.2, 0.2, 0.2) });
      y -= 20;

      logs.forEach(log => {
        if (y < 50) {
          page = pdfDoc.addPage([595.28, 841.89]);
          y = height - 50;
        }
        page.drawText(log.time, { x: 50, y, size: 10, font });
        const colorText = log.value === "5" ? "Cor N. Definida" :
                          log.value === "4" ? "Vermelho" :
                          log.value === "3" ? "Azul" :
                          "Verde";
        page.drawText(colorText, { x: 250, y, size: 10, font });
        y -= 20;
      });

      const pdfBytes = await pdfDoc.save();

      if (Platform.OS === 'web') {
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
        const base64 = arrayBufferToBase64(pdfBytes);
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
