import React from 'react';

// This template IGNORES the subtotal/tax/total props and calculates
// everything locally to support per-item GST.
interface QuotationProps {
  data: any;
}

export const ProfessionalQuotationTemplate: React.FC<QuotationProps> = ({ data }) => {
  // Calculate totals locally
  let totalAmount = 0;
  let totalCgst = 0;
  let totalSgst = 0;
  let totalIgst = 0;

  const itemsWithCalculations = (data.items || []).map((item: any) => {
    const amount = (item.cost || 0) * (item.quantity || 1);
	const gstRate = data.globalTaxRate || 0;
    let cgst = 0, sgst = 0, igst = 0;

    if (data?.gstType === 'IGST') {
      igst = amount * (gstRate / 100);
    } else {
      cgst = amount * (gstRate / 2 / 100);
      sgst = amount * (gstRate / 2 / 100);
    }

    const itemTotal = amount + cgst + sgst + igst;

    totalAmount += amount;
    totalCgst += cgst;
    totalSgst += sgst;
    totalIgst += igst;

    return { ...item, amount, cgst, sgst, igst, itemTotal };
  });

  const grandTotal = totalAmount + totalCgst + totalSgst + totalIgst;
  // New logic to aggregate by HSN
  const hsnSummary = itemsWithCalculations.reduce((acc: any, item: any) => {
    const hsn = item.hsn || 'N/A';
    if (!acc[hsn]) {
      acc[hsn] = {
        taxableValue: 0,
        cgst: 0,
        sgst: 0,
        igst: 0,
        // Get the correct rate label (full or half) based on global settings
        rate: data.gstType === 'IGST' ? (data.globalTaxRate || 0) : ((data.globalTaxRate || 0) / 2),
      };
    }
    acc[hsn].taxableValue += item.amount;
    acc[hsn].cgst += item.cgst || 0;
    acc[hsn].sgst += item.sgst || 0;
    acc[hsn].igst += item.igst || 0;
    return acc;
  }, {} as Record<string, { taxableValue: number; cgst: number; sgst: number; igst: number; rate: number }>);

  // Helper function to convert number to words (for "Total Tax In Words")
  const numberToWords = (num: number): string => {
    const a = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
    const b = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

    const inWords = (n: number): string => {
      if (n < 20) return a[n];
      if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '');
      if (n < 1000) return a[Math.floor(n / 1000)] + ' hundred' + (n % 100 !== 0 ? ' and ' + inWords(n % 100) : '');
      if (n < 100000) return inWords(Math.floor(n / 1000)) + ' thousand' + (n % 1000 !== 0 ? ' ' + inWords(n % 1000) : '');
      if (n < 10000000) return inWords(Math.floor(n / 100000)) + ' lakh' + (n % 100000 !== 0 ? ' ' + inWords(n % 100000) : '');
      return 'number too large';
    };

    const numStr = Math.floor(num).toString();
    if (numStr.length > 7) return 'number too large'; // Limit to lakhs
    const word = inWords(Math.floor(num));
    return word.toUpperCase() + ' RUPEES ONLY';
  };

  const totalTaxInWords = numberToWords(totalCgst + totalSgst + totalIgst);
  const logoSrc = data.logoSrc || "https://placehold.co/150x50/000000/FFFFFF?text=MAHADEV";

  return (
    <div className="font-sans text-xs text-gray-800 bg-white p-8">
      <style>
        {`
          @media print {
            /* Ensure sections try to stay together */
            section { break-inside: avoid-page; }
            /* Allow tables to break if they must, but not rows */
            table { break-inside: auto; }
            tr { break-inside: avoid-page; }
            /* Keep the HSN summary and totals together */
            .print-avoid-break { break-inside: avoid-page; }
          }
        `}
      </style>
      {/* 1. Header */}
      <header className="flex justify-between items-start pb-4 mb-4">
        {/* Left: Title / meta */}
        <div className="w-1/2">
          <h1 className="text-3xl font-bold text-blue-700 uppercase">{data.invoiceTitle || 'Quotation'}</h1>
          <div className="mt-4">
            <p><strong>Quotation #:</strong> {data.quotationNumber || '---'}</p>
            <p><strong>Quotation Date:</strong> {data.date}</p>
          </div>
        </div>
        <div className="w-1/2 text-right">
          <img src={logoSrc} alt="Company Logo" className="h-16 object-contain inline-block" />
        </div>
      </header>

      {/* 2. Billed By / Billed To */}
      <section className="grid grid-cols-2 gap-8 mb-8">
        <div>
          <h3 className="font-bold text-sm uppercase border-b border-gray-300 pb-1 mb-2">Billed By</h3>
          <p className="font-bold text-base">{data.companyName}</p>
          <p className="whitespace-pre-line">{data.companyAddress}</p>
          <p><strong>Email:</strong> {data.companyEmail}</p>
          <p><strong>Phone:</strong> {data.companyPhone}</p>
          <p><strong>GSTIN:</strong> {data.companyGstin || '---'}</p>
          <p><strong>PAN:</strong> {data.companyPan || '---'}</p>
        </div>
        <div>
          <h3 className="font-bold text-sm uppercase border-b border-gray-300 pb-1 mb-2">Billed To</h3>
          <p className="font-bold text-base">{data.clientName}</p>
          <p>{data.clientCompany}</p>
          <p className="whitespace-pre-line">{data.clientAddress}</p>
          <p><strong>Phone:</strong> {data.clientPhone || '---'}</p>
          <p><strong>GSTIN:</strong> {data.clientGstin || '---'}</p>
          <p><strong>PAN:</strong> {data.clientPan || '---'}</p>
        </div>
      </section>

      {/* 3. Items Table */}
      <section>
        <table className="w-full border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-100">
              <th className="border p-2 text-left">Item</th>
              <th className="border p-2 text-right">GST</th>
              <th className="border p-2 text-right">Qty</th>
              <th className="border p-2 text-right">Rate</th>
              <th className="border p-2 text-right">Amount</th>
              {data?.gstType === 'IGST' ? (
                <th className="border p-2 text-right">IGST</th>
              ) : (
                <>
                  <th className="border p-2 text-right">CGST</th>
                  <th className="border p-2 text-right">SGST</th>
                </>
              )}
              <th className="border p-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {itemsWithCalculations.map((item: any, i: number) => (
              <tr key={i}>
                <td className="border p-2 align-top">
                  <p className="font-semibold">{item.service}</p>
                  <p className="text-gray-600">HSN/SAC: {item.hsn}</p>
                </td>
                <td className="border p-2 text-right align-top">{item.gstRate}%</td>
                <td className="border p-2 text-right align-top">{item.quantity}</td>
                <td className="border p-2 text-right align-top">₹{(item.cost || 0).toLocaleString('en-IN')}</td>
                <td className="border p-2 text-right align-top">₹{item.amount.toLocaleString('en-IN')}</td>
                {data?.gstType === 'IGST' ? (
                  <td className="border p-2 text-right align-top">₹{(item.igst || 0).toLocaleString('en-IN')}</td>
                ) : (
                  <>
                    <td className="border p-2 text-right align-top">₹{(item.cgst || 0).toLocaleString('en-IN')}</td>
                    <td className="border p-2 text-right align-top">₹{(item.sgst || 0).toLocaleString('en-IN')}</td>
                  </>
                )}
                <td className="border p-2 text-right align-top">₹{item.itemTotal.toLocaleString('en-IN')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* 4. Totals */}
      <section className="flex justify-end mt-4 print-avoid-break">
        <div className="w-1/2">
          <table className="w-full">
            <tbody>
              <tr>
                <td className="p-2">Amount</td>
                <td className="p-2 text-right">₹{totalAmount.toLocaleString('en-IN')}</td>
              </tr>
              {data?.gstType === 'IGST' ? (
                <tr>
                  <td className="p-2">IGST</td>
                  <td className="p-2 text-right">₹{totalIgst.toLocaleString('en-IN')}</td>
                </tr>
              ) : (
                <>
                  <tr>
                    <td className="p-2">CGST</td>
                    <td className="p-2 text-right">₹{totalCgst.toLocaleString('en-IN')}</td>
                  </tr>
                  <tr>
                    <td className="p-2">SGST</td>
                    <td className="p-2 text-right">₹{totalSgst.toLocaleString('en-IN')}</td>
                  </tr>
                </>
              )}
              <tr className="font-bold text-base bg-gray-100">
                <td className="p-3">Total (INR)</td>
                <td className="p-3 text-right">₹{grandTotal.toLocaleString('en-IN')}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* 4.5. NEW HSN SUMMARY TABLE */}
      <section className="mt-8 print-avoid-break">
        <table className="w-full border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-100">
              <th rowSpan={2} className="border p-2 text-left">HSN</th>
              <th rowSpan={2} className="border p-2 text-right">Taxable Value</th>
              {data?.gstType === 'IGST' ? (
                <th colSpan={2} className="border p-2 text-center">IGST</th>
              ) : (
                <>
                  <th colSpan={2} className="border p-2 text-center">CGST</th>
                  <th colSpan={2} className="border p-2 text-center">SGST</th>
                </>
              )}
              <th rowSpan={2} className="border p-2 text-right">Total</th>
            </tr>
            <tr className="bg-gray-100">
              <th className="border p-2 text-right">Rate</th>
              <th className="border p-2 text-right">Amount</th>
              {data?.gstType !== 'IGST' && (
                <>
                  <th className="border p-2 text-right">Rate</th>
                  <th className="border p-2 text-right">Amount</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {Object.entries(hsnSummary).map(([hsn, d]: [string, any]) => (
              <tr key={hsn}>
                <td className="border p-2">{hsn}</td>
                <td className="border p-2 text-right">₹{(d.taxableValue || 0).toLocaleString('en-IN')}</td>
                <td className="border p-2 text-right">{(d.rate || 0)}%</td>
                <td className="border p-2 text-right">₹{(d.igst ? d.igst : d.cgst || 0).toLocaleString('en-IN')}</td>
                {data?.gstType !== 'IGST' && (
                  <>
                    <td className="border p-2 text-right">{(d.rate || 0)}%</td>
                    <td className="border p-2 text-right">₹{(d.sgst || 0).toLocaleString('en-IN')}</td>
                  </>
                )}
                <td className="border p-2 text-right">₹{(((d.cgst || 0) + (d.sgst || 0) + (d.igst || 0))).toLocaleString('en-IN')}</td>
              </tr>
            ))}
            <tr className="font-bold bg-gray-50">
              <td className="border p-2">Total</td>
              <td className="border p-2 text-right">₹{totalAmount.toLocaleString('en-IN')}</td>
              {data?.gstType === 'IGST' ? (
                <td colSpan={2} className="border p-2 text-right">₹{totalIgst.toLocaleString('en-IN')}</td>
              ) : (
                <>
                  <td colSpan={2} className="border p-2 text-right">₹{totalCgst.toLocaleString('en-IN')}</td>
                  <td colSpan={2} className="border p-2 text-right">₹{totalSgst.toLocaleString('en-IN')}</td>
                </>
              )}
              <td className="border p-2 text-right">₹{(totalCgst + totalSgst + totalIgst).toLocaleString('en-IN')}</td>
            </tr>
          </tbody>
        </table>
        {/* Total Tax in Words */}
        <div className="text-right font-bold border border-t-0 border-gray-300 p-2">
          Total Tax In Words: {totalTaxInWords}
        </div>
      </section>

      {/* 5. Notes / Terms */}
      {data.notes && (
        <section className="mt-8 print-avoid-break">
          <h4 className="font-bold mb-1">Terms & Conditions:</h4>
          <p className="text-xs text-gray-700 whitespace-pre-line border p-3 rounded-lg">{data.notes}</p>
        </section>
      )}
    </div>
  );
};

export default ProfessionalQuotationTemplate;
