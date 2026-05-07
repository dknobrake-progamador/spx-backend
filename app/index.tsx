import { Image, Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";

export default function Index() {
  return (
    <View style={styles.container}>
      <Image
        source={require("../assets/images/tela1.jpeg")}
        style={styles.image}
        resizeMode="cover"
      />

      <Pressable
        style={styles.loginButtonHitArea}
        onPress={() => router.push("/tela10")}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  // area do botao "Conectar-se" da imagem da tela 1
  loginButtonHitArea: {
    position: "absolute",
    left: "10%",
    right: "10%",
    bottom: "18%",
    height: 56,
  },
});
