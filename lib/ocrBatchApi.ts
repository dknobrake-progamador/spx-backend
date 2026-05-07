import { apiRequest } from "./apiClient";

export type OcrBatchCardFields = {
  trackingCode?: string;
  address?: string;
  recipientName?: string;
  status?: string;
  statusDate?: string;
  rawText?: string;
};

export type OcrBatchCard = {
  text: string;
  fields: OcrBatchCardFields;
};

export async function runBatchOcr(params: {
  base64: string;
  mimeType: string;
  maxCards: number;
}) {
  return await apiRequest<{
    text: string;
    mimeType: string;
    totalFound: number;
    cards: OcrBatchCard[];
  }>("/ocr/cards", {
    method: "POST",
    timeoutMs: 90000,
    body: {
      imageBase64: params.base64,
      mimeType: params.mimeType,
      maxCards: params.maxCards,
    },
  });
}
