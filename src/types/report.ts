export type PeriodPreset = 'today' | '7days' | '30days' | 'thisMonth' | 'lastMonth' | 'custom'

export interface ReportFilterState {
  companyId: string
  branchId: string // 'all' or branch UUID
  sellerId?: string // 'all' or user UUID
  paymentMethod?: string // 'all' or method
  periodPreset: PeriodPreset
  dateFrom: string // YYYY-MM-DD
  dateTo: string // YYYY-MM-DD
}

export interface ExecutiveDashboardData {
  salesSummary: {
    grossTotal: number // Faturamento bruto total
    discountTotal: number // Descontos concedidos
    netTotal: number // Faturamento líquido (vendas concluídas válidas)
    completedCount: number // Quantidade de vendas concluídas
    averageTicket: number // Ticket médio
    cancelledTotal: number // Total de vendas canceladas
    cancelledCount: number // Quantidade de vendas canceladas
  }
  comparisonPreviousPeriod: {
    previousNetTotal: number
    growthPercentage: number
  }
  salesByPaymentMethod: {
    paymentMethod: string
    paymentMethodLabel: string
    totalAmount: number
    percentage: number
    count: number
  }[]
  salesEvolutionTimeline: {
    date: string // YYYY-MM-DD
    label: string
    grossTotal: number
    netTotal: number
    salesCount: number
  }[]
  financialSummary: {
    receivablesOpen: number
    receivablesOverdue: number
    receivablesPaidPeriod: number
    payablesOpen: number
    payablesOverdue: number
    payablesPaidPeriod: number
  }
  criticalAlerts: {
    lowStockCount: number
    zeroStockCount: number
    overdueReceivablesCount: number
    overduePayablesCount: number
  }
  pendingReceivables: {
    id: string
    documentNumber: string
    customerName: string
    balanceAmount: number
    dueDate: string
    isOverdue: boolean
  }[]
  upcomingPayables: {
    id: string
    documentNumber: string
    supplierName: string
    categoryName: string
    balanceAmount: number
    dueDate: string
    isOverdue: boolean
  }[]
}

export interface SalesReportItem {
  id: string
  code: string
  saleNumber: number
  createdAt: string
  customerName: string
  sellerName: string
  branchName: string
  status: 'completed' | 'cancelled'
  subtotal: number
  discountAmount: number
  total: number
  paymentMethods: string
}

export interface ProductRankingItem {
  productId: string
  productName: string
  sku: string
  category: string
  unit: string
  quantitySold: number
  costPrice: number
  totalRevenue: number // Receita de venda gerada
  estimatedCostTotal: number // Custo total estimado (quando disponível)
  hasValidCost: boolean
}

export interface StockReportItem {
  productId: string
  productName: string
  sku: string
  barcode: string
  category: string
  unit: string
  branchId: string
  branchName: string
  quantity: number
  reservedQuantity: number
  availableQuantity: number
  minStock: number
  isBelowMin: boolean
  isZero: boolean
  costPrice: number
  hasValidCost: boolean
  estimatedStockValue: number // quantity * costPrice
  lastMovementAt: string | null
}

export interface FinancialReportData {
  summary: {
    effectiveReceivedPeriod: number // Recebimentos efetivamente liquidados
    effectivePaidPeriod: number // Pagamentos efetivamente realizados
    openReceivablesTotal: number // Títulos a receber em aberto
    overdueReceivablesTotal: number // Títulos a receber vencidos
    openPayablesTotal: number // Títulos a pagar em aberto
    overduePayablesTotal: number // Títulos a pagar vencidos
    futureReceivablesTotal: number // Vencimentos futuros a receber
    futurePayablesTotal: number // Vencimentos futuros a pagar
  }
  cashSessionsHistory: {
    id: string
    terminalName: string
    openedAt: string
    closedAt: string | null
    openedByName: string
    closedByName: string | null
    status: 'open' | 'closed'
    initialAmount: number
    countedCash: number | null
    expectedCash: number | null
    differenceCash: number | null // Sobra (+) ou Falta (-)
    differenceReason: string | null
    totalSalesCash: number
    totalSalesNonCash: number
  }[]
  recentReceivableSettlements: {
    id: string
    documentNumber: string
    customerName: string
    amount: number
    paymentMethod: string
    paidAt: string
  }[]
  recentPayableSettlements: {
    id: string
    documentNumber: string
    supplierName: string
    categoryName: string
    amount: number
    paymentMethod: string
    paidAt: string
  }[]
}

export interface SellerPerformanceItem {
  userId: string
  userName: string
  userEmail: string
  branchName: string
  salesCount: number
  grossTotal: number
  discountTotal: number
  netTotal: number
  averageTicket: number
}
