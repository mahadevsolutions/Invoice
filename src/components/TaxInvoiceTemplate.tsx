import React from 'react';

interface TaxInvoiceProps {
  data: any;
}

// Number to words helper (limited to lakhs and paise)
const numberToWords = (num: number): string => {
    const a = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
    const b = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

    const inWords = (n: number): string => {
        if (n < 20) return a[n];
        if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '');
        if (n < 1000) return a[Math.floor(n / 100)] + ' hundred' + (n % 100 !== 0 ? ' and ' + inWords(n % 100) : '');
        if (n < 100000) return inWords(Math.floor(n / 1000)) + ' thousand' + (n % 1000 !== 0 ? ' ' + inWords(n % 1000) : '');
        if (n < 10000000) return inWords(Math.floor(n / 100000)) + ' lakh' + (n % 100000 !== 0 ? ' ' + inWords(n % 100000) : '');
        return 'number too large';
    };

    const numStr = Math.floor(num).toString();
    if (numStr.length > 7) return 'number too large';
    const [integerPart, decimalPart] = num.toString().split('.');
    let words = inWords(parseInt(integerPart));
    if (decimalPart && parseInt(decimalPart) > 0) {
        words += ' and ' + inWords(parseInt(decimalPart.slice(0, 2))) + ' paise';
    }
    return words.toUpperCase() + ' ONLY';
};

