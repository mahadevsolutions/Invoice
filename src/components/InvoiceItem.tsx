import React from 'react';

interface Item {
    service: string;
    description: string;
    cost: number;
    quantity: number;
    itemNumber: string;
    unit: string;
    hsn: string;
    gstRate?: number;
}

interface InvoiceItemProps {
    item: Item;
    index: number;
    updateItem: (index: number, field: keyof Item, value: any, extraFields?: Partial<Item>) => void;
    removeItem: (index: number) => void;
    activeTemplateName?: string;
}

const InvoiceItem: React.FC<InvoiceItemProps> = ({ item, index, updateItem, removeItem, activeTemplateName }) => {
    const isQuotation = activeTemplateName === 'Quotation';
    const isPurchaseOrder = activeTemplateName === 'Purchase Order';
    const isInvoice = activeTemplateName === 'Invoice';

    return (
        <div className="flex items-start space-x-2 mb-3 p-2 bg-gray-50 rounded-lg">
            <div className="flex-grow">
                <input
                    type="text"
                    placeholder="Service"
                    value={item.service}
                    onChange={(e) => updateItem(index, 'service', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 transition font-semibold"
                />
                <textarea
                    placeholder="Description"
                    value={item.description}
                    onChange={(e) => updateItem(index, 'description', e.target.value)}
                    className="w-full mt-1 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 transition text-sm"
                    rows={3}
                ></textarea>
            </div>
            <div className="flex flex-col space-y-2 w-1/4">
                <input
                    type="number"
                    placeholder="Cost"
                    value={item.cost}
                    onChange={(e) => updateItem(index, 'cost', parseFloat(e.target.value))}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 transition"
                />
                <input
                    type="number"
                    placeholder="Qty"
                    value={item.quantity}
                    onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value, 10))}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 transition"
                />
                {/* Only show 'Unit' field if NOT on the Quotation template */}
                {!isQuotation && (
                    <input
                        type="text"
                        placeholder="Unit (e.g., PCS)"
                        value={item.unit}
                        onChange={(e) => updateItem(index, 'unit', e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 transition"
                    />
                )}
                {/* HSN / Product Code / GST fields
                    - Show Product Code (maps to itemNumber) for Purchase Order and Invoice (and Quotation).
                    - For other templates show HSN/SAC field. */}
                {(isPurchaseOrder || isInvoice || isQuotation) ? (
                    <input
                        type="text"
                        placeholder=" HSN / Product Code"
                        value={item.itemNumber || item.hsn}
                        onChange={(e) => {
                            const value = e.target.value;
                            updateItem(index, 'itemNumber', value, { hsn: value });
                        }}
                        className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 transition"
                    />
                ) : (
                    <input
                        type="text"
                        placeholder="HSN/SAC"
                        value={item.hsn}
                        onChange={(e) => updateItem(index, 'hsn', e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 transition"
                    />
                )}
            </div>
            <button onClick={() => removeItem(index)} className="px-3 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition self-center">
                &times;
            </button>
        </div>
    );
};

export default InvoiceItem;