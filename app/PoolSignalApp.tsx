"use client";

import { useMemo, useState } from "react";
import {
  campaignStages,
  certificationTrend,
  reviewCases,
  type ReviewCase,
} from "../lib/demo-data";

type View = "overview" | "agents" | "queue" | "campaign" | "scenario" | "quality";

const navItems: { id: View; label: string; glyph: string }[] = [
  { id: "overview", label: "Mission control", glyph: "◈" },
  { id: "agents", label: "Agent fabric", glyph: "⌘" },
  { id: "queue", label: "Review queue", glyph: "◎" },
  { id: "campaign", label: "Campaign flow", glyph: "↗" },
  { id: "scenario", label: "Scenario lab", glyph: "△" },
  { id: "quality", label: "Data quality", glyph: "◇" },
];

const matchCopy = {
  none: "No public-list match",
  possible: "Possible entity match",
  "public-list": "Public-list match",
};

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
  const [annualUnits, setAnnualUnits] = useState(250000);
  const [fee, setFee] = useState(0.25);
  const [discount, setDiscount] = useState(10);

  const selected = reviewCases.find((item) => item.id === selectedId) ?? reviewCases[0];
  const royaltyUnits = Math.max(annualUnits - 25000, 0);
  const illustrativeRoyalty = royaltyUnits * fee * (1 - discount / 100);
  const activeCases = useMemo(() => reviewCases.filter((item) => item.stage === "review"), []);

  function runAgents() {
    setRunning(true);
    window.setTimeout(() => setRunning(false), 1450);
  }

  async function recordDecision(decision: "approved" | "returned" | "monitor") {
    setDecisions((current) => ({ ...current, [selected.id]: decision }));
    try {
      await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId: selected.id,
          qiId: selected.qiId,
          brand: selected.brand,
          productName: selected.product,
          priority: selected.score,
          publicListMatch: selected.matchState,
          decision,
          rationale: "Portfolio demonstration decision",
        }),
      });
    } catch {
      // The deployed database is progressive enhancement; the demo remains usable offline.
    }
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
            </button>
          ))}
        </nav>

        <div className="sidebar-card">
          <span className="live-dot" />
          <div><strong>Evidence graph live</strong><span>Last refresh 09:42 ET</span></div>
        </div>
        <div className="sidebar-footer"><span>Demo environment</span><strong>Public + synthetic data</strong></div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">QI WIRELESS POWER · INTELLIGENCE CONSOLE</span>
            <h1>{navItems.find((item) => item.id === view)?.label}</h1>
          </div>
          <div className="topbar-actions">
            <button className="quiet-button" type="button"><span>⌕</span> Search evidence</button>
            <button className={running ? "run-button running" : "run-button"} type="button" onClick={runAgents}>
              <span>{running ? "•••" : "✦"}</span>{running ? "Agents working" : "Run intelligence cycle"}
            </button>
          </div>
        </header>

        {view === "overview" && (
          <div className="view-stack">
            <section className="signal-hero">
              <div className="hero-copy">
                <span className="hero-kicker"><i /> HUMAN REVIEW GATE</span>
                <h2>A review-worthy signal surfaced.</h2>
                <p>{selected.brand} registered a {selected.loadPower}W {selected.powerProfile} {selected.productType} product. The system found evidence worth investigating and stopped before making a licensing conclusion.</p>
                <div className="hero-actions">
                  <button type="button" onClick={() => setView("queue")}>Inspect evidence <span>→</span></button>
                  <a href={selected.sourceUrl} target="_blank" rel="noreferrer">Open source record ↗</a>
                </div>
              </div>
              <div className="hero-score">
                <ScoreRing value={selected.score} label="review priority" />
                <div className="score-context"><span>Why now</span><strong>Recent · 25W · entity unresolved</strong></div>
              </div>
              <div className="hero-grid" aria-hidden="true" />
            </section>

            <section className="metric-grid">
              <article><span>New certifications · 30d</span><strong>23</strong><em>↑ 18% vs prior period</em></article>
              <article><span>Cases awaiting review</span><strong>08</strong><em className="amber">4 identity-sensitive</em></article>
              <article><span>High-confidence matches</span><strong>93.4%</strong><em>on labeled evaluation set</em></article>
              <article><span>Follow-ups aging</span><strong>04</strong><em className="coral">past internal target</em></article>
            </section>

            <div className="dashboard-grid">
              <section className="panel agent-panel">
                <div className="panel-heading"><div><span>AGENT FABRIC</span><h3>Evidence-to-decision trace</h3></div><button type="button" onClick={() => setView("agents")}>View run log</button></div>
                <div className="agent-rail">
                  {selected.trace.map((step, index) => (
                    <div className="agent-node" key={step.agent}>
                      <span className={`agent-orb ${step.status}`}>{index + 1}</span>
                      <div><strong>{step.agent}</strong><span>{step.task}</span></div>
                      <em>{Math.round(step.confidence * 100)}%</em>
                    </div>
                  ))}
                </div>
                <div className="policy-banner"><span>◆</span><div><strong>Policy gate engaged</strong><p>Identity resolution is below threshold. The system may recommend research, but cannot advance this case without a person.</p></div></div>
              </section>

              <section className="panel trend-panel">
                <div className="panel-heading"><div><span>MARKET SIGNAL</span><h3>Certification velocity</h3></div><em>7 months</em></div>
                <div className="bar-chart" aria-label="Monthly certification velocity">
                  {certificationTrend.map((item) => <div key={item.month}><span style={{ height: `${item.value}%` }} /><em>{item.month}</em></div>)}
                </div>
                <div className="chart-note"><strong>June acceleration</strong><span>Certification volume reached the monitored-period high.</span></div>
              </section>
            </div>

            <section className="panel queue-preview">
              <div className="panel-heading"><div><span>PRIORITIZED REVIEW</span><h3>Cases that need judgment</h3></div><button type="button" onClick={() => setView("queue")}>Open full queue</button></div>
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

        {view === "queue" && (
          <div className="queue-layout">
            <section className="panel queue-list">
              <div className="panel-heading"><div><span>HUMAN-IN-THE-LOOP</span><h3>Review queue</h3></div><em>{activeCases.length} active</em></div>
              <div className="queue-filters"><button className="active" type="button">Priority</button><button type="button">Newest</button><button type="button">Identity gaps</button></div>
              {reviewCases.map((item) => (
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
                <div><span className="section-label">AGENT TRACE</span>{selected.trace.map((step) => <div className="trace-line" key={step.agent}><i className={step.status} /><div><strong>{step.agent}</strong><p>{step.output}</p></div><em>{Math.round(step.confidence * 100)}%</em></div>)}</div>
              </div>
              <div className="caution-box"><span>!</span><div><strong>Analytical boundary</strong><p>{selected.caution}</p></div></div>
              <div className="decision-bar"><div><span>Decision is recorded with evidence and timestamp.</span><strong>{decisions[selected.id] ? `Recorded: ${decisions[selected.id]}` : "Awaiting reviewer"}</strong></div><button type="button" className="return" onClick={() => recordDecision("returned")}>Return for research</button><button type="button" className="monitor" onClick={() => recordDecision("monitor")}>Monitor</button><button type="button" className="approve" onClick={() => recordDecision("approved")}>Approve entity link</button></div>
            </section>
          </div>
        )}

        {view === "agents" && (
          <div className="view-stack">
            <section className="agent-hero panel"><div><span className="eyebrow">BOUNDED MULTI-AGENT SYSTEM</span><h2>Autonomy with an audit trail.</h2><p>Five specialist agents transform source signals into a reviewable case. Every handoff has a typed contract, confidence, evidence references, and an abstention path.</p></div><button className={running ? "run-button running" : "run-button"} onClick={runAgents} type="button">{running ? "Running trace…" : "Replay selected case"}</button></section>
            <section className="agent-map panel">
              {selected.trace.map((step, index) => <article key={step.agent}><span>{String(index + 1).padStart(2, "0")}</span><div><em>{step.status}</em><h3>{step.agent}</h3><p>{step.output}</p></div><strong>{Math.round(step.confidence * 100)}%</strong></article>)}
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
          <div className="view-stack"><section className="quality-hero panel"><div><span className="eyebrow">DATA RELIABILITY</span><h2>Trust is a product feature.</h2><p>Every agent decision is downstream of source freshness, schema stability, entity evidence, and rule validation.</p></div><div className="quality-score"><strong>98.7</strong><span>health score</span></div></section><section className="quality-grid">{[{title:"Qi ID uniqueness",value:"100%",state:"pass",note:"0 duplicates"},{title:"Source freshness",value:"6h",state:"pass",note:"within 24h SLA"},{title:"Entity abstention",value:"12.4%",state:"watch",note:"expected safety behavior"},{title:"Schema drift",value:"1",state:"alert",note:"consumer-sale field changed"},{title:"Evidence links",value:"100%",state:"pass",note:"all briefs grounded"},{title:"Future dates",value:"0",state:"pass",note:"validation passed"}].map((item) => <article className="panel" key={item.title}><span className={`dq-state ${item.state}`}>{item.state}</span><h3>{item.title}</h3><strong>{item.value}</strong><p>{item.note}</p></article>)}</section><section className="panel dq-log"><div className="panel-heading"><div><span>CONTROL LOG</span><h3>Recent checks</h3></div></div><div><p><span>09:42:18</span><strong>Referential integrity</strong><em>pass · 18,442 relationships</em></p><p><span>09:42:16</span><strong>Source schema contract</strong><em className="warn">watch · 1 additive field</em></p><p><span>09:42:12</span><strong>Public-list snapshot diff</strong><em>pass · 2 changes queued</em></p><p><span>09:42:09</span><strong>Entity-match evaluation</strong><em>pass · precision 93.4%</em></p></div></section></div>
        )}
      </section>
    </main>
  );
}
