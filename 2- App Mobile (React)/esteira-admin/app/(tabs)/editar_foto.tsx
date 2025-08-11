import Button from "@/components/button";
import CircleButton from "@/components/circleButton";
import EmojiList from "@/components/emojiList";
import EmojiPicker from "@/components/emojiPicker";
import EmojiSticker from "@/components/emojiSticker";
import IconButton from "@/components/iconButton";
import ImageViewer from "@/components/imageViewer";
import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library";
import React, { useRef, useState } from "react";
import { ImageSourcePropType, Platform, StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import ViewShot, { captureRef } from "react-native-view-shot";

const PlaceholderImage = require("@/assets/images/placeholder-modal.jpg");

// Só carrega html2canvas em web para não inflar bundle nativo
let html2canvas: typeof import("html2canvas") | null = null;
if (Platform.OS === "web") {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  html2canvas = require("html2canvas");
}

export default function Index() {
  const [selectedImage, setSelectedImage] = useState<string | undefined>(undefined);
  const [showAppOptions, setShowAppOptions] = useState<boolean>(false);
  const [isModalVisible, setIsModalVisible] = useState<boolean>(false);
  const [pickedEmoji, setPickedEmoji] = useState<ImageSourcePropType | undefined>(undefined);
  const nativeRef = useRef<any>(null); // para ViewShot / captureRef no mobile
  const webRef = useRef<HTMLDivElement | null>(null); // para html2canvas no web

  const pickImageAsync = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled) {
      setSelectedImage(result.assets[0].uri);
      setShowAppOptions(true);
    } else {
      alert("You did not select any image.");
    }
  };

  const onReset = () => {
    setSelectedImage(undefined);
    setShowAppOptions(false);
    setPickedEmoji(undefined);
  };

  const onAddSticker = () => {
    setIsModalVisible(true);
  };

  const onModalClose = () => {
    setIsModalVisible(false);
  };

  const onSaveImageAsync = async () => {
    if (Platform.OS !== "web") {
      try {
        const localUri = await captureRef(nativeRef, {
          height: auto,
          quality: 1,
          format: "jpeg",
        });

        const permission = await MediaLibrary.requestPermissionsAsync();
        if (!permission.granted) {
          alert("Permissão negada para salvar.");
          return;
        }

        await MediaLibrary.saveToLibraryAsync(localUri);
        alert("Salvo!");
      } catch (e) {
        console.error("Erro salvando imagem native:", e);
        alert("Erro ao salvar imagem.");
      }
    } else {
      try {
        if (!webRef.current) {
          console.warn("webRef.current inválido");
          return;
        }
        if (!html2canvas) {
          console.warn("html2canvas não carregado");
          return;
        }

        const canvas = await html2canvas(webRef.current, {
          scale: 1,
          backgroundColor: null,
          width: 320,
          height: 440,
        });

        canvas.toBlob((blob) => {
          if (!blob) {
            alert("Erro gerando imagem");
            return;
          }
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = "img-salva";
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }, "image/jpeg", 0.95);
      } catch (e) {
        console.error("Erro no web save:", e);
        alert("Erro ao gerar/download da imagem.");
      }
    }
  };

  const renderComposableContent = (
    <React.Fragment>
      <ImageViewer imgSource={PlaceholderImage} selectedImage={selectedImage} />
      {pickedEmoji && (
        <EmojiSticker imageSize={80} stickerSource={pickedEmoji} />
      )}
    </React.Fragment>
  );

  return (
    <GestureHandlerRootView style={styles.container}>
      {Platform.OS === "web" ? (
        // web: capturar via html2canvas em div real
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
          }}
        >
          {renderComposableContent}
        </div>
      ) : (
        // native: usar ViewShot
        <ViewShot
          ref={nativeRef}
          style={styles.imageContainer}
          options={{ format: "png", quality: 1 }}
        >
          {renderComposableContent}
        </ViewShot>
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
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
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
});