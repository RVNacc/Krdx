import {
  ProcessedTransaction,
  KardexEntry,
  ItemSummary,
  TransactionType
} from '../types';

export function calculateKardex(
  transactions: ProcessedTransaction[],
  vatRate: number
): { kardexByItem: Record<string, KardexEntry[]>; summaries: ItemSummary[] } {
  const sortedTransactions = [...transactions].sort((a, b) => {
    // Sort by timestamp, then by row number to maintain stable sort
    if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
    return a.rowNumber - b.rowNumber;
  });

  const kardexByItem: Record<string, KardexEntry[]> = {};
  const summariesMap = new Map<string, ItemSummary>();

  for (const item of Array.from(new Set(sortedTransactions.map((t) => t.itemName)))) {
    kardexByItem[item] = [];
    summariesMap.set(item, {
      itemName: item,
      initialQuantity: 0,
      initialValue: 0,
      purchasedQuantity: 0,
      purchasedValue: 0,
      soldQuantity: 0,
      salesRevenue: 0,
      endingQuantity: 0,
      endingValue: 0,
      cogs: 0,
      grossProfit: 0,
      averageUnitCost: 0,
    });
  }

  // Weighted Average Cost method
  for (const txn of sortedTransactions) {
    const item = txn.itemName;
    const history = kardexByItem[item];
    const summary = summariesMap.get(item)!;

    let previousQty = history.length > 0 ? history[history.length - 1].balanceQuantity : 0;
    let previousTotalCost = history.length > 0 ? history[history.length - 1].balanceTotalCost : 0;
    let previousAvgCost = history.length > 0 ? history[history.length - 1].averageUnitCost : 0;

    let balanceQuantity = previousQty;
    let balanceTotalCost = previousTotalCost;
    let averageUnitCost = previousAvgCost;
    
    let cogs = 0;
    let profit = 0;
    let vat = 0;

    if (txn.type === 'INITIAL' || txn.type === 'PURCHASE' || txn.type === 'SALE_RETURN') {
      // Inventory increases
      balanceQuantity += txn.quantity;
      if (txn.type === 'SALE_RETURN') {
        // Return at original cost (approximated here using current avg cost for simplicity unless tracked tightly)
        balanceTotalCost += txn.quantity * averageUnitCost;
      } else {
        balanceTotalCost += txn.totalPrice;
      }
      
      averageUnitCost = balanceQuantity > 0 ? balanceTotalCost / balanceQuantity : 0;

      if (txn.type === 'INITIAL') {
        summary.initialQuantity += txn.quantity;
        summary.initialValue += txn.totalPrice;
      } else if (txn.type === 'PURCHASE') {
        summary.purchasedQuantity += txn.quantity;
        summary.purchasedValue += txn.totalPrice;
      }
    } else if (txn.type === 'SALE' || txn.type === 'PURCHASE_RETURN') {
      // Inventory decreases
      balanceQuantity -= txn.quantity;
      
      if (txn.type === 'SALE') {
        cogs = txn.quantity * averageUnitCost;
        balanceTotalCost -= cogs;
        profit = txn.totalPrice - cogs;
        vat = txn.totalPrice * (vatRate / 100);

        summary.soldQuantity += txn.quantity;
        summary.salesRevenue += txn.totalPrice;
        summary.cogs += cogs;
        summary.grossProfit += profit;
      } else if (txn.type === 'PURCHASE_RETURN') {
        // Returned at original purchase price usually, but for weighted average it impacts total cost
        balanceTotalCost -= txn.totalPrice;
        averageUnitCost = balanceQuantity > 0 ? balanceTotalCost / balanceQuantity : 0;
        
        summary.purchasedQuantity -= txn.quantity;
        summary.purchasedValue -= txn.totalPrice;
      }
    }

    // Fix floating point issues
    balanceTotalCost = Math.max(0, balanceTotalCost);
    if (balanceQuantity === 0) {
      balanceTotalCost = 0;
      averageUnitCost = 0;
    }

    const entry: KardexEntry = {
      ...txn,
      balanceQuantity,
      balanceTotalCost,
      averageUnitCost,
      cogs,
      profit,
      vat,
    };
    
    history.push(entry);

    summary.endingQuantity = balanceQuantity;
    summary.endingValue = balanceTotalCost;
    summary.averageUnitCost = averageUnitCost;
  }

  return {
    kardexByItem,
    summaries: Array.from(summariesMap.values()),
  };
}
