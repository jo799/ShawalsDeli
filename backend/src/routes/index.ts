import { Router } from 'express';
import { login, getProfile, changePassword } from '../controllers/authController';
import { getOrders, getOrderById, createOrder, updateOrderStatus, processPayment, cancelPendingPayment, refundOrder, voidOrder, getOrderStats } from '../controllers/ordersController';
import { getMenuItems, getCategories, createMenuItem, updateMenuItem, deleteMenuItem, getRecipe, setRecipe } from '../controllers/menuController';
import { uploadMenuImage } from '../controllers/uploadController';
import { getInventory, adjustStock, createInventoryItem, updateInventoryItem, deleteInventoryItem, getInventoryActivity, getLowStock } from '../controllers/inventoryController';
import { getCustomers, getCustomerById, createCustomer, updateCustomer } from '../controllers/customersController';
import { getDailyReport, getWeeklyReport, getMonthlyReport } from '../controllers/reportsController';
import { getExpenses, createExpense, updateExpense, deleteExpense, getExpenseCategories } from '../controllers/expensesController';
import { getStaff, createStaff, updateStaff, getSchedules, upsertSchedule } from '../controllers/staffController';
import { getTables, updateTableStatus, createTable, updateTable, deleteTable, getReservations, createReservation, updateReservationStatus } from '../controllers/tablesController';
import { getPurchaseOrders, getPurchaseOrderById, createPurchaseOrder, getSuppliers } from '../controllers/purchasesController';
import { initiateStkPush, queryStkStatus, mpesaCallback, reconcilePayment } from '../controllers/mpesaController';
import { createHeldOrder, getHeldOrders, deleteHeldOrder } from '../controllers/heldOrdersController';
import { authenticate, requirePermission } from '../middleware/auth';

const router = Router();

// Auth
router.post('/auth/login', login);
router.get('/auth/profile', authenticate, getProfile);
router.put('/auth/change-password', authenticate, changePassword);

// Orders
router.get('/orders', authenticate, requirePermission('orders.view', 'orders.manage'), getOrders);
router.get('/orders/stats/active', authenticate, requirePermission('orders.view', 'orders.manage'), getOrderStats);
router.get('/orders/:id', authenticate, requirePermission('orders.view', 'orders.manage'), getOrderById);
router.post('/orders', authenticate, requirePermission('orders.manage'), createOrder);
router.put('/orders/:id/status', authenticate, requirePermission('orders.manage'), updateOrderStatus);
router.post('/orders/:id/payment', authenticate, requirePermission('orders.manage', 'pos.manage'), processPayment);
router.post('/orders/:id/cancel-payment', authenticate, requirePermission('orders.manage', 'pos.manage'), cancelPendingPayment);
router.post('/orders/:id/refund', authenticate, requirePermission('orders.refund'), refundOrder);
router.post('/orders/:id/void', authenticate, requirePermission('orders.refund'), voidOrder);

// Menu
router.get('/menu/items', authenticate, requirePermission('menu.view', 'menu.manage'), getMenuItems);
router.get('/menu/categories', authenticate, requirePermission('menu.view', 'menu.manage'), getCategories);
router.post('/menu/items', authenticate, requirePermission('menu.manage'), createMenuItem);
router.post('/menu/upload', authenticate, requirePermission('menu.manage'), uploadMenuImage);
router.put('/menu/items/:id', authenticate, requirePermission('menu.manage'), updateMenuItem);
router.delete('/menu/items/:id', authenticate, requirePermission('menu.manage'), deleteMenuItem);
router.get('/menu/items/:id/recipe', authenticate, requirePermission('menu.view', 'menu.manage'), getRecipe);
router.put('/menu/items/:id/recipe', authenticate, requirePermission('menu.manage'), setRecipe);

// Inventory
router.get('/inventory', authenticate, requirePermission('inventory.view', 'inventory.manage', 'inventory.adjust'), getInventory);
router.get('/inventory/low-stock', authenticate, requirePermission('inventory.view', 'inventory.manage', 'inventory.adjust'), getLowStock);
router.post('/inventory', authenticate, requirePermission('inventory.manage'), createInventoryItem);
router.put('/inventory/:id', authenticate, requirePermission('inventory.manage'), updateInventoryItem);
router.delete('/inventory/:id', authenticate, requirePermission('inventory.manage'), deleteInventoryItem);
router.post('/inventory/:id/adjust', authenticate, requirePermission('inventory.adjust'), adjustStock);
router.get('/inventory/activity', authenticate, requirePermission('inventory.view', 'inventory.manage', 'inventory.adjust'), getInventoryActivity);

