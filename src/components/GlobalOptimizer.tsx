import React, { useState, useMemo } from "react";
import { KardexEntry, ItemSummary, ProcessedTransaction } from "../types";
import { formatCurrency, formatNumber } from "../lib/utils";
import { Play, Settings, ShieldAlert, Cpu, CheckCircle } from "lucide-react";

interface GlobalOptimizerProps {
  kardexByItem: Record<string, KardexEntry[]>;
  summaries: ItemSummary[];
  vatRate: number;
  adjustedTxns: Record<string, { unitPrice?: number; quantity?: number }>;
  processedTransactions: ProcessedTransaction[];
  onStateChange: (patch: Partial<import("../types").AppState>) => void;
}

export function GlobalOptimizer({
  kardexByItem,
  summaries,
  vatRate,
  adjustedTxns,
  processedTransactions,
  onStateChange,
}: GlobalOptimizerProps) {
  // Strategy States
  const [fixNegativeStock, setFixNegativeStock] = useState(true);
  const [targetSalesRevenue, setTargetSalesRevenue] = useState<number | "">("");
  const [targetTaxAmount, setTargetTaxAmount] = useState<number | "">("");

  const [adjustQuantities, setAdjustQuantities] = useState(true);
  const [adjustPrices, setAdjustPrices] = useState(true);
  const [taxShiftStrategy, setTaxShiftStrategy] = useState(false);
  const [exemptItems, setExemptItems] = useState<Set<string>>(new Set());
  const [taxShiftAmount, setTaxShiftAmount] = useState<number | "">("");

  const [minProfitMargin, setMinProfitMargin] = useState<number>(5);
  const [maxProfitMargin, setMaxProfitMargin] = useState<number>(30);
  const [targetProfitPercent, setTargetProfitPercent] = useState<number | "">(
    "",
  );
  const [roundingLevel, setRoundingLevel] = useState<number>(1); // 1 = none, 1000 = nearest thousand

  const [optScope, setOptScope] = useState<'GLOBAL' | 'TAX_GROUP' | 'ITEM'>('GLOBAL');
  const [optTaxGroup, setOptTaxGroup] = useState<number>(0);
  const [optItemName, setOptItemName] = useState<string>("");

  const [taxShiftMaxQtyRatio, setTaxShiftMaxQtyRatio] = useState<number>(20);
  const [taxShiftMaxPriceRatio, setTaxShiftMaxPriceRatio] = useState<number>(15);

  const [isRunning, setIsRunning] = useState(false);
  const [lastRunStats, setLastRunStats] = useState<{
    itemsAffected: number;
    salesCountAffected: number;
    revenueDiff: number;
  } | null>(null);

  const currentTotalRevenue = useMemo(() => {
    return summaries
      .filter(s => {
          if (optScope === 'ITEM') return s.itemName === optItemName;
          if (optScope === 'TAX_GROUP') return (s.itemVatRate !== undefined ? s.itemVatRate : vatRate) === optTaxGroup;
          return true;
      })
      .reduce((acc, s) => acc + s.salesRevenue, 0);
  }, [summaries, optScope, optItemName, optTaxGroup, vatRate]);

  const currentTotalTax = useMemo(() => {
    let tot = 0;
    Object.entries(kardexByItem).forEach(([itemName, history]) => {
      const summary = summaries.find(s => s.itemName === itemName);
      if (optScope === 'ITEM' && itemName !== optItemName) return;
      if (summary && optScope === 'TAX_GROUP' && (summary.itemVatRate !== undefined ? summary.itemVatRate : vatRate) !== optTaxGroup) return;
      
      history.forEach((tx) => {
        if (tx.type === "SALE" && tx.vat) {
          tot += tx.vat;
        }
      });
    });
    return tot;
  }, [kardexByItem, summaries, optScope, optItemName, optTaxGroup, vatRate]);

  const runOptimizer = () => {
    setIsRunning(true);

    setTimeout(() => {
      const newAdjustments = { ...adjustedTxns };
      let itemsAffected = new Set<string>();
      let salesCountAffected = 0;

      // We will clone the transactions into a temporary space to simulate timeline
      const txnsByItem: Record<string, ProcessedTransaction[]> = {};
      let allItems = Object.keys(kardexByItem).filter(itemName => {
          if (optScope === 'ITEM') return itemName === optItemName;
          if (optScope === 'TAX_GROUP') {
              const summary = summaries.find(s => s.itemName === itemName);
              if (!summary) return false;
              return (summary.itemVatRate !== undefined ? summary.itemVatRate : vatRate) === optTaxGroup;
          }
          return true;
      });

      // Step 1: Initialize local state tracking for inventory
      allItems.forEach((item) => {
        const history = kardexByItem[item];
        txnsByItem[item] = history.map((h) => ({
          ...h, // Base properties from original ProcessedTransaction
          quantity: h.quantity,
          unitPrice: h.unitPrice,
          totalPrice: h.totalPrice,
        }));
      });

      // Step 2: Auto-fix negative stock
      if (fixNegativeStock) {
        allItems.forEach((item) => {
          let runningQty = 0;
          txnsByItem[item].forEach((tx) => {
            if (
              tx.type === "INITIAL" ||
              tx.type === "PURCHASE" ||
              tx.type === "SALE_RETURN"
            ) {
              runningQty += tx.quantity;
            } else if (tx.type === "SALE" || tx.type === "PURCHASE_RETURN") {
              if (runningQty - tx.quantity < 0 && tx.type === "SALE") {
                // We must shrink this sale
                const possibleQty = Math.max(0, runningQty);
                if (tx.quantity !== possibleQty) {
                  const diff = tx.quantity - possibleQty;
                  tx.quantity = possibleQty;
                  tx.totalPrice = tx.quantity * tx.unitPrice;

                  newAdjustments[tx.id] = {
                    ...newAdjustments[tx.id],
                    quantity: tx.quantity,
                  };
                  itemsAffected.add(item);
                  salesCountAffected++;
                }
              }
              runningQty -= tx.quantity;
            }
          });
        });
      }

      // Step 2.5: Shift Revenue between Taxable and Exempt
      const shiftVal = Number(taxShiftAmount) || 0;
      if (
        taxShiftStrategy &&
        shiftVal > 0 &&
        exemptItems.size > 0 &&
        exemptItems.size < allItems.length
      ) {
        const taxableSales: ProcessedTransaction[] = [];
        const exemptSales: ProcessedTransaction[] = [];

        allItems.forEach((item) => {
          const isExempt = exemptItems.has(item);
          txnsByItem[item].forEach((tx) => {
            if (tx.type === "SALE") {
              if (isExempt) exemptSales.push(tx);
              else taxableSales.push(tx);
            }
          });
        });

        const totalTaxableRev = taxableSales.reduce(
          (sum, tx) => sum + tx.totalPrice,
          0,
        );
        const totalExemptRev = exemptSales.reduce(
          (sum, tx) => sum + tx.totalPrice,
          0,
        );

        if (totalTaxableRev > shiftVal && totalExemptRev > 0) {
          const taxableRatio = (totalTaxableRev - shiftVal) / totalTaxableRev;
          const exemptRatio = (totalExemptRev + shiftVal) / totalExemptRev;

          // Apply constrained ratio
          const applyConstraint = (tx: ProcessedTransaction, ratio: number) => {
            const originalPrice = tx.unitPrice;
            const originalQty = tx.quantity;
            let targetTotal = tx.totalPrice * ratio;
            
            if (adjustQuantities && ratio !== 1) {
              let suggestedQty = Math.floor(targetTotal / (originalPrice || 1));
              
              // constrain qty shift
              const maxAllowedQtyShift = originalQty * (taxShiftMaxQtyRatio / 100);
              let newQty = suggestedQty;
              if (suggestedQty > originalQty + maxAllowedQtyShift) newQty = Math.floor(originalQty + maxAllowedQtyShift);
              if (suggestedQty < originalQty - maxAllowedQtyShift) newQty = Math.ceil(originalQty - maxAllowedQtyShift);
              
              if (newQty > 0) {
                 tx.quantity = newQty;
                 targetTotal = tx.quantity * originalPrice; 
              }
            }
            
            if (adjustPrices && ratio !== 1) {
              const remainingRatioToAchieve = ratio / (tx.quantity / originalQty);
              let targetPrice = originalPrice * remainingRatioToAchieve;
              
              // constrain price shift
              const maxAllowedPriceShift = originalPrice * (taxShiftMaxPriceRatio / 100);
              let newPrice = targetPrice;
              if (targetPrice > originalPrice + maxAllowedPriceShift) newPrice = originalPrice + maxAllowedPriceShift;
              if (targetPrice < originalPrice - maxAllowedPriceShift) newPrice = originalPrice - maxAllowedPriceShift;
              
              tx.unitPrice = newPrice;
              tx.totalPrice = tx.quantity * newPrice;
            } else {
               tx.totalPrice = tx.quantity * originalPrice;
            }
          };

          taxableSales.forEach((tx) => applyConstraint(tx, taxableRatio));
          exemptSales.forEach((tx) => applyConstraint(tx, exemptRatio));
        }
      }

      // Step 3: Complex Quantity/Price Adjustments to hit target revenue
      let currentRev = 0;
      let currentTx = 0;

      const allSales: ProcessedTransaction[] = [];
      allItems.forEach((item) => {
        txnsByItem[item].forEach((tx) => {
          if (tx.type === "SALE") {
            allSales.push(tx);
            currentRev += tx.totalPrice;
            currentTx +=
              tx.totalPrice *
              ((tx.taxRate !== undefined ? tx.taxRate : vatRate) / 100);
          }
        });
      });

      const targetRevVal = Number(targetSalesRevenue) || currentRev;
      const targetTaxVal = Number(targetTaxAmount) || currentTx;

      // Simplified heuristic: calculate global ratio needed
      const revRatio = currentRev > 0 ? targetRevVal / currentRev : 1;

      allSales.forEach((sale) => {
        // Find average cost from history to respect margins
        const historyEntry = kardexByItem[sale.itemName]?.find(
          (h) => h.id === sale.id,
        );
        const avgCost = historyEntry?.averageUnitCost || 0;

        const originalSale = kardexByItem[sale.itemName]?.find(
          (h) => h.id === sale.id,
        );
        if (!originalSale) return;

        let targetSaleRev = sale.totalPrice * revRatio;
        
        // --- PRIORITY 1: Adjust Quantities if requested ---
        if (adjustQuantities) {
           if (revRatio !== 1) {
             const suggestedQty = Math.max(0, Math.floor(targetSaleRev / (originalSale.unitPrice || 1)));
             if (suggestedQty !== sale.quantity) {
                 sale.quantity = suggestedQty;
                 sale.totalPrice = sale.quantity * sale.unitPrice;
                 // Recompute target sale rev remaining for price adjustment
                 targetSaleRev = targetSaleRev; 
             }
           }
        }

        // --- PRIORITY 2: Adjust Prices if requested ---
        if (adjustPrices) {
          const baseCostOfThisSale = avgCost;
          const minAllowedPrice =
            minProfitMargin > 0
              ? baseCostOfThisSale * (1 + minProfitMargin / 100)
              : baseCostOfThisSale;
          const maxAllowedPrice =
            maxProfitMargin > 0
              ? baseCostOfThisSale * (1 + maxProfitMargin / 100)
              : baseCostOfThisSale * 5;

          let desiredPrice =
            sale.quantity > 0 ? targetSaleRev / sale.quantity : sale.unitPrice;

          // Override if specific target profit % is specified
          if (targetProfitPercent !== "") {
            desiredPrice =
              baseCostOfThisSale * (1 + Number(targetProfitPercent) / 100);
          }

          // Cap price to margins unless a specific target is set (limits still technically apply if they are strict limits)
          if (desiredPrice < minAllowedPrice && avgCost > 0)
            desiredPrice = minAllowedPrice;
          if (desiredPrice > maxAllowedPrice && avgCost > 0)
            desiredPrice = maxAllowedPrice;

          // Apply rounding
          if (roundingLevel > 1) {
            desiredPrice =
              Math.round(desiredPrice / roundingLevel) * roundingLevel;
          }

          if (desiredPrice !== sale.unitPrice) {
            sale.unitPrice = desiredPrice;
            sale.totalPrice = sale.quantity * desiredPrice;
          }
        }

        // Final check if anything changed compared to original
        if (
          sale.unitPrice !== originalSale.unitPrice ||
          sale.quantity !== originalSale.quantity
        ) {
          newAdjustments[sale.id] = {
            ...newAdjustments[sale.id],
            unitPrice: sale.unitPrice,
            quantity: sale.quantity,
          };
          itemsAffected.add(sale.itemName);
          salesCountAffected++;
        }
      });

      onStateChange({ adjustedTxns: newAdjustments });
      setLastRunStats({
        itemsAffected: itemsAffected.size,
        salesCountAffected: salesCountAffected,
        revenueDiff: 0,
      });
      setIsRunning(false);
    }, 500);
  };

  const clearOptimizer = () => {
    onStateChange({ adjustedTxns: {} });
    setLastRunStats(null);
  };

  return (
    <div className="p-8 pb-16">
      <div className="mb-6 border-b border-gray-100 pb-4">
        <h3 className="text-xl font-black text-gray-800 flex items-center gap-2">
          <Cpu className="w-5 h-5 text-indigo-600" />
          موتور هوشمند تنظیم کاردکس و اهداف (Global Optimizer)
        </h3>
        <p className="text-sm text-gray-500 mt-2 leading-relaxed">
          این ابزار با بررسی سراسری تمامی کالاها، سعی می‌کند تا مقادیر
          موجودی‌های منفی را اصلاح کند، نرخ‌های فروش را طبق حاشیه سود مجاز بالا
          یا پایین ببرد و به هدف ریالی و مالیاتی مدنظر شما نزدیک شود، بدون آنکه
          مقادیر خرید یا موجودی اولیه دستخوش تغییر شوند.
        </p>
      </div>

      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm mb-6 flex flex-col gap-4">
        <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2">
          محدوده عملیاتی (Scope) پردازش
        </h4>
        <div className="flex bg-gray-50 rounded-lg border border-gray-200 overflow-hidden shadow-sm w-full lg:w-2/3">
          <button
            onClick={() => setOptScope('GLOBAL')}
            className={`flex-1 py-2 px-4 text-xs font-bold transition-colors ${optScope === 'GLOBAL' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            تجمیعی کل (تمام داده‌ها)
          </button>
          <button
            onClick={() => setOptScope('TAX_GROUP')}
            className={`flex-1 py-2 px-4 text-xs font-bold border-l border-r border-gray-200 transition-colors ${optScope === 'TAX_GROUP' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            یک گروه درصدی مالیات
          </button>
          <button
            onClick={() => setOptScope('ITEM')}
            className={`flex-1 py-2 px-4 text-xs font-bold transition-colors ${optScope === 'ITEM' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            کالای منتخب
          </button>
        </div>
        
        {optScope === 'TAX_GROUP' && (
          <div className="flex items-center gap-3">
            <label className="text-xs font-bold text-gray-500">
              انتخاب درصد گروه مالیاتی:
            </label>
            <select
              value={optTaxGroup}
              onChange={(e) => setOptTaxGroup(Number(e.target.value))}
              className="p-1.5 border border-gray-300 rounded font-mono text-sm focus:outline-none focus:border-indigo-500 min-w-[100px]"
            >
              {[...new Set(summaries.map(s => s.itemVatRate !== undefined ? s.itemVatRate : vatRate))].map(rate => (
                 <option key={rate} value={rate}>{rate}٪</option>
              ))}
            </select>
          </div>
        )}
        
        {optScope === 'ITEM' && (
          <div className="flex items-center gap-3">
            <label className="text-xs font-bold text-gray-500">
              انتخاب کالا:
            </label>
            <select
              value={optItemName}
              onChange={(e) => setOptItemName(e.target.value)}
              className="p-1.5 border border-gray-300 rounded font-mono text-sm focus:outline-none focus:border-indigo-500 min-w-[200px]"
            >
              <option value="">-- انتخاب کنید --</option>
              {summaries.map(s => (
                 <option key={s.itemName} value={s.itemName}>{s.itemName}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Col: Goals & Targets */}
        <div className="flex flex-col gap-6">
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
            <h4 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-emerald-600" />
              اهداف نهایی فروش (وضعیت مطلوب)
            </h4>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-gray-500">
                  درآمد فروش هدف (میزان ریالی کل فروش)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={targetSalesRevenue}
                    onChange={(e) =>
                      setTargetSalesRevenue(Number(e.target.value))
                    }
                    placeholder={`در حال حاضر: ${formatNumber(currentTotalRevenue)}`}
                    className="flex-1 p-2.5 border border-gray-200 rounded-lg font-mono text-sm focus:outline-none focus:border-indigo-500"
                  />
                  <span className="text-xs text-gray-400">ریال</span>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-gray-500">
                  مالیات و عوارض هدف (Target VAT)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={targetTaxAmount}
                    onChange={(e) => setTargetTaxAmount(Number(e.target.value))}
                    placeholder={`در حال حاضر: ${formatNumber(currentTotalTax)}`}
                    className="flex-1 p-2.5 border border-gray-200 rounded-lg font-mono text-sm focus:outline-none focus:border-indigo-500"
                  />
                  <span className="text-xs text-gray-400">ریال</span>
                </div>
              </div>

              <div className="flex flex-col gap-1.5 pt-3 border-t border-gray-100">
                <label className="text-xs font-bold text-gray-500">
                  درصد سود هدف روی بهای تمام شده (تثبیت حاشیه کل)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={targetProfitPercent}
                    onChange={(e) =>
                      setTargetProfitPercent(Number(e.target.value))
                    }
                    placeholder="مثال: 20"
                    className="w-32 p-2.5 border border-gray-200 rounded-lg font-mono text-sm focus:outline-none focus:border-emerald-500 bg-emerald-50/30"
                  />
                  <span className="text-xs text-gray-400">
                    % (در صورت تعیین، این درصد با احتساب حفظ موجودی اعمال
                    می‌شود)
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
            <h4 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Settings className="w-4 h-4 text-slate-600" />
              محدودیت‌ها و استراتژی‌های بهینه‌سازی
            </h4>

            <div className="flex flex-col gap-3">
              <label className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer transition-colors border border-transparent hover:border-gray-100">
                <input
                  type="checkbox"
                  checked={fixNegativeStock}
                  onChange={(e) => setFixNegativeStock(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                />
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-gray-800">
                    حذف تمام موجودی‌های منفی روزانه
                  </span>
                  <span className="text-[10px] text-gray-500 mt-0.5">
                    سیستم با کاهش تعدادیِ فاکتورهای فروش در زمان‌های بحرانی، از
                    منفی شدن انبار جلوگیری می‌کند.
                  </span>
                </div>
              </label>

              <label className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer transition-colors border border-transparent hover:border-gray-100">
                <input
                  type="checkbox"
                  checked={adjustQuantities}
                  onChange={(e) => setAdjustQuantities(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                />
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-gray-800">
                    مجوز تغییر تعداد فروش (Quantities)
                  </span>
                  <span className="text-[10px] text-gray-500 mt-0.5">
                    به سیستم اجازه می‌دهد برای رسیدن به هدف درآمدی، مقادیر
                    فیزیکی فروش را دستکاری کند.
                  </span>
                </div>
              </label>

              <label className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer transition-colors border border-transparent hover:border-gray-100">
                <input
                  type="checkbox"
                  checked={adjustPrices}
                  onChange={(e) => setAdjustPrices(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                />
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-gray-800">
                    مجوز تغییر نرخ فروش (Prices)
                  </span>
                  <span className="text-[10px] text-gray-500 mt-0.5">
                    به سیستم اجازه می‌دهد برای تناسب سود، قیمت‌های فروش را بالا
                    و پایین ببرد.
                  </span>
                </div>
              </label>

              <label className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer transition-colors border border-transparent hover:border-gray-100">
                <input
                  type="checkbox"
                  checked={taxShiftStrategy}
                  onChange={(e) => setTaxShiftStrategy(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                />
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-gray-800">
                    شیفت درآمد بین کالاها (انتقال مالیاتی)
                  </span>
                  <span className="text-[10px] text-gray-500 mt-0.5">
                    انتقال درآمد از کالاهای عادی به کالاهای معاف برای مدیریت
                    مالیات بر ارزش افزوده.
                  </span>
                </div>
              </label>

              {taxShiftStrategy && (
                <div className="flex flex-col gap-3 p-3 ml-6 mt-1 bg-indigo-50/50 border border-indigo-100 rounded-lg">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-indigo-800">
                      محدودیت ریالی انتقال (Target Transfer Amount)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={taxShiftAmount}
                        onChange={(e) =>
                          setTaxShiftAmount(Number(e.target.value))
                        }
                        placeholder="مثال: 500000000"
                        className="flex-1 p-2 border border-indigo-200 rounded text-xs font-mono focus:outline-none focus:border-indigo-500"
                      />
                      <span className="text-xs text-indigo-600">ریال</span>
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-1.5 mt-2">
                    <label className="text-xs font-bold text-indigo-800">
                      حداکثر مجاز تغییر تعدادی کالاها هنگام شیفت: <span className="font-mono bg-white px-1 rounded">{taxShiftMaxQtyRatio}%</span>
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="100"
                      value={taxShiftMaxQtyRatio}
                      onChange={(e) => setTaxShiftMaxQtyRatio(Number(e.target.value))}
                      className="w-full accent-indigo-600"
                    />
                  </div>
                  
                  <div className="flex flex-col gap-1.5 mt-2">
                    <label className="text-xs font-bold text-indigo-800">
                      حداکثر مجاز تغییر نرخی کالاها هنگام شیفت: <span className="font-mono bg-white px-1 rounded">{taxShiftMaxPriceRatio}%</span>
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="100"
                      value={taxShiftMaxPriceRatio}
                      onChange={(e) => setTaxShiftMaxPriceRatio(Number(e.target.value))}
                      className="w-full accent-indigo-600"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5 mt-2 border-t border-indigo-200 pt-3">
                    <label className="text-xs font-bold text-indigo-800">
                      انتخاب کالاهای معاف (افزایش درآمد این‌ها)
                    </label>
                    <select
                      multiple
                      value={Array.from(exemptItems)}
                      onChange={(e) => {
                        const options = Array.from(
                          e.target.selectedOptions,
                          (option) => option.value,
                        );
                        setExemptItems(new Set(options));
                      }}
                      className="w-full text-xs p-2 border border-indigo-200 rounded min-h-[100px] focus:outline-none focus:border-indigo-500"
                    >
                      {Object.keys(kardexByItem).map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                    <span className="text-[10px] text-indigo-500">
                      برای انتخاب چند مورد از کلید Ctrl (یا Cmd) استفاده کنید.
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Col: Parameters & Execution */}
        <div className="flex flex-col gap-6">
          <div className="bg-indigo-50/50 p-5 rounded-xl border border-indigo-100 shadow-sm">
            <h4 className="text-sm font-bold text-indigo-800 mb-4 flex items-center gap-2">
              محدودیت‌ حاشیه سود مجاز (برای تنظیم نرخ)
            </h4>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-indigo-700">
                  حداقل سود مجاز (%)
                </label>
                <input
                  type="number"
                  value={minProfitMargin}
                  onChange={(e) => setMinProfitMargin(Number(e.target.value))}
                  className="p-2 border border-indigo-200 rounded-lg text-center font-mono font-bold focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-indigo-700">
                  حداکثر راندمان سود (%)
                </label>
                <input
                  type="number"
                  value={maxProfitMargin}
                  onChange={(e) => setMaxProfitMargin(Number(e.target.value))}
                  className="p-2 border border-indigo-200 rounded-lg text-center font-mono font-bold focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-indigo-100/50 flex flex-col gap-1.5">
              <label className="text-xs font-bold text-indigo-700">
                دقت رند کردن مبالغ نرخ فروش
              </label>
              <select
                value={roundingLevel}
                onChange={(e) => setRoundingLevel(Number(e.target.value))}
                className="p-2 border border-indigo-200 rounded-lg text-xs font-bold focus:outline-none focus:border-indigo-500"
              >
                <option value={1}>دقیق (بدون رند کردن)</option>
                <option value={10}>رند به دهگان</option>
                <option value={100}>رند به صدگان</option>
                <option value={1000}>رند به هزارگان (۱,۰۰۰)</option>
                <option value={10000}>رند به ده هزارگان (۱۰,۰۰۰)</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-3 mt-auto">
            <button
              onClick={runOptimizer}
              disabled={isRunning}
              className={`w-full py-4 text-white text-sm font-black rounded-xl shadow-md transition-all flex justify-center items-center gap-2 ${isRunning ? "bg-gray-400 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700 hover:shadow-lg hover:-translate-y-0.5"}`}
            >
              {isRunning ? (
                <span className="animate-pulse">
                  در حال انجام محاسبات ژنتیک و توزیع...
                </span>
              ) : (
                <>
                  <Play className="w-5 h-5" />
                  اجرای موتور بهینه‌ساز و صدور فاکتورهای جدید
                </>
              )}
            </button>

            {Object.keys(adjustedTxns).length > 0 && (
              <button
                onClick={clearOptimizer}
                className="w-full py-3 text-rose-600 bg-rose-50 border border-rose-200 text-xs font-bold rounded-xl hover:bg-rose-100 transition-colors"
              >
                حذف تمامی تغییرات موتور هوش و بازگشت به اکسل خام
              </button>
            )}
          </div>

          {lastRunStats && (
            <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl mt-2 animate-in fade-in slide-in-from-bottom-2 flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="flex flex-col gap-1 text-xs text-emerald-800">
                <span className="font-bold">عملیات با موفقیت پایان یافت.</span>
                <span>
                  تعداد کالاهای تغییر یافته:{" "}
                  <b>{lastRunStats.itemsAffected} کالا</b>
                </span>
                <span>
                  تعداد سطرهای فاکتور فروش دستکاری شده:{" "}
                  <b>{lastRunStats.salesCountAffected} رکورد</b>
                </span>
                <span className="mt-1 font-semibold text-emerald-700">
                  برای مشاهده جزئیات، به زبانه‌های وضعیت سود و ریز تراکنش‌ها
                  مراجعه فرمایید. فایل CSV تعدیل شده نیز هم‌اکنون آماده دریافت
                  است.
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
