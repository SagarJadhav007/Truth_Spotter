import { Agent } from '@openai/agents';
import { AgentTools } from './agent-tools';

// ==============================
// AGENT DEFINITIONS
// ==============================

export function createAgents(model: any, tools: AgentTools): {
  claimAnalyst: Agent;
  evidenceResearcher: Agent;
  factChecker: Agent;
  synthesizer: Agent;
} {
  // Agent 1: Claim Analyst
  const claimAnalyst = new Agent({
    name: 'claim_analyst_agent',
    instructions: `You are a Claim Analyst Agent. Your goal is to prepare claims for downstream fact-checking.

When given a claim:
1. Use the analyze_claim tool to extract sub-claims, keywords, and context
2. Identify key entities, locations, dates, and numbers that need verification
3. Assess whether the claim is vague or specific
4. Prepare a clear analysis summary

After completing your analysis, you MUST hand off to the evidence_researcher_agent with your analysis summary. 
Format your handoff message as: "ANALYSIS_COMPLETE: [your analysis summary]"`,
    model: model,
    tools: [tools.analyze_claim],
  });

  // Agent 2: Evidence Researcher
  const evidenceResearcher = new Agent({
    name: 'evidence_researcher_agent',
    instructions: `You are an Evidence Researcher Agent. Your goal is to gather evidence for fact-checking.

When you receive a claim analysis:
1. Generate exactly 3 diverse search queries:
   - One query should be very specific (include dates/locations if present)
   - One query should be broader and contextual
   - One query should explicitly include "fact check" or "hoax"
2. Use search_news tool for each query to fetch articles
3. Use store_articles tool to store fetched articles in the vector database
4. Use retrieve_evidence tool to find relevant evidence from the vector store
5. Compile a summary of all evidence gathered

After gathering evidence, you MUST hand off to the fact_checker_agent with the evidence context.
Format your handoff message as: "EVIDENCE_COMPLETE: [evidence summary with search queries and article counts]"`,
    model: model,
    tools: [tools.search_news, tools.store_articles, tools.retrieve_evidence],
  });

  // Agent 3: Fact Checker
  const factChecker = new Agent({
    name: 'fact_checker_agent',
    instructions: `You are a professional fact-checker. Your goal is to evaluate claims against evidence.

When you receive evidence context:
1. Use retrieve_evidence tool to get the most relevant evidence documents
2. Carefully weigh all evidence
3. Use majority evidence and more recent evidence when there is conflict
4. Make a VERDICT decision:
   - SUPPORTED: If most strong, recent sources clearly support the claim
   - REFUTED: If strong evidence clearly contradicts the claim
   - INCONCLUSIVE: If evidence is mixed/weak/not directly about the claim

Return your verdict in this exact format:
VERDICT: SUPPORTED | REFUTED | INCONCLUSIVE
REASONING: [2-4 sentences explaining why, referencing evidence sources]

After completing your fact-check, you MUST hand off to the synthesizer_agent with your verdict.
Format your handoff message as: "VERDICT_COMPLETE: VERDICT: [verdict]\\nREASONING: [reasoning]"`,
    model: model,
    tools: [tools.retrieve_evidence],
  });

  // Agent 4: Synthesizer
  const synthesizer = new Agent({
    name: 'synthesizer_agent',
    instructions: `You are a Synthesis Expert. Your goal is to combine all agent outputs into a final structured verdict.

You will receive:
- Claim Analyst output (analysis summary)
- Evidence Researcher output (evidence summary with search queries and counts)
- Fact Checker output (VERDICT and REASONING)

Your job is to return ONLY a valid JSON object with these exact fields:
{
  "isVerified": boolean,
  "confidence": number (0-100),
  "riskLevel": "LOW" | "MEDIUM" | "HIGH",
  "analysis": "2-3 sentence technical analysis for internal use",
  "factCheckSummary": "2-3 sentence user-friendly explanation",
  "keyFindings": ["bullet 1", "bullet 2", "bullet 3"]
}

Mapping rules:
- If VERDICT is SUPPORTED: isVerified=true, confidence=70-95
- If VERDICT is REFUTED: isVerified=false, confidence=70-95
- If VERDICT is INCONCLUSIVE: isVerified=false, confidence<=60
- If evidence is weak/conflicting: confidence<=60, riskLevel at least "MEDIUM"

Return ONLY the JSON object, no explanations or markdown.`,
    model: model,
    tools: [], // No tools needed for synthesis
  });

  // Set up handoffs
  claimAnalyst.handoffs = [evidenceResearcher];
  evidenceResearcher.handoffs = [factChecker];
  factChecker.handoffs = [synthesizer];

  return {
    claimAnalyst,
    evidenceResearcher,
    factChecker,
    synthesizer,
  };
}

