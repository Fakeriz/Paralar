// Category definitions. Labels are translated via i18n key `cat_<id>`.
export const CATEGORIES = [
  { id: 'food', icon: 'Utensils', types: ['expense'] },
  { id: 'groceries', icon: 'ShoppingBasket', types: ['expense'] },
  { id: 'transport', icon: 'Car', types: ['expense'] },
  { id: 'shopping', icon: 'ShoppingBag', types: ['expense'] },
  { id: 'bills', icon: 'Receipt', types: ['expense'] },
  { id: 'entertainment', icon: 'Clapperboard', types: ['expense'] },
  { id: 'health', icon: 'HeartPulse', types: ['expense'] },
  { id: 'education', icon: 'GraduationCap', types: ['expense'] },
  { id: 'travel', icon: 'Plane', types: ['expense'] },
  { id: 'housing', icon: 'Home', types: ['expense'] },
  { id: 'personal', icon: 'User', types: ['expense'] },
  { id: 'business', icon: 'Briefcase', types: ['expense', 'income'] },
  { id: 'salary', icon: 'Wallet', types: ['income'] },
  { id: 'freelance', icon: 'Laptop', types: ['income'] },
  { id: 'investment', icon: 'TrendingUp', types: ['income', 'expense'] },
  { id: 'gift', icon: 'Gift', types: ['income', 'expense'] },
  { id: 'transfer', icon: 'ArrowLeftRight', types: ['transfer'] },
  { id: 'other', icon: 'CircleDashed', types: ['expense', 'income'] },
]

export const getCategory = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[CATEGORIES.length - 1]

export const PAYMENT_METHODS = ['cash', 'qr', 'card', 'bank']

export const CARD_THEMES = [
  { id: 'obsidian', name: 'Obsidian', className: 'bg-gradient-to-br from-[#121214] via-[#1a1a1e] to-[#0d0d0f] text-white', dark: false },
  { id: 'glacier', name: 'Glacier', className: 'bg-gradient-to-br from-[#f8fafc] via-[#e2e8f0] to-[#cbd5e1] text-slate-900', dark: true },
  { id: 'midnight', name: 'Midnight', className: 'bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0a0f1d] text-white', dark: false },
  { id: 'skymint', name: 'Sky Mint', className: 'bg-gradient-to-br from-[#0f766e] via-[#14b8a6] to-[#065f46] text-white', dark: false },
  { id: 'rosegold', name: 'Rose Gold', className: 'bg-gradient-to-br from-[#2d1b22] via-[#432330] to-[#1f1218] text-white', dark: false },
  { id: 'emerald', name: 'Emerald Green', className: 'bg-gradient-to-br from-[#064e3b] via-[#047857] to-[#022c22] text-white', dark: false },
]
export const getTheme = (id) => CARD_THEMES.find((t) => t.id === id) || CARD_THEMES[0]

// Bank & e-wallet logos (rendered as branded initials badges)
export const BANK_LOGOS = [
  // Indonesia
  { id: 'bca', name: 'BCA', country: 'id', color: '#0060AF', short: 'BCA' },
  { id: 'mandiri', name: 'Mandiri', country: 'id', color: '#003D79', short: 'MDR' },
  { id: 'bri', name: 'BRI', country: 'id', color: '#00529C', short: 'BRI' },
  { id: 'bni', name: 'BNI', country: 'id', color: '#F15A22', short: 'BNI' },
  { id: 'jago', name: 'Bank Jago', country: 'id', color: '#FFB800', short: 'JG' },
  { id: 'jenius', name: 'Jenius', country: 'id', color: '#00A9E0', short: 'JN' },
  { id: 'seabank', name: 'SeaBank', country: 'id', color: '#FF6A00', short: 'SB' },
  { id: 'gopay', name: 'GoPay', country: 'id', color: '#00AED6', short: 'GP' },
  { id: 'ovo', name: 'OVO', country: 'id', color: '#4C3494', short: 'OVO' },
  { id: 'dana', name: 'DANA', country: 'id', color: '#118EEA', short: 'DN' },
  { id: 'shopeepay', name: 'ShopeePay ID', country: 'id', color: '#EE4D2D', short: 'SP' },
  { id: 'linkaja', name: 'LinkAja', country: 'id', color: '#E31E24', short: 'LA' },
  // Malaysia
  { id: 'maybank', name: 'Maybank', country: 'my', color: '#FFC20E', short: 'MB', dark: true },
  { id: 'cimb', name: 'CIMB', country: 'my', color: '#EC1C24', short: 'CIMB' },
  { id: 'publicbank', name: 'Public Bank', country: 'my', color: '#D71920', short: 'PB' },
  { id: 'rhb', name: 'RHB', country: 'my', color: '#0067B1', short: 'RHB' },
  { id: 'hongleong', name: 'Hong Leong', country: 'my', color: '#00539B', short: 'HL' },
  { id: 'tng', name: 'TnG eWallet', country: 'my', color: '#1E4BD8', short: 'TnG' },
  { id: 'grabpay', name: 'GrabPay', country: 'my', color: '#00B14F', short: 'GB' },
  { id: 'boost', name: 'Boost', country: 'my', color: '#EE2E24', short: 'BST' },
  { id: 'bigpay', name: 'BigPay', country: 'my', color: '#1A1A1A', short: 'BIG' },
  // Turkey
  { id: 'ziraat', name: 'Ziraat', country: 'tr', color: '#E30613', short: 'ZRT' },
  { id: 'isbank', name: 'Türkiye İş Bankası', country: 'tr', color: '#1F3F94', short: 'İŞ' },
  { id: 'garanti', name: 'Garanti BBVA', country: 'tr', color: '#009B3A', short: 'GRT' },
  { id: 'akbank', name: 'Akbank', country: 'tr', color: '#E10514', short: 'AKB' },
  { id: 'yapikredi', name: 'Yapı Kredi', country: 'tr', color: '#004990', short: 'YK' },
  { id: 'papara', name: 'Papara', country: 'tr', color: '#000000', short: 'PPR' },
  { id: 'tosla', name: 'Tosla', country: 'tr', color: '#7B3FE4', short: 'TSL' },
  { id: 'paycell', name: 'Paycell', country: 'tr', color: '#FFCB05', short: 'PC', dark: true },
  // Generic
  { id: 'cash', name: 'Cash', country: 'generic', color: '#16a34a', short: '$' },
  { id: 'bank', name: 'Bank', country: 'generic', color: '#334155', short: '🏦' },
  { id: 'wallet', name: 'E-Wallet', country: 'generic', color: '#0ea5e9', short: '👛' },
  { id: 'card', name: 'Credit Card', country: 'generic', color: '#7c3aed', short: '💳' },
  { id: 'savings', name: 'Savings', country: 'generic', color: '#f59e0b', short: '🐷' },
  { id: 'crypto', name: 'Crypto', country: 'generic', color: '#f7931a', short: '₿' },
]
export const getLogo = (id) => BANK_LOGOS.find((l) => l.id === id) || null
