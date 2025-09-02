import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';

interface AvocadoOrder {
  id: string;
  clientName: string;
  orderDate: Date;
  requestedDeliveryDate: Date;
  status: 'pending' | 'processing' | 'delayed' | 'completed' | 'cancelled';
  items: Array<{
    caliber: string;
    quantity: number;
    type: string;
    processingTime: number;
  }>;
  priority: 'high' | 'medium' | 'low';
  totalProcessingTime: number;
  actualDeliveryDate?: Date;
  notes?: string;
  delayReason?: string;
}

export default function CommandeClient() {
  const [orders, setOrders] = useState<AvocadoOrder[]>([]);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const allChecked = orders.length > 0 && selectedOrders.length === orders.length;

  useEffect(() => {
    const q = query(collection(db, 'avocado_orders'), orderBy('orderDate', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedOrders = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          orderDate: data.orderDate?.toDate ? data.orderDate.toDate() : new Date(data.orderDate),
          requestedDeliveryDate: data.requestedDeliveryDate?.toDate ? data.requestedDeliveryDate.toDate() : new Date(data.requestedDeliveryDate),
          actualDeliveryDate: data.actualDeliveryDate?.toDate ? data.actualDeliveryDate.toDate() : data.actualDeliveryDate ? new Date(data.actualDeliveryDate) : undefined,
        } as AvocadoOrder;
      });
      setOrders(fetchedOrders);
    });
    return () => unsubscribe();
  }, []);

  // Helper to get a unique key for each item
  const getItemKey = (item: { type: string; caliber: string; processingTime: number }) => `${item.type}-${item.caliber}-${item.processingTime}`;

  // Helper to get checkedItems for an order, always returns an array
  const getCheckedItems = (order: AvocadoOrder & { checkedItems?: string[] }) => Array.isArray(order.checkedItems) ? order.checkedItems : [];

  // Handle checking/unchecking a single item
  const handleItemCheck = async (orderId: string, itemKey: string, checked: boolean) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    let checkedItems = getCheckedItems(order);
    if (checked) {
      if (!checkedItems.includes(itemKey)) checkedItems = [...checkedItems, itemKey];
    } else {
      checkedItems = checkedItems.filter((k: string) => k !== itemKey);
    }
    try {
      await updateDoc(doc(db, 'avocado_orders', orderId), { checkedItems });
    } catch (e) {
      console.error('Failed to update checkedItems', e);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Mes Commandes d'Avocat</h1>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    disabled
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Commande</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Livraison demandée</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Détails</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Items</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {orders.map(order => {
                const checkedItems = getCheckedItems(order);
                const allItemsChecked = order.items.length > 0 && checkedItems.length === order.items.length;
                return (
                  <tr key={order.id}>
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={selectedOrders.includes(order.id)}
                        onChange={e => {
                          if (e.target.checked) {
                            setSelectedOrders(prev => [...prev, order.id]);
                          } else {
                            setSelectedOrders(prev => prev.filter(id => id !== order.id));
                          }
                        }}
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{order.id}</div>
                      <div className="text-gray-500 text-sm">{order.clientName}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-block px-2 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-800">
                        {order.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {order.requestedDeliveryDate.toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="text-xs text-gray-700">
                          {item.quantity} kg - {item.type} (Caliber {item.caliber})
                        </div>
                      ))}
                    </td>
                    <td className="px-6 py-4">
                      {order.items.map((item, idx) => {
                        const itemKey = getItemKey(item);
                        return (
                          <div key={itemKey} className="flex items-center gap-2 text-xs text-gray-700">
                            <input
                              type="checkbox"
                              checked={checkedItems.includes(itemKey)}
                              onChange={e => handleItemCheck(order.id, itemKey, e.target.checked)}
                            />
                            {item.type} Caliber: {item.caliber} | {item.quantity} palette | Processing: {item.processingTime}h
                          </div>
                        );
                      })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
