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
  isCasualQuery?: boolean; // Flag to indicate this is a casual query response (not a verification)
}

type UpdateCallback = (msg: string) => void;

// ==============================
// CONTEXT INTERFACE
// ==============================

export interface VerificationContext {
  userId?: string;
  userName?: string;
  conversationId?: string;
  requestId: string;
  timestamp: string;
}

// ==============================
// ORCHESTRATOR CLASS
// ==============================

export class AgentOrchestrator {
  private detector: MisinformationDetector;
  private model: any;
  private onUpdate?: UpdateCallback;
  private context?: VerificationContext;
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

  constructor(detector: MisinformationDetector, onUpdate?: UpdateCallback, context?: VerificationContext) {
    this.detector = detector;
    this.onUpdate = onUpdate;
    this.context = context;

    // Initialize Gemini model using AI SDK extensions
    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      throw new Error('GOOGLE_GENERATIVE_AI_API_KEY is required');
    }

    // aisdk wrapper converts LanguageModelV1 to LanguageModelV2
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.model = aisdk(google('gemini-2.5-flash')) as any;
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

  async verifyClaimAgentic(claim: string, context?: VerificationContext): Promise<AgenticVerificationResult> {
    if (this.isRunning) {
      throw new Error('Verification already in progress');
    }

    // Use provided context or existing context
    if (context) {
      this.context = context;
    }

    this.isRunning = true;
    this.step(`🤖 Starting Agentic Verification`);
    if (this.context?.userName) {
      this.step(`👤 User: ${this.context.userName} (Request ID: ${this.context.requestId})`);
    }
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
      // Step 0: Route the query
      const queryType = await this.routeQuery(claim);
      
      // Run with timeout based on query type
      let resultPromise: Promise<AgenticVerificationResult>;
      
      if (queryType === 'casual') {
        resultPromise = this.handleCasualQuery(claim);
      } else {
        resultPromise = this.runVerification(claim);
      }
      
      const result = await Promise.race([resultPromise, timeoutPromise]);
      
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

  // Router step: Classify query and route accordingly
  private async routeQuery(query: string): Promise<'casual' | 'verification'> {
    this.step(`🔀 Routing query...`);
    
    // First, try pattern-based classification (fast and reliable)
    const lowerQuery = query.toLowerCase().trim();
    
    // Pattern-based classification for common casual queries
    const casualPatterns = [
      /^(hi|hello|hey|greetings|good morning|good afternoon|good evening)$/i,
      /^(how are you|what's up|how's it going)$/i,
      /^(thanks|thank you|thx)$/i,
      /^(bye|goodbye|see you)$/i,
      /^(help|can you help|what can you do)$/i,
      /^(tell me a joke|joke|make me laugh)$/i,
      /^(what is|what are|explain|how do|how does|why does|why do)/i,
      /^(opinion|what do you think|what's your view)/i,
    ];
    
    // Check if it's clearly a casual greeting or simple question
    if (casualPatterns.some(pattern => pattern.test(lowerQuery))) {
      this.step(`✅ Query classified as CASUAL (pattern match)`);
      return 'casual';
    }
    
    // Check for verification keywords
    const verificationPatterns = [
      /^(is it true|is this true|verify|fact check|check if|did.*happen|did.*occur)/i,
      /^(claim|statement|assertion|rumor|news|report)/i,
      /^(prove|disprove|confirm|deny|validate)/i,
    ];
    
    if (verificationPatterns.some(pattern => pattern.test(lowerQuery))) {
      this.step(`✅ Query classified as VERIFICATION_REQUIRED (pattern match)`);
      return 'verification';
    }
    
    // If pattern matching doesn't work, try LLM classification
    try {
      const classificationPrompt = `Classify this query as CASUAL or VERIFICATION_REQUIRED.

Query: "${query}"

CASUAL = greetings, simple questions, opinions, explanations, creative requests
VERIFICATION_REQUIRED = claims, factual statements, news, events that need fact-checking

Respond with ONLY: CASUAL or VERIFICATION_REQUIRED`;

      // Access genAI directly from detector
      const genAI = (this.detector as any).genAI;
      if (!genAI) {
        throw new Error('genAI not available');
      }

      const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
        generationConfig: { 
          maxOutputTokens: 5, 
          temperature: 0.1 
        },
      });

      const result = await model.generateContent(classificationPrompt);
      const classification = result.response.text().trim().toUpperCase();
      
      // Log the raw response for debugging
      console.log(`[Classification] Raw response: "${classification}"`);
      
      if (classification.includes('CASUAL')) {
        this.step(`✅ Query classified as CASUAL (LLM)`);
        return 'casual';
      } else if (classification.includes('VERIFICATION')) {
        this.step(`✅ Query classified as VERIFICATION_REQUIRED (LLM)`);
        return 'verification';
      } else {
        // If LLM response is unclear, use heuristics
        this.step(`⚠️ LLM classification unclear, using heuristics`);
        // Short queries (< 20 chars) without verification keywords are likely casual
        if (query.length < 20 && !verificationPatterns.some(p => p.test(lowerQuery))) {
          return 'casual';
        }
        return 'verification';
      }
    } catch (error: any) {
      console.error('[Classification Error]', error?.message || error);
      this.step(`⚠️ Classification failed: ${error?.message || 'Unknown error'}`);
      
      // Fallback: use heuristics
      // Very short queries are likely casual greetings
      if (query.trim().length <= 10 && !lowerQuery.match(/\d/)) {
        this.step(`✅ Query classified as CASUAL (fallback heuristic)`);
        return 'casual';
      }
      
      // Default to verification for safety
      this.step(`⚠️ Defaulting to VERIFICATION_REQUIRED`);
      return 'verification';
    }
  }

