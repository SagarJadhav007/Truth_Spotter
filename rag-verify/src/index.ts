import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { MisinformationDetector, VerificationResult } from './detector';
import { AgenticRAGVerifier, AgenticVerificationResult } from './agentic';
import { initRedis, closeRedis, isRedisAvailable } from './redis';
import {
  getCachedVerification,
  setCachedVerification,
  invalidateVerificationCache,
} from './cache';
import { createLimiters, AppLimiters } from './rateLimit';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: ['http://localhost:8080', 'https://truthspotter.vercel.app'],
  methods: ['GET', 'POST'],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

let detector: MisinformationDetector;
let agenticVerifier: AgenticRAGVerifier;

async function initializeDetector() {
  try {
    detector = new MisinformationDetector();
    await detector.initializeVectorStore();

    agenticVerifier = new AgenticRAGVerifier(detector);
    console.log('✅ Agentic RAG verifier initialized');
    console.log('✅ Misinformation detector initialized');
  } catch (error) {
    console.error('❌ Failed to initialize detector:', error);
    process.exit(1);
  }
}

async function verifyClaimWithCache(claim: string): Promise<{
  result: VerificationResult;
  cached: boolean;
}> {
  const trimmed = claim.trim();
  const cached = await getCachedVerification<VerificationResult>('standard', trimmed);
  if (cached) {
    console.log(`⚡ Cache hit for claim: "${trimmed.substring(0, 100)}..."`);
    return { result: cached, cached: true };
  }

  const result = await detector.verifyClaim(trimmed);
  await setCachedVerification('standard', trimmed, result);
  return { result, cached: false };
}

async function verifyClaimAgenticWithCache(claim: string): Promise<{
  result: AgenticVerificationResult;
  cached: boolean;
}> {
  const trimmed = claim.trim();
  const cached = await getCachedVerification<AgenticVerificationResult>('agentic', trimmed);
  if (cached) {
    console.log(`⚡ Cache hit (agentic) for claim: "${trimmed.substring(0, 100)}..."`);
    return { result: cached, cached: true };
  }

  const result = await agenticVerifier.verifyClaimAgentic(trimmed);
  await setCachedVerification('agentic', trimmed, result);
  return { result, cached: false };
}

