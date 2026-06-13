export type Tela2EmRotaOrder = {
  num: string;
  sequenceValue: number | null;
  stopValue: number | null;
  code: string;
  atId: string;
  address: string;
  recipient: string;
  phone?: string;
  hub?: string;
  district: string;
  city: string;
  zipcode: string;
  latitude: string;
  longitude: string;
  tags: string[];
};

export type Tela2EmRotaStopBlock = {
  stop: string;
  count: number;
  orders: Tela2EmRotaOrder[];
};

export type Tela2EmRotaPayload = {
  atId: string;
  totalOrders: number;
  rowsCount: number;
  sourceFileName: string | null;
  sourceFileUri: string | null;
  sourceModifiedAt: number | null;
  sourceAddedAt?: number | null;
  sourceSize?: number | null;
  stops: Tela2EmRotaStopBlock[];
};
