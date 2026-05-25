import React, { useState } from 'react';
import { AppState, FileData, ProcessedTransaction } from './types';
import { MultiFileUpload } from './components/MultiFileUpload';
import { MultiColumnMapper } from './components/MultiColumnMapper';
import { ReportView } from './components/ReportView';
import { calculateKardex } from './lib/kardex-engine';
import { parsePersianDate, cn } from './lib/utils';
import { CheckCircle2 } from 'lucide-react';

export default function App() {
  const [state, setState] = useState<AppState>({
    step: 'UPLOAD',
    files: [],
    processedTransactions: [],
    itemSummaries: [],
    kardexByItem: {},
    vatRate: 0,
    negativeStockMode: 'ZERO_OUT',
    adjustedTxns: {},
    selectedTafsil: '__ALL__',
  });

  const handleAddFile = (file: FileData) => {
    setState(s => ({ ...s, files: [...s.files, file] }));
  };

  const handleRemoveFile = (id: string) => {
    setState(s => ({ ...s, files: s.files.filter(f => f.id !== id) }));
  };

  const handleGoToMapping = () => {
    setState(s => ({ ...s, step: 'MAP_COLUMNS' }));
  };

  const recalculateAndSetState = (patch: Partial<AppState>) => {
    setState(s => {
      const merged = { ...s, ...patch };
      const { kardexByItem, summaries } = calculateKardex(
        merged.processedTransactions,
        merged.vatRate,
        merged.negativeStockMode,
        merged.adjustedTxns || {},
        merged.selectedTafsil
      );
      return {
        ...merged,
        kardexByItem,
        itemSummaries: summaries
      };
    });
  };

  const handleMappingsComplete = (updatedFiles: FileData[]) => {
    const processed: ProcessedTransaction[] = [];

    updatedFiles.forEach(file => {
      file.rawRows.forEach((row, idx) => {
        const mapping = file.mapping;
        if (!mapping || !mapping.date || !mapping.itemName || !mapping.quantity || !mapping.price) return;

        const dateCol = mapping.date;
        const itemCol = mapping.itemName;
        const qtyCol = mapping.quantity;
        const priceCol = mapping.price;
        const priceType = mapping.priceType || 'TOTAL';
        const tafsilCol = mapping.tafsil;
        const taxRateCol = mapping.taxRate;
        const unitCol = mapping.unit;

        const pDate = parsePersianDate(String(row[dateCol])) || new Date();
        const rawQty = parseFloat(String(row[qtyCol]).replace(/,/g, ''));
        const rawPrice = parseFloat(String(row[priceCol]).replace(/,/g, ''));

        const qty = isNaN(rawQty) ? 0 : rawQty;
        let priceVal = isNaN(rawPrice) ? 0 : rawPrice;

        let unitPrice = priceVal;
        let totalPrice = priceVal;

        if (priceType === 'TOTAL') {
           unitPrice = qty > 0 ? priceVal / qty : 0;
        } else {
           totalPrice = priceVal * qty;
        }

        // Extract optional columns
        const tafsilValue = tafsilCol ? String(row[tafsilCol] || '').trim() : undefined;
        const unitValue = unitCol ? String(row[unitCol] || '').trim() : undefined;
        
        let customTaxValue: number | undefined = undefined;

        if (taxRateCol && row[taxRateCol] !== undefined) {
          const parsedTax = parseFloat(String(row[taxRateCol]).replace(/%/g, ''));
          if (!isNaN(parsedTax)) {
            customTaxValue = parsedTax;
          }
        }

        if (qty > 0 || (qty === 0 && row[itemCol])) {
           processed.push({
            id: `${file.id}_${idx}`,
            sourceFile: file.fileName,
            rowNumber: idx,
            date: pDate,
            timestamp: pDate.getTime(),
            itemName: String(row[itemCol]).trim(),
            type: file.type,
            quantity: Math.abs(qty),
            unitPrice: Math.abs(unitPrice),
            totalPrice: Math.abs(totalPrice),
            tafsil: tafsilValue,
            taxRate: customTaxValue,
            unit: unitValue,
          });
        }
      });
    });

    const { kardexByItem, summaries } = calculateKardex(
      processed,
      state.vatRate,
      state.negativeStockMode,
      state.adjustedTxns || {},
      state.selectedTafsil
    );

    setState(s => ({
      ...s,
      files: updatedFiles,
      processedTransactions: processed,
      kardexByItem,
      itemSummaries: summaries,
      step: 'REPORT'
    }));
  };

  const reset = () => {
    setState({
      step: 'UPLOAD',
      files: [],
      processedTransactions: [],
      itemSummaries: [],
      kardexByItem: {},
      vatRate: 0,
      negativeStockMode: 'ZERO_OUT',
      adjustedTxns: {},
      selectedTafsil: '__ALL__',
    });
  };

  const steps = [
    { id: 'UPLOAD', label: 'دسته بندی و بارگذاری فایل‌ها' },
    { id: 'MAP_COLUMNS', label: 'تطبیق هوشمند ستون‌ها' },
    { id: 'REPORT', label: 'گزارش تجمیعی کاردکس' },
  ];

  const currentStepIndex = steps.findIndex(s => s.id === state.step);

  return (
    <div className="min-h-screen bg-gray-50/50 font-sans text-gray-900" dir="rtl">
      {/* App Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 w-full shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-lg shadow-inner">K</div>
            <h1 className="font-bold text-gray-800 tracking-tight text-lg">کاردکس‌ساز هوشمند</h1>
          </div>
          {state.step !== 'UPLOAD' && (
             <button onClick={reset} className="text-sm font-bold text-gray-500 hover:text-gray-900 transition-colors border border-gray-200 px-4 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 cursor-pointer">
               + ایجاد کاردکس جدید
             </button>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        
        {/* Stepper */}
        <div className="w-full max-w-2xl mx-auto mb-10 flex items-center justify-between relative">
          <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-gray-200 -z-10 -translate-y-1/2"></div>
          {steps.map((s, idx) => {
            const isCompleted = idx < currentStepIndex;
            const isCurrent = idx === currentStepIndex;
            return (
              <div key={s.id} className="flex flex-col items-center gap-2 bg-gray-50/50 px-4 relative z-0">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                  isCompleted ? 'bg-emerald-500 text-white shadow-md' : 
                  isCurrent ? 'bg-amber-500 text-white ring-4 ring-amber-100 shadow-lg' : 
                  'bg-gray-200 text-gray-500 border-2 border-white'
                }`}>
                  {isCompleted ? <CheckCircle2 className="w-6 h-6" /> : <span className="font-bold">{idx + 1}</span>}
                </div>
                <span className={`text-sm font-bold ${isCurrent ? 'text-gray-900' : 'text-gray-400'}`}>{s.label}</span>
              </div>
            )
          })}
        </div>

        {/* Content Area */}
        <div className="transition-all duration-300">
          {state.step === 'UPLOAD' && (
             <MultiFileUpload 
                files={state.files} 
                onAddFile={handleAddFile} 
                onRemoveFile={handleRemoveFile} 
                onNext={handleGoToMapping} 
             />
          )}
          {state.step === 'MAP_COLUMNS' && (
             <MultiColumnMapper 
                files={state.files} 
                onMappingsComplete={handleMappingsComplete} 
             />
          )}
          {state.step === 'REPORT' && (
             <ReportView 
               kardexByItem={state.kardexByItem} 
               summaries={state.itemSummaries} 
               vatRate={state.vatRate}
               negativeStockMode={state.negativeStockMode}
               selectedTafsil={state.selectedTafsil || '__ALL__'}
               adjustedTxns={state.adjustedTxns || {}}
               processedTransactions={state.processedTransactions}
               onStateChange={(patch) => recalculateAndSetState(patch)}
             />
          )}
        </div>
      </main>
    </div>
  );
}
