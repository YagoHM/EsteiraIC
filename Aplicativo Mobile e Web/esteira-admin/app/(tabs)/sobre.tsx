import { Image } from 'expo-image';
import { StyleSheet, Text, View } from "react-native";
const img = require('@/assets/images/ctiLogo.png');

export default function Sobre() {
  return (
    <View style={styles.container}>
      <Image source={img} style={styles.imagem}/>
      <Text style={styles.texto}>O Colégio Técnico Industrial Professor Isaac Portal Roldán é uma instituição de ensino médio e técnico pública estadual brasileira, com sede em Bauru, em São Paulo. O colégio técnico é mantido pela Universidade Estadual Paulista Júlio de Mesquita Filho e está vinculado à Faculdade de Engenharia de Bauru. </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    padding:20,
    flex: 1,
    backgroundColor: "#fff",
    justifyContent: "top",
    alignItems: "center",
  },
  text: {
    color:"#000000",
    fontSize: 20,
    margin: 20,
  },

  paragrafo: {
    fontSize: 15,
    textAlign: "center",
    margin: 20,
    width:599
  },

  button: {
    fontSize: 10,
    textDecorationLine: 'underline',
    width: 500,
  },
  centered: {
    justifyContent: 'top',
    alignItems: 'center',
    padding: 20,
    backgroundColor: "#fff",
    width: "100%",
    height: "100%",
  },

  texto: {
    fontSize: 16,
    margin: 5,
    width: 200,
    textAlign: 'justify',
  },

  imagem: {
    width: 225,
    height: 95,
    margin: 30,
  }
});

