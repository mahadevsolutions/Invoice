import React from 'react';

export const DigitalMarketingTemplate = ({ data, total }: { data: any, total: number }) => {
    const subtotal = data.items.reduce((acc: number, item: any) => acc + (item.cost || 0) * (item.quantity || 1), 0);
    const tax = subtotal * 0.18;
    
    return (
        <div className="font-sans text-gray-800">
            <header className="grid grid-cols-2 gap-16 pb-4 border-b-2 border-gray-300">
                <div>
                     <div className="flex items-center space-x-3">
                        <img src={data.logoSrc} alt="Company Logo" className="h-16 object-cover mt-6" />
                        <div>
                            <h1 className="text-[22px] font-bold text-blue-700">{data.companyName}</h1>
                        </div>
                     </div>
                     <div className="text-sm mt-4">
                        <p><strong>From:</strong></p>
                        <p className="whitespace-pre-line">{data.companyAddress}</p>
                        <p><strong>Email:</strong> {data.companyEmail}</p>
                        <p><strong>Phone:</strong> {data.companyPhone}</p>
                     </div>
                </div>
                <div className="text-left mt-4">
                    <h2 className="text-3xl font-bold uppercase">{data.invoiceTitle || 'Quotation'}</h2>
                    <div className="mt-4 space-y-2 text-sm">
                        <div>
                            <span className="font-semibold">To:</span>
                            <p className="font-bold">{data.clientName || ' '}</p>
                            <p>{data.clientCompany || ''}</p>
                            <p className="whitespace-pre-line">{data.clientAddress || ''}</p>
                        </div>
                        <div>
                            <span className="font-semibold">Date:</span>
                            <p>{data.date || ' '}</p>
                        </div>
                         <div>
                            <span className="font-semibold">Quotation Number:</span>
                            <p>{data.quotationNumber || ' '}</p>
                        </div>
                    </div>
                </div>
            </header>
            <main className="mt-6">
                <p className="text-[16px]"><strong>Subject:</strong> {data.projectSubject || ' '}</p>
                <table className="w-full  border-separate border-spacing-0 border border-gray-200 mt-6">
                    <thead>
                        <tr className="bg-blue-100">
                            <th className="p-4 text-left font-bold border-b-2 border-blue-200 mt-2">Scope of Services</th>
                            <th className="p-4 text-right font-bold border-b-2 border-blue-200">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.items.map((item: any, i: number) => (
                            <tr key={i} className="border-b last:border-b-0">
                                <td className="p-3.5 align-top">
                                    <p className="font-bold">{item.service}</p>
                                    <p className="text-sm text-gray-600 whitespace-pre-line">{item.description}</p>
                                </td>
                                <td className="p-3.5 text-right align-top font-semibold">₹{((item.cost || 0) * (item.quantity || 1)).toLocaleString('en-IN')}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div className="flex justify-end mt-6">
                    <div className="w-1/2">
                        <div className="space-y-2 mb-3">
                            <div className="flex justify-between items-center p-2 text-gray-700">
                                <span className="font-bold">Subtotal</span>
                                <span className="font-semibold">₹{subtotal.toLocaleString('en-IN')}</span>
                            </div>
                            <div className="flex justify-between items-center p-2 text-gray-700">
                                <span className="font-bold">GST (18%)</span>
                                <span className="font-semibold">₹{tax.toLocaleString('en-IN')}</span>
                            </div>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-blue-600 text-white font-bold text-xl rounded-lg">
                            <span>Total</span>
                            <span>₹{total.toLocaleString('en-IN')}</span>
                        </div>
                    </div>
                </div>
            </main>
             <footer className="mt-12 text-center text-sm text-gray-500 border-t pt-4 no-print-footer">
                <p>{data.companyAddress.split('\n')[0]}, AP </p>
                <p>{data.companyPhone} | {data.companyEmail}</p>
            </footer>
        </div>
    );
};