import { useState } from 'react';
import {
  Search, Download, BookOpen, LayoutDashboard, ShoppingCart, ClipboardList, ChefHat, Table2,
  UtensilsCrossed, Package, ShoppingBag, Users, Star, BarChart3, Receipt, UserSquare2, Calendar,
  Settings, HelpCircle, Rocket, LifeBuoy,
} from 'lucide-react';
import jsPDF from 'jspdf';

interface HelpTopic {
  title: string;
  steps?: string[];
  notes?: string[];
}

interface HelpSection {
  id: string;
  title: string;
  icon: typeof HelpCircle;
  summary: string;
  topics: HelpTopic[];
}

interface TroubleshootingEntry {
  problem: string;
  steps: string[];
}

const quickTips = [
  { label: 'Search', text: 'Type a keyword (e.g. "M-Pesa", "refund", "hold") — matching sections expand automatically.' },
  { label: 'Your access', text: 'The sidebar only shows pages your role allows. Missing a page? Ask a Manager.' },
  { label: 'Shared terminal', text: 'Use Switch User at the bottom of the sidebar to hand off without signing everyone out.' },
  { label: 'Offline PDF', text: 'Download PDF Guide for training handouts or when internet is down.' },
  { label: 'Escalate', text: 'Still stuck? Note the order # or table, screenshot the error, contact your administrator (Settings → Business).' },
];

const helpSections: HelpSection[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    icon: Rocket,
    summary: 'First-time login, navigation, and who can see what.',
    topics: [
      {
        title: 'Sign in',
        steps: [
          'Go to the login page and enter the email and password your administrator created for you.',
          'If you forgot your password, click Forgot Password and follow the email link.',
          'After a successful login you are taken to the default page for your role (see below).',
        ],
      },
      {
        title: 'Navigate the app',
        steps: [
          'Use the sidebar on the left to open each module (on phones, tap the menu icon top-left).',
          'Help is always at the bottom under SUPPORT → Help.',
          'Toggle light/dark mode from the theme switch above your name in the sidebar.',
        ],
      },
      {
        title: 'What each role can access',
        notes: [
          'Administrator / Manager — full access to all modules including Reports, Expenses, Staff, and Settings.',
          'Cashier — POS, Orders, Tables, Customers, Loyalty, Menu (view), Inventory (view), Scheduling (view).',
          'Waiter — same as Cashier but no Loyalty management or finance pages.',
          'Head Chef / Kitchen Staff — Kitchen Display, Orders, Menu and Inventory (view).',
          'Cleaner — Dashboard and Scheduling (view) only.',
        ],
      },
      {
        title: 'End or hand off your session',
        steps: [
          'Sign out — click Sign out at the bottom of the sidebar (ends your session completely).',
          'Switch User — opens the login screen for the next person without logging you out first; your session stays until someone else signs in.',
        ],
        notes: [
          'Auto-logout after inactivity is configured by your administrator in Settings → Preferences.',
        ],
      },
    ],
  },
  {
    id: 'pos',
    title: 'Point of Sale (POS)',
    icon: ShoppingCart,
    summary: 'Take orders, attach customers, and collect payment. This is the main screen for cashiers.',
    topics: [
      {
        title: 'Ring up a dine-in order',
        steps: [
          'Open POS from the sidebar.',
          'Tap Dine In at the top, then Select table and pick an available table (green).',
          'Add items by tapping the menu, using the search bar, or Scan for barcode items.',
          'Optional: tap the customer area to search and attach a customer (needed for loyalty).',
          'Optional: tap Add special instructions in the cart for kitchen notes (applies to the whole order).',
          'Choose a payment method and complete checkout (see payment topics below).',
          'Print the receipt when prompted. The table turns Occupied automatically.',
        ],
      },
      {
        title: 'Ring up takeaway or delivery',
        steps: [
          'Open POS and select Takeaway or Delivery at the top (no table required).',
          'Add items to the cart, attach a customer if needed, then checkout.',
          'Takeaway/delivery orders move to Completed automatically once fully paid.',
        ],
      },
      {
        title: 'Pay with cash or till',
        steps: [
          'With items in the cart, tap Cash or Till (availability depends on Settings → POS).',
          'For cash, enter the tender amount if you need change calculated.',
          'Confirm — the order is created and payment recorded in one step.',
        ],
      },
      {
        title: 'Pay with card (Visa / Mastercard via Pesapal)',
        steps: [
          'Tap Card at checkout (requires internet).',
          'A secure Pesapal payment page opens on the same screen — hand the device to the customer to enter their card details there.',
          'The screen automatically updates once the customer finishes; no manual confirmation step needed.',
        ],
        notes: [
          'If the customer needs to step away, tap Close to cancel — nothing is charged unless the customer actually completes the card page.',
        ],
      },
      {
        title: 'Pay with M-Pesa (STK Push)',
        steps: [
          'Tap M-Pesa at checkout (requires internet).',
          'Enter the customer\'s Safaricom number (format 07… or 254…).',
          'The customer receives a prompt on their phone — they must enter their M-Pesa PIN.',
          'Wait on the confirmation screen. Do not close the browser tab while waiting.',
          'On success the order confirms and a receipt can be printed. On failure you can retry or switch to Cash.',
        ],
        notes: [
          'If a push is stuck, open the order in Orders and cancel the pending payment before trying again.',
        ],
      },
      {
        title: 'Split the bill',
        steps: [
          'Tap Split Bill at checkout (requires internet).',
          'Choose how many people are sharing (2, 3, 4, …).',
          'The system divides the total; pay each person\'s share with Cash, Card, Till, or M-Pesa.',
          'Repeat until the full balance is cleared.',
        ],
      },
      {
        title: 'Redeem loyalty points',
        steps: [
          'Attach a customer who has available points before checkout.',
          'Tap Points as the payment method (shown only when the customer has a balance).',
          'Enter how many points to redeem — the KES value is shown before you confirm.',
          'Pay any remaining balance with another method if the points do not cover the full total.',
        ],
        notes: [
          'Toggle whether this sale should award new points before checkout (customer must be attached).',
        ],
      },
      {
        title: 'Hold or save a cart',
        steps: [
          'Build the cart as normal, then tap Hold Order (anonymous) or Save Draft (optional name).',
          'The cart clears so you can serve the next customer.',
          'To resume: tap Held in the POS header, pick the saved cart, and continue.',
          'After checkout, delete the held entry if it still appears in the list.',
        ],
      },
      {
        title: 'Scan barcodes',
        steps: [
          'Tap Scan in the POS header.',
          'Point a USB barcode scanner at the field (or type the code manually) and press Enter.',
          'The matching menu item is added to the cart. Barcodes are set up in Menu → edit item → Barcode.',
        ],
      },
      {
        title: 'Mobile layout',
        steps: [
          'On a phone the cart is hidden behind a floating Cart bar at the bottom.',
          'Tap Cart to open the full-screen cart sheet (~92% of the screen).',
          'Checkout buttons sit inside that sheet — scroll if needed on small screens.',
        ],
      },
      {
        title: 'Offline mode',
        steps: [
          'When the offline banner appears, only Cash checkout works.',
          'Sales queue on the device and sync when connection returns.',
          'Do not use M-Pesa, Split Bill, or Points until you are back online.',
        ],
        notes: [
          'Prices are always taken from the server at checkout — menu changes apply even if the cart looked stale.',
          'No VAT or service charge is added; customers pay menu prices as listed.',
        ],
      },
    ],
  },
  {
    id: 'orders',
    title: 'Orders Management',
    icon: ClipboardList,
    summary: 'Find orders, update status, handle payments, and issue refunds.',
    topics: [
      {
        title: 'Find an order',
        steps: [
          'Open Orders from the sidebar.',
          'Use the status tabs (New, Preparing, Ready, Completed, etc.) or the search box.',
          'Filter by date range or order type if needed.',
          'Click a row to open the detail panel on the right.',
        ],
      },
      {
        title: 'Move an order through service',
        steps: [
          'Open the order in the detail panel.',
          'Use the status buttons: New → Preparing → Ready → Completed.',
          'For dine-in: the order must be fully paid before you can mark it Completed (that frees the table).',
          'For takeaway/delivery: marking Completed usually happens automatically when payment clears.',
        ],
      },
      {
        title: 'Cancel an order',
        steps: [
          'Open the order and set status to Cancelled.',
          'If an M-Pesa push is still pending, cancel the payment first from the order detail.',
          'Cancelled orders restock ingredients if they had already been deducted.',
          'The linked table (if any) is freed automatically.',
        ],
      },
      {
        title: 'Issue a refund',
        steps: [
          'Open a paid order — the Refund button appears for administrators, managers, and cashiers.',
          'Enter the refund amount (cannot exceed what was paid) and a reason (required).',
          'Tick Restock if ingredients should go back into inventory.',
          'Administrators submit the refund directly — it processes immediately.',
          'Managers and cashiers instead submit a request; nothing is refunded yet until an administrator approves it.',
        ],
      },
      {
        title: 'Review refund requests (Administrator)',
        steps: [
          'Open Orders → Refund Requests (badge shows how many are waiting).',
          'Review the amount, reason, and who requested it.',
          'Approve to actually process the refund, or Decline with an optional reason shown back to the requester.',
        ],
        notes: [
          'Enable phone alerts from the same panel to get a notification the moment a new request comes in.',
        ],
      },
      {
        title: 'Order statuses explained',
        notes: [
          'Awaiting Payment — M-Pesa STK push sent, waiting for customer PIN.',
          'New — confirmed order, kitchen can start.',
          'Preparing — kitchen is working on it.',
          'Ready — food is plated, waiting to be served or collected.',
          'Completed — closed out; dine-in table released if paid.',
          'Cancelled — voided; no further payment expected.',
          'Refunded — shown instead of Cancelled specifically when money was actually returned, so the two are never confused.',
        ],
      },
    ],
  },
  {
    id: 'kitchen',
    title: 'Kitchen Display',
    icon: ChefHat,
    summary: 'Kanban board for the line — see what to cook and when.',
    topics: [
      {
        title: 'Work the board',
        steps: [
          'Open Kitchen Display from the sidebar (large screen recommended).',
          'New orders appear in the left column.',
          'Click Start Preparing when you begin an order — it moves to the middle column.',
          'Click Mark Ready when plated — it moves to the right column.',
          'Waiters or cashiers mark Completed from the Orders page once served and paid.',
        ],
      },
      {
        title: 'Read an order card',
        notes: [
          'Table number shows for dine-in; takeaway/delivery show order type instead.',
          'Each line lists item name, quantity, and any special instructions.',
          'Time badges show how long the order has been in its current status (not just since it was placed).',
          'If a chef has started or been assigned to an order, their name shows on the card.',
        ],
      },
      {
        title: 'Assign an order to a chef (Administrator)',
        steps: [
          'On an unattended order in the New column, tap Assign to chef.',
          'Pick a chef from the list — they get a phone notification if they have alerts enabled.',
          'The order stays in New; the chef still needs to tap Start Preparing themselves.',
          'Already assigned? Tap Reassign to pick someone else instead.',
        ],
        notes: [
          'Once assigned, only that chef (or an administrator/manager) can tap Start Preparing on it — this stops two people from grabbing the same order.',
        ],
      },
      {
        title: 'Sound alerts',
        steps: [
          'Toggle Sound on in the kitchen header.',
          'A chime plays when a new order lands in the New column.',
        ],
        notes: [
          'Orders in Awaiting Payment (unpaid M-Pesa) do not appear here until payment confirms.',
        ],
      },
      {
        title: 'Phone alerts',
        steps: [
          'Tap Enable phone alerts in the kitchen header.',
          'Allow notifications when your browser/phone prompts you.',
          'You\'ll now get a real phone notification for new orders even if this tab isn\'t open.',
        ],
        notes: [
          'This is separate from Sound — Sound only plays while this page is open in front of you.',
        ],
      },
    ],
  },
  {
    id: 'tables',
    title: 'Table Management',
    icon: Table2,
    summary: 'Floor plan, reservations, and table status at a glance.',
    topics: [
      {
        title: 'Read the floor plan',
        notes: [
          'Available — green: empty, ready for guests.',
          'Occupied — red: active order linked.',
          'Reserved — yellow: upcoming reservation.',
          'Cleaning — purple: being reset, not for seating yet.',
        ],
        steps: [
          'Switch Grid or List view and filter by area if you have multiple sections.',
          'Click a table to open the detail panel on the right.',
        ],
      },
      {
        title: 'Start an order from a table',
        steps: [
          'Select the table → tap Add Order.',
          'You are sent to POS — pick Dine In and the same table if not pre-selected.',
          'Checkout as normal; the table becomes Occupied.',
        ],
      },
      {
        title: 'Free a table manually',
        steps: [
          'Select an Occupied table → tap Close Table.',
          'The table turns Available but the open order is NOT cancelled — check Orders if money is still owed.',
          'Prefer marking the order Completed from Orders once fully paid (automatically frees the table).',
        ],
      },
      {
        title: 'Create a reservation',
        steps: [
          'Tap Add Reservation (or from the selected table panel).',
          'Enter customer name, party size, date/time, and optional notes.',
          'Save — the table shows Reserved when the slot is active.',
          'Update or cancel reservations from the Reservations list.',
        ],
      },
      {
        title: 'Add or edit tables (Admin / Manager)',
        steps: [
          'Use Add Table to create a new table number, area, and capacity.',
          'Edit or retire tables from the table management actions.',
          'Retired tables disappear from the floor plan but history is preserved.',
        ],
      },
      {
        title: 'Coming soon',
        notes: [
          'Transfer Table and Merge Table buttons are placeholders — use Orders and POS for now.',
          'Split Bill is done from POS checkout, not from this page.',
        ],
      },
    ],
  },
  {
    id: 'dashboard',
    title: 'Dashboard',
    icon: LayoutDashboard,
    summary: 'The 10-number business health check, plus today\'s operational snapshot.',
    topics: [
      {
        title: 'Business Health — read the whole business in 30 seconds',
        notes: [
          'Revenue Today and Gross Profit / Net Profit today — the full chain from sales down to actual bottom line.',
          'Cash Position today — real money collected today minus today\'s expenses and any purchase paid in full today.',
          'Inventory Value — what\'s on the shelf right now, valued at current cost.',
          'Purchases and Expenses — both scoped to this month, not just today.',
          'Food Cost % — cost of goods sold as a share of net sales; the standard restaurant efficiency number.',
          'Waste Cost — the cost impact of everything logged as waste/spoilage this month.',
          'Top Profitable Item — sorted by actual profit contributed this month, not by how much it sold for — a high-margin item that rarely sells can lose to a lower-margin one sold in volume.',
        ],
      },
      {
        title: 'Use the rest of the dashboard',
        steps: [
          'Scroll past Business Health for today\'s order count, active customers, and quick-link cards.',
          'Review recent orders and the sales trend chart further down.',
          'Click a quick-link card to jump to POS, Orders, Kitchen, etc.',
        ],
        notes: [
          'Numbers refresh when you reload the page — use Reports for date ranges and printing.',
        ],
      },
    ],
  },
  {
    id: 'menu',
    title: 'Menu Management',
    icon: UtensilsCrossed,
    summary: 'Categories, items, prices, photos, and barcodes.',
    topics: [
      {
        title: 'Add a menu item',
        steps: [
          'Open Menu → tap Add Item.',
          'Fill in name, category, price (KES), optional cost and prep time.',
          'Upload a photo; set status to Available or Unavailable.',
          'Save — the item appears on POS after the next menu refresh.',
        ],
      },
      {
        title: 'Enable barcode scanning at POS',
        steps: [
          'Edit the menu item → Barcode field.',
          'Enter or scan the product barcode and save.',
          'At POS, use Scan — the item adds to cart when the code matches.',
        ],
      },
      {
        title: 'Track pre-made stock (chapati, drinks, etc.)',
        steps: [
          'Edit the item → enable Track countable stock.',
          'Set units in stock and the low-stock alert level.',
          'POS warns cashiers when count is low or zero.',
        ],
        notes: [
          'For cooked dishes, link ingredients in Inventory instead — sales deduct recipe items automatically.',
        ],
      },
      {
        title: 'Hide an item temporarily',
        steps: [
          'Edit the item → toggle status to Unavailable.',
          'It disappears from POS but stays in the menu for later.',
        ],
      },
    ],
  },
  {
    id: 'inventory',
    title: 'Inventory Management',
    icon: Package,
    summary: 'Ingredient stock, adjustments, and automatic deduction from sales.',
    topics: [
      {
        title: 'Add an inventory item',
        steps: [
          'Open Inventory → Add Item.',
          'Enter name, unit (kg, L, pcs, etc.), starting quantity, and minimum level.',
          'Save — low-stock alerts appear when quantity falls below minimum.',
        ],
      },
      {
        title: 'Adjust stock (the correct way)',
        steps: [
          'Find the item → tap Adjust Stock (not the edit form).',
          'Enter the change (+10 received, −2 wasted, etc.) and a note.',
          'Submit — quantity updates and a transaction log entry is created.',
        ],
        notes: [
          'Editing the item form changes name/unit only — never silently changes stock count.',
        ],
      },
      {
        title: 'Link a menu item to ingredients',
        steps: [
          'From Inventory or Menu, open the recipe/link editor for a menu dish.',
          'Add each ingredient and quantity used per serving.',
          'When POS sells that dish, ingredients deduct automatically (once the order is confirmed/paid).',
        ],
      },
      {
        title: 'Review history',
        steps: [
          'Open an item\'s activity/transaction history to see every adjustment and sale deduction.',
          'Each row shows who made the change and when, with a clear reason underneath.',
          'Administrators and managers can click a reason to edit or add one after the fact.',
        ],
        notes: [
          'Entries now show a plain-language reason instead of a generic "Adjustment" — Kitchen Consumption (a sale deducted it), Purchase Received, Stock Count Variance, Waste / Spoilage, Stock Transfer, or Order Cancelled (Restocked).',
        ],
      },
    ],
  },
  {
    id: 'purchases',
    title: 'Purchase Orders',
    icon: ShoppingBag,
    summary: 'Order from suppliers and receive goods into inventory.',
    topics: [
      {
        title: 'Create a purchase order',
        steps: [
          'Open Purchases → New Purchase Order.',
          'Select supplier, expected delivery date, and add line items (inventory item, qty, unit cost).',
          'Save as Draft while still editing, or mark Pending when sent to the supplier.',
        ],
      },
      {
        title: 'Receive a delivery',
        steps: [
          'Open the PO from the list → Receive Delivery.',
          'Enter the quantity actually received for each line (can be partial).',
          'Confirm — inventory increases automatically and status becomes Partially Received or Received.',
        ],
        notes: [
          'If a line was for something not yet in Inventory, receiving it creates that inventory item automatically rather than losing the stock — later deliveries of the same line credit that same item.',
        ],
      },
      {
        title: 'Track payment status (Administrator / Manager)',
        steps: [
          'Open the PO detail panel.',
          'Change Payment Status to Unpaid, Partial, or Paid as you actually pay the supplier.',
        ],
        notes: [
          'This matters beyond bookkeeping — Cash Position on the Dashboard only counts a purchase as money out once it\'s marked Paid.',
        ],
      },
      {
        title: 'Download a financial summary',
        steps: [
          'Click Financial Summary in the header and pick Today, This Week, This Month, or This Year.',
          'Downloads a real Excel file with three sheets: a Sales → Expenses → Net Profit summary, an itemized Expenses list, and an itemized Purchases list for that period.',
        ],
        notes: [
          'The same button and file are available from the Expenses page too — it\'s the same report either way.',
        ],
      },
      {
        title: 'PO statuses',
        notes: [
          'Draft — still being edited.',
          'Pending — sent, awaiting delivery.',
          'Partially Received — some lines received, more expected.',
          'Received — all lines fully received.',
          'Cancelled — order voided.',
        ],
      },
    ],
  },
  {
    id: 'customers',
    title: 'Customer Management',
    icon: Users,
    summary: 'Customer profiles, VIP flag, and order history.',
    topics: [
      {
        title: 'Add a customer',
        steps: [
          'Open Customers → Add Customer.',
          'Enter name, phone (recommended for M-Pesa and loyalty), email optional.',
          'Save — search for them at POS when attaching to a sale.',
        ],
      },
      {
        title: 'Mark VIP',
        steps: [
          'Open the customer profile → toggle VIP Customer.',
          'VIP badge shows at POS and in the customer list.',
        ],
      },
      {
        title: 'View history and loyalty',
        steps: [
          'Select a customer to see past orders and current points balance.',
          'Use Loyalty page for detailed point adjustments across all members.',
        ],
      },
    ],
  },
  {
    id: 'loyalty',
    title: 'Loyalty Program',
    icon: Star,
    summary: 'Points earning, redemption, tiers, and point value.',
    topics: [
      {
        title: 'How customers earn points',
        notes: [
          '1 point per KES 100 spent when the order is fully paid and completed.',
          'Points are not earned on the portion of a bill paid with redeemed points.',
          'Customer must be attached to the order at POS; toggle award points on before checkout.',
        ],
      },
      {
        title: 'Redeem at POS',
        steps: [
          'Attach customer → choose Points payment → enter points to use.',
          'Remaining balance (if any) paid with cash, M-Pesa, etc.',
        ],
      },
      {
        title: 'Manual adjust or redeem (staff)',
        steps: [
          'Open Loyalty → find the member → Adjust or Redeem.',
          'Enter points and optional reason → confirm.',
        ],
      },
      {
        title: 'Set point value (Admin / Manager)',
        steps: [
          'On Loyalty page → edit KES per point (e.g. 1 point = KES 1).',
          'This rate applies everywhere points show as a money value.',
        ],
      },
      {
        title: 'Tiers',
        notes: [
          'Bronze, Silver, Gold tiers are based on lifetime points — thresholds shown on the Loyalty page.',
          'Tiers are informational; discounts are not applied automatically at checkout unless configured in tier benefits.',
        ],
      },
    ],
  },
  {
    id: 'reports',
    title: 'Reports & Analytics',
    icon: BarChart3,
    summary: 'Sales analysis, top items, and printable summaries.',
    topics: [
      {
        title: 'Run a report',
        steps: [
          'Open Reports from the sidebar.',
          'Pick Today, This Week, This Month, or Custom range.',
          'Wait for charts and tables to load.',
        ],
      },
      {
        title: 'Print a report',
        steps: [
          'With data loaded, click Print.',
          'Wait for "Preparing report" to finish if the button was disabled.',
          'The browser print dialog opens a clean A4 layout (not the live dashboard).',
        ],
      },
      {
        title: 'What the report includes',
        notes: [
          'A full breakdown from Total Sales down to Net Profit — Discounts, Net Sales, Cost of Goods Sold, Gross Profit, Operating Expenses, then Net Profit and both margins.',
          'Payment method breakdown (Cash, M-Pesa, Card, etc.).',
          'Top-selling items and categories for the selected period.',
        ],
      },
      {
        title: 'Export sales items to Excel',
        steps: [
          'Click Sales Items in the header and pick Today, This Week, This Month, or This Year.',
          'Downloads a real Excel file: a line-by-line Sales Detail sheet (item, amount, time, who sold it, payment method) and a Summary by Item sheet showing what actually sold best.',
        ],
      },
    ],
  },
  {
    id: 'expenses',
    title: 'Expense Tracking',
    icon: Receipt,
    summary: 'Record costs, attach receipts, and track budgets.',
    topics: [
      {
        title: 'Record an expense',
        steps: [
          'Open Expenses → Add Expense.',
          'Choose category, enter amount, date, and reference number.',
          'Save.',
        ],
      },
      {
        title: 'Attach a receipt photo',
        steps: [
          'From the expense list or detail panel, click Upload receipt.',
          'Select an image file — it links to that expense row.',
          'Click the file icon later to view it.',
        ],
      },
      {
        title: 'Download a financial summary',
        steps: [
          'Click Financial Summary in the header and pick Today, This Week, This Month, or This Year.',
          'Downloads a real Excel file with a Sales → Expenses → Net Profit summary sheet plus itemized Expenses and Purchases sheets for that period.',
        ],
      },
      {
        title: 'Budgets (Admin / Manager)',
        steps: [
          'Set a monthly budget limit per category in expense settings.',
          'The dashboard shows how many categories are over budget this month.',
        ],
      },
    ],
  },
  {
    id: 'staff',
    title: 'Staff Management',
    icon: UserSquare2,
    summary: 'User accounts, roles, approvals, and passwords.',
    topics: [
      {
        title: 'Add a staff member',
        steps: [
          'Open Staff → Add Staff.',
          'Enter name, email, phone, role, and schedule type.',
          'A temporary password is generated — share it securely with the new user.',
          'They should change it after first login (Forgot Password if needed).',
        ],
      },
      {
        title: 'Approve self-signup',
        steps: [
          'Pending requests appear at the top of the Staff page.',
          'Review details → Approve (creates active account) or Reject.',
        ],
      },
      {
        title: 'Reset a password',
        steps: [
          'Open the staff row menu → Reset Password.',
          'Enter the new password and confirm.',
        ],
      },
      {
        title: 'View role permissions',
        steps: [
          'Click Manage Roles to see which modules each role can access.',
          'This mirrors what appears in each person\'s sidebar.',
        ],
        notes: [
          'Clock-in/out, recurring days off, and sick-off requests are all on the Scheduling page, not here.',
        ],
      },
    ],
  },
  {
    id: 'scheduling',
    title: 'Staff Scheduling',
    icon: Calendar,
    summary: 'Weekly shift grid, clock in/out, recurring days off, and sick-off requests.',
    topics: [
      {
        title: 'Clock in and out',
        steps: [
          'Open Scheduling — every staff member sees a Clock In/Out card at the top, regardless of role.',
          'Tap Check In when your shift starts, Check Out when it ends.',
          'Your status for today shows right there — you can\'t check in twice or check out before checking in.',
        ],
      },
      {
        title: 'Build the week',
        steps: [
          'The grid shows staff rows and day columns.',
          'Click a cell → pick morning, day, evening, night, or off.',
          'Use Add Shift for one-off entries with a specific date.',
        ],
      },
      {
        title: 'Set a recurring day off (Administrator / Manager)',
        steps: [
          'Under a staff member\'s name, click the "No recurring day off" (or current setting) line.',
          'Pick a day of the week — done once, it applies every week from then on.',
          'Change it any time the same way; pick "No recurring day off" to clear it.',
        ],
        notes: [
          'A specific date already scheduled (someone covering that day, or an approved sick-off day) always overrides the recurring default for that one day.',
        ],
      },
      {
        title: 'Request a sick-off day',
        steps: [
          'Click Request Sick Off in the header.',
          'Pick the date, write a short message explaining the request, and optionally upload a hospital note/receipt.',
          'Submit — an administrator is notified and will approve or decline it.',
          'Check My Requests any time to see the status of everything you\'ve submitted, including any decline reason.',
        ],
        notes: [
          'No receipt yet? Submit without one — you can still track the request in My Requests while you sort it out.',
        ],
      },
      {
        title: 'Review sick-off requests (Administrator)',
        steps: [
          'Click Sick-Off Requests in the header (badge shows how many are pending).',
          'Read the message and view the uploaded receipt if there is one.',
          'Approve — this automatically marks that day off in the schedule grid, no extra step needed.',
          'Or Decline, optionally with a reason shown back to the requester.',
        ],
        notes: [
          'Enable alerts from the same header to get a phone notification the moment a new request comes in.',
        ],
      },
      {
        title: 'Copy last week',
        steps: [
          'Click Copy from last week.',
          'Shifts duplicate forward; already-filled cells are skipped.',
        ],
      },
      {
        title: 'Shift times',
        notes: [
          'Morning — 6:00 AM – 2:00 PM',
          'Day — 8:00 AM – 4:00 PM',
          'Evening — 11:00 AM – 7:00 PM',
          'Night — 3:00 PM – 11:00 PM',
          'Off — not scheduled',
        ],
      },
    ],
  },
  {
    id: 'settings',
    title: 'System Settings',
    icon: Settings,
    summary: 'Business details, POS options, M-Pesa, audit log (Admin / Manager).',
    topics: [
      {
        title: 'Business information',
        steps: [
          'Settings → Business tab.',
          'Update restaurant name, address, phone, email, website, KRA Tax PIN.',
          'Save — details can appear on receipts and reports.',
        ],
        notes: [
          'Tax PIN is for receipt header only — the system does not calculate VAT or service charge on bills.',
        ],
      },
      {
        title: 'POS payment options',
        steps: [
          'Settings → POS tab.',
          'Toggle Cash, M-Pesa, Card, Till, and loyalty redemption on or off.',
          'Set the default payment method for new checkouts.',
        ],
      },
      {
        title: 'M-Pesa setup',
        steps: [
          'Settings → M-Pesa tab (administrator).',
          'Enter Safaricom consumer key, secret, shortcode, and passkey from your Daraja portal.',
          'Save and test with a small STK push from POS.',
        ],
      },
      {
        title: 'Security preferences',
        steps: [
          'Settings → Preferences.',
          'Set auto-logout duration, confirm-before-delete, OTP login, kitchen SMS alerts.',
        ],
      },
      {
        title: 'Audit log',
        steps: [
          'Settings → Audit Log tab.',
          'Filter by action type or date range.',
          'Review who logged in, took payments, changed stock, edited staff, etc.',
        ],
      },
    ],
  },
];

const troubleshootingEntries: TroubleshootingEntry[] = [
  {
    problem: 'M-Pesa STK push never arrives on the customer\'s phone',
    steps: [
      'Confirm the phone number is Safaricom and correctly formatted.',
      'Ask the customer to check network and prompt notifications.',
      'Wait 30 seconds, then retry once.',
      'If still failing, use Cash and contact admin to verify M-Pesa credentials in Settings.',
    ],
  },
  {
    problem: 'Customer paid M-Pesa but order still shows unpaid',
    steps: [
      'Refresh the Orders page — callbacks can take a few seconds.',
      'Open the order and check the payments list for a completed M-Pesa row.',
      'If missing after 2 minutes, note the M-Pesa confirmation code and contact your administrator.',
    ],
  },
  {
    problem: 'Table shows Occupied but customers have left',
    steps: [
      'Tables → select the table → Close Table to clear the visual status.',
      'Open Orders → find the linked order — mark Completed if paid, or Cancelled if voiding.',
      'Do not start a new POS checkout on that table until the old order is resolved.',
    ],
  },
  {
    problem: 'Cart emptied after browser refresh',
    steps: [
      'Only Held/Draft carts and the auto-saved session draft survive refresh.',
      'Check Held in the POS header for a saved cart.',
      'Completed sales cannot be reopened into the cart — use Orders to view them.',
    ],
  },
  {
    problem: 'Offline banner — cannot use M-Pesa',
    steps: [
      'Use Cash only until the connection returns.',
      'Queued sales sync automatically when online again.',
      'Do not refresh repeatedly — let the offline indicator clear on its own.',
    ],
  },
  {
    problem: 'Page missing from sidebar or "permission denied"',
    steps: [
      'Your role may not include that module — see Getting Started → roles.',
      'Ask a Manager or Administrator to adjust your role if you need access.',
    ],
  },
  {
    problem: 'Wrong price at checkout',
    steps: [
      'The server always uses current menu prices at checkout.',
      'Refresh POS if menu was recently updated.',
      'Remove and re-add items if the cart was built before a price change.',
    ],
  },
  {
    problem: '"Start Preparing" won\'t work on an order in Kitchen Display',
    steps: [
      'Check the card — if it says "Assigned to [name]" or "Only [name] can start this", an administrator assigned it to a specific chef.',
      'Only that chef (or an administrator/manager) can start it — ask them to tap Start Preparing, or have an admin reassign it to you.',
    ],
  },
];

