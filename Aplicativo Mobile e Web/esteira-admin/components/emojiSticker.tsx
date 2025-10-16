// emojiSticker.tsx (corrigido)
import { ImageSourcePropType } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

type Props = {
  imageSize: number;
  stickerSource: ImageSourcePropType;
};

// Tamanho do seu canvas (mantém em sincronia com 320x440 usados no editor)
const CANVAS_W = 320;
const CANVAS_H = 440;

export default function EmojiSticker({ imageSize, stickerSource }: Props) {
  // Centraliza o sticker no início
  const translateX = useSharedValue((CANVAS_W - imageSize) / 2);
  const translateY = useSharedValue((CANVAS_H - imageSize) / 2);
  const scale = useSharedValue(1);

  // Duplo toque para alternar escala 1x/2x
  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onStart(() => {
      scale.value = scale.value === 1 ? 2 : 1;
    });

  // Arrasto livre
  const drag = Gesture.Pan().onChange((e) => {
    translateX.value += e.changeX;
    translateY.value += e.changeY;
  });

  // Combina gestos (podem acontecer simultaneamente)
  const combined = Gesture.Simultaneous(drag, doubleTap);

  // Pose/posição do container
  const containerStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }));

  // Escala do sticker (usa transform — não sobrescreve com width/height fixos)
  const imageStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(scale.value) }],
  }));

  return (
    <GestureDetector gesture={combined}>
      <Animated.View
        style={[
          // Importante: absoluto na área capturável
          { position: "absolute", left: 0, top: 0, zIndex: 10 },
          containerStyle,
        ]}
      >
        <Animated.Image
          source={stickerSource}
          resizeMode="contain"
          // width/height fixos como base + transform para escala (sem sobrescrever)
          style={[{ width: imageSize, height: imageSize }, imageStyle]}
        />
      </Animated.View>
    </GestureDetector>
  );
}
