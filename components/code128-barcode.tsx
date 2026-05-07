import React, { useMemo } from "react";
import { View } from "react-native";
import Svg, { Rect } from "react-native-svg";

const CODE128_PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213",
  "122312", "132212", "221213", "221312", "231212", "112232", "122132",
  "122231", "113222", "123122", "123221", "223211", "221132", "221231",
  "213212", "223112", "312131", "311222", "321122", "321221", "312212",
  "322112", "322211", "212123", "212321", "232121", "111323", "131123",
  "131321", "112313", "132113", "132311", "211313", "231113", "231311",
  "112133", "112331", "132131", "113123", "113321", "133121", "313121",
  "211331", "231131", "213113", "213311", "213131", "311123", "311321",
  "331121", "312113", "312311", "332111", "314111", "221411", "431111",
  "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114",
  "413111", "241112", "134111", "111242", "121142", "121241", "114212",
  "124112", "124211", "411212", "421112", "421211", "212141", "214121",
  "412121", "111143", "111341", "131141", "114113", "114311", "411113",
  "411311", "113141", "114131", "311141", "411131", "211412", "211214",
  "211232", "2331112",
];

export function encodeCode128B(value: string) {
  if (!value) {
    throw new Error("Valor vazio.");
  }

  const codes = [104];
  for (const character of value) {
    const ascii = character.charCodeAt(0);
    if (ascii < 32 || ascii > 126) {
      throw new Error("Caracter invalido para CODE_128.");
    }
    codes.push(ascii - 32);
  }

  let checksum = 104;
  for (let index = 1; index < codes.length; index += 1) {
    checksum += codes[index] * index;
  }

  codes.push(checksum % 103);
  codes.push(106);

  return codes.map((code) => CODE128_PATTERNS[code]);
}

export function buildCode128Bars(value: string, width = 320, quietZone = 12) {
  const patterns = encodeCode128B(value);
  const totalUnits =
    patterns.reduce(
      (sum, pattern) => sum + pattern.split("").reduce((inner, digit) => inner + Number(digit), 0),
      0
    ) +
    quietZone * 2;
  const unitWidth = width / totalUnits;
  const rects: Array<{ x: number; width: number }> = [];
  let cursor = quietZone * unitWidth;

  for (const pattern of patterns) {
    let drawBar = true;
    for (const digit of pattern) {
      const segmentWidth = Number(digit) * unitWidth;
      if (drawBar) {
        rects.push({ x: cursor, width: segmentWidth });
      }
      cursor += segmentWidth;
      drawBar = !drawBar;
    }
  }

  return rects;
}

type Props = {
  value: string;
  width?: number;
  height?: number;
  quietZone?: number;
};

export function Code128Barcode({
  value,
  width = 320,
  height = 108,
  quietZone = 12,
}: Props) {
  const bars = useMemo(() => {
    return buildCode128Bars(value, width, quietZone);
  }, [quietZone, value, width]);

  return (
    <View>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Rect x={0} y={0} width={width} height={height} fill="#ffffff" />
        {bars.map((bar, index) => (
          <Rect key={`${bar.x}-${index}`} x={bar.x} y={0} width={bar.width} height={height} fill="#000000" />
        ))}
      </Svg>
    </View>
  );
}
