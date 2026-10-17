import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { PrivateRoute } from '@/components/layout/PrivateRoute'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { PlaceholderPage } from '@/features/placeholder/PlaceholderPage'
import { LoginPage } from '@/features/auth/LoginPage'
import { ResetPasswordPage } from '@/features/auth/ResetPasswordPage'
import { NotFoundPage } from '@/features/not-found/NotFoundPage'
import { CompaniesListPage } from '@/features/admin/companies/CompaniesListPage'
import { CompanyFormPage } from '@/features/admin/companies/CompanyFormPage'
import { BranchesPage } from '@/features/admin/companies/BranchesPage'
import { UsersListPage } from '@/features/admin/users/UsersListPage'
import { StockOverviewPage } from '@/features/stock/StockOverviewPage'
import { StockMovementsPage } from '@/features/stock/StockMovementsPage'
import { StockTransfersPage } from '@/features/stock/StockTransfersPage'
import { CustomersListPage } from '@/features/customers/CustomersListPage'
import { CustomerFormPage } from '@/features/customers/CustomerFormPage'
import { ProductsInquiryPage } from '@/features/products/ProductsInquiryPage'
import { CategoriesListPage } from '@/features/categories/CategoriesListPage'
import { BrandsListPage } from '@/features/brands/BrandsListPage'
import { SuppliersListPage } from '@/features/suppliers/SuppliersListPage'
import { QuotesListPage } from '@/features/quotes/QuotesListPage'
import { QuoteFormPage } from '@/features/quotes/QuoteFormPage'
import { PdvPage } from '@/features/pos/PdvPage'
import { SalesListPage } from '@/features/pos/SalesListPage'
import { CompanySettingsPage } from '@/features/admin/settings/CompanySettingsPage'
import { CashRegisterPage } from '@/features/cash-register/CashRegisterPage'
import { AccountsReceivablePage } from '@/features/receivables/AccountsReceivablePage'
import { AccountsPayablePage } from '@/features/payables/AccountsPayablePage'
import { SalesReportPage } from '@/features/reports/SalesReportPage'
import { ProductsReportPage } from '@/features/reports/ProductsReportPage'
import { StockReportPage } from '@/features/reports/StockReportPage'
import { FinancialReportPage } from '@/features/reports/FinancialReportPage'
import { SellersPerformancePage } from '@/features/reports/SellersPerformancePage'

export const router = createBrowserRouter([
  // ─── Rotas Públicas ────────────────────────────────────────────────────────
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/reset-password',
    element: <ResetPasswordPage />,
  },

  // ─── Rotas Privadas (protegidas pelo PrivateRoute) ─────────────────────────
  {
    element: <PrivateRoute />,
    children: [
      {
        path: '/',
        element: <AppLayout />,
        children: [
          {
            index: true,
            element: <DashboardPage />,
          },
          {
            path: 'dashboard',
            element: <Navigate to="/" replace />,
          },

          // Comercial (Etapas 8 e 9)
          { path: 'comercial/orcamentos', element: <QuotesListPage /> },
          { path: 'comercial/orcamentos/novo', element: <QuoteFormPage /> },
          { path: 'comercial/orcamentos/:id/editar', element: <QuoteFormPage /> },
          { path: 'comercial/pdv', element: <PdvPage /> },
          { path: 'comercial/vendas', element: <SalesListPage /> },
          { path: 'comercial/caixa', element: <CashRegisterPage /> },
          { path: 'financeiro/caixa', element: <CashRegisterPage /> },

          // Cadastros
          { path: 'cadastros/produtos', element: <ProductsInquiryPage /> },
          { path: 'cadastros/categorias', element: <CategoriesListPage /> },
          { path: 'cadastros/marcas', element: <BrandsListPage /> },
          { path: 'cadastros/clientes', element: <CustomersListPage /> },
          { path: 'cadastros/clientes/novo', element: <CustomerFormPage /> },
          { path: 'cadastros/clientes/:id', element: <CustomerFormPage /> },
          { path: 'cadastros/fornecedores', element: <SuppliersListPage /> },

          // Estoque
          { path: 'estoque',                     element: <StockOverviewPage /> },
          { path: 'estoque/movimentacoes',       element: <StockMovementsPage /> },
          { path: 'estoque/transferencias',      element: <StockTransfersPage /> },
          { path: 'estoque/inventario',          element: <PlaceholderPage /> },

          // Financeiro
          { path: 'financeiro/contas-pagar',     element: <AccountsPayablePage /> },
          { path: 'financeiro/contas-receber',   element: <AccountsReceivablePage /> },
          { path: 'financeiro/crediario',        element: <Navigate to="/financeiro/contas-receber" replace /> },
          { path: 'financeiro/fluxo-caixa',      element: <PlaceholderPage /> },

          // Relatórios (Etapa 13)
          { path: 'relatorios/vendas',                  element: <SalesReportPage /> },
          { path: 'relatorios/produtos',                element: <ProductsReportPage /> },
          { path: 'relatorios/estoque',                 element: <StockReportPage /> },
          { path: 'relatorios/financeiro',              element: <FinancialReportPage /> },
          { path: 'relatorios/desempenho-vendedores',   element: <SellersPerformancePage /> },

          // Administração
          { path: 'admin/empresas-filiais',                     element: <CompaniesListPage /> },
          { path: 'admin/empresas-filiais/nova',                element: <CompanyFormPage /> },
          { path: 'admin/empresas-filiais/:companyId',          element: <CompanyFormPage /> },
          { path: 'admin/empresas-filiais/:companyId/editar',   element: <CompanyFormPage /> },
          { path: 'admin/empresas-filiais/:companyId/filiais',  element: <BranchesPage /> },
          { path: 'admin/usuarios-permissoes',                  element: <UsersListPage /> },
          { path: 'admin/configuracoes-empresa',                element: <CompanySettingsPage /> },
          { path: 'admin/configuracoes-sistema',                element: <PlaceholderPage /> },

          // 404 dentro do layout principal
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },

  // ─── 404 fora do layout ────────────────────────────────────────────────────
  {
    path: '*',
    element: <NotFoundPage />,
  },
])
