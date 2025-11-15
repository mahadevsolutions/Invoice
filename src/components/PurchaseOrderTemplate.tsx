import React from 'react';

interface POProps {
    data: any;
    subtotal: number;
    totalCgst: number;
    totalSgst: number;
    totalIgst: number;
    total: number;
}

export const PurchaseOrderTemplate: React.FC<POProps> = ({ data, subtotal, totalCgst, totalSgst, totalIgst, total }) => {
    const items = data?.items || [];
    const shipping = data?.shippingCost || 0;

    return (
        <div className="text-sm text-gray-800">
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h1 className="text-2xl font-bold">{data.companyName}</h1>
                    <p className="whitespace-pre-line">{data.companyAddress}</p>
                    <p>{data.companyEmail} | {data.companyPhone}</p>
                </div>
                <div className="text-right">
                    <h2 className="text-xl font-semibold">PURCHASE ORDER</h2>
                    <p>{data.projectSubject}</p>
                    <p className="font-semibold">PO #: {data.quotationNumber}</p>
                    <p>Date: {data.date}</p>
                </div>
            </div>

            <div className="mb-6 grid grid-cols-2 gap-6">
                <div>
                    <h3 className="font-bold">Supplier :</h3>
                    <p className="whitespace-pre-line">{data.clientName}</p>
                    <p className="whitespace-pre-line">{data.clientCompany}</p>
                    <p className="whitespace-pre-line">{data.clientAddress}</p>
                    <p className="whitespace-pre-line">{data.clientPhone}</p>
                </div>
                <div>
                    <h3 className="font-bold">Ship To :</h3>
                    <p className="whitespace-pre-line ">{data.deliveryAddress}</p>
                    
                    <p className="mt-0">
                        <span className="font-semibold">Requisitioner: </span> {data.requisitioner}<br/>
                        <span className="font-semibold">Ship Via:</span> {data.shipVia} 
                        {" | "}
                        <span className="font-semibold">F.O.B.:</span> {data.fob}
                    </p>

                </div>
            </div>

            <table className="w-full border-collapse mb-6">
                <thead>
                    <tr className="text-left border-b">
                        <th className="py-2">Item #</th>
                        <th className="py-2">Description</th>
                        <th className="py-2">Unit</th>
                        <th className="py-2">Qty</th>
                        <th className="py-2">Unit Price</th>
                        <th className="py-2">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((it: any, idx: number) => (
                        <tr key={idx} className="border-b">
                            <td className="py-2">{it.itemNumber || ''}</td>
                            <td className="py-2">{it.service}<div className="text-xs text-gray-500">{it.description}</div></td>
                            <td className="py-2">{it.unit || ''}</td>
                            <td className="py-2">{it.quantity}</td>
                            <td className="py-2">{it.cost}</td>
                            <td className="py-2">{(it.cost || 0) * (it.quantity || 1)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <div className="flex justify-end">
                <div className="w-64">
                    <div className="flex justify-between py-1"><span>Subtotal</span><span>₹{subtotal.toLocaleString('en-IN')}</span></div>
                    {data.gstType === 'IGST' ? (
                        <div className="flex justify-between py-1"><span>IGST</span><span>₹{totalIgst.toLocaleString('en-IN')}</span></div>
                    ) : (
                        <>
                            <div className="flex justify-between py-1"><span>CGST</span><span>₹{totalCgst.toLocaleString('en-IN')}</span></div>
                            <div className="flex justify-between py-1"><span>SGST</span><span>₹{totalSgst.toLocaleString('en-IN')}</span></div>
                        </>
                    )}
                    <div className="flex justify-between py-1"><span>Shipping</span><span>{shipping}</span></div>
                    <div className="flex justify-between py-2 font-bold border-t mt-2"><span>Total</span><span>{total}</span></div>
                </div>
            </div>

            <div className="mt-6 text-xs text-gray-600">
                <p>{data.notes}</p>
            </div>
        </div>
    );
};

export default PurchaseOrderTemplate;
