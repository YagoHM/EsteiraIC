import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { Alert, Platform } from 'react-native';

export type SavedImage = {
  id: string;
  uri: string;
  timestamp: number;
  type: "editor" | "camera";
  specs?: {
    serialNumber: string;
    category: string;
    specifications: string;
    problems: string;
    captureTime: string;
  };
};

type FilterType = 'all' | 'editor' | 'camera';

const useImageReportPdf = () => {
  const [loading, setLoading] = useState(false);

  const gerarRelatorio = async (
    images: SavedImage[], 
    filterType: FilterType = 'all'
  ) => {
    try {
      setLoading(true);
      console.log('[PDF] Iniciando geração do relatório de imagens...');

      // Filtra imagens
      const filteredImages = images.filter(img => {
        if (filterType === 'all') return true;
        return img.type === filterType;
      });

      if (filteredImages.length === 0) {
        Alert.alert('Aviso', 'Nenhuma imagem encontrada para gerar o relatório.');
        setLoading(false);
        return;
      }

      // Estatísticas
      const totalImages = filteredImages.length;
      const editorCount = filteredImages.filter(img => img.type === 'editor').length;
      const cameraCount = filteredImages.filter(img => img.type === 'camera').length;
      const withProblems = filteredImages.filter(img => 
        img.specs?.problems && img.specs.problems !== 'Nenhum'
      ).length;

      // Agrupa por categoria
      const categoryCounts: Record<string, number> = {};
      filteredImages.forEach(img => {
        const cat = img.specs?.category || 'Sem categoria';
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
      });

      // Gera HTML
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              padding: 40px;
              color: #333;
              background: #fff;
            }
            
            .header {
              text-align: center;
              margin-bottom: 40px;
              padding-bottom: 20px;
              border-bottom: 4px solid #1976d2;
            }
            
            h1 {
              color: #1976d2;
              font-size: 32px;
              margin-bottom: 10px;
            }
            
            .subtitle {
              color: #666;
              font-size: 16px;
            }
            
            .summary {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 30px;
              border-radius: 12px;
              margin-bottom: 40px;
            }
            
            .summary h2 {
              font-size: 24px;
              margin-bottom: 20px;
            }
            
            .stats-grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 20px;
              margin-top: 20px;
            }
            
            .stat-card {
              background: rgba(255, 255, 255, 0.2);
              padding: 20px;
              border-radius: 8px;
              text-align: center;
            }
            
            .stat-value {
              font-size: 36px;
              font-weight: bold;
              display: block;
              margin-bottom: 5px;
            }
            
            .stat-label {
              font-size: 14px;
              opacity: 0.9;
            }
            
            .categories {
              background: #f8f9fa;
              padding: 25px;
              border-radius: 12px;
              margin-bottom: 40px;
            }
            
            .categories h3 {
              color: #333;
              margin-bottom: 15px;
              font-size: 20px;
            }
            
            .category-list {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 15px;
            }
            
            .category-item {
              background: white;
              padding: 15px;
              border-radius: 8px;
              border-left: 4px solid #1976d2;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            
            .category-name {
              font-weight: 600;
              color: #333;
            }
            
            .category-count {
              background: #1976d2;
              color: white;
              padding: 4px 12px;
              border-radius: 12px;
              font-weight: bold;
              font-size: 14px;
            }
            
            .image-card {
              background: white;
              border: 2px solid #e0e0e0;
              border-radius: 12px;
              padding: 25px;
              margin-bottom: 30px;
              page-break-inside: avoid;
              box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }
            
            .image-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 20px;
              padding-bottom: 15px;
              border-bottom: 2px solid #f0f0f0;
            }
            
            .serial-number {
              font-size: 20px;
              font-weight: bold;
              color: #1976d2;
            }
            
            .image-type-badge {
              display: inline-block;
              padding: 6px 16px;
              border-radius: 20px;
              font-size: 14px;
              font-weight: 600;
              color: white;
            }
            
            .badge-editor {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            }
            
            .badge-camera {
              background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            }
            
            .image-preview {
              width: 100%;
              max-width: 400px;
              height: auto;
              border-radius: 8px;
              margin: 20px auto;
              display: block;
              box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            }
            
            .specs-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 20px;
              margin-top: 20px;
            }
            
            .spec-item {
              background: #f8f9fa;
              padding: 15px;
              border-radius: 8px;
            }
            
            .spec-label {
              font-size: 12px;
              color: #666;
              text-transform: uppercase;
              font-weight: 600;
              margin-bottom: 8px;
              display: block;
            }
            
            .spec-value {
              font-size: 16px;
              color: #333;
              word-wrap: break-word;
            }
            
            .spec-full {
              grid-column: 1 / -1;
            }
            
            .problem-alert {
              background: #fff3cd;
              border-left: 4px solid #ffc107;
              padding: 15px;
              margin-top: 15px;
              border-radius: 8px;
            }
            
            .problem-alert .spec-label {
              color: #856404;
            }
            
            .problem-alert .spec-value {
              color: #856404;
              font-weight: 500;
            }
            
            .no-problem {
              background: #d4edda;
              border-left: 4px solid #28a745;
            }
            
            .no-problem .spec-label {
              color: #155724;
            }
            
            .no-problem .spec-value {
              color: #155724;
            }
            
            .footer {
              margin-top: 60px;
              padding-top: 30px;
              border-top: 2px solid #e0e0e0;
              text-align: center;
              color: #666;
            }
            
            .footer p {
              margin: 5px 0;
            }
            
            .page-break {
              page-break-before: always;
            }
            
            @media print {
              body {
                padding: 20px;
              }
              
              .image-card {
                page-break-inside: avoid;
              }
            }
          </style>
        </head>
        <body>
          <!-- CABEÇALHO -->
          <div class="header">
            <h1>Relatório de Inspeção de Imagens</h1>
            <p class="subtitle">
              Gerado em: ${new Date().toLocaleString('pt-BR', { 
                dateStyle: 'long', 
                timeStyle: 'short' 
              })}
            </p>
          </div>

          <!-- RESUMO -->
          <div class="summary">
            <h2>📊 Resumo Geral</h2>
            <div class="stats-grid">
              <div class="stat-card">
                <span class="stat-value">${totalImages}</span>
                <span class="stat-label">Total de Imagens</span>
              </div>
              <div class="stat-card">
                <span class="stat-value">${editorCount}</span>
                <span class="stat-label">🎨 Editor</span>
              </div>
              <div class="stat-card">
                <span class="stat-value">${cameraCount}</span>
                <span class="stat-label">📸 Câmera</span>
              </div>
              <div class="stat-card">
                <span class="stat-value">${withProblems}</span>
                <span class="stat-label">⚠️ Com Problemas</span>
              </div>
            </div>
          </div>

          <!-- CATEGORIAS -->
          <div class="categories">
            <h3>📂 Distribuição por Categorias</h3>
            <div class="category-list">
              ${Object.entries(categoryCounts).map(([cat, count]) => `
                <div class="category-item">
                  <span class="category-name">${cat}</span>
                  <span class="category-count">${count}</span>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- LISTA DE IMAGENS -->
          ${filteredImages.map((img, index) => {
            const hasProblems = img.specs?.problems && img.specs.problems !== 'Nenhum';
            
            return `
              ${index > 0 && index % 3 === 0 ? '<div class="page-break"></div>' : ''}
              
              <div class="image-card">
                <div class="image-header">
                  <div class="serial-number">
                    ${img.specs?.serialNumber || 'Sem número de série'}
                  </div>
                  <span class="image-type-badge badge-${img.type}">
                    ${img.type === 'editor' ? '🎨 Editor' : '📸 Câmera'}
                  </span>
                </div>

                <img src="${img.uri}" class="image-preview" alt="Imagem ${index + 1}" />

                <div class="specs-grid">
                  <div class="spec-item">
                    <span class="spec-label">Categoria</span>
                    <span class="spec-value">${img.specs?.category || 'Não especificado'}</span>
                  </div>

                  <div class="spec-item">
                    <span class="spec-label">Data de Captura</span>
                    <span class="spec-value">${img.specs?.captureTime || new Date(img.timestamp).toLocaleString('pt-BR')}</span>
                  </div>

                  <div class="spec-item spec-full">
                    <span class="spec-label">Especificações</span>
                    <span class="spec-value">${img.specs?.specifications || 'Não especificado'}</span>
                  </div>
                </div>

                <div class="${hasProblems ? 'problem-alert' : 'no-problem'} spec-item spec-full">
                  <span class="spec-label">${hasProblems ? '⚠️ Problemas Identificados' : '✅ Status'}</span>
                  <span class="spec-value">${img.specs?.problems || 'Nenhum problema identificado'}</span>
                </div>
              </div>
            `;
          }).join('')}

          <!-- RODAPÉ -->
          <div class="footer">
            <p><strong>Relatório gerado automaticamente pelo Sistema de Inspeção</strong></p>
            <p>Total de ${totalImages} imagem(ns) • ${withProblems} com problemas</p>
            <p>Filtro aplicado: ${
              filterType === 'all' ? 'Todas as imagens' :
              filterType === 'editor' ? 'Apenas Editor' :
              'Apenas Câmera'
            }</p>
          </div>
        </body>
        </html>
      `;

      console.log('[PDF] HTML gerado, criando PDF...');

      if (Platform.OS === 'web') {
        // WEB: Abre em nova aba para imprimir
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(htmlContent);
          printWindow.document.close();
          setTimeout(() => {
            printWindow.print();
          }, 500);
        } else {
          Alert.alert('Erro', 'Bloqueador de pop-up ativado. Permita pop-ups para gerar o PDF.');
        }
      } else {
        // MOBILE: Usa expo-print
        const { uri } = await Print.printToFileAsync({ 
          html: htmlContent,
          base64: false
        });
        
        console.log('[PDF] PDF criado em:', uri);
        
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(uri, {
            mimeType: 'application/pdf',
            dialogTitle: 'Salvar Relatório de Inspeção',
            UTI: 'com.adobe.pdf'
          });
          console.log('[PDF] PDF compartilhado com sucesso');
        } else {
          Alert.alert('Sucesso', `PDF salvo em: ${uri}`);
        }
      }

      Alert.alert('Sucesso', `Relatório gerado com ${totalImages} imagem(ns)!`);
      
    } catch (err) {
      console.error('[PDF] Erro ao gerar relatório:', err);
      Alert.alert(
        'Erro ao Gerar Relatório', 
        `Detalhes: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setLoading(false);
      console.log('[PDF] Processo finalizado');
    }
  };

  return { gerarRelatorio, loading };
};

export default useImageReportPdf;