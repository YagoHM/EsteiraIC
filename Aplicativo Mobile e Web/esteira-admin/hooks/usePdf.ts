import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
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
      console.log('[PDF] Iniciando geração...');

      // Gera HTML para o PDF
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 40px;
              color: #333;
            }
            h1 {
              color: #1976d2;
              border-bottom: 3px solid #1976d2;
              padding-bottom: 10px;
              margin-bottom: 30px;
            }
            .stats {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 15px;
              margin-bottom: 40px;
            }
            .stat-box {
              padding: 15px;
              border-radius: 8px;
              color: white;
              font-weight: bold;
            }
            .stat-box.verde { background-color: #43a047; }
            .stat-box.azul { background-color: #1e88e5; }
            .stat-box.vermelho { background-color: #e53935; }
            .stat-box.outras { background-color: #757575; }
            .stat-label {
              font-size: 14px;
              opacity: 0.9;
            }
            .stat-value {
              font-size: 32px;
              margin-top: 5px;
            }
            h2 {
              color: #333;
              margin-top: 40px;
              margin-bottom: 20px;
              border-bottom: 2px solid #ddd;
              padding-bottom: 8px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 20px;
            }
            th {
              background-color: #1976d2;
              color: white;
              padding: 12px;
              text-align: left;
              font-weight: bold;
            }
            td {
              padding: 10px 12px;
              border-bottom: 1px solid #ddd;
            }
            tr:nth-child(even) {
              background-color: #f8f9fa;
            }
            .color-badge {
              display: inline-block;
              padding: 4px 12px;
              border-radius: 12px;
              font-size: 12px;
              font-weight: bold;
              color: white;
            }
            .color-verde { background-color: #43a047; }
            .color-azul { background-color: #1e88e5; }
            .color-vermelho { background-color: #e53935; }
            .color-outras { background-color: #757575; }
            .footer {
              margin-top: 50px;
              padding-top: 20px;
              border-top: 1px solid #ddd;
              text-align: center;
              color: #666;
              font-size: 12px;
            }
            .total {
              font-weight: bold;
              font-size: 18px;
              margin-top: 20px;
              padding: 15px;
              background-color: #e3f2fd;
              border-radius: 8px;
              text-align: center;
            }
          </style>
        </head>
        <body>
          <h1>Relatório de Cores</h1>
          
          <div class="stats">
            <div class="stat-box verde">
              <div class="stat-label">Verde</div>
              <div class="stat-value">${verde}</div>
            </div>
            <div class="stat-box azul">
              <div class="stat-label">Azul</div>
              <div class="stat-value">${azul}</div>
            </div>
            <div class="stat-box vermelho">
              <div class="stat-label">Vermelho</div>
              <div class="stat-value">${vermelho}</div>
            </div>
            <div class="stat-box outras">
              <div class="stat-label">Outras Cores</div>
              <div class="stat-value">${corndef}</div>
            </div>
          </div>

          <div class="total">
            Total de Detecções: ${verde + azul + vermelho + corndef}
          </div>

          <h2>📋 Histórico de Detecções</h2>
          <table>
            <thead>
              <tr>
                <th>Horário</th>
                <th>Cor Detectada</th>
              </tr>
            </thead>
            <tbody>
              ${logs.map(log => {
                let colorText = '';
                let colorClass = '';
                
                // Remove prefixo "Cor:" se existir
                const value = log.value.replace('Cor:', '');
                
                // Mapeia tanto números quanto nomes de cores
                switch(value) {
                  case '2':
                  case 'Verde':
                    colorText = 'Verde';
                    colorClass = 'verde';
                    break;
                  case '3':
                  case 'Azul':
                    colorText = 'Azul';
                    colorClass = 'azul';
                    break;
                  case '4':
                  case 'Vermelho':
                    colorText = 'Vermelho';
                    colorClass = 'vermelho';
                    break;
                  case '5':
                  case 'Amarelo':
                  case 'Laranja':
                  case 'Roxo':
                    colorText = value === '5' ? 'Cor Não Definida' : value;
                    colorClass = 'outras';
                    break;
                  default:
                    colorText = 'Desconhecido';
                    colorClass = 'outras';
                }

                return `
                  <tr>
                    <td>${log.time}</td>
                    <td>
                      <span class="color-badge color-${colorClass}">${colorText}</span>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>

          <div class="footer">
            Relatório gerado em: ${new Date().toLocaleString('pt-BR')}
          </div>
        </body>
        </html>
      `;

      console.log('[PDF] HTML gerado, criando PDF...');

      if (Platform.OS === 'web') {
        // WEB: Abre em nova aba ou baixa
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(htmlContent);
          printWindow.document.close();
          setTimeout(() => {
            printWindow.print();
          }, 250);
        } else {
          Alert.alert('Erro', 'Bloqueador de pop-up ativado. Permita pop-ups para gerar o PDF.');
        }
      } else {
        // MOBILE: Usa expo-print
        const { uri } = await Print.printToFileAsync({ html: htmlContent });
        console.log('[PDF] PDF criado em:', uri);
        
        // Verifica se pode compartilhar
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(uri, {
            mimeType: 'application/pdf',
            dialogTitle: 'Salvar Relatório PDF',
            UTI: 'com.adobe.pdf'
          });
          console.log('[PDF] PDF compartilhado com sucesso');
        } else {
          Alert.alert('Sucesso', `PDF salvo em: ${uri}`);
        }
      }

      Alert.alert('Sucesso', 'Relatório PDF gerado com sucesso!');
      
    } catch (err) {
      console.error('[PDF] Erro ao gerar PDF:', err);
      Alert.alert(
        'Erro ao Gerar PDF', 
        `Detalhes: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setLoading(false);
      console.log('[PDF] Processo finalizado');
    }
  };

  return { gerarPdf, loading };
};

export default useGeneratePdf;