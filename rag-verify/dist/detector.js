"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MisinformationDetector = void 0;
require("dotenv/config");
const generative_ai_1 = require("@google/generative-ai");
const google_genai_1 = require("@langchain/google-genai");
const qdrant_1 = require("@langchain/qdrant");
const documents_1 = require("@langchain/core/documents");
const text_splitter_1 = require("langchain/text_splitter");
const serpapi_1 = require("serpapi");
const js_client_rest_1 = require("@qdrant/js-client-rest");
// ==============================
// CLASS: MisinformationDetector
// ==============================
class MisinformationDetector {
    constructor() {
        this.vectorStore = null;
        if (!process.env.GEMINI_API_KEY)
            throw new Error('GEMINI_API_KEY is required');
        if (!process.env.QDRANT_URL || !process.env.QDRANT_API_KEY)
            throw new Error('QDRANT_URL and QDRANT_API_KEY are required');
        this.genAI = new generative_ai_1.GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        this.embeddings = new google_genai_1.GoogleGenerativeAIEmbeddings({
            apiKey: process.env.GEMINI_API_KEY,
            modelName: 'text-embedding-004',
        });
        this.qdrantClient = new js_client_rest_1.QdrantClient({
            url: process.env.QDRANT_URL,
            apiKey: process.env.QDRANT_API_KEY,
        });
        this.textSplitter = new text_splitter_1.RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 200,
        });
    }
    // ==============================
    // INIT VECTOR STORE
    // ==============================
    async initializeVectorStore(collectionName = 'news_articles') {
        try {
            const collections = await this.qdrantClient.getCollections();
            const collectionExists = collections.collections.some(col => col.name === collectionName);
            if (!collectionExists) {
                await this.qdrantClient.createCollection(collectionName, {
                    vectors: { size: 768, distance: 'Cosine' },
                });
            }
            this.vectorStore = new qdrant_1.QdrantVectorStore(this.embeddings, {
                client: this.qdrantClient,
                collectionName,
            });
            console.log(`✅ Vector store initialized with collection: ${collectionName}`);
        }
        catch (error) {
            console.error('❌ Error initializing vector store:', error);
            throw error;
        }
    }
    // ==============================
    // FETCH GOOGLE NEWS
    // ==============================
    async fetchGoogleNewsSearch(query) {
        try {
            const params = {
                engine: 'google_news',
                q: query,
                hl: 'en',
                gl: 'in',
                num: 20,
                api_key: process.env.SERPAPI_KEY,
            };
            const results = await (0, serpapi_1.getJson)(params);
            return (results.news_results?.map((article) => ({
                title: article.title,
                snippet: article.snippet,
                link: article.link,
                date: article.date,
                source: article.source,
            })) || []);
        }
        catch (error) {
            console.error('❌ Error fetching news:', error);
            return [];
        }
    }
    // ==============================
    // STORE ARTICLES
    // ==============================
    async storeNewsArticles(articles) {
        if (!this.vectorStore)
            throw new Error('Vector store not initialized');
        try {
            const documents = [];
            for (const article of articles) {
                const content = `Title: ${article.title}\nSnippet: ${article.snippet}\nDate: ${article.date}\nSource: ${article.source || 'Unknown'}`;
                const chunks = await this.textSplitter.splitText(content);
                for (const chunk of chunks) {
                    documents.push(new documents_1.Document({
                        pageContent: chunk,
                        metadata: {
                            title: article.title,
                            link: article.link,
                            date: article.date,
                            source: article.source,
                            type: 'news_article',
                        },
                    }));
                }
            }
            await this.vectorStore.addDocuments(documents);
            console.log(`✅ Stored ${documents.length} chunks from ${articles.length} articles`);
        }
        catch (error) {
            console.error('❌ Error storing articles:', error);
            throw error;
        }
    }
    // ==============================
    // SAFE JSON PARSER
    // ==============================
    extractJsonFromResponse(response) {
        try {
            return JSON.parse(response);
        }
        catch {
            const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
            if (jsonMatch) {
                try {
                    return JSON.parse(jsonMatch[1].trim());
                }
                catch { }
            }
            const jsonStart = response.indexOf('{');
            const jsonEnd = response.lastIndexOf('}');
            if (jsonStart !== -1 && jsonEnd > jsonStart) {
                const candidate = response
                    .substring(jsonStart, jsonEnd + 1)
                    .replace(/[\n\r]+/g, ' ')
                    .replace(/,\s*}/g, '}')
                    .replace(/,\s*]/g, ']');
                try {
                    return JSON.parse(candidate);
                }
                catch { }
            }
            console.error('❌ Invalid JSON response text:', response);
            throw new Error('Invalid JSON in model response');
        }
    }
    // ==============================
    // SAFE MODEL GENERATION (RETRY)
    // ==============================
    async safeGenerate(model, prompt, retries = 2) {
        for (let i = 0; i <= retries; i++) {
            try {
                const result = await model.generateContent(prompt);
                const text = result.response.text();
                if (text && text.includes('{'))
                    return text;
            }
            catch (e) {
                console.warn(`⚠️ Retry ${i + 1}/${retries} failed: ${e.message}`);
            }
        }
        throw new Error('Model failed to return valid response after retries.');
    }
    // ==============================
    // CLAIM ANALYSIS
    // ==============================
    async analyzeClaim(claim) {
        const model = this.genAI.getGenerativeModel({
            model: 'gemini-2.0-flash',
            generationConfig: { maxOutputTokens: 500, temperature: 0.1 },
        });
        const prompt = `
You must respond ONLY with a valid JSON object. Do not include explanations, text, or code fences.

Analyze this claim for fact-checking:

Claim: "${claim}"

Return JSON:
{
  "extractedClaims": ["claim1", "claim2"],
  "keywords": ["keyword1", "keyword2"],
  "context": "short context",
  "specificity": "vague/specific"
}`;
        try {
            const response = await this.safeGenerate(model, prompt);
            const parsed = this.extractJsonFromResponse(response);
            return {
                claim,
                extractedClaims: parsed.extractedClaims || [claim],
                keywords: parsed.keywords || claim.split(' ').filter(w => w.length > 3),
                context: parsed.context || 'General claim verification',
            };
        }
        catch (error) {
            console.error('❌ Error parsing claim analysis:', error);
            return {
                claim,
                extractedClaims: [claim],
                keywords: claim.split(' ').filter(w => w.length > 3).slice(0, 5),
                context: 'General claim verification',
            };
        }
    }
    // ==============================
    // EVIDENCE SEARCH
    // ==============================
    async findRelevantEvidence(claim, k = 10) {
        if (!this.vectorStore)
            throw new Error('Vector store not initialized');
        try {
            return await this.vectorStore.similaritySearch(claim, k);
        }
        catch (error) {
            console.error('❌ Error finding evidence:', error);
            return [];
        }
    }
    // ==============================
    // VERIFY CLAIM WITH EVIDENCE
    // ==============================
    async verifyClaimWithEvidence(claim, evidence, analysis) {
        const model = this.genAI.getGenerativeModel({
            model: 'gemini-2.0-flash',
            generationConfig: { maxOutputTokens: 600, temperature: 0.1 },
        });
        const evidenceText = evidence
            .map((doc, i) => `Evidence ${i + 1}: ${doc.pageContent}\nSource: ${doc.metadata.source}\nDate: ${doc.metadata.date}\n---`)
            .join('\n');
        const prompt = `
You must respond ONLY with a valid JSON object. Do not include explanations, text, or code fences.

You are a fact-checker. Verify the following claim using the provided evidence.

Claim: "${claim}"
Extracted Sub-Claims: ${analysis.extractedClaims.join(', ')}

Evidence:
${evidenceText}

Return JSON:
{
  "isVerified": true/false,
  "confidence": 85,
  "riskLevel": "LOW/MEDIUM/HIGH",
  "analysis": "detailed reasoning",
  "factCheckSummary": "public summary"
}`;
        try {
            const response = await this.safeGenerate(model, prompt);
            const parsed = this.extractJsonFromResponse(response);
            const relevantArticles = evidence.map(doc => ({
                title: doc.metadata.title,
                snippet: doc.pageContent.substring(0, 200) + '...',
                link: doc.metadata.link,
                date: doc.metadata.date,
                source: doc.metadata.source,
            }));
            return {
                isVerified: parsed.isVerified || false,
                confidence: parsed.confidence || 0,
                evidence: relevantArticles,
                analysis: parsed.analysis || 'Unable to analyze claim',
                riskLevel: parsed.riskLevel || 'MEDIUM',
                factCheckSummary: parsed.factCheckSummary || 'Unable to verify claim',
            };
        }
        catch (error) {
            console.error('❌ Error in claim verification:', error);
            return {
                isVerified: false,
                confidence: 0,
                evidence: [],
                analysis: 'Error occurred during verification',
                riskLevel: 'MEDIUM',
                factCheckSummary: 'Verification failed due to model error',
            };
        }
    }
    // ==============================
    // UPDATE DATABASE
    // ==============================
    async updateNewsDatabase(topics) {
        console.log('🔄 Updating news database...');
        for (const topic of topics) {
            try {
                console.log(`📰 Fetching news for: ${topic}`);
                const articles = await this.fetchGoogleNewsSearch(topic);
                if (articles.length > 0)
                    await this.storeNewsArticles(articles);
                await new Promise(r => setTimeout(r, 2000));
            }
            catch (error) {
                console.error(`❌ Error updating topic ${topic}:`, error);
            }
        }
    }
    // ==============================
    // MAIN CLAIM VERIFICATION
    // ==============================
    async verifyClaim(claim) {
        try {
            console.log(`🔍 Starting verification for claim: "${claim}"`);
            const analysis = await this.analyzeClaim(claim);
            console.log('📰 Fetching related news...');
            const searchQueries = analysis.keywords.slice(0, 3).join(' ');
            const freshNews = await this.fetchGoogleNewsSearch(searchQueries);
            if (freshNews.length > 0)
                await this.storeNewsArticles(freshNews);
            console.log('🔎 Finding relevant evidence...');
            const evidence = await this.findRelevantEvidence(claim, 15);
            if (evidence.length === 0)
                return {
                    isVerified: false,
                    confidence: 0,
                    evidence: [],
                    analysis: 'No relevant evidence found',
                    riskLevel: 'MEDIUM',
                    factCheckSummary: 'Insufficient evidence found. Please consult official news sources.',
                };
            console.log('✅ Verifying claim with evidence...');
            const result = await this.verifyClaimWithEvidence(claim, evidence, analysis);
            console.log(`🎯 Verification complete - Verified: ${result.isVerified}`);
            return result;
        }
        catch (error) {
            console.error('❌ Error in verification process:', error);
            throw error;
        }
    }
}
exports.MisinformationDetector = MisinformationDetector;
// ==============================
// MAIN FUNCTION
// ==============================
async function main() {
    try {
        const detector = new MisinformationDetector();
        await detector.initializeVectorStore();
        const topics = [
            'farmers protest india 2025',
            'government policy agriculture',
            'farmer bills india',
            'agricultural reforms india',
        ];
        await detector.updateNewsDatabase(topics);
        const testClaim = 'Farmers in India are protesting because the government banned all traditional farming methods in 2025';
        console.log('\n🚀 Testing claim verification...');
        const result = await detector.verifyClaim(testClaim);
        console.log('\n📊 VERIFICATION RESULT:');
        console.log('====================');
        console.log(`Claim: ${testClaim}`);
        console.log(`Verified: ${result.isVerified ? '✅ True' : '❌ False/Unverified'}`);
        console.log(`Confidence: ${result.confidence}%`);
        console.log(`Risk Level: ${result.riskLevel}`);
        console.log(`\nAnalysis: ${result.analysis}`);
        console.log(`\nSummary: ${result.factCheckSummary}`);
    }
    catch (error) {
        console.error('❌ Error in main:', error);
    }
}
if (require.main === module) {
    main();
}
//# sourceMappingURL=detector.js.map