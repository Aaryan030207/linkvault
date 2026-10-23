import React, { useState, useEffect, useMemo } from 'react';
import {
  Link2,
  Copy,
  Check,
  ExternalLink,
  Trash2,
  QrCode,
  Clock,
  BarChart3,
  Search,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  X,
  Layers,
  MousePointerClick,
  Sliders,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import {
  shortenUrl,
  fetchLinks,
  fetchStats,
  deleteLink,
  checkServerHealth
} from './api';

export default function App() {
  // Form states
  const [originalUrl, setOriginalUrl] = useState('');
  const [expiryPreset, setExpiryPreset] = useState('0'); // '0', '1', '7', '30', 'custom'
  const [customExpiry, setCustomExpiry] = useState('');
  const [customCode, setCustomCode] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [latestShortened, setLatestShortened] = useState(null);

  // Dashboard states
  const [links, setLinks] = useState([]);
  const [stats, setStats] = useState({
    totalLinks: 0,
    totalClicks: 0,
    activeLinks: 0,
    expiredLinks: 0
  });
  const [isLoadingLinks, setIsLoadingLinks] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // 'all' | 'active' | 'expired'
  const [copiedId, setCopiedId] = useState(null);
  const [toastMessage, setToastMessage] = useState('');
  const [qrModalUrl, setQrModalUrl] = useState(null);
  const [serverOnline, setServerOnline] = useState(true);

  // Show transient toast
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  // Copy to clipboard helper
  const handleCopy = async (text, id) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
      }
      setCopiedId(id);
      showToast('Copied to clipboard!');
      setTimeout(() => setCopiedId(null), 2500);
    } catch (err) {
      console.error('Copy failed:', err);
      showToast('Failed to copy to clipboard');
    }
  };

  // Load links and stats
  const loadData = async () => {
    setIsLoadingLinks(true);
    try {
      const [linksData, statsData, healthData] = await Promise.allSettled([
        fetchLinks(),
        fetchStats(),
        checkServerHealth()
      ]);

      if (linksData.status === 'fulfilled') {
        setLinks(linksData.value);
      }
      if (statsData.status === 'fulfilled') {
        setStats(statsData.value);
      }
      if (healthData.status === 'fulfilled') {
        setServerOnline(healthData.value.ok);
      }
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setIsLoadingLinks(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Handle URL Shorten submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!originalUrl.trim()) {
      setFormError('Please enter a destination URL.');
      return;
    }

    let calculatedExpiry = null;
    if (expiryPreset === 'custom') {
      const parsed = parseInt(customExpiry, 10);
      if (isNaN(parsed) || parsed < 1) {
        setFormError('Please enter a valid number of days for custom expiry.');
        return;
      }
      calculatedExpiry = parsed;
    } else if (expiryPreset !== '0') {
      calculatedExpiry = parseInt(expiryPreset, 10);
    }

    if (customCode.trim() && !/^[a-zA-Z0-9]{6}$/.test(customCode.trim())) {
      setFormError('Custom code must be exactly 6 alphanumeric characters.');
      return;
    }

    setLoading(true);
    try {
      const res = await shortenUrl({
        originalUrl: originalUrl.trim(),
        expiryDays: calculatedExpiry,
        customCode: customCode.trim() || undefined
      });

      setLatestShortened(res.data);
      showToast('Link shortened successfully!');
      setOriginalUrl('');
      setCustomCode('');
      setCustomExpiry('');
      setExpiryPreset('0');
      // Refresh list and stats
      loadData();
    } catch (err) {
      setFormError(err.message || 'Failed to shorten URL');
    } finally {
      setLoading(false);
    }
  };

  // Delete Link handler
  const handleDelete = async (code) => {
    if (!window.confirm(`Are you sure you want to delete short link code "${code}"?`)) {
      return;
    }

    try {
      await deleteLink(code);
      showToast(`Link "${code}" removed`);
      setLinks((prev) => prev.filter((item) => item.urlCode !== code));
      if (latestShortened && latestShortened.urlCode === code) {
        setLatestShortened(null);
      }
      // Re-fetch stats
      fetchStats().then(setStats).catch(console.error);
    } catch (err) {
      showToast(err.message || 'Failed to delete URL');
    }
  };

  // Filter links
  const filteredLinks = useMemo(() => {
    return links.filter((link) => {
      // Status filter
      if (filterStatus === 'active' && link.isExpired) return false;
      if (filterStatus === 'expired' && !link.isExpired) return false;

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesCode = link.urlCode.toLowerCase().includes(query);
        const matchesOriginal = link.originalUrl.toLowerCase().includes(query);
        const matchesShort = link.shortUrl.toLowerCase().includes(query);
        return matchesCode || matchesOriginal || matchesShort;
      }
      return true;
    });
  }, [links, filterStatus, searchQuery]);

  // Format date helper
  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Format expiry status helper
  const renderExpiryInfo = (link) => {
    if (!link.expiresAt) {
      return <span style={{ color: 'var(--text-dim)' }}>Never</span>;
    }

    const expiryDate = new Date(link.expiresAt);
    const now = new Date();
    const diffMs = expiryDate - now;

    if (diffMs <= 0) {
      return (
        <span className="badge-tag badge-expired">
          <Clock size={12} /> Expired
        </span>
      );
    }

    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return (
      <span className="badge-tag badge-active" title={expiryDate.toLocaleString()}>
        <Clock size={12} /> {diffDays === 1 ? 'Expires in 1 day' : `Expires in ${diffDays} days`}
      </span>
    );
  };

  return (
    <div className="container">
      {/* Navbar */}
      <nav className="navbar">
        <a href="/" className="brand">
          <div className="brand-icon">
            <Link2 size={24} color="#ffffff" />
          </div>
          <span className="brand-title">LinkVault</span>
        </a>

        <div className={`status-badge ${serverOnline ? '' : 'disconnected'}`}>
          <div className="status-dot"></div>
          <span>{serverOnline ? 'MongoDB & API Online' : 'Server Disconnected'}</span>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="hero">
        <div className="hero-tag">
          <Sparkles size={14} />
          <span>MERN URL Engine & Real-Time Analytics</span>
        </div>
        <h1 className="hero-title">
          Shorten. Share. <span className="hero-gradient-text">Track Everything.</span>
        </h1>
        <p className="hero-desc">
          Transform unwieldy URLs into lightning-fast 6-character links with click tracking, custom expiration, and real-time metrics.
        </p>
      </header>

      {/* Main Shortener Form Box */}
      <section className="glass-card shortener-box">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="originalUrlInput" className="input-label">
              Destination URL
            </label>
            <div className="input-container">
              <input
                id="originalUrlInput"
                type="url"
                required
                className="url-input"
                placeholder="https://example.com/very/long/destination/url"
                value={originalUrl}
                onChange={(e) => setOriginalUrl(e.target.value)}
              />
              <button
                type="submit"
                className="btn-primary"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <RefreshCw size={18} className="spin" />
                    <span>Shortening...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={18} />
                    <span>Shorten URL</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Advanced Options Accordion */}
          <div>
            <button
              type="button"
              className="options-toggle-btn"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              <Sliders size={14} />
              <span>{showAdvanced ? 'Hide Expiry & Custom Code' : 'Configure Expiry & Custom Code'}</span>
              {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {showAdvanced && (
              <div className="options-row">
                {/* Expiry Selector */}
                <div>
                  <label className="input-label">Link Expiration</label>
                  <div className="expiry-chips">
                    {[
                      { label: 'Never', value: '0' },
                      { label: '24 Hours', value: '1' },
                      { label: '7 Days', value: '7' },
                      { label: '30 Days', value: '30' },
                      { label: 'Custom', value: 'custom' }
                    ].map((chip) => (
                      <button
                        key={chip.value}
                        type="button"
                        className={`chip-btn ${expiryPreset === chip.value ? 'active' : ''}`}
                        onClick={() => setExpiryPreset(chip.value)}
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>

                  {expiryPreset === 'custom' && (
                    <div style={{ marginTop: '0.65rem' }}>
                      <input
                        type="number"
                        min="1"
                        max="365"
                        placeholder="Number of days (e.g., 14)"
                        className="custom-input"
                        value={customExpiry}
                        onChange={(e) => setCustomExpiry(e.target.value)}
                      />
                    </div>
                  )}
                </div>

                {/* Optional Custom 6-Char Code */}
                <div>
                  <label htmlFor="customCodeInput" className="input-label">
                    Custom 6-Char Code (Optional)
                  </label>
                  <input
                    id="customCodeInput"
                    type="text"
                    maxLength={6}
                    placeholder="e.g. goFast (6 chars)"
                    className="custom-input"
                    value={customCode}
                    onChange={(e) => setCustomCode(e.target.value)}
                  />
                  <small style={{ color: 'var(--text-dim)', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>
                    Leave blank to auto-generate a unique 6-character code.
                  </small>
                </div>
              </div>
            )}
          </div>

          {/* Form Error Message */}
          {formError && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1rem', color: '#f87171', fontSize: '0.875rem' }}>
              <AlertCircle size={16} />
              <span>{formError}</span>
            </div>
          )}
        </form>

        {/* Latest Shortened Link Card */}
        {latestShortened && (
          <div className="result-banner">
            <div className="result-info">
              <span className="result-label">Your Shortened Link is Ready!</span>
              <span className="result-url">{latestShortened.shortUrl}</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Target: {latestShortened.originalUrl}
              </span>
            </div>

            <div className="result-actions">
              <button
                type="button"
                className={`btn-action ${copiedId === 'latest' ? 'copied' : ''}`}
                onClick={() => handleCopy(latestShortened.shortUrl, 'latest')}
              >
                {copiedId === 'latest' ? <Check size={16} /> : <Copy size={16} />}
                <span>{copiedId === 'latest' ? 'Copied' : 'Copy'}</span>
              </button>

              <button
                type="button"
                className="btn-action"
                onClick={() => setQrModalUrl(latestShortened.shortUrl)}
              >
                <QrCode size={16} />
                <span>QR Code</span>
              </button>

              <a
                href={latestShortened.shortUrl}
                target="_blank"
                rel="noreferrer"
                className="btn-action"
                onClick={() => {
                  // After short delay, refresh click counts
                  setTimeout(loadData, 1000);
                }}
              >
                <ExternalLink size={16} />
                <span>Visit</span>
              </a>
            </div>
          </div>
        )}
      </section>

      {/* Stats Overview */}
      <section className="stats-grid">
        <div className="glass-card stat-card">
          <div className="stat-icon blue">
            <Layers size={24} />
          </div>
          <div>
            <div className="stat-value">{stats.totalLinks}</div>
            <div className="stat-title">Total Short Links</div>
          </div>
        </div>

        <div className="glass-card stat-card">
          <div className="stat-icon purple">
            <MousePointerClick size={24} />
          </div>
          <div>
            <div className="stat-value">{stats.totalClicks}</div>
            <div className="stat-title">Total Redirect Clicks</div>
          </div>
        </div>

        <div className="glass-card stat-card">
          <div className="stat-icon green">
            <ShieldCheck size={24} />
          </div>
          <div>
            <div className="stat-value">{stats.activeLinks}</div>
            <div className="stat-title">Active Links</div>
          </div>
        </div>

        <div className="glass-card stat-card">
          <div className="stat-icon orange">
            <Clock size={24} />
          </div>
          <div>
            <div className="stat-value">{stats.expiredLinks}</div>
            <div className="stat-title">Expired Links</div>
          </div>
        </div>
      </section>

      {/* Dashboard Section */}
      <section>
        <div className="dashboard-header">
          <div className="dashboard-title-group">
            <BarChart3 size={24} color="#6366f1" />
            <h2 className="dashboard-title">Links Dashboard</h2>
            <span className="links-count-pill">{links.length} total</span>
          </div>

          <div className="dashboard-controls">
            {/* Search Input */}
            <div className="search-box">
              <Search size={16} className="search-icon" />
              <input
                type="text"
                className="search-input"
                placeholder="Search links or code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Status Filter */}
            <div className="filter-tabs">
              <button
                type="button"
                className={`tab-btn ${filterStatus === 'all' ? 'active' : ''}`}
                onClick={() => setFilterStatus('all')}
              >
                All
              </button>
              <button
                type="button"
                className={`tab-btn ${filterStatus === 'active' ? 'active' : ''}`}
                onClick={() => setFilterStatus('active')}
              >
                Active
              </button>
              <button
                type="button"
                className={`tab-btn ${filterStatus === 'expired' ? 'active' : ''}`}
                onClick={() => setFilterStatus('expired')}
              >
                Expired
              </button>
            </div>

            {/* Refresh Button */}
            <button
              type="button"
              className="btn-refresh"
              title="Refresh link metrics"
              onClick={loadData}
            >
              <RefreshCw size={16} className={isLoadingLinks ? 'spin' : ''} />
            </button>
          </div>
        </div>

        {/* Links Data Table */}
        <div className="glass-card table-card">
          <div className="table-wrapper">
            <table className="links-table">
              <thead>
                <tr>
                  <th>Short Code</th>
                  <th>Original URL</th>
                  <th>Clicks</th>
                  <th>Expiration</th>
                  <th>Created</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredLinks.length > 0 ? (
                  filteredLinks.map((item) => (
                    <tr key={item._id || item.urlCode}>
                      <td>
                        <a
                          href={item.shortUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="short-url-link"
                          onClick={() => setTimeout(loadData, 1000)}
                        >
                          <span>{item.urlCode}</span>
                          <ExternalLink size={12} />
                        </a>
                      </td>

                      <td>
                        <a
                          href={item.originalUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="original-url-text"
                          title={item.originalUrl}
                        >
                          {item.originalUrl}
                        </a>
                      </td>

                      <td>
                        <div className="clicks-pill">
                          <MousePointerClick size={13} />
                          <span>{item.clicks}</span>
                        </div>
                      </td>

                      <td>{renderExpiryInfo(item)}</td>

                      <td style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>
                        {formatDate(item.createdAt)}
                      </td>

                      <td>
                        <div className="action-buttons" style={{ justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            className="btn-icon"
                            title="Copy short link"
                            onClick={() => handleCopy(item.shortUrl, item.urlCode)}
                          >
                            {copiedId === item.urlCode ? (
                              <Check size={15} color="#34d399" />
                            ) : (
                              <Copy size={15} />
                            )}
                          </button>

                          <button
                            type="button"
                            className="btn-icon"
                            title="View QR Code"
                            onClick={() => setQrModalUrl(item.shortUrl)}
                          >
                            <QrCode size={15} />
                          </button>

                          <button
                            type="button"
                            className="btn-icon delete"
                            title="Delete link"
                            onClick={() => handleDelete(item.urlCode)}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6}>
                      <div className="empty-state">
                        <div className="empty-icon">
                          <Link2 size={32} />
                        </div>
                        <h3 className="empty-title">No Links Found</h3>
                        <p className="empty-desc">
                          {searchQuery
                            ? `No links matched your search term "${searchQuery}".`
                            : 'You haven’t created any shortened links yet. Shorten your first link above!'}
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* QR Code Modal */}
      {qrModalUrl && (
        <div className="modal-backdrop" onClick={() => setQrModalUrl(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="modal-title">QR Code</h3>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setQrModalUrl(null)}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
              Scan with your mobile device to open this short link directly.
            </p>

            <div className="qr-wrapper">
              <QRCodeSVG
                value={qrModalUrl}
                size={200}
                level="H"
                includeMargin={false}
              />
            </div>

            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: '#38bdf8', marginBottom: '1.25rem', wordBreak: 'break-all' }}>
              {qrModalUrl}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
              <button
                type="button"
                className="btn-action"
                onClick={() => handleCopy(qrModalUrl, 'modal')}
              >
                {copiedId === 'modal' ? <Check size={16} /> : <Copy size={16} />}
                <span>{copiedId === 'modal' ? 'Copied' : 'Copy Link'}</span>
              </button>
              <button
                type="button"
                className="btn-primary"
                style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                onClick={() => setQrModalUrl(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast */}
      {toastMessage && (
        <div className="toast">
          <Sparkles size={16} color="#6366f1" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Footer */}
      <footer className="footer">
        <p>
          LinkVault &bull; Full-stack MERN URL Shortener &bull; Built with MongoDB Atlas, Express, React & Node.js
        </p>
      </footer>
    </div>
  );
}
