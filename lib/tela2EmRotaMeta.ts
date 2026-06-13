import { getTela2EmRotaTotalCount, TELA2_EM_ROTA_FALLBACK_PAYLOAD } from "./tela2EmRotaEngine";

export const TELA2_EM_ROTA_TOTAL = TELA2_EM_ROTA_FALLBACK_PAYLOAD.totalOrders;

export async function getTela2EmRotaTotal() {
  return await getTela2EmRotaTotalCount();
}
