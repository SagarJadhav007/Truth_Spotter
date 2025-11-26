import express from 'express';
import cors from 'cors';
import { MisinformationDetector, VerificationResult } from './detector';
import rateLimit from 'express-rate-limit';
import { AgentOrchestrator } from './agent-orchestrator';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: ["http://localhost:8080", "https://truthspotter.vercel.app"], 
  methods: ["GET", "POST"],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Stricter rate limiting for verification endpoint
const verifyLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // limit each IP to 10 verification requests per 5 minutes
  message: 'Too many verification requests, please try again later.'
});

// Initialize detector
let detector: MisinformationDetector;

async function initializeDetector() {
  try {
    detector = new MisinformationDetector();
    await detector.initializeVectorStore();

    console.log('✅ Misinformation detector initialized');
    console.log('✅ Agent orchestrator ready (will be created per request)');
  } catch (error) {
    console.error('❌ Failed to initialize detector:', error);
    process.exit(1);
  }
}

// Routes

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'misinformation-detector-api'
  });
});

// Get API info
app.get('/', (req, res) => {
  res.json({
    name: 'Misinformation Detection API',
    version: '1.0.0',
    endpoints: {
      'POST /verify-claim': 'Verify a claim against news sources',
      'POST /update-news': 'Update news database with topics',
      'GET /health': 'Health check',
      'GET /stats': 'Get system statistics'
    }
  });
});

// Verify claim endpoint
app.post('/verify-claim', verifyLimiter, async (req, res) => {
  try {
    const { claim } = req.body;

    if (!claim || typeof claim !== 'string' || claim.trim().length === 0) {
      return res.status(400).json({
        error: 'Invalid claim',
        message: 'Claim must be a non-empty string'
      });
    }

    if (claim.length > 1000) {
      return res.status(400).json({
        error: 'Claim too long',
        message: 'Claim must be less than 1000 characters'
      });
    }

    console.log(`🔍 API: Verifying claim: "${claim.substring(0, 100)}..."`);

    const startTime = Date.now();
    const result: VerificationResult = await detector.verifyClaim(claim.trim());
    const processingTime = Date.now() - startTime;

    return res.json({
      success: true,
      data: {
        claim: claim.trim(),
        verification: result,
        metadata: {
          processingTimeMs: processingTime,
          timestamp: new Date().toISOString(),
          evidenceCount: result.evidence.length
        }
      }
    });

  } catch (error) {
    console.error('❌ Error in verify-claim:', error);
    return res.status(500).json({
      success: false,
      error: 'Verification failed',
      message: 'An error occurred while verifying the claim'
    });
  }
});

// Update news database endpoint
app.post('/update-news', async (req, res) => {
  try {
    const { topics } = req.body;
    
    if (!topics || !Array.isArray(topics)) {
      return res.status(400).json({
        error: 'Invalid topics',
        message: 'Topics must be an array of strings'
      });
    }

    if (topics.length > 10) {
      return res.status(400).json({
        error: 'Too many topics',
        message: 'Maximum 10 topics allowed per request'
      });
    }

    const validTopics = topics.filter(t => typeof t === 'string' && t.trim().length > 0);
    
    if (validTopics.length === 0) {
      return res.status(400).json({
        error: 'No valid topics',
        message: 'At least one valid topic required'
      });
    }

    console.log(`📰 API: Updating news for topics: ${validTopics.join(', ')}`);
    
    await detector.updateNewsDatabase(validTopics);
    
    return res.json({
      success: true,
      message: `News database updated for ${validTopics.length} topics`,
      topics: validTopics
    });

  } catch (error) {
    console.error('❌ Error in update-news:', error);
    return res.status(500).json({
      success: false,
      error: 'Update failed',
      message: 'An error occurred while updating the news database'
    });
  }
});

