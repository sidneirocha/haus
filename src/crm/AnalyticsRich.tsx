import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Clock3,
  RefreshCw,
  Search,
  TrendingUp,
} from "lucide-react";
import type { DashboardData, ProjectStatus } from "./types";
import {
  financeEntriesForPeriod,
  financeEntriesThroughMonth,
  shiftMonth,
} from "./finance-utils";

const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    value,
  );
const daysUntil = (value: string) =>
  Math.ceil((new Date(`${value}T12:00:00`).getTime() - Date.now()) / 86400000);
const statuses: ProjectStatus[] = [
  "Briefing",
  "Em produção",
  "Em revisão",
  "Concluído",
];

type AnalyticsSearchResult = {
  id: string;
  label: string;
  meta: string;
  view:
    | "dashboard"
    | "clientes"
    | "projetos"
    | "servicos"
    | "orcamentos"
    | "financas"
    | "analytics";
};

export function AnalyticsRich({
  data,
  search,
  onSearch,
  reload,
  results = [],
  onSelectResult,
}: {
  data: DashboardData;
  search: string;
  onSearch: (value: string) => void;
  reload: () => void;
  results?: AnalyticsSearchResult[];
  onSelectResult?: (result: AnalyticsSearchResult) => void;
}) {
  const [periodStart, setPeriodStart] = useState(
    new Date().toISOString().slice(0, 7),
  );
  const [periodEnd, setPeriodEnd] = useState(
    new Date().toISOString().slice(0, 7),
  );
  const [revenueGoal, setRevenueGoal] = useState(() =>
    Number(localStorage.getItem("haus-revenue-goal") || 10000),
  );
  const [cashGoal, setCashGoal] = useState(() =>
    Number(localStorage.getItem("haus-cash-goal") || 6500),
  );
  const [targetDate, setTargetDate] = useState(
    () =>
      localStorage.getItem("haus-goal-target") ||
      `${new Date().getFullYear()}-12`,
  );
  useEffect(
    () => localStorage.setItem("haus-revenue-goal", String(revenueGoal)),
    [revenueGoal],
  );
  useEffect(
    () => localStorage.setItem("haus-cash-goal", String(cashGoal)),
    [cashGoal],
  );
  useEffect(
    () => localStorage.setItem("haus-goal-target", targetDate),
    [targetDate],
  );
  const query = search.trim().toLowerCase();
  const matches = (value: string) =>
    !query || value.toLowerCase().includes(query);
  const projects = data.projects.filter((item) =>
    matches(`${item.name} ${item.clientName} ${item.nextAction}`),
  );
  const entries = financeEntriesForPeriod(
    data.finances,
    periodStart,
    periodEnd,
  ).filter((item) =>
    matches(
      `${item.description} ${item.category} ${item.clientName || ""} ${item.projectName || ""}`,
    ),
  );
  const quotes = data.quotes.filter((item) =>
    matches(`${item.company} ${item.clientName} ${item.status}`),
  );
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
  const pipeline = quotes
    .filter((item) => item.status === "Publicado")
    .reduce(
      (sum, quote) =>
        sum +
        quote.items.reduce(
          (total, item) => total + item.price * item.quantity,
          0,
        ),
      0,
    );
  const forecast = incoming + pipeline;
  const margin = incoming
    ? Math.round(((incoming - outgoing) / incoming) * 100)
    : 0;
  const collection = incoming ? Math.round((received / incoming) * 100) : 0;
  const onTime = projects.length
    ? Math.round(
        (projects.filter((item) => daysUntil(item.dueDate) >= 0).length /
          projects.length) *
          100,
      )
    : 100;
  const health = Math.max(
    0,
    Math.min(100, Math.round(margin * 0.45 + collection * 0.3 + onTime * 0.25)),
  );
  const healthLabel =
    health >= 75 ? "Saudável" : health >= 50 ? "Atenção" : "Risco";
  const max = Math.max(incoming, outgoing, 1);
  const accumulated = financeEntriesThroughMonth(data.finances, periodEnd);
  const accumulatedIncoming = accumulated
    .filter((item) => item.type === "Entrada")
    .reduce((sum, item) => sum + item.amount, 0);
  const accumulatedOutgoing = accumulated
    .filter((item) => item.type !== "Entrada")
    .reduce((sum, item) => sum + item.amount, 0);
  const goalProgress = Math.min(
    100,
    Math.max(
      0,
      Math.round((accumulatedIncoming / Math.max(revenueGoal, 1)) * 100),
    ),
  );
  const cashProgress = Math.min(
    100,
    Math.max(
      0,
      Math.round(
        ((accumulatedIncoming - accumulatedOutgoing) / Math.max(cashGoal, 1)) *
          100,
      ),
    ),
  );
  const stageCounts = useMemo(
    () =>
      statuses.map((status) => ({
        status,
        total: projects.filter((item) => item.status === status).length,
      })),
    [projects],
  );
  return (
    <>
      <header className="crm-topbar">
        <div>
          <p className="crm-overline">Haus / CRM</p>
          <h1>Analytics</h1>
        </div>
        <div className="crm-top-actions">
          <div className="crm-command-wrap">
            <div className="crm-command">
              <Search size={16} />
              <input
                value={search}
                onFocus={(event) =>
                  event.currentTarget.parentElement?.parentElement?.classList.add(
                    "is-focused",
                  )
                }
                onChange={(event) => onSearch(event.target.value)}
                placeholder="Buscar no CRM"
                aria-label="Buscar no CRM"
              />
            </div>
            {search.trim() && (
              <div className="crm-search-results" role="listbox">
                {results.length ? (
                  results.map((result) => (
                    <button
                      key={result.id}
                      type="button"
                      className="crm-search-result"
                      role="option"
                      onClick={() => onSelectResult?.(result)}
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
          <button
            className="crm-icon-button"
            onClick={reload}
            aria-label="Atualizar analytics"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </header>
      <div className="crm-content">
        <div className="crm-analytics-toolbar">
          <div>
            <p className="crm-overline">Saúde da empresa</p>
            <span>
              Caixa, capacidade de entrega, projeção e objetivos em uma leitura
              rápida.
            </span>
          </div>
          <div className="crm-period-controls">
            <button
              className="crm-icon-button"
              type="button"
              disabled={!periodStart || !periodEnd}
              onClick={() => {
                setPeriodStart(shiftMonth(periodStart, -1));
                setPeriodEnd(shiftMonth(periodEnd, -1));
              }}
              aria-label="Período anterior"
            >
              <ArrowLeft size={15} />
            </button>
            <div className="crm-period-range">
              <span>Período</span>
              <label>
                De
                <input
                  type="month"
                  value={periodStart}
                  onChange={(event) => setPeriodStart(event.target.value)}
                />
              </label>
              <label>
                Até
                <input
                  type="month"
                  value={periodEnd}
                  onChange={(event) => setPeriodEnd(event.target.value)}
                />
              </label>
            </div>
            <button
              className="crm-icon-button"
              type="button"
              disabled={!periodStart || !periodEnd}
              onClick={() => {
                setPeriodStart(shiftMonth(periodStart, 1));
                setPeriodEnd(shiftMonth(periodEnd, 1));
              }}
              aria-label="Próximo período"
            >
              <ArrowRight size={15} />
            </button>
            <button className="crm-period-action" type="button" onClick={() => { setPeriodStart(''); setPeriodEnd('') }}>Limpar</button>
            <button className="crm-period-action" type="button" onClick={() => { const current = new Date().toISOString().slice(0, 7); setPeriodStart(current); setPeriodEnd(current) }}>Mês atual</button>
          </div>
        </div>
        {search && (
          <div className="crm-filter-note">
            Mostrando dados relacionados a “{search}”.
          </div>
        )}
        <div className="crm-stats">
          <div className="crm-stat">
            <div className="crm-stat-icon green">
              <Activity size={18} />
            </div>
            <div>
              <span>Saúde operacional</span>
              <strong>{health}/100</strong>
              <small>
                {healthLabel} · margem {margin}%
              </small>
            </div>
          </div>
          <div className="crm-stat">
            <div className="crm-stat-icon green">
              <TrendingUp size={18} />
            </div>
            <div>
              <span>Faturamento previsto</span>
              <strong>{money(forecast)}</strong>
              <small>realizado + pipeline</small>
            </div>
          </div>
          <div className="crm-stat">
            <div className="crm-stat-icon green">
              <Check size={18} />
            </div>
            <div>
              <span>Taxa de recebimento</span>
              <strong>{collection}%</strong>
              <small>{money(received)} confirmados</small>
            </div>
          </div>
          <div className="crm-stat">
            <div className="crm-stat-icon amber">
              <Clock3 size={18} />
            </div>
            <div>
              <span>Em aberto</span>
              <strong>{money(pending)}</strong>
              <small>lançamentos pendentes</small>
            </div>
          </div>
        </div>
        <div className="crm-analytics-grid">
          <section className="crm-card crm-analytics-chart">
            <div className="crm-card-heading">
              <div>
                <h2>Fluxo financeiro</h2>
                <p>Comparação do período selecionado.</p>
              </div>
            </div>
            {incoming || outgoing ? (
              <div className="crm-bar-chart">
                <div className="crm-bar-item">
                  <span
                    style={{
                      height: `${Math.max((incoming / max) * 100, 10)}%`,
                    }}
                  />
                  <strong>{money(incoming)}</strong>
                  <small>Entradas</small>
                </div>
                <div className="crm-bar-item expense">
                  <span
                    style={{
                      height: `${Math.max((outgoing / max) * 100, 10)}%`,
                    }}
                  />
                  <strong>{money(outgoing)}</strong>
                  <small>Gastos</small>
                </div>
              </div>
            ) : (
              <div className="crm-empty-chart">
                <strong>Nenhuma movimentação neste período</strong>
                <span>Escolha um intervalo para comparar os lançamentos.</span>
              </div>
            )}
          </section>
          <section className="crm-card crm-analytics-projects">
            <div className="crm-card-heading">
              <div>
                <h2>Projetos por etapa</h2>
                <p>
                  {
                    projects.filter((item) => item.status !== "Concluído")
                      .length
                  }{" "}
                  em andamento ·{" "}
                  {
                    projects.filter((item) => item.status === "Concluído")
                      .length
                  }{" "}
                  concluído(s).
                </p>
              </div>
            </div>
            <div className="crm-stage-list">
              {stageCounts.map((item) => (
                <div key={item.status}>
                  <span>{item.status}</span>
                  <strong>{item.total}</strong>
                  <div>
                    <i
                      style={{
                        width: `${projects.length ? (item.total / projects.length) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
        <section className="crm-card crm-analytics-summary">
          <div className="crm-card-heading">
            <div>
              <h2>Metas e projeção</h2>
              <p>Acumulado desde o primeiro lançamento até a data-alvo.</p>
            </div>
          </div>
          <div className="crm-goal-grid">
            <label>
              <span>Meta de faturamento</span>
              <strong>{money(revenueGoal)}</strong>
              <input
                type="number"
                min="0"
                value={revenueGoal}
                onChange={(event) => setRevenueGoal(Number(event.target.value))}
              />
              <div className="crm-progress">
                <i style={{ width: `${goalProgress}%` }} />
              </div>
              <small>
                {goalProgress}% atingido ·{" "}
                {money(Math.max(revenueGoal - accumulatedIncoming, 0))}{" "}
                restantes
              </small>
            </label>
            <label>
              <span>Meta de caixa</span>
              <strong>{money(cashGoal)}</strong>
              <input
                type="number"
                min="0"
                value={cashGoal}
                onChange={(event) => setCashGoal(Number(event.target.value))}
              />
              <div className="crm-progress">
                <i style={{ width: `${cashProgress}%` }} />
              </div>
              <small>
                {cashProgress}% atingido no acumulado (entradas menos gastos)
              </small>
            </label>
            <label>
              <span>Data-alvo</span>
              <strong>{targetDate}</strong>
              <input
                type="month"
                value={targetDate}
                onChange={(event) => setTargetDate(event.target.value)}
              />
              <small>
                O acompanhamento considera lançamentos até o mês selecionado.
              </small>
            </label>
            <div className="crm-forecast-box">
              <span>Pipeline aberto</span>
              <strong>{money(pipeline)}</strong>
              <small>
                {quotes.filter((item) => item.status === "Publicado").length}{" "}
                orçamento(s) aguardando resposta
              </small>
            </div>
          </div>
        </section>
        <section className="crm-card crm-analytics-summary">
          <div className="crm-card-heading">
            <div>
              <h2>Oportunidades e riscos</h2>
              <p>Itens que merecem atenção comercial ou operacional.</p>
            </div>
          </div>
          <div className="crm-analytics-notes">
            <span>
              <strong>
                {
                  projects.filter(
                    (item) =>
                      item.upsellDate && daysUntil(item.upsellDate) <= 45,
                  ).length
                }
              </strong>{" "}
              upsells nos próximos 45 dias
            </span>
            <span>
              <strong>
                {projects.filter((item) => daysUntil(item.dueDate) < 0).length}
              </strong>{" "}
              projetos atrasados
            </span>
            <span>
              <strong>
                {
                  data.clients.filter((item) =>
                    matches(`${item.name} ${item.company}`),
                  ).length
                }
              </strong>{" "}
              clientes no recorte
            </span>
          </div>
        </section>
      </div>
    </>
  );
}