export const TaxInvoiceTemplate: React.FC<TaxInvoiceProps> = ({ data }) => {
  // --- 1. Calculations ---
  let subtotal = 0;
  let totalCgst = 0;
  let totalSgst = 0;
  let totalIgst = 0;

  const items = data?.items || [];

  const itemsWithCalculations = items.map((item: any) => {
    const amount = (item.cost || 0) * (item.quantity || 1);
	const gstRate = data.globalTaxRate || 0;
    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    if (data?.gstType === 'IGST') {
      igst = amount * (gstRate / 100);
    } else {
      cgst = amount * (gstRate / 2 / 100);
      sgst = amount * (gstRate / 2 / 100);
    }

    subtotal += amount;
    totalCgst += cgst;
    totalSgst += sgst;
    totalIgst += igst;
    return { ...item, amount, cgst, sgst, igst };
  });

  const totalBeforeRoundOff = subtotal + totalCgst + totalSgst + totalIgst;
  const roundOff = data.roundOff || 0;
  const grandTotal = totalBeforeRoundOff + roundOff;
  const totalTax = totalCgst + totalSgst + totalIgst;
  const amountInWords = numberToWords(grandTotal);
  const taxInWords = numberToWords(totalTax);

  // --- 2. HSN Summary Logic ---
  const hsnSummary = itemsWithCalculations.reduce((acc: any, item: any) => {
    const hsn = item.hsn || 'N/A';
    if (!acc[hsn]) {
      acc[hsn] = { taxableValue: 0, cgst: 0, sgst: 0, igst: 0, rate: data.gstType === 'IGST' ? (data.globalTaxRate || 0) : ((data.globalTaxRate || 0) / 2) };
    }
    acc[hsn].taxableValue += item.amount;
    acc[hsn].cgst += item.cgst || 0;
    acc[hsn].sgst += item.sgst || 0;
    acc[hsn].igst += item.igst || 0;
    return acc;
  }, {} as Record<string, { taxableValue: number; cgst: number; sgst: number; igst: number; rate: number }>);

  return (
    <div className="font-sans text-xs text-gray-900 bg-white p-6 border border-gray-400">
      <style>{`
        @media print {
          .print-avoid-break { break-inside: avoid; }
          .print-header-spacer { height: 200px; }
        }
        .text-xxs { font-size: 0.65rem; }
      `}</style>

      {/* 1. e-Invoice Header */}
      <header className="grid grid-cols-2 gap-4 mb-4">
        <div className="text-left">
          <h1 className="text-2xl font-bold">{data.invoiceTitle || 'Tax Invoice'}</h1>
          <p className="font-bold">{data.projectSubject}</p>
        </div>
      </header>

      {/* 2. Company Details */}
      <section className="text-center border-t border-b border-gray-400 py-2 mb-4 text-xxs">
        <h2 className="text-lg font-bold">{data.companyName}</h2>
        <p>{data.companyAddress}</p>
        <p><strong>GSTIN/UIN:</strong> {data.companyGstin}</p>
        <p><strong>Contact:</strong> {data.companyPhone} | <strong>E-Mail:</strong> {data.companyEmail}</p>
      </section>

      {/* 3. Buyer & Consignee */}
      <section className="grid grid-cols-3 gap-2 mb-2 text-xxs">
        <div className="border border-gray-400 p-2">
          <h3 className="font-bold border-b pb-1 mb-1">Consignee (Ship to)</h3>
          <p className="font-bold">{data.consigneeName || data.clientName}</p>
          <p>{data.consigneeAddress || data.clientAddress}</p>
          <p><strong>GSTIN/UIN:</strong> {data.consigneeGstin || data.clientGstin}</p>
          <p><strong>State Name:</strong> {data.consigneeState || data.clientState}</p>
          <p><strong>Contact Person:</strong> {data.consigneeContactPerson}</p>
          <p><strong>Contact:</strong> {data.consigneeContact}</p>
        </div>
        <div className="border border-gray-400 p-2">
          <h3 className="font-bold border-b pb-1 mb-1">Buyer (Bill to)</h3>
          <p className="font-bold">{data.clientName}</p>
          <p>{data.clientAddress}</p>
          <p><strong>GSTIN/UIN:</strong> {data.clientGstin}</p>
          <p><strong>State Name:</strong> {data.clientState || 'Telangana, Code: 36'}</p>
          <p><strong>Contact Person:</strong> {data.clientContactPerson || ''}</p>
          <p><strong>Contact:</strong> {data.clientPhone}</p>
        </div>
        <div className="border border-gray-400 p-2 text-xxs">
          <p><strong>Invoice No.:</strong> <span className="font-bold">{data.quotationNumber}</span></p>
          <p><strong>Dated:</strong> <span className="font-bold">{data.date}</span></p>
          <p><strong>Delivery Note:</strong> {data.deliveryNote}</p>
          <p><strong>Buyer's Order No.:</strong> {data.buyersOrderNo}</p>
          <p><strong>Dispatch Doc No.:</strong> {data.dispatchDocNo}</p>
          <p><strong>Dispatched through:</strong> {data.dispatchedThrough}</p>
          <p><strong>Destination:</strong> {data.destination}</p>
          <p><strong>Terms of Delivery:</strong> {data.termsOfDelivery}</p>
        </div>
      </section>

      {/* 4. Items Table */}
      <section className="mb-2 print-avoid-break">
        <table className="w-full border-collapse border border-gray-400 text-xxs">
          <thead>
            <tr className="bg-gray-100">
              <th className="border p-1">SI No.</th>
              <th className="border p-1 text-left">Description of Goods</th>
              <th className="border p-1">HSN/SAC</th>
              <th className="border p-1">Quantity</th>
              <th className="border p-1">Rate</th>
              <th className="border p-1">per</th>
              <th className="border p-1">Amount</th>
            </tr>
          </thead>
          <tbody>
            {itemsWithCalculations.map((item: any, i: number) => (
              <tr key={i}>
                <td className="border p-1 text-center">{i + 1}</td>
                <td className="border p-1">{item.service}</td>
                <td className="border p-1 text-center">{item.hsn}</td>
                <td className="border p-1 text-center">{item.quantity} {item.unit}</td>
                <td className="border p-1 text-right">{item.cost.toLocaleString('en-IN')}</td>
                <td className="border p-1 text-center">{item.unit}</td>
                <td className="border p-1 text-right">{item.amount.toLocaleString('en-IN')}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-gray-500">
      <tr><td colSpan={6} className="text-right font-bold p-1">Subtotal</td><td className="text-right font-bold p-1">{subtotal.toLocaleString('en-IN')}</td></tr>
      {data.gstType === 'IGST' ? (
        <tr><td colSpan={6} className="text-right p-1">IGST</td><td className="text-right p-1">{totalIgst.toLocaleString('en-IN')}</td></tr>
      ) : (
        <>
        <tr><td colSpan={6} className="text-right p-1">CGST</td><td className="text-right p-1">{totalCgst.toLocaleString('en-IN')}</td></tr>
        <tr><td colSpan={6} className="text-right p-1">SGST</td><td className="text-right p-1">{totalSgst.toLocaleString('en-IN')}</td></tr>
        </>
      )}
      {roundOff !== 0 && <tr><td colSpan={6} className="text-right p-1">Round Off</td><td className="text-right p-1">{roundOff.toLocaleString('en-IN')}</td></tr>}
      <tr className="bg-gray-100 font-bold">
        <td colSpan={6} className="text-right p-1">Total</td>
        <td className="text-right p-1">{grandTotal.toLocaleString('en-IN')}</td>
      </tr>
      </tfoot>
        </table>
      </section>

      {/* 5. Amount in Words */}
      <section className="border-t border-gray-400 pt-2 mb-2 print-avoid-break">
        <p className="font-bold">Amount Chargeable (in words): <span className="font-normal">{amountInWords}</span></p>
      </section>

    {/* 6. HSN Summary Table */}
    <section className="mb-2 print-avoid-break">
    <table className="w-full border-collapse border border-gray-400 text-xxs">
      <thead>
      <tr className="bg-gray-100">
        <th rowSpan={2} className="border p-1">HSN/SAC</th>
        <th rowSpan={2} className="border p-1">Taxable Value</th>
        {data.gstType === 'IGST' ? (
        <th colSpan={2} className="border p-1">IGST</th>
        ) : (
        <>
          <th colSpan={2} className="border p-1">CGST</th>
          <th colSpan={2} className="border p-1">SGST</th>
        </>
        )}
        <th rowSpan={2} className="border p-1">Total Tax Amount</th>
      </tr>
      <tr className="bg-gray-100">
        {data.gstType === 'IGST' ? (
        <>
          <th className="border p-1">Rate</th><th className="border p-1">Amount</th>
        </>
        ) : (
        <>
          <th className="border p-1">Rate</th><th className="border p-1">Amount</th>
          <th className="border p-1">Rate</th><th className="border p-1">Amount</th>
        </>
        )}
      </tr>
      </thead>
      <tbody>
      {Object.entries(hsnSummary).map(([hsn, hsnData]: [string, any]) => (
        <tr key={hsn}>
        <td className="border p-1">{hsn}</td>
        <td className="border p-1 text-right">{hsnData.taxableValue.toLocaleString('en-IN')}</td>
        {data.gstType === 'IGST' ? (
          <>
          <td className="border p-1 text-right">{hsnData.rate}%</td>
          <td className="border p-1 text-right">{hsnData.igst.toLocaleString('en-IN')}</td>
          </>
        ) : (
          <>
          <td className="border p-1 text-right">{hsnData.rate}%</td>
          <td className="border p-1 text-right">{hsnData.cgst.toLocaleString('en-IN')}</td>
          <td className="border p-1 text-right">{hsnData.rate}%</td>
          <td className="border p-1 text-right">{hsnData.sgst.toLocaleString('en-IN')}</td>
          </>
        )}
        <td className="border p-1 text-right">{(hsnData.cgst + hsnData.sgst + hsnData.igst).toLocaleString('en-IN')}</td>
        </tr>
      ))}
      <tr className="font-bold bg-gray-50">
        <td className="border p-1">Total</td>
        <td className="border p-1 text-right">{subtotal.toLocaleString('en-IN')}</td>
        {data.gstType === 'IGST' ? (
        <td colSpan={2} className="border p-1 text-right">{totalIgst.toLocaleString('en-IN')}</td>
        ) : (
        <>
          <td colSpan={2} className="border p-1 text-right">{totalCgst.toLocaleString('en-IN')}</td>
          <td colSpan={2} className="border p-1 text-right">{totalSgst.toLocaleString('en-IN')}</td>
        </>
        )}
        <td className="border p-1 text-right">{totalTax.toLocaleString('en-IN')}</td>
      </tr>
      </tbody>
    </table>
    <div className="text-left font-bold border border-t-0 border-gray-400 p-1">
      Tax Amount (in words): {taxInWords}
    </div>
    </section>

    {/* 7. Footer */}
    <footer className="text-xxs pt-2 border-t border-gray-400 print-avoid-break">
    <div>
      <h4 className="font-bold mb-1">Company's Bank Details</h4>
      <p><strong>Bank Name:</strong> {data.companyBankName}</p>
      <p><strong>A/c No.:</strong> {data.companyAccountNo}</p>
      <p><strong>Branch & IFS Code:</strong> {data.companyBankBranch}</p>
      <h4 className="font-bold mt-2 mb-1">Declaration</h4>
      <p>{data.declaration}</p>
    </div>
    </footer>
    </div>
  );
};
