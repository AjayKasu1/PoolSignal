"use client";

import { useEffect, useMemo, useState } from "react";
import {
  campaignStages,
  certificationTrend,
  reviewCases,
  type ReviewCase,
} from "../lib/demo-data";
import type { AgentRunResult } from "../lib/agent-engine";
import type { LiveDataResponse, ProductChangeField } from "../lib/live-data";

type View = "overview" | "changes" | "agents" | "queue" | "campaign" | "scenario" | "quality";
type QueueSort = "priority" | "newest" | "identity";

const navItems: { id: View; label: string; glyph: string }[] = [
  { id: "overview", label: "Mission control", glyph: "◈" },
  { id: "changes", label: "Change inbox", glyph: "≋" },
  { id: "agents", label: "Agent fabric", glyph: "⌘" },
  { id: "queue", label: "Review queue", glyph: "◎" },
  { id: "campaign", label: "Campaign flow", glyph: "↗" },
  { id: "scenario", label: "Scenario lab", glyph: "△" },
  { id: "quality", label: "Data quality", glyph: "◇" },
];

const changeFieldLabels: Record<ProductChangeField, string> = {
  qiId: "Qi ID",
  brand: "Brand",
  productName: "Product name",
  partNumber: "Part number",
  productType: "Product type",
  powerProfile: "Power profile",
  loadPower: "Load power",
  version: "Qi version",
  certificationDate: "Certification date",
};

const matchCopy = {
  none: "No public-list match",
  possible: "Possible entity match",
  "public-list": "Public-list match",
};

function freshnessLabel(value: string | null): string {
  if (!value) return "Waiting for first snapshot";
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
  if (elapsedMinutes < 2) return "Updated just now";
  if (elapsedMinutes < 60) return `Updated ${elapsedMinutes}m ago`;
  const hours = Math.floor(elapsedMinutes / 60);
  return hours < 48 ? `Updated ${hours}h ago` : `Updated ${Math.floor(hours / 24)}d ago`;
}

function exactUtcLabel(value: string | null): string {
  if (!value) return "Waiting for first successful check";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(new Date(value));
}

function countComparison(previous: number | null, current: number): string {
  return previous === null ? `Baseline → ${current.toLocaleString()}` : `${previous.toLocaleString()} → ${current.toLocaleString()}`;
}

function ScoreRing({ value, label }: { value: number; label: string }) {
  return (
    <div className="score-ring" style={{ "--score": `${value * 3.6}deg` } as React.CSSProperties}>
      <div><strong>{value}</strong><span>{label}</span></div>
    </div>
  );
}

function StatusPill({ state }: { state: ReviewCase["matchState"] }) {
  return <span className={`status-pill status-${state}`}>{matchCopy[state]}</span>;
}

