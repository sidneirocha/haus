import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowLeft,
  ArrowUpRight,
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Columns3,
  Copy,
  ExternalLink,
  FileSignature,
  FileText,
  LayoutDashboard,
  List,
  LogOut,
  Menu,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  TrendingUp,
  Users,
  Wrench,
  X,
  Download,
  Upload,
} from "lucide-react";
import { crmRepository, isCrmDemo } from "./repository";
import { EditService } from "./EditService";
import { EditQuote } from "./EditQuote";
import { EditFinance } from "./EditFinance";
import { AnalyticsRich } from "./AnalyticsRich";
import { SettingsPanel } from "./SettingsPanel";
import {
  ConfirmProvider,
  Spinner,
  ToastProvider,
  announce,
  useConfirm,
  useToast,
} from "./Toast";
import { EditProject } from "./EditProject";
import { NewProjectWithSolutions } from "./NewProjectWithSolutions";
import { NewQuoteWithClient } from "./NewQuoteWithClient";
import { InlineServiceCreator } from "./InlineServiceCreator";
import { QuoteDetailEditor } from "./QuoteDetailEditor";
import { Contracts, PublicContract } from "./Contracts";
import { SERVICE_CATEGORIES } from "./types";
import { formatBRL, parseBRL } from "./money";
import { clearCrmSession } from "./auth";
import { financeEntriesForPeriod, shiftMonth } from "./finance-utils";
import { parseServicesCsv, servicesCsvTemplate } from "./service-csv";
import { CrmAuthGate } from "./AuthGate";
import { PublicLoading, PublicNotFound } from "./PublicNotFound";
import type {
  Client,
  DashboardData,
  FinancialEntry,
  FinancialRecurrence,
  FinancialStatus,
  FinancialType,
  Project,
  ProjectStatus,
  Quote,
  Service,
} from "./types";
import "./crm.css";

const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    value,
  );
const renderRichText = (value: string) =>
  value.split(/\r?\n/).map((line, lineIndex, lines) => {
    const parts = line.split(/(\*\*[^*]+\*\*|__[^_]+__|\+\+[^+]+\+\+|\*[^*]+\*|_[^_]+_)/g);
    return (
      <span key={`line-${lineIndex}`}>
        {parts.map((part, index) => {
          if (/^\*\*[^*]+\*\*$/.test(part) || /^__[^_]+__$/.test(part)) return <strong key={index}>{part.slice(2, -2)}</strong>;
          if (/^\+\+[^+]+\+\+$/.test(part)) return <u key={index}>{part.slice(2, -2)}</u>;
          if (/^\*[^*]+\*$/.test(part) || /^_[^_]+_$/.test(part)) return <em key={index}>{part.slice(1, -1)}</em>;
          return <span key={index}>{part}</span>;
        })}
        {lineIndex < lines.length - 1 && <br />}
      </span>
    );
  });
