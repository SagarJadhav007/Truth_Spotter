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
    return docs.slice(0, 8).map((doc) => ({
      title: (doc.metadata as any)?.title ?? (doc.metadata as any)?.source ?? 'Untitled source',
      snippet: (doc.pageContent || '').slice(0, 200) + '...',
      link: (doc.metadata as any)?.link ?? undefined,
      date: (doc.metadata as any)?.date ?? 'Unknown date',
      source: (doc.metadata as any)?.source ?? 'Unknown',
    }));
  }

  private extractSearchQueries(text: string): string[] {
    // Try to extract search queries from agent output
    const queryMatches = text.match(/query[:\s]+["']?([^"'\n]+)["']?/gi);
    if (queryMatches) {
      return queryMatches.map((m) => m.replace(/query[:\s]+["']?/i, '').replace(/["']$/, '').trim());
    }
    return [];
  }

  async verifyClaimAgentic(claim: string): Promise<AgenticVerificationResult> {
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

    try {
      // Create tools and agents
      const tools = createAgentTools(this.detector);
      const agents = createAgents(this.model, tools);

      // Start with claim analyst agent
      this.step(`🔍 Stage 1 — Claim Analyst running...`);

      // Track agent outputs
      let synthesisResult: any = null;

      // Run the agent workflow using the run function
      // The run function will automatically handle handoffs between agents
      this.step(`🔍 Running agent workflow...`);
      
      const result = await run(agents.claimAnalyst, claim);

      // Extract final output
      const finalResult = result.finalOutput || result.output || result;
      
      // Try to extract agent insights from the result
      // Since we can't intercept intermediate steps easily, we'll parse from final output
      if (finalResult) {
        const resultStr = typeof finalResult === 'string' ? finalResult : JSON.stringify(finalResult);
        
        // Try to extract synthesis JSON
        try {
          const jsonMatch = resultStr.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            synthesisResult = JSON.parse(jsonMatch[0]);
            this.step(`✅ Synthesizer completed`);
          }
        } catch (e) {
          // Will handle in fallback
        }
        
        // Store insights (we'll use the final result as synthesizer output)
        this.agentInsights.synthesizer = resultStr;
        this.step(`🎯 Final result received`);
      }

      // If synthesis didn't parse, try to extract from final result
      if (!synthesisResult && finalResult) {
        try {
          const resultStr = typeof finalResult === 'string' ? finalResult : JSON.stringify(finalResult);
          const jsonMatch = resultStr.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            synthesisResult = JSON.parse(jsonMatch[0]);
          }
        } catch (e) {
          // Fallback below
        }
      }

      // Retrieve evidence for final result
      this.evidenceDocs = await this.detector.findRelevantEvidence(claim, 15);

      // Build final result
      const mappedEvidence = this.mapEvidenceToNewsArticles(this.evidenceDocs);

      // Parse synthesis result or use fallback
      if (synthesisResult) {
        return {
          isVerified: Boolean(synthesisResult.isVerified),
          confidence: Number(synthesisResult.confidence ?? 50),
          riskLevel: (synthesisResult.riskLevel as 'LOW' | 'MEDIUM' | 'HIGH') ?? 'MEDIUM',
          factCheckSummary:
            synthesisResult.factCheckSummary ||
            'No clear conclusion available based on the current evidence.',
          analysis:
            synthesisResult.analysis ||
            'Analysis generated from the combined outputs of claim analyst, evidence researcher, and fact checker.',
          evidence: mappedEvidence,
          agentInsights: this.agentInsights,
          searchQueries: this.searchQueries.length > 0 ? this.searchQueries : ['No queries extracted'],
          evidenceSources: this.evidenceDocs.length,
        };
      }

      // Fallback if synthesis failed
      this.step(`⚠️ Synthesis parsing failed, using fallback`);
      return {
        isVerified: false,
        confidence: 50,
        riskLevel: 'MEDIUM',
        factCheckSummary:
          'Evidence is inconclusive at this time. The claim should be treated as unverified and handled with caution.',
        analysis: 'Fallback synthesis executed due to an error in parsing the synthesis result.',
        evidence: mappedEvidence,
        agentInsights: this.agentInsights,
        searchQueries: this.searchQueries.length > 0 ? this.searchQueries : ['No queries extracted'],
        evidenceSources: this.evidenceDocs.length,
      };
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
    }
  }
}