// Batch verification endpoint
app.post('/verify-claims-batch', verifyLimiter, async (req, res) => {
  try {
    const { claims } = req.body;
    
    if (!claims || !Array.isArray(claims)) {
      return res.status(400).json({
        error: 'Invalid claims',
        message: 'Claims must be an array of strings'
      });
    }

    if (claims.length > 5) {
      return res.status(400).json({
        error: 'Too many claims',
        message: 'Maximum 5 claims allowed per batch request'
      });
    }

    const validClaims = claims.filter(c => 
      typeof c === 'string' && c.trim().length > 0 && c.length <= 1000
    );

    if (validClaims.length === 0) {
      return res.status(400).json({
        error: 'No valid claims',
        message: 'At least one valid claim required'
      });
    }

    console.log(`🔍 API: Batch verifying ${validClaims.length} claims`);
    
    const results = await Promise.all(
      validClaims.map(async (claim) => {
        try {
          const verification = await detector.verifyClaim(claim.trim());
          return {
            claim: claim.trim(),
            verification,
            success: true
          };
        } catch (error) {
          return {
            claim: claim.trim(),
            error: 'Verification failed',
            success: false
          };
        }
      })
    );

    return res.json({
      success: true,
      data: results,
      metadata: {
        totalClaims: validClaims.length,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Error in batch verification:', error);
    return res.status(500).json({
      success: false,
      error: 'Batch verification failed',
      message: 'An error occurred while verifying claims'
    });
  }
});

// System stats endpoint
app.get('/stats', async (req, res) => {
  try {
    // You can extend this with actual metrics from Qdrant
    const stats = {
      status: 'operational',
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    };

    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('❌ Error getting stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get statistics'
    });
  }
});

// SSE STREAMING ENDPOINT
app.get("/verify-stream", async (req, res) => {
  const claim = req.query.claim as string;
  if (!claim) return res.status(400).json({ error: "claim required" });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.flushHeaders?.();

  const send = (event: string, data: any) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Handle client disconnect
  req.on("close", () => {
    res.end();
  });

  const orchestrator = new AgentOrchestrator(detector, (msg) => send("step", msg));

  try {
    const result = await orchestrator.verifyClaimAgentic(claim);
    send("final", result);
  } catch (e: any) {
    send("error", { message: e?.message || "verification failed" });
  } finally {
    res.end();
  }

  // Ensure a response is always returned
  return res;
});


// Agentic RAG verification endpoint
app.post('/verify-claim-agentic', verifyLimiter, async (req, res) => {
  try {
    const { claim } = req.body;

    // Validation
    if (!claim || typeof claim !== 'string' || claim.trim().length === 0) {
      return res.status(400).json({
        error: 'Invalid claim',
        message: 'Claim must be a non-empty string'
      });
    }

    if (claim.length > 1000) {
      return res.status(400).json({
        error: 'Claim too long',
        message: 'Claim must be less than 1000 characters'
      });
    }

    console.log(`🤖 API: Agentic verification for claim: "${claim.substring(0, 100)}..."`);

    const startTime = Date.now();
    const orchestrator = new AgentOrchestrator(detector);
    const result = await orchestrator.verifyClaimAgentic(claim.trim());
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
          agentsUsed: ['claim_analyst', 'evidence_researcher', 'fact_checker', 'synthesizer']
        }
      }
    });

  } catch (error) {
    console.error('❌ Error in agentic verification:', error);
    return res.status(500).json({
      success: false,
      error: 'Agentic verification failed',
      message: 'An error occurred while verifying the claim using agentic approach'
    });
  }
});

// Error handling middleware
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('❌ Unhandled error:', error);
  
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not found',
    message: `Endpoint ${req.method} ${req.path} not found`
  });
});

// Start server
async function startServer() {
  try {
    await initializeDetector();
    
    // Start continuous news monitoring
    const monitoringTopics = [
      'breaking news india',
      'government policy',
      'social media rumors',
      'fact check news'
    ];
    
    // Update news every hour
    setInterval(async () => {
      try {
        await detector.updateNewsDatabase(monitoringTopics);
        console.log('✅ Scheduled news update completed');
      } catch (error) {
        console.error('❌ Scheduled news update failed:', error);
      }
    }, 60 * 60 * 1000); // 1 hour

    app.listen(PORT, () => {
      console.log(`🚀 Misinformation Detection API running on port ${PORT}`);
      console.log(`📖 API Documentation: http://localhost:${PORT}/`);
      console.log(`💚 Health Check: http://localhost:${PORT}/health`);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('👋 Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('👋 Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

if (require.main === module) {
  startServer();
}

export { app, detector };