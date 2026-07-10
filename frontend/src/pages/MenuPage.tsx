import { useState, useEffect, useRef } from 'react';
import { Plus, Search, Grid, List, Star, Edit2, Trash2, X, RotateCcw } from 'lucide-react';
import api from '@/lib/api';
import { confirmDelete } from '@/lib/confirmPreference';
import { formatCurrency, cn, resolveMenuImage, menuImagePlaceholder } from '@/lib/utils';
import { PageHeader, StatusBadge, Modal, LoadingPage } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';

interface MenuItem {
  id: string; name: string; description: string; price: number; cost: number;
  category_id: string; category_name: string; image_url?: string;
  preparation_time: number; status: string; tags?: string[]; is_featured?: boolean;
  track_stock?: boolean; stock_quantity?: number; reorder_level?: number; barcode?: string;
}
interface Category { id: string; name: string; item_count: number; }

const EMPTY_ITEM = {
  name: '', description: '', price: 0, cost: 0, category_id: '', preparation_time: 15, status: 'available', tags: [] as string[], image_url: '',
  track_stock: false, stock_quantity: 0, reorder_level: 5, barcode: '',
};

export default function MenuPage() {
  const { hasPermission } = useAuthStore();
  const canManage = hasPermission('menu.manage');

  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null); // null = "All Items"
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(''); // '' = active items (backend default excludes archived)
  const [selected, setSelected] = useState<MenuItem | null>(null);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState(EMPTY_ITEM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const LIMIT = 12;

  const fetchData = async () => {
    try {
      setLoading(true);
      const [itemsRes, catRes] = await Promise.all([
        api.get('/menu/items', {
          params: {
            // Was matching by parsing the tab's display label
            // (activeTab.split(' ')[0]) — only ever took the FIRST WORD,
            // so "Main Dishes 12" resolved to looking for a category
            // literally named "Main", which doesn't exist. Worked by
            // accident for single-word categories, silently matched
            // nothing (and so filtered nothing) for every multi-word one.
            category_id: activeCategoryId || undefined,
            search: search || undefined,
            status: statusFilter || undefined,
            page, limit: LIMIT
          }
        }),
        api.get('/menu/categories')
      ]);
      setItems(itemsRes.data.data);
      setTotal(itemsRes.data.pagination.total);
      setCategories(catRes.data.data);
    } catch { toast.error('Failed to load menu'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [activeCategoryId, page, statusFilter]);
  useEffect(() => { const t = setTimeout(fetchData, 400); return () => clearTimeout(t); }, [search]);

  const openEdit = (item?: MenuItem) => {
    if (item) {
      setFormData({
        name: item.name, description: item.description || '', price: item.price, cost: item.cost,
        category_id: item.category_id, preparation_time: item.preparation_time, status: item.status,
        tags: item.tags || [], image_url: item.image_url || '',
        track_stock: item.track_stock || false, stock_quantity: item.stock_quantity ?? 0, reorder_level: item.reorder_level ?? 5,
        barcode: item.barcode || '',
      });
      setSelected(item);
    } else {
      setFormData(EMPTY_ITEM);
      setSelected(null);
    }
    setEditing(true);
  };

  const saveItem = async () => {
    try {
      setSaving(true);
      if (selected) {
        await api.put(`/menu/items/${selected.id}`, formData);
        toast.success('Item updated');
      } else {
        await api.post('/menu/items', formData);
        toast.success('Item added');
      }
      setEditing(false);
      fetchData();
    } catch { toast.error('Failed to save item'); }
    finally { setSaving(false); }
  };

  const handleImageSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Client-side guard so obviously-wrong files fail instantly with a clear
    // message instead of a round-trip; the server validates authoritatively too.
    if (!file.type.startsWith('image/')) { toast.error('Please choose an image file.'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Image is too large (max 5MB).'); return; }
    const fd = new FormData();
    fd.append('image', file);
    try {
      setUploading(true);
      const res = await api.post('/menu/upload', fd);
      setFormData(p => ({ ...p, image_url: res.data.url }));
      toast.success('Image uploaded');
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Failed to upload image');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = ''; // allow re-selecting the same file
    }
  };

  const deleteItem = async (id: string) => {
    if (!confirmDelete('Delete this menu item?')) return;
    try {
      await api.delete(`/menu/items/${id}`);
      toast.success('Item deleted');
      fetchData();
    } catch { toast.error('Failed to delete item'); }
  };

  const restoreItem = async (item: MenuItem) => {
    try {
      await api.put(`/menu/items/${item.id}`, { ...item, status: 'available' });
      toast.success('Item restored');
      fetchData();
    } catch { toast.error('Failed to restore item'); }
  };

  const tabs = [{ id: null as string | null, label: `All Items ${total}` }, ...categories.map(c => ({ id: c.id, label: `${c.name} ${c.item_count}` }))];

  // Small inline badge for countable items: green while comfortably stocked,
  // amber at/below the reorder level, red at zero. Returns null for items
  // that don't track stock so it silently disappears from the layout.
  const StockBadge = ({ item }: { item: MenuItem }) => {
    if (!item.track_stock) return null;
    const qty = item.stock_quantity ?? 0;
    const low = item.reorder_level ?? 5;
    const tone = qty <= 0 ? 'bg-status-error/15 text-status-error' : qty <= low ? 'bg-status-warning/15 text-status-warning' : 'bg-status-success/15 text-status-success';
    return (
      <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap', tone)}>
        {qty <= 0 ? 'Out of stock' : `${qty} left`}
      </span>
    );
  };

  return (
    <div className="flex flex-col md:flex-row h-full overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden p-6">
        <PageHeader title="Menu" subtitle="Manage your menu items, categories and modifiers">
          <button className="btn-secondary text-sm">Categories</button>
          <button className="btn-secondary text-sm">Modifiers</button>
          {canManage && (
            <button onClick={() => openEdit()} className="btn-primary flex items-center gap-2 text-sm">
              <Plus size={14} /> Add Menu Item
            </button>
          )}
        </PageHeader>

        {/* Category tabs */}
        <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1 flex-wrap">
          {tabs.map(tab => {
            const isActive = activeCategoryId === tab.id;
            return (
              <button key={tab.id ?? 'all'} onClick={() => { setActiveCategoryId(tab.id); setPage(1); }}
                className={cn('px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors',
                  isActive ? 'bg-brand text-black' : 'bg-surface-50 border border-border text-text-secondary hover:text-text-primary')}>
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Controls row */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex bg-surface-card border border-border rounded-lg p-0.5">
            <button onClick={() => setView('grid')} className={cn('p-1.5 rounded', view === 'grid' ? 'bg-brand text-black' : 'text-text-muted hover:text-text-primary')}>
              <Grid size={14} />
            </button>
            <button onClick={() => setView('list')} className={cn('p-1.5 rounded', view === 'list' ? 'bg-brand text-black' : 'text-text-muted hover:text-text-primary')}>
              <List size={14} />
            </button>
          </div>
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className="select text-xs py-1.5 w-32">
            <option value="">All Status</option>
            <option value="available">Available</option>
            <option value="unavailable">Unavailable</option>
            <option value="archived">Archived (deleted)</option>
          </select>
          <div className="flex-1 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input value={search} onChange={e => setSearch(e.target.value)} className="input pl-8" placeholder="Search menu items..." />
          </div>
          <select className="select text-xs py-1.5 w-40">
            <option>Sort by: Name (A-Z)</option>
            <option>Sort by: Price</option>
            <option>Sort by: Category</option>
          </select>
        </div>

        {/* Items */}
        {loading ? <LoadingPage /> : view === 'grid' ? (
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {items.map(item => (
                <div key={item.id} className="card overflow-hidden group hover:border-brand/30 transition-all">
                  <div className="relative aspect-video bg-surface-50">
                    <img
                      src={resolveMenuImage(item.image_url, item.name)}
                      alt={item.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={e => { (e.target as HTMLImageElement).src = menuImagePlaceholder(item.name); }}
                    />
                    {item.is_featured && <Star size={14} className="absolute top-2 left-2 text-brand fill-brand" />}
                    <button className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 bg-surface-card/80 rounded flex items-center justify-center">
                      <Star size={12} className="text-text-muted" />
                    </button>
                  </div>
                  <div className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-text-primary truncate">{item.name}</h3>
                        <p className="text-xs text-text-muted">{item.category_name}</p>
                        <p className="text-sm font-bold text-brand mt-1">{formatCurrency(item.price)}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-1.5">
                        <StatusBadge status={item.status} label={item.status === 'available' ? '● Available' : item.status} />
                        <StockBadge item={item} />
                      </div>
                      {canManage && (
                        <div className="flex gap-1">
                          <button onClick={() => openEdit(item)} className="btn-ghost p-1"><Edit2 size={12} /></button>
                          {item.status === 'archived'
                            ? <button onClick={() => restoreItem(item)} className="btn-ghost p-1 hover:text-status-success" title="Restore"><RotateCcw size={12} /></button>
                            : <button onClick={() => deleteItem(item.id)} className="btn-ghost p-1 hover:text-status-error" title="Delete"><Trash2 size={12} /></button>}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {/* Pagination */}
            <div className="flex items-center justify-between py-3 mt-4">
              <p className="text-xs text-text-muted">Showing 1 to {Math.min(page * LIMIT, total)} of {total} items</p>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(Math.ceil(total / LIMIT), 5) }, (_, i) => (
                  <button key={i+1} onClick={() => setPage(i+1)}
                    className={cn('w-7 h-7 rounded text-xs', page === i+1 ? 'bg-brand text-black font-bold' : 'btn-ghost')}>
                    {i+1}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="card flex-1 overflow-auto">
            <table className="w-full">
              <thead className="bg-surface-50 sticky top-0">
                <tr>{['Item','Category','Price','Cost','Status','Actions'].map(h => (
                  <th key={h} className="table-header px-4 py-3 text-left">{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id} className="table-row">
                    <td className="table-cell">
                      <div className="flex items-center gap-3">
                        <img src={resolveMenuImage(item.image_url, item.name)} alt={item.name} className="w-10 h-10 rounded-lg object-cover bg-surface-50" loading="lazy" onError={e => { (e.target as HTMLImageElement).src = menuImagePlaceholder(item.name); }} />
                        <div><p className="font-medium text-sm">{item.name}</p><p className="text-xs text-text-muted">{item.description?.slice(0, 40)}...</p></div>
                      </div>
                    </td>
                    <td className="table-cell text-text-muted">{item.category_name}</td>
                    <td className="table-cell font-medium text-brand">{formatCurrency(item.price)}</td>
                    <td className="table-cell text-text-muted">{formatCurrency(item.cost)}</td>
                    <td className="table-cell"><div className="flex items-center gap-1.5"><StatusBadge status={item.status} /><StockBadge item={item} /></div></td>
                    <td className="table-cell">
                      {canManage && (
                        <div className="flex gap-1">
                          <button onClick={() => openEdit(item)} className="btn-ghost p-1"><Edit2 size={13} /></button>
                          {item.status === 'archived'
                            ? <button onClick={() => restoreItem(item)} className="btn-ghost p-1 hover:text-status-success" title="Restore"><RotateCcw size={13} /></button>
                            : <button onClick={() => deleteItem(item.id)} className="btn-ghost p-1 hover:text-status-error" title="Delete"><Trash2 size={13} /></button>}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit panel */}
      {editing && (
        <div className="w-full md:w-[320px] md:shrink-0 border-t md:border-t-0 md:border-l border-border bg-surface-card flex flex-col max-h-[60vh] md:max-h-none">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h2 className="section-title">{selected ? 'Edit Menu Item' : 'Add Menu Item'}</h2>
            <button onClick={() => setEditing(false)} className="btn-ghost p-1"><X size={16} /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Image preview */}
            <div className="aspect-video bg-surface-50 rounded-lg overflow-hidden relative">
              <img
                src={resolveMenuImage(formData.image_url, formData.name)}
                alt="Preview"
                className="w-full h-full object-cover"
                onError={e => { (e.target as HTMLImageElement).src = menuImagePlaceholder(formData.name); }}
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handleImageSelected}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute bottom-2 right-2 btn-secondary text-xs py-1 flex items-center gap-1.5"
              >
                {uploading
                  ? <><div className="w-3 h-3 border-2 border-text-muted/40 border-t-text-primary rounded-full animate-spin" /> Uploading…</>
                  : <>📷 {formData.image_url ? 'Change Image' : 'Upload Image'}</>}
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Name *</label>
              <input value={formData.name} onChange={e => setFormData(p => ({...p, name: e.target.value}))} className="input" placeholder="Item name" />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Category *</label>
              <select value={formData.category_id} onChange={e => setFormData(p => ({...p, category_id: e.target.value}))} className="select">
                <option value="">Select category</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Price (KES) *</label>
                <input type="number" value={formData.price} onChange={e => setFormData(p => ({...p, price: +e.target.value}))} className="input" />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Cost (KES)</label>
                <input type="number" value={formData.cost} onChange={e => setFormData(p => ({...p, cost: +e.target.value}))} className="input" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Prep Time (mins)</label>
                <input type="number" value={formData.preparation_time} onChange={e => setFormData(p => ({...p, preparation_time: +e.target.value}))} className="input" />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Status</label>
                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={() => setFormData(p => ({...p, status: p.status === 'available' ? 'unavailable' : 'available'}))}
                    className={`w-10 h-5 rounded-full transition-colors relative ${formData.status === 'available' ? 'bg-status-success' : 'bg-surface-50'}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${formData.status === 'available' ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                  <span className="text-xs text-text-secondary capitalize">{formData.status}</span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Barcode (optional)</label>
              <input value={formData.barcode} onChange={e => setFormData(p => ({...p, barcode: e.target.value}))} className="input" placeholder="Scan or type a barcode to link it to this item" />
              <p className="text-[11px] text-text-muted mt-1">Lets a USB barcode scanner add this item directly at POS via the Scan button.</p>
            </div>

            {/* Countable stock — for pre-made finished goods sold as whole
                units (chapati, samosa, soda) rather than dishes cooked from
                a recipe. Separate from Inventory's ingredient tracking. */}
            <div className="border border-border rounded-lg p-3 bg-surface-50/50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-text-primary">Track countable stock</p>
                  <p className="text-[11px] text-text-muted mt-0.5">For pre-made units — chapati, samosa, soda. POS will alert when low or out.</p>
                </div>
                <button
                  onClick={() => setFormData(p => ({ ...p, track_stock: !p.track_stock }))}
                  className={`w-10 h-5 rounded-full transition-colors relative shrink-0 ml-3 ${formData.track_stock ? 'bg-status-success' : 'bg-surface-50 border border-border'}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${formData.track_stock ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
              {formData.track_stock && (
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">Units in stock</label>
                    <input
                      type="number" min={0} step={1}
                      value={formData.stock_quantity}
                      onChange={e => setFormData(p => ({ ...p, stock_quantity: Math.max(0, Math.round(+e.target.value)) }))}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">Low-stock alert at</label>
                    <input
                      type="number" min={0} step={1}
                      value={formData.reorder_level}
                      onChange={e => setFormData(p => ({ ...p, reorder_level: Math.max(0, Math.round(+e.target.value)) }))}
                      className="input"
                    />
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Description</label>
              <textarea value={formData.description} onChange={e => setFormData(p => ({...p, description: e.target.value}))} className="input" rows={3} placeholder="Item description..." />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Or paste an image URL</label>
              <input value={formData.image_url} onChange={e => setFormData(p => ({...p, image_url: e.target.value}))} className="input" placeholder="https://..." />
            </div>

            <div>
              <p className="text-xs text-text-muted mb-1">Add-ons & Modifiers <button className="text-brand">View / Manage</button></p>
            </div>
          </div>

          <div className="p-4 border-t border-border flex gap-3">
            <button onClick={() => setEditing(false)} className="btn-secondary flex-1">Cancel</button>
            <button onClick={saveItem} disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
              {saving && <div className="w-3 h-3 border-2 border-black/30 border-t-black rounded-full animate-spin" />}
              Save Changes
            </button>
          </div>
        </div>
      )}
    </div>
  );
}