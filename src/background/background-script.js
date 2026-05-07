class AnalysisProcessor {
  constructor() {
    this.setupListeners();
  }

  setupListeners() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.type === 'SEO_ANALYSIS_COMPLETE') {
        this.processAnalysis(request.data, sender.tab.id);
        sendResponse({ success: true });
      }
    });
  }

  processAnalysis(data, tabId) {
    if (!data || !data.url) {
      console.error('Invalid analysis data');
      return;
    }

    const score = this.calculateScore(data);

    chrome.action.setBadgeText({
      text: Math.round(score).toString(),
      tabId
    });

    chrome.action.setBadgeBackgroundColor({
      color: this.getScoreColor(score),
      tabId
    });

    this.saveToStorage(data, score);
  }

  calculateScore(data) {
    let score = 5;

    if (data.meta?.titleOptimal) score += 1;
    if (data.meta?.descriptionOptimal) score += 1;
    if (data.headings?.distribution?.h1 === 1) score += 1;
    if (data.technical?.mobile) score += 1;
    if (data.technical?.isHTTPS) score += 1;
    if (data.images?.total > 0 && (data.images.withAlt / data.images.total) >= 0.8) score += 1;
    if (data.keywords?.wordCount > 300) score += 1;

    return Math.min(score, 10);
  }

  getScoreColor(score) {
    if (score >= 8) return '#10b981';
    if (score >= 6) return '#f59e0b';
    return '#ef4444';
  }

  saveToStorage(data, score) {
    const analysisWithScore = {
      ...data,
      score,
      analyzedAt: new Date().toISOString()
    };

    chrome.storage.local.get('analysisHistory', (result) => {
      const history = result.analysisHistory || [];
      history.unshift(analysisWithScore);
      const limited = history.slice(0, 50);

      chrome.storage.local.set({
        analysisHistory: limited,
        lastAnalysis: analysisWithScore
      });
    });
  }
}

new AnalysisProcessor();
