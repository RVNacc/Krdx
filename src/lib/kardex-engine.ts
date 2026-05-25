import {
  ProcessedTransaction,
  KardexEntry,
  ItemSummary,
  TransactionType
} from '../types';

export function calculateKardex(
  transactions: ProcessedTransaction[],
  defaultVatRate: number,
  negativeStockMode: 'ALLOW' | 'ZERO_OUT' | 'ADJUST_INITIAL' = 'ALLOW',
  adjustedTxns: Record<string, { unitPrice?: number; quantity?: number }> = {},
  selectedTafsil?: string
): { kardexByItem: Record<string, KardexEntry[]>; summaries: ItemSummary[] } {
  
  // 1. Apply user manual adjustments & Tafsil filters
  let filteredTransactions = transactions.map((t) => {
    const adj = adjustedTxns[t.id];
    const unitPrice = adj?.unitPrice !== undefined ? adj.unitPrice : t.unitPrice;
    const quantity = adj?.quantity !== undefined ? adj.quantity : t.quantity;
    const totalPrice = unitPrice * quantity;

    return {
      ...t,
      unitPrice,
      quantity,
      totalPrice,
    } as ProcessedTransaction;
  });

  // Filter sales by selected Tafsil if specified
  if (selectedTafsil && selectedTafsil !== '__ALL__') {
    filteredTransactions = filteredTransactions.filter(t => {
      // Keep non-sales always (initial, purchase etc.) to maintain baseline inventory,
      // but filter sales & returns by customer/tafsil
      if (t.type === 'SALE' || t.type === 'SALE_RETURN') {
        return t.tafsil === selectedTafsil;
      }
      return true;
    });
  }

  // Sort chronologically and by original excel row number
  let sortedTransactions = [...filteredTransactions].sort((a, b) => {
    if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
    return a.rowNumber - b.rowNumber;
  });

  const uniqueItems = Array.from(new Set(sortedTransactions.map((t) => t.itemName)));

  // If ADJUST_INITIAL is selected, run pre-calculation to find negative peaks per item
  const initialAdjustments: Record<string, number> = {};
  
  if (negativeStockMode === 'ADJUST_INITIAL') {
    for (const item of uniqueItems) {
      let runQty = 0;
      let minQty = 0;
      
      const itemTxns = sortedTransactions.filter(t => t.itemName === item);
      for (const t of itemTxns) {
        if (t.type === 'INITIAL' || t.type === 'PURCHASE' || t.type === 'SALE_RETURN') {
          runQty += t.quantity;
        } else if (t.type === 'SALE' || t.type === 'PURCHASE_RETURN') {
          runQty -= t.quantity;
        }
        if (runQty < minQty) {
          minQty = runQty;
        }
      }
      
      if (minQty < 0) {
        // We have a shortage of Math.abs(minQty). We will add it to INITIAL balance.
        initialAdjustments[item] = Math.abs(minQty);
      }
    }

    // Apply adjustments to existing INITIAL keys, or inject one if none exists
    uniqueItems.forEach(item => {
      const needed = initialAdjustments[item];
      if (needed && needed > 0) {
        const itemTxns = sortedTransactions.filter(t => t.itemName === item);
        const firstInitial = itemTxns.find(t => t.type === 'INITIAL');
        
        if (firstInitial) {
          firstInitial.quantity += needed;
          firstInitial.totalPrice = firstInitial.quantity * firstInitial.unitPrice;
        } else {
          // Find first purchase to estimate price, or use 0
          const firstPurchase = itemTxns.find(t => t.type === 'PURCHASE');
          const estimatedUnitPrice = firstPurchase ? firstPurchase.unitPrice : 0;
          
          // Inject an initial transaction at the very beginning of the timeline
          const earliestTime = itemTxns.length > 0 ? itemTxns[0].timestamp - 1000 : Date.now();
          sortedTransactions.unshift({
            id: `adj_initial_${item}`,
            rowNumber: -1,
            date: itemTxns.length > 0 ? itemTxns[0].date : new Date(),
            timestamp: earliestTime,
            itemName: item,
            type: 'INITIAL',
            quantity: needed,
            unitPrice: estimatedUnitPrice,
            totalPrice: needed * estimatedUnitPrice,
            sourceFile: 'سیستم (تعدیل خودکار)',
          });
        }
      }
    });

    // Re-sort in case we injected new initial records
    sortedTransactions.sort((a, b) => {
      if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
      return a.rowNumber - b.rowNumber;
    });
  }

  const kardexByItem: Record<string, KardexEntry[]> = {};
  const summariesMap = new Map<string, ItemSummary>();

  for (const item of uniqueItems) {
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
      unit: '',
      itemVatRate: 0,
    });
  }

  // Process transactions with chosen running modes
  for (const txn of sortedTransactions) {
    const item = txn.itemName;
    if (!kardexByItem[item]) {
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
        unit: '',
        itemVatRate: 0,
      });
    }

    const history = kardexByItem[item];
    const summary = summariesMap.get(item)!;

    if (txn.unit && !summary.unit) {
       summary.unit = txn.unit;
    }
    if (txn.taxRate !== undefined && summary.itemVatRate === 0) {
       summary.itemVatRate = txn.taxRate;
    }

    let previousQty = history.length > 0 ? history[history.length - 1].balanceQuantity : 0;
    let previousTotalCost = history.length > 0 ? history[history.length - 1].balanceTotalCost : 0;
    let previousAvgCost = history.length > 0 ? history[history.length - 1].averageUnitCost : 0;

    let balanceQuantity = previousQty;
    let balanceTotalCost = previousTotalCost;
    let averageUnitCost = previousAvgCost;
    
    let cogs = 0;
    let profit = 0;

    // Determine custom or row-specific VAT Rate
    const currentVatRate = txn.taxRate !== undefined ? txn.taxRate : defaultVatRate;
    let vat = 0;

    let txnQty = txn.quantity;
    let txnTotalPrice = txn.totalPrice;
    let txnUnitPrice = txn.unitPrice;

    if (txn.type === 'INITIAL' || txn.type === 'PURCHASE' || txn.type === 'SALE_RETURN') {
      // Stock addition
      balanceQuantity += txnQty;
      
      if (txn.type === 'SALE_RETURN') {
        // Return at original cost
        txnUnitPrice = averageUnitCost;
        txnTotalPrice = txnQty * averageUnitCost;
        balanceTotalCost += txnTotalPrice;
      } else {
        balanceTotalCost += txnTotalPrice;
      }
      
      if (balanceQuantity > 0) {
        averageUnitCost = balanceTotalCost / balanceQuantity;
      } else if (balanceQuantity === 0) {
        // preserve the previous averageUnitCost
        balanceTotalCost = 0;
      } else {
        // negative stock, keep the old average unit cost, total cost might go negative based on standard logic
      }

      if (txn.type === 'INITIAL') {
        summary.initialQuantity += txnQty;
        summary.initialValue += txnTotalPrice;
      } else if (txn.type === 'PURCHASE') {
        summary.purchasedQuantity += txnQty;
        summary.purchasedValue += txnTotalPrice;
      }
    } else if (txn.type === 'SALE' || txn.type === 'PURCHASE_RETURN') {
      // Stock extraction
      if (negativeStockMode === 'ZERO_OUT' && txnQty > balanceQuantity) {
        // Zero out means we cap the transaction quantity to the available inventory quantity at this instant
        txnQty = Math.max(0, balanceQuantity);
        txnTotalPrice = txnQty * txnUnitPrice;
      }

      balanceQuantity -= txnQty;
      
      if (txn.type === 'SALE') {
        cogs = txnQty * averageUnitCost;
        balanceTotalCost -= cogs;
        profit = txnTotalPrice - cogs;
        vat = txnTotalPrice * (currentVatRate / 100);

        summary.soldQuantity += txnQty;
        summary.salesRevenue += txnTotalPrice;
        summary.cogs += cogs;
        summary.grossProfit += profit;
      } else if (txn.type === 'PURCHASE_RETURN') {
        balanceTotalCost -= txnTotalPrice;
        averageUnitCost = balanceQuantity > 0 ? balanceTotalCost / balanceQuantity : 0;
        
        summary.purchasedQuantity -= txnQty;
        summary.purchasedValue -= txnTotalPrice;
      }
    }

    // Fix float precision issues around zero
    if (Math.abs(balanceQuantity) < 1e-6) {
      balanceQuantity = 0;
    }
    if (balanceQuantity === 0) {
      balanceTotalCost = 0;
    }

    const entry: KardexEntry = {
      ...txn,
      quantity: txnQty,
      unitPrice: txnUnitPrice,
      totalPrice: txnTotalPrice,
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

  // Ensure items without transactions are accounted for
  return {
    kardexByItem,
    summaries: Array.from(summariesMap.values()),
  };
}