const parseDate = (value?: string) => {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const normalized = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    ? `${raw.slice(6, 10)}-${raw.slice(3, 5)}-${raw.slice(0, 2)}`
    : raw.slice(0, 10);
  const parsed = new Date(`${normalized}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};
const date = (value?: string) => {
  const parsed = parseDate(value);
  return parsed
    ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" })
        .format(parsed)
        .replace(".", "")
    : "—";
};
const dateNumeric = (value?: string) => {
  const parsed = parseDate(value);
  return parsed
    ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(parsed)
    : "—";
};
const daysUntil = (value?: string) => {
  const parsed = parseDate(value);
  return parsed ? Math.ceil((parsed.getTime() - Date.now()) / 86400000) : 0;
};
const isQuoteExpired = (quote: Quote) =>
  quote.status === "Expirado" ||
  (quote.status === "Publicado" && daysUntil(quote.expiresAt) < 0);
const cycleDays = (project: Project) => {
  const start = parseDate(project.startDate);
  if (!start) return 0;
  const end =
    project.status === "Concluído"
      ? (parseDate(project.dueDate) ?? new Date())
      : new Date();
  return Math.max(0, Math.ceil((end.getTime() - start.getTime()) / 86400000));
};
const defaultStages = ["Briefing", "Em produção", "Em revisão", "Concluído"];
const path = (value: string) =>
  `${import.meta.env.BASE_URL}${value.replace(/^\//, "")}`;
async function copyText(value: string) {
  try {
    if (navigator.clipboard?.writeText)
      await navigator.clipboard.writeText(value);
    else {
      const textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
    announce("Link do orçamento copiado.");
  } catch {
    announce("Não foi possível copiar o link.", "error");
  }
}

type View =
  | "dashboard"
  | "clientes"
  | "projetos"
  | "servicos"
  | "orcamentos"
  | "contratos"
  | "financas"
  | "analytics";
type SearchResult = { id: string; label: string; meta: string; view: View };
const views: { id: View; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "dashboard", label: "Visão geral", icon: LayoutDashboard },
  { id: "clientes", label: "Clientes", icon: Users },
  { id: "projetos", label: "Projetos", icon: BriefcaseBusiness },
  { id: "servicos", label: "Serviços", icon: Wrench },
  { id: "orcamentos", label: "Orçamentos", icon: FileText },
  { id: "contratos", label: "Contratos", icon: FileSignature },
  { id: "financas", label: "Financeiro", icon: CircleDollarSign },
  { id: "analytics", label: "Analytics", icon: Activity },
];

function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "green" | "amber" | "red" | "blue";
}) {
  return <span className={`crm-badge ${tone}`}>{children}</span>;
}
function Button({
  children,
  variant = "primary",
  onClick,
  type = "button",
  disabled = false,
}: {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  return (
    <button
      className={`crm-button ${variant}`}
      onClick={onClick}
      type={type}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
function Card({
  children,
  className = "",
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <section
      className={`crm-card ${className}`}
      onClick={onClick}
      onKeyDown={(event) => {
        if (onClick && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onClick();
        }
      }}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {children}
    </section>
  );
}
function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="crm-empty">
      <div className="crm-empty-icon">
        <FileText size={18} />
      </div>
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
}

function Sidebar({
  view,
  setView,
  open,
  setOpen,
  onSettings,
  onLogout,
}: {
  view: View;
  setView: (view: View) => void;
  open: boolean;
  setOpen: (value: boolean) => void;
  onSettings: () => void;
  onLogout: () => void;
}) {
  return (
    <>
      <button
        className="crm-mobile-menu"
        onClick={() => setOpen(!open)}
        aria-label="Abrir menu"
      >
        <Menu size={19} />
      </button>
      {open && (
        <button
          className="crm-mobile-scrim"
          onClick={() => setOpen(false)}
          aria-label="Fechar menu"
        />
      )}
      <aside className={`crm-sidebar ${open ? "open" : ""}`}>
        <div className="crm-brand">
          <img src={path("/brand/logo-dark.svg")} alt="Haus" />
          <button
            className="crm-close-menu"
            onClick={() => setOpen(false)}
            aria-label="Fechar menu"
          >
            <X size={18} />
          </button>
        </div>
        <div className="crm-workspace">
          <span className="crm-avatar">H</span>
          <div>
            <strong>Haus Studio</strong>
            <small>Workspace principal</small>
          </div>
          <ChevronRight size={15} />
        </div>
        <nav className="crm-nav">
          {views.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={view === item.id ? "active" : ""}
                onClick={() => {
                  setView(item.id);
                  setOpen(false);
                }}
                title={`Abrir ${item.label}`}
              >
                <Icon size={17} />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="crm-sidebar-bottom">
          <button onClick={onSettings}>
            <Settings2 size={17} />
            Configurações
          </button>
          <button onClick={onLogout}>
            <LogOut size={17} />
            Sair
          </button>
          <a href={path("/")}>
            <ArrowUpRight size={17} />
            Voltar ao site
          </a>
        </div>
      </aside>
      <nav className="crm-mobile-nav" aria-label="Navegação principal">
        <div>
          {["dashboard", "projetos", "clientes", "financas"].map((id) => {
            const item = views.find((viewItem) => viewItem.id === id);
            if (!item) return null;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={view === item.id ? "active" : ""}
                onClick={() => {
                  setView(item.id);
                  setOpen(false);
                }}
              >
                <Icon size={17} />
                <span>{item.id === "dashboard" ? "Início" : item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}

function Topbar({
  title,
  onAdd,
  addLabel,
  search = "",
  onSearch,
  onRefresh,
  results = [],
  onSelectResult,
}: {
  title: string;
  onAdd?: () => void;
  addLabel?: string;
  search?: string;
  onSearch?: (value: string) => void;
  onRefresh?: () => void;
  results?: SearchResult[];
  onSelectResult?: (result: SearchResult) => void;
}) {
  const [focused, setFocused] = useState(false);
  const { notify } = useToast();
  const showResults = focused && Boolean(search.trim());
  return (
    <header className="crm-topbar">
      <div>
        <p className="crm-overline">Haus / CRM</p>
        <h1>{title}</h1>
      </div>
      <div className="crm-top-actions">
        <div className="crm-command-wrap">
          <div className="crm-command">
            <Search size={16} />
            <input
              value={search}
              onFocus={() => setFocused(true)}
              onChange={(event) => onSearch?.(event.target.value)}
              placeholder="Buscar no CRM"
              aria-label="Buscar no CRM"
            />
          </div>
          {showResults && (
            <div className="crm-search-results" role="listbox">
              {results.length ? (
                results.map((result) => (
                  <button
                    key={result.id}
                    type="button"
                    className="crm-search-result"
                    role="option"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      setFocused(false);
                      onSelectResult?.(result);
                    }}
                  >
                    <span>
                      <strong>{result.label}</strong>
                      <small>{result.meta}</small>
                    </span>
                    <ChevronRight size={14} />
                  </button>
                ))
              ) : (
                <div className="crm-search-empty">
                  Nenhum resultado encontrado.
                </div>
              )}
            </div>
          )}
        </div>
        {onRefresh && (
          <button
            className="crm-icon-button"
            onClick={() => {
              onRefresh();
              notify("Dados atualizados.");
            }}
            aria-label="Atualizar dados"
          >
            <RefreshCw size={15} />
          </button>
        )}
        {onAdd && (
          <Button onClick={onAdd}>
            <Plus size={16} />
            {addLabel}
          </Button>
        )}
      </div>
    </header>
  );
}

function Stat({
  label,
  value,
  detail,
  icon: Icon,
  tone = "green",
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: typeof CalendarDays;
  tone?: string;
}) {
  return (
    <Card className="crm-stat">
      <div className={`crm-stat-icon ${tone}`}>
        <Icon size={18} />
      </div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </Card>
  );
}

function Dashboard({
  data,
  setView,
  onProjectClick,
  reload,
  search,
  onSearch,
  results,
  onSelectResult,
}: {
  data: DashboardData;
  setView: (view: View) => void;
  onProjectClick: (project: Project) => void;
  reload: () => void;
  search: string;
  onSearch: (value: string) => void;
  results: SearchResult[];
  onSelectResult: (result: SearchResult) => void;
}) {
  const dueSoon = data.projects
    .filter((item) => item.status !== "Concluído")
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 3);
  const pendingQuotes = data.quotes.filter(
    (item) => item.status === "Publicado",
  );
  const installments = data.quotes
    .flatMap((quote) => quote.installments.map((item) => ({ ...item, quote })))
    .filter((item) => item.status !== "Pago");
  return (
    <>
      <Topbar
        title="Visão geral"
        onAdd={() => setView("orcamentos")}
        addLabel="Novo orçamento"
        search={search}
        onSearch={onSearch}
        results={results}
        onSelectResult={onSelectResult}
      />
      <div className="crm-content">
        {isCrmDemo && (
          <div className="crm-demo-alert">
            <CircleDollarSign size={17} />
            <div>
              <strong>Modo demonstração</strong>
              <span>
                Conecte o endpoint do Apps Script em{" "}
                <code>VITE_CRM_ENDPOINT</code> para usar dados reais.
              </span>
            </div>
          </div>
        )}
        <div className="crm-stats">
          <Stat
            label="Projetos ativos"
            value={
              data.projects.filter((item) => item.status !== "Concluído").length
            }
            detail="em andamento"
            icon={BriefcaseBusiness}
          />
          <Stat
            label="Vencendo em breve"
            value={
              dueSoon.filter((item) => daysUntil(item.dueDate) <= 14).length
            }
            detail="próximos 14 dias"
            icon={Clock3}
            tone="amber"
          />
          <Stat
            label="Orçamentos abertos"
            value={pendingQuotes.length}
            detail="aguardando resposta"
            icon={FileText}
            tone="blue"
          />
          <Stat
            label="A receber"
            value={money(
              installments.reduce((sum, item) => sum + item.amount, 0),
            )}
            detail={`${installments.length} parcelas pendentes`}
            icon={CircleDollarSign}
            tone="purple"
          />
        </div>
        <div className="crm-dashboard-grid">
          <Card>
            <div className="crm-card-heading">
              <div>
                <h2>Projetos em andamento</h2>
                <p>Próximos prazos e ações importantes.</p>
              </div>
              <button
                className="crm-text-button"
                onClick={() => setView("projetos")}
              >
                Ver todos <ArrowUpRight size={15} />
              </button>
            </div>
            {dueSoon.length ? (
              <div className="crm-project-list">
                {dueSoon.map((project) => (
                  <ProjectRow
                    key={project.id}
                    project={project}
                    onClick={() => onProjectClick(project)}
                  />
                ))}
              </div>
            ) : (
              <Empty
                title="Nenhum projeto em andamento"
                text="Crie o primeiro projeto para começar."
              />
            )}
          </Card>
          <Card>
            <div className="crm-card-heading">
              <div>
                <h2>Atalhos rápidos</h2>
                <p>As ações mais usadas pela operação.</p>
              </div>
            </div>
            <div className="crm-shortcuts">
              <button onClick={() => setView("clientes")}>
                <Users size={18} />
                <span>
                  <strong>Adicionar cliente</strong>
                  <small>Cadastre uma nova conta</small>
                </span>
                <ChevronRight size={16} />
              </button>
              <button onClick={() => setView("projetos")}>
                <BriefcaseBusiness size={18} />
                <span>
                  <strong>Acompanhar projeto</strong>
                  <small>Veja prazos e próximas ações</small>
                </span>
                <ChevronRight size={16} />
              </button>
              <button onClick={() => setView("servicos")}>
                <Wrench size={18} />
                <span>
                  <strong>Biblioteca de serviços</strong>
                  <small>Reutilize itens em propostas</small>
                </span>
                <ChevronRight size={16} />
              </button>
            </div>
          </Card>
        </div>
        <Card>
          <div className="crm-card-heading">
            <div>
              <h2>Parcelas pendentes</h2>
              <p>Controle manual de pagamentos do suporte e projetos.</p>
            </div>
            <button
              className="crm-icon-button"
              onClick={reload}
              aria-label="Atualizar"
            >
              <Clock3 size={16} />
            </button>
          </div>
          {installments.length ? (
            <div className="crm-table-wrap">
              <table className="crm-table">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Vencimento</th>
                    <th>Valor</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {installments.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.quote.company}</strong>
                        <small>{item.quote.clientName}</small>
                      </td>
                      <td>{date(item.dueDate)}</td>
                      <td>{money(item.amount)}</td>
                      <td>
                        <Badge
                          tone={daysUntil(item.dueDate) < 0 ? "red" : "amber"}
                        >
                          {daysUntil(item.dueDate) < 0
                            ? "Atrasada"
                            : "Pendente"}
                        </Badge>
                      </td>
                      <td>
                        <Button
                          variant="ghost"
                          onClick={async () => {
                            await crmRepository.markInstallmentPaid(
                              item.quote.id,
                              item.id,
                            );
                            reload();
                          }}
                        >
                          Marcar paga
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              title="Tudo em dia"
              text="Não há parcelas pendentes no momento."
            />
          )}
        </Card>
      </div>
    </>
  );
}

function ProjectRow({
  project,
  onClick,
}: {
  project: Project;
  onClick?: () => void;
}) {
  const due = daysUntil(project.dueDate);
  return (
    <div
      className={`crm-project-row ${onClick ? "crm-clickable" : ""}`}
      onClick={onClick}
      onKeyDown={(event) => {
        if (onClick && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onClick();
        }
      }}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="crm-project-dot" />
      <div className="crm-project-main">
        <strong>{project.name}</strong>
        <small>{project.clientName}</small>
      </div>
      <Badge tone={project.status === "Em revisão" ? "blue" : "green"}>
        {project.status}
      </Badge>
      <div className={`crm-due ${due < 0 ? "late" : ""}`}>
        <CalendarDays size={14} />
        {due < 0 ? `${Math.abs(due)}d atrasado` : `vence em ${due}d`}
      </div>
    </div>
  );
}

function Clients({
  data,
  onAdd,
  reload,
  search,
  onSearch,
  results,
  onSelectResult,
}: {
  data: DashboardData;
  onAdd: () => void;
  reload: () => void;
  search: string;
  onSearch: (value: string) => void;
  results: SearchResult[];
  onSelectResult: (result: SearchResult) => void;
}) {
  const [selected, setSelected] = useState<Client | null>(null);
  const [form, setForm] = useState({
    name: "",
    company: "",
    email: "",
    phone: "",
    notes: "",
  });
  const [busy, setBusy] = useState(false);
  const { notify } = useToast();
  const clients = data.clients
    .map((item) => ({
      ...item,
      projects: data.projects.filter((project) => project.clientId === item.id).length,
      quotes: data.quotes.filter((quote) => quote.clientId === item.id).length,
    }))
    .filter((item) =>
      `${item.name} ${item.company} ${item.email} ${item.phone}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    );
  const totalQuote = (quote: Quote) =>
    quote.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  useEffect(() => {
    if (selected)
      setForm({
        name: selected.name,
        company: selected.company,
        email: selected.email,
        phone: selected.phone,
        notes: selected.notes,
      });
  }, [selected]);
  const save = async () => {
    if (!selected || busy) return;
    setBusy(true);
    try {
      await crmRepository.updateClient(selected.id, form);
      reload();
      notify("Cliente salvo automaticamente.");
    } catch (cause) {
      notify(
        cause instanceof Error
          ? cause.message
          : "Não foi possível salvar o cliente.",
        "error",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Topbar
        title="Clientes"
        onAdd={onAdd}
        addLabel="Novo cliente"
        search={search}
        onSearch={onSearch}
        onRefresh={reload}
        results={results}
        onSelectResult={onSelectResult}
      />
      <div className="crm-content">
        <Card>
          <div className="crm-toolbar">
            <span className="crm-count">{clients.length} clientes</span>
          </div>
          {clients.length ? (
            <div className="crm-table-wrap">
              <table className="crm-table">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Contato</th>
                    <th>Telefone</th>
                    <th>Projetos</th>
                    <th>Orçamentos</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {clients.map((client) => (
                    <tr
                      key={client.id}
                      onClick={() => setSelected(client)}
                      className="crm-clickable"
                    >
                      <td>
                        <strong>{client.company}</strong>
                        <small>{client.name}</small>
                      </td>
                      <td>{client.email}</td>
                      <td>{client.phone}</td>
                      <td>{client.projects}</td>
                      <td>{client.quotes}</td>
                      <td>
                        <ChevronRight size={16} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              title="Nenhum cliente encontrado"
              text="Tente outro termo de busca."
            />
          )}
        </Card>
      </div>
      {selected && (
        <Drawer title={selected.company} onClose={() => setSelected(null)}>
          <div className="crm-profile">
            <span className="crm-profile-avatar">
              {form.company.slice(0, 1)}
            </span>
            <div>
              <h3>{form.name}</h3>
              <p>{form.company}</p>
            </div>
          </div>
          <div className="crm-inline-edit">
            <Field label="Nome">
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                onBlur={() => void save()}
              />
            </Field>
            <Field label="Empresa">
              <input
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
                onBlur={() => void save()}
              />
            </Field>
            <Field label="E-mail">
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                onBlur={() => void save()}
              />
            </Field>
            <Field label="Telefone">
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                onBlur={() => void save()}
              />
            </Field>
            <Field label="Observações">
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                onBlur={() => void save()}
              />
            </Field>
            <span className="crm-autosave-state">
              {busy ? "Salvando…" : "Salvamento automático"}
            </span>
          </div>
          <div className="crm-client-quotes">
            <h3>Orçamentos vinculados</h3>
            {data.quotes.filter((quote) => quote.clientId === selected.id)
              .length ? (
              data.quotes
                .filter((quote) => quote.clientId === selected.id)
                .map((quote) => (
                  <a
                    className="crm-client-quote"
                    key={quote.id}
                    href={path(`/orcamento/${quote.token}`)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span>
                      <strong>{money(totalQuote(quote))}</strong>
                      <small>
                        {isQuoteExpired(quote) ? "Expirado" : quote.status} ·
                        validade {date(quote.expiresAt)}
                      </small>
                    </span>
                    <ExternalLink size={14} />
                  </a>
                ))
            ) : (
              <p>Nenhum orçamento vinculado.</p>
            )}
          </div>
        </Drawer>
      )}
    </>
  );
}

function ProjectKanban({
  projects,
  stages,
  onMove,
  onSelect,
}: {
  projects: Project[];
  stages: string[];
  onMove: (id: string, status: ProjectStatus) => void;
  onSelect: (project: Project) => void;
}) {
  const tone = (status: ProjectStatus) =>
    status === "Em produção"
      ? "green"
      : status === "Em revisão"
        ? "blue"
        : status === "Briefing"
          ? "amber"
          : "";
  const [dragged, setDragged] = useState<string | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const drop = (event: React.DragEvent, status: string) => {
    event.preventDefault();
    event.stopPropagation();
    const id = event.dataTransfer.getData("text/plain") || dragged;
    if (id) onMove(id, status);
    setDragged(null);
    setTarget(null);
  };
  return (
    <div className="crm-kanban">
      {stages.map((status) => {
        const items = projects.filter((project) => project.status === status);
        return (
          <div
            className={`crm-kanban-column ${target === status ? "is-drop-target" : ""}`}
            key={status}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              setTarget(status);
            }}
            onDragLeave={() =>
              setTarget((current) => (current === status ? null : current))
            }
            onDrop={(event) => drop(event, status)}
          >
            <div className="crm-kanban-heading">
              <span className={`crm-kanban-dot ${tone(status)}`} />
              <strong>{status}</strong>
              <span>{items.length}</span>
            </div>
            <div className="crm-kanban-list">
              {items.length ? (
                items.map((project) => (
                  <article
                    className={`crm-kanban-card crm-clickable ${dragged === project.id ? "is-dragging" : ""}`}
                    key={project.id}
                    draggable
                    role="button"
                    tabIndex={0}
                    aria-label={`Abrir detalhes de ${project.name}`}
                    onClick={() => onSelect(project)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSelect(project);
                      }
                    }}
                    onDragStart={(event) => {
                      setDragged(project.id);
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", project.id);
                    }}
                    onDragEnd={() => {
                      setDragged(null);
                      setTarget(null);
                    }}
                  >
                    <strong>{project.name}</strong>
                    <small>{project.clientName}</small>
                    <div className="crm-kanban-meta">
                      <span>
                        <CalendarDays size={13} />
                        {date(project.dueDate)}
                      </span>
                      <span title="Tempo de ciclo do projeto">
                        Ciclo {cycleDays(project)}d
                      </span>
                    </div>
                    <div className="crm-kanban-value">
                      {money(project.value)}
                    </div>
                    <p>{project.nextAction || "Sem próxima ação definida."}</p>
                    <select
                      className="crm-kanban-status"
                      value={project.status}
                      onClick={(event) => event.stopPropagation()}
                      onChange={(event) =>
                        onMove(project.id, event.target.value as ProjectStatus)
                      }
                      aria-label={`Mover ${project.name}`}
                    >
                      {stages.map((stage) => (
                        <option key={stage}>{stage}</option>
                      ))}
                    </select>
                  </article>
                ))
              ) : (
                <div className="crm-kanban-empty">Nenhum projeto</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Projects({
  data,
  onAdd,
  reload,
  search,
  onSearch,
  results,
  onSelectResult,
  stages,
  openProjectId,
  onProjectOpened,
}: {
  data: DashboardData;
  onAdd: () => void;
  reload: () => void;
  search: string;
  onSearch: (value: string) => void;
  results: SearchResult[];
  onSelectResult: (result: SearchResult) => void;
  stages: string[];
  openProjectId?: string | null;
  onProjectOpened?: () => void;
}) {
  const [status, setStatus] = useState<"Todos" | ProjectStatus>("Todos");
  const [mode, setMode] = useState<"table" | "kanban">(() =>
    localStorage.getItem("haus-project-view") === "table" ? "table" : "kanban",
  );
  const [selected, setSelected] = useState<Project | null>(null);
  const [statusOverrides, setStatusOverrides] = useState<
    Record<string, ProjectStatus>
  >({});
  const { notify } = useToast();
  const projects = data.projects
    .map((item) =>
      statusOverrides[item.id]
        ? { ...item, status: statusOverrides[item.id] }
        : item,
    )
    .filter(
      (item) =>
        (status === "Todos" || item.status === status) &&
        `${item.name} ${item.clientName} ${item.nextAction}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    );
  useEffect(() => {
    localStorage.setItem("haus-project-view", mode);
  }, [mode]);
  useEffect(() => {
    setStatusOverrides({});
  }, [data.projects]);
  useEffect(() => {
    if (!openProjectId) return;
    const project = data.projects.find((item) => item.id === openProjectId);
    if (project) {
      setSelected(
        statusOverrides[project.id]
          ? { ...project, status: statusOverrides[project.id] }
          : project,
      );
      onProjectOpened?.();
    }
  }, [openProjectId, data.projects]);
  const moveProject = (id: string, nextStatus: ProjectStatus) => {
    const previous =
      statusOverrides[id] ??
      data.projects.find((item) => item.id === id)?.status;
    setStatusOverrides((current) => ({ ...current, [id]: nextStatus }));
    setSelected((current) =>
      current?.id === id ? { ...current, status: nextStatus } : current,
    );
    notify("Etapa do projeto atualizada.");
    void crmRepository
      .updateProjectStatus(id, nextStatus)
      .then(() => reload())
      .catch(() => {
        setStatusOverrides((current) => {
          const next = { ...current };
          if (previous) next[id] = previous;
          else delete next[id];
          return next;
        });
        notify("Não foi possível atualizar o projeto.", "error");
      });
  };
  return (
    <>
      <Topbar
        title="Projetos"
        onAdd={onAdd}
        addLabel="Novo projeto"
        search={search}
        onSearch={onSearch}
        onRefresh={reload}
        results={results}
        onSelectResult={onSelectResult}
      />
      <div className="crm-content">
        <Card>
          <div className="crm-toolbar">
            <div className="crm-tabs">
              {["Todos", ...stages].map((item) => (
                <button
                  key={item}
                  className={status === item ? "active" : ""}
                  onClick={() => setStatus(item as "Todos" | ProjectStatus)}
                >
                  {item}
                </button>
              ))}
            </div>
            <div
              className="crm-view-toggle"
              role="group"
              aria-label="Visualização dos projetos"
            >
              <button
                className={mode === "table" ? "active" : ""}
                onClick={() => setMode("table")}
                aria-label="Visualização em tabela"
                title="Visualização em tabela"
              >
                <List size={15} />
              </button>
              <button
                className={mode === "kanban" ? "active" : ""}
                onClick={() => setMode("kanban")}
                aria-label="Visualização kanban"
                title="Visualização kanban"
              >
                <Columns3 size={15} />
              </button>
            </div>
            <span className="crm-count">{projects.length} projetos</span>
          </div>
          {mode === "table" ? (
            <div className="crm-table-wrap">
              <table className="crm-table">
                <thead>
                  <tr>
                    <th>Projeto</th>
                    <th>Etapa</th>
                    <th>Início</th>
                    <th>Vencimento</th>
                    <th>Ciclo</th>
                    <th>Próxima ação</th>
                    <th>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((project) => (
                    <tr
                      key={project.id}
                      className="crm-clickable"
                      onClick={() => setSelected(project)}
                    >
                      <td>
                        <strong>{project.name}</strong>
                        <small>{project.clientName}</small>
                      </td>
                      <td>
                        <Badge
                          tone={
                            project.status === "Concluído"
                              ? "neutral"
                              : project.status === "Em revisão"
                                ? "blue"
                                : "green"
                          }
                        >
                          {project.status}
                        </Badge>
                      </td>
                      <td>{date(project.startDate)}</td>
                      <td
                        className={
                          daysUntil(project.dueDate) < 0 ? "crm-danger" : ""
                        }
                      >
                        {date(project.dueDate)}
                      </td>
                      <td title="Tempo decorrido desde o início">
                        {cycleDays(project)}d
                      </td>
                      <td>{project.nextAction}</td>
                      <td>{money(project.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <ProjectKanban
              projects={projects}
              stages={stages}
              onMove={moveProject}
              onSelect={setSelected}
            />
          )}
        </Card>
        <div className="crm-insight">
          <CalendarDays size={18} />
          <div>
            <strong>Upsell em pauta</strong>
            <span>
              {
                data.projects.filter(
                  (item) => item.upsellDate && daysUntil(item.upsellDate) <= 45,
                ).length
              }{" "}
              clientes têm oportunidade de evolução nos próximos 45 dias.
            </span>
          </div>
        </div>
      </div>
      {selected && (
        <EditProject
          project={selected}
          clients={data.clients}
          services={data.services}
          stages={stages}
          close={() => setSelected(null)}
          reload={reload}
          drawer
        />
      )}
    </>
  );
}

function Services({
  data,
  onAdd,
  reload,
  search,
  onSearch,
  results,
  onSelectResult,
}: {
  data: DashboardData;
  onAdd: () => void;
  reload: () => void;
  search: string;
  onSearch: (value: string) => void;
  results: SearchResult[];
  onSelectResult: (result: SearchResult) => void;
}) {
  const [editing, setEditing] = useState<Service | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importError, setImportError] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const serviceCategories = Array.from(new Set([
    ...SERVICE_CATEGORIES,
    ...data.services.map((item) => item.category.trim()).filter(Boolean),
  ]));
  const fileInput = useRef<HTMLInputElement>(null);
  const { notify } = useToast();
  const [category, setCategory] = useState("Todas");
  const services = data.services.filter(
    (item) =>
      (category === "Todas" || item.category === category) &&
      `${item.name} ${item.description} ${item.category}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const downloadTemplate = () => {
    const blob = new Blob([servicesCsvTemplate()], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = 'modelo-servicos.csv'; anchor.click();
    URL.revokeObjectURL(url);
  };
  const importTextContent = async (text: string) => {
    if (!text.trim()) { notify('Selecione um CSV ou cole o conteúdo para importar.', 'error'); return; }
    setImportBusy(true);
    setImportProgress(8); setImportError('');
    try {
      const parsed = parseServicesCsv(text);
      if (!parsed.services.length) throw new Error(parsed.errors.join(' '));
      if (parsed.errors.length) notify(`${parsed.services.length} serviço(s) válido(s); ${parsed.errors.length} linha(s) ignorada(s).`, 'error');
      setImportProgress(15);
      await crmRepository.createServices(parsed.services, (completed, total) => setImportProgress(15 + Math.round((completed / total) * 80)));
      setImportProgress(100);
      setImportOpen(false); setImportText(''); reload();
    } catch (cause) {
      const message = cause instanceof Error && /failed to fetch|falha ao buscar/i.test(cause.message)
        ? 'Não foi possível conectar ao servidor. Verifique o Apps Script publicado e tente novamente.'
        : cause instanceof Error ? cause.message : 'Não foi possível importar o CSV.';
      setImportError(message); notify(message, 'error');
    } finally {
      setImportBusy(false); setImportProgress(0);
      if (fileInput.current) fileInput.current.value = '';
    }
  };
  const importFile = async (file?: File) => { if (file) await importTextContent(await file.text()); };
  return (
    <>
      <Topbar
        title="Biblioteca de serviços"
        onAdd={onAdd}
        addLabel="Novo serviço"
        search={search}
        onSearch={onSearch}
        onRefresh={reload}
        results={results}
        onSelectResult={onSelectResult}
      />
      <div className="crm-content">
        <div className="crm-service-actions">
          <button className="crm-button secondary" type="button" onClick={downloadTemplate}><Download size={15} />Baixar modelo CSV</button>
          <button className="crm-button secondary" type="button" disabled={importBusy} onClick={() => setImportOpen(true)}>{importBusy ? <Spinner label="Importando serviços" /> : <Upload size={15} />} {importBusy ? 'Importando…' : 'Importar CSV'}</button>
        </div>
        <div
          className="crm-service-toolbar"
          role="tablist"
          aria-label="Categorias de serviços"
        >
          <button
            className={category === "Todas" ? "active" : ""}
            onClick={() => setCategory("Todas")}
          >
            Todas
          </button>
          {serviceCategories.map((item) => (
            <button
              key={item}
              className={category === item ? "active" : ""}
              onClick={() => setCategory(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <div className="crm-service-grid">
          {services.map((service) => (
            <Card
              key={service.id}
              className="crm-service-card crm-clickable"
              onClick={() => setEditing(service)}
            >
              <div className="crm-service-top">
                <Badge tone="green">{service.category}</Badge>
                <button
                  className="crm-icon-button"
                  aria-label={`Mais opções de ${service.name}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    setEditing(service);
                  }}
                >
                  <MoreHorizontal size={16} />
                </button>
              </div>
              <h2>{service.name}</h2>
              <p>{service.description}</p>
              <div className="crm-service-footer">
                <strong>{money(service.price)}</strong>
                <span>{service.billing}</span>
              </div>
            </Card>
          ))}
        </div>
        {!services.length && (
          <Empty
            title="Nenhum serviço encontrado"
            text="Tente outro termo de busca ou outra categoria."
          />
        )}
      </div>
      {importOpen && <div className="crm-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !importBusy) setImportOpen(false) }}><div className="crm-modal crm-import-modal" onMouseDown={event => event.stopPropagation()}><div className="crm-drawer-header"><h2>Importar serviços</h2><button className="crm-icon-button" type="button" disabled={importBusy} onClick={() => setImportOpen(false)} aria-label="Fechar"><X size={17} /></button></div><p className="crm-form-note">Use o modelo baixado ou cole um CSV com as colunas <strong>nome;categoria;descricao;preco;cobranca;ativo</strong>.</p><label className="crm-field"><span>Selecionar arquivo CSV</span><input ref={fileInput} type="file" accept=".csv,text/csv" disabled={importBusy} onChange={event => void importFile(event.target.files?.[0])} /></label><label className="crm-field"><span>Ou cole o conteúdo CSV</span><textarea rows={7} disabled={importBusy} value={importText} onChange={event => setImportText(event.target.value)} placeholder="nome;categoria;descricao;preco;cobranca;ativo&#10;Manutenção;Suporte;Acompanhamento mensal;600;Mensal;sim" /></label>{importBusy && <div className="crm-import-progress" role="status" aria-live="polite"><div className="crm-import-progress-label"><span>Importando serviços…</span><strong>{importProgress}%</strong></div><div className="crm-progress-track"><span style={{ width: `${importProgress}%` }} /></div></div>}{importError && <p className="crm-form-error" role="alert">{importError}</p>}<div className="crm-form-actions"><button className="crm-button secondary" type="button" disabled={importBusy} onClick={() => setImportOpen(false)}>Cancelar</button><button className="crm-button primary" type="button" disabled={importBusy || !importText.trim()} onClick={() => void importTextContent(importText)}>{importBusy ? <><Spinner />Importando…</> : 'Importar conteúdo'}</button></div></div></div>}
      {editing && (
        <EditService
          service={editing}
          close={() => setEditing(null)}
          reload={reload}
        />
      )}
    </>
  );
}

function Finance({
  data,
  onAdd,
  reload,
  search,
  onSearch,
  results,
  onSelectResult,
}: {
  data: DashboardData;
  onAdd: () => void;
  reload: () => void;
  search: string;
  onSearch: (value: string) => void;
  results: SearchResult[];
  onSelectResult: (result: SearchResult) => void;
}) {
  const [periodStart, setPeriodStart] = useState(new Date().toISOString().slice(0, 7));
  const [periodEnd, setPeriodEnd] = useState(new Date().toISOString().slice(0, 7));
  const [editing, setEditing] = useState<FinancialEntry | null>(null);
  const [loadingItemId, setLoadingItemId] = useState<string | null>(null);
  const { notify } = useToast();
  const confirm = useConfirm();
  const entries = financeEntriesForPeriod(data.finances, periodStart, periodEnd)
    .filter((item) => `${item.description} ${item.category} ${item.clientName || ""} ${item.projectName || ""}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => b.date.localeCompare(a.date));
  const incoming = entries
    .filter((item) => item.type === "Entrada")
    .reduce((sum, item) => sum + item.amount, 0);
  const outgoing = entries
    .filter((item) => item.type === "Saída")
    .reduce((sum, item) => sum + item.amount, 0);
  const costs = entries
    .filter((item) => item.type === "Custo")
    .reduce((sum, item) => sum + item.amount, 0);
  const balance = incoming - outgoing - costs;
  const tone = (item: FinancialEntry) =>
    item.type === "Entrada" ? "green" : item.type === "Custo" ? "amber" : "red";
  const remove = async (item: FinancialEntry) => {
    if (
      !(await confirm({
        title: "Excluir lançamento?",
        message: `O lançamento “${item.description}” será removido do financeiro. Essa ação não pode ser desfeita.`,
        confirmLabel: "Excluir lançamento",
      }))
    )
      return;
    try {
      await crmRepository.deleteFinance(item.id);
      reload();
      notify("Lançamento excluído.");
    } catch (cause) {
      notify(
        cause instanceof Error
          ? cause.message
          : "Não foi possível excluir o lançamento.",
        "error",
      );
    }
  };
  const stopRecurrence = async (item: FinancialEntry) => {
    if (!item.projected || !item.sourceId) return;
    if (!(await confirm({ title: "Encerrar recorrência?", message: `A partir de ${date(item.date)}, “${item.description}” não aparecerá mais. Os lançamentos anteriores serão preservados.`, confirmLabel: "Encerrar recorrência" }))) return;
    setLoadingItemId(item.id);
    try {
      await crmRepository.stopFinanceRecurrence(item.sourceId, item.date);
      await reload();
      notify("Recorrência encerrada.");
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : "Não foi possível encerrar a recorrência.", "error");
    } finally {
      setLoadingItemId(null);
    }
  };
  const settleOccurrence = async (item: FinancialEntry) => {
    if (!item.projected || !item.sourceId) return;
    setLoadingItemId(item.id);
    try {
      await crmRepository.settleFinanceOccurrence(item.sourceId, item.date);
      await reload();
      notify("Ocorrência marcada como paga.");
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : "Não foi possível atualizar a ocorrência.", "error");
    } finally {
      setLoadingItemId(null);
    }
  };
  return (
    <>
      <Topbar
        title="Financeiro"
        onAdd={onAdd}
        addLabel="Novo lançamento"
        search={search}
        onSearch={onSearch}
        onRefresh={reload}
        results={results}
        onSelectResult={onSelectResult}
      />
      <div className="crm-content">
        <div className="crm-finance-toolbar">
          <div>
            <p className="crm-overline">Caixa da empresa</p>
            <span>
              Entradas, saídas e custos ficam registrados aqui, separados dos
              orçamentos.
            </span>
          </div>
          <div className="crm-period-controls">
            <button className="crm-icon-button" type="button" disabled={!periodStart || !periodEnd} onClick={() => { setPeriodStart(shiftMonth(periodStart, -1)); setPeriodEnd(shiftMonth(periodEnd, -1)); }} aria-label="Período anterior"><ArrowLeft size={15} /></button>
            <div className="crm-period-range"><span>Período</span><label>De<input type="month" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} /></label><label>Até<input type="month" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} /></label></div>
            <button className="crm-icon-button" type="button" disabled={!periodStart || !periodEnd} onClick={() => { setPeriodStart(shiftMonth(periodStart, 1)); setPeriodEnd(shiftMonth(periodEnd, 1)); }} aria-label="Próximo período"><ArrowRight size={15} /></button>
            <button className="crm-period-action" type="button" onClick={() => { setPeriodStart(''); setPeriodEnd(''); }}>Limpar</button>
            <button className="crm-period-action" type="button" onClick={() => { const current = new Date().toISOString().slice(0, 7); setPeriodStart(current); setPeriodEnd(current); }}>Mês atual</button>
          </div>
        </div>
        <div className="crm-stats">
          <Stat
            label="Entradas"
            value={money(incoming)}
            detail="recebimentos do mês"
            icon={CircleDollarSign}
          />
          <Stat
            label="Saídas"
            value={money(outgoing)}
            detail="despesas operacionais"
            icon={ArrowUpRight}
            tone="red"
          />
          <Stat
            label="Custos"
            value={money(costs)}
            detail="software e fornecedores"
            icon={Wrench}
            tone="amber"
          />
          <Stat
            label="Saldo realizado"
            value={money(balance)}
            detail="entradas menos gastos"
            icon={CircleDollarSign}
            tone={balance >= 0 ? "purple" : "red"}
          />
        </div>
        <Card className="crm-finance-card">
          <div className="crm-card-heading">
            <div>
              <h2>Movimentações</h2>
              <p>Uma visão rápida do que entrou, saiu e está comprometido.</p>
            </div>
            <button
              className="crm-icon-button"
              onClick={reload}
              aria-label="Atualizar lançamentos"
              title="Atualizar lançamentos"
            >
              <Clock3 size={16} />
            </button>
          </div>
          {entries.length ? (
            <div className="crm-finance-list">
              {entries.map((item) => loadingItemId === item.id || loadingItemId === item.sourceId ? (
                <article key={item.id} className="crm-finance-entry crm-finance-entry-loading" role="status"><Spinner label="Atualizando dados" /><span>Atualizando dados…</span></article>
              ) : (
                <article
                  key={item.id}
                  className="crm-finance-entry crm-clickable"
                  onClick={() => {
                    const source = item.projected && item.sourceId ? data.finances.find((entry) => entry.id === item.sourceId) : item;
                    if (source) setEditing(source);
                  }}
                >
                  <div className="crm-finance-entry-date">
                    <strong>{date(item.date)}</strong>
                    <small>
                        {item.projected ? `Projeção · ${item.recurrence}` : item.recurrence && item.recurrence !== "Nenhuma" ? item.recurrence : "Avulso"}
                    </small>
                  </div>
                  <div className="crm-finance-entry-main">
                    <strong>{item.description}</strong>
                    <small>
                      {item.clientName ||
                        item.projectName ||
                        item.notes ||
                        "Sem vínculo"}
                    </small>
                    <div className="crm-finance-entry-tags">
                      <Badge tone={tone(item)}>{item.type}</Badge>
                      <span>{item.category}</span>
                      <Badge
                        tone={item.status === "Pendente" ? "amber" : "green"}
                      >
                        {item.status}
                      </Badge>
                    </div>
                  </div>
                  <strong
                    className={`crm-finance-entry-amount ${item.type === "Entrada" ? "crm-finance-in" : "crm-finance-out"}`}
                  >
                    {item.type === "Entrada" ? "+" : "-"} {money(item.amount)}
                  </strong>
                  <div className="crm-finance-entry-actions">
                    <button
                      className="crm-link-button"
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        const source = item.projected && item.sourceId ? data.finances.find((entry) => entry.id === item.sourceId) : item;
                        if (source) setEditing(source);
                      }}
                    >
                      {item.projected ? "Editar recorrência" : "Editar"}
                    </button>
                    {item.projected && item.status === "Pendente" && <Button variant="ghost" onClick={(event) => { event.stopPropagation(); void settleOccurrence(item); }}>Marcar como pago</Button>}
                    {item.projected && <Button variant="ghost" onClick={(event) => { event.stopPropagation(); void stopRecurrence(item); }}>Encerrar aqui</Button>}
                    {!item.projected && item.status === "Pendente" && (
                      <Button
                        variant="ghost"
                        onClick={async (event) => {
                          event.stopPropagation();
                          await crmRepository.settleFinance(item.id);
                          await reload();
                          notify("Lançamento marcado como pago.");
                        }}
                      >
                        Marcar como pago
                      </Button>
                    )}
                    {!item.projected && <button
                      className="crm-link-button crm-danger-link"
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        void remove(item);
                      }}
                    >
                      Excluir
                    </button>}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <Empty
              title="Nenhum lançamento no período"
              text="Adicione uma entrada, saída ou custo para começar."
            />
          )}
        </Card>
      </div>
      {editing && (
        <EditFinance
          entry={editing}
          clients={data.clients}
          projects={data.projects}
          close={() => setEditing(null)}
          reload={reload}
          onBusyChange={(busy) => setLoadingItemId(busy ? editing.id : null)}
        />
      )}
    </>
  );
}

function Analytics({ data }: { data: DashboardData }) {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const entries = data.finances.filter((item) => item.date.startsWith(month));
  const incoming = entries
    .filter((item) => item.type === "Entrada")
    .reduce((sum, item) => sum + item.amount, 0);
  const outgoing = entries
    .filter((item) => item.type !== "Entrada")
    .reduce((sum, item) => sum + item.amount, 0);
  const received = entries
    .filter((item) => item.type === "Entrada" && item.status === "Recebido")
    .reduce((sum, item) => sum + item.amount, 0);
  const pending = entries
    .filter((item) => item.status === "Pendente")
    .reduce((sum, item) => sum + item.amount, 0);
  const completed = data.projects.filter(
    (item) => item.status === "Concluído",
  ).length;
  const active = data.projects.filter(
    (item) => item.status !== "Concluído",
  ).length;
  const max = Math.max(incoming, outgoing, 1);
  const columns: ProjectStatus[] = [
    "Briefing",
    "Em produção",
    "Em revisão",
    "Concluído",
  ];
  return (
    <>
      <Topbar title="Analytics" />
      <div className="crm-content">
        <div className="crm-analytics-toolbar">
          <div>
            <p className="crm-overline">Leitura da operação</p>
            <span>Uma visão rápida de caixa, projetos e oportunidades.</span>
          </div>
          <label className="crm-month-picker">
            Mês
            <input
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
            />
          </label>
        </div>
        <div className="crm-stats">
          <Stat
            label="Receita registrada"
            value={money(incoming)}
            detail="entradas no mês"
            icon={TrendingUp}
          />
          <Stat
            label="Gastos registrados"
            value={money(outgoing)}
            detail="saídas + custos"
            icon={ArrowUpRight}
            tone="red"
          />
          <Stat
            label="Recebido"
            value={money(received)}
            detail="entradas confirmadas"
            icon={Check}
            tone="green"
          />
          <Stat
            label="Em aberto"
            value={money(pending)}
            detail="lançamentos pendentes"
            icon={Clock3}
            tone="amber"
          />
        </div>
        <div className="crm-analytics-grid">
          <Card className="crm-analytics-chart">
            <div className="crm-card-heading">
              <div>
                <h2>Fluxo financeiro</h2>
                <p>Comparação do período selecionado.</p>
              </div>
            </div>
            <div className="crm-bar-chart">
              <div className="crm-bar-item">
                <span
                  style={{
                    height: `${Math.max((incoming / max) * 100, incoming ? 10 : 2)}%`,
                  }}
                />
                <strong>{money(incoming)}</strong>
                <small>Entradas</small>
              </div>
              <div className="crm-bar-item expense">
                <span
                  style={{
                    height: `${Math.max((outgoing / max) * 100, outgoing ? 10 : 2)}%`,
                  }}
                />
                <strong>{money(outgoing)}</strong>
                <small>Gastos</small>
              </div>
            </div>
          </Card>
          <Card className="crm-analytics-projects">
            <div className="crm-card-heading">
              <div>
                <h2>Projetos por etapa</h2>
                <p>
                  {active} em andamento · {completed} concluído
                  {completed === 1 ? "" : "s"}.
                </p>
              </div>
            </div>
            <div className="crm-stage-list">
              {columns.map((stage) => (
                <div key={stage}>
                  <span>{stage}</span>
                  <strong>
                    {
                      data.projects.filter(
                        (project) => project.status === stage,
                      ).length
                    }
                  </strong>
                  <div>
                    <i
                      style={{
                        width: `${data.projects.length ? (data.projects.filter((project) => project.status === stage).length / data.projects.length) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
        <Card className="crm-analytics-summary">
          <div className="crm-card-heading">
            <div>
              <h2>Oportunidades</h2>
              <p>Itens que merecem atenção comercial ou operacional.</p>
            </div>
          </div>
          <div className="crm-analytics-notes">
            <span>
              <strong>
                {
                  data.projects.filter(
                    (item) =>
                      item.upsellDate && daysUntil(item.upsellDate) <= 45,
                  ).length
                }
              </strong>{" "}
              upsells nos próximos 45 dias
            </span>
            <span>
              <strong>
                {
                  data.quotes.filter((item) => item.status === "Publicado")
                    .length
                }
              </strong>{" "}
              orçamentos aguardando resposta
            </span>
            <span>
              <strong>{data.clients.length}</strong> clientes cadastrados
            </span>
          </div>
        </Card>
      </div>
    </>
  );
}

function Quotes({
  data,
  onAdd,
  reload,
  search,
  onSearch,
  results,
  onSelectResult,
}: {
  data: DashboardData;
  onAdd: () => void;
  reload: () => void;
  search: string;
  onSearch: (value: string) => void;
  results: SearchResult[];
  onSelectResult: (result: SearchResult) => void;
}) {
  const [selected, setSelected] = useState<Quote | null>(null);
  const [reactivating, setReactivating] = useState<Quote | null>(null);
  const [quoteAction, setQuoteAction] = useState<{ id: string; type: "clone" | "delete" } | null>(null);
  const { notify } = useToast();
  const confirm = useConfirm();
  const quotes = data.quotes.filter((quote) =>
    `${quote.company} ${quote.clientName} ${quote.status}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const cloneQuote = async (quote: Quote) => {
    setQuoteAction({ id: quote.id, type: "clone" });
    try { await crmRepository.cloneQuote(quote.id); reload(); notify("Orçamento clonado como rascunho."); }
    catch (cause) { notify(cause instanceof Error ? cause.message : "Não foi possível clonar o orçamento.", "error"); }
    finally { setQuoteAction(null); }
  };
  const deleteQuote = async (quote: Quote) => {
    if (!(await confirm({ title: "Excluir orçamento?", message: `O orçamento de ${quote.company} e suas parcelas serão removidos. Essa ação não pode ser desfeita.`, confirmLabel: "Excluir orçamento" }))) return;
    setQuoteAction({ id: quote.id, type: "delete" });
    try { await crmRepository.deleteQuote(quote.id); if (selected?.id === quote.id) setSelected(null); reload(); notify("Orçamento excluído."); }
    catch (cause) { notify(cause instanceof Error ? cause.message : "Não foi possível excluir o orçamento.", "error"); }
    finally { setQuoteAction(null); }
  };
  return (
    <>
      <Topbar
        title="Orçamentos"
        onAdd={onAdd}
        addLabel="Novo orçamento"
        search={search}
        onSearch={onSearch}
        onRefresh={reload}
        results={results}
        onSelectResult={onSelectResult}
      />
      <div className="crm-content">
        <Card>
          <div className="crm-table-wrap">
            <table className="crm-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Valor</th>
                  <th>Status</th>
                  <th>Expira em</th>
                  <th>Link público</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {quotes.map((quote) => {
                  const expired = isQuoteExpired(quote);
                  return (
                    <tr
                      key={quote.id}
                      className="crm-clickable"
                      onClick={() => setSelected(quote)}
                    >
                      <td>
                        <strong>{quote.company}</strong>
                        <small>{quote.clientName}</small>
                      </td>
                      <td>
                        {money(
                          quote.items.reduce(
                            (sum, item) => sum + item.price * item.quantity,
                            0,
                          ),
                        )}
                      </td>
                      <td>
                        <Badge
                          tone={
                            expired
                              ? "red"
                              : quote.status === "Aceito"
                                ? "green"
                                : quote.status === "Publicado"
                                  ? "blue"
                                  : "neutral"
                          }
                        >
                          {expired ? "Expirado" : quote.status}
                        </Badge>
                      </td>
                      <td className={expired ? "crm-danger" : ""}>
                        {date(quote.expiresAt)}
                      </td>
                      <td>
                        <button
                          className="crm-link-button"
                          title="Copiar link público"
                          onClick={(event) => {
                            event.stopPropagation();
                            void copyText(
                              `${window.location.origin}/orcamento/${quote.token}`,
                            );
                          }}
                        >
                          <Copy size={14} />
                          Copiar link
                        </button>
                      </td>
                      <td>
                        <div className="crm-table-actions">
                          <button className="crm-mini-button" type="button" disabled={quoteAction?.id === quote.id} onClick={(event) => { event.stopPropagation(); void cloneQuote(quote); }}>{quoteAction?.id === quote.id && quoteAction.type === "clone" ? <><Spinner label="Clonando orçamento" />Clonando…</> : "Clonar"}</button>
                          <button className="crm-mini-button danger" type="button" disabled={quoteAction?.id === quote.id} onClick={(event) => { event.stopPropagation(); void deleteQuote(quote); }}>{quoteAction?.id === quote.id && quoteAction.type === "delete" ? <><Spinner label="Excluindo orçamento" />Excluindo…</> : "Excluir"}</button>
                          <ChevronRight size={16} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!quotes.length && (
            <Empty
              title="Nenhum orçamento encontrado"
              text="Tente outro termo de busca ou crie um novo orçamento."
            />
          )}
        </Card>
      </div>
      {selected && (
        <Drawer title="Detalhes do orçamento" onClose={() => setSelected(null)}>
          <QuoteDetailEditor
            quote={selected}
            data={data}
            reload={reload}
            onClose={() => setSelected(null)}
            onReactivate={() => {
              setReactivating(selected);
              setSelected(null);
            }}
          />
        </Drawer>
      )}
      {reactivating && (
        <QuoteReactivateDialog
          quote={reactivating}
          close={() => setReactivating(null)}
          reload={reload}
        />
      )}
    </>
  );
}

function LegacyQuoteDetail({
  quote,
  data,
  reload,
  onReactivate,
}: {
  quote: Quote;
  data: DashboardData;
  reload: () => void;
  onReactivate: () => void;
}) {
  const [items, setItems] = useState(quote.items);
  const [showServiceCreator, setShowServiceCreator] = useState(false);
  const [form, setForm] = useState({
    expiresAt: quote.expiresAt,
    notes: quote.notes,
    pixKey: quote.pixKey,
    paymentUrl: quote.paymentUrl,
  });
  const [busy, setBusy] = useState(false);
  const { notify } = useToast();
  const expired = isQuoteExpired(quote);
  const total = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
  const save = async (nextItems = items, nextForm = form) => {
    if (busy) return;
    setBusy(true);
    try {
      await crmRepository.updateQuote(quote.id, {
        clientId: quote.clientId,
        clientName: quote.clientName,
        company: quote.company,
        items: nextItems,
        ...nextForm,
      });
      reload();
      notify("Orçamento salvo automaticamente.");
    } catch (cause) {
      notify(
        cause instanceof Error
          ? cause.message
          : "Não foi possível salvar o orçamento.",
        "error",
      );
    } finally {
      setBusy(false);
    }
  };
  const add = (serviceId: string) => {
    const service = data.services.find((item) => item.id === serviceId);
    if (!service || items.some((item) => item.serviceId === service.id)) return;
    const next = [
      ...items,
      {
        serviceId: service.id,
        name: service.name,
        quantity: 1,
        price: service.price,
        billing: service.billing,
      },
    ];
    setItems(next);
    void save(next);
  };
  const addCreated = (service: Service) => {
    const next = [
      ...items,
      {
        serviceId: service.id,
        name: service.name,
        quantity: 1,
        price: service.price,
        billing: service.billing,
      },
    ];
    setItems(next);
    setShowServiceCreator(false);
    void save(next);
  };
  const remove = (serviceId: string) => {
    const next = items.filter((item) => item.serviceId !== serviceId);
    setItems(next);
    void save(next);
  };
  return (
    <div className="crm-quote-detail">
      <div className="crm-quote-highlight">
        <span>{quote.company}</span>
        <strong>{money(total)}</strong>
        <Badge
          tone={expired ? "red" : quote.status === "Aceito" ? "green" : "blue"}
        >
          {expired ? "Expirado" : quote.status}
        </Badge>
      </div>
      {expired && (
        <div className="crm-quote-expired">
          <strong>Este orçamento expirou em {date(quote.expiresAt)}.</strong>
          <span>
            Reative para gerar uma nova validade e liberar o link público
            novamente.
          </span>
          <Button onClick={onReactivate}>Reativar orçamento</Button>
        </div>
      )}
      <div className="crm-detail-section">
        <h3>Itens do orçamento</h3>
        <div className="crm-inline-edit">
          <div className="crm-service-picker">
            <Field label="Adicionar serviço">
              <select
                defaultValue=""
                onChange={(event) => {
                  add(event.target.value);
                  event.currentTarget.value = "";
                }}
              >
                <option value="">Selecione um serviço</option>
                {data.services
                  .filter(
                    (service) =>
                      service.active &&
                      !items.some((item) => item.serviceId === service.id),
                  )
                  .map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name} · {money(service.price)}
                    </option>
                  ))}
              </select>
            </Field>
            <button
              className="crm-button secondary"
              type="button"
              onClick={() => setShowServiceCreator((current) => !current)}
            >
              <Plus size={15} />
              {showServiceCreator ? "Fechar criação" : "Criar serviço"}
            </button>
          </div>
          {showServiceCreator && (
            <InlineServiceCreator
              onCreated={addCreated}
              onCancel={() => setShowServiceCreator(false)}
            />
          )}
          {items.map((item) => (
            <div className="crm-line-item" key={item.serviceId}>
              <span>
                {item.name} × {item.quantity}
                <small>{item.billing}</small>
              </span>
              <div>
                <strong>{money(item.price * item.quantity)}</strong>
                <button
                  className="crm-mini-button"
                  onClick={() => remove(item.serviceId)}
                  aria-label={`Remover ${item.name}`}
                >
                  Remover
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="crm-detail-section">
        <h3>Dados públicos</h3>
        <div className="crm-inline-edit">
          <Field label="Validade">
            <input
              type="date"
              value={form.expiresAt}
              onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
              onBlur={() => void save(items, form)}
            />
          </Field>
          <Field label="Chave Pix">
            <input
              value={form.pixKey}
              onChange={(e) => setForm({ ...form, pixKey: e.target.value })}
              onBlur={() => void save(items, form)}
            />
          </Field>
          {form.pixKey && (
            <div className="crm-pix-preview">
              <img src={path("/assets/pix-qr.png")} alt="QR Code Pix" />
              <span>QR Code vinculado à chave Pix</span>
            </div>
          )}
          <Field label="Link de pagamento">
            <input
              value={form.paymentUrl}
              onChange={(e) => setForm({ ...form, paymentUrl: e.target.value })}
              onBlur={() => void save(items, form)}
            />
          </Field>
          <Field label="Notas">
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              onBlur={() => void save(items, form)}
            />
          </Field>
          <span className="crm-autosave-state">
            {busy ? "Salvando…" : "Salvamento automático"}
          </span>
        </div>
      </div>
      {quote.installments.length > 0 && (
        <div className="crm-detail-section">
          <h3>Parcelas</h3>
          {quote.installments.map((item) => (
            <div className="crm-line-item" key={item.id}>
              <span>
                {date(item.dueDate)} · {item.status}
              </span>
              <div>
                <strong>{money(item.amount)}</strong>
                {item.status !== "Pago" && (
                  <button
                    className="crm-mini-button"
                    onClick={async () => {
                      await crmRepository.markInstallmentPaid(quote.id, item.id);
                      reload();
                    }}
                  >
                    Pagar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="crm-detail-actions">
        {quote.status === "Rascunho" && (
          <Button
            onClick={async () => {
              try {
                await crmRepository.publishQuote(quote.id, { ...quote, items });
                reload();
                notify("Orçamento publicado.");
              } catch (cause) {
                notify(
                  cause instanceof Error
                    ? cause.message
                    : "Não foi possível publicar o orçamento.",
                  "error",
                );
              }
            }}
          >
            Publicar orçamento
          </Button>
        )}
        <a
          className="crm-public-link"
          href={path(`/orcamento/${quote.token}`)}
          target="_blank"
          rel="noreferrer"
        >
          <ExternalLink size={15} />
          Abrir orçamento público
        </a>
        <button
          className="crm-link-button"
          onClick={() =>
            void copyText(`${window.location.origin}/orcamento/${quote.token}`)
          }
        >
          <Copy size={14} />
          Copiar link
        </button>
      </div>
    </div>
  );
}

function QuoteReactivateDialog({
  quote,
  close,
  reload,
}: {
  quote: Quote;
  close: () => void;
  reload: () => void;
}) {
  const [expiresAt, setExpiresAt] = useState(() =>
    new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await crmRepository.reactivateQuote(quote.id, expiresAt);
      close();
      reload();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível reativar o orçamento.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <FormDialog title="Reativar orçamento" onClose={close}>
      <form className="crm-form" onSubmit={save}>
        <p className="crm-form-note">
          O link público será liberado novamente para {quote.company}.
        </p>
        <Field label="Nova validade">
          <input
            required
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
          />
        </Field>
        {error && (
          <p className="crm-form-error" role="alert">
            {error}
          </p>
        )}
        <div className="crm-form-actions">
          <Button variant="secondary" onClick={close}>
            Cancelar
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Reativando…" : "Reativar orçamento"}
          </Button>
        </div>
      </form>
    </FormDialog>
  );
}

function Drawer({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="crm-drawer-backdrop" onClick={onClose}>
      <aside
        className="crm-drawer"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="crm-drawer-header">
          <h2>{title}</h2>
          <button
            className="crm-icon-button"
            onClick={onClose}
            aria-label="Fechar painel"
            title="Fechar painel"
          >
            <X size={17} />
          </button>
        </div>
        {children}
      </aside>
    </div>
  );
}

function FormDialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="crm-modal-backdrop" onClick={onClose}>
      <div className="crm-modal" onClick={(event) => event.stopPropagation()}>
        <div className="crm-drawer-header">
          <h2>{title}</h2>
          <button
            className="crm-icon-button"
            onClick={onClose}
            aria-label="Fechar janela"
            title="Fechar janela"
          >
            <X size={17} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="crm-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function NewClient({
  close,
  reload,
}: {
  close: () => void;
  reload: () => void;
}) {
  const [form, setForm] = useState({
    name: "",
    company: "",
    email: "",
    phone: "",
    notes: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const update = (key: keyof typeof form, value: string) =>
    setForm({ ...form, [key]: value });
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await crmRepository.createClient(form);
      close();
      reload();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível salvar o cliente.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <FormDialog title="Novo cliente" onClose={close}>
      <form className="crm-form" onSubmit={save}>
        <Field label="Nome">
          <input
            required
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
          />
        </Field>
        <Field label="Empresa">
          <input
            required
            value={form.company}
            onChange={(e) => update("company", e.target.value)}
          />
        </Field>
        <Field label="E-mail">
          <input
            type="email"
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
          />
        </Field>
        <Field label="Telefone">
          <input
            value={form.phone}
            onChange={(e) => update("phone", e.target.value)}
          />
        </Field>
        <Field label="Observações">
          <textarea
            value={form.notes}
            onChange={(e) => update("notes", e.target.value)}
          />
        </Field>
        {error && (
          <p className="crm-form-error" role="alert">
            {error}
          </p>
        )}
        <div className="crm-form-actions">
          <Button variant="secondary" onClick={close}>
            Cancelar
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Salvando…" : "Salvar cliente"}
          </Button>
        </div>
      </form>
    </FormDialog>
  );
}
function EditClient({
  client,
  close,
  reload,
}: {
  client: Client;
  close: () => void;
  reload: () => void;
}) {
  const [form, setForm] = useState({
    name: client.name,
    company: client.company,
    email: client.email,
    phone: client.phone,
    notes: client.notes,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { notify } = useToast();
  const confirm = useConfirm();
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await crmRepository.updateClient(client.id, form);
      close();
      reload();
      notify("Cliente atualizado.");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível atualizar o cliente.",
      );
      notify("Não foi possível atualizar o cliente.", "error");
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (
      !(await confirm({
        title: "Excluir cliente?",
        message: `O cadastro de “${client.company}” será removido do CRM. Essa ação não pode ser desfeita.`,
        confirmLabel: "Excluir cliente",
      }))
    )
      return;
    setBusy(true);
    setError("");
    try {
      await crmRepository.deleteClient(client.id);
      close();
      reload();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível excluir o cliente.",
      );
      notify("Não foi possível excluir o cliente.", "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <FormDialog title="Editar cliente" onClose={close}>
      <form className="crm-form" onSubmit={save}>
        <Field label="Nome">
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Field>
        <Field label="Empresa">
          <input
            required
            value={form.company}
            onChange={(e) => setForm({ ...form, company: e.target.value })}
          />
        </Field>
        <Field label="E-mail">
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </Field>
        <Field label="Telefone">
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </Field>
        <Field label="Observações">
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </Field>
        {error && (
          <p className="crm-form-error" role="alert">
            {error}
          </p>
        )}
        <div className="crm-form-actions">
          <button
            className="crm-button danger"
            type="button"
            onClick={remove}
            disabled={busy}
          >
            Excluir
          </button>
          <span className="crm-form-actions-spacer" />
          <Button variant="secondary" onClick={close}>
            Cancelar
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Salvando…" : "Atualizar cliente"}
          </Button>
        </div>
      </form>
    </FormDialog>
  );
}

function NewService({
  close,
  reload,
}: {
  close: () => void;
  reload: () => void;
}) {
  const [form, setForm] = useState({
    name: "",
    description: "",
    category: "Web",
    price: "",
    billing: "Uma vez" as Service["billing"],
    active: true,
  });
  const [customCategory, setCustomCategory] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const price = parseBRL(form.price);
    if (price <= 0) {
      setError("Informe um preço válido, por exemplo R$ 1.200,00.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const category = form.category === "__new__"
        ? customCategory.trim()
        : form.category;
      if (!category) {
        setBusy(false);
        setError("Informe o nome da nova categoria.");
        return;
      }
      await crmRepository.createService({ ...form, category, price });
      close();
      reload();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível salvar o serviço.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <FormDialog title="Novo serviço" onClose={close}>
      <form className="crm-form" onSubmit={save}>
        <Field label="Nome">
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Field>
        <Field label="Descrição">
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </Field>
        <div className="crm-form-row">
          <Field label="Categoria">
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {SERVICE_CATEGORIES.map((item) => (
                <option key={item}>{item}</option>
              ))}
              <option value="__new__">+ Nova categoria</option>
            </select>
          </Field>
          <Field label="Preço padrão (BRL)">
            <input
              type="text"
              inputMode="decimal"
              placeholder="R$ 1.200,00"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              onBlur={() =>
                setForm((current) => ({
                  ...current,
                  price: current.price
                    ? formatBRL(parseBRL(current.price))
                    : "",
                }))
              }
            />
          </Field>
        </div>
        {form.category === "__new__" && (
          <Field label="Nome da nova categoria">
            <input
              required
              autoFocus
              value={customCategory}
              onChange={(e) => setCustomCategory(e.target.value)}
              placeholder="Ex.: Marketing"
            />
          </Field>
        )}
        <Field label="Cobrança">
          <select
            value={form.billing}
            onChange={(e) =>
              setForm({
                ...form,
                billing: e.target.value as Service["billing"],
              })
            }
          >
            <option>Uma vez</option>
            <option>Mensal</option>
            <option>Anual</option>
          </select>
        </Field>
        {error && (
          <p className="crm-form-error" role="alert">
            {error}
          </p>
        )}
        <div className="crm-form-actions">
          <Button variant="secondary" onClick={close}>
            Cancelar
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Salvando…" : "Salvar serviço"}
          </Button>
        </div>
      </form>
    </FormDialog>
  );
}
function NewProject({
  close,
  reload,
  clients,
}: {
  close: () => void;
  reload: () => void;
  clients: Client[];
}) {
  const [form, setForm] = useState({
    name: "",
    clientId: clients[0]?.id ?? "",
    status: "Briefing" as ProjectStatus,
    startDate: new Date().toISOString().slice(0, 10),
    dueDate: "",
    nextAction: "",
    upsellDate: "",
    value: "",
    notes: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await crmRepository.createProject({
        ...form,
        value: parseBRL(form.value),
      });
      close();
      reload();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível salvar o projeto.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <FormDialog title="Novo projeto" onClose={close}>
      <form className="crm-form" onSubmit={save}>
        <Field label="Nome do projeto">
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Field>
        <Field label="Cliente">
          <select
            value={form.clientId}
            onChange={(e) => setForm({ ...form, clientId: e.target.value })}
          >
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.company}
              </option>
            ))}
          </select>
        </Field>
        <div className="crm-form-row">
          <Field label="Status">
            <select
              value={form.status}
              onChange={(e) =>
                setForm({ ...form, status: e.target.value as ProjectStatus })
              }
            >
              <option>Briefing</option>
              <option>Em produção</option>
              <option>Em revisão</option>
              <option>Concluído</option>
            </select>
          </Field>
          <Field label="Valor (BRL)">
            <input
              inputMode="decimal"
              placeholder="R$ 1.200,00"
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
              onBlur={() =>
                setForm((current) => ({
                  ...current,
                  value: current.value
                    ? formatBRL(parseBRL(current.value))
                    : "",
                }))
              }
            />
          </Field>
        </div>
        <div className="crm-form-row">
          <Field label="Vencimento">
            <input
              required
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
            />
          </Field>
          <Field label="Oportunidade de upsell">
            <input
              type="date"
              value={form.upsellDate}
              onChange={(e) => setForm({ ...form, upsellDate: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Próxima ação">
          <input
            value={form.nextAction}
            onChange={(e) => setForm({ ...form, nextAction: e.target.value })}
          />
        </Field>
        {error && (
          <p className="crm-form-error" role="alert">
            {error}
          </p>
        )}
        <div className="crm-form-actions">
          <Button variant="secondary" onClick={close}>
            Cancelar
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Salvando…" : "Salvar projeto"}
          </Button>
        </div>
      </form>
    </FormDialog>
  );
}

function NewQuote({
  close,
  reload,
  data,
}: {
  close: () => void;
  reload: () => void;
  data: DashboardData;
}) {
  const [clientId, setClientId] = useState(data.clients[0]?.id ?? "");
  const [selected, setSelected] = useState<string[]>([
    data.services[0]?.id ?? "",
  ]);
  const [serviceSearch, setServiceSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const client = data.clients.find((item) => item.id === clientId);
  const normalizedServiceSearch = serviceSearch.trim().toLocaleLowerCase();
  const visibleServices = data.services.filter((item) => {
    if (!item.active) return false;
    if (!normalizedServiceSearch) return true;
    return `${item.name} ${item.category} ${item.description}`
      .toLocaleLowerCase()
      .includes(normalizedServiceSearch);
  });
  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!client || !selected.length) {
      setError("Selecione um cliente e pelo menos um serviço.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const items = data.services
        .filter((item) => selected.includes(item.id))
        .map((item) => ({
          serviceId: item.id,
          name: item.name,
          quantity: 1,
          price: item.price,
          billing: item.billing,
        }));
      await crmRepository.createQuote({
        clientId: client.id,
        clientName: client.name,
        company: client.company,
        items,
        expiresAt: new Date(Date.now() + 30 * 86400000)
          .toISOString()
          .slice(0, 10),
        notes: "",
        pixKey: "",
        paymentUrl: "",
      });
      close();
      reload();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível criar o orçamento.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <FormDialog title="Novo orçamento" onClose={close}>
      <div className="crm-stepper">
        <span className="active">1 Cliente</span>
        <span>2 Serviços</span>
        <span>3 Publicar</span>
      </div>
      <form className="crm-form" onSubmit={create}>
        <Field label="Cliente">
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
          >
            {data.clients.map((item) => (
              <option key={item.id} value={item.id}>
                {item.company}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Serviços do orçamento">
          <div className="crm-inline-service-filter">
            <input
              type="search"
              value={serviceSearch}
              onChange={(event) => setServiceSearch(event.target.value)}
              placeholder="Buscar serviço por nome ou categoria"
              aria-label="Buscar serviço por nome ou categoria"
            />
          </div>
          <div className="crm-check-list">
            {visibleServices.map((service) => (
                <label key={service.id}>
                  <input
                    type="checkbox"
                    checked={selected.includes(service.id)}
                    onChange={(event) =>
                      setSelected(
                        event.target.checked
                          ? [...selected, service.id]
                          : selected.filter((id) => id !== service.id),
                      )
                    }
                  />
                  <span>{service.name}</span>
                  <strong>{money(service.price)}</strong>
                </label>
              ))}
            {!visibleServices.length && (
              <p className="crm-empty-inline">
                Nenhum serviço encontrado para essa busca.
              </p>
            )}
          </div>
        </Field>
        <div className="crm-quote-preview">
          <span>Total estimado</span>
          <strong>
            {money(
              data.services
                .filter((item) => selected.includes(item.id))
                .reduce((sum, item) => sum + item.price, 0),
            )}
          </strong>
          <small>O link público será gerado ao publicar.</small>
        </div>
        {error && (
          <p className="crm-form-error" role="alert">
            {error}
          </p>
        )}
        <div className="crm-form-actions crm-quote-actions">
          {client && (
            <p className="crm-form-note crm-quote-created-note">
              O orçamento será criado para {client.company} e aparecerá na lista de
              orçamentos.
            </p>
          )}
          <div className="crm-quote-action-buttons">
            <Button variant="secondary" onClick={close}>
              Cancelar
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Criando…" : "Criar rascunho"}
            </Button>
          </div>
        </div>
      </form>
    </FormDialog>
  );
}

function NewFinance({
  close,
  reload,
  clients,
  projects,
}: {
  close: () => void;
  reload: () => void;
  clients: Client[];
  projects: Project[];
}) {
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    description: "",
    type: "Entrada" as FinancialType,
    category: "Projetos",
    amount: "",
    status: "Pendente" as FinancialStatus,
    recurrence: "Nenhuma" as FinancialRecurrence,
    nextDueDate: "",
    clientId: "",
    projectId: "",
    notes: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const amount = parseBRL(form.amount);
    if (amount <= 0) {
      setError("Informe um valor maior que zero.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const client = clients.find(item => item.id === form.clientId)
      const project = projects.find(item => item.id === form.projectId)
      await crmRepository.createFinance({ ...form, amount, clientName: client?.company || '', projectName: project?.name || '' });
      close();
      reload();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível salvar o lançamento.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <FormDialog title="Novo lançamento" onClose={close}>
      <form className="crm-form" onSubmit={save}>
        <div className="crm-form-row">
          <Field label="Data">
            <input
              required
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </Field>
          <Field label="Tipo">
            <select
              value={form.type}
              onChange={(e) =>
                setForm({
                  ...form,
                  type: e.target.value as FinancialType,
                  status: "Pendente",
                })
              }
            >
              <option>Entrada</option>
              <option>Saída</option>
              <option>Custo</option>
            </select>
          </Field>
        </div>
        <div className="crm-form-row">
          <Field label="Cliente"><select value={form.clientId} onChange={e => setForm({ ...form, clientId: e.target.value, projectId: '' })}><option value="">Sem vínculo</option>{clients.map(client => <option key={client.id} value={client.id}>{client.company}</option>)}</select></Field>
          <Field label="Projeto"><select value={form.projectId} onChange={e => setForm({ ...form, projectId: e.target.value })}><option value="">Sem vínculo</option>{projects.filter(project => !form.clientId || project.clientId === form.clientId).map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</select></Field>
        </div>
        <Field label="Descrição">
          <input
            required
            placeholder="Ex.: Parcela do projeto"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </Field>
        <div className="crm-form-row">
          <Field label="Categoria">
            <input
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            />
          </Field>
          <Field label="Valor (BRL)">
            <input
              required
              inputMode="decimal"
              placeholder="R$ 1.200,00"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              onBlur={() =>
                setForm((current) => ({
                  ...current,
                  amount: current.amount
                    ? formatBRL(parseBRL(current.amount))
                    : "",
                }))
              }
            />
          </Field>
        </div>
        <div className="crm-form-row">
          <Field label="Situação">
            <select
              value={form.status}
              onChange={(e) =>
                setForm({ ...form, status: e.target.value as FinancialStatus })
              }
            >
              <option>Pendente</option>
              <option>Pago</option>
              <option>Recebido</option>
            </select>
          </Field>
          <Field label="Recorrência">
            <select
              value={form.recurrence}
              onChange={(e) =>
                setForm({
                  ...form,
                  recurrence: e.target.value as FinancialRecurrence,
                  nextDueDate:
                    e.target.value === "Nenhuma" ? "" : form.nextDueDate,
                })
              }
            >
              <option>Nenhuma</option>
              <option>Mensal</option>
              <option>Trimestral</option>
              <option>Anual</option>
            </select>
          </Field>
        </div>
        {form.recurrence !== "Nenhuma" && (
          <Field label="Próximo vencimento">
            <input
              required
              type="date"
              value={form.nextDueDate}
              onChange={(e) =>
                setForm({ ...form, nextDueDate: e.target.value })
              }
            />
          </Field>
        )}
        <Field label="Observações">
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </Field>
        {error && (
          <p className="crm-form-error" role="alert">
            {error}
          </p>
        )}
        <div className="crm-form-actions">
          <Button variant="secondary" onClick={close}>
            Cancelar
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Salvando…" : "Salvar lançamento"}
          </Button>
        </div>
      </form>
    </FormDialog>
  );
}

function PublicItemDescription({ description }: { description: string }) {
  const descriptionRef = useRef<HTMLSpanElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [needsToggle, setNeedsToggle] = useState(false);

  useLayoutEffect(() => {
    const element = descriptionRef.current;
    if (!element) return;
    const measure = () => {
      if (!expanded) setNeedsToggle(element.scrollHeight > element.clientHeight + 1);
    };
    measure();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    observer?.observe(element);
    window.addEventListener('resize', measure);
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); };
  }, [description, expanded]);

  return <>
    <span ref={descriptionRef} className={`crm-public-item-description ${expanded ? 'expanded' : ''}`}>{description}</span>
    {(needsToggle || expanded) && <button className="crm-public-description-toggle" type="button" onClick={() => setExpanded(current => !current)}>{expanded ? 'Ocultar descrição' : 'Ver descrição completa'}</button>}
  </>;
}

function PublicQuote({ token }: { token: string }) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [name, setName] = useState("");
  const [done, setDone] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState("");
  const [copiedPix, setCopiedPix] = useState(false);
  const [loading, setLoading] = useState(true);
  const loadQuote = () => {
    setLoading(true);
    crmRepository
      .getPublicQuote(token)
      .then((data) => setQuote(data))
      .catch(() => setQuote(null))
      .finally(() => setLoading(false));
  };
  useEffect(() => { loadQuote(); }, [token]);
  if (loading) return <PublicLoading />;
  if (!quote)
    return <PublicNotFound kind="orçamento" onRetry={loadQuote} />;
  const total = quote.items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
  const annualRecurringTotal = quote.items.reduce(
    (sum, item) => sum + (item.billing === "Anual" ? item.price * item.quantity : 0),
    0,
  );
  const expired = isQuoteExpired(quote);
  const acceptedPreview = import.meta.env.DEV && new URLSearchParams(window.location.search).get("preview") === "accepted";
  const accepted = acceptedPreview || done || quote.status === "Aceito";
  const acceptedName = acceptedPreview ? "Cliente (prévia)" : quote.signedName || name;
  const acceptedAt = quote.signedAt
    ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(quote.signedAt))
    : acceptedPreview ? "agora (prévia)" : "agora";
  const downloadQuote = () => window.print();
  return (
    <div className="crm-public-page">
      <div className="crm-public-shell">
        <div className="crm-public-header">
          <img
            className="crm-public-header-logo"
            src={path("/brand/logo-dark.svg")}
            alt="Haus"
          />
          <p className="crm-overline">Proposta comercial</p>
          <h1>{quote.company}</h1>
          <p>
            {expired
              ? `Este orçamento expirou em ${date(quote.expiresAt)}.`
              : `Orçamento válido até ${dateNumeric(quote.expiresAt)}.`}
          </p>
        </div>
        <div className="crm-public-body">
          <div className="crm-public-section">
            <h2>Serviços e investimento</h2>
            {quote.items.map((item) => (
              <div className="crm-public-line" key={item.serviceId}>
                <span>
                  <strong className="crm-public-item-name">{item.name}</strong>
                  {item.description && <PublicItemDescription description={item.description} />}
                </span>
                <strong className="crm-public-price">
                  <span>{money(item.price * item.quantity)}</span>
                  <small>{item.billing}{item.quantity > 1 ? ` · ${item.quantity} unidades` : ''}</small>
                </strong>
              </div>
            ))}
            <div className="crm-public-total">
              <span>Investimento total</span>
              <strong>{money(total)}</strong>
            </div>
            {annualRecurringTotal > 0 && (
              <div className="crm-public-recurring-total">
                <span>Total recorrente anual</span>
                <strong>{money(annualRecurringTotal)}</strong>
              </div>
            )}
          </div>
          {expired ? (
            <div className="crm-expired-quote">
              <Clock3 size={26} />
              <h2>Orçamento expirado</h2>
              <p>
                O prazo para aceitar esta proposta terminou. Fale com a Haus
                para solicitar uma nova validade.
              </p>
              <strong>Validade encerrada em {date(quote.expiresAt)}</strong>
              <a className="crm-button primary" href={path("/contato")}>
                Solicitar nova validade <ArrowUpRight size={16} />
              </a>
            </div>
          ) : (
            <>
              <div className="crm-public-section">
                <h2>Condições</h2>
                {quote.notes && <div className="crm-public-conditions">{quote.notes.split(/\n\s*\n/).filter(Boolean).map((block, index) => <div className="crm-public-condition" key={`${index}-${block.slice(0, 16)}`}>{renderRichText(block)}</div>)}</div>}
                {quote.pixKey && (
                  <div className="crm-public-pix">
                    <div>
                      <p>Pagamento via Pix</p>
                      <strong>{quote.pixKey}</strong>
                      <button className="crm-public-copy-pix" type="button" onClick={async () => { try { const cleanPixKey = quote.pixKey.replace(/[.\-/\s]/g, ''); await navigator.clipboard?.writeText(cleanPixKey); setCopiedPix(true); window.setTimeout(() => setCopiedPix(false), 2200) } catch { setCopiedPix(false) } }}><Copy size={13} />{copiedPix ? 'Chave copiada' : 'Copiar chave Pix'}</button>
                    </div>
                    <img src={path("/assets/pix-qr.png")} alt="QR Code Pix" />
                  </div>
                )}
              </div>
              {accepted ? (
                <div className="crm-success crm-sign-success" aria-live="polite">
                  <Check size={20} />
                  <strong>Orçamento aceito</strong>
                  <span>
                    Obrigado{acceptedName ? `, ${acceptedName}` : ""}. Seu aceite foi registrado em {acceptedAt}.
                  </span>
                  <small>Guarde uma cópia desta proposta para seus registros.</small>
                  <div className="crm-public-document-actions">
                    <button className="crm-button primary" type="button" onClick={downloadQuote}>
                      <Download size={16} /> Baixar orçamento
                    </button>
                  </div>
                </div>
              ) : (
                <div className="crm-public-section crm-sign">
                  <h2>Para aprovar, informe seu nome</h2>
                  <p>Este aceite é eletrônico e registra nome, data e hora.</p>
                  <p className="crm-public-consent-note">Ao aceitar, você confirma este orçamento e autoriza a Haus a iniciar os próximos passos.</p>
                  <input
                    placeholder="Seu nome completo"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                  <Button
                    disabled={!name.trim() || accepting}
                    onClick={async () => {
                      setAccepting(true);
                      setAcceptError("");
                      try {
                        const acceptedQuote = await crmRepository.acceptQuote(token, name);
                        setQuote(acceptedQuote);
                        setDone(true);
                      } catch (error) {
                        setAcceptError(error instanceof Error ? error.message : "Não foi possível registrar o aceite.");
                      } finally {
                        setAccepting(false);
                      }
                    }}
                  >
                    {accepting ? <><Spinner label="Registrando aceite" /> Registrando…</> : <>Aceitar orçamento <Check size={16} /></>}
                  </Button>
                  {acceptError && <p className="crm-form-error" role="alert">{acceptError}</p>}
                </div>
              )}
            </>
          )}
        </div>
        {!expired && !done && quote.status !== "Aceito" && <div className="crm-public-sticky-accept"><div><small>Investimento total</small><strong>{money(total)}</strong></div><button className="crm-button primary" type="button" onClick={() => document.querySelector('.crm-sign')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>Aceitar orçamento <ArrowUpRight size={15} /></button></div>}
        <footer>
          <span>haus.art.br</span>
          <a href={path("/")}>
            Conheça a Haus <ArrowUpRight size={14} />
          </a>
        </footer>
      </div>
    </div>
  );
}

function CrmSkeleton() {
  return (
    <div
      className="crm-loading-shell"
      role="status"
      aria-label="Carregando CRM"
    >
      <aside className="crm-skeleton-sidebar">
        <div className="crm-skeleton-brand" />
        <div className="crm-skeleton-nav">
          {Array.from({ length: 7 }).map((_, index) => (
            <i key={index} />
          ))}
        </div>
      </aside>
      <main className="crm-skeleton-main">
        <div className="crm-skeleton-topbar">
          <div>
            <i />
            <i />
          </div>
          <span />
        </div>
        <div className="crm-skeleton-content">
          <div className="crm-skeleton-stats">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} />
            ))}
          </div>
          <div className="crm-skeleton-panels">
            <div />
            <div />
          </div>
          <div className="crm-skeleton-table">
            <i />
            <i />
            <i />
            <i />
          </div>
        </div>
      </main>
    </div>
  );
}

function readProjectStages() {
  try {
    const stored = localStorage.getItem("haus-project-stages");
    const parsed = stored ? JSON.parse(stored) : null;
    return Array.isArray(parsed) && parsed.length
      ? parsed.filter((item) => typeof item === "string")
      : defaultStages;
  } catch {
    return defaultStages;
  }
}

export function CrmApp() {
  const [view, setView] = useState<View>("dashboard");
  const [search, setSearch] = useState("");
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [stages, setStages] = useState<string[]>(readProjectStages);
  const [projectToOpen, setProjectToOpen] = useState<string | null>(null);
  const [modal, setModal] = useState<
    "client" | "project" | "service" | "quote" | "finance" | null
  >(null);
  const reload = async () => {
    try {
      setData(await crmRepository.getDashboard());
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar os dados.");
    }
  };
  const navigate = (nextView: View) => {
    setView(nextView);
    setSearch("");
  };
  const openProject = (project: Project) => {
    setProjectToOpen(project.id);
    navigate("projetos");
  };
  const searchResults = useMemo<SearchResult[]>(() => {
    if (!data || !search.trim()) return [];
    const term = search.trim().toLowerCase();
    return [
      ...data.clients
        .filter((item) =>
          `${item.name} ${item.company} ${item.email}`
            .toLowerCase()
            .includes(term),
        )
        .map((item) => ({
          id: `client-${item.id}`,
          label: item.company,
          meta: `Cliente · ${item.name}`,
          view: "clientes" as View,
        })),
      ...data.projects
        .filter((item) =>
          `${item.name} ${item.clientName} ${item.nextAction}`
            .toLowerCase()
            .includes(term),
        )
        .map((item) => ({
          id: `project-${item.id}`,
          label: item.name,
          meta: `Projeto · ${item.clientName}`,
          view: "projetos" as View,
        })),
      ...data.services
        .filter((item) =>
          `${item.name} ${item.description} ${item.category}`
            .toLowerCase()
            .includes(term),
        )
        .map((item) => ({
          id: `service-${item.id}`,
          label: item.name,
          meta: `Serviço · ${item.category}`,
          view: "servicos" as View,
        })),
      ...data.quotes
        .filter((item) =>
          `${item.company} ${item.clientName} ${item.status}`
            .toLowerCase()
            .includes(term),
        )
        .map((item) => ({
          id: `quote-${item.id}`,
          label: item.company,
          meta: `Orçamento · ${item.status}`,
          view: "orcamentos" as View,
        })),
      ...data.contracts
        .filter((item) =>
          `${item.title} ${item.company} ${item.status}`
            .toLowerCase()
            .includes(term),
        )
        .map((item) => ({
          id: `contract-${item.id}`,
          label: item.title,
          meta: `Contrato · ${item.status}`,
          view: "contratos" as View,
        })),
    ].slice(0, 8);
  }, [data, search]);
  const selectSearchResult = (result: SearchResult) => {
    setView(result.view);
    setSearch(result.label);
  };
  const saveStages = (next: string[]) => {
    setStages(next);
    localStorage.setItem("haus-project-stages", JSON.stringify(next));
    announce("Etapas dos projetos atualizadas.");
  };
  useEffect(() => {
    reload();
  }, []);
  if (!data) return <CrmSkeleton />;
  if (error)
    return (
      <div className="crm-loading">
        <strong>Não foi possível carregar o CRM.</strong>
        <span>{error}</span>
        <Button onClick={reload}>Tentar novamente</Button>
      </div>
    );
  const sharedSearch = {
    results: searchResults,
    onSelectResult: selectSearchResult,
  };
  const analyticsResults = searchResults
    .filter((result) => result.view !== "contratos")
    .map((result) => ({
      ...result,
      view: result.view as Exclude<View, "contratos">,
    }));
  const page =
    view === "dashboard" ? (
      <Dashboard
        data={data}
        setView={navigate}
        onProjectClick={openProject}
        reload={reload}
        search={search}
        onSearch={setSearch}
        {...sharedSearch}
      />
    ) : view === "clientes" ? (
      <Clients
        data={data}
        onAdd={() => setModal("client")}
        reload={reload}
        search={search}
        onSearch={setSearch}
        {...sharedSearch}
      />
    ) : view === "projetos" ? (
      <Projects
        data={data}
        onAdd={() => setModal("project")}
        reload={reload}
        search={search}
        onSearch={setSearch}
        stages={stages}
        openProjectId={projectToOpen}
        onProjectOpened={() => setProjectToOpen(null)}
        {...sharedSearch}
      />
    ) : view === "servicos" ? (
      <Services
        data={data}
        onAdd={() => setModal("service")}
        reload={reload}
        search={search}
        onSearch={setSearch}
        {...sharedSearch}
      />
    ) : view === "orcamentos" ? (
      <Quotes
        data={data}
        onAdd={() => setModal("quote")}
        reload={reload}
        search={search}
        onSearch={setSearch}
        {...sharedSearch}
      />
    ) : view === "contratos" ? (
      <Contracts
        data={data}
        reload={reload}
        search={search}
        onSearch={setSearch}
      />
    ) : view === "financas" ? (
      <Finance
        data={data}
        onAdd={() => setModal("finance")}
        reload={reload}
        search={search}
        onSearch={setSearch}
        {...sharedSearch}
      />
    ) : (
      <AnalyticsRich
        data={data}
        search={search}
        onSearch={setSearch}
        reload={reload}
        results={analyticsResults}
        onSelectResult={selectSearchResult}
      />
    );
  return (
    <ToastProvider>
      <ConfirmProvider>
        <div className="crm-app">
          <Sidebar
            view={view}
            setView={navigate}
            open={menuOpen}
            setOpen={setMenuOpen}
            onSettings={() => setSettingsOpen(true)}
            onLogout={clearCrmSession}
          />
          <main className="crm-main">
            <div key={view} className="crm-page-transition">
              {page}
            </div>
          </main>
          {settingsOpen && (
            <SettingsPanel
              close={() => setSettingsOpen(false)}
              stages={stages}
              onSaveStages={saveStages}
            />
          )}
          {modal === "client" && (
            <NewClient close={() => setModal(null)} reload={reload} />
          )}
          {modal === "project" && (
            <NewProjectWithSolutions
              close={() => setModal(null)}
              reload={reload}
              clients={data.clients}
              services={data.services}
              stages={stages}
            />
          )}
          {modal === "service" && (
            <NewService close={() => setModal(null)} reload={reload} />
          )}
          {modal === "quote" && (
            <NewQuoteWithClient
              close={() => setModal(null)}
              reload={reload}
              data={data}
            />
          )}
          {modal === "finance" && (
            <NewFinance close={() => setModal(null)} reload={reload} clients={data.clients} projects={data.projects} />
          )}
        </div>
      </ConfirmProvider>
    </ToastProvider>
  );
}

export function CrmRoute() {
  const pathname = window.location.pathname;
  const quoteMatch = pathname.match(/\/orcamento\/([^/]+)/);
  const contractMatch = pathname.match(/\/contrato\/([^/]+)/);
  if (contractMatch) return <PublicContract token={contractMatch[1]} />;
  if (quoteMatch) return <PublicQuote token={quoteMatch[1]} />;
  return (
    <CrmAuthGate>
      <CrmApp />
    </CrmAuthGate>
  );
}