export function PoolSignalApp() {
  const [view, setView] = useState<View>("overview");
  const [selectedId, setSelectedId] = useState(reviewCases[0].id);
  const [running, setRunning] = useState(false);
  const [decisions, setDecisions] = useState<Record<string, string>>({});
  const [persistedDecisions, setPersistedDecisions] = useState<Record<string, boolean>>({});
  const [decisionMessages, setDecisionMessages] = useState<Record<string, string>>({});
  const [reviewerToken, setReviewerToken] = useState("");
  const [agentRun, setAgentRun] = useState<AgentRunResult | null>(null);
  const [agentError, setAgentError] = useState("");
  const [liveData, setLiveData] = useState<LiveDataResponse | null>(null);
  const [liveDataError, setLiveDataError] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [queueSort, setQueueSort] = useState<QueueSort>("priority");
  const [annualUnits, setAnnualUnits] = useState(250000);
  const [fee, setFee] = useState(0.25);
  const [discount, setDiscount] = useState(10);

  const selected = reviewCases.find((item) => item.id === selectedId) ?? reviewCases[0];
  const royaltyUnits = Math.max(annualUnits - 25000, 0);
  const illustrativeRoyalty = royaltyUnits * fee * (1 - discount / 100);
  const activeCases = useMemo(() => reviewCases.filter((item) => item.stage === "review"), []);
  const latestLiveSignal = liveData?.signals[0] ?? null;
  const changeFeed = liveData?.changeFeed;
  const lastSuccessfulCheck = changeFeed?.lastSuccessfulCheck ?? null;
  const sourceAttentionCount = (changeFeed?.pendingCount ?? 0) + (changeFeed?.retryCount ?? 0) + (changeFeed?.deadLetterCount ?? 0);
  const sourceWorkCount = sourceAttentionCount + (changeFeed?.processingCount ?? 0);
  const latestProcessedChange = changeFeed?.recent.find((event) => event.run) ?? null;
  const latestPersistedRun = latestProcessedChange?.run ?? null;
  const selectedTrace = agentRun?.source === "demo" && agentRun.caseId === selected.id ? agentRun.trace : selected.trace;
  const agentTrace = agentRun?.trace ?? latestPersistedRun?.trace ?? selected.trace;
  const policyStep = agentTrace.find((step) => step.agent === "Policy gate");
  const changeButtonLabel = !liveData
    ? "Checking source changes"
    : (changeFeed?.processingCount ?? 0) > 0
      ? `Processing ${changeFeed?.processingCount} source changes`
      : (changeFeed?.pendingCount ?? 0) > 0
        ? `Review ${changeFeed?.pendingCount} new source changes`
        : (changeFeed?.retryCount ?? 0) + (changeFeed?.deadLetterCount ?? 0) > 0
          ? `Inspect ${(changeFeed?.retryCount ?? 0) + (changeFeed?.deadLetterCount ?? 0)} failed source changes`
          : "No new source changes";
  const changeButtonDisabled = !liveData || sourceWorkCount === 0;
  const searchMatches = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return reviewCases;
    return reviewCases.filter((item) => [item.brand, item.product, item.qiId, item.partNumber, item.productType]
      .some((value) => value.toLowerCase().includes(query)));
  }, [searchQuery]);
  const queueCases = useMemo(() => {
    const cases = [...reviewCases];
    if (queueSort === "newest") {
      return cases.sort((left, right) => right.certificationDate.localeCompare(left.certificationDate));
    }
    if (queueSort === "identity") {
      return cases.sort((left, right) => left.matchConfidence - right.matchConfidence);
    }
    return cases.sort((left, right) => right.score - left.score);
  }, [queueSort]);

  useEffect(() => {
    const controller = new AbortController();
    async function loadLiveData() {
      try {
        const response = await fetch("/api/live-data?limit=8", { cache: "no-store", signal: controller.signal });
        const payload = await response.json() as LiveDataResponse;
        if (!response.ok) throw new Error("Live sources are warming up");
        setLiveData(payload);
        setLiveDataError("");
      } catch (error) {
        if (controller.signal.aborted) return;
        setLiveDataError(error instanceof Error ? error.message : "Live sources are unavailable");
      }
    }
    void loadLiveData();
    const interval = window.setInterval(() => void loadLiveData(), 60_000);
    return () => {
      window.clearInterval(interval);
      controller.abort();
    };
  }, []);

  async function runAgents() {
    setRunning(true);
    setAgentError("");
    try {
      const response = await fetch("/api/agent-runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId: selected.id }),
      });
      const payload = await response.json() as { run?: AgentRunResult; error?: string };
      if (!response.ok || !payload.run) throw new Error(payload.error ?? "Agent cycle failed");
      setAgentRun(payload.run);
    } catch (error) {
      setAgentError(error instanceof Error ? error.message : "Agent cycle failed");
    } finally {
      setRunning(false);
    }
  }

  async function recordDecision(decision: "approved" | "returned" | "monitor") {
    if (!reviewerToken.trim()) {
      setDecisions((current) => ({ ...current, [selected.id]: decision }));
      setPersistedDecisions((current) => ({ ...current, [selected.id]: false }));
      setDecisionMessages((current) => ({ ...current, [selected.id]: "Previewed locally — no database write" }));
      return;
    }

    setDecisionMessages((current) => ({ ...current, [selected.id]: "Saving authenticated decision…" }));
    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${reviewerToken.trim()}` },
        body: JSON.stringify({
          caseId: selected.id,
          decision,
          rationale: "Authenticated human-review decision",
        }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Decision was not saved");
      setDecisions((current) => ({ ...current, [selected.id]: decision }));
      setPersistedDecisions((current) => ({ ...current, [selected.id]: true }));
      setDecisionMessages((current) => ({ ...current, [selected.id]: "Persisted to D1 as an authenticated reviewer" }));
    } catch (error) {
      setDecisionMessages((current) => ({
        ...current,
        [selected.id]: error instanceof Error ? error.message : "Decision was not saved",
      }));
    }
  }

  function openSearchResult(caseId: string) {
    setSelectedId(caseId);
    setView("queue");
    setSearchOpen(false);
    setSearchQuery("");
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <span className="brand-mark">P</span>
          <div><strong>PoolSignal</strong><span>Licensing intelligence</span></div>
        </div>

        <nav aria-label="Primary navigation">
          <p className="nav-kicker">Workspace</p>
          {navItems.map((item) => (
            <button
              key={item.id}
              className={view === item.id ? "nav-item active" : "nav-item"}
              onClick={() => setView(item.id)}
              type="button"
            >
              <span>{item.glyph}</span>{item.label}
              {item.id === "queue" && <em>{activeCases.length}</em>}
              {item.id === "changes" && sourceWorkCount > 0 && <em>{sourceWorkCount}</em>}
            </button>
          ))}
        </nav>

        <div className="sidebar-card">
          <span className="live-dot" />
          <div><strong>{liveData?.status.mode === "live" ? "Live sources connected" : "Source monitor warming"}</strong><span>{liveData?.status.wpc.lastSuccessAt ? `${liveData.status.wpc.new30d} certifications · last 30d` : "Run on demand · no outreach"}</span></div>
        </div>
        <div className="sidebar-footer"><span>Hybrid environment</span><strong>Live public · synthetic operations</strong></div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">QI WIRELESS POWER · INTELLIGENCE CONSOLE</span>
            <h1>{navItems.find((item) => item.id === view)?.label}</h1>
          </div>
          <div className="topbar-actions">
            <button className="quiet-button" type="button" aria-expanded={searchOpen} onClick={() => setSearchOpen((open) => !open)}><span>⌕</span> Search demo cases</button>
            <button className={(changeFeed?.processingCount ?? 0) > 0 ? "run-button running" : "run-button"} disabled={changeButtonDisabled} type="button" onClick={() => setView("changes")}>
              <span>{!liveData || (changeFeed?.processingCount ?? 0) > 0 ? "•••" : sourceWorkCount > 0 ? "◆" : "✓"}</span>{changeButtonLabel}
            </button>
          </div>
        </header>

        {searchOpen && (
          <section className="search-panel" aria-label="Demo case search">
            <div className="search-input-wrap"><span>⌕</span><input autoFocus value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search synthetic brand, Qi ID, product, or part number" aria-label="Search demo cases" /><button type="button" onClick={() => setSearchOpen(false)}>Close</button></div>
            <div className="search-results">
              {searchMatches.length === 0 && <p>No demo cases match this search.</p>}
              {searchMatches.map((item) => <button type="button" key={item.id} onClick={() => openSearchResult(item.id)}><span><strong>{item.brand}</strong><em>{item.product}</em></span><span><strong>{item.qiId}</strong><em>{item.matchConfidence}% entity confidence</em></span></button>)}
            </div>
          </section>
        )}

        {view === "overview" && (
          <div className="view-stack">
            <section className="signal-hero">
              <div className="hero-copy">
                <span className="hero-kicker"><i /> {!liveData ? "SOURCE MONITOR · CHECKING" : sourceWorkCount > 0 ? "SOURCE CHANGE INBOX · ATTENTION" : "SOURCE MONITOR · CURRENT"}</span>
                <h2>{!liveData ? "Checking for material source changes." : sourceWorkCount > 0 ? `${sourceWorkCount} source ${sourceWorkCount === 1 ? "change is" : "changes are"} active.` : "Sources checked. No new evidence."}</h2>
                <p>{!liveData
                  ? "PoolSignal is loading the latest WPC snapshot and durable change ledger."
                  : sourceWorkCount > 0
                    ? `PoolSignal detected product-level evidence changes after the ${freshnessLabel(liveData.status.wpc.lastSuccessAt)} WPC check. Each event is deduplicated, processed once, and retained for audit.`
                    : lastSuccessfulCheck
                      ? `At ${exactUtcLabel(lastSuccessfulCheck.checkedAt)}, PoolSignal compared ${lastSuccessfulCheck.monitoredRecords.toLocaleString()} product fingerprints with the previous verified snapshot. The last-known-good values remain visible until a newer check succeeds.`
                      : "PoolSignal is retaining the last successful source state while the comparison history warms up."}</p>
                <div className="hero-actions">
                  <button type="button" onClick={() => setView("changes")}>Open change inbox <span>→</span></button>
                  {latestLiveSignal && <a href={latestLiveSignal.sourceUrl} target="_blank" rel="noreferrer">Open newest WPC record ↗</a>}
                </div>
              </div>
              <div className="hero-score">
                <div className="score-prompt"><div><strong>{lastSuccessfulCheck?.observedRecords.toLocaleString() ?? "—"}</strong><span>source rows verified</span></div></div>
                <div className="score-context"><span>Last successful source state</span><strong>{lastSuccessfulCheck ? `${lastSuccessfulCheck.monitoredRecords.toLocaleString()} fingerprints · ${exactUtcLabel(lastSuccessfulCheck.checkedAt)}` : "Waiting for first verified check"}</strong></div>
              </div>
              <div className="hero-grid" aria-hidden="true" />
            </section>

            <section className="metric-grid">
              <article><span>Live certifications · 30d</span><strong>{liveData?.status.wpc.new30d ?? "—"}</strong><em>{freshnessLabel(liveData?.status.wpc.lastSuccessAt ?? null)}</em></article>
              <article><span>Tracked product fingerprints</span><strong>{changeFeed?.trackedProducts ?? "—"}</strong><em>SHA-256 · material fields only</em></article>
              <article><span>WPC catalog records verified</span><strong>{liveData?.status.wpc.totalRecords.toLocaleString() ?? "—"}</strong><em>retained from last successful check</em></article>
              <article><span>Via public names observed</span><strong>{liveData?.status.via.licenseeCount.toLocaleString() ?? "—"}</strong><em>{freshnessLabel(liveData?.status.via.lastSuccessAt ?? null)}</em></article>
            </section>

            <div className="dashboard-grid">
              <section className="panel agent-panel">
                <div className="panel-heading"><div><span>{agentRun ? "REPRESENTATIVE AGENT TRACE" : latestPersistedRun ? "AUTOMATED LIVE CHANGE RUN" : "REPRESENTATIVE AGENT TRACE"}</span><h3>Evidence-to-decision trace</h3></div><button type="button" onClick={() => setView("agents")}>View run log</button></div>
                <div className="agent-rail">
                  {agentTrace.map((step, index) => (
                    <div className="agent-node" key={step.agent}>
                      <span className={`agent-orb ${step.status}`}>{index + 1}</span>
                      <div><strong>{step.agent}</strong><span>{step.task}</span></div>
                      <em>{Math.round(step.confidence * 100)}%</em>
                    </div>
                  ))}
                </div>
                <div className="policy-banner"><span>◆</span><div><strong>{agentRun ? "Representative policy gate" : latestPersistedRun ? latestPersistedRun.requiresHuman ? "Human review required" : "Monitoring permitted" : "Representative policy gate"}</strong><p>{policyStep?.output ?? "The policy gate did not return an output."}</p></div></div>
              </section>

              <section className="panel trend-panel">
                <div className="panel-heading"><div><span>ILLUSTRATIVE MARKET SIGNAL</span><h3>Representative certification velocity</h3></div><em>7 months · synthetic</em></div>
                <div className="bar-chart" aria-label="Illustrative monthly certification velocity">
                  {certificationTrend.map((item) => <div key={item.month}><span style={{ height: `${item.value}%` }} /><em>{item.month}</em></div>)}
                </div>
                <div className="chart-note"><strong>Representative June acceleration</strong><span>Synthetic trend shown for workflow demonstration.</span></div>
              </section>
            </div>

            <section className="panel live-feed-panel">
              <div className="panel-heading"><div><span>LIVE PUBLIC SOURCE</span><h3>Latest WPC certifications</h3></div><em>{liveData?.status.mode === "live" ? `${liveData.status.wpc.monitoredRecords} recent records monitored` : liveDataError || "Loading source snapshot…"}</em></div>
              <div className="source-health-grid">
                <article><span className={liveData?.status.wpc.lastSuccessAt ? "source-state live" : "source-state warming"}>WPC</span><strong>{liveData?.status.wpc.totalRecords.toLocaleString() ?? "—"}</strong><em>public records observed</em><small>{freshnessLabel(liveData?.status.wpc.lastSuccessAt ?? null)}</small></article>
                <article><span className={liveData?.status.via.lastSuccessAt ? "source-state live" : "source-state warming"}>VIA</span><strong>{liveData?.status.via.licenseeCount ?? "—"}</strong><em>public names in snapshot</em><small>{freshnessLabel(liveData?.status.via.lastSuccessAt ?? null)}</small></article>
                <article><span className="source-state ondemand">GLEIF</span><strong>{liveData?.status.gleif.cachedQueries ?? 0}</strong><em>cached entity queries</em><small>searched only when agents run</small></article>
              </div>
              <div className="live-feed-table" role="table" aria-label="Latest live Qi certification signals">
                <div className="live-feed-row live-feed-header" role="row"><span>Certified</span><span>Signal</span><span>Product</span><span>Profile</span><span>State</span></div>
                {!liveData && <p className="live-feed-empty">Connecting to the live public-source monitor…</p>}
                {liveData?.signals.length === 0 && <p className="live-feed-empty">The first scheduled source snapshot is still warming up.</p>}
                {liveData?.signals.map((signal) => (
                  <div className="live-feed-row" role="row" key={signal.qiId}>
                    <span><strong>{signal.certificationDate}</strong><em>WPC snapshot</em></span>
                    <span><strong>{signal.brand}</strong><em>{signal.qiId}</em></span>
                    <span><strong>{signal.productName}</strong><em>{signal.partNumber}</em></span>
                    <span><strong>{signal.productType} · {signal.loadPower}W</strong><em>{signal.powerProfile}</em></span>
                    <span className="live-feed-actions"><i>Fingerprint tracked</i><a href={signal.sourceUrl} target="_blank" rel="noreferrer" aria-label={`Open ${signal.qiId} at WPC`}>Source ↗</a></span>
                  </div>
                ))}
              </div>
              <div className="live-boundary"><span>◆</span><p>Product facts refresh automatically. Material field changes create durable events; unchanged records do not rerun agents. Certification changes do not imply licensing status. Campaign activity and quality examples remain synthetic.</p></div>
            </section>

            <section className="panel queue-preview">
              <div className="panel-heading"><div><span>SYNTHETIC REVIEW WORKFLOW</span><h3>Representative cases for judgment</h3></div><button type="button" onClick={() => setView("queue")}>Open demo queue</button></div>
              <div className="case-table" role="table" aria-label="Prioritized review cases">
                <div className="case-row case-header" role="row"><span>Signal</span><span>Product evidence</span><span>Entity confidence</span><span>Public snapshot</span><span>Priority</span></div>
                {reviewCases.slice(0, 4).map((item) => (
                  <button className="case-row" type="button" role="row" key={item.id} onClick={() => { setSelectedId(item.id); setView("queue"); }}>
                    <span><strong>{item.brand}</strong><em>{item.qiId}</em></span>
                    <span><strong>{item.product}</strong><em>{item.productType} · {item.loadPower}W · {item.certificationDate}</em></span>
                    <span><strong>{item.matchConfidence}%</strong><i><b style={{ width: `${item.matchConfidence}%` }} /></i></span>
                    <span><StatusPill state={item.matchState} /></span>
                    <span><strong className={`priority p-${Math.floor(item.score / 20)}`}>{item.score}</strong><em>Review</em></span>
                  </button>
                ))}
              </div>
            </section>
          </div>
        )}

        {view === "changes" && (
          <div className="view-stack">
            <section className="panel change-hero">
              <div><span className="eyebrow">DURABLE SOURCE-CHANGE CONTROL</span><h2>{sourceWorkCount > 0 ? `${sourceWorkCount} events are active.` : "The change queue is clear."}</h2><p>WPC records are canonicalized, fingerprinted, and compared with the previous version. Only new or materially updated evidence creates an agent run.</p></div>
              <div className="change-health"><strong>{sourceWorkCount}</strong><span>active events</span><em>{freshnessLabel(liveData?.status.wpc.lastSuccessAt ?? null)}</em></div>
            </section>

            <section className="metric-grid">
              <article><span>Tracked fingerprints</span><strong>{changeFeed?.trackedProducts ?? "—"}</strong><em>baseline {freshnessLabel(changeFeed?.baselineAt ?? null).toLowerCase()}</em></article>
              <article><span>Pending events</span><strong>{(changeFeed?.pendingCount ?? 0) > 0 ? changeFeed?.pendingCount : "Clear"}</strong><em className={(changeFeed?.pendingCount ?? 0) > 0 ? "amber" : ""}>automatic processing queue</em></article>
              <article><span>Automated runs · 30d</span><strong>{(changeFeed?.completed30d ?? 0) > 0 ? changeFeed?.completed30d : "Ready"}</strong><em>{(changeFeed?.completed30d ?? 0) > 0 ? "persisted agent results" : "waiting for first material change"}</em></article>
              <article><span>Failure handling</span><strong>{(changeFeed?.deadLetterCount ?? 0) > 0 ? changeFeed?.deadLetterCount : "Clear"}</strong><em className={(changeFeed?.deadLetterCount ?? 0) > 0 ? "coral" : ""}>{(changeFeed?.deadLetterCount ?? 0) > 0 ? "private retry required" : "retry and dead-letter queues healthy"}</em></article>
            </section>

            <section className="panel check-ledger">
              <div className="panel-heading"><div><span>LAST-KNOWN-GOOD STATE</span><h3>Successful source-check receipts</h3></div><em>{changeFeed?.recentChecks.length ?? 0} immutable checks shown</em></div>
              {!liveData && <p className="change-empty">Loading successful source checks…</p>}
              {liveData && changeFeed?.recentChecks.length === 0 && <div className="change-empty"><strong>Waiting for the first receipt.</strong><span>The first successful WPC comparison will remain visible here until a newer successful check replaces it.</span></div>}
              {changeFeed?.recentChecks.map((check) => (
                <article className="check-row" key={`${check.checkedAt}:${check.sourceChecksum}`}>
                  <div className="check-time"><span className={`check-outcome ${check.outcome}`}>{check.outcome === "material_changes" ? "Changes detected" : check.outcome === "baseline" ? "Baseline" : "Verified · unchanged"}</span><strong>{exactUtcLabel(check.checkedAt)}</strong><em>successful WPC comparison</em></div>
                  <div className="check-value"><span>Source records</span><strong>{countComparison(check.previousObservedRecords, check.observedRecords)}</strong><em>{check.rawSourceChanged === null ? "first retained snapshot" : check.rawSourceChanged ? "raw source payload changed" : "raw source payload matched"}</em></div>
                  <div className="check-value"><span>Fingerprints compared</span><strong>{countComparison(check.previousMonitoredRecords, check.monitoredRecords)}</strong><em>material certification fields</em></div>
                  <div className="check-value"><span>Material changes</span><strong>{check.materialChanges > 0 ? `${check.materialChanges} found` : "None"}</strong><em>{check.addedProducts} added · {check.updatedProducts} updated</em></div>
                  <div className="check-hash"><span>SHA-256 source receipt</span><code title={check.sourceChecksum}>{check.sourceChecksum.slice(0, 12)}…</code><em>{check.previousSourceChecksum ? `previous ${check.previousSourceChecksum.slice(0, 8)}…` : "baseline digest"}</em></div>
                </article>
              ))}
              <div className="change-contract"><span>✓</span><p>The dashboard serves this last successful state on every visit. A failed or unchanged poll never resets verified values; only a newer successful source check can replace them.</p></div>
            </section>

            <section className="panel change-ledger">
              <div className="panel-heading"><div><span>IMMUTABLE AUDIT LEDGER</span><h3>Recent material changes</h3></div><em>{changeFeed?.agentVersion ?? "live-agent-v1"} · {changeFeed?.policyVersion ?? "licensing-policy-v1"}</em></div>
              {!liveData && <p className="change-empty">Loading the durable change ledger…</p>}
              {liveData && changeFeed?.recent.length === 0 && <div className="change-empty"><strong>Baseline established.</strong><span>Future WPC additions and material field updates will appear here automatically. Repeated source snapshots do not create duplicate work.</span></div>}
              {changeFeed?.recent.map((event) => (
                <article className="change-row" key={event.eventKey}>
                  <div className="change-identity"><span className={`change-kind ${event.changeType}`}>{event.changeType}</span><strong>{event.product.brand} · {event.product.productName}</strong><em>{event.qiId} · observed {freshnessLabel(event.observedAt).toLowerCase()}</em></div>
                  <div className="change-fields"><span>Changed evidence</span><div>{event.changedFields.map((field) => <em key={field}>{changeFieldLabels[field]}</em>)}</div></div>
                  <div className="change-result"><span className={`event-state ${event.status}`}>{event.status.replace("_", " ")}</span>{event.run ? <><strong>{event.run.reviewPriority}/100 · {event.run.requiresHuman ? "human gate" : "monitor"}</strong><em>{event.run.agentVersion} · {event.run.policyVersion}</em></> : <><strong>{event.status === "dead_letter" ? "Operator review required" : "Awaiting automatic agent"}</strong><em>{event.lastError ?? `${event.attempts} processing attempts`}</em></>}</div>
                  <a href={event.product.sourceUrl} target="_blank" rel="noreferrer">Evidence ↗</a>
                </article>
              ))}
              <div className="change-contract"><span>◆</span><p>Idempotency key = source event + product fingerprint + agent version + policy version. A repeated request returns the existing result; it does not create another run.</p></div>
            </section>
          </div>
        )}

        {view === "queue" && (
          <div className="queue-layout">
            <section className="panel queue-list">
              <div className="panel-heading"><div><span>HUMAN-IN-THE-LOOP</span><h3>Review queue</h3></div><em>{activeCases.length} active</em></div>
              <div className="queue-filters"><button className={queueSort === "priority" ? "active" : ""} type="button" onClick={() => setQueueSort("priority")}>Priority</button><button className={queueSort === "newest" ? "active" : ""} type="button" onClick={() => setQueueSort("newest")}>Newest</button><button className={queueSort === "identity" ? "active" : ""} type="button" onClick={() => setQueueSort("identity")}>Identity gaps</button></div>
              {queueCases.map((item) => (
                <button key={item.id} type="button" className={selected.id === item.id ? "queue-card selected" : "queue-card"} onClick={() => setSelectedId(item.id)}>
                  <span className="queue-score">{item.score}</span>
                  <div><strong>{item.brand}</strong><span>{item.product}</span><em>{item.qiId} · {item.signalAge}</em></div>
                  <StatusPill state={item.matchState} />
                </button>
              ))}
            </section>

            <section className="panel evidence-detail">
              <div className="evidence-title"><div><span>CASE {selected.qiId}</span><h2>{selected.brand} · {selected.product}</h2><p>{selected.commercialSignal}</p></div><ScoreRing value={selected.score} label="priority" /></div>
              <div className="evidence-meta"><div><span>Profile</span><strong>{selected.powerProfile} · {selected.loadPower}W</strong></div><div><span>Certified</span><strong>{selected.certificationDate}</strong></div><div><span>Entity confidence</span><strong>{selected.matchConfidence}%</strong></div><div><span>State</span><strong>{decisions[selected.id] ?? selected.stage}</strong></div></div>
              <div className="brief-block"><span>AGENT BRIEF</span><p>The monitored source shows a certified <strong>{selected.productType} product</strong> associated with {selected.brand}. {selected.evidence[1]} The entity-resolution result is <strong>{selected.matchConfidence}% confidence</strong>. Because product certification, public-list membership, and license coverage are distinct facts, the system requests human research rather than asserting status.</p></div>
              <div className="evidence-columns">
                <div><span className="section-label">EVIDENCE</span>{selected.evidence.map((item, index) => <div className="evidence-line" key={item}><span>{String(index + 1).padStart(2, "0")}</span><p>{item}</p></div>)}</div>
                <div><span className="section-label">AGENT TRACE</span>{selectedTrace.map((step) => <div className="trace-line" key={step.agent}><i className={step.status} /><div><strong>{step.agent}</strong><p>{step.output}</p></div><em>{Math.round(step.confidence * 100)}%</em></div>)}</div>
              </div>
              <div className="caution-box"><span>!</span><div><strong>Analytical boundary</strong><p>{selected.caution}</p></div></div>
              <div className="reviewer-access"><div><strong>Reviewer write access</strong><span>Public visitors can preview decisions locally. A 32-byte reviewer secret is required for durable review writes.</span></div><input type="password" autoComplete="off" value={reviewerToken} onChange={(event) => setReviewerToken(event.target.value)} placeholder="Optional reviewer secret" aria-label="Reviewer access secret" /></div>
              <div className="decision-bar"><div><span>{decisionMessages[selected.id] ?? "No decision has been written."}</span><strong>{decisions[selected.id] ? `${persistedDecisions[selected.id] ? "Recorded" : "Previewed"}: ${decisions[selected.id]}` : "Awaiting reviewer"}</strong></div><button type="button" className="return" onClick={() => recordDecision("returned")}>{reviewerToken.trim() ? "Return for research" : "Preview return"}</button><button type="button" className="monitor" onClick={() => recordDecision("monitor")}>{reviewerToken.trim() ? "Monitor" : "Preview monitor"}</button><button type="button" className="approve" onClick={() => recordDecision("approved")}>{reviewerToken.trim() ? "Approve entity link" : "Preview approval"}</button></div>
            </section>
          </div>
        )}

        {view === "agents" && (
          <div className="view-stack">
            <section className="agent-hero panel"><div><span className="eyebrow">BOUNDED MULTI-AGENT SYSTEM</span><h2>Autonomy with an audit trail.</h2><p>{agentRun ? "This representative run demonstrates the five-agent contract without writing to the live change ledger." : latestProcessedChange && latestPersistedRun ? `This persisted run was triggered automatically by ${latestProcessedChange.qiId} evidence changing. It is bound to a source fingerprint, agent version, and policy version for safe replay.` : "Five server-side specialist agents transform source changes into reviewable cases. Every handoff has a typed contract, confidence, evidence references, and an abstention path."}</p>{agentRun ? <em className="run-proof">Verified demo run · {agentRun.runId.slice(0, 8)} · {agentRun.reviewPriority}/100 priority · {agentRun.requiresHuman ? "human gate engaged" : "monitoring permitted"}</em> : latestPersistedRun && <em className="run-proof">Persisted live run · {latestPersistedRun.runId.slice(0, 8)} · {latestPersistedRun.reviewPriority}/100 priority · {latestPersistedRun.requiresHuman ? "human gate engaged" : "monitoring permitted"}</em>}{agentError && <em className="run-error">{agentError}</em>}</div><button className={running ? "run-button running" : "run-button"} disabled={running} onClick={() => void runAgents()} type="button">{running ? "Running trace…" : "Run representative demo"}</button></section>
            <section className="agent-map panel">
              {agentTrace.map((step, index) => <article key={step.agent}><span>{String(index + 1).padStart(2, "0")}</span><div><em>{step.status}</em><h3>{step.agent}</h3><p>{step.output}</p></div><strong>{Math.round(step.confidence * 100)}%</strong></article>)}
            </section>
            <div className="three-up"><article className="panel"><span>CONTRACT</span><h3>Evidence packet</h3><p>Source URI, observed fact, capture time, parser version, checksum, and confidence.</p></article><article className="panel"><span>CONTROL</span><h3>Policy-as-code</h3><p>Forbidden claims, identity threshold, stage transitions, and actions requiring approval.</p></article><article className="panel"><span>EVALUATION</span><h3>Precision before recall</h3><p>High-confidence matches are measured on a labeled set; uncertain cases explicitly abstain.</p></article></div>
          </div>
        )}

        {view === "campaign" && (
          <div className="view-stack">
            <section className="panel campaign-flow"><div className="panel-heading"><div><span>SYNTHETIC CRM</span><h3>Campaign operating flow</h3></div><em>No external actions enabled</em></div><div className="stage-grid">{campaignStages.map((stage, index) => <article key={stage.label} className={`tone-${stage.tone}`}><span>{String(index + 1).padStart(2, "0")}</span><strong>{stage.value}</strong><em>{stage.label}</em></article>)}</div></section>
            <div className="dashboard-grid"><section className="panel"><div className="panel-heading"><div><span>FOLLOW-UP AGING</span><h3>Cases by days since touch</h3></div></div><div className="aging-list"><div><span>0–7 days</span><i><b style={{ width: "82%" }} /></i><strong>18</strong></div><div><span>8–14 days</span><i><b style={{ width: "54%" }} /></i><strong>11</strong></div><div><span>15–30 days</span><i><b style={{ width: "31%" }} /></i><strong>6</strong></div><div><span>30+ days</span><i><b className="late" style={{ width: "21%" }} /></i><strong>4</strong></div></div></section><section className="panel"><div className="panel-heading"><div><span>NEXT-BEST ACTION</span><h3>Agent recommendations</h3></div></div><div className="action-list"><p><span>01</span><strong>Resolve two automotive affiliate mappings</strong><em>High evidence value</em></p><p><span>02</span><strong>Review four aging synthetic follow-ups</strong><em>Internal target exceeded</em></p><p><span>03</span><strong>Validate June source-volume spike</strong><em>Data-quality check</em></p></div></section></div>
          </div>
        )}

        {view === "scenario" && (
          <div className="scenario-layout">
            <section className="panel scenario-controls"><span className="eyebrow">ILLUSTRATIVE MODEL · NOT A LICENSE QUOTE</span><h2>Royalty scenario lab</h2><p>Explore the public rate mechanics with explicit assumptions. Certification counts are never treated as shipment volume.</p><label><span>Annual enterprise units <strong>{annualUnits.toLocaleString()}</strong></span><input type="range" min="0" max="2000000" step="25000" value={annualUnits} onChange={(event) => setAnnualUnits(Number(event.target.value))} /></label><label><span>Illustrative per-product fee <strong>${fee.toFixed(2)}</strong></span><select value={fee} onChange={(event) => setFee(Number(event.target.value))}><option value="0.2">Receiver &gt; 5W · $0.20</option><option value="0.25">1–3 transmitters · $0.25</option><option value="0.5">4–6 transmitters · $0.50</option><option value="0.75">7–9 transmitters · $0.75</option><option value="0.85">10+ transmitters · $0.85</option></select></label><label><span>Illustrative committed-volume discount <strong>{discount}%</strong></span><input type="range" min="0" max="40" step="10" value={discount} onChange={(event) => setDiscount(Number(event.target.value))} /></label><div className="assumption-note"><span>◆</span><p>The first 25,000 annual units are modeled as waived at the enterprise level. The actual agreement controls.</p></div></section>
            <section className="panel scenario-output"><span>BASE SCENARIO</span><strong>${illustrativeRoyalty.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong><em>illustrative annual amount</em><div className="scenario-waterfall"><div><span>Entered units</span><strong>{annualUnits.toLocaleString()}</strong></div><div><span>Illustrative waived units</span><strong>−{Math.min(annualUnits, 25000).toLocaleString()}</strong></div><div><span>Modeled units</span><strong>{royaltyUnits.toLocaleString()}</strong></div><div><span>Gross at ${fee.toFixed(2)}</span><strong>${(royaltyUnits * fee).toLocaleString()}</strong></div><div><span>Illustrative discount</span><strong>−{discount}%</strong></div></div><div className="scenario-range"><div><span>Low · −25%</span><strong>${(illustrativeRoyalty * 0.75).toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong></div><div className="active"><span>Base</span><strong>${illustrativeRoyalty.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong></div><div><span>High · +25%</span><strong>${(illustrativeRoyalty * 1.25).toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong></div></div></section>
          </div>
        )}

        {view === "quality" && (
          <div className="view-stack"><section className="quality-hero panel"><div><span className="eyebrow">SYNTHETIC CONTROL SNAPSHOT</span><h2>Trust is a product feature.</h2><p>This illustrative snapshot demonstrates how source freshness, schema stability, entity evidence, and rule validation would be monitored in production.</p></div><div className="quality-score"><strong>98.7</strong><span>illustrative health</span></div></section><section className="quality-grid">{[{title:"Qi ID uniqueness",value:"100%",state:"pass",note:"0 duplicates"},{title:"Source freshness",value:"6h",state:"pass",note:"within 24h SLA"},{title:"Entity abstention",value:"12.4%",state:"watch",note:"expected safety behavior"},{title:"Schema drift",value:"1",state:"alert",note:"consumer-sale field changed"},{title:"Evidence links",value:"100%",state:"pass",note:"all briefs grounded"},{title:"Future dates",value:"0",state:"pass",note:"validation passed"}].map((item) => <article className="panel" key={item.title}><span className={`dq-state ${item.state}`}>{item.state}</span><h3>{item.title}</h3><strong>{item.value}</strong><p>{item.note}</p></article>)}</section><section className="panel dq-log"><div className="panel-heading"><div><span>ILLUSTRATIVE CONTROL LOG</span><h3>Example checks</h3></div></div><div><p><span>09:42:18</span><strong>Referential integrity</strong><em>pass · 18,442 relationships</em></p><p><span>09:42:16</span><strong>Source schema contract</strong><em className="warn">watch · 1 additive field</em></p><p><span>09:42:12</span><strong>Public-list snapshot diff</strong><em>pass · 2 changes queued</em></p><p><span>09:42:09</span><strong>Entity-match evaluation</strong><em>pass · precision 93.4%</em></p></div></section></div>
        )}
      </section>
    </main>
  );
}
