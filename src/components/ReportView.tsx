import React, { useState, useMemo } from 'react';
import { KardexEntry, ItemSummary, ProcessedTransaction } from '../types';
import { formatNumber, formatCurrency } from '../lib/utils';
import { TargetSimulator } from './TargetSimulator';
import { GlobalOptimizer } from './GlobalOptimizer';
import { 
  AlertTriangle, 
  Layers, 
  HelpCircle, 
  Edit3, 
  Check, 
  X, 
  RefreshCw, 
  Filter, 
  Percent, 
  ShieldAlert,
  Sliders,
  DollarSign
} from 'lucide-react';

interface ReportViewProps {
  kardexByItem: Record<string, KardexEntry[]>;
  summaries: ItemSummary[];
  vatRate: number;
  negativeStockMode: 'ALLOW' | 'ZERO_OUT' | 'ADJUST_INITIAL';
  selectedTafsil: string;
  adjustedTxns: Record<string, { unitPrice?: number; quantity?: number }>;
  processedTransactions: ProcessedTransaction[];
  onStateChange: (patch: Partial<import('../types').AppState>) => void;
}

export function ReportView({ 
  kardexByItem, 
  summaries, 
  vatRate, 
  negativeStockMode,
  selectedTafsil,
  adjustedTxns,
  processedTransactions,
  onStateChange 
}: ReportViewProps) {
  
  const [selectedItem, setSelectedItem] = useState<string>(summaries[0]?.itemName || '');
  const [activeTab, setActiveTab] = useState<'KARDEX' | 'SUMMARY' | 'TAX_REPORT' | 'TARGET' | 'OPTIMIZER'>('KARDEX');

  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 50;

  // Inline pricing edits state
  const [editingTxnId, setEditingTxnId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState<number>(0);
  const [editQty, setEditQty] = useState<number>(0);

  const history = selectedItem ? kardexByItem[selectedItem] || [] : [];
  const currentSummary = summaries.find(s => s.itemName === selectedItem);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [selectedItem, activeTab, selectedTafsil, negativeStockMode]);

  const totalPages = Math.max(1, Math.ceil(history.length / rowsPerPage));
  const paginatedHistory = history.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  // Extract all Tafsils available (Buyers) across sales
  const allTafsils = useMemo(() => {
    const set = new Set<string>();
    processedTransactions.forEach(t => {
      if (t.tafsil) {
        set.add(t.tafsil);
      }
    });
    return Array.from(set);
  }, [processedTransactions]);

  // Tax percentage grouping calculation
  const taxGroups = useMemo(() => {
    const groups: Record<number, { sales: number; vat: number; cogs: number; profit: number; items: Set<string>; count: number }> = {};
    
    Object.entries(kardexByItem).forEach(([itemName, entries]) => {
      entries.forEach(entry => {
        if (entry.type === 'SALE') {
          const rate = entry.taxRate !== undefined ? entry.taxRate : vatRate;
          if (!groups[rate]) {
            groups[rate] = { sales: 0, vat: 0, cogs: 0, profit: 0, items: new Set(), count: 0 };
          }
          groups[rate].sales += entry.totalPrice;
          groups[rate].vat += entry.vat;
          groups[rate].cogs += entry.cogs;
          groups[rate].profit += entry.profit;
          groups[rate].items.add(itemName);
          groups[rate].count += 1;
        }
      });
    });

    return Object.entries(groups).map(([rate, data]) => ({
      rate: Number(rate),
      totalSales: data.sales,
      totalVat: data.vat,
      totalCogs: data.cogs,
      totalProfit: data.profit,
      itemsCount: data.items.size,
      recordsCount: data.count
    })).sort((a, b) => b.rate - a.rate);
  }, [kardexByItem, vatRate]);

  // Toggle or submit row adjustments to reached a target price replacement
  const startEditing = (entry: KardexEntry) => {
    setEditingTxnId(entry.id);
    setEditPrice(entry.unitPrice);
    setEditQty(entry.quantity);
  };

  const saveEdit = (txnId: string) => {
    const newAdjusted = {
      ...adjustedTxns,
      [txnId]: {
        unitPrice: editPrice,
        quantity: editQty
      }
    };
    onStateChange({ adjustedTxns: newAdjusted });
    setEditingTxnId(null);
  };

  const cancelEdit = () => {
    setEditingTxnId(null);
  };

  const removeAdjustment = (txnId: string) => {
    const copy = { ...adjustedTxns };
    delete copy[txnId];
    onStateChange({ adjustedTxns: copy });
  };

  const clearAllAdjustments = () => {
    onStateChange({ adjustedTxns: {} });
  };

  const handleApplyTarget = (newPrice: number) => {
    const copy = { ...adjustedTxns };
    history.forEach(entry => {
      if (entry.type === 'SALE') {
        copy[entry.id] = {
          ...copy[entry.id],
          unitPrice: newPrice
        };
      }
    });
    onStateChange({ adjustedTxns: copy });
    setActiveTab('KARDEX');
  };

  const exportCurrentKardex = () => {
    import('../lib/utils').then(({ exportToCsv }) => {
      const rows = [['تاریخ', 'تراکنش', 'مشتری/تفصیل', 'امضا', 'تعداد ورودی', 'ثمن واحد ورودی (ریال)', 'مبلغ کل ورودی', 'تعداد خروجی', 'ثمن واحد خروجی (ریال)', 'مبلغ کل خروجی', 'بهای فروش (خروجی)', 'موجودی', 'ارزش کل موجودی', 'بهای میانگین']];
      history.forEach(e => {
        const isIncoming = e.type === 'INITIAL' || e.type === 'PURCHASE' || e.type === 'SALE_RETURN';
        const isOutgoing = e.type === 'SALE' || e.type === 'PURCHASE_RETURN';
        
        rows.push([
          typeof e.date === 'string' ? e.date : e.date.toLocaleDateString('fa-IR'),
          e.type,
          e.tafsil || '-',
          e.sourceFile,
          isIncoming ? e.quantity : '',
          isIncoming ? e.unitPrice : '',
          isIncoming ? e.totalPrice : '',
          isOutgoing ? e.quantity : '',
          isOutgoing ? e.unitPrice : '',
          isOutgoing ? e.totalPrice : '',
          isOutgoing && e.type === 'SALE' ? e.cogs : '',
          e.balanceQuantity,
          e.balanceTotalCost,
          e.averageUnitCost
        ]);
      });
      exportToCsv(`kardex_${selectedItem}.csv`, rows);
    });
  };

  const hasAnyAdjustments = Object.keys(adjustedTxns).length > 0;

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-6">
      
      {/* Configuration & General Strategy Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 p-6 bg-white rounded-2xl shadow-sm border border-gray-150/80">
        
        {/* Topic Title */}
        <div className="lg:col-span-4 flex flex-col justify-center">
          <h2 className="text-xl font-black text-gray-800 flex items-center gap-2">
            داشبورد پیشرفته کاردکس کالا
          </h2>
          <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
            مدیریت موجودی‌های منفی، تعدیل و شبیه‌سازی نرخ‌ها، دسته‌بندی مالیاتی، کنترل تفصیل و تطبیق سودآوری.
          </p>
        </div>

        {/* Global Selectors row */}
        <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          
          {/* Selected Item Dropdown */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-gray-500 flex items-center gap-1">
              انتخاب کالا / محصول
            </label>
            <select 
              value={selectedItem} 
              onChange={e => setSelectedItem(e.target.value)}
              className="p-2.5 border border-gray-200 rounded-xl bg-gray-50 text-xs font-bold text-gray-800 focus:outline-none focus:border-emerald-500 focus:bg-white"
            >
              {summaries.map(s => (
                <option key={s.itemName} value={s.itemName}>{s.itemName}</option>
              ))}
            </select>
          </div>

          {/* Tafsil Dropdown Filter */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-gray-500 flex items-center gap-1">
              <Filter className="w-3 h-3 text-emerald-600" />
               تفصیل فروش (مشتری / گروه خریدار)
            </label>
            <select 
              value={selectedTafsil} 
              onChange={e => onStateChange({ selectedTafsil: e.target.value })}
              className="p-2.5 border border-gray-200 rounded-xl bg-gray-50 text-xs font-bold text-gray-800 focus:outline-none focus:border-emerald-500 focus:bg-white"
            >
              <option value="__ALL__">همه مشتریان و تفصیل‌ها (بدون فیلتر)</option>
              {allTafsils.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Negative Balance Mode Dropdown */}
          <div className="flex flex-col gap-1.5">
             <label className="text-xs font-bold text-gray-500 flex items-center gap-1">
               <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                تعیین شیوه کنترل موجودی منفی
             </label>
             <select
                value={negativeStockMode}
                onChange={e => onStateChange({ negativeStockMode: e.target.value as any })}
                className="p-2.5 border border-gray-200 rounded-xl bg-gray-50 text-xs font-bold text-gray-800 focus:outline-none focus:border-emerald-500 focus:bg-white"
             >
                <option value="ALLOW">آزاد (بدون اعمال محدودیت)</option>
                <option value="ZERO_OUT">حذف منفی (کپ سقف خروجی به اندازه موجودی روز)</option>
                <option value="ADJUST_INITIAL">تعدیل هوشمند (افزایش خودکار اول دوره جهت برابری)</option>
             </select>
          </div>

        </div>
      </div>

      {/* Auxiliary Settings Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-gray-100 rounded-xl border border-gray-200 text-xs font-semibold text-gray-700">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <span>نرخ ارزش افزوده عمومی:</span>
            <input 
              type="number" 
              value={vatRate} 
              onChange={e => onStateChange({ vatRate: Number(e.target.value) })}
              className="w-16 p-1 border border-gray-300 rounded bg-white text-center text-xs font-mono focus:outline-none focus:border-emerald-500"
            />
            <span>%</span>
          </div>
          
          <div className="flex items-center gap-1.5">
            <span>موجودی منفی:</span>
            {negativeStockMode === 'ALLOW' && <span className="text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-100 font-bold">بدون کنترل (آزاد)</span>}
            {negativeStockMode === 'ZERO_OUT' && <span className="text-sky-600 bg-sky-50 px-2 py-0.5 rounded border border-sky-100 font-bold">باقیمانده صفر (پوشش خروجی)</span>}
            {negativeStockMode === 'ADJUST_INITIAL' && <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 font-bold">تعدیل هوشمند اول دوره (ترمیم خودکار)</span>}
          </div>
        </div>

        {hasAnyAdjustments && (
          <button 
            onClick={clearAllAdjustments}
            className="flex items-center gap-1 px-2.5 py-1 text-rose-700 bg-rose-50 border border-rose-200 rounded hover:bg-rose-100 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            حذف تمام تغییرات
          </button>
        )}

        {/* Global Export Buttons */}
        <div className="flex items-center gap-2 mr-auto" dir="ltr">
          <button
            onClick={() => {
              import('../lib/utils').then(({ exportToCsv }) => {
                const rows = [['نام کالا', 'موجودی اولیه', 'ارزش اولیه', 'تعداد خرید', 'ارزش خرید', 'تعداد فروش', 'درآمد فروش', 'موجودی پایان', 'ارزش پایان', 'بهای تمام شده فروش', 'سود ناخالص', 'میانگین موزون بها']];
                summaries.forEach(s => {
                  rows.push([s.itemName, s.initialQuantity, s.initialValue, s.purchasedQuantity, s.purchasedValue, s.soldQuantity, s.salesRevenue, s.endingQuantity, s.endingValue, s.cogs, s.grossProfit, s.averageUnitCost]);
                });
                exportToCsv('sud_zian_summary.csv', rows);
              });
            }}
            className="flex items-center gap-1 px-3 py-1.5 text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 transition-colors whitespace-nowrap text-xs shadow-sm font-bold"
          >
            دانلود گزارش سود و زیان تجمیعی (CSV)
          </button>
          <button
            onClick={() => {
              import('../lib/utils').then(({ exportToCsv }) => {
                const rows = [['نام کالا', 'شناسه', 'تاریخ', 'تفصیل/خریدار', 'تعداد فروش', 'فی فروش', 'درآمد فروش (ریال)', 'ارزش افزوده', 'بهای تمام شده', 'سود ناخالص']];
                Object.values(kardexByItem).forEach(history => {
                  history.forEach(tx => {
                    if (tx.type === 'SALE') {
                      rows.push([
                        tx.itemName,
                        `#${tx.id.split('_')[1] || tx.id}`,
                        typeof tx.date === 'string' ? tx.date : tx.date.toLocaleDateString('fa-IR'),
                        tx.tafsil || '-',
                        tx.quantity,
                        tx.unitPrice,
                        tx.totalPrice,
                        tx.vat,
                        tx.cogs,
                        tx.profit
                      ]);
                    }
                  });
                });
                exportToCsv('final_sales_invoices.csv', rows);
              });
            }}
            className="flex items-center gap-1 px-3 py-1.5 text-indigo-700 bg-indigo-50 border border-indigo-200 rounded hover:bg-indigo-100 transition-colors whitespace-nowrap text-xs shadow-sm font-bold"
          >
            دانلود فاکتورهای فروش نهایی (CSV)
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button 
          onClick={() => setActiveTab('KARDEX')} 
          className={`px-6 py-3 font-bold text-sm transition-colors ${activeTab === 'KARDEX' ? 'border-b-2 border-emerald-600 text-emerald-800 bg-white/40' : 'text-gray-500 hover:text-gray-850'}`}
        >
          ریز تراکنش‌ها و جایگزینی نرخ (تاریخی)
        </button>
        <button 
          onClick={() => setActiveTab('SUMMARY')} 
          className={`px-6 py-3 font-bold text-sm transition-colors ${activeTab === 'SUMMARY' ? 'border-b-2 border-emerald-600 text-emerald-800 bg-white/40' : 'text-gray-500 hover:text-gray-850'}`}
        >
          خلاصه وضعیت و سود/زیان کالا
        </button>
        <button 
          onClick={() => setActiveTab('TAX_REPORT')} 
          className={`px-6 py-3 font-bold text-sm transition-colors ${activeTab === 'TAX_REPORT' ? 'border-b-2 border-emerald-600 text-emerald-800 bg-white/40' : 'text-gray-500 hover:text-gray-850'}`}
        >
          گزارش و گروه‌بندی درصد مالیات
        </button>
        <button 
          onClick={() => setActiveTab('TARGET')} 
          className={`px-6 py-3 font-bold text-sm transition-colors tabular-nums ${activeTab === 'TARGET' ? 'border-b-2 border-emerald-600 text-emerald-800 bg-white/40' : 'text-gray-500 hover:text-gray-850'}`}
        >
          سودآور‌ی و تخمین اهداف (Simulator)
        </button>
        <button 
          onClick={() => setActiveTab('OPTIMIZER')} 
          className={`px-6 py-3 font-bold text-sm transition-colors ${activeTab === 'OPTIMIZER' ? 'border-b-2 border-indigo-600 text-indigo-800 bg-white/40' : 'text-gray-500 hover:text-gray-850'}`}
        >
          تنظیمات پیشرفته هوش کاردکس
        </button>
      </div>

      {/* Main Container Content */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-150 overflow-hidden min-h-[480px]">
        
        {/* TAB 1: KARDEX LIST & INLINE PRICING REPLACEMENT */}
        {activeTab === 'KARDEX' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-bold">
                <tr>
                  <th className="p-4 text-xs font-black">شناسه / تاریخ</th>
                  <th className="p-4 text-xs font-black">شرح تراکنش</th>
                  <th className="p-4 text-xs font-black">تفصیل/خریدار</th>
                  <th className="p-4 text-xs font-black">مقدار ورود</th>
                  <th className="p-4 text-xs font-black">مقدار خروج</th>
                  <th className="p-4 text-xs font-black">باقیمانده موجودی</th>
                  <th className="p-4 text-xs font-black">فی واحد (جایگرین شده)</th>
                  <th className="p-4 text-xs font-black">فی میانگین موزون</th>
                  <th className="p-4 text-xs font-black">ارزش کل موجودی</th>
                  <th className="p-4 text-xs font-black bg-amber-50/40">بهای فروش رفته (COGS)</th>
                  <th className="p-4 text-xs font-black bg-emerald-50/40">حاصل سود / زیان</th>
                  <th className="p-3 text-left text-xs font-black">عملیات تعدیل هدف</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {paginatedHistory.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="p-12 text-center text-gray-400 font-medium">
                      تراکنشی یافت نشد. لطفا مطمئن شوید فایل‌ها به درستی جفت شده باشند.
                    </td>
                  </tr>
                ) : paginatedHistory.map((entry, idx) => {
                  const isIncoming = entry.type === 'INITIAL' || entry.type === 'PURCHASE' || entry.type === 'SALE_RETURN';
                  const isOutgoing = entry.type === 'SALE' || entry.type === 'PURCHASE_RETURN';
                  const isEdited = adjustedTxns[entry.id] !== undefined;
                  const isBeingEdited = editingTxnId === entry.id;

                  return (
                    <tr 
                      key={entry.id} 
                      className={`hover:bg-gray-50/50 transition-colors ${isEdited ? 'bg-amber-50/20' : ''} ${isBeingEdited ? 'bg-amber-50/60' : ''}`}
                    >
                      <td className="p-4">
                        <span className="text-gray-450 block text-[9px] font-mono">#{entry.id.split('_')[1] || entry.id}</span>
                        <span className="font-mono text-gray-700" dir="ltr">{new Date(entry.date).toLocaleDateString('fa-IR')}</span>
                      </td>
                      <td className="p-4 font-bold">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                          entry.type === 'INITIAL' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                          entry.type === 'PURCHASE' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                          entry.type === 'SALE' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' :
                          'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {getTypeName(entry.type)}
                        </span>
                      </td>
                      <td className="p-4 font-semibold text-gray-600 truncate max-w-[120px]" title={entry.tafsil}>
                        {entry.tafsil || '—'}
                      </td>
                      
                      {/* Qty Handling / Inputs */}
                      <td className="p-4 text-emerald-600 font-mono font-bold">
                        {isBeingEdited ? (
                          <input 
                            type="number"
                            value={editQty}
                            onChange={e => setEditQty(Number(e.target.value))}
                            className="p-1 border border-gray-300 rounded font-mono text-xs w-16 text-center"
                          />
                        ) : (
                          isIncoming ? formatNumber(entry.quantity) : '—'
                        )}
                      </td>
                      <td className="p-4 text-rose-600 font-mono font-bold">
                        {isBeingEdited ? (
                          <input 
                            type="number"
                            value={editQty}
                            onChange={e => setEditQty(Number(e.target.value))}
                            className="p-1 border border-gray-300 rounded font-mono text-xs w-16 text-center"
                          />
                        ) : (
                          isOutgoing ? formatNumber(entry.quantity) : '—'
                        )}
                      </td>

                      <td className="p-4 font-mono font-bold text-gray-900 bg-gray-50/50">
                        {formatNumber(entry.balanceQuantity)}
                      </td>
                      
                      {/* Unit Price Input */}
                      <td className="p-4 font-mono font-bold">
                        {isBeingEdited ? (
                          <input 
                            type="number"
                            value={editPrice}
                            onChange={e => setEditPrice(Number(e.target.value))}
                            className="p-1 border border-gray-300 rounded font-mono text-xs w-24 text-center focus:outline-none focus:ring-2 focus:ring-emerald-400"
                          />
                        ) : (
                          <div className="flex flex-col">
                            <span className={isEdited ? 'text-amber-700 font-black' : 'text-gray-900'}>
                              {formatCurrency(entry.unitPrice)}
                            </span>
                            {isEdited && <span className="text-[9px] text-amber-500 font-semibold">(جایگزین شده)</span>}
                          </div>
                        )}
                      </td>

                      <td className="p-4 font-mono text-gray-500">
                        {formatCurrency(entry.averageUnitCost)}
                      </td>
                      <td className="p-4 font-mono font-medium text-gray-700">
                        {formatCurrency(entry.balanceTotalCost)}
                      </td>
                      
                      <td className="p-4 font-mono text-rose-600 bg-amber-50/10 font-medium">
                        {entry.cogs > 0 ? formatCurrency(entry.cogs) : '—'}
                      </td>
                      
                      <td className={`p-4 font-mono font-bold bg-emerald-50/10 text-right ${entry.profit > 0 ? 'text-emerald-700' : entry.profit < 0 ? 'text-rose-600' : 'text-gray-400'}`}>
                        {entry.profit !== 0 ? formatCurrency(entry.profit) : '—'}
                      </td>

                      <td className="p-3 text-left">
                        {isBeingEdited ? (
                          <div className="flex items-center gap-1 justify-end">
                            <button 
                              onClick={() => saveEdit(entry.id)} 
                              className="p-1 bg-emerald-500 text-white rounded hover:bg-emerald-600 transition-colors"
                              title="ذخیره تعدیل"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              onClick={cancelEdit} 
                              className="p-1 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors"
                              title="انصراف"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 justify-end">
                            <button 
                              onClick={() => startEditing(entry)} 
                              className="p-1.5 text-gray-500 hover:text-emerald-600 hover:bg-gray-150 rounded transition-colors"
                              title="تعدیل نرخ و تعداد فرضی"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            {isEdited && (
                              <button 
                                onClick={() => removeAdjustment(entry.id)} 
                                className="p-1 text-rose-500 hover:bg-rose-50 rounded"
                                title="حذف تعدیل تکی"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            
            <div className="flex items-center justify-between p-4 border-t border-gray-100 bg-gray-50/50">
              <button 
                onClick={exportCurrentKardex}
                className="px-4 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded hover:bg-emerald-100 transition-colors shadow-sm"
              >
                دانلود این کاردکس در اکسل (CSV)
              </button>

              {totalPages > 1 && (
                <div className="flex items-center gap-4">
                  <span className="text-xs text-gray-500 font-medium">
                    نمایش {(currentPage - 1) * rowsPerPage + 1} تا {Math.min(currentPage * rowsPerPage, history.length)} از {history.length}
                  </span>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1.5 text-xs font-bold text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      قبلی
                    </button>
                    <span className="text-xs font-bold text-gray-600 px-2">صفحه {currentPage} از {totalPages}</span>
                    <button 
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1.5 text-xs font-bold text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      بعدی
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: SUMMARY & COST OF GOODS SOLD */}
        {activeTab === 'SUMMARY' && currentSummary && (
          <div className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <SummaryCard title="موجودی اول دوره" qty={currentSummary.initialQuantity} value={currentSummary.initialValue} />
              <SummaryCard title="خرید طی دوره" qty={currentSummary.purchasedQuantity} value={currentSummary.purchasedValue} />
              <SummaryCard title="موجودی پایان دوره" qty={currentSummary.endingQuantity} value={currentSummary.endingValue} highlight />
              
              <SummaryCard title="فروش طی دوره" qty={currentSummary.soldQuantity} value={currentSummary.salesRevenue} />
              <SummaryCard title="بهای تمام شده فروش (میانگین موزون)" qty={currentSummary.soldQuantity} value={currentSummary.cogs} />
              
              {/* Profit metrics with precise percentage stats */}
              <div className="p-6 rounded-2xl border border-emerald-100 flex flex-col gap-2 bg-gradient-to-br from-emerald-50 to-teal-50/20 shadow-sm">
                <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">سود و زیان ناخالص کالا</span>
                
                <span className={`text-2xl font-black font-mono tracking-tight mt-1 ${currentSummary.grossProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                  {formatCurrency(currentSummary.grossProfit)}
                  <span className="text-xs text-slate-500 font-sans font-normal mr-2">ریال</span>
                </span>

                <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-emerald-100/60">
                  <div className="flex flex-col">
                     <span className="text-[10px] text-gray-500">حاشیه نسبت به بها (Markup)</span>
                     <span className="text-xs font-mono font-bold text-emerald-700">
                        {currentSummary.cogs > 0 ? formatNumber((currentSummary.grossProfit / currentSummary.cogs) * 100) : '0'} %
                     </span>
                  </div>
                  <div className="flex flex-col">
                     <span className="text-[10px] text-gray-500">مارجین فروش (Margin)</span>
                     <span className="text-xs font-mono font-bold text-sky-700">
                        {currentSummary.salesRevenue > 0 ? formatNumber((currentSummary.grossProfit / currentSummary.salesRevenue) * 100) : '0'} %
                     </span>
                  </div>
                </div>

                <div className="text-[10px] text-slate-450 mt-3 pt-2 border-t border-emerald-100/40">
                  میانگین نهایی بها: {formatCurrency(currentSummary.averageUnitCost)} ریال
                </div>
              </div>
            </div>

            {hasAnyAdjustments && (
              <div className="mt-8 p-4 bg-amber-50 rounded-xl border border-amber-200/50 flex flex-col gap-2 text-xs text-amber-900">
                <strong className="font-bold flex items-center gap-1"><AlertTriangle className="w-4 h-4 text-amber-500" /> توجه: ریز مبالغ بر روی سود اعمال شده‌اند.</strong>
                تعدیلات دستی نرخ در فایلهای کاردکس فعال است. ارقام سود ناخالص بالا بازتاب‌دهنده قیمت‌های هدف جدید هستند. برای بازگشت به فایل اصلی، گزینه حذف تمام نرخ‌های جایگزین را در نوار وضعیت کلیک کنید.
              </div>
            )}
          </div>
        )}

        {/* TAB 3: VAT BRACKET & TAX CODE GROUPS */}
        {activeTab === 'TAX_REPORT' && (
          <div className="p-8">
            <div className="mb-6">
              <h3 className="text-lg font-bold text-gray-800">گزارش تراز و عوارض بر اساس گروه درصد عوارض (مالیات سطری)</h3>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                 در این بخش، محصولات و فاکتورهای فروش بر اساس کدهای ارزش افزوده و مالیاتی گروه بندی شده‌اند. این فرآیند بر مبنای ستون مالیاتی اکسل بارگذاری شده کاردکس تنظیم می‌شود.
              </p>
            </div>

            <div className="overflow-x-auto border border-gray-200 rounded-xl">
              <table className="w-full text-sm text-right">
                <thead className="bg-gray-50 border-b border-gray-100 text-gray-600 font-bold text-xs">
                  <tr>
                    <th className="p-4">درصد مالیات و عوارض (Bracket)</th>
                    <th className="p-4">تعداد کالاها</th>
                    <th className="p-4">تعداد فاکتورهای فروش (تراکنش)</th>
                    <th className="p-4">مجموع فروش خالص (درآمد)</th>
                    <th className="p-4 text-left">مجموع عوارض و مالیات تعلق گرفته (VAT)</th>
                    <th className="p-4">بهای تمام شده کالای فروش رفته</th>
                    <th className="p-4 text-emerald-700 bg-emerald-50/50">سود ناخالص خالص حاصله</th>
                    <th className="p-4">نسبت حاشیه سود نهایی</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs">
                  {taxGroups.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-gray-400">تراکنش فروش مالیاتی یافت نشد</td>
                    </tr>
                  ) : taxGroups.map((group, idx) => {
                    const margin = group.totalSales > 0 ? (group.totalProfit / group.totalSales) * 100 : 0;
                    return (
                      <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                        <td className="p-4 font-bold flex items-center gap-1.5 text-gray-800">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                          {group.rate} %
                        </td>
                        <td className="p-4 font-mono font-semibold">{group.itemsCount} کالا</td>
                        <td className="p-4 font-mono text-gray-500">{group.recordsCount} فاکتور</td>
                        <td className="p-4 font-mono font-bold">{formatCurrency(group.totalSales)} ریال</td>
                        <td className="p-4 font-mono text-left text-gray-600 font-semibold">{formatCurrency(group.totalVat)} ریال</td>
                        <td className="p-4 font-mono text-gray-500">{formatCurrency(group.totalCogs)} ریال</td>
                        <td className="p-4 font-mono font-bold text-emerald-700 bg-emerald-50/30">{formatCurrency(group.totalProfit)} ریال</td>
                        <td className="p-4 font-mono text-sky-700 font-bold">{formatNumber(margin)}%</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              <div className="p-5 rounded-xl border border-gray-100 bg-gray-50 flex items-start gap-3">
                 <Percent className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                 <div>
                    <h4 className="text-xs font-bold text-gray-800 mb-1">مزیت گروه‌بندی ارزش افزوده کالاها</h4>
                    <p className="text-[11px] text-gray-500 leading-relaxed">
                       شما می‌توانید فایلهایی با نرخ‌های مالیاتی متفاوت (کالاهای معاف، لبنیات با عوارض کم، و کالاهای کالابرگی لوکس با مالیات استاندارد ۱۰٪) را به تفکیک یا مجموع پردازش کنید و اظهارنامه دوره‌ای را مطابقت دهید.
                    </p>
                 </div>
              </div>
              <div className="p-5 rounded-xl border border-gray-100 bg-gray-50 flex items-start gap-3">
                 <Sliders className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                 <div>
                    <h4 className="text-xs font-bold text-gray-800 mb-1">تطبیق بها با فیلتر تفصیل</h4>
                    <p className="text-[11px] text-gray-500 leading-relaxed">
                       فعال کردن فیلتر تفصیل در بالای همین صفحه نیز تمام سودها و تراکنش‌های عوارض این جدول را متناسب با خریدار منتخب محدود می‌سازد تا گزارش مشتری کاملی داشته باشید.
                    </p>
                 </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: ADVANCED VALUE SIMULATOR */}
        {activeTab === 'TARGET' && currentSummary && (
          <TargetSimulator summary={currentSummary} onApplyTarget={handleApplyTarget} />
        )}

        {/* TAB 5: GLOBAL OPTIMIZER */}
        {activeTab === 'OPTIMIZER' && (
          <GlobalOptimizer 
             kardexByItem={kardexByItem}
             summaries={summaries}
             vatRate={vatRate}
             adjustedTxns={adjustedTxns}
             processedTransactions={processedTransactions}
             onStateChange={onStateChange}
          />
        )}

      </div>
    </div>
  );
}

function SummaryCard({ title, qty, value, highlight = false }: { title: string, qty: number, value: number, highlight?: boolean }) {
  return (
    <div className={`p-6 rounded-2xl border flex flex-col gap-2.5 transition-all shadow-sm ${highlight ? 'border-emerald-250 bg-emerald-50/20' : 'border-gray-150 bg-gray-50/40 hover:bg-gray-50'}`}>
      <span className="text-xs font-extrabold text-gray-600 uppercase tracking-wide">{title}</span>
      <div className="flex flex-col mt-1 gap-1">
        <span className="text-[10px] text-gray-400 font-bold">تعداد / مقدار فیزیکی</span>
        <span className="text-base font-black font-mono text-gray-850">{formatNumber(qty)}</span>
      </div>
      <div className="flex flex-col mt-1 gap-1">
        <span className="text-[10px] text-gray-400 font-bold">ارزش ارزشیابی کل</span>
        <span className="text-lg font-black font-mono tracking-tight text-gray-900">
          {formatCurrency(value)}
          <span className="text-[10px] font-sans font-normal text-gray-500 mr-1">ریال</span>
        </span>
      </div>
    </div>
  );
}

function getTypeName(type: string) {
  const map: Record<string, string> = {
    'INITIAL': 'موجودی اول دوره',
    'PURCHASE': 'خرید طی دوره',
    'PURCHASE_RETURN': 'برگشت از خرید',
    'SALE': 'فروش طی دوره',
    'SALE_RETURN': 'برگشت از فروش',
  };
  return map[type] || type;
}
