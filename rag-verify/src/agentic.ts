import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { Document } from '@langchain/core/documents';
import { MisinformationDetector, NewsArticle } from './detector';

// ==============================
// TYPES
// ==============================
interface AgenticVerificationResult {
  isVerified: boolean;
  confidence: number;
  evidence: NewsArticle[];
  analysis: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  factCheckSummary: string;
  agentInsights: {
    claimAnalyst: string;
    evidenceResearcher: string;
    factChecker: string;
    synthesizer: string;
  };
  searchQueries: string[];
  evidenceSources: number;
}

interface ToolResult {
  success: boolean;
  data: any;
  message: string;
}

type UpdateCallback = (msg: string) => void;

interface EvidenceContext {
  searchQueries: string[];
  newsArticles: NewsArticle[];
  kbDocs: Document[];
  summary: string;
}

// ==============================
// AGENTIC RAG SYSTEM
// ==============================
class AgenticRAGVerifier {
  private detector: MisinformationDetector;
  private llm: ChatGoogleGenerativeAI;
  private onUpdate?: UpdateCallback;

  constructor(detector: MisinformationDetector, onUpdate?: UpdateCallback) {
    this.detector = detector;
    this.onUpdate = onUpdate;
    this.llm = new ChatGoogleGenerativeAI({
      apiKey: process.env.GEMINI_API_KEY,
      modelName: 'gemini-2.5-flash',
      temperature: 0.3,
      maxOutputTokens: 1500,
    });
  }

  private step(message: string) {
    console.log(message);
    this.onUpdate?.(message);
  }

  // ==============================
  // TOOL: ANALYZE CLAIM
  // ==============================
  private async toolAnalyzeClaim(claim: string): Promise<ToolResult> {
    try {
      this.step(`🔧 Analyzing claim structure...`);
      const analysis = await this.detector.analyzeClaim(claim);
      return {
        success: true,
        data: analysis,
        message: `Extracted ${analysis.extractedClaims.length} sub-claims & ${analysis.keywords.length} keywords`,
      };
    } catch {
      return {
        success: false,
        data: { keywords: claim.split(' ').slice(0, 5) },
        message: 'Partial analysis fallback executed',
      };
    }
  }

  // ==============================
  // AGENT 1: CLAIM ANALYST
  // ==============================
  private async runClaimAnalyst(claim: string): Promise<string> {
    this.step(`🔍 Stage 1 — Claim Analyst running...`);
    try {
      const analysisResult = await this.toolAnalyzeClaim(claim);

      const prompt = `You are a Claim Analyst Agent. Your goal is to prepare the claim for downstream fact-checking.

Claim: "${claim}"

Tool Analysis:
${JSON.stringify(analysisResult.data, null, 2)}

Return a clear analysis with:
- Main claim and sub-claims
- Key entities, locations, dates, and numbers to verify
- Whether the claim is vague or specific
- 3–5 high-level search strategies to verify this claim.

Keep it structured and concise.`;

      const response = await this.llm.invoke(prompt);
      const output = response.content as string;
      this.step(`✅ Claim Analyst completed`);
      return output;
    } catch {
      this.step(`⚠️ Claim Analyst fallback executed`);
      return `Fallback claim analysis for: "${claim}". Key terms: ${claim
        .split(' ')
        .slice(0, 8)
        .join(', ')}`;
    }
  }

  // ==============================
  // AGENT 2: EVIDENCE RESEARCHER
  // (fetch → store → retrieve RAG)
  // ==============================
  private async runEvidenceResearcher(
    claim: string,
    analystOutput: string
  ): Promise<EvidenceContext> {
    this.step(`📚 Stage 2 — Evidence Researcher running...`);

    try {
      // 1) Generate search queries from analyst output
      const qPrompt = `You are an Evidence Researcher Agent.

From the following claim analysis, generate exactly 3 diverse search queries that will help verify the claim:

${analystOutput}

Rules:
- One query should be very specific (include dates/locations if present).
- One query should be broader and contextual.
- One query should explicitly include the word "fact check" or "hoax".
- Return ONLY the 3 queries, one per line, no bullets or extra text.`;

      const qResult = await this.llm.invoke(qPrompt);

      const searchQueries = (qResult.content as string)
        .split('\n')
        .map(q => q.trim())
        .filter(Boolean)
        .slice(0, 3);

      this.step(`📌 Generated queries: ${searchQueries.join(' | ')}`);

      // 2) Fetch news for each query, store into vector DB
      const newsArticles: NewsArticle[] = [];

      for (const q of searchQueries) {
        this.step(`📰 Searching Google News for: "${q}"`);
        const fresh = await this.detector.fetchGoogleNewsSearch(q);

        if (fresh.length > 0) {
          newsArticles.push(...fresh.slice(0, 5));

          try {
            await this.detector.storeNewsArticles(fresh);
            this.step(`💾 Stored ${fresh.length} articles for query "${q}" in vector DB`);
          } catch (e: any) {
            this.step(`⚠️ Failed to store articles for "${q}": ${e?.message ?? 'unknown error'}`);
          }
        }

        // small delay to avoid rate limits
        await new Promise(res => setTimeout(res, 800));
      }

      // 3) Now retrieve relevant evidence from vector DB (RAG)
      this.step(`🔎 Finding relevant evidence from vector store...`);
      const kbDocs = await this.detector.findRelevantEvidence(claim, 15);

      const summary = `Evidence summary:
- Search Queries: ${searchQueries.join(', ')}
- News Articles fetched: ${newsArticles.length}
- KB Docs (vector hits): ${kbDocs.length}`;

      this.step(
        `📚 Evidence Researcher completed (Articles: ${newsArticles.length}, KB docs: ${kbDocs.length})`
      );

      return {
        searchQueries,
        newsArticles,
        kbDocs,
        summary,
      };
    } catch {
      this.step(`⚠️ Evidence Researcher fallback executed`);
      return {
        searchQueries: [],
        newsArticles: [],
        kbDocs: [],
        summary: `Evidence fallback summary for claim: "${claim}"`,
      };
    }
  }

  // ==============================
  // AGENT 3: FACT CHECKER
  // ==============================
  private async runFactChecker(
    claim: string,
    analystOutput: string,
    evidence: EvidenceContext
  ): Promise<string> {
    this.step(`⚖️ Stage 3 — Fact Checker running...`);
    try {
      // Build a compact textual evidence bundle from KB docs
      const kbSnippets = evidence.kbDocs.slice(0, 6).map((doc, idx) => {
        const src = (doc.metadata as any)?.source || (doc.metadata as any)?.link || 'unknown';
        const date = (doc.metadata as any)?.date || 'unknown date';
        const snippet = (doc.pageContent || '').slice(0, 260).replace(/\s+/g, ' ');
        return `[#${idx + 1}] Source: ${src} (${date})\n${snippet}...`;
      });

      const prompt = `You are a professional fact-checker.

TASK: Decide whether the claim is SUPPORTED, REFUTED, or INCONCLUSIVE based on the evidence.

Claim:
${claim}

Claim Analyst Notes:
${analystOutput}

Evidence Summary:
${evidence.summary}

Detailed Evidence Snippets:
${kbSnippets.join('\n\n')}

INSTRUCTIONS:
- Carefully weigh all evidence.
- Use majority evidence and more recent evidence when there is conflict.
- VERDICT rules:
  • If most strong, recent sources clearly support the claim → VERDICT: SUPPORTED
  • If strong evidence clearly contradicts the claim → VERDICT: REFUTED
  • If evidence is mixed / weak / not directly about the claim → VERDICT: INCONCLUSIVE

Return your answer in this exact format:

VERDICT: SUPPORTED | REFUTED | INCONCLUSIVE
REASONING: <2–4 sentences explaining why, referencing snippet indices like [#1], [#2], etc.>`;

      const response = await this.llm.invoke(prompt);
      this.step(`✅ Fact Checker completed`);
      return response.content as string;
    } catch {
      this.step(`⚠️ Fact Checker fallback executed`);
      return `VERDICT: INCONCLUSIVE
REASONING: Fact-checker fallback: unable to fully verify. Treat the claim as unconfirmed and require more evidence.`;
    }
  }

  // ==============================
  // SAFE STRING HELPERS
  // ==============================
  private safeField(v: any): string {
    if (typeof v === 'string') return v;
    if (!v) return 'Unknown';
    if (typeof v === 'object') {
      try {
        return JSON.stringify(v).slice(0, 120);
      } catch {
        return '[object]';
      }
    }
    return String(v);
  }

  private mapEvidence(docs: Document[]): NewsArticle[] {
    return docs.slice(0, 8).map(doc => ({
      title: this.safeField((doc.metadata as any)?.title ?? (doc.metadata as any)?.source ?? 'Untitled source'),
      snippet: this.safeField(doc.pageContent).slice(0, 200) + '...',
      link: (doc.metadata as any)?.link ?? undefined,
      date: this.safeField((doc.metadata as any)?.date),
      source: this.safeField((doc.metadata as any)?.source ?? 'Unknown'),
    }));
  }

  // ==============================
  // SYNTHESIS — FINAL VERDICT
  // ==============================
  private async synthesizeResults(
    claim: string,
    analystOutput: string,
    evidence: EvidenceContext,
    factCheckerOutput: string
  ): Promise<AgenticVerificationResult> {
    this.step(`🎯 Stage 4 — Synthesizing results...`);

    // include top news headlines as extra context
    const topNewsLines = evidence.newsArticles.slice(0, 5).map(a =>
      `- "${a.title}" (Source: ${a.source ?? 'Unknown'}, Date: ${a.date})`
    );

    const synthesisPrompt = `You are a Synthesis Expert. Combine all agent outputs into a final verdict.

Claim:
"${claim}"

=== CLAIM ANALYST OUTPUT ===
${analystOutput}

=== EVIDENCE RESEARCHER OUTPUT ===
Search Queries: ${evidence.searchQueries.join(', ')}
News Articles Count: ${evidence.newsArticles.length}
KB Docs Count: ${evidence.kbDocs.length}

Top News Headlines:
${topNewsLines.join('\n')}

=== FACT CHECKER OUTPUT (TEXT) ===
${factCheckerOutput}

Important: The Fact Checker includes a line starting with "VERDICT:". You MUST respect and interpret it as:
- VERDICT: SUPPORTED   → the claim is factually supported by the evidence.
- VERDICT: REFUTED     → the claim is factually false according to the evidence.
- VERDICT: INCONCLUSIVE → the evidence is not strong/clear enough to decide.

Your job:
Return ONLY a valid JSON object with fields:

{
  "isVerified": boolean,
  "confidence": number,        // 0-100
  "riskLevel": "LOW" | "MEDIUM" | "HIGH",
  "analysis": "2-3 sentence technical analysis for internal use",
  "factCheckSummary": "2-3 sentence user-friendly explanation",
  "keyFindings": ["bullet 1", "bullet 2", "bullet 3"]
}

Mapping rules:
- If VERDICT is SUPPORTED:
    - "isVerified": true
    - "confidence": usually between 70 and 95 depending on how strong and consistent the evidence is.
- If VERDICT is REFUTED:
    - "isVerified": false
    - "confidence": usually between 70 and 95.
- If VERDICT is INCONCLUSIVE:
    - "isVerified": false
    - "confidence": 60 or lower.
- If evidence is weak or conflicting, set confidence <= 60 and riskLevel at least "MEDIUM".
- If you cannot decide AT ALL, treat it as INCONCLUSIVE and follow the rule above.`;

    try {
      // Access detector's underlying model + JSON extractor in a type-safe-ish way
      const model = (this.detector as any).genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
        generationConfig: { maxOutputTokens: 800, temperature: 0.15 },
      });

      const result = await model.generateContent(synthesisPrompt);
      const rawText = result.response.text();
      const parsed = (this.detector as any).extractJsonFromResponse(rawText);

      this.step(`🎯 Synthesis completed`);

      const mappedEvidence = this.mapEvidence(evidence.kbDocs);

      return {
        isVerified: Boolean(parsed.isVerified),
        confidence: Number(parsed.confidence ?? 50),
        riskLevel: (parsed.riskLevel as 'LOW' | 'MEDIUM' | 'HIGH') ?? 'MEDIUM',
        factCheckSummary:
          parsed.factCheckSummary ||
          'No clear conclusion available based on the current evidence.',
        analysis:
          parsed.analysis ||
          'Analysis generated from the combined outputs of claim analyst, evidence researcher, and fact checker.',
        evidence: mappedEvidence,
        agentInsights: {
          claimAnalyst: analystOutput,
          evidenceResearcher: evidence.summary,
          factChecker: factCheckerOutput,
          synthesizer: JSON.stringify(parsed.keyFindings ?? [], null, 2),
        },
        searchQueries: evidence.searchQueries,
        evidenceSources: evidence.kbDocs.length,
      };
    } catch {
      this.step(`⚠️ Synthesis fallback executed`);

      const mappedEvidence = this.mapEvidence(evidence.kbDocs);

      return {
        isVerified: false,
        confidence: 50,
        riskLevel: 'MEDIUM',
        factCheckSummary:
          'Evidence is inconclusive at this time. The claim should be treated as unverified and handled with caution.',
        analysis: 'Fallback synthesis executed due to an error in the primary synthesis model.',
        evidence: mappedEvidence,
        agentInsights: {
          claimAnalyst: analystOutput,
          evidenceResearcher: evidence.summary,
          factChecker: factCheckerOutput,
          synthesizer: 'Fallback synthesizer used; no structured key findings available.',
        },
        searchQueries: evidence.searchQueries,
        evidenceSources: evidence.kbDocs.length,
      };
    }
  }

  // ==============================
  // MAIN ENTRYPOINT
  // ==============================
  async verifyClaimAgentic(claim: string): Promise<AgenticVerificationResult> {
    this.step(`🤖 Starting Agentic Verification`);
    this.step(`📌 Claim: "${claim}"`);

    // 1) Claim analysis
    const analystOutput = await this.runClaimAnalyst(claim);

    // 2) Evidence research (Google News fetch → store → vector similarity)
    const evidenceContext = await this.runEvidenceResearcher(claim, analystOutput);

    // 3) Fact checker uses same evidence context
    const factCheckerOutput = await this.runFactChecker(
      claim,
      analystOutput,
      evidenceContext
    );

    // 4) Synthesis — final result
    const final = await this.synthesizeResults(
      claim,
      analystOutput,
      evidenceContext,
      factCheckerOutput
    );

    this.step(`🏁 Verification complete`);
    return final;
  }
}

export { AgenticRAGVerifier, AgenticVerificationResult };
