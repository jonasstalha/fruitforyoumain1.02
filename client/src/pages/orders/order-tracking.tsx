import React, { useState, useEffect } from 'react';
import { Package, Clock, Truck, Search, Filter, Calendar } from 'lucide-react';
import { collection, onSnapshot, query, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

interface OrderItem {
  caliber: string;
  quantity: number;
  type: string;
  processingTime: number;
}

interface Order {
  id: string;
  clientName: string;
  orderDate: Date;
  requestedDeliveryDate: Date;
  status: 'pending' | 'processing' | 'delayed' | 'completed' | 'cancelled';
  items: OrderItem[];
  priority: 'high' | 'medium' | 'low';
  totalProcessingTime: number;
  actualDeliveryDate?: Date;
  notes?: string;
  delayReason?: string;
  progress?: number;
}

export default function OrderTrackingView() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  // Add a completed property to each item for tracking
  const [orderItemsStatus, setOrderItemsStatus] = useState<{ [orderId: string]: boolean[] }>({});

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
          progress: data.progress ?? undefined,
        } as Order;
      });
      setOrders(fetchedOrders);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Initialize or update the status for each order's items
    setOrderItemsStatus(prev => {
      const updated: { [orderId: string]: boolean[] } = { ...prev };
      orders.forEach(order => {
        if (!updated[order.id] || updated[order.id].length !== order.items.length) {
          updated[order.id] = order.items.map(() => false);
        }
      });
      return updated;
    });
  }, [orders]);

  const toggleItemCompleted = (orderId: string, idx: number) => {
    setOrderItemsStatus(prev => ({
      ...prev,
      [orderId]: prev[orderId].map((val, i) => (i === idx ? !val : val))
    }));
  };

  // Change order status
  const changeOrderStatus = async (orderId: string, newStatus: Order['status']) => {
    setOrders(prev => prev.map(order =>
      order.id === orderId ? { ...order, status: newStatus } : order
    ));
    try {
      const orderRef = doc(db, 'avocado_orders', orderId);
      await updateDoc(orderRef, { status: newStatus });
    } catch (error) {
      // Optionally handle error (e.g., show notification)
      console.error('Failed to update order status:', error);
    }
  };

  const getStatusColor = (status: Order['status']) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      processing: 'bg-blue-100 text-blue-800 border-blue-200',
      delayed: 'bg-red-100 text-red-800 border-red-200',
      completed: 'bg-green-100 text-green-800 border-green-200',
      cancelled: 'bg-gray-100 text-gray-800 border-gray-200'
    };
    return colors[status];
  };

  const getPriorityBadge = (priority: Order['priority']) => {
    const colors = {
      high: 'bg-red-50 text-red-700 ring-red-600/10',
      medium: 'bg-yellow-50 text-yellow-700 ring-yellow-600/10',
      low: 'bg-green-50 text-green-700 ring-green-600/10'
    };
    return colors[priority];
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Order Tracking</h1>
          <p className="text-gray-600">Track your order status and processing progress</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <Package className="h-10 w-10 text-blue-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Your Orders</p>
                <p className="text-2xl font-semibold text-gray-900">{orders.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <Clock className="h-10 w-10 text-yellow-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">In Processing</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {orders.filter(o => o.status === 'processing').length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <Truck className="h-10 w-10 text-green-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Ready for Delivery</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {orders.filter(o => o.status === 'completed').length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <Calendar className="h-10 w-10 text-purple-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Scheduled</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {orders.filter(o => o.status === 'pending').length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search orders..."
              className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="relative">
            <Filter className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
            <select
              className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="delayed">Delayed</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          <div className="relative">
            <Calendar className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
            <input
              type="date"
              className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
            />
          </div>

          <div className="relative">
            <Calendar className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
            <input
              type="date"
              className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
            />
          </div>
        </div>

        {/* Orders List */}
        <div className="space-y-6">
          {orders.map((order) => (
            <div key={order.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex flex-col md:flex-row justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">{order.id}</h3>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                      {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                    </span>
                    {order.priority && (
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityBadge(order.priority)}`}>
                        {order.priority.charAt(0).toUpperCase() + order.priority.slice(1)} Priority
                      </span>
                    )}
                  </div>
                  <p className="text-gray-600 mb-4">{order.notes}</p>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-sm text-gray-500">Ordered: {order.orderDate.toLocaleDateString()}</span>
                  <span className="text-sm text-gray-500">Expected: {order.requestedDeliveryDate.toLocaleDateString()}</span>
                </div>
              </div>

              {/* Progress Bar */}
              {order.status === 'processing' && order.progress !== undefined && (
                <div className="mt-4">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-gray-700">Processing Progress</span>
                    <span className="text-sm font-medium text-gray-700">{order.progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div
                      className="bg-blue-600 h-2.5 rounded-full"
                      style={{ width: `${order.progress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Order Items */}
              <div className="mt-6 border-t border-gray-200 pt-4">
                <h4 className="text-sm font-medium text-gray-900 mb-3">Order Items (Calibers)</h4>
                {(order.status === 'pending' || order.status === 'processing' || order.status === 'delayed') && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Change Status:</label>
                    <select
                      className="border rounded px-2 py-1"
                      value={order.status}
                      onChange={e => changeOrderStatus(order.id, e.target.value as Order['status'])}
                    >
                      <option value="pending">Pending</option>
                      <option value="processing">Processing</option>
                      <option value="delayed">Delayed</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                )}
                <ul className="space-y-2">
                  {order.items.map((item, idx) => (
                    Array.from({ length: item.quantity }).map((_, palletIdx) => (
                      <li key={`${idx}-${palletIdx}`} className="flex items-center gap-3 bg-white border rounded-lg px-4 py-2 shadow-sm hover:bg-green-50 transition">
                        <input
                          type="checkbox"
                          checked={orderItemsStatus[order.id]?.[idx * 100 + palletIdx] || false}
                          onChange={() => toggleItemCompleted(order.id, idx * 100 + palletIdx)}
                          className="form-checkbox h-5 w-5 text-green-600 focus:ring-2 focus:ring-green-400"
                        />
                        <div className="flex-1 flex flex-col md:flex-row md:items-center md:justify-between">
                          <span className="font-medium text-gray-900">{item.type} <span className="text-xs text-gray-500 ml-2">Caliber: {item.caliber}</span></span>
                          <span className="text-sm text-gray-700">1 palette</span>
                          <span className="text-xs text-gray-500">Processing: {item.processingTime}h</span>
                        </div>
                      </li>
                    ))
                  ))}
                </ul>
              </div>

              {/* Timeline */}
              {order.status !== 'pending' && (
                <div className="mt-6 border-t border-gray-200 pt-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Order Timeline</h4>
                  <div className="relative">
                    <div className="absolute h-full w-0.5 bg-gray-200 left-2.5 top-0" />
                    <ul className="space-y-4 relative">
                      <li className="flex gap-3">
                        <div className="rounded-full bg-blue-500 w-5 h-5 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">Order Received</p>
                          <p className="text-sm text-gray-500">{order.orderDate.toLocaleString()}</p>
                        </div>
                      </li>
                      {order.status === 'processing' && (
                        <li className="flex gap-3">
                          <div className="rounded-full bg-yellow-500 w-5 h-5 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-gray-900">Processing Started</p>
                            <p className="text-sm text-gray-500">Estimated completion: {order.totalProcessingTime}h</p>
                          </div>
                        </li>
                      )}
                      {(order.status === 'completed' || order.status === 'delivered') && (
                        <li className="flex gap-3">
                          <div className="rounded-full bg-green-500 w-5 h-5 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-gray-900">Order Completed</p>
                            <p className="text-sm text-gray-500">
                              {order.actualDeliveryDate?.toLocaleString() || 'Pending delivery'}
                            </p>
                          </div>
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
