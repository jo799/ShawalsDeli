import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { AuthBootstrap } from '@/components/AuthBootstrap';
import AppLayout from '@/components/layout/AppLayout';
import LoginPage from '@/pages/LoginPage';
import DashboardPage from '@/pages/DashboardPage';
import POSPage from '@/pages/POSPage';
import OrdersPage from '@/pages/OrdersPage';
import KitchenPage from '@/pages/KitchenPage';
import TablesPage from '@/pages/TablesPage';
import MenuPage from '@/pages/MenuPage';
import InventoryPage from '@/pages/InventoryPage';
import PurchasesPage from '@/pages/PurchasesPage';
import CustomersPage from '@/pages/CustomersPage';
import LoyaltyPage from '@/pages/LoyaltyPage';
import ReportsPage from '@/pages/ReportsPage';
import StaffPage from '@/pages/StaffPage';
import SchedulingPage from '@/pages/SchedulingPage';
import SettingsPage from '@/pages/SettingsPage';
import { ExpensesPage } from '@/pages/OtherPages';
import type { Permission } from '@shared/permissions';
import { getDefaultRouteForRole } from '@shared/permissions';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30000 } }
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function RoleRoute({ permission, children }: { permission: Permission; children: React.ReactNode }) {
  const { isAuthenticated, user, hasPermission } = useAuthStore();

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  if (!hasPermission(permission)) {
    const fallback = getDefaultRouteForRole(user?.role);
    if (fallback !== '/login') {
      toast.error('You do not have permission to access that page');
      return <Navigate to={fallback} replace />;
    }
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthBootstrap>
          <Toaster
            position="top-right"
            toastOptions={{
              style: { background: '#1E1E1E', color: '#F5F5F5', border: '1px solid #2A2A2A' },
              success: { iconTheme: { primary: '#10B981', secondary: '#1E1E1E' } },
              error: { iconTheme: { primary: '#EF4444', secondary: '#1E1E1E' } },
            }}
          />
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route index element={<RoleRoute permission="dashboard.view"><DashboardPage /></RoleRoute>} />
              <Route path="pos" element={<RoleRoute permission="pos.view"><POSPage /></RoleRoute>} />
              <Route path="orders" element={<RoleRoute permission="orders.view"><OrdersPage /></RoleRoute>} />
              <Route path="kitchen" element={<RoleRoute permission="kitchen.view"><KitchenPage /></RoleRoute>} />
              <Route path="tables" element={<RoleRoute permission="tables.view"><TablesPage /></RoleRoute>} />
              <Route path="menu" element={<RoleRoute permission="menu.view"><MenuPage /></RoleRoute>} />
              <Route path="inventory" element={<RoleRoute permission="inventory.view"><InventoryPage /></RoleRoute>} />
              <Route path="purchases" element={<RoleRoute permission="purchases.view"><PurchasesPage /></RoleRoute>} />
              <Route path="customers" element={<RoleRoute permission="customers.view"><CustomersPage /></RoleRoute>} />
              <Route path="loyalty" element={<RoleRoute permission="loyalty.view"><LoyaltyPage /></RoleRoute>} />
              <Route path="credits" element={<Navigate to="/customers" replace />} />
              <Route path="reports" element={<RoleRoute permission="reports.view"><ReportsPage /></RoleRoute>} />
              <Route path="expenses" element={<RoleRoute permission="expenses.manage"><ExpensesPage /></RoleRoute>} />
              <Route path="staff" element={<RoleRoute permission="staff.view"><StaffPage /></RoleRoute>} />
              <Route path="scheduling" element={<RoleRoute permission="scheduling.view"><SchedulingPage /></RoleRoute>} />
              <Route path="settings" element={<RoleRoute permission="settings.view"><SettingsPage /></RoleRoute>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </AuthBootstrap>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
