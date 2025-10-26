import React from 'react';

export const FormalTemplate = ({ data, subtotal, tax, total }: { data: any, subtotal: number, tax: number, total: number }) => (
    <div className="font-serif text-gray-900">
         <header className="text-center mb-8">
            <h1 className="text-3xl font-bold">{data.invoiceTitle || 'Price Quotation'}</h1>
            <p className="text-sm">{data.companyName} | {data.companyPhone} | {data.companyEmail}</p>
        </header>
        <div className="grid grid-cols-2 gap-8 mb-8">
            <div>
                <h3 className="font-bold border-b pb-1 mb-2">CLIENT</h3>
                <p>{data.clientName || 'Client Name'}</p>
                <p>{data.clientCompany || ''}</p>
                <p className="whitespace-pre-line">{data.clientAddress || ''}</p>
            </div>
            <div className="text-right">
                 <p><strong>Date:</strong> {data.date || 'YYYY-MM-DD'}</p>
                <p><strong>Quote #:</strong> {data.quotationNumber || '001'}</p>
            </div>
        </div>
        <h3 className="font-bold border-b pb-1 mb-2">PROJECT: {data.projectSubject || 'Project Subject'}</h3>
        <table className="w-full mt-6 mb-8 border-collapse">
            <thead>
                <tr className="bg-gray-100">
                    <th className="text-left p-3 border">SERVICE</th>
                    <th className="text-right p-3 border">QTY</th>
                    <th className="text-right p-3 border">RATE</th>
                    <th className="text-right p-3 border">AMOUNT</th>
                </tr>
            </thead>
            <tbody>
                {data.items.map((item: any, i: number) => (
                    <tr key={i}>
                        <td className="p-3 border">
                            <p className="font-semibold">{item.service}</p>
                            <p className="text-xs text-gray-600">{item.description}</p>
                        </td>
                        <td className="text-right p-3 border">{item.quantity || 1}</td>
                        <td className="text-right p-3 border">₹{(item.cost || 0).toLocaleString('en-IN')}</td>
                        <td className="text-right p-3 border">₹{((item.cost || 0) * (item.quantity || 1)).toLocaleString('en-IN')}</td>
                    </tr>
                ))}
            </tbody>
        </table>
        <div className="flex justify-end">
            <div className="w-1/2">
                <table className="w-full">
                    <tbody>
                        <tr><td className="p-2">Subtotal</td><td className="text-right p-2">₹{subtotal.toLocaleString('en-IN')}</td></tr>
                        <tr><td className="p-2">GST (18%)</td><td className="text-right p-2">₹{tax.toLocaleString('en-IN')}</td></tr>
                        <tr className="font-bold text-lg bg-gray-100"><td className="p-3">Total</td><td className="text-right p-3">₹{total.toLocaleString('en-IN')}</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
        <footer className="mt-12 text-center text-sm text-gray-500 border-t pt-4 no-print-footer">
            <p>{data.companyAddress.split('\n')[0]}, AP | {data.companyPhone} | {data.companyEmail}</p>
        </footer>
    </div>
);