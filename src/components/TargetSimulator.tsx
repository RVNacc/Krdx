import React, { useState } from 'react';
import { ItemSummary } from '../types';
import { formatCurrency, formatNumber } from '../lib/utils';
import { Calculator } from 'lucide-react';

interface TargetSimulatorProps {
  summary: ItemSummary;
}

export function TargetSimulator({ summary }: TargetSimulatorProps) {
  // Goal types:
  // FIND_PRICE: I want X profit, what is the selling price for Qty?
  // FIND_PROFIT: If I sell Qty at Price, what is my profit?
  
  const [targetType, setTargetType] = useState<'FIND_PRICE' | 'FIND_PROFIT'>('FIND_PROFIT');
  
  // Inputs
  const [targetProfit, setTargetProfit] = useState<number>(0);
  const [simulationQty, setSimulationQty] = useState<number>(summary.endingQuantity > 0 ? summary.endingQuantity : 1);
  const [simulationPrice, setSimulationPrice] = useState<number>(summary.averageUnitCost * 1.2); // 20% markup default

  // Computed Cost based on Average Unit Cost (this simulator assumes selling remaining inventory)
  const costPersUnit = summary.averageUnitCost;
  const totalCostForQty = costPersUnit * simulationQty;

  // Results
  let requiredPrice = 0;
  let simulatedProfit = 0;

  if (targetType === 'FIND_PROFIT') {
    simulatedProfit = (simulationPrice * simulationQty) - totalCostForQty;
  } else {
    // We want targetProfit
    // Profit = Revenue - Cost
    // Revenue = Profit + Cost
    // Price = Revenue / Qty
    const requiredRevenue = (targetProfit || 0) + totalCostForQty;
    requiredPrice = simulationQty > 0 ? requiredRevenue / simulationQty : 0;
  }

  return (
    <div className="p-8 max-w-4xl mx-auto flex flex-col gap-8">
      
      <div className="flex gap-4 p-4 bg-sky-50 rounded-xl border border-sky-100 text-sky-800">
        <Calculator className="w-6 h-6 shrink-0" />
        <div className="text-sm leading-relaxed">
          <strong>شبیه‌ساز فروش و هدف‌گذاری:</strong> در این قسمت می‌توانید بر اساس بهای تمام شده کالای موجود (میانگین موزون: <strong>{formatCurrency(costPersUnit)} ریال</strong>)، سناریوهای مختلف فروش را بررسی کنید.
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Controls */}
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-gray-700">نوع محاسبه</label>
            <div className="flex bg-gray-100 p-1 rounded-lg">
              <button 
                onClick={() => setTargetType('FIND_PROFIT')}
                className={`py-2 px-4 rounded-md text-sm font-medium transition-all flex-1 ${targetType === 'FIND_PROFIT' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
              >
                تخمین سود
              </button>
              <button 
                onClick={() => setTargetType('FIND_PRICE')}
                className={`py-2 px-4 rounded-md text-sm font-medium transition-all flex-1 ${targetType === 'FIND_PRICE' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
              >
                هدف‌گذاری سود
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-gray-700">تعداد / مقدار فروش</label>
            <input 
              type="number" 
              value={simulationQty}
              onChange={e => setSimulationQty(Number(e.target.value))}
              className="p-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-400/10 font-mono"
            />
            <span className="text-xs text-gray-400">حداکثر موجودی فعلی: {formatNumber(summary.endingQuantity)}</span>
          </div>

          {targetType === 'FIND_PROFIT' ? (
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-gray-700">نرخ فروش پیشنهادی (ریال)</label>
              <input 
                type="number" 
                value={simulationPrice}
                onChange={e => setSimulationPrice(Number(e.target.value))}
                className="p-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-400/10 font-mono"
              />
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-emerald-700">سود هدف (ریال)</label>
              <input 
                type="number" 
                value={targetProfit}
                onChange={e => setTargetProfit(Number(e.target.value))}
                className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg focus:outline-none focus:border-emerald-400 font-mono"
              />
            </div>
          )}

        </div>

        {/* Results */}
        <div className="flex flex-col gap-6 bg-gray-900 rounded-2xl p-6 text-white shadow-xl">
          <h3 className="text-gray-400 text-sm font-medium uppercase tracking-wider">نتیجه شبیه‌سازی</h3>
          
          <div className="flex justify-between items-end border-b border-gray-800 pb-4">
            <span className="text-gray-300">بهای تمام شده کل (هزینه)</span>
            <span className="font-mono text-xl">{formatCurrency(totalCostForQty)}</span>
          </div>

          {targetType === 'FIND_PROFIT' ? (
            <>
              <div className="flex justify-between items-end border-b border-gray-800 pb-4">
                <span className="text-gray-300">درآمد کل حاصل از فروش</span>
                <span className="font-mono text-xl">{formatCurrency(simulationPrice * simulationQty)}</span>
              </div>
              <div className="flex justify-between items-end mt-4">
                <span className="text-emerald-400 font-medium">سود تخمینی خالص</span>
                <span className={`font-mono text-3xl font-bold tracking-tighter ${simulatedProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {formatCurrency(simulatedProfit)}
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="flex justify-between items-end border-b border-gray-800 pb-4">
                <span className="text-gray-300">درآمد مورد نیاز</span>
                <span className="font-mono text-xl text-amber-100">{formatCurrency(totalCostForQty + targetProfit)}</span>
              </div>
              <div className="flex justify-between items-end mt-4">
                <span className="text-amber-400 font-medium">نرخ فروش مورد نیاز (واحد)</span>
                <span className="font-mono text-3xl font-bold tracking-tighter text-amber-400">
                  {formatCurrency(requiredPrice)}
                </span>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
