import { Image, type ImageSource } from 'expo-image';
import { StyleSheet } from "react-native";
const img = require('@/assets/images/placeHolder.jpg');

type Props = {
  imgSource: ImageSource;
  selectedImage?: string;
};

export default function ImageViewer({ imgSource, selectedImage }: Props) {
  const imageSource = selectedImage ? { uri: selectedImage } : imgSource;
  return <Image source={imageSource} style={styles.image} />;
}


const styles = StyleSheet.create({
  image: {
    minWidth: 250,
    minHeight: 250,
    margin: 20,
  },
});