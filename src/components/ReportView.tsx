import React, { useState } from 'react';
import { KardexEntry, ItemSummary } from '../types';
import { formatNumber, formatCurrency } from '../lib/utils';
import { TargetSimulator } from './TargetSimulator';

interface ReportViewProps {
  kardexByItem: Record<string, KardexEntry[]>;
  summaries: ItemSummary[];
  vatRate: number;
  onVatChange: (rate: number) => void;
}

export function ReportView({ kardexByItem, summaries, vatRate, onVatChange }: ReportViewProps) {
  const [selectedItem, setSelectedItem] = useState<string>(summaries[0]?.itemName || '');
  const [activeTab, setActiveTab] = useState<'KARDEX' | 'SUMMARY' | 'TARGET'>('KARDEX');

  const history = selectedItem ? kardexByItem[selectedItem] : [];
  const currentSummary = summaries.find(s => s.itemName === selectedItem);

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-6">
      
      {/* Header and Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 p-6 bg-white rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">گزارشات کاردکس کالا</h2>
          <p className="text-gray-500 text-sm mt-1">مشاهده ریز گردش، سود و زیان و مالیات</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">انتخاب کالا</label>
            <select 
              value={selectedItem} 
              onChange={e => setSelectedItem(e.target.value)}
              className="p-2 border border-gray-200 rounded-lg bg-gray-50 text-sm font-medium focus:outline-none focus:border-amber-400"
            >
              {summaries.map(s => <option key={s.itemName} value={s.itemName}>{s.itemName}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">نرخ ارزش افزوده (%)</label>
            <input 
              type="number" 
              value={vatRate} 
              onChange={e => onVatChange(Number(e.target.value))}
              className="p-2 border border-gray-200 rounded-lg bg-gray-50 text-sm font-medium w-24 text-center focus:outline-none focus:border-amber-400"
            />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button onClick={() => setActiveTab('KARDEX')} className={`px-6 py-3 font-medium text-sm transition-colors ${activeTab === 'KARDEX' ? 'border-b-2 border-amber-500 text-amber-700' : 'text-gray-500 hover:text-gray-800'}`}>ریز تراکنش‌ها (تاریخی)</button>
        <button onClick={() => setActiveTab('SUMMARY')} className={`px-6 py-3 font-medium text-sm transition-colors ${activeTab === 'SUMMARY' ? 'border-b-2 border-amber-500 text-amber-700' : 'text-gray-500 hover:text-gray-800'}`}>خلاصه وضعیت و سود/زیان</button>
        <button onClick={() => setActiveTab('TARGET')} className={`px-6 py-3 font-medium text-sm transition-colors ${activeTab === 'TARGET' ? 'border-b-2 border-amber-500 text-amber-700' : 'text-gray-500 hover:text-gray-800'}`}>هدف‌گذاری سود (Simulator)</button>
      </div>

      {/* Content */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden min-h-[500px]">
        {activeTab === 'KARDEX' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="bg-gray-50 border-b border-gray-100 text-gray-600 font-medium">
                <tr>
                  <th className="p-4">تاریخ</th>
                  <th className="p-4">شرح تراکنش</th>
                  <th className="p-4">تعداد ورود</th>
                  <th className="p-4">تعداد خروج</th>
                  <th className="p-4">موجودی</th>
                  <th className="p-4">فی میانگین</th>
                  <th className="p-4">ارزش موجودی</th>
                  <th className="p-4 bg-amber-50/50">بهای تمام شده فروش</th>
                  <th className="p-4 bg-green-50/50">سود/زیان تغییر</th>
                  <th className="p-4 text-left">مالیات بر ارزش افزوده</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {history.length === 0 ? (
                  <tr><td colSpan={10} className="p-8 text-center text-gray-400">تراکنشی یافت نشد</td></tr>
                ) : history.map((entry, idx) => {
                  const isIncoming = entry.type === 'INITIAL' || entry.type === 'PURCHASE' || entry.type === 'SALE_RETURN';
                  const isOutgoing = entry.type === 'SALE' || entry.type === 'PURCHASE_RETURN';
                  
                  return (
                    <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                      <td className="p-4" dir="ltr">{new Date(entry.date).toLocaleDateString('fa-IR')}</td>
                      <td className="p-4 font-medium">{getTypeName(entry.type)}</td>
                      <td className="p-4 text-emerald-600 font-mono">{isIncoming ? formatNumber(entry.quantity) : '-'}</td>
                      <td className="p-4 text-rose-600 font-mono">{isOutgoing ? formatNumber(entry.quantity) : '-'}</td>
                      <td className="p-4 font-mono font-medium">{formatNumber(entry.balanceQuantity)}</td>
                      <td className="p-4 font-mono text-gray-500">{formatCurrency(entry.averageUnitCost)}</td>
                      <td className="p-4 font-mono font-medium">{formatCurrency(entry.balanceTotalCost)}</td>
                      
                      <td className="p-4 font-mono text-rose-600 bg-amber-50/20">{entry.cogs > 0 ? formatCurrency(entry.cogs) : '-'}</td>
                      <td className={`p-4 font-mono font-medium bg-green-50/20 ${entry.profit > 0 ? 'text-emerald-600' : entry.profit < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                        {entry.profit !== 0 ? formatCurrency(entry.profit) : '-'}
                      </td>
                      <td className="p-4 font-mono text-left text-gray-500">{entry.vat ? formatCurrency(entry.vat) : '-'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'SUMMARY' && currentSummary && (
          <div className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <SummaryCard title="موجودی اول دوره" qty={currentSummary.initialQuantity} value={currentSummary.initialValue} />
            <SummaryCard title="خرید طی دوره" qty={currentSummary.purchasedQuantity} value={currentSummary.purchasedValue} />
            <SummaryCard title="موجودی پایان دوره" qty={currentSummary.endingQuantity} value={currentSummary.endingValue} highlight />
            
            <SummaryCard title="فروش طی دوره" qty={currentSummary.soldQuantity} value={currentSummary.salesRevenue} />
            <SummaryCard title="بهای تمام شده کالای فروش رفته" qty={currentSummary.soldQuantity} value={currentSummary.cogs} />
            <div className="p-6 rounded-xl border border-gray-100 flex flex-col gap-2 bg-gradient-to-br from-emerald-50 to-teal-50/30">
              <span className="text-sm font-semibold text-gray-600">سود و زیان ناخالص</span>
              <span className={`text-2xl font-bold font-mono tracking-tight ${currentSummary.grossProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                {formatCurrency(currentSummary.grossProfit)}
                <span className="text-sm text-gray-500 font-sans font-normal mr-2">ریال</span>
              </span>
              <span className="text-xs text-gray-500 mt-2">فی میانگین نهایی: {formatCurrency(currentSummary.averageUnitCost)} ریال</span>
            </div>
          </div>
        )}

        {activeTab === 'TARGET' && currentSummary && (
          <TargetSimulator summary={currentSummary} />
        )}

      </div>
    </div>
  );
}

function SummaryCard({ title, qty, value, highlight = false }: { title: string, qty: number, value: number, highlight?: boolean }) {
  return (
    <div className={`p-6 rounded-xl border flex flex-col gap-2 ${highlight ? 'border-amber-200 bg-amber-50/30' : 'border-gray-100 bg-gray-50/50'}`}>
      <span className="text-sm font-semibold text-gray-600">{title}</span>
      <div className="flex flex-col mt-2 gap-1">
        <span className="text-xs text-gray-400">تعداد / مقدار</span>
        <span className="text-lg font-bold font-mono text-gray-700">{formatNumber(qty)}</span>
      </div>
      <div className="flex flex-col mt-1 gap-1">
        <span className="text-xs text-gray-400">ارزش کل (ریال)</span>
        <span className="text-xl font-bold font-mono tracking-tight text-gray-900">{formatCurrency(value)}</span>
      </div>
    </div>
  );
}

function getTypeName(type: string) {
  const map: Record<string, string> = {
    'INITIAL': 'موجودی اول دوره',
    'PURCHASE': 'خرید',
    'PURCHASE_RETURN': 'برگشت از خرید',
    'SALE': 'فروش',
    'SALE_RETURN': 'برگشت از فروش',
  };
  return map[type] || type;
}
