import { useState } from 'react';
import { Search, Download, BookOpen, LayoutDashboard, ShoppingCart, ClipboardList, ChefHat, Table2, UtensilsCrossed, Package, ShoppingBag, Users, Star, BarChart3, Receipt, UserSquare2, Calendar, Settings, HelpCircle } from 'lucide-react';
import jsPDF from 'jspdf';

interface HelpSection {
  id: string;
  title: string;
  icon: typeof HelpCircle;
  content: string[];
}

const helpSections: HelpSection[] = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    icon: LayoutDashboard,
    content: [
      'The Dashboard provides an overview of your restaurant operations.',
      'View key metrics: total sales, orders, active tables, and staff on duty.',
      'Monitor recent orders and their status in real-time.',
      'Access quick navigation to all major modules.',
      'View daily revenue trends and performance charts.'
    ]
  },
  {
    id: 'pos',
    title: 'Point of Sale (POS)',
    icon: ShoppingCart,
    content: [
      'The POS module is used for taking customer orders and processing payments.',
      'Add items to the cart by clicking on menu items or using search.',
      'Apply modifiers and special instructions to each item.',
      'Choose payment method: Cash, M-Pesa, or Split Bill.',
      'For M-Pesa payments, enter the customer phone number for STK Push.',
      'Complete the transaction to generate a receipt.'
    ]
  },
  {
    id: 'orders',
    title: 'Orders Management',
    icon: ClipboardList,
    content: [
      'View and manage all orders in the system.',
      'Filter orders by status: New, Preparing, Ready, Completed, Cancelled.',
      'Update order status as it progresses through the kitchen.',
      'View order details including items, quantities, and payments.',
      'Process refunds or modify orders when needed.'
    ]
  },
  {
    id: 'kitchen',
    title: 'Kitchen Display',
    icon: ChefHat,
    content: [
      'The Kitchen Display shows all active orders in a kanban board.',
      'Orders move through stages: New → Preparing → Ready → Done.',
      'View order details including table number, items, and special instructions.',
      'Mark items as complete to move them to the next stage.',
      'Prioritize orders based on order time and table status.'
    ]
  },
  {
    id: 'tables',
    title: 'Table Management',
    icon: Table2,
    content: [
      'View the restaurant floor plan with all tables.',
      'Table status colors: Available (green), Occupied (red), Reserved (yellow).',
      'Click on a table to view details and manage reservations.',
      'Create new reservations with customer details and time slots.',
      'Update table status as customers are seated or leave.'
    ]
  },
  {
    id: 'menu',
    title: 'Menu Management',
    icon: UtensilsCrossed,
    content: [
      'Manage your restaurant menu items and categories.',
      'Create new menu items with name, description, price, and image.',
      'Organize items into categories for better navigation.',
      'Add modifiers (extras, substitutions) to menu items.',
      'Set items as available or unavailable to control POS display.'
    ]
  },
  {
    id: 'inventory',
    title: 'Inventory Management',
    icon: Package,
    content: [
      'Track stock levels for all inventory items.',
      'Receive alerts when items fall below minimum stock levels.',
      'Record stock additions and usage.',
      'View inventory transaction history.',
      'Generate inventory reports for ordering.'
    ]
  },
  {
    id: 'purchases',
    title: 'Purchase Orders',
    icon: ShoppingBag,
    content: [
      'Create and manage purchase orders for suppliers.',
      'Add items to purchase orders with quantities and costs.',
      'Track order status: Pending, Ordered, Received, Cancelled.',
      'Record received quantities and update inventory automatically.',
      'View supplier information and order history.'
    ]
  },
  {
    id: 'customers',
    title: 'Customer Management',
    icon: Users,
    content: [
      'Maintain a database of your customers.',
      'View customer profiles with contact information and order history.',
      'Add new customers and update existing profiles.',
      'Tag customers as VIP for special treatment.',
      'Track customer credit accounts and balances.'
    ]
  },
  {
    id: 'loyalty',
    title: 'Loyalty Program',
    icon: Star,
    content: [
      'Manage customer loyalty points and rewards.',
      'Customers earn points based on their purchases.',
      'View loyalty tiers: Bronze, Silver, Gold.',
      'Set point conversion rates and reward thresholds.',
      'Track point redemption and rewards history.'
    ]
  },
  {
    id: 'reports',
    title: 'Reports & Analytics',
    icon: BarChart3,
    content: [
      'Generate comprehensive reports on restaurant performance.',
      'View daily, weekly, and monthly sales reports.',
      'Analyze revenue trends with interactive charts.',
      'Track top-selling items and categories.',
      'Monitor staff performance and productivity.'
    ]
  },
  {
    id: 'expenses',
    title: 'Expense Tracking',
    icon: Receipt,
    content: [
      'Record and categorize all business expenses.',
      'Create expense categories: utilities, supplies, maintenance, etc.',
      'Set monthly budgets for each expense category.',
      'Upload receipts and documents for each expense.',
      'Generate expense reports for accounting.'
    ]
  },
  {
    id: 'staff',
    title: 'Staff Management',
    icon: UserSquare2,
    content: [
      'Manage all staff members and their roles.',
      'Create staff profiles with contact information and permissions.',
      'Assign roles: Administrator, Manager, Head Chef, Cashier, Waiter, etc.',
      'Track staff attendance and working hours.',
      'Manage staff access and permissions based on roles.'
    ]
  },
  {
    id: 'scheduling',
    title: 'Staff Scheduling',
    icon: Calendar,
    content: [
      'Create and manage staff work schedules.',
      'View weekly schedule calendar with all shifts.',
      'Assign staff to different shifts and time slots.',
      'Track leave requests and approvals.',
      'Monitor staff availability and coverage.'
    ]
  },
  {
    id: 'settings',
    title: 'System Settings',
    icon: Settings,
    content: [
      'Configure system-wide settings and preferences.',
      'Set up restaurant information: name, address, contact details.',
      'Configure tax rates and payment methods.',
      'Manage printer settings for receipts and kitchen tickets.',
      'Set auto-logout duration and security preferences.',
      'Configure M-Pesa integration for payments.'
    ]
  }
];

