import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { RawRow, TransactionType, FileData } from '../types';
import { Trash2, FileSpreadsheet, PlusCircle } from 'lucide-react';

interface MultiFileUploadProps {
  files: FileData[];
  onAddFile: (fileData: FileData) => void;
  onRemoveFile: (id: string) => void;
  onNext: () => void;
}

const ZONES: { type: TransactionType, label: string, color: string }[] = [
  { type: 'INITIAL', label: 'موجودی اول دوره', color: 'blue' },
  { type: 'PURCHASE', label: 'خرید طی دوره', color: 'emerald' },
  { type: 'PURCHASE_RETURN', label: 'برگشت از خرید', color: 'orange' },
  { type: 'SALE', label: 'فروش طی دوره', color: 'indigo' },
  { type: 'SALE_RETURN', label: 'برگشت از فروش', color: 'rose' }
];

export function MultiFileUpload({ files, onAddFile, onRemoveFile, onNext }: MultiFileUploadProps) {
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File, type: TransactionType) => {
    setError(null);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as RawRow[];

      if (jsonData.length === 0) {
        setError(`فایل ${file.name} خالی است یا فرمت مناسبی ندارد.`);
        return;
      }

      const columns = Object.keys(jsonData[0]);
      onAddFile({
        id: Math.random().toString(36).substring(7),
        fileName: file.name,
        type,
        rawRows: jsonData,
        columns,
      });
    } catch (err) {
      setError(`خطا در خواندن فایل ${file.name}. لطفا مطمئن شوید فایل معتبر است.`);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto p-8 bg-white rounded-2xl shadow-sm border border-gray-100">
      <h2 className="text-2xl font-bold text-gray-800 mb-2">بارگذاری فایل‌های کاردکس (تفکیک شده)</h2>
      <p className="text-gray-500 mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <span>فایل‌های اکسل خود را بر اساس نوع تراکنش به صورت تفکیک شده در قسمت مربوطه قرار دهید. سیستم به صورت هوشمند این فایل‌ها را تجمیع خواهد کرد.</span>
      </p>

      {error && <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-lg border border-red-100">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {ZONES.map(zone => {
          const zoneFiles = files.filter(f => f.type === zone.type);
          
          return (
            <div key={zone.type} className="flex flex-col border border-gray-200 rounded-xl overflow-hidden hover:border-gray-300 transition-colors">
              <div className="bg-gray-50 border-b border-gray-200 p-3 font-semibold text-gray-700 flex justify-between items-center text-sm">
                {zone.label}
                <span className="text-xs font-mono bg-white px-2 py-0.5 rounded-md border border-gray-200 shadow-sm">{zoneFiles.length} فایل</span>
              </div>
              <div className="p-4 flex flex-col gap-3 min-h-[160px] bg-white">
                {zoneFiles.map(f => (
                  <div key={f.id} className="flex items-center justify-between bg-gray-50 p-2.5 rounded-lg border border-gray-100 text-sm group">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span className="truncate text-gray-600 font-medium" title={f.fileName}>{f.fileName}</span>
                    </div>
                    <button onClick={() => onRemoveFile(f.id)} className="text-gray-400 hover:text-red-500 transition-colors p-1 opacity-50 group-hover:opacity-100">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}

                <label className="mt-auto flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-200 rounded-xl text-gray-500 hover:border-emerald-400 hover:bg-emerald-50 cursor-pointer transition-all group">
                  <PlusCircle className="w-6 h-6 mb-2 text-gray-300 group-hover:text-emerald-500 transition-colors" />
                  <span className="text-xs text-center font-medium group-hover:text-emerald-700 transition-colors">افزودن فایل {zone.label}</span>
                  <input 
                    type="file" 
                    className="hidden" 
                    accept=".xlsx, .xls, .csv" 
                    onChange={(e) => {
                      if (e.target.files?.[0]) handleFile(e.target.files[0], zone.type);
                      e.target.value = ''; // reset to allow same file reupload
                    }}
                  />
                </label>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-8 pt-6 border-t border-gray-100 flex justify-end">
        <button 
          onClick={onNext}
          disabled={files.length === 0}
          className="px-6 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-all font-medium text-sm flex items-center gap-2"
        >
          مرحله بعد: تطبیق ستون‌ها
        </button>
      </div>
    </div>
  );
}
