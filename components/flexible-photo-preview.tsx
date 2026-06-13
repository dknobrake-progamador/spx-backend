import * as FileSystem from "expo-file-system/legacy";
import React, { useEffect, useMemo, useState } from "react";
import {
  Image,
  type LayoutChangeEvent,
  type ImageResizeMode,
  StyleSheet,
  View,
} from "react-native";
import { SvgXml } from "react-native-svg";

type Props = {
  uri: string | null;
  style?: any;
  resizeMode?: ImageResizeMode;
};

const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function isSvgUri(uri: string) {
  return uri.startsWith("data:image/svg+xml") || /\.svg(?:$|\?)/i.test(uri);
}

function decodeBase64(base64: string) {
  const clean = base64.replace(/[^A-Za-z0-9+/=]/g, "");
  const bytes: number[] = [];

  for (let index = 0; index < clean.length; index += 4) {
    const enc1 = BASE64_ALPHABET.indexOf(clean[index] || "A");
    const enc2 = BASE64_ALPHABET.indexOf(clean[index + 1] || "A");
    const enc3Char = clean[index + 2] || "=";
    const enc4Char = clean[index + 3] || "=";
    const enc3 = enc3Char === "=" ? 64 : BASE64_ALPHABET.indexOf(enc3Char);
    const enc4 = enc4Char === "=" ? 64 : BASE64_ALPHABET.indexOf(enc4Char);

    const chr1 = (enc1 << 2) | (enc2 >> 4);
    const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
    const chr3 = ((enc3 & 3) << 6) | enc4;

    bytes.push(chr1);
    if (enc3 !== 64) bytes.push(chr2);
    if (enc4 !== 64) bytes.push(chr3);
  }

  return new TextDecoder().decode(Uint8Array.from(bytes));
}

async function resolveSvgXml(uri: string) {
  console.log("[FPP] resolveSvgXml uri:", uri?.slice(-40));
  if (uri.startsWith("data:image/svg+xml")) {
    const payload = uri.slice(uri.indexOf(",") + 1);
    if (uri.includes(";base64,")) {
      return decodeBase64(payload);
    }
    return decodeURIComponent(payload);
  }

  try {
    const response = await fetch(uri);
    const text = await response.text();
    console.log("[FPP] fetch OK, tamanho:", text.length);
    return text;
  } catch (e) {
    console.log("[FPP] fetch falhou:", e);
    return "";
  }
}

function extractSvgAspectRatio(svgXml: string) {
  const viewBoxMatch = svgXml.match(/viewBox=["']\s*[-\d.]+\s+[-\d.]+\s+([-\d.]+)\s+([-\d.]+)\s*["']/i);
  if (viewBoxMatch) {
    const width = Number(viewBoxMatch[1]);
    const height = Number(viewBoxMatch[2]);
    if (width > 0 && height > 0) {
      return width / height;
    }
  }

  const widthMatch = svgXml.match(/<svg[^>]*\swidth=["']([-\d.]+)(?:px)?["']/i);
  const heightMatch = svgXml.match(/<svg[^>]*\sheight=["']([-\d.]+)(?:px)?["']/i);
  const width = widthMatch ? Number(widthMatch[1]) : 0;
  const height = heightMatch ? Number(heightMatch[1]) : 0;
  if (width > 0 && height > 0) {
    return width / height;
  }

  return 390 / 844;
}

export function FlexiblePhotoPreview({ uri, style, resizeMode = "cover" }: Props) {
  const [svgXml, setSvgXml] = useState("");
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    let alive = true;

    if (!uri) {
      console.log("[FPP] uri nula, limpando svgXml");
      setSvgXml("");
      return () => {
        alive = false;
      };
    }

    if (!isSvgUri(uri)) {
      console.log("[FPP] nao e SVG, limpando svgXml");
      setSvgXml("");
      return () => {
        alive = false;
      };
    }

    console.log("[FPP] iniciando leitura SVG...");

    if (!uri || !isSvgUri(uri)) {
      setSvgXml("");
      return () => {
        alive = false;
      };
    }

    (async () => {
      try {
        const xml = await resolveSvgXml(uri);
        console.log("[FPP] xml resolvido, tamanho:", xml.length, "alive:", alive);
        if (xml.length === 0) {
          console.log("[FPP] ERRO: xml vazio, nao vai renderizar");
        }
        setSvgXml(xml);
      } catch (e) {
        console.log("[FPP] ERRO FATAL na leitura SVG:", e);
        setSvgXml("");
      }
    })();

    return () => {
      console.log("[FPP] useEffect CLEANUP - alive=false");
      alive = false;
    };
  }, [uri]);

  const svgBox = useMemo(() => {
    console.log("[FPP] svgBox CALC - svgXml.length:", svgXml.length, "container:", JSON.stringify(containerSize));
    if (!svgXml || containerSize.width <= 0 || containerSize.height <= 0) {
      if (!svgXml) {
        console.log("[FPP] svgBox NULL: sem svgXml");
      } else {
        console.log("[FPP] svgBox NULL: container invalido", containerSize);
      }
      return null;
    }

    const aspectRatio = extractSvgAspectRatio(svgXml);
    const containerRatio = containerSize.width / containerSize.height;
    console.log("[FPP] aspectRatio:", aspectRatio, "containerRatio:", containerRatio);

    if (containerRatio > aspectRatio) {
      const box = { width: containerSize.height * aspectRatio, height: containerSize.height };
      console.log("[FPP] svgBox calculado (height-bound):", box);
      return box;
    }

    const box = { width: containerSize.width, height: containerSize.width / aspectRatio };
    console.log("[FPP] svgBox calculado (width-bound):", box);
    return box;
  }, [containerSize.height, containerSize.width, svgXml]);

  function handleSvgLayout(event: LayoutChangeEvent) {
    const { width, height } = event.nativeEvent.layout;
    console.log("[FPP] onLayout DISPAROU:", width, height);
    setContainerSize((current) => {
      if (current.width === width && current.height === height) {
        console.log("[FPP] onLayout ignorado, mesmo tamanho");
        return current;
      }
      console.log("[FPP] containerSize atualizado:", width, height);
      return { width, height };
    });
  }

  if (!uri) {
    console.log("[FPP] renderizando View vazia (uri nula)");
    return <View style={style} />;
  }

  if (isSvgUri(uri)) {
    console.log("[FPP] renderizando SVG - svgXml:", !!svgXml, "svgBox:", JSON.stringify(svgBox));
    return (
      <View style={[styles.svgWrap, style]} onLayout={handleSvgLayout}>
        {svgXml && svgBox ? (
          <SvgXml
            xml={svgXml}
            width={svgBox.width}
            height={svgBox.height}
            preserveAspectRatio="xMidYMid meet"
          />
        ) : (
          <View style={{ flex: 1, backgroundColor: "#fff" }} />
        )}
      </View>
    );
  }

  console.log("[FPP] renderizando Image normal");
  return <Image source={{ uri }} style={style} resizeMode={resizeMode} />;
}

const styles = StyleSheet.create({
  svgWrap: {
    overflow: "hidden",
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
});
