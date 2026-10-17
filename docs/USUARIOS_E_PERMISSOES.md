# Módulo de Usuários, Funcionários, Perfis e Permissões (Etapa 4)

Este documento descreve detalhadamente a arquitetura, modelos de dados, regras de segurança, políticas de RLS e funcionalidades do módulo de Usuários e Permissões do ERP MundoMix.

---

## 1. Visão Geral

O módulo permite a gestão completa de operadores, vendedores, gerentes e administradores no ERP corporativo multiempresa e multiloja. Ele foi projetado para operar com isolamento estrito entre empresas (multitenancy) e granularidade de acesso por filial e por módulo funcional.

### Principais Capacidades:
1. **Cadastro e Gestão de Usuários**: listagem, criação, edição, busca e ativação/desativação.
2. **Integração com Supabase Auth**: as senhas nunca são armazenadas em tabelas próprias da aplicação; o gerenciamento de credenciais é delegado de forma segura ao provedor de autenticação.
3. **Perfil Associado**: extensão do usuário (`public.profiles`) contendo nome completo, e-mail, telefone de contato e status.
4. **Vínculo Multilojas e Filiais**: atribuição explícita de quais filiais cada usuário tem autorização para visualizar e operar.
5. **Perfis de Acesso (Roles)**: perfis pré-configurados do sistema (`admin`, `manager`, `salesperson`, `cashier`) e suporte a perfis personalizados da empresa.
6. **Matriz Granular de Permissões**: controle por módulo (`users`, `companies`, `products`, `sales`, `stock`, `financial`, `reports`, `settings`) e ação (`view`, `create`, `edit`, `delete`).
7. **Desativação Segura**: permissão de ativar ou inativar o acesso de um funcionário sem apagar histórico de transações, pedidos de venda ou caixas.

---

## 2. Estrutura do Banco de Dados

### 2.1. Tabelas Existentes e Reutilizadas
- **`public.profiles`**: dados cadastrais complementares ao `auth.users` (`id`, `full_name`, `email`, `phone`, `status`, `created_at`, `updated_at`).
- **`public.companies`**: pessoas jurídicas matrizes e empresas do grupo.
- **`public.branches`**: matriz e filiais de cada empresa.
- **`public.user_company_access`**: tabela de vínculo entre usuário e empresa.
- **`public.user_branch_access`**: tabela de vínculo entre usuário e filiais autorizadas.

### 2.2. Novas Estruturas (Migration `20261014000001_roles_and_permissions.sql`)

#### Tabela `public.roles`
| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | UUID PK | Identificador único do perfil |
| `company_id` | UUID FK NULL | Nulo para perfis globais do sistema, ou ID da empresa para customizados |
| `name` | VARCHAR(50) | Nome legível do perfil (ex: Administrador, Vendedor, Caixa) |
| `slug` | VARCHAR(50) | Identificador textual (`admin`, `manager`, `salesperson`, `cashier`) |
| `description` | TEXT | Descrição das responsabilidades do cargo |
| `is_system` | BOOLEAN | `true` se for um cargo nativo padrão, `false` se for customizado |

#### Tabela `public.role_permissions`
| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | UUID PK | Identificador único da regra |
| `role_id` | UUID FK | Perfil ao qual a permissão pertence |
| `module` | VARCHAR(50) | Nome do módulo (`users`, `products`, `sales`, `stock`, etc) |
| `can_view` | BOOLEAN | Permite visualizar telas e registros |
| `can_create` | BOOLEAN | Permite cadastrar novos itens |
| `can_edit` | BOOLEAN | Permite editar dados existentes |
| `can_delete` | BOOLEAN | Permite excluir/inativar itens |

#### Atualizações Incrementais em Tabelas Existentes
- **`user_company_access`**:
  - `role_id` (UUID FK `roles.id`): vínculo com o perfil configurável.
  - `status` (`'active'` | `'inactive'`): permite desativar acesso à empresa preservando auditoria.
- **`user_branch_access`**:
  - `status` (`'active'` | `'inactive'`): permite inativar filiais autorizadas de um usuário.

---

## 3. Segurança e Row Level Security (RLS)

1. **Proteção Contra Escalada de Privilégios**:
   - Um usuário comum ou gerente não tem permissão para conceder perfil de administrador a outros.
   - Apenas o `owner` (proprietário) pode conceder o papel `owner`.
   - É proibido a auto-promoção de um usuário comum a administrador.
2. **Segurança de Backend & RLS**:
   - As políticas de RLS nas tabelas `user_company_access`, `user_branch_access`, `roles` e `role_permissions` garantem que administradores só leiam ou alterem dados de sua própria empresa.
   - Perfis de sistema nativos têm edição bloqueada no banco via cláusula RLS `is_system = false`.
3. **Isolamento de Filiais**:
   - Usuários não-administradores só enxergam as filiais explicitamente concedidas na tabela `user_branch_access`.
   - Administradores e proprietários têm acesso amplo a todas as filiais da empresa que gerenciam.
4. **Sem Exposição de Chaves Privilegiadas**:
   - O frontend utiliza estritamente `anon key`.
   - Nenhuma chave `service_role` foi embutida no bundle cliente.
   - Foram implementadas funções seguras (`SECURITY DEFINER`) e arquitetura de Edge Function (`supabase/functions/create-user`) para operações administrativas de autenticação.

---

## 4. Interface e Experiência do Usuário

A interface foi implementada em `src/features/admin/users/`:

1. **`UsersListPage.tsx`**:
   - Listagem com design moderno em Tailwind CSS, suporte total a modo claro e escuro.
   - Barra de busca instantânea por nome, e-mail e telefone.
   - Filtros de status (Todos, Ativos, Inativos) e cargo (Proprietário, Administrador, Gerente, Vendedor, Caixa, Operador).
   - Badges estilizados por nível de privilégio.
   - Ações inline com botões para editar dados e ativar/desativar acesso sem apagar histórico.
   - Diálogo modal de confirmação (`ConfirmDialog`) para prevenir desativações acidentais.
2. **`UserFormModal.tsx`**:
   - Formulário validado com máscara de telefone.
   - Seleção visual do cargo/perfil de acesso.
   - Seleção múltipla das filiais de atuação do operador, com destaque caso seja administrador (acesso automático irrestrito).
3. **`RolesPermissionsModal.tsx`**:
   - Painel de visualização da matriz de permissões por módulo e ação.
   - Permite aos administradores criar novos cargos personalizados para a empresa e configurar permissões de leitura, criação, edição e exclusão.

---

## 5. Como Executar as Migrations

Para aplicar a nova migration incremental no seu banco Supabase:

1. Acesse o **SQL Editor** do projeto no painel do Supabase.
2. Abra o arquivo [`supabase/migrations/20261014000001_roles_and_permissions.sql`](file:///c:/Users/Xster%20Software%20House/Desktop/erp-mundomix/supabase/migrations/20261014000001_roles_and_permissions.sql).
3. Execute o script. A migration é idempotente e preserva todas as contas de administrador e empresas já configuradas no banco.
