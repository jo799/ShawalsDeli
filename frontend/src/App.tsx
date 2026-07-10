import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import AppLayout from '@/components/layout/AppLayout';
import LoginPage from '@/pages/LoginPage';
import SignupPage from '@/pages/SignupPage';
import ForgotPasswordPage from '@/pages/ForgotPasswordPage';
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

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30000 } }
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            style: { background: 'rgb(var(--color-surface-card))', color: 'rgb(var(--color-text-primary))', border: '1px solid rgb(var(--color-border))' },
            success: { iconTheme: { primary: '#10B981', secondary: '#1E1E1E' } },
            error: { iconTheme: { primary: '#EF4444', secondary: '#1E1E1E' } },
          }}
        />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            <Route index element={<DashboardPage />} />
            <Route path="pos" element={<POSPage />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="kitchen" element={<KitchenPage />} />
            <Route path="tables" element={<TablesPage />} />
            <Route path="menu" element={<MenuPage />} />
            <Route path="inventory" element={<InventoryPage />} />
            <Route path="purchases" element={<PurchasesPage />} />
            <Route path="customers" element={<CustomersPage />} />
            <Route path="loyalty" element={<LoyaltyPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="expenses" element={<ExpensesPage />} />
            <Route path="staff" element={<StaffPage />} />
            <Route path="scheduling" element={<SchedulingPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}