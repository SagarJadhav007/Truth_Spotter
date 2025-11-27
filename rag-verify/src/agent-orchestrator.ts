import { aisdk } from '@openai/agents-extensions';
import { google } from '@ai-sdk/google';
import { Agent, run } from '@openai/agents';
import { MisinformationDetector, NewsArticle } from './detector';
import { Document } from '@langchain/core/documents';
import { createAgentTools } from './agent-tools';
import { createAgents } from './agents';

// ==============================
// TYPES
// ==============================

export interface AgenticVerificationResult {
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

type UpdateCallback = (msg: string) => void;

// ==============================
// ORCHESTRATOR CLASS
// ==============================

export class AgentOrchestrator {
  private detector: MisinformationDetector;
  private model: any;
  private onUpdate?: UpdateCallback;
  private agentInsights: {
    claimAnalyst: string;
    evidenceResearcher: string;
    factChecker: string;
    synthesizer: string;
  } = {
    claimAnalyst: '',
    evidenceResearcher: '',
    factChecker: '',
    synthesizer: '',
  };
  private searchQueries: string[] = [];
  private evidenceDocs: Document[] = [];
  private isRunning: boolean = false;
  private timeoutMs: number = 120000; // 2 minutes timeout

  constructor(detector: MisinformationDetector, onUpdate?: UpdateCallback) {
    this.detector = detector;
    this.onUpdate = onUpdate;

    // Initialize Gemini model using AI SDK extensions
    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      throw new Error('GOOGLE_GENERATIVE_AI_API_KEY is required');
    }

    this.model = aisdk(google('gemini-2.5-flash'));
  }

  private step(message: string) {
    console.log(message);
    this.onUpdate?.(message);
  }

  private mapEvidenceToNewsArticles(docs: Document[]): NewsArticle[] {
    // Limit to prevent memory issues
    return docs.slice(0, 5).map((doc) => ({
      title: (doc.metadata as any)?.title ?? (doc.metadata as any)?.source ?? 'Untitled source',
      snippet: (doc.pageContent || '').slice(0, 150) + '...',
      link: (doc.metadata as any)?.link ?? undefined,
      date: (doc.metadata as any)?.date ?? 'Unknown date',
      source: (doc.metadata as any)?.source ?? 'Unknown',
    }));
  }

  private cleanup() {
    // Clear large objects to free memory
    this.evidenceDocs = [];
    this.searchQueries = [];
    this.isRunning = false;
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  }

  async verifyClaimAgentic(claim: string): Promise<AgenticVerificationResult> {
    if (this.isRunning) {
      throw new Error('Verification already in progress');
    }

    this.isRunning = true;
    this.step(`🤖 Starting Agentic Verification`);
    this.step(`📌 Claim: "${claim}"`);

    // Reset state
    this.agentInsights = {
      claimAnalyst: '',
      evidenceResearcher: '',
      factChecker: '',
      synthesizer: '',
    };
    this.searchQueries = [];
    this.evidenceDocs = [];

    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Verification timeout')), this.timeoutMs);
    });

    try {
      // Run with timeout
      const verificationPromise = this.runVerification(claim);
      const result = await Promise.race([verificationPromise, timeoutPromise]);
      
      return result;
    } catch (error: any) {
      this.step(`❌ Error in agentic verification: ${error?.message || 'Unknown error'}`);
      console.error('❌ Agentic verification error:', error);

      // Fallback result
      const mappedEvidence = this.mapEvidenceToNewsArticles(this.evidenceDocs);
      return {
        isVerified: false,
        confidence: 0,
        riskLevel: 'HIGH',
        factCheckSummary: 'Verification failed due to an error. Please try again.',
        analysis: `Error: ${error?.message || 'Unknown error occurred during verification'}`,
        evidence: mappedEvidence,
        agentInsights: this.agentInsights,
        searchQueries: this.searchQueries,
        evidenceSources: this.evidenceDocs.length,
      };
    } finally {
      this.cleanup();
    }
  }

  private async runVerification(claim: string): Promise<AgenticVerificationResult> {
    try {
      // Create tools and agents with memory limits
      const tools = createAgentTools(this.detector);
      const agents = createAgents(this.model, tools);

      this.step(`🔍 Stage 1 — Claim Analyst running...`);

      // Simplified approach: Use direct LLM calls instead of full agent framework
      // to reduce memory overhead
      
      // Stage 1: Analyze claim
      const analysis = await this.detector.analyzeClaim(claim);
      this.agentInsights.claimAnalyst = `Extracted ${analysis.extractedClaims.length} sub-claims and ${analysis.keywords.length} keywords`;
      this.step(`✅ Claim Analyst completed`);

      // Stage 2: Search and gather evidence (limit to 3 queries max)
      this.step(`📚 Stage 2 — Evidence Researcher running...`);
      const searchQueries = analysis.keywords.slice(0, 3);
      this.searchQueries = searchQueries;
      
      let allArticles: NewsArticle[] = [];
      for (const query of searchQueries.slice(0, 2)) { // Limit to 2 queries
        const articles = await this.detector.fetchGoogleNewsSearch(query);
        allArticles.push(...articles.slice(0, 3)); // Limit articles per query
        
        if (articles.length > 0) {
          await this.detector.storeNewsArticles(articles.slice(0, 3));
        }
        
        // Small delay to prevent rate limits
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      this.step(`✅ Evidence Researcher completed`);

      // Stage 3: Retrieve relevant evidence (limit to 5 docs)
      this.step(`🔎 Stage 3 — Finding relevant evidence...`);
      this.evidenceDocs = await this.detector.findRelevantEvidence(claim, 5);
      this.step(`✅ Retrieved ${this.evidenceDocs.length} evidence documents`);

      // Stage 4: Fact checking via direct LLM call
      this.step(`⚖️ Stage 4 — Fact Checker running...`);
      const verification = await this.detector.verifyClaimWithEvidence(
        claim,
        this.evidenceDocs,
        analysis
      );
      this.agentInsights.factChecker = `Verdict: ${verification.isVerified ? 'SUPPORTED' : 'REFUTED/INCONCLUSIVE'}`;
      this.step(`✅ Fact Checker completed`);

      // Build final result
      const mappedEvidence = this.mapEvidenceToNewsArticles(this.evidenceDocs);

      const finalResult: AgenticVerificationResult = {
        isVerified: verification.isVerified,
        confidence: verification.confidence,
        riskLevel: verification.riskLevel,
        factCheckSummary: verification.factCheckSummary,
        analysis: verification.analysis,
        evidence: mappedEvidence,
        agentInsights: this.agentInsights,
        searchQueries: this.searchQueries,
        evidenceSources: this.evidenceDocs.length,
      };

      this.step(`🎯 Verification complete`);
      return finalResult;

    } catch (error: any) {
      throw new Error(`Verification failed: ${error?.message || 'Unknown error'}`);
    }
  }
}