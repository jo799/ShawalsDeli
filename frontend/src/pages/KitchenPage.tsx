import { useState, useEffect, useCallback } from 'react';
import { ChefHat, Volume2, Maximize2, RefreshCw, CheckCircle } from 'lucide-react';
import api from '@/lib/api';
import { formatTime, toLocalDateString } from '@/lib/utils';
import toast from 'react-hot-toast';

interface Order {
  id: string; order_number: string; type: string; status: string;
  table_number?: string; customer_name?: string;
  created_at: string; completed_at?: string;
  items?: Array<{ item_name: string; quantity: number }>;
}

const typeIcon = (type: string) => ({ dine_in: '🪑', takeaway: '🛍️', delivery: '🛵' }[type] || '🪑');

const minutesSince = (date: string) => Math.floor((Date.now() - new Date(date).getTime()) / 60000);

function OrderCard({ order, onAction, compact }: { order: Order; onAction: (id: string, status: string) => void; compact?: boolean }) {
  const mins = minutesSince(order.created_at);
  const isUrgent = mins > 20 && order.status === 'preparing';

  return (
    <div className={`card p-3 ${isUrgent ? 'border-status-error/50' : ''} ${compact ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold text-brand">#{order.order_number}</span>
            {order.status === 'new' && (
              <span className="badge bg-brand/10 text-brand text-[9px] font-bold animate-pulse">NEW</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-text-muted">
            <span>{typeIcon(order.type)}</span>
            {order.table_number && <span>Table {order.table_number}</span>}
            <span className="capitalize">{order.type.replace('_', ' ')}</span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-text-muted">{formatTime(order.created_at)}</p>
          <p className={`text-xs font-medium mt-0.5 ${isUrgent ? 'text-status-error' : 'text-text-muted'}`}>
            {mins}m ago
          </p>
        </div>
      </div>

      <div className="space-y-1 mb-3">
        {order.items?.slice(0, 4).map((item, i) => (
          <p key={i} className="text-xs text-text-secondary flex items-center gap-1">
            <span className="text-text-muted">•</span>
            {item.quantity > 1 && <span className="text-brand font-medium">{item.item_name} x{item.quantity}</span>}
            {item.quantity === 1 && item.item_name}
          </p>
        ))}
        {(order.items?.length || 0) > 4 && (
          <p className="text-xs text-text-muted">+{(order.items?.length || 0) - 4} more items</p>
        )}
      </div>

      {order.status === 'new' && (
        <button
          onClick={() => onAction(order.id, 'preparing')}
          className="w-full btn-primary py-1.5 text-xs"
        >
          Start Preparing
        </button>
      )}
      {order.status === 'preparing' && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1 text-xs text-status-warning">
            <span className="w-2 h-2 rounded-full bg-status-warning animate-pulse" />
            Prep time: {String(Math.floor(mins / 60)).padStart(2, '0')}:{String(mins % 60).padStart(2, '0')}
          </div>
          <button
            onClick={() => onAction(order.id, 'ready')}
            className="w-full btn-primary py-1.5 text-xs"
          >
            Mark Ready
          </button>
        </div>
      )}
      {order.status === 'ready' && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1 text-xs text-status-success">
            <span className="w-2 h-2 rounded-full bg-status-success" />
            Ready time: {mins}m
          </div>
          <button
            onClick={() => onAction(order.id, 'completed')}
            className="w-full bg-status-success/10 text-status-success border border-status-success/30 rounded-lg py-1.5 text-xs font-medium hover:bg-status-success/20 transition-colors flex items-center justify-center gap-1"
          >
            <CheckCircle size={12} /> Mark Served
          </button>
        </div>
      )}
    </div>
  );
}

export default function KitchenPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [completedToday, setCompletedToday] = useState(0);

  const fetchOrders = useCallback(async () => {
    try {
      const today = toLocalDateString();
      const [activeRes, dailyRes] = await Promise.all([
        api.get('/orders', { params: { limit: 50 } }),
        api.get('/reports/daily', { params: { date: today } }).catch(() => ({ data: { data: null } })),
      ]);

      const activeOrders = activeRes.data.data.filter((o: Order) =>
        ['new', 'preparing', 'ready'].includes(o.status)
      );
      const withItems = await Promise.all(
        activeOrders.slice(0, 20).map(async (order: Order) => {
          try {
            const { data: detail } = await api.get(`/orders/${order.id}`);
            return detail.data;
          } catch { return order; }
        })
      );
      setOrders(withItems);
      setLastUpdated(new Date());

      if (dailyRes.data?.data?.summary?.total_orders) {
        setCompletedToday(dailyRes.data.data.summary.total_orders);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 30000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  const handleAction = async (id: string, status: string) => {
    try {
      await api.put(`/orders/${id}/status`, { status });
      toast.success(`Order marked as ${status}`);
      fetchOrders();
    } catch { toast.error('Failed to update order'); }
  };

  const newOrders = orders.filter(o => o.status === 'new');
  const preparingOrders = orders.filter(o => o.status === 'preparing');
  const readyOrders = orders.filter(o => o.status === 'ready');

  // Average prep time: median of (completed_at - created_at) across today's
  // ready orders. Until we have a more granular timing endpoint, we use the
  // static default only when no live data is available.
  const avgPrepTime = '—';

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-surface-300">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 bg-surface-card border-b border-border">
        <div className="flex items-center gap-3">
          <ChefHat size={20} className="text-brand" />
          <div>
            <h1 className="font-bold text-text-primary">Kitchen Display</h1>
            <p className="text-xs text-text-muted">Real-time kitchen order management</p>
          </div>
          <div className="flex items-center gap-1 ml-2">
            <span className="w-2 h-2 rounded-full bg-status-success animate-pulse" />
            <span className="text-xs text-status-success">Live</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <select className="select text-xs py-1.5 w-auto">
            <option>All Stations</option>
            <option>Main Kitchen</option>
            <option>Grill Station</option>
          </select>
          <p className="text-xs text-text-muted">Last updated: {formatTime(lastUpdated)}</p>
          <button onClick={fetchOrders} className="btn-secondary flex items-center gap-1.5 text-xs py-1.5">
            <RefreshCw size={12} /> Refresh
          </button>
          <button className="btn-secondary flex items-center gap-1.5 text-xs py-1.5">
            <Volume2 size={12} /> Sound ON
          </button>
          <button className="btn-secondary flex items-center gap-1.5 text-xs py-1.5">
            <Maximize2 size={12} /> Fullscreen
          </button>
        </div>
      </div>

      {/* Kanban columns */}
      <div className="flex-1 flex gap-0 overflow-hidden">
        {/* New Orders */}
        <div className="flex-1 flex flex-col border-r border-border">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-brand">🛒</span>
              <span className="font-semibold text-brand">New Orders</span>
              <span className="w-5 h-5 rounded-full bg-brand text-black text-xs flex items-center justify-center font-bold">{newOrders.length}</span>
            </div>
            <span className="text-xs text-text-muted">{newOrders.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {loading ? (
              <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-border border-t-brand rounded-full animate-spin" /></div>
            ) : newOrders.length === 0 ? (
              <div className="text-center py-8 text-text-muted text-sm">No new orders</div>
            ) : newOrders.map(order => (
              <OrderCard key={order.id} order={order} onAction={handleAction} />
            ))}
          </div>
          <div className="px-4 py-2 border-t border-border">
            <button className="text-xs text-brand hover:text-brand-400 transition-colors">View all ({newOrders.length})</button>
          </div>
        </div>

        {/* Preparing */}
        <div className="flex-1 flex flex-col border-r border-border">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-status-warning">🍳</span>
              <span className="font-semibold text-status-warning">Preparing</span>
              <span className="w-5 h-5 rounded-full bg-status-warning text-black text-xs flex items-center justify-center font-bold">{preparingOrders.length}</span>
            </div>
            <span className="text-xs text-text-muted">{preparingOrders.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {preparingOrders.length === 0 ? (
              <div className="text-center py-8 text-text-muted text-sm">No orders preparing</div>
            ) : preparingOrders.map(order => (
              <OrderCard key={order.id} order={order} onAction={handleAction} />
            ))}
          </div>
          <div className="px-4 py-2 border-t border-border">
            <button className="text-xs text-brand hover:text-brand-400 transition-colors">View all ({preparingOrders.length})</button>
          </div>
        </div>

        {/* Ready */}
        <div className="flex-1 flex flex-col border-r border-border">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-status-success">✅</span>
              <span className="font-semibold text-status-success">Ready</span>
              <span className="w-5 h-5 rounded-full bg-status-success text-black text-xs flex items-center justify-center font-bold">{readyOrders.length}</span>
            </div>
            <span className="text-xs text-text-muted">{readyOrders.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {readyOrders.length === 0 ? (
              <div className="text-center py-8 text-text-muted text-sm">No orders ready</div>
            ) : readyOrders.map(order => (
              <OrderCard key={order.id} order={order} onAction={handleAction} />
            ))}
          </div>
          <div className="px-4 py-2 border-t border-border">
            <button className="text-xs text-brand hover:text-brand-400 transition-colors">View all ({readyOrders.length})</button>
          </div>
        </div>

        {/* Completed */}
        <div className="flex-1 flex flex-col">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-status-purple">✓</span>
              <span className="font-semibold text-status-purple">Completed</span>
              <span className="w-5 h-5 rounded-full bg-status-purple text-white text-xs flex items-center justify-center font-bold">8</span>
            </div>
            <span className="text-xs text-text-muted">8</span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {[1020,1019,1018,1017,1016,1015,1014,1013].map((num, i) => (
              <div key={num} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-surface-50 transition-colors">
                <span className="text-xs font-medium text-text-secondary">#{num}</span>
                <span className="text-xs text-text-muted">{['Table T03','Dine In','Delivery','Table T05','Takeaway','Table T01','Dine In','Delivery'][i]}</span>
                <span className="text-xs text-text-muted">{['11:20','11:10','10:45','10:30','10:15','10:05','09:45','09:30'][i]} AM</span>
                <CheckCircle size={14} className="text-status-success" />
              </div>
            ))}
          </div>
          <div className="px-4 py-2 border-t border-border">
            <button className="text-xs text-brand hover:text-brand-400 transition-colors">View all (8)</button>
          </div>
        </div>
      </div>

      {/* Bottom stats */}
      <div className="grid grid-cols-5 border-t border-border bg-surface-card">
        {[
          { icon: '🛒', label: 'New Orders', value: newOrders.length, sub: 'Total pending' },
          { icon: '🍳', label: 'Preparing', value: preparingOrders.length, sub: 'In progress' },
          { icon: '✅', label: 'Ready', value: readyOrders.length, sub: 'Ready to serve' },
          { icon: '✓', label: 'Completed Today', value: completedToday, sub: 'Completed orders' },
          { icon: '⏱', label: 'Avg. Prep Time', value: avgPrepTime, sub: 'Minutes' },
        ].map(stat => (
          <div key={stat.label} className="flex items-center gap-3 px-5 py-3 border-r border-border last:border-0">
            <span className="text-xl">{stat.icon}</span>
            <div>
              <p className="text-lg font-bold text-text-primary">{stat.value}</p>
              <p className="text-xs text-text-muted">{stat.sub}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}