import React, { useState, useMemo } from "react";
import { KardexEntry } from "../types";
import { formatCurrency, formatNumber } from "../lib/utils";
import { Download } from "lucide-react";

interface GlobalKardexProps {
  kardexByItem: Record<string, KardexEntry[]>;
}

export function GlobalKardex({ kardexByItem }: GlobalKardexProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 50;

  const allEntries = useMemo(() => {
    const list: (KardexEntry & { itemName: string })[] = [];
    Object.entries(kardexByItem).forEach(([itemName, history]) => {
      history.forEach((entry) => {
        list.push({ ...entry, itemName });
      });
    });
    // Sort by date (assuming entry.date is Date object or ISO string)
    list.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
    return list;
  }, [kardexByItem]);

  const totalPages = Math.max(1, Math.ceil(allEntries.length / rowsPerPage));
  const paginatedHistory = allEntries.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage,
  );

  const exportCurrentKardex = () => {
    import("../lib/utils").then(({ exportToCsv }) => {
      const rows = [
        [
          "نام کالا",
          "تاریخ",
          "تراکنش",
          "مشتری/تفصیل",
          "امضا",
          "تعداد ورودی",
          "ثمن واحد ورودی (ریال)",
          "مبلغ کل ورودی",
          "تعداد خروجی",
          "ثمن واحد خروجی (ریال)",
          "مبلغ کل خروجی",
          "بهای فروش (خروجی)",
          "موجودی",
          "ارزش کل موجودی",
          "بهای میانگین",
        ],
      ];
      allEntries.forEach((e) => {
        const isIncoming =
          e.type === "INITIAL" ||
          e.type === "PURCHASE" ||
          e.type === "SALE_RETURN";
        const isOutgoing = e.type === "SALE" || e.type === "PURCHASE_RETURN";

        rows.push([
          e.itemName,
          typeof e.date === "string"
            ? e.date
            : e.date.toLocaleDateString("fa-IR"),
          e.type,
          e.tafsil || "-",
          e.sourceFile,
          isIncoming ? e.quantity : "",
          isIncoming ? e.unitPrice : "",
          isIncoming ? e.totalPrice : "",
          isOutgoing ? e.quantity : "",
          isOutgoing ? e.unitPrice : "",
          isOutgoing ? e.totalPrice : "",
          isOutgoing && e.type === "SALE" ? e.cogs : "",
          e.balanceQuantity,
          e.balanceTotalCost,
          e.averageUnitCost,
        ]);
      });
      exportToCsv("global_kardex.csv", rows);
    });
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow border border-gray-100 p-6 overflow-hidden">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-gray-800">
          کاردکس کل تجمیعی (تمامی کالاها)
        </h3>
        <button
          onClick={exportCurrentKardex}
          className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded hover:bg-emerald-100 transition-colors shadow-sm"
        >
          <Download className="w-4 h-4" />
          دانلود کاردکس کل در اکسل (CSV)
        </button>
      </div>

      <div className="relative flex-1 overflow-auto border border-gray-100 rounded-lg shadow-inner">
        <table className="w-full text-right" dir="rtl">
          <thead className="bg-gray-50 sticky top-0 block">
            <tr className="text-[10px] text-gray-500 font-bold uppercase tracking-wider table w-full table-layout-fixed">
              <th className="p-3 border-b border-gray-200 w-[10%]">نام کالا</th>
              <th className="p-3 border-b border-gray-200 w-[8%]">تاریخ</th>
              <th className="p-3 border-b border-gray-200 w-[7%]">تراکنش</th>
              <th className="p-3 text-center bg-indigo-50/50 border-x border-b border-gray-200 text-indigo-700 w-[18%]">
                ورودی (خرید/اول دوره)
              </th>
              <th className="p-3 text-center bg-rose-50/50 border-x border-b border-gray-200 text-rose-700 w-[18%]">
                خروجی (فروش)
              </th>
              <th className="p-3 text-center bg-emerald-50/50 border-x border-b border-gray-200 text-emerald-700 w-[18%]">
                مانده موجودی
              </th>
              <th className="p-3 px-4 border-b border-gray-200 font-bold text-gray-700 w-[11%]">
                بهای میانگین
              </th>
              <th className="p-3 px-4 border-b border-gray-200 font-bold text-gray-700 w-[10%]">
                بهای فروش
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-xs block w-full overflow-y-auto">
            {paginatedHistory.length === 0 ? (
              <tr className="table w-full table-layout-fixed">
                <td
                  colSpan={8}
                  className="p-12 text-center text-gray-400 font-medium"
                >
                  تراکنشی یافت نشد.
                </td>
              </tr>
            ) : (
              paginatedHistory.map((entry, idx) => {
                const isIncoming =
                  entry.type === "INITIAL" ||
                  entry.type === "PURCHASE" ||
                  entry.type === "SALE_RETURN";
                const isOutgoing =
                  entry.type === "SALE" || entry.type === "PURCHASE_RETURN";

                return (
                  <tr
                    key={`${entry.itemName}-${entry.id}-${idx}`}
                    className="hover:bg-gray-50 transition-colors bg-white table w-full table-layout-fixed"
                  >
                    <td
                      className="p-3 text-gray-800 font-bold w-[10%] truncate"
                      title={entry.itemName}
                    >
                      {entry.itemName}
                    </td>
                    <td className="p-3 text-gray-600 font-medium w-[8%] text-[11px] whitespace-nowrap">
                      {typeof entry.date === "string"
                        ? entry.date
                        : entry.date.toLocaleDateString("fa-IR")}
                    </td>
                    <td className="p-3 w-[7%]">
                      {entry.type === "INITIAL" && (
                        <span className="text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded text-[10px] font-bold">
                          اول دوره
                        </span>
                      )}
                      {entry.type === "PURCHASE" && (
                        <span className="text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[10px] font-bold">
                          خرید
                        </span>
                      )}
                      {entry.type === "SALE" && (
                        <span className="text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded text-[10px] font-bold">
                          فروش
                        </span>
                      )}
                      {entry.type === "SALE_RETURN" && (
                        <span className="text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded text-[10px] font-bold">
                          برگشت فروش
                        </span>
                      )}
                      {entry.type === "PURCHASE_RETURN" && (
                        <span className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded text-[10px] font-bold">
                          برگشت خرید
                        </span>
                      )}
                    </td>

                    {/* Incoming */}
                    <td className="p-3 bg-indigo-50/20 border-r border-gray-100 w-[18%]">
                      {isIncoming ? (
                        <div className="flex flex-col gap-0.5 items-center">
                          <span className="font-bold text-indigo-700 font-mono text-[11px]">
                            {formatNumber(entry.quantity)} عدد
                          </span>
                          <span className="text-[10px] text-gray-500">
                            فی: {formatNumber(entry.unitPrice)}
                          </span>
                        </div>
                      ) : (
                        <div className="text-center text-gray-300">-</div>
                      )}
                    </td>

                    {/* Outgoing */}
                    <td className="p-3 bg-rose-50/20 border-r border-gray-100 w-[18%]">
                      {isOutgoing ? (
                        <div className="flex flex-col gap-0.5 items-center">
                          <span className="font-bold text-rose-700 font-mono text-[11px]">
                            {formatNumber(entry.quantity)} عدد
                          </span>
                          <span className="text-[10px] text-gray-500">
                            فی: {formatNumber(entry.unitPrice)}
                          </span>
                        </div>
                      ) : (
                        <div className="text-center text-gray-300">-</div>
                      )}
                    </td>

                    {/* Balance */}
                    <td className="p-3 bg-emerald-50/20 border-x border-gray-100 w-[18%]">
                      <div className="flex flex-col gap-0.5 items-center">
                        <span
                          className={`font-bold font-mono text-[11px] ${entry.balanceQuantity < 0 ? "text-rose-600 bg-rose-100 px-1 rounded" : "text-emerald-700"}`}
                        >
                          {formatNumber(entry.balanceQuantity)} عدد
                        </span>
                        <span className="text-[10px] text-gray-500">
                          ارزش:{" "}
                          {formatCurrency(Math.max(0, entry.balanceTotalCost))}
                        </span>
                      </div>
                    </td>

                    <td className="p-3 border-l border-gray-100 whitespace-nowrap w-[11%]">
                      <span className="font-mono text-gray-800 text-[11px] font-medium">
                        {formatCurrency(entry.averageUnitCost)}
                      </span>
                    </td>

                    <td className="p-3 whitespace-nowrap w-[10%]">
                      {isOutgoing && entry.type === "SALE" && entry.cogs ? (
                        <span className="font-mono text-amber-700 text-[11px] font-bold">
                          {formatCurrency(entry.cogs)}
                        </span>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-xs text-gray-500 font-medium">
            نمایش {(currentPage - 1) * rowsPerPage + 1} تا{" "}
            {Math.min(currentPage * rowsPerPage, allEntries.length)} از{" "}
            {allEntries.length} تراکنش کل
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 text-xs font-bold text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              قبلی
            </button>
            <span className="text-xs font-bold text-gray-600 px-2">
              صفحه {currentPage} از {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 text-xs font-bold text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              بعدی
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
