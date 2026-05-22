export type TransactionType = 'INITIAL' | 'PURCHASE' | 'PURCHASE_RETURN' | 'SALE' | 'SALE_RETURN';

export interface RawRow {
  [key: string]: string | number;
}

export interface ColumnMapping {
  date: string;
  itemName: string;
  quantity: string;
  price: string;
  priceType: 'UNIT' | 'TOTAL';
}

export interface FileData {
  id: string;
  fileName: string;
  type: TransactionType;
  rawRows: RawRow[];
  columns: string[];
  mapping?: Partial<ColumnMapping>;
}

export interface ProcessedTransaction {
  id: string;
  date: Date | string;
  timestamp: number;
  itemName: string;
  type: TransactionType;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  rowNumber: number;
  sourceFile: string;
}

export interface KardexEntry extends ProcessedTransaction {
  balanceQuantity: number;
  balanceTotalCost: number;
  averageUnitCost: number;
  cogs: number;
  profit: number;
  vat: number;
}

export interface ItemSummary {
  itemName: string;
  initialQuantity: number;
  initialValue: number;
  purchasedQuantity: number;
  purchasedValue: number;
  soldQuantity: number;
  salesRevenue: number;
  endingQuantity: number;
  endingValue: number;
  cogs: number;
  grossProfit: number;
  averageUnitCost: number;
}

export interface AppState {
  step: 'UPLOAD' | 'MAP_COLUMNS' | 'REPORT';
  files: FileData[];
  processedTransactions: ProcessedTransaction[];
  itemSummaries: ItemSummary[];
  kardexByItem: Record<string, KardexEntry[]>;
  vatRate: number;
}
