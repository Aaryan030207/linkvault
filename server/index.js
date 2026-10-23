require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const Url = require('./models/Url');
const urlRoutes = require('./routes/url');

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB Connection
const MONGODB_URI =
  process.env.MONGODB_URI ||
  'mongodb+srv://aaryanbohra2007_db_user:hsGEsAw2GJFi5oer@cluster0.hljwi5w.mongodb.net/linkvault?retryWrites=true&w=majority';

const connectDB = async (retries = 5, delay = 3000) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await mongoose.connect(MONGODB_URI, {
        serverSelectionTimeoutMS: 10000
      });
      console.log('✅ Connected to MongoDB Atlas successfully.');
      return;
    } catch (err) {
      console.error(`❌ MongoDB Connection Attempt ${attempt} failed: ${err.message}`);
      if (attempt < retries) {
        console.log(`⏳ Retrying MongoDB connection in ${delay / 1000}s...`);
        await new Promise((res) => setTimeout(res, delay));
      } else {
        console.error('❌ All MongoDB connection attempts exhausted. Please check Atlas IP whitelist and network access.');
      }
    }
  }
};

connectDB();

mongoose.connection.on('disconnected', () => {
  console.warn('⚠️  MongoDB disconnected. Attempting reconnect...');
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// Mount API routes
app.use('/api/url', urlRoutes);

// Helper for stylized HTML error responses for browser visits
const renderStatusPage = ({ title, heading, message, code, badge, isExpired = false }) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} | LinkVault</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #0b0f19;
      color: #e2e8f0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
    }
    .card {
      background: #111827;
      border: 1px solid #1f2937;
      border-radius: 1rem;
      padding: 2.5rem;
      max-width: 480px;
      width: 100%;
      text-align: center;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    }
    .badge {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      margin-bottom: 1.25rem;
      ${isExpired ? 'background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3);' : 'background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3);'}
    }
    h1 {
      font-size: 1.75rem;
      font-weight: 700;
      color: #ffffff;
      margin-bottom: 0.75rem;
    }
    p {
      color: #94a3b8;
      font-size: 0.95rem;
      line-height: 1.5;
      margin-bottom: 1.5rem;
    }
    .code-box {
      background: #1e293b;
      padding: 0.5rem 1rem;
      border-radius: 0.5rem;
      font-family: monospace;
      color: #38bdf8;
      display: inline-block;
      margin-bottom: 1.5rem;
      font-size: 1rem;
    }
    .btn {
      display: inline-block;
      background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
      color: #ffffff;
      font-weight: 600;
      padding: 0.75rem 1.5rem;
      border-radius: 0.5rem;
      text-decoration: none;
      transition: all 0.2s ease;
      box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4);
    }
    .btn:hover {
      background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%);
      transform: translateY(-1px);
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">${badge}</div>
    <h1>${heading}</h1>
    <p>${message}</p>
    ${code ? `<div class="code-box">Code: ${code}</div>` : ''}
    <div>
      <a href="${CLIENT_URL}" class="btn">Go to LinkVault Home</a>
    </div>
  </div>
</body>
</html>
`;

/**
 * Redirect short links to original URL
 * Handles click tracking and expiry validation
 */
app.get('/:code', async (req, res) => {
  try {
    const { code } = req.params;

    // Filter out internal and static assets
    if (['favicon.ico', 'api', 'health', 'robots.txt'].includes(code)) {
      return res.status(404).send('Not Found');
    }

    const url = await Url.findOne({ urlCode: code });

    if (!url) {
      if (req.accepts('html')) {
        return res.status(404).send(
          renderStatusPage({
            title: '404 - Link Not Found',
            heading: 'Short Link Not Found',
            message: 'The link you are trying to visit does not exist or has been deleted.',
            code,
            badge: '404 Not Found'
          })
        );
      }
      return res.status(404).json({
        success: false,
        message: 'Short link not found',
        code
      });
    }

    // Check link expiration
    if (url.expiresAt && new Date() > new Date(url.expiresAt)) {
      if (req.accepts('html')) {
        return res.status(410).send(
          renderStatusPage({
            title: '410 - Link Expired',
            heading: 'This Link Has Expired',
            message: `This short link expired on ${new Date(url.expiresAt).toLocaleString()} and is no longer accessible.`,
            code,
            badge: 'Expired',
            isExpired: true
          })
        );
      }
      return res.status(410).json({
        success: false,
        message: 'This short link has expired',
        code,
        expiredAt: url.expiresAt
      });
    }

    // Track click count atomically and update lastClickedAt
    await Url.findOneAndUpdate(
      { urlCode: code },
      {
        $inc: { clicks: 1 },
        $set: { lastClickedAt: new Date() }
      }
    );

    // Redirect to original URL
    return res.redirect(url.originalUrl);
  } catch (error) {
    console.error(`Error redirecting /${req.params.code}:`, error);
    return res.status(500).json({
      success: false,
      message: 'Server error during redirection',
      error: error.message
    });
  }
});

// Global 404 handler for unknown routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'production' ? null : err.message
  });
});

app.listen(PORT, () => {
  console.log(`🚀 LinkVault server running on port ${PORT}`);
  console.log(`🔗 API Base: http://localhost:${PORT}/api/url`);
});
