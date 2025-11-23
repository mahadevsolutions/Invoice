import React from 'react';

export type GstType = 'IGST' | 'CGST_SGST' | 'NONE';

export interface Item {
  service: string;
  hsn?: string;
  quantity?: number;
  unit?: string;
  cost?: number;
  itemNumber?: string;
  description?: string;
  gstRate?: number;
  serialNumber?: number | string;
}

export interface ComputedItem extends Item {
  amount: number;
  cgst: number;
  sgst: number;
  igst: number;
  itemTotal: number;
  gstRate: number;
}

export interface Totals {
  subtotal: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  grandTotal: number;
}

export interface HsnSummaryRow {
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  rate: number;
}

export interface ComputeResult {
  itemsWithCalculations: ComputedItem[];
  totals: Totals;
  hsnSummary: Record<string, HsnSummaryRow>;
}

export const computeItemsWithTaxes = (
  items: Item[],
  gstType: GstType,
  globalTaxRate: number = 0
): ComputeResult => {
  const itemsWithCalculations: ComputedItem[] = items.map((item, index) => {
    const quantity = item.quantity ?? 1;
    const rate = item.cost ?? 0;
    const amount = rate * quantity;
    const effectiveRate = item.gstRate ?? globalTaxRate;

    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    if (gstType === 'IGST') {
      igst = amount * (effectiveRate / 100);
    } else if (gstType === 'CGST_SGST') {
      const halfRate = effectiveRate / 2 / 100;
      cgst = amount * halfRate;
      sgst = amount * halfRate;
    }

    const itemTotal = amount + cgst + sgst + igst;

    return {
      ...item,
      serialNumber: item.serialNumber ?? index + 1,
      amount,
      cgst,
      sgst,
      igst,
      itemTotal,
      gstRate: effectiveRate,
    };
  });

  const totals = itemsWithCalculations.reduce<Totals>(
    (acc, item) => {
      acc.subtotal += item.amount;
      acc.totalCgst += item.cgst;
      acc.totalSgst += item.sgst;
      acc.totalIgst += item.igst;
      acc.grandTotal += item.itemTotal;
      return acc;
    },
    {
      subtotal: 0,
      totalCgst: 0,
      totalSgst: 0,
      totalIgst: 0,
      grandTotal: 0,
    }
  );

  const hsnSummary = itemsWithCalculations.reduce<Record<string, HsnSummaryRow>>(
    (acc, item) => {
      const key = item.hsn || 'N/A';
      if (!acc[key]) {
        acc[key] = {
          taxableValue: 0,
          cgst: 0,
          sgst: 0,
          igst: 0,
          rate:
            gstType === 'IGST'
              ? globalTaxRate || 0
              : gstType === 'CGST_SGST'
              ? (globalTaxRate || 0) / 2
              : 0,
        };
      }

      acc[key].taxableValue += item.amount;
      acc[key].cgst += item.cgst;
      acc[key].sgst += item.sgst;
      acc[key].igst += item.igst;

      return acc;
    },
    {}
  );

  return {
    itemsWithCalculations,
    totals,
    hsnSummary,
  };
};

export interface ItemsTableProps {
  items: Item[];
  gstType: GstType;
  globalTaxRate?: number;
  currency?: string;
  className?: string;
}

const formatCurrency = (value: number, currencySymbol: string) => {
  return `${currencySymbol}${value.toLocaleString('en-IN')}`;
};

