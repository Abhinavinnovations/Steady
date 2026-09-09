import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Svg, { Path } from "react-native-svg";
import { useColorScheme } from "@/hooks/use-color-scheme";

/**
 * iPhone-style boot overlay.
 * First open: cursive "steady" draws itself stroke-by-stroke (~2.6s), then fades.
 * Every later open: quick wordmark fade (~0.8s).
 */

const BOOT_FLAG = "steady.hasBooted";

// Single-stroke cursive "steady" (Hershey script), one combined path so the
// dash animation draws the strokes sequentially like handwriting.
const WORD_PATH =
  "M4.0 33.1 L7.6 27.6 L9.5 24.0 L9.5 27.6 L13.1 33.1 L14.9 36.7 L14.9 40.4 L11.3 42.2 M4.0 40.4 L7.6 42.2 L14.9 42.2 L18.5 40.4 L20.4 38.5 L24.0 33.1 M24.0 33.1 L27.6 27.6 L31.3 20.4 M36.7 4.0 L25.8 36.7 L25.8 40.4 L27.6 42.2 L31.3 42.2 L34.9 40.4 L36.7 38.5 L40.4 33.1 M25.8 18.5 L38.5 18.5 M42.2 38.5 L45.8 36.7 L47.6 34.9 L49.5 31.3 L49.5 27.6 L47.6 25.8 L45.8 25.8 L42.2 27.6 L40.4 31.3 L40.4 36.7 L42.2 40.4 L45.8 42.2 L49.5 42.2 L53.1 40.4 L54.9 38.5 L58.5 33.1 M74.9 31.3 L73.1 27.6 L69.5 25.8 L65.8 25.8 L62.2 27.6 L60.4 29.5 L58.5 33.1 L58.5 36.7 L60.4 40.4 L64.0 42.2 L67.6 42.2 L71.3 40.4 L73.1 36.7 L76.7 25.8 L74.9 34.9 L74.9 40.4 L76.7 42.2 L78.5 42.2 L82.2 40.4 L84.0 38.5 L87.6 33.1 M104.0 31.3 L102.2 27.6 L98.5 25.8 L94.9 25.8 L91.3 27.6 L89.5 29.5 L87.6 33.1 L87.6 36.7 L89.5 40.4 L93.1 42.2 L96.7 42.2 L100.4 40.4 L102.2 36.7 L113.1 4.0 M105.8 25.8 L104.0 34.9 L104.0 40.4 L105.8 42.2 L107.6 42.2 L111.3 40.4 L113.1 38.5 L116.7 33.1 M116.7 33.1 L120.4 25.8 L116.7 36.7 L116.7 40.4 L118.5 42.2 L122.2 42.2 L125.8 40.4 L129.5 36.7 L133.1 31.3 M134.9 25.8 L124.0 58.5 L122.2 62.2 L118.5 64.0 L116.7 62.2 L116.7 58.5 L118.5 53.1 L124.0 47.6 L129.5 44.0 L133.1 42.2 L138.5 38.5 L144.0 33.1";
const PATH_LENGTH = 565;
const VIEW_W = 148;
const VIEW_H = 68;

const AnimatedPath = Animated.createAnimatedComponent(Path);

export function BootSplash() {
  const scheme = useColorScheme();
  const dark = scheme === "dark";

  const [visible, setVisible] = useState(true);
  const [firstOpen, setFirstOpen] = useState<boolean | null>(null);

  const draw = useRef(new Animated.Value(0)).current;
  const wordOpacity = useRef(new Animated.Value(0)).current;
  const overlayOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let cancelled = false;
    void AsyncStorage.getItem(BOOT_FLAG).then((value) => {
      if (cancelled) return;
      setFirstOpen(value !== "1");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (firstOpen === null) return;

    const fadeOut = Animated.timing(overlayOpacity, {
      toValue: 0,
      duration: 450,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    });

    if (firstOpen) {
      wordOpacity.setValue(1);
      Animated.sequence([
        Animated.timing(draw, {
          toValue: 1,
          duration: 2600,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.delay(500),
        fadeOut,
      ]).start(() => {
        setVisible(false);
        void AsyncStorage.setItem(BOOT_FLAG, "1");
      });
    } else {
      draw.setValue(1);
      Animated.sequence([
        Animated.timing(wordOpacity, {
          toValue: 1,
          duration: 350,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.delay(250),
        fadeOut,
      ]).start(() => setVisible(false));
    }
  }, [firstOpen, draw, wordOpacity, overlayOpacity]);

  if (!visible) return null;

  const dashOffset = draw.interpolate({
    inputRange: [0, 1],
    outputRange: [PATH_LENGTH, 0],
  });

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        {
          zIndex: 999,
          elevation: 999,
          opacity: overlayOpacity,
          backgroundColor: dark ? "#101018" : "#F2F2F7",
          alignItems: "center",
          justifyContent: "center",
        },
      ]}
      pointerEvents={visible ? "auto" : "none"}
    >
      <Animated.View style={{ opacity: wordOpacity }}>
        <View style={{ width: 222, height: 102 }}>
          <Svg
            width="100%"
            height="100%"
            viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
            fill="none"
          >
            <AnimatedPath
              d={WORD_PATH}
              stroke={dark ? "#ECECF2" : "#26262E"}
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={`${PATH_LENGTH} ${PATH_LENGTH}`}
              strokeDashoffset={dashOffset}
            />
          </Svg>
        </View>
      </Animated.View>
    </Animated.View>
  );
}