export default function HelpPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const filteredSections = helpSections.filter(section =>
    section.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    section.content.some(content =>
      content.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  const handleDownloadPDF = () => {
    const pdf = new jsPDF();
    let yPosition = 20;
    const lineHeight = 7;
    const pageHeight = 280;

    pdf.setFontSize(20);
    pdf.text("Shawal's Deli - User Guide", 20, yPosition);
    yPosition += lineHeight * 2;

    pdf.setFontSize(10);
    pdf.text('Restaurant Management System Help Documentation', 20, yPosition);
    yPosition += lineHeight * 2;

    helpSections.forEach((section) => {
      if (yPosition > pageHeight) {
        pdf.addPage();
        yPosition = 20;
      }

      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text(section.title, 20, yPosition);
      yPosition += lineHeight;

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      section.content.forEach((item) => {
        if (yPosition > pageHeight) {
          pdf.addPage();
          yPosition = 20;
        }
        const lines = pdf.splitTextToSize(`• ${item}`, 170);
        pdf.text(lines, 20, yPosition);
        yPosition += lines.length * lineHeight;
      });

      yPosition += lineHeight;
    });

    pdf.save('shawals-deli-user-guide.pdf');
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary mb-2">Help Center</h1>
        <p className="text-text-secondary text-sm">Find answers and guidance for using Shawal's Deli system</p>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted w-5 h-5" />
          <input
            type="text"
            placeholder="Search for help topics..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-surface-card border border-border rounded-xl text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand/50"
          />
        </div>
      </div>

      {/* Download PDF Button */}
      <div className="mb-6 flex justify-end">
        <button
          onClick={handleDownloadPDF}
          className="flex items-center gap-2 px-4 py-2 bg-brand text-black rounded-lg hover:bg-brand/90 transition-colors text-sm font-medium"
        >
          <Download size={16} />
          Download PDF Guide
        </button>
      </div>

      {/* Help Sections */}
      <div className="space-y-4">
        {filteredSections.length === 0 ? (
          <div className="text-center py-12">
            <BookOpen className="mx-auto w-12 h-12 text-text-muted mb-4" />
            <p className="text-text-secondary">No help topics found for "{searchQuery}"</p>
          </div>
        ) : (
          filteredSections.map((section) => {
            const Icon = section.icon;
            const isExpanded = expandedSection === section.id;
            
            return (
              <div
                key={section.id}
                className="bg-surface-card border border-border rounded-xl overflow-hidden"
              >
                <button
                  onClick={() => setExpandedSection(isExpanded ? null : section.id)}
                  className="w-full px-4 py-4 flex items-center justify-between hover:bg-surface-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-brand/10 rounded-lg flex items-center justify-center">
                      <Icon size={20} className="text-brand" />
                    </div>
                    <span className="font-medium text-text-primary">{section.title}</span>
                  </div>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-text-muted">
                      <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </button>
                
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-border">
                    <ul className="space-y-3 pt-4">
                      {section.content.map((item, index) => (
                        <li key={index} className="flex items-start gap-3 text-sm text-text-secondary">
                          <span className="w-1.5 h-1.5 bg-brand rounded-full mt-1.5 shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Quick Tips */}
      <div className="mt-8 p-4 bg-brand/5 border border-brand/20 rounded-xl">
        <h3 className="font-medium text-text-primary mb-3 flex items-center gap-2">
          <HelpCircle size={18} className="text-brand" />
          Quick Tips
        </h3>
        <ul className="space-y-2 text-sm text-text-secondary">
          <li>• Use the search bar above to quickly find specific topics</li>
          <li>• Click on any section to expand and view detailed information</li>
          <li>• Download the PDF guide for offline reference</li>
          <li>• Contact your system administrator for additional support</li>
        </ul>
      </div>
    </div>
  );
}