function sectionMatchesQuery(section: HelpSection, q: string): boolean {
  const lower = q.toLowerCase();
  if (section.title.toLowerCase().includes(lower) || section.summary.toLowerCase().includes(lower)) return true;
  return section.topics.some(t =>
    t.title.toLowerCase().includes(lower) ||
    t.steps?.some(s => s.toLowerCase().includes(lower)) ||
    t.notes?.some(n => n.toLowerCase().includes(lower))
  );
}

function topicMatchesQuery(topic: HelpTopic, q: string): boolean {
  const lower = q.toLowerCase();
  if (topic.title.toLowerCase().includes(lower)) return true;
  return !!(
    topic.steps?.some(s => s.toLowerCase().includes(lower)) ||
    topic.notes?.some(n => n.toLowerCase().includes(lower))
  );
}

function writePdfBlock(
  pdf: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  fontSize: number,
  style: 'normal' | 'bold' = 'normal'
): number {
  pdf.setFontSize(fontSize);
  pdf.setFont('helvetica', style);
  const lines = pdf.splitTextToSize(text, maxWidth);
  pdf.text(lines, x, y);
  return y + lines.length * (fontSize * 0.45);
}

export default function HelpPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSection, setExpandedSection] = useState<string | null>('getting-started');

  const q = searchQuery.trim();
  const filteredSections = q
    ? helpSections.filter(s => sectionMatchesQuery(s, q))
    : helpSections;

  const filteredTroubleshooting = q
    ? troubleshootingEntries.filter(e =>
        e.problem.toLowerCase().includes(q.toLowerCase()) ||
        e.steps.some(s => s.toLowerCase().includes(q.toLowerCase()))
      )
    : troubleshootingEntries;

  const handleDownloadPDF = () => {
    const pdf = new jsPDF();
    let y = 20;
    const pageHeight = 280;
    const margin = 20;
    const width = 170;

    const ensureSpace = (needed: number) => {
      if (y + needed > pageHeight) {
        pdf.addPage();
        y = 20;
      }
    };

    y = writePdfBlock(pdf, "Shawal's Deli — User Guide", margin, y, width, 18, 'bold');
    y += 4;
    y = writePdfBlock(pdf, 'Step-by-step guides for each module. Generated from the in-app Help Center.', margin, y, width, 10);
    y += 10;

    for (const section of helpSections) {
      ensureSpace(20);
      y = writePdfBlock(pdf, section.title, margin, y, width, 13, 'bold');
      y += 2;
      y = writePdfBlock(pdf, section.summary, margin, y, width, 9);
      y += 4;

      for (const topic of section.topics) {
        ensureSpace(14);
        y = writePdfBlock(pdf, topic.title, margin + 2, y, width - 2, 10, 'bold');
        y += 2;
        if (topic.steps) {
          topic.steps.forEach((step, i) => {
            ensureSpace(10);
            y = writePdfBlock(pdf, `${i + 1}. ${step}`, margin + 4, y, width - 4, 9);
            y += 2;
          });
        }
        if (topic.notes) {
          topic.notes.forEach(note => {
            ensureSpace(8);
            y = writePdfBlock(pdf, `• ${note}`, margin + 4, y, width - 4, 9);
            y += 2;
          });
        }
        y += 3;
      }
      y += 4;
    }

    ensureSpace(16);
    y = writePdfBlock(pdf, 'Troubleshooting', margin, y, width, 13, 'bold');
    y += 4;
    for (const entry of troubleshootingEntries) {
      ensureSpace(12);
      y = writePdfBlock(pdf, entry.problem, margin + 2, y, width - 2, 10, 'bold');
      y += 2;
      entry.steps.forEach((step, i) => {
        ensureSpace(10);
        y = writePdfBlock(pdf, `${i + 1}. ${step}`, margin + 4, y, width - 4, 9);
        y += 2;
      });
      y += 3;
    }

    ensureSpace(16);
    y = writePdfBlock(pdf, 'Quick Tips', margin, y, width, 13, 'bold');
    y += 4;
    for (const tip of quickTips) {
      ensureSpace(8);
      y = writePdfBlock(pdf, `${tip.label}: ${tip.text}`, margin + 2, y, width - 2, 9);
      y += 2;
    }

    pdf.save('shawals-deli-user-guide.pdf');
  };

  const renderTopic = (topic: HelpTopic) => (
    <div key={topic.title} className="mb-5 last:mb-0">
      <h4 className="text-sm font-semibold text-text-primary mb-2">{topic.title}</h4>
      {topic.steps && topic.steps.length > 0 && (
        <ol className="list-decimal list-outside ml-4 space-y-1.5 text-sm text-text-secondary">
          {topic.steps.map((step, i) => (
            <li key={i} className="pl-1">{step}</li>
          ))}
        </ol>
      )}
      {topic.notes && topic.notes.length > 0 && (
        <ul className={`space-y-1.5 text-sm text-text-muted ${topic.steps?.length ? 'mt-2' : ''}`}>
          {topic.notes.map((note, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="text-brand mt-0.5 shrink-0">—</span>
              <span>{note}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary mb-2">Help Center</h1>
        <p className="text-text-secondary text-sm max-w-2xl">
          Step-by-step guides for each module — not generic overviews. Expand a section below or search for a task (e.g. &ldquo;M-Pesa&rdquo;, &ldquo;refund&rdquo;, &ldquo;hold order&rdquo;).
        </p>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted w-5 h-5" />
          <input
            type="text"
            placeholder="Search by task or topic…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-surface-card border border-border rounded-xl text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand/50"
          />
        </div>
      </div>

      <div className="mb-6 flex justify-end">
        <button
          onClick={handleDownloadPDF}
          className="flex items-center gap-2 px-4 py-2 bg-brand text-black rounded-lg hover:bg-brand/90 transition-colors text-sm font-medium"
        >
          <Download size={16} />
          Download PDF Guide
        </button>
      </div>

      <div className="space-y-4">
        {filteredSections.length === 0 && filteredTroubleshooting.length === 0 ? (
          <div className="text-center py-12">
            <BookOpen className="mx-auto w-12 h-12 text-text-muted mb-4" />
            <p className="text-text-secondary">No guides found for &ldquo;{searchQuery}&rdquo;</p>
          </div>
        ) : (
          filteredSections.map((section) => {
            const Icon = section.icon;
            const searching = q.length > 0;
            const isExpanded = searching || expandedSection === section.id;
            const visibleTopics = searching
              ? section.topics.filter(t => topicMatchesQuery(t, q) || section.title.toLowerCase().includes(q.toLowerCase()))
              : section.topics;

            if (searching && visibleTopics.length === 0) return null;

            return (
              <div key={section.id} className="bg-surface-card border border-border rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => {
                    if (searching) return;
                    setExpandedSection(isExpanded && expandedSection === section.id ? null : section.id);
                  }}
                  className="w-full px-4 py-4 flex items-center justify-between hover:bg-surface-50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 bg-brand/10 rounded-lg flex items-center justify-center shrink-0">
                      <Icon size={20} className="text-brand" />
                    </div>
                    <div className="min-w-0">
                      <span className="font-medium text-text-primary block">{section.title}</span>
                      {!isExpanded && !searching && (
                        <span className="text-xs text-text-muted truncate block mt-0.5">{section.summary}</span>
                      )}
                    </div>
                  </div>
                  {!searching && (
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-transform shrink-0 ${isExpanded ? 'rotate-180' : ''}`}>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-text-muted">
                        <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  )}
                </button>

                {isExpanded && (
                  <div className="px-4 pb-5 border-t border-border pt-4">
                    <p className="text-sm text-text-muted mb-4">{section.summary}</p>
                    {visibleTopics.map(renderTopic)}
                  </div>
                )}
              </div>
            );
          })
        )}

        {(!q || filteredTroubleshooting.length > 0) && (
          <div className="bg-surface-card border border-border rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => {
                if (q) return;
                setExpandedSection(expandedSection === 'troubleshooting' ? null : 'troubleshooting');
              }}
              className="w-full px-4 py-4 flex items-center justify-between hover:bg-surface-50 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-status-error/10 rounded-lg flex items-center justify-center">
                  <LifeBuoy size={20} className="text-status-error" />
                </div>
                <div>
                  <span className="font-medium text-text-primary block">Troubleshooting</span>
                  {!q && expandedSection !== 'troubleshooting' && (
                    <span className="text-xs text-text-muted">Common problems and exact steps to fix them</span>
                  )}
                </div>
              </div>
              {!q && (
                <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-transform ${expandedSection === 'troubleshooting' ? 'rotate-180' : ''}`}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-text-muted">
                    <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              )}
            </button>

            {(q || expandedSection === 'troubleshooting') && (
              <div className="px-4 pb-5 border-t border-border pt-4 space-y-5">
                {(q ? filteredTroubleshooting : troubleshootingEntries).map(entry => (
                  <div key={entry.problem}>
                    <h4 className="text-sm font-semibold text-text-primary mb-2">{entry.problem}</h4>
                    <ol className="list-decimal list-outside ml-4 space-y-1.5 text-sm text-text-secondary">
                      {entry.steps.map((step, i) => (
                        <li key={i} className="pl-1">{step}</li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-8 p-4 bg-brand/5 border border-brand/20 rounded-xl">
        <h3 className="font-medium text-text-primary mb-3 flex items-center gap-2">
          <HelpCircle size={18} className="text-brand" />
          Quick reference
        </h3>
        <dl className="space-y-3 text-sm">
          {quickTips.map(tip => (
            <div key={tip.label} className="grid grid-cols-1 sm:grid-cols-[7rem_1fr] gap-1 sm:gap-3">
              <dt className="font-medium text-text-primary">{tip.label}</dt>
              <dd className="text-text-secondary">{tip.text}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}