  // Handle casual queries - use direct LLM call instead of full agents SDK to avoid memory issues
  private async handleCasualQuery(query: string): Promise<AgenticVerificationResult> {
    this.step(`💬 Handling casual query...`);
    
    try {
      // Use a simple, direct LLM call instead of the full agents SDK stack
      // This avoids memory issues and is more efficient for casual queries
      const casualPrompt = `You are a helpful, friendly AI assistant. Answer the following question in a clear, conversational, and helpful manner.

Question: "${query}"

Provide a helpful response. Be concise but informative.`;

      const model = (this.detector as any).genAI?.getGenerativeModel({
        model: 'gemini-2.0-flash',
        generationConfig: { 
          maxOutputTokens: 500, 
          temperature: 0.7 
        },
      });

      if (!model) {
        throw new Error('Failed to initialize model for casual query');
      }

      this.step(`🤖 Generating response...`);
      const result = await model.generateContent(casualPrompt);
      const casualResponse = result.response.text().trim();

      this.step(`✅ Casual query handled successfully`);

      // Return a result formatted for casual queries
      return {
        isVerified: true, // Casual queries don't need verification
        confidence: 100,
        riskLevel: 'LOW',
        factCheckSummary: casualResponse || 'I\'m here to help with your question!',
        analysis: 'This was a casual query handled by the conversational agent.',
        evidence: [],
        agentInsights: {
          claimAnalyst: 'N/A - Casual query',
          evidenceResearcher: 'N/A - Casual query',
          factChecker: 'N/A - Casual query',
          synthesizer: 'N/A - Casual query',
        },
        searchQueries: [],
        evidenceSources: 0,
        isCasualQuery: true, // Flag for frontend to render as chat message
      };
    } catch (error: any) {
      this.step(`❌ Error handling casual query: ${error?.message}`);
      // Fallback: return a simple response
      return {
        isVerified: true,
        confidence: 100,
        riskLevel: 'LOW',
        factCheckSummary: 'I apologize, but I encountered an error processing your casual query. Please try rephrasing your question.',
        analysis: `Error: ${error?.message || 'Unknown error'}`,
        evidence: [],
        agentInsights: {
          claimAnalyst: 'N/A - Casual query',
          evidenceResearcher: 'N/A - Casual query',
          factChecker: 'N/A - Casual query',
          synthesizer: 'N/A - Casual query',
        },
        searchQueries: [],
        evidenceSources: 0,
        isCasualQuery: true, // Flag for frontend to render as chat message
      };
    }
  }

  // In agent-orchestrator.ts - Add batching and memory management
  private async runVerification(claim: string): Promise<AgenticVerificationResult> {
    try {
      // Stage 1: Analyze claim with lighter model
      const analysis = await this.detector.analyzeClaim(claim);
      this.agentInsights.claimAnalyst = `Extracted ${analysis.extractedClaims.length} sub-claims`;
      this.step(`✅ Claim Analyst completed`);
      
      // Stage 2: Parallel search with limits (prevent sequential blocking)
      this.step(`📚 Stage 2 — Evidence Researcher running...`);
      const searchQueries = analysis.keywords.slice(0, 2); // Reduced from 3
      this.searchQueries = searchQueries;
      
      // Parallel fetch with Promise.all instead of sequential
      const articlePromises = searchQueries.map(query => 
        this.detector.fetchGoogleNewsSearch(query)
          .then(articles => articles.slice(0, 2)) // Limit per query
          .catch(() => []) // Graceful failure
      );
      
      const allArticlesArrays = await Promise.allSettled(articlePromises);
      const allArticles = allArticlesArrays
        .filter(result => result.status === 'fulfilled')
        .flatMap(result => result.value);
      
      // Batch store to reduce API calls
      if (allArticles.length > 0) {
        await this.detector.storeNewsArticles(allArticles.slice(0, 5));
      }
      this.step(`✅ Evidence Researcher completed`);
      
      // Stage 3: Retrieve relevant evidence
      this.step(`🔎 Stage 3 — Finding relevant evidence...`);
      this.evidenceDocs = await this.detector.findRelevantEvidence(claim, 5);
      this.step(`✅ Retrieved ${this.evidenceDocs.length} evidence documents`);
      
      // Stage 4: Fact checking
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
