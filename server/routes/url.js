const express = require('express');
const crypto = require('crypto');
const Url = require('../models/Url');

const router = express.Router();

/**
 * Generate a cryptographically random 6-character alphanumeric code
 */
const generateCode = (length = 6) => {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
};

/**
 * Validate URL format
 */
const normalizeAndValidateUrl = (inputUrl) => {
  if (!inputUrl || typeof inputUrl !== 'string') return null;
  let formatted = inputUrl.trim();
  if (!/^https?:\/\//i.test(formatted)) {
    formatted = 'https://' + formatted;
  }
  try {
    const parsed = new URL(formatted);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    return parsed.href;
  } catch (err) {
    return null;
  }
};

/**
 * @route   POST /api/url/shorten
 * @desc    Shorten a long URL to a 6-character code
 * @access  Public
 */
router.post('/shorten', async (req, res) => {
  try {
    const { originalUrl, expiryDays, customCode } = req.body;

    if (!originalUrl) {
      return res.status(400).json({
        success: false,
        message: 'Original URL is required'
      });
    }

    const validatedUrl = normalizeAndValidateUrl(originalUrl);
    if (!validatedUrl) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid HTTP or HTTPS URL'
      });
    }

    let urlCode;

    // Optional custom code support (must be 6 alphanumeric chars)
    if (customCode && typeof customCode === 'string') {
      const sanitizedCode = customCode.trim();
      if (!/^[a-zA-Z0-9]{6}$/.test(sanitizedCode)) {
        return res.status(400).json({
          success: false,
          message: 'Custom code must be exactly 6 alphanumeric characters'
        });
      }
      const existing = await Url.findOne({ urlCode: sanitizedCode });
      if (existing) {
        return res.status(409).json({
          success: false,
          message: 'This custom code is already taken. Please choose another.'
        });
      }
      urlCode = sanitizedCode;
    } else {
      // Auto-generate unique 6-character code
      let isUnique = false;
      let attempts = 0;
      while (!isUnique && attempts < 10) {
        urlCode = generateCode(6);
        const existing = await Url.findOne({ urlCode });
        if (!existing) {
          isUnique = true;
        }
        attempts++;
      }

      if (!isUnique) {
        return res.status(500).json({
          success: false,
          message: 'Could not generate unique code. Please try again.'
        });
      }
    }

    // Calculate expiration if expiryDays provided
    let expiresAt = null;
    const parsedExpiryDays = expiryDays ? Number(expiryDays) : null;
    if (parsedExpiryDays && !isNaN(parsedExpiryDays) && parsedExpiryDays > 0) {
      const expiryMs = parsedExpiryDays * 24 * 60 * 60 * 1000;
      expiresAt = new Date(Date.now() + expiryMs);
    }

    const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
    const shortUrl = `${baseUrl}/${urlCode}`;

    const newUrl = new Url({
      urlCode,
      originalUrl: validatedUrl,
      shortUrl,
      clicks: 0,
      expiryDays: parsedExpiryDays || null,
      expiresAt,
      lastClickedAt: null
    });

    await newUrl.save();

    return res.status(201).json({
      success: true,
      message: 'URL shortened successfully',
      data: newUrl
    });
  } catch (error) {
    console.error('Error in POST /api/url/shorten:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while shortening URL',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/url/links
 * @desc    Get all URLs for dashboard
 * @access  Public
 */
router.get('/links', async (req, res) => {
  try {
    const urls = await Url.find().sort({ createdAt: -1 });

    const formattedUrls = urls.map((url) => {
      const isExpired = url.expiresAt ? new Date() > new Date(url.expiresAt) : false;
      return {
        _id: url._id,
        urlCode: url.urlCode,
        originalUrl: url.originalUrl,
        shortUrl: url.shortUrl,
        clicks: url.clicks,
        expiryDays: url.expiryDays,
        expiresAt: url.expiresAt,
        lastClickedAt: url.lastClickedAt,
        createdAt: url.createdAt,
        isExpired
      };
    });

    return res.status(200).json({
      success: true,
      count: formattedUrls.length,
      data: formattedUrls
    });
  } catch (error) {
    console.error('Error in GET /api/url/links:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve links',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/url/stats
 * @desc    Get summary statistics for dashboard
 * @access  Public
 */
router.get('/stats', async (req, res) => {
  try {
    const urls = await Url.find();
    const totalLinks = urls.length;
    const totalClicks = urls.reduce((sum, item) => sum + (item.clicks || 0), 0);
    const now = new Date();

    const activeLinks = urls.filter(
      (u) => !u.expiresAt || new Date(u.expiresAt) > now
    ).length;
    const expiredLinks = totalLinks - activeLinks;

    return res.status(200).json({
      success: true,
      data: {
        totalLinks,
        totalClicks,
        activeLinks,
        expiredLinks
      }
    });
  } catch (error) {
    console.error('Error in GET /api/url/stats:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve stats',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/url/info/:code
 * @desc    Get single URL info
 * @access  Public
 */
router.get('/info/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const url = await Url.findOne({ urlCode: code });

    if (!url) {
      return res.status(404).json({
        success: false,
        message: 'Short link not found'
      });
    }

    const isExpired = url.expiresAt ? new Date() > new Date(url.expiresAt) : false;

    return res.status(200).json({
      success: true,
      data: {
        ...url.toObject(),
        isExpired
      }
    });
  } catch (error) {
    console.error('Error in GET /api/url/info/:code:', error);
    return res.status(500).json({
      success: false,
      message: 'Error retrieving URL information',
      error: error.message
    });
  }
});

/**
 * @route   DELETE /api/url/:code
 * @desc    Delete a short URL
 * @access  Public
 */
router.delete('/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const deleted = await Url.findOneAndDelete({ urlCode: code });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Short URL not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'URL deleted successfully',
      code
    });
  } catch (error) {
    console.error('Error in DELETE /api/url/:code:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete URL',
      error: error.message
    });
  }
});

module.exports = router;
