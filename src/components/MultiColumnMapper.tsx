import React, { useState, useEffect } from 'react';
import { FileData, ColumnMapping } from '../types';
import { AlertCircle, CheckCircle } from 'lucide-react';

interface MultiColumnMapperProps {
  files: FileData[];
  onMappingsComplete: (updatedFiles: FileData[]) => void;
}

export function MultiColumnMapper({ files, onMappingsComplete }: MultiColumnMapperProps) {
  const [localFiles, setLocalFiles] = useState<FileData[]>(files);
  const [activeIndex, setActiveIndex] = useState(0);

  // Auto mapping logic based on similar column names
  const tryAutoMap = (columns: string[], currentMapping?: Partial<ColumnMapping>) => {
    const defaultMapping: Partial<ColumnMapping> = currentMapping || { priceType: 'TOTAL' };
    const normalize = (s: string) => s.toLowerCase().replace(/\s/g, '').replace(/_/g, '').replace(/-/g, '');
    
    columns.forEach(col => {
      const norm = normalize(col);
      if (!defaultMapping.date && (norm.includes('تاریخ') || norm.includes('date') || norm.includes('زمان'))) defaultMapping.date = col;
      if (!defaultMapping.itemName && (norm.includes('نام کالا') || norm.includes('شرح') || norm.includes('item') || norm.includes('محصول') || norm.includes('کالا'))) defaultMapping.itemName = col;
      if (!defaultMapping.itemCode && (norm.includes('کد') || norm.includes('code') || norm.includes('شناسه'))) defaultMapping.itemCode = col;
      if (!defaultMapping.quantity && (norm.includes('تعداد') || norm.includes('مقدار') || norm.includes('وزن') || norm.includes('qty'))) defaultMapping.quantity = col;
      if (!defaultMapping.price && (norm.includes('مبلغ') || norm.includes('فی') || norm.includes('نرخ') || norm.includes('قیمت') || norm.includes('ارزش') || norm.includes('بها'))) defaultMapping.price = col;
      if (!defaultMapping.tafsil && (norm.includes('تفصیل') || norm.includes('خریدار') || norm.includes('مشتری') || norm.includes('بابت') || norm.includes('tafsil') || norm.includes('customer'))) defaultMapping.tafsil = col;
      if (!defaultMapping.taxRate && (norm.includes('مالیات') || norm.includes('ارزش افزوده') || norm.includes('عوارض') || norm.includes('tax') || norm.includes('vat'))) defaultMapping.taxRate = col;
      if (!defaultMapping.unit && (norm.includes('واحد') || norm.includes('سنجش') || norm.includes('unit'))) defaultMapping.unit = col;
    });
    return defaultMapping;
  };

  useEffect(() => {
    setLocalFiles(prev => prev.map(f => ({
      ...f,
      mapping: tryAutoMap(f.columns, f.mapping)
    })));
  }, []);

  const updateMapping = (fileId: string, key: keyof ColumnMapping, value: string) => {
    setLocalFiles(prev => prev.map(f => {
      if (f.id === fileId) {
        return { ...f, mapping: { ...f.mapping, [key]: value } as Partial<ColumnMapping> };
      }
      return f;
    }));
  };

  const activeFile = localFiles[activeIndex];

  const isComplete = (mapping?: Partial<ColumnMapping>) => {
     return !!(mapping && mapping.date && mapping.itemName && mapping.quantity && mapping.price);
  };

  const allComplete = localFiles.every(f => isComplete(f.mapping));

  const handleApply = () => {
    if (allComplete) {
      onMappingsComplete(localFiles);
    }
  };

  const renderSelect = (key: keyof ColumnMapping, label: string) => (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-gray-700 flex justify-between">
        {label}
        {!!activeFile.mapping?.[key] && <span className="text-xs text-emerald-600 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">تطبیق شد</span>}
      </label>
      <select 
        value={activeFile.mapping?.[key] || ''} 
        onChange={(e) => updateMapping(activeFile.id, key, e.target.value)}
        className="w-full p-2.5 rounded-lg border border-gray-200 bg-gray-50 focus:bg-white focus:border-amber-400 focus:ring-4 focus:ring-amber-50 focus:outline-none transition-all text-gray-700 text-sm"
      >
        <option value="">-- انتخاب ستون --</option>
        {activeFile.columns.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
    </div>
  );

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col md:flex-row gap-6">
      
      {/* File List / Tabs */}
      <div className="w-full md:w-1/3 flex flex-col gap-2">
        <h3 className="text-lg font-bold text-gray-800 mb-4 px-2">لیست فایل‌ها</h3>
        {localFiles.map((f, idx) => {
          const complete = isComplete(f.mapping);
          const isActive = idx === activeIndex;
          
          return (
            <button
              key={f.id}
              onClick={() => setActiveIndex(idx)}
              className={`p-4 rounded-xl text-right transition-all flex items-start justify-between border ${
                 isActive ? 'border-emerald-500 bg-emerald-50 shadow-sm' : 
                 complete ? 'border-gray-200 bg-white hover:bg-gray-50' : 
                 'border-rose-200 bg-rose-50 hover:bg-rose-100'
              }`}
            >
              <div className="flex flex-col gap-1.5 w-full pr-2">
                 <span className={`font-semibold text-sm truncate ${isActive ? 'text-emerald-900' : 'text-gray-800'}`}>{f.fileName}</span>
                 <span className="text-xs text-gray-500 bg-white/60 px-2 py-0.5 rounded w-max">{getTypeLabel(f.type)}</span>
              </div>
              <div className="shrink-0 mt-1">
                {complete ? <CheckCircle className="w-5 h-5 text-emerald-500" /> : <AlertCircle className="w-5 h-5 text-rose-500" />}
              </div>
            </button>
          )
        })}
      </div>

      {/* Mapper Area */}
      <div className="w-full md:w-2/3 p-8 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col">
        <div className="mb-8 border-b border-gray-100 pb-6">
           <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              تطبیق ستون‌های فایل: 
              <span className="text-emerald-600 font-mono text-lg bg-emerald-50 px-2 py-0.5 rounded" dir="ltr">{activeFile.fileName}</span>
           </h2>
           <p className="text-gray-500 text-sm mt-3 leading-relaxed">عناوین مرتبط به صورت هوشمندانه پیشنهاد شده‌اند. در صورت نیاز آنها را اصلاح کنید.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
          {renderSelect('date', 'ستون تاریخ عملیات')}
          {renderSelect('itemName', 'ستون نام کالا')}
          {renderSelect('itemCode', 'ستون کد کالا (اختیاری)')}
          {renderSelect('quantity', 'ستون تعداد / مقدار')}
          {renderSelect('unit', 'ستون واحد سنجش (اختیاری)')}
          {renderSelect('tafsil', 'ستون تفصیل / مشتری و خریدار (اختیاری)')}
          {renderSelect('taxRate', 'ستون نرخ مالیاتی کالا/سطر (اختیاری)')}
          
          <div className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 p-5 bg-gray-50 rounded-xl border border-gray-200">
            {renderSelect('price', 'ستون نرخ / مبلغ')}
            <div className="flex flex-col gap-2">
               <label className="text-sm font-medium text-gray-700">مفهوم مبالغ این ستون چیست؟</label>
               <select 
                  value={activeFile.mapping?.priceType || 'TOTAL'} 
                  onChange={(e) => updateMapping(activeFile.id, 'priceType', e.target.value as 'UNIT' | 'TOTAL')}
                  className="w-full p-2.5 rounded-lg border border-gray-200 bg-white focus:border-amber-400 focus:ring-4 focus:ring-amber-50 focus:outline-none transition-all text-sm"
               >
                  <option value="TOTAL">مبلغ کل (حاصلضرب تعداد در نرخ)</option>
                  <option value="UNIT">نرخ واحد (تکی)</option>
               </select>
            </div>
          </div>
        </div>

        <div className="mt-8 flex justify-between items-center pt-6 border-t border-gray-100">
          <div className="text-sm font-medium">
             {!isComplete(activeFile.mapping) 
               ? <span className="text-rose-500 flex items-center gap-1.5"><AlertCircle className="w-4 h-4"/> لطفا تمام ستون‌های اجباری را انتخاب کنید.</span>
               : <span className="text-emerald-600 flex items-center gap-1.5"><CheckCircle className="w-4 h-4"/> نقشه این فایل کامل و آماده است.</span>
             }
          </div>
          <button 
            onClick={() => {
              if (activeIndex < localFiles.length - 1) setActiveIndex(activeIndex + 1);
              else handleApply();
            }}
            disabled={!isComplete(activeFile.mapping) && activeIndex === localFiles.length - 1}
            className={`px-6 py-2.5 rounded-xl transition-all font-bold text-sm ${
              activeIndex === localFiles.length - 1 
                ? (allComplete ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md shadow-emerald-200' : 'bg-gray-100 text-gray-400 cursor-not-allowed')
                : 'bg-gray-900 text-white hover:bg-gray-800 shadow-md'
            }`}
          >
            {activeIndex === localFiles.length - 1 ? 'تجمیع و محاسبه نهایی کاردکس' : 'بررسی فایل بعدی'}
          </button>
        </div>
      </div>
    
    </div>
  );
}

function getTypeLabel(type: string) {
  const map: Record<string, string> = {
    'INITIAL': 'موجودی اول دوره',
    'PURCHASE': 'خرید طی دوره',
    'PURCHASE_RETURN': 'برگشت از خرید',
    'SALE': 'فروش کالا',
    'SALE_RETURN': 'برگشت از فروش',
  };
  return map[type] || type;
}