function registerRoutes({ globalLimiter, verifyLimiter }: AppLimiters) {
  app.use(globalLimiter);

  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'misinformation-detector-api',
      redis: isRedisAvailable() ? 'connected' : 'unavailable',
    });
  });

  app.get('/', (req, res) => {
    res.json({
      name: 'Misinformation Detection API',
      version: '1.0.0',
      endpoints: {
        'POST /verify-claim': 'Verify a claim against news sources',
        'POST /verify-claim-agentic': 'Verify a claim using agentic RAG',
        'POST /verify-claims-batch': 'Verify up to 5 claims in one request',
        'POST /update-news': 'Update news database with topics',
        'GET /verify-stream': 'Stream agentic verification steps (SSE)',
        'GET /health': 'Health check',
        'GET /stats': 'Get system statistics',
      },
    });
  });

  app.post('/verify-claim', verifyLimiter, async (req, res) => {
    try {
      const { claim } = req.body;

      if (!claim || typeof claim !== 'string' || claim.trim().length === 0) {
        return res.status(400).json({
          error: 'Invalid claim',
          message: 'Claim must be a non-empty string',
        });
      }

      if (claim.length > 1000) {
        return res.status(400).json({
          error: 'Claim too long',
          message: 'Claim must be less than 1000 characters',
        });
      }

      console.log(`🔍 API: Verifying claim: "${claim.substring(0, 100)}..."`);

      const startTime = Date.now();
      const { result, cached } = await verifyClaimWithCache(claim);
      const processingTime = Date.now() - startTime;

      return res.json({
        success: true,
        data: {
          claim: claim.trim(),
          verification: result,
          metadata: {
            processingTimeMs: processingTime,
            timestamp: new Date().toISOString(),
            evidenceCount: result.evidence.length,
            cached,
          },
        },
      });
    } catch (error) {
      console.error('❌ Error in verify-claim:', error);
      return res.status(500).json({
        success: false,
        error: 'Verification failed',
        message: 'An error occurred while verifying the claim',
      });
    }
  });

  app.post('/update-news', async (req, res) => {
    try {
      const { topics } = req.body;

      if (!topics || !Array.isArray(topics)) {
        return res.status(400).json({
          error: 'Invalid topics',
          message: 'Topics must be an array of strings',
        });
      }

      if (topics.length > 10) {
        return res.status(400).json({
          error: 'Too many topics',
          message: 'Maximum 10 topics allowed per request',
        });
      }

      const validTopics = topics.filter((t) => typeof t === 'string' && t.trim().length > 0);

      if (validTopics.length === 0) {
        return res.status(400).json({
          error: 'No valid topics',
          message: 'At least one valid topic required',
        });
      }

      console.log(`📰 API: Updating news for topics: ${validTopics.join(', ')}`);

      await detector.updateNewsDatabase(validTopics);
      const invalidated = await invalidateVerificationCache();

      return res.json({
        success: true,
        message: `News database updated for ${validTopics.length} topics`,
        topics: validTopics,
        cacheEntriesInvalidated: invalidated,
      });
    } catch (error) {
      console.error('❌ Error in update-news:', error);
      return res.status(500).json({
        success: false,
        error: 'Update failed',
        message: 'An error occurred while updating the news database',
      });
    }
  });

  app.post('/verify-claims-batch', verifyLimiter, async (req, res) => {
    try {
      const { claims } = req.body;

      if (!claims || !Array.isArray(claims)) {
        return res.status(400).json({
          error: 'Invalid claims',
          message: 'Claims must be an array of strings',
        });
      }

      if (claims.length > 5) {
        return res.status(400).json({
          error: 'Too many claims',
          message: 'Maximum 5 claims allowed per batch request',
        });
      }

      const validClaims = claims.filter(
        (c) => typeof c === 'string' && c.trim().length > 0 && c.length <= 1000
      );

      if (validClaims.length === 0) {
        return res.status(400).json({
          error: 'No valid claims',
          message: 'At least one valid claim required',
        });
      }

      console.log(`🔍 API: Batch verifying ${validClaims.length} claims`);

      const results = await Promise.all(
        validClaims.map(async (claim) => {
          try {
            const { result: verification, cached } = await verifyClaimWithCache(claim);
            return {
              claim: claim.trim(),
              verification,
              success: true,
              cached,
            };
          } catch (error) {
            return {
              claim: claim.trim(),
              error: 'Verification failed',
              success: false,
            };
          }
        })
      );

      return res.json({
        success: true,
        data: results,
        metadata: {
          totalClaims: validClaims.length,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('❌ Error in batch verification:', error);
      return res.status(500).json({
        success: false,
        error: 'Batch verification failed',
        message: 'An error occurred while verifying claims',
      });
    }
  });

  app.get('/stats', async (req, res) => {
    try {
      const stats = {
        status: 'operational',
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        redis: isRedisAvailable() ? 'connected' : 'unavailable',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      };

      res.json({ success: true, data: stats });
    } catch (error) {
      console.error('❌ Error getting stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get statistics',
      });
    }
  });

  app.get('/verify-stream', async (req, res) => {
    const claim = req.query.claim as string;
    if (!claim) return res.status(400).json({ error: 'claim required' });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders?.();

    const send = (event: string, data: unknown) => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const verifier = new AgenticRAGVerifier(detector, (msg) => send('step', msg));

    try {
      const result = await verifier.verifyClaimAgentic(claim);
      send('final', result);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'verification failed';
      send('error', { message });
    } finally {
      res.end();
    }

    return res;
  });

  app.post('/verify-claim-agentic', verifyLimiter, async (req, res) => {
    try {
      const { claim } = req.body;

      if (!claim || typeof claim !== 'string' || claim.trim().length === 0) {
        return res.status(400).json({
          error: 'Invalid claim',
          message: 'Claim must be a non-empty string',
        });
      }

      if (claim.length > 1000) {
        return res.status(400).json({
          error: 'Claim too long',
          message: 'Claim must be less than 1000 characters',
        });
      }

      console.log(`🤖 API: Agentic verification for claim: "${claim.substring(0, 100)}..."`);

      const startTime = Date.now();
      const { result, cached } = await verifyClaimAgenticWithCache(claim);
      const processingTime = Date.now() - startTime;

      return res.json({
        success: true,
        data: {
          claim: claim.trim(),
          verification: result,
          metadata: {
            processingTimeMs: processingTime,
            timestamp: new Date().toISOString(),
            evidenceCount: result.evidence.length,
            verificationType: 'agentic-rag',
            agentsUsed: ['claim_analyst', 'evidence_researcher', 'fact_checker', 'synthesizer'],
            cached,
          },
        },
      });
    } catch (error) {
      console.error('❌ Error in agentic verification:', error);
      return res.status(500).json({
        success: false,
        error: 'Agentic verification failed',
        message: 'An error occurred while verifying the claim using agentic approach',
      });
    }
  });

  app.use((error: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('❌ Unhandled error:', error);

    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
    });
  });

  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: 'Not found',
      message: `Endpoint ${req.method} ${req.path} not found`,
    });
  });
}

async function startServer() {
  try {
    const redis = await initRedis();
    registerRoutes(createLimiters(redis));
    await initializeDetector();

    const monitoringTopics = [
      'breaking news india',
      'government policy',
      'social media rumors',
      'fact check news',
    ];

    setInterval(async () => {
      try {
        await detector.updateNewsDatabase(monitoringTopics);
        console.log('✅ Scheduled news update completed');
      } catch (error) {
        console.error('❌ Scheduled news update failed:', error);
      }
    }, 60 * 60 * 1000);

    app.listen(PORT, () => {
      console.log(`🚀 Misinformation Detection API running on port ${PORT}`);
      console.log(`📖 API Documentation: http://localhost:${PORT}/`);
      console.log(`💚 Health Check: http://localhost:${PORT}/health`);
      console.log(`🔴 Redis: ${isRedisAvailable() ? 'connected (cache + rate limits)' : 'unavailable (in-memory fallback)'}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

async function shutdown() {
  console.log('👋 Shutting down gracefully...');
  await closeRedis();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

if (require.main === module) {
  startServer();
}

export { app, detector };
