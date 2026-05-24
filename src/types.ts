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
  tafsil?: string; // تفصیل مربوط به خریدار یا مشتری یا معین فروش
  taxRate?: string; // ستون نرخ مالیاتی اختیاری
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
  tafsil?: string; // مقدار تفصیل استخراج‌شده
  taxRate?: number; // نرخ مالیاتی استخراج‌شده از این سطر
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
  itemVatRate?: number; // نرخ مالیاتی این کالا
}

export interface AppState {
  step: 'UPLOAD' | 'MAP_COLUMNS' | 'REPORT';
  files: FileData[];
  processedTransactions: ProcessedTransaction[];
  itemSummaries: ItemSummary[];
  kardexByItem: Record<string, KardexEntry[]>;
  vatRate: number; // نرخ عمومی
  negativeStockMode: 'ALLOW' | 'ZERO_OUT' | 'ADJUST_INITIAL'; // وضعیت موجودی منفی
  adjustedTxns?: Record<string, { unitPrice?: number; quantity?: number }>; // مبالغ جایگزین شده توسط کاربر برای هدف‌گذاری
  selectedTafsil?: string; // فیلتر تفصیل فروش
}

