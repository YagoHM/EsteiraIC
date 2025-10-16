import Button from "@/components/button";
import CircleButton from "@/components/circleButton";
import EmojiList from "@/components/emojiList";
import EmojiPicker from "@/components/emojiPicker";
import EmojiSticker from "@/components/emojiSticker";
import IconButton from "@/components/iconButton";
import ImageViewer from "@/components/imageViewer";
import useImageReportPdf from "@/hooks/useImageReportPdf";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ImageSourcePropType,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import ViewShot, { captureRef } from "react-native-view-shot";

const PlaceholderImage = require("@/assets/images/placeHolder.jpg");

// Carregar html2canvas apenas no Web
let html2canvas: typeof import("html2canvas") | null = null;
if (Platform.OS === "web") {
  html2canvas = require("html2canvas");
}

type SavedImage = {
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

// IndexedDB (Web)
const DB_NAME = "StickerAppDB";
const STORE_NAME = "images";

const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
  });
};

const saveImageToIndexedDB = async (image: SavedImage): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(image);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
};

const getImagesFromIndexedDB = async (): Promise<SavedImage[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
};

const deleteImageFromIndexedDB = async (id: string): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
};

export default function EditarFoto() {
  const [selectedImage, setSelectedImage] = useState<string | undefined>(undefined);
  const [showAppOptions, setShowAppOptions] = useState<boolean>(false);
  const [isModalVisible, setIsModalVisible] = useState<boolean>(false);
  const [pickedEmoji, setPickedEmoji] = useState<ImageSourcePropType | undefined>(undefined);

  const [showGallery, setShowGallery] = useState<boolean>(false);
  const [savedImages, setSavedImages] = useState<SavedImage[]>([]);
  const [galleryCategory, setGalleryCategory] = useState<"all" | "editor" | "camera">("all");

  const [showSpecsModal, setShowSpecsModal] = useState<boolean>(false);
  const [showImageSpecs, setShowImageSpecs] = useState<SavedImage | null>(null);
  const [showReportModal, setShowReportModal] = useState<boolean>(false);

  // Campos para specs
  const [serialNumber, setSerialNumber] = useState("");
  const [category, setCategory] = useState("");
  const [specifications, setSpecifications] = useState("");
  const [problems, setProblems] = useState("");
  const [pendingSaveUri, setPendingSaveUri] = useState<string>("");

  // Refs para captura
  const nativeRef = useRef<ViewShot | null>(null);
  const webRef = useRef<HTMLDivElement | null>(null);

  // Hook de relatório PDF
  const { gerarRelatorio, loading: reportLoading } = useImageReportPdf();

  useEffect(() => {
    const loadSavedImages = async () => {
      try {
        if (Platform.OS === "web") {
          const images = await getImagesFromIndexedDB();
          setSavedImages(images.sort((a, b) => b.timestamp - a.timestamp));
        } else {
          const stored = await AsyncStorage.getItem("saved_images");
          if (stored) {
            const images: SavedImage[] = JSON.parse(stored);
            setSavedImages(images.sort((a, b) => b.timestamp - a.timestamp));
          }
        }
      } catch (e) {
        console.error("Erro ao carregar imagens:", e);
      }
    };

    loadSavedImages();
  }, []);

  

  const pickImageAsync = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        setSelectedImage(result.assets[0].uri);
        setShowAppOptions(true);
        setShowGallery(false);
      } else {
        Alert.alert("Atenção", "Você não selecionou nenhuma imagem.");
      }
    } catch (error) {
      console.error("Erro ao escolher imagem:", error);
      Alert.alert("Erro", "Não foi possível selecionar a imagem.");
    }
  };

  const pickImageFromGallery = () => {
    if (savedImages.length === 0) {
      Alert.alert("Galeria Vazia", "Não há imagens salvas na galeria.");
      return;
    }
    setShowGallery(true);
  };

  const useGalleryImage = (uri: string) => {
    setSelectedImage(uri);
    setShowAppOptions(true);
    setShowGallery(false);
    setPickedEmoji(undefined);
  };

  const onReset = () => {
    setSelectedImage(undefined);
    setShowAppOptions(false);
    setPickedEmoji(undefined);
  };

  const onAddSticker = () => setIsModalVisible(true);
  const onModalClose = () => setIsModalVisible(false);

  const openReportModal = () => {
    if (savedImages.length === 0) {
      Alert.alert("Aviso", "Não há imagens para gerar relatório.");
      return;
    }
    setShowReportModal(true);
  };

  const onSaveImageAsync = async () => {
    if (Platform.OS !== "web") {
      try {
        if (!nativeRef.current) {
          Alert.alert("Erro", "Referência da imagem não encontrada");
          return;
        }

        const uri = await captureRef(nativeRef.current, {
          result: "tmpfile",
          height: 440,
          width: 320,
          quality: 1,
          format: "png",
        });

        setPendingSaveUri(uri as string);
        setShowSpecsModal(true);
      } catch (e) {
        console.error("Erro salvando imagem (native):", e);
        Alert.alert("Erro", "Não foi possível salvar a imagem.");
      }
    } else {
      try {
        if (!webRef.current || !html2canvas) {
          Alert.alert("Erro", "Erro ao capturar imagem");
          return;
        }

        const canvas = await html2canvas(webRef.current, {
          scale: 2,
          backgroundColor: null,
          width: 320,
          height: 440,
          logging: false,
          useCORS: true,
          allowTaint: true,
        });

        const tryDownloadFromBlob = () =>
          new Promise<string | null>((resolve) => {
            try {
              canvas.toBlob(
                (blob) => {
                  if (!blob) return resolve(null);
                  const reader = new FileReader();
                  reader.onloadend = () => resolve(reader.result as string);
                  reader.readAsDataURL(blob);
                },
                "image/png",
                1
              );
            } catch {
              resolve(null);
            }
          });

        let dataUrl = await tryDownloadFromBlob();

        if (!dataUrl) {
          try {
            dataUrl = canvas.toDataURL("image/png", 1.0);
          } catch (err) {
            console.error("Falha no toDataURL:", err);
            Alert.alert("Erro", "Não foi possível gerar a imagem.");
            return;
          }
        }

        setPendingSaveUri(dataUrl);
        setShowSpecsModal(true);
      } catch (e) {
        console.error("Erro no web save:", e);
        Alert.alert("Erro", "Não foi possível salvar a imagem.");
      }
    }
  };

  const saveImageWithSpecs = async () => {
    if (!serialNumber.trim()) {
      Alert.alert("Campo Obrigatório", "Por favor, preencha o número de série.");
      return;
    }

    try {
      const now = new Date();
      const captureTime = now.toLocaleString("pt-BR");

      const newImage: SavedImage = {
        id: Date.now().toString(),
        uri: pendingSaveUri,
        timestamp: Date.now(),
        type: "editor",
        specs: {
          serialNumber: serialNumber.trim(),
          category: category.trim() || "Sem categoria",
          specifications: specifications.trim() || "Não especificado",
          problems: problems.trim() || "Nenhum",
          captureTime,
        },
      };

      if (Platform.OS === "web") {
        await saveImageToIndexedDB(newImage);

        const link = document.createElement("a");
        link.href = pendingSaveUri;
        link.download = `editor-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        const permission = await MediaLibrary.requestPermissionsAsync(false);
        if (permission.granted) {
          await MediaLibrary.saveToLibraryAsync(pendingSaveUri);
        }

        const stored = await AsyncStorage.getItem("saved_images");
        const images: SavedImage[] = stored ? JSON.parse(stored) : [];
        images.push(newImage);
        await AsyncStorage.setItem("saved_images", JSON.stringify(images));
      }

      setSavedImages((prev) => [newImage, ...prev]);

      setSerialNumber("");
      setCategory("");
      setSpecifications("");
      setProblems("");
      setPendingSaveUri("");
      setShowSpecsModal(false);

      Alert.alert("Sucesso", "Imagem salva com sucesso!");
    } catch (e) {
      console.error("Erro salvando imagem:", e);
      Alert.alert("Erro", "Não foi possível salvar a imagem.");
    }
  };

  const deleteImage = async (id: string) => {
    try {
      Alert.alert("Confirmar Exclusão", "Deseja realmente excluir esta imagem?", [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            if (Platform.OS === "web") {
              await deleteImageFromIndexedDB(id);
            } else {
              const stored = await AsyncStorage.getItem("saved_images");
              if (stored) {
                const images: SavedImage[] = JSON.parse(stored);
                const filtered = images.filter((img) => img.id !== id);
                await AsyncStorage.setItem("saved_images", JSON.stringify(filtered));
              }
            }
            setSavedImages((prev) => prev.filter((img) => img.id !== id));
            Alert.alert("Sucesso", "Imagem excluída!");
          },
        },
      ]);
    } catch (e) {
      console.error("Erro ao deletar imagem:", e);
      Alert.alert("Erro", "Não foi possível excluir a imagem.");
    }
  };

  const resaveImage = async (image: SavedImage) => {
    try {
      if (Platform.OS === "web") {
        const link = document.createElement("a");
        link.href = image.uri;
        link.download = `resave-${image.id}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        Alert.alert("Sucesso", "Imagem baixada novamente!");
      } else {
        const permission = await MediaLibrary.requestPermissionsAsync(false);
        if (permission.granted) {
          await MediaLibrary.saveToLibraryAsync(image.uri);
          Alert.alert("Sucesso", "Imagem salva novamente na galeria!");
        } else {
          Alert.alert("Permissão Negada", "Não foi possível salvar a imagem.");
        }
      }
    } catch (e) {
      console.error("Erro ao salvar novamente:", e);
      Alert.alert("Erro", "Não foi possível salvar a imagem.");
    }
  };

  const filteredImages = savedImages.filter((img) => {
    if (galleryCategory === "all") return true;
    return img.type === galleryCategory;
  });

  const editorCount = savedImages.filter((img) => img.type === "editor").length;
  const cameraCount = savedImages.filter((img) => img.type === "camera").length;

  const renderComposableContent = () => (
    <View style={{ width: "100%", height: "100%", position: "relative" }}>
      <ImageViewer imgSource={PlaceholderImage} selectedImage={selectedImage} />
      {pickedEmoji && (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 10,
          }}
          pointerEvents="auto"
        >
          <EmojiSticker imageSize={80} stickerSource={pickedEmoji} />
        </View>
      )}
    </View>
  );

  if (showGallery) {
    return (
      <GestureHandlerRootView style={styles.container}>
        <View style={styles.galleryHeader}>
          <Text style={styles.galleryTitle}>Galeria ({savedImages.length})</Text>
          <TouchableOpacity onPress={() => setShowGallery(false)} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.categoryFilters}>
          <TouchableOpacity
            style={[styles.filterButton, galleryCategory === "all" && styles.filterButtonActive]}
            onPress={() => setGalleryCategory("all")}
          >
            <Text style={[styles.filterText, galleryCategory === "all" && styles.filterTextActive]}>
              Todas ({savedImages.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterButton, galleryCategory === "editor" && styles.filterButtonActive]}
            onPress={() => setGalleryCategory("editor")}
          >
            <Text
              style={[
                styles.filterText,
                galleryCategory === "editor" && styles.filterTextActive,
              ]}
            >
              🎨 Editor ({editorCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterButton, galleryCategory === "camera" && styles.filterButtonActive]}
            onPress={() => setGalleryCategory("camera")}
          >
            <Text
              style={[
                styles.filterText,
                galleryCategory === "camera" && styles.filterTextActive,
              ]}
            >
              📸 Câmera ({cameraCount})
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.galleryScroll} contentContainerStyle={styles.galleryContent}>
          {filteredImages.length === 0 ? (
            <Text style={styles.emptyText}>
              {galleryCategory === "all"
                ? "Nenhuma imagem salva ainda"
                : `Nenhuma imagem de ${galleryCategory === "editor" ? "editor" : "câmera"}`}
            </Text>
          ) : (
            filteredImages.map((img) => (
              <View key={img.id} style={styles.galleryItem}>
                <TouchableOpacity onPress={() => setShowImageSpecs(img)}>
                  <Image source={{ uri: img.uri }} style={styles.galleryImage} />
                  <View style={styles.imageTypeTag}>
                    <Text style={styles.imageTypeText}>{img.type === "editor" ? "🎨" : "📸"}</Text>
                  </View>
                  {img.specs && (
                    <View style={styles.imageInfo}>
                      <Text style={styles.imageInfoText} numberOfLines={1}>
                        {img.specs.serialNumber}
                      </Text>
                      <Text style={styles.imageInfoCategory} numberOfLines={1}>
                        {img.specs.category}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>

                <View style={styles.imageActions}>
                  <TouchableOpacity onPress={() => useGalleryImage(img.uri)} style={styles.actionButton}>
                    <Text style={styles.actionButtonText}>✏️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => resaveImage(img)} style={styles.actionButton}>
                    <Text style={styles.actionButtonText}>💾</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => deleteImage(img.id)} style={styles.actionButton}>
                    <Text style={styles.actionButtonText}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </ScrollView>

        <View style={styles.galleryFooter}>
          <Button label="Voltar ao Editor" onPress={() => setShowGallery(false)} />
        </View>

        <Modal
          visible={showImageSpecs !== null}
          animationType="fade"
          transparent
          onRequestClose={() => setShowImageSpecs(null)}
        >
          <View style={styles.specsModalOverlay}>
            <View style={styles.specsModalContent}>
              {showImageSpecs && (
                <>
                  <Image source={{ uri: showImageSpecs.uri }} style={styles.specsModalImage} />

                  {showImageSpecs.specs ? (
                    <ScrollView style={styles.specsDetails}>
                      <Text style={styles.specsTitle}>Especificações</Text>

                      <View style={styles.specsRow}>
                        <Text style={styles.specsLabel}>Número de Série:</Text>
                        <Text style={styles.specsValue}>{showImageSpecs.specs.serialNumber}</Text>
                      </View>

                      <View style={styles.specsRow}>
                        <Text style={styles.specsLabel}>Categoria:</Text>
                        <Text style={styles.specsValue}>{showImageSpecs.specs.category}</Text>
                      </View>

                      <View style={styles.specsRow}>
                        <Text style={styles.specsLabel}>Especificações:</Text>
                        <Text style={styles.specsValue}>{showImageSpecs.specs.specifications}</Text>
                      </View>

                      <View style={styles.specsRow}>
                        <Text style={styles.specsLabel}>Problemas:</Text>
                        <Text style={styles.specsValue}>{showImageSpecs.specs.problems}</Text>
                      </View>

                      <View style={styles.specsRow}>
                        <Text style={styles.specsLabel}>Capturada em:</Text>
                        <Text style={styles.specsValue}>{showImageSpecs.specs.captureTime}</Text>
                      </View>
                    </ScrollView>
                  ) : (
                    <Text style={styles.noSpecs}>Sem especificações</Text>
                  )}

                  <TouchableOpacity
                    style={styles.closeSpecsButton}
                    onPress={() => setShowImageSpecs(null)}
                  >
                    <Text style={styles.closeSpecsButtonText}>Fechar</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </Modal>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <TouchableOpacity style={styles.reportButton} onPress={openReportModal}>
        <Text style={styles.reportButtonText}>📊 Relatório</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.galleryButton} onPress={() => setShowGallery(true)}>
        <Text style={styles.galleryButtonText}>📁 Galeria ({savedImages.length})</Text>
      </TouchableOpacity>

      {Platform.OS === "web" ? (
        <div
          ref={(el) => {
            webRef.current = el;
          }}
          style={{
            width: 320,
            height: 440,
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            backgroundColor: "#25292e",
          }}
        >
          {renderComposableContent()}
        </div>
      ) : (
        <View style={styles.imageContainer}>
          <ViewShot
            ref={nativeRef}
            style={{
              width: 320,
              height: 440,
              backgroundColor: "#25292e",
            }}
            options={{ format: "png", quality: 1 }}
          >
            {renderComposableContent()}
          </ViewShot>
        </View>
      )}

      {showAppOptions ? (
        <GestureHandlerRootView style={styles.optionsContainer}>
          <GestureHandlerRootView style={styles.optionsRow}>
            <IconButton icon="refresh" label="Resetar" onPress={onReset} />
            <CircleButton onPress={onAddSticker} />
            <IconButton icon="save-alt" label="Salvar" onPress={onSaveImageAsync} />
          </GestureHandlerRootView>
        </GestureHandlerRootView>
      ) : (
        <GestureHandlerRootView style={styles.footerContainer}>
          <Button theme="primary" label="Escolha uma foto" onPress={pickImageAsync} />
          <Button label="Usar foto da galeria" onPress={pickImageFromGallery} />
          <Button label="Use essa foto" onPress={() => setShowAppOptions(true)} />
        </GestureHandlerRootView>
      )}

      <EmojiPicker isVisible={isModalVisible} onClose={onModalClose}>
        <EmojiList
          onSelect={(emoji) => {
            setPickedEmoji(emoji);
            setIsModalVisible(false);
          }}
          onCloseModal={onModalClose}
        />
      </EmojiPicker>

      <Modal
        visible={showSpecsModal}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setShowSpecsModal(false);
          setPendingSaveUri("");
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Especificações da Imagem</Text>

            <ScrollView style={styles.modalScroll}>
              <Text style={styles.modalLabel}>Número de Série *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Ex: SN-2025-001"
                placeholderTextColor="#999"
                value={serialNumber}
                onChangeText={setSerialNumber}
              />

              <Text style={styles.modalLabel}>Categoria</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Ex: Eletrônicos, Peças, etc."
                placeholderTextColor="#999"
                value={category}
                onChangeText={setCategory}
              />

              <Text style={styles.modalLabel}>Especificações</Text>
              <TextInput
                style={[styles.modalInput, styles.modalTextArea]}
                placeholder="Descreva as especificações..."
                placeholderTextColor="#999"
                value={specifications}
                onChangeText={setSpecifications}
                multiline
                numberOfLines={3}
              />

              <Text style={styles.modalLabel}>Problemas Identificados</Text>
              <TextInput
                style={[styles.modalInput, styles.modalTextArea]}
                placeholder="Descreva os problemas..."
                placeholderTextColor="#999"
                value={problems}
                onChangeText={setProblems}
                multiline
                numberOfLines={3}
              />

              <Text style={styles.modalInfo}>
                * Campos obrigatórios{"\n"}Hora da captura será salva automaticamente
              </Text>
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setShowSpecsModal(false);
                  setSerialNumber("");
                  setCategory("");
                  setSpecifications("");
                  setProblems("");
                  setPendingSaveUri("");
                }}
              >
                <Text style={styles.modalButtonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.modalButton, styles.modalButtonSave]} onPress={saveImageWithSpecs}>
                <Text style={styles.modalButtonText}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showReportModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowReportModal(false)}
      >
        <View style={styles.reportModalOverlay}>
          <View style={styles.reportModalContent}>
            <Text style={styles.reportModalTitle}>📊 Gerar Relatório de Inspeção</Text>
            
            <Text style={styles.reportModalSubtitle}>
              Selecione quais imagens incluir no relatório:
            </Text>

            <View style={styles.reportOptions}>
              <TouchableOpacity
                style={styles.reportOptionCard}
                onPress={() => {
                  setShowReportModal(false);
                  gerarRelatorio(savedImages, 'all');
                }}
                disabled={reportLoading}
              >
                <Text style={styles.reportOptionIcon}>📋</Text>
                <Text style={styles.reportOptionTitle}>Todas as Imagens</Text>
                <Text style={styles.reportOptionCount}>
                  {savedImages.length} imagem(ns)
                </Text>
                <Text style={styles.reportOptionDesc}>
                  Inclui imagens do editor e da câmera
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.reportOptionCard}
                onPress={() => {
                  setShowReportModal(false);
                  gerarRelatorio(savedImages, 'editor');
                }}
                disabled={reportLoading}
              >
                <Text style={styles.reportOptionIcon}>🎨</Text>
                <Text style={styles.reportOptionTitle}>Apenas Editor</Text>
                <Text style={styles.reportOptionCount}>
                  {editorCount} imagem(ns)
                </Text>
                <Text style={styles.reportOptionDesc}>
                  Somente imagens editadas no app
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.reportOptionCard}
                onPress={() => {
                  setShowReportModal(false);
                  gerarRelatorio(savedImages, 'camera');
                }}
                disabled={reportLoading}
              >
                <Text style={styles.reportOptionIcon}>📸</Text>
                <Text style={styles.reportOptionTitle}>Apenas Câmera</Text>
                <Text style={styles.reportOptionCount}>
                  {cameraCount} imagem(ns)
                </Text>
                <Text style={styles.reportOptionDesc}>
                  Somente imagens capturadas da câmera
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.reportCancelButton}
              onPress={() => setShowReportModal(false)}
            >
              <Text style={styles.reportCancelButtonText}>Cancelar</Text>
            </TouchableOpacity>

            {reportLoading && (
              <View style={styles.reportLoadingOverlay}>
                <ActivityIndicator size="large" color="#fff" />
                <Text style={styles.reportLoadingText}>Gerando relatório...</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
    reportButton: {
    position: 'absolute' as const,
    top: 50,
    left: 20,
    backgroundColor: '#2e7d32',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 1000,
  },
  reportButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#fff',
  },
  reportModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  reportModalContent: {
    backgroundColor: '#1a1d21',
    borderRadius: 20,
    padding: 30,
    width: '100%',
    maxWidth: 500,
  },
  reportModalTitle: {
    fontSize: 24,
    fontWeight: 'bold' as const,
    color: '#fff',
    textAlign: 'center' as const,
    marginBottom: 10,
  },
  reportModalSubtitle: {
    fontSize: 16,
    color: '#ccc',
    textAlign: 'center' as const,
    marginBottom: 30,
  },
  reportOptions: {
    gap: 15,
  },
  reportOptionCard: {
    backgroundColor: '#25292e',
    padding: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ffd33d',
    alignItems: 'center' as const,
  },
  reportOptionIcon: {
    fontSize: 40,
    marginBottom: 10,
  },
  reportOptionTitle: {
    fontSize: 18,
    fontWeight: 'bold' as const,
    color: '#fff',
    marginBottom: 5,
  },
  reportOptionCount: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#ffd33d',
    marginBottom: 8,
  },
  reportOptionDesc: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center' as const,
  },
  reportCancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center' as const,
    marginTop: 20,
  },
  reportCancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  reportLoadingOverlay: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
  reportLoadingText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600' as const,
  },
  container: {
    flex: 1,
    backgroundColor: "#25292e",
    alignItems: "center",
    justifyContent: "center",
  },
  imageContainer: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  footerContainer: {
    flex: 1 / 3,
    alignItems: "center",
    justifyContent: "center",
  },
  optionsContainer: {
    position: "absolute",
    bottom: 80,
  },
  optionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  galleryButton: {
    position: "absolute",
    top: 50,
    right: 20,
    backgroundColor: "#fff",
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 1000,
  },
  galleryButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#25292e",
  },
  galleryHeader: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 10,
  },
  galleryTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  closeButtonText: {
    fontSize: 24,
    color: "#fff",
  },
  categoryFilters: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 15,
    gap: 10,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  filterButtonActive: {
    backgroundColor: "#ffd33d",
  },
  filterText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  filterTextActive: {
    color: "#25292e",
  },
  galleryScroll: {
    flex: 1,
    width: "100%",
  },
  galleryContent: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 10,
    justifyContent: "center",
  },
  galleryItem: {
    width: 150,
    margin: 8,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#1a1d21",
  },
  galleryImage: {
    width: "100%",
    height: 180,
    resizeMode: "cover",
  },
  imageTypeTag: {
    position: "absolute",
    top: 8,
    left: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  imageTypeText: {
    fontSize: 16,
  },
  imageInfo: {
    padding: 8,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  imageInfoText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  imageInfoCategory: {
    color: "#ccc",
    fontSize: 10,
    marginTop: 2,
  },
  imageActions: {
    flexDirection: "row",
    justifyContent: "space-around",
    padding: 8,
    backgroundColor: "#16181c",
  },
  actionButton: {
    padding: 8,
  },
  actionButtonText: {
    fontSize: 20,
  },
  emptyText: {
    color: "#999",
    fontSize: 16,
    marginTop: 50,
  },
  galleryFooter: {
    width: "100%",
    padding: 20,
    alignItems: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 25,
    width: "100%",
    maxWidth: 500,
    maxHeight: "90%",
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#212529",
    marginBottom: 20,
    textAlign: "center",
  },
  modalScroll: {
    maxHeight: 400,
  },
  modalLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#495057",
    marginBottom: 8,
    marginTop: 12,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: "#ced4da",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: "#f8f9fa",
    color: "#212529",
  },
  modalTextArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  modalInfo: {
    fontSize: 12,
    color: "#6c757d",
    marginTop: 15,
    fontStyle: "italic",
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
    gap: 10,
  },
  modalButton: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
  },
  modalButtonCancel: {
    backgroundColor: "#6c757d",
  },
  modalButtonSave: {
    backgroundColor: "#2e7d32",
  },
  modalButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  specsModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.9)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  specsModalContent: {
    backgroundColor: "#1a1d21",
    borderRadius: 16,
    padding: 20,
    width: "100%",
    maxWidth: 500,
    maxHeight: "90%",
  },
  specsModalImage: {
    width: "100%",
    height: 300,
    borderRadius: 12,
    resizeMode: "contain",
    marginBottom: 20,
  },
  specsDetails: {
    marginBottom: 20,
  },
  specsTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 15,
  },
  specsRow: {
    marginBottom: 12,
  },
  specsLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ffd33d",
    marginBottom: 4,
  },
  specsValue: {
    fontSize: 16,
    color: "#fff",
  },
  noSpecs: {
    color: "#999",
    fontSize: 16,
    textAlign: "center",
    marginVertical: 20,
  },
  closeSpecsButton: {
    backgroundColor: "#ffd33d",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
  },
  closeSpecsButtonText: {
    color: "#25292e",
    fontSize: 16,
    fontWeight: "600",
  },
});