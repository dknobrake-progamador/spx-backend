import React, { useRef, useState } from "react";
import { Animated, Dimensions, Easing, StyleSheet } from "react-native";
import Svg, { Path } from "react-native-svg";

const { height } = Dimensions.get("window");

export function useRefreshAnimado() {
  const [visible, setVisible] = useState(false);
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  function iniciarAnimacao() {
    setVisible(true);
    rotateAnim.setValue(0);
    fadeAnim.setValue(0);

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ]).start(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start(() => setVisible(false));
    });
  }

  return {
    visible,
    fadeAnim,
    spin: rotateAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ["0deg", "360deg"],
    }),
    iniciarAnimacao,
  };
}

type RefreshAnimadoProps = {
  visible: boolean;
  fadeAnim: Animated.Value;
  spin: Animated.AnimatedInterpolation<string>;
};

export function RefreshAnimado({
  visible,
  fadeAnim,
  spin,
}: RefreshAnimadoProps) {
  if (!visible) {
    return null;
  }

  return (
    <Animated.View style={[styles.bubble, { opacity: fadeAnim }]}>
      <Animated.View style={[styles.iconWrap, { transform: [{ rotate: spin }] }]}>
        <Svg width={44} height={44} viewBox="0 0 100 100" style={styles.svg}>
          <Path
            d="M50 10 A40 40 0 1 1 17 67"
            fill="none"
            stroke="#F45A1F"
            strokeWidth={8}
            strokeLinecap="round"
          />
          <Path d="M17 67 L26 56 L8 58 Z" fill="#F45A1F" />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    position: "absolute",
    top: height * 0.3,
    alignSelf: "center",
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#FFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    overflow: "visible",
  },
  iconWrap: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
  svg: {
    overflow: "visible",
  },
});
