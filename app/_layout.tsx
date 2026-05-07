import { Stack, router, usePathname } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import {
  getTela11Uri,
  getPlacaUri,
  getTela6Uri,
} from "../lib/devStorage";

export default function Layout() {
  const pathname = usePathname();
  const [liberado, setLiberado] = useState(false);
  const bootedRef = useRef(false);
  const publicPaths = ["/", "/tela10", "/upload-fotos", "/trocar-senha"];
  const adminPaths = ["/painel-admin", "/painel-adm"];

  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;

    if (!publicPaths.includes(pathname) && !adminPaths.includes(pathname)) {
      router.replace("/");
    }
  }, [pathname]);

  useEffect(() => {
    async function verificar() {
      const [u4, u6, u11] = await Promise.all([
        getPlacaUri(),
        getTela6Uri(),
        getTela11Uri(),
      ]);

      setLiberado(!!u4 && !!u6 && !!u11);
    }

    verificar();
  }, [pathname]); // 🔥 AGORA VERIFICA SEMPRE QUE MUDA DE TELA

  const permitido = publicPaths.includes(pathname) || adminPaths.includes(pathname);

  if (!liberado && !permitido) {
    return <View style={{ flex: 1, backgroundColor: "#fff" }} />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