const ItemsTable: React.FC<ItemsTableProps> = ({
  items,
  gstType,
  globalTaxRate = 0,
  currency = '₹',
  className,
}) => {
  const { itemsWithCalculations, totals, hsnSummary } = computeItemsWithTaxes(
    items,
    gstType,
    globalTaxRate
  );

  const { subtotal, totalCgst, totalSgst, totalIgst, grandTotal } = totals;
  const totalTax = totalCgst + totalSgst + totalIgst;

  const taxColumnCount = gstType === 'CGST_SGST' ? 2 : gstType === 'IGST' ? 1 : 0;
  const baseColumns = 6 + taxColumnCount; // existing columns without S.No
  const totalColumns = baseColumns + 1; // include S.No column
  const labelColSpan = totalColumns - 1;

  const containerClassName = className ? className : undefined;

  return (
    <div className={containerClassName}>
      <section className="print-avoid-break">
        <table className="w-full border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-100">
              <th className="border p-2 text-right">S.No</th>
              <th className="border p-2 text-left">Item</th>
              <th className="border p-2 text-right">GST</th>
              <th className="border p-2 text-right">Qty</th>
              <th className="border p-2 text-right">Rate</th>
              <th className="border p-2 text-right">Amount</th>
              {gstType === 'IGST' && (
                <th className="border p-2 text-right">IGST</th>
              )}
              {gstType === 'CGST_SGST' && (
                <>
                  <th className="border p-2 text-right">CGST</th>
                  <th className="border p-2 text-right">SGST</th>
                </>
              )}
              <th className="border p-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {itemsWithCalculations.map((item, index) => (
              <tr key={`${item.service}-${index}`}>
                <td className="border p-2 align-top text-right font-semibold">{index + 1}</td>
                <td className="border p-2 align-top">
                  <p className="font-semibold">{item.service}</p>
                  {item.hsn && (
                    <p className="text-gray-600">HSN/SAC: {item.hsn}</p>
                  )}
                </td>
                <td className="border p-2 text-right align-top">
                  {item.gstRate.toLocaleString('en-IN')}%
                </td>
                <td className="border p-2 text-right align-top">
                  {item.quantity ?? 1}
                </td>
                <td className="border p-2 text-right align-top">
                  {formatCurrency(item.cost ?? 0, currency)}
                </td>
                <td className="border p-2 text-right align-top">
                  {formatCurrency(item.amount, currency)}
                </td>
                {gstType === 'IGST' && (
                  <td className="border p-2 text-right align-top">
                    {formatCurrency(item.igst, currency)}
                  </td>
                )}
                {gstType === 'CGST_SGST' && (
                  <>
                    <td className="border p-2 text-right align-top">
                      {formatCurrency(item.cgst, currency)}
                    </td>
                    <td className="border p-2 text-right align-top">
                      {formatCurrency(item.sgst, currency)}
                    </td>
                  </>
                )}
                <td className="border p-2 text-right align-top">
                  {formatCurrency(item.itemTotal, currency)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="border p-2 text-right" colSpan={labelColSpan}>
                Subtotal
              </td>
              <td className="border p-2 text-right">
                {formatCurrency(subtotal, currency)}
              </td>
            </tr>
            {gstType === 'IGST' && (
              <tr>
                <td className="border p-2 text-right" colSpan={labelColSpan}>
                  IGST
                </td>
                <td className="border p-2 text-right">
                  {formatCurrency(totalIgst, currency)}
                </td>
              </tr>
            )}
            {gstType === 'CGST_SGST' && (
              <>
                <tr>
                  <td className="border p-2 text-right" colSpan={labelColSpan}>
                    CGST
                  </td>
                  <td className="border p-2 text-right">
                    {formatCurrency(totalCgst, currency)}
                  </td>
                </tr>
                <tr>
                  <td className="border p-2 text-right" colSpan={labelColSpan}>
                    SGST
                  </td>
                  <td className="border p-2 text-right">
                    {formatCurrency(totalSgst, currency)}
                  </td>
                </tr>
              </>
            )}
            <tr className="font-bold text-base bg-gray-100">
              <td className="border p-2 text-right" colSpan={labelColSpan}>
                Total
              </td>
              <td className="border p-2 text-right">
                {formatCurrency(grandTotal, currency)}
              </td>
            </tr>
          </tfoot>
        </table>
      </section>

      <section className="mt-8 print-avoid-break">
        <table className="w-full border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-100">
              <th rowSpan={2} className="border p-2 text-left">
                HSN
              </th>
              <th rowSpan={2} className="border p-2 text-right">
                Taxable Value
              </th>
              {gstType === 'IGST' && (
                <th colSpan={2} className="border p-2 text-center">
                  IGST
                </th>
              )}
              {gstType === 'CGST_SGST' && (
                <>
                  <th colSpan={2} className="border p-2 text-center">
                    CGST
                  </th>
                  <th colSpan={2} className="border p-2 text-center">
                    SGST
                  </th>
                </>
              )}
              <th rowSpan={2} className="border p-2 text-right">
                Total
              </th>
            </tr>
            <tr className="bg-gray-100">
              <th className="border p-2 text-right">Rate</th>
              <th className="border p-2 text-right">Amount</th>
              {gstType === 'CGST_SGST' && (
                <>
                  <th className="border p-2 text-right">Rate</th>
                  <th className="border p-2 text-right">Amount</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {Object.entries(hsnSummary).map(([hsn, data]) => (
              <tr key={hsn}>
                <td className="border p-2">{hsn}</td>
                <td className="border p-2 text-right">
                  {formatCurrency(data.taxableValue, currency)}
                </td>
                {gstType === 'IGST' && (
                  <>
                    <td className="border p-2 text-right">{data.rate}%</td>
                    <td className="border p-2 text-right">
                      {formatCurrency(data.igst, currency)}
                    </td>
                  </>
                )}
                {gstType === 'CGST_SGST' && (
                  <>
                    <td className="border p-2 text-right">{data.rate}%</td>
                    <td className="border p-2 text-right">
                      {formatCurrency(data.cgst, currency)}
                    </td>
                    <td className="border p-2 text-right">{data.rate}%</td>
                    <td className="border p-2 text-right">
                      {formatCurrency(data.sgst, currency)}
                    </td>
                  </>
                )}
                <td className="border p-2 text-right">
                  {formatCurrency(data.cgst + data.sgst + data.igst, currency)}
                </td>
              </tr>
            ))}
            <tr className="font-bold bg-gray-50">
              <td className="border p-2">Total</td>
              <td className="border p-2 text-right">
                {formatCurrency(subtotal, currency)}
              </td>
              {gstType === 'IGST' && (
                <td colSpan={2} className="border p-2 text-right">
                  {formatCurrency(totalIgst, currency)}
                </td>
              )}
              {gstType === 'CGST_SGST' && (
                <>
                  <td colSpan={2} className="border p-2 text-right">
                    {formatCurrency(totalCgst, currency)}
                  </td>
                  <td colSpan={2} className="border p-2 text-right">
                    {formatCurrency(totalSgst, currency)}
                  </td>
                </>
              )}
              <td className="border p-2 text-right">
                {formatCurrency(totalTax, currency)}
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  );
};

export { ItemsTable };
export default ItemsTable;
