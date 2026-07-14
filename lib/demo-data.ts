export type MatchState = "none" | "possible" | "public-list";
export type CaseStage = "review" | "monitor" | "approved" | "returned";

export type AgentStep = {
  agent: string;
  task: string;
  status: "complete" | "waiting" | "blocked";
  confidence: number;
  output: string;
};

export type ReviewCase = {
  id: string;
  qiId: string;
  brand: string;
  product: string;
  partNumber: string;
  productType: "PTx" | "PRx";
  powerProfile: string;
  loadPower: number;
  certificationDate: string;
  signalAge: string;
  score: number;
  matchConfidence: number;
  matchState: MatchState;
  stage: CaseStage;
  commercialSignal: string;
  caution: string;
  sourceUrl: string;
  evidence: string[];
  trace: AgentStep[];
};

export const reviewCases: ReviewCase[] = [
  {
    id: "case-hx-27167",
    qiId: "QI-27167",
    brand: "HX",
    product: "Magnetic wireless charger",
    partNumber: "X208-PJ002-X200-CX046",
    productType: "PTx",
    powerProfile: "MPP25",
    loadPower: 25,
    certificationDate: "2026-06-19",
    signalAge: "25 days",
    score: 88,
    matchConfidence: 34,
    matchState: "none",
    stage: "review",
    commercialSignal: "New 25W transmitter certification with consumer-sale potential.",
    caution: "Brand-to-legal-entity identity is unresolved. No licensing conclusion is permitted.",
    sourceUrl: "https://jpsapi.wirelesspowerconsortium.com/products/qi/27167",
    evidence: [
      "WPC lists the record as a certified PTx product.",
      "The MPP25 profile indicates a 25W magnetic charging product.",
      "No deterministic legal-entity match cleared the 0.85 approval threshold.",
      "No public-list match was found in the dated Via snapshot; this is not a licensing conclusion.",
    ],
    trace: [
      { agent: "Scout", task: "Detect new certification", status: "complete", confidence: 1, output: "New QI-27167 record entered the monitored window." },
      { agent: "Resolver", task: "Resolve brand to entity", status: "blocked", confidence: 0.34, output: "HX is too ambiguous; abstained from auto-linking." },
      { agent: "Coverage", task: "Compare public snapshot", status: "complete", confidence: 0.92, output: "No exact or approved affiliate match found." },
      { agent: "Prioritizer", task: "Rank review need", status: "complete", confidence: 0.88, output: "High recency and product relevance; identity uncertainty raises review need." },
      { agent: "Policy gate", task: "Authorize next action", status: "waiting", confidence: 1, output: "Human evidence review required. Outreach is disabled." },
    ],
  },
  {
    id: "case-geyoto-26501",
    qiId: "QI-26501",
    brand: "GEYOTO",
    product: "Wireless Charger",
    partNumber: "YS1800 series",
    productType: "PTx",
    powerProfile: "MPP25",
    loadPower: 25,
    certificationDate: "2026-01-28",
    signalAge: "168 days",
    score: 84,
    matchConfidence: 76,
    matchState: "possible",
    stage: "review",
    commercialSignal: "Multi-region part-number family and 25W transmitter profile.",
    caution: "Candidate entity match is probabilistic and must be verified by a person.",
    sourceUrl: "https://jpsapi.wirelesspowerconsortium.com/products/qi/26501",
    evidence: [
      "The source record lists regional part-number variants.",
      "The product is classified as a PTx with 25W potential load power.",
      "A domain and normalized-name match produced a candidate entity, below the approval threshold.",
    ],
    trace: [
      { agent: "Scout", task: "Cluster product family", status: "complete", confidence: 0.95, output: "Twelve regional part-number variants grouped as one family." },
      { agent: "Resolver", task: "Resolve brand to entity", status: "waiting", confidence: 0.76, output: "Probable manufacturer candidate; human confirmation requested." },
      { agent: "Coverage", task: "Compare public snapshot", status: "complete", confidence: 0.91, output: "No approved entity link to a public-list record." },
      { agent: "Prioritizer", task: "Rank review need", status: "complete", confidence: 0.84, output: "High product relevance and market breadth." },
      { agent: "Policy gate", task: "Authorize next action", status: "waiting", confidence: 1, output: "Entity approval required before workflow advancement." },
    ],
  },
  {
    id: "case-luxshare-25497",
    qiId: "QI-25497",
    brand: "Luxshare-ICT",
    product: "Wireless Phone Charger",
    partNumber: "WPC066",
    productType: "PTx",
    powerProfile: "EPP",
    loadPower: 15,
    certificationDate: "2026-02-09",
    signalAge: "156 days",
    score: 78,
    matchConfidence: 81,
    matchState: "possible",
    stage: "review",
    commercialSignal: "Automotive inline assembly indicator with 15W transmitter profile.",
    caution: "The responsible offering entity may differ from the certified manufacturer.",
    sourceUrl: "https://jpsapi.wirelesspowerconsortium.com/products/qi/25497",
    evidence: [
      "WPC marks the product as an automotive charger for inline assembly.",
      "The product is not marked for direct consumer sale.",
      "Corporate-family resolution remains below the auto-approval threshold.",
    ],
    trace: [
      { agent: "Scout", task: "Classify market signal", status: "complete", confidence: 0.96, output: "Automotive integration signal detected." },
      { agent: "Resolver", task: "Map corporate family", status: "waiting", confidence: 0.81, output: "Likely corporate family; affiliate boundary is unresolved." },
      { agent: "Coverage", task: "Compare public snapshot", status: "complete", confidence: 0.9, output: "No deterministic public-list match approved." },
      { agent: "Prioritizer", task: "Rank review need", status: "complete", confidence: 0.78, output: "Automotive relevance offsets non-consumer sale indicator." },
      { agent: "Policy gate", task: "Authorize next action", status: "waiting", confidence: 1, output: "Human review remains mandatory." },
    ],
  },
  {
    id: "case-tesla-13848",
    qiId: "QI-13848",
    brand: "Tesla",
    product: "Wireless Phone Charger",
    partNumber: "WC5",
    productType: "PTx",
    powerProfile: "EPP",
    loadPower: 15,
    certificationDate: "2022-12-22",
    signalAge: "historical",
    score: 62,
    matchConfidence: 99,
    matchState: "none",
    stage: "monitor",
    commercialSignal: "High-confidence entity identity, but the certification is not recent.",
    caution: "Public-list absence alone does not establish coverage or licensing status.",
    sourceUrl: "https://jpsapi.wirelesspowerconsortium.com/products/qi/13848",
    evidence: [
      "The product is an automotive PTx record with 15W load power.",
      "Legal-entity resolution is high confidence.",
      "Recency weighting keeps the case below active-review priority.",
    ],
    trace: [
      { agent: "Scout", task: "Assess recency", status: "complete", confidence: 1, output: "Historical certification; no new-activity trigger." },
      { agent: "Resolver", task: "Resolve legal entity", status: "complete", confidence: 0.99, output: "High-confidence entity resolution." },
      { agent: "Coverage", task: "Compare public snapshot", status: "complete", confidence: 0.94, output: "No public-list match found; conclusion prohibited." },
      { agent: "Prioritizer", task: "Rank review need", status: "complete", confidence: 0.84, output: "Monitor tier because the source signal is historical." },
      { agent: "Policy gate", task: "Authorize next action", status: "complete", confidence: 1, output: "Monitoring only; no workflow escalation." },
    ],
  },
  {
    id: "case-convenient-12691",
    qiId: "QI-12691",
    brand: "ConvenientPower",
    product: "CPS4038 EVB",
    partNumber: "CPS4038",
    productType: "PRx",
    powerProfile: "BPP",
    loadPower: 5,
    certificationDate: "2022-06-10",
    signalAge: "historical",
    score: 29,
    matchConfidence: 97,
    matchState: "public-list",
    stage: "monitor",
    commercialSignal: "Evaluation module, not marked for consumer sale.",
    caution: "Component and evaluation-module records require product-scope care.",
    sourceUrl: "https://jpsapi.wirelesspowerconsortium.com/products/qi/12691",
    evidence: [
      "WPC identifies an evaluation-board receiver record.",
      "The record is not marked for consumer sale.",
      "A high-confidence normalized-name match exists in the Via public snapshot.",
    ],
    trace: [
      { agent: "Scout", task: "Classify product", status: "complete", confidence: 0.98, output: "Evaluation module; low commercial-review relevance." },
      { agent: "Resolver", task: "Resolve legal entity", status: "complete", confidence: 0.97, output: "Matched to ConvenientPower HK Limited." },
      { agent: "Coverage", task: "Compare public snapshot", status: "complete", confidence: 0.97, output: "Public-list entity match found." },
      { agent: "Prioritizer", task: "Rank review need", status: "complete", confidence: 0.93, output: "Monitor only." },
      { agent: "Policy gate", task: "Authorize next action", status: "complete", confidence: 1, output: "No action proposed." },
    ],
  },
];

export const certificationTrend = [
  { month: "Jan", value: 64 },
  { month: "Feb", value: 71 },
  { month: "Mar", value: 58 },
  { month: "Apr", value: 82 },
  { month: "May", value: 76 },
  { month: "Jun", value: 96 },
  { month: "Jul", value: 43 },
];

export const campaignStages = [
  { label: "New signals", value: 23, tone: "cyan" },
  { label: "Entity research", value: 11, tone: "violet" },
  { label: "Human review", value: 8, tone: "amber" },
  { label: "Campaign ready", value: 4, tone: "green" },
  { label: "Monitoring", value: 17, tone: "slate" },
];
