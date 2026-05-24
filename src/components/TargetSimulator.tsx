import React, { useState, useEffect } from 'react';
import { ItemSummary } from '../types';
import { formatCurrency, formatNumber } from '../lib/utils';
import { Calculator, Percent, ArrowLeftRight, TrendingUp } from 'lucide-react';

interface TargetSimulatorProps {
  summary: ItemSummary;
}

export function TargetSimulator({ summary }: TargetSimulatorProps) {
  // Goal Types:
  // FIND_PRICE_BY_PROFIT_PCT: Find selling price based on percentage profit relative to cost
  // FIND_PRICE_BY_VAL: Find selling price based on exact target profit value
  // FIND_PROFIT: Calculate profit based on manual selling price inputs
  const [targetType, setTargetType] = useState<'FIND_PROFIT' | 'FIND_PRICE_BY_PCT' | 'FIND_PRICE_BY_VAL'>('FIND_PROFIT');

  // Inputs
  const [simulationQty, setSimulationQty] = useState<number>(summary.endingQuantity > 0 ? summary.endingQuantity : 1);
  const [simulationPrice, setSimulationPrice] = useState<number>(Math.round(summary.averageUnitCost * 1.2)); // 20% markup default
  const [targetProfitPercent, setTargetProfitPercent] = useState<number>(20); // 20%
  const [targetProfitValue, setTargetProfitValue] = useState<number>(0);

  // Computed Cost based on Weighted Average Cost
  const costPerUnit = summary.averageUnitCost;
  const totalCostForQty = costPerUnit * simulationQty;

  // Real-time calculated results
  let simulatedRevenue = 0;
  let simulatedProfit = 0;
  let simulatedPricePerUnit = 0;

  if (targetType === 'FIND_PROFIT') {
    simulatedPricePerUnit = simulationPrice;
    simulatedRevenue = simulationPrice * simulationQty;
    simulatedProfit = simulatedRevenue - totalCostForQty;
  } else if (targetType === 'FIND_PRICE_BY_PCT') {
    // Profit = Cost * targetProfitPercent / 100
    // Price = Cost * (1 + targetProfitPercent/100)
    simulatedPricePerUnit = costPerUnit * (1 + targetProfitPercent / 100);
    simulatedRevenue = simulatedPricePerUnit * simulationQty;
    simulatedProfit = simulatedRevenue - totalCostForQty;
  } else {
    // Find price by exact profit value
    // Total Revenue = targetProfitValue + Total Cost
    // Price = Total Revenue / Qty
    const requiredRevenue = targetProfitValue + totalCostForQty;
    simulatedPricePerUnit = simulationQty > 0 ? requiredRevenue / simulationQty : 0;
    simulatedRevenue = requiredRevenue;
    simulatedProfit = targetProfitValue;
  }

  // Profit Margins (درصد سود نسبت به بهای تمام شده و درصد سود نسبت به فروش)
  const markupOnCost = totalCostForQty > 0 ? (simulatedProfit / totalCostForQty) * 100 : 0;
  const marginOnRevenue = simulatedRevenue > 0 ? (simulatedProfit / simulatedRevenue) * 100 : 0;

  // Auto-sync initial value
  useEffect(() => {
    if (targetType === 'FIND_PRICE_BY_VAL' && targetProfitValue === 0) {
      setTargetProfitValue(Math.round(totalCostForQty * 0.2)); // 20% default
    }
  }, [targetType, totalCostForQty]);

  return (
    <div className="p-8 max-w-5xl mx-auto flex flex-col gap-8">
      
      {/* Alert / Header Box */}
      <div className="flex gap-4 p-5 bg-amber-50 rounded-2xl border border-amber-200/50 text-amber-900 shadow-sm">
        <Calculator className="w-6 h-6 shrink-0 text-amber-600" />
        <div className="text-sm leading-relaxed">
          <strong className="block text-amber-950 font-bold mb-1">ابزار بهینه‌سازی و شبیه‌ساز زنجیره ارزش کالای {summary.itemName}</strong>
          بهای تمام شده میانگین موزون این کالا برابر با <strong className="font-mono text-amber-950">{formatCurrency(costPerUnit)} ریال</strong> است. سناریوهای مختلف را براساس اهداف حاشیه سود خود بررسی کنید.
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Constraints & Sliders Panel */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          
          {/* Target Type Selector */}
          <div className="flex flex-col gap-2">
            <span className="text-sm font-bold text-gray-700">سناریو و متغیر هدف</span>
            <div className="grid grid-cols-3 bg-gray-100 p-1.5 rounded-xl border border-gray-200">
              <button 
                onClick={() => setTargetType('FIND_PROFIT')}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${targetType === 'FIND_PROFIT' ? 'bg-white shadow text-emerald-900 border border-emerald-100' : 'text-gray-500 hover:text-gray-700'}`}
              >
                بر اساس نرخ فروش
              </button>
              <button 
                onClick={() => setTargetType('FIND_PRICE_BY_PCT')}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${targetType === 'FIND_PRICE_BY_PCT' ? 'bg-white shadow text-emerald-900 border border-emerald-100' : 'text-gray-500 hover:text-gray-700'}`}
              >
                بر اساس درصد سود هـدف
              </button>
              <button 
                onClick={() => setTargetType('FIND_PRICE_BY_VAL')}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${targetType === 'FIND_PRICE_BY_VAL' ? 'bg-white shadow text-emerald-900 border border-emerald-100' : 'text-gray-500 hover:text-gray-700'}`}
              >
                بر اساس ارزش ریالی سود
              </button>
            </div>
          </div>

          {/* Qty Input Slider */}
          <div className="flex flex-col gap-2 p-5 bg-gray-50 rounded-2xl border border-gray-100">
            <div className="flex justify-between items-center text-sm font-bold text-gray-700">
              <span>تعداد / مقدار فرضی برای فروش</span>
              <span className="font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">{formatNumber(simulationQty)}</span>
            </div>
            <input 
              type="range"
              min="1"
              max={Math.max(summary.endingQuantity * 2, 1000)}
              value={simulationQty}
              onChange={e => setSimulationQty(Number(e.target.value))}
              className="w-full accent-emerald-600 cursor-pointer h-2 bg-gray-200 rounded-lg appearance-none mt-2"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>۱ واحد</span>
              <span>موجودی پایان دوره: {formatNumber(summary.endingQuantity)} واحد</span>
              <span>حداکثر سقف تخمین: {formatNumber(Math.max(summary.endingQuantity * 2, 1000))}</span>
            </div>
          </div>

          {/* Conditional Input based on Target Type */}
          {targetType === 'FIND_PROFIT' && (
            <div className="flex flex-col gap-2.5 p-5 bg-white border border-gray-200 rounded-2xl shadow-sm">
              <label className="text-sm font-bold text-gray-700">نرخ فروش پیشنهادی هر واحد (ریال)</label>
              <div className="flex items-center gap-3">
                <input 
                  type="number" 
                  value={simulationPrice}
                  onChange={e => setSimulationPrice(Number(e.target.value))}
                  className="p-3 shadow-inner bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-emerald-500 focus:bg-white text-base font-mono flex-1 text-center font-semibold"
                />
                <button 
                  onClick={() => setSimulationPrice(Math.round(costPerUnit * 1.25))}
                  className="px-3 py-3 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-all border border-emerald-100"
                >
                  ۲۵% بیشتر از بها
                </button>
                <button 
                  onClick={() => setSimulationPrice(Math.round(costPerUnit * 1.5))}
                  className="px-3 py-3 text-xs font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-xl transition-all border border-teal-100"
                >
                  ۵۰% بیشتر از بها
                </button>
              </div>
            </div>
          )}

          {targetType === 'FIND_PRICE_BY_PCT' && (
            <div className="flex flex-col gap-3 p-5 bg-white border border-gray-200 rounded-2xl shadow-sm">
              <div className="flex justify-between text-sm font-bold text-gray-700">
                <span>درصد سود هدف روی بهای تمام شده</span>
                <span className="font-mono text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-100">{targetProfitPercent} %</span>
              </div>
              <input 
                type="range"
                min="1"
                max="200"
                value={targetProfitPercent}
                onChange={e => setTargetProfitPercent(Number(e.target.value))}
                className="w-full accent-emerald-600 cursor-pointer h-2 bg-gray-200 rounded-lg appearance-none"
              />
              <div className="flex justify-between text-xs text-gray-400">
                <span>۱ % (حداقل)</span>
                <span>۲۰۰ % (حداکثر سود مارجین)</span>
              </div>
            </div>
          )}

          {targetType === 'FIND_PRICE_BY_VAL' && (
            <div className="flex flex-col gap-2.5 p-5 bg-white border border-gray-200 rounded-2xl shadow-sm">
              <label className="text-sm font-bold text-gray-700">مجموع سود خالص هدف کل (ریال)</label>
              <input 
                type="number" 
                value={targetProfitValue}
                onChange={e => setTargetProfitValue(Number(e.target.value))}
                className="p-3 shadow-inner bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-emerald-500 focus:bg-white text-lg font-mono text-center font-bold text-emerald-700"
              />
              <span className="text-xs text-gray-400">سیستم نرخ فروش بهینه برای رسیدن به این رقم سود را محاسبه خواهد کرد.</span>
            </div>
          )}

        </div>

        {/* Live Values and Percentage Dashboards */}
        <div className="lg:col-span-5 flex flex-col gap-6 bg-slate-900 rounded-3xl p-6 text-white shadow-xl">
          <h3 className="text-slate-400 text-xs font-semibold uppercase tracking-wider flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            داشبورد آنالیز بهای حاصله
          </h3>

          <div className="flex flex-col bg-slate-800/50 rounded-2xl p-4 gap-3">
            <div className="flex justify-between text-sm text-slate-300">
              <span>بهای تمام شده کل فرضی</span>
              <span className="font-mono">{formatCurrency(totalCostForQty)}</span>
            </div>
            <div className="flex justify-between text-sm text-slate-300">
              <span>مبلغ کل درآمد ناخالص</span>
              <span className="font-mono text-slate-200">{formatCurrency(simulatedRevenue)}</span>
            </div>
          </div>

          <div className="flex flex-col gap-1 border-t border-slate-800 pt-4">
             <span className="text-slate-400 text-xs font-medium">فی مطلوب فروش هر واحد کالا (بهای هدف)</span>
             <span className="text-3xl font-bold font-mono text-amber-400 tracking-tight">
                {formatCurrency(simulatedPricePerUnit)}
                <span className="text-xs text-slate-400 font-sans font-normal mr-2">ریال</span>
             </span>
          </div>

          <div className="flex flex-col gap-1 border-t border-slate-800 pt-4">
             <span className="text-slate-400 text-xs font-medium">کل سود ناخالص شبیه‌سازی‌شده</span>
             <span className={`text-3xl font-bold font-mono tracking-tight ${simulatedProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {formatCurrency(simulatedProfit)}
                <span className="text-xs text-slate-400 font-sans font-normal mr-2">ریال</span>
             </span>
          </div>

          {/* Margins Dashboard */}
          <div className="grid grid-cols-2 gap-4 mt-2 border-t border-slate-800 pt-4">
            
            <div className="p-3 bg-slate-800/40 border border-slate-800 rounded-xl flex flex-col gap-1">
              <span className="text-slate-400 text-[10px] font-bold">بهای تمام‌شده (بازده)</span>
              <div className="flex items-center justify-between text-emerald-400 font-bold font-mono">
                <span className="text-lg">{formatNumber(markupOnCost)}%</span>
                <span className="text-[10px] bg-emerald-950 text-emerald-400/80 px-1 py-0.5 rounded border border-emerald-900/40">سود/بها</span>
              </div>
            </div>

            <div className="p-3 bg-slate-800/40 border border-slate-800 rounded-xl flex flex-col gap-1">
              <span className="text-slate-400 text-[10px] font-bold">نرخ فروش (کل مارجین)</span>
              <div className="flex items-center justify-between text-sky-400 font-bold font-mono">
                <span className="text-lg">{formatNumber(marginOnRevenue)}%</span>
                <span className="text-[10px] bg-sky-950 text-sky-400/80 px-1 py-0.5 rounded border border-sky-900/40">سود/فروش</span>
              </div>
            </div>

          </div>

          <p className="text-[10px] text-slate-400 text-center leading-relaxed mt-2 pt-2 border-t border-slate-800/50">
             * فرمول بهای تمام شده: (فی میانگین موزون × تعداد). درصد سود/بها نشان‌دهنده راندمان سرمایه کالا و سود/فروش معادل حاشیه سود نهایی ناخالص از درآمد کلی است.
          </p>

        </div>

      </div>

    </div>
  );
}