// Customers
router.get('/customers', authenticate, requirePermission('customers.view', 'customers.manage'), getCustomers);
router.get('/customers/:id', authenticate, requirePermission('customers.view', 'customers.manage'), getCustomerById);
router.post('/customers', authenticate, requirePermission('customers.manage'), createCustomer);
router.put('/customers/:id', authenticate, requirePermission('customers.manage'), updateCustomer);

// Reports
router.get('/reports/daily', authenticate, requirePermission('reports.view'), getDailyReport);
router.get('/reports/weekly', authenticate, requirePermission('reports.view'), getWeeklyReport);
router.get('/reports/monthly', authenticate, requirePermission('reports.view'), getMonthlyReport);

// Expenses
router.get('/expenses', authenticate, requirePermission('expenses.view', 'expenses.manage'), getExpenses);
router.get('/expenses/categories', authenticate, requirePermission('expenses.view', 'expenses.manage'), getExpenseCategories);
router.post('/expenses', authenticate, requirePermission('expenses.manage'), createExpense);
router.put('/expenses/:id', authenticate, requirePermission('expenses.manage'), updateExpense);
router.delete('/expenses/:id', authenticate, requirePermission('expenses.manage'), deleteExpense);

// Staff
router.get('/staff', authenticate, requirePermission('staff.view', 'staff.manage', 'scheduling.view', 'scheduling.manage'), getStaff);
router.post('/staff', authenticate, requirePermission('staff.manage'), createStaff);
router.put('/staff/:id', authenticate, requirePermission('staff.manage'), updateStaff);
router.get('/staff/schedules', authenticate, requirePermission('scheduling.view', 'scheduling.manage'), getSchedules);
router.post('/staff/schedules', authenticate, requirePermission('scheduling.manage'), upsertSchedule);

// Tables
router.get('/tables', authenticate, requirePermission('tables.view', 'tables.manage'), getTables);
router.put('/tables/:id/status', authenticate, requirePermission('tables.manage'), updateTableStatus);
router.post('/tables', authenticate, requirePermission('tables.manage'), createTable);
router.put('/tables/:id', authenticate, requirePermission('tables.manage'), updateTable);
router.delete('/tables/:id', authenticate, requirePermission('tables.manage'), deleteTable);
router.get('/tables/reservations', authenticate, requirePermission('tables.view', 'tables.manage'), getReservations);
router.post('/tables/reservations', authenticate, requirePermission('tables.manage'), createReservation);
router.put('/tables/reservations/:id/status', authenticate, requirePermission('tables.manage'), updateReservationStatus);

// Held Orders
router.get('/held-orders', authenticate, requirePermission('pos.view', 'pos.manage'), getHeldOrders);
router.post('/held-orders', authenticate, requirePermission('pos.manage'), createHeldOrder);
router.delete('/held-orders/:id', authenticate, requirePermission('pos.manage'), deleteHeldOrder);

// Purchases
router.get('/purchases', authenticate, requirePermission('purchases.view', 'purchases.manage'), getPurchaseOrders);
router.get('/purchases/:id', authenticate, requirePermission('purchases.view', 'purchases.manage'), getPurchaseOrderById);
router.post('/purchases', authenticate, requirePermission('purchases.manage'), createPurchaseOrder);
router.get('/suppliers', authenticate, requirePermission('purchases.view', 'purchases.manage'), getSuppliers);

// M-Pesa
router.post('/mpesa/stk-push', authenticate, requirePermission('pos.manage'), initiateStkPush);
router.get('/mpesa/status/:checkout_request_id', authenticate, requirePermission('pos.manage'), queryStkStatus);
router.post('/mpesa/reconcile/:checkout_request_id', authenticate, requirePermission('pos.manage'), reconcilePayment);
router.post('/mpesa/callback', mpesaCallback);
router.post('/payments/mpesa/callback', mpesaCallback);

export default router;
