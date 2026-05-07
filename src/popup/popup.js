class PopupManager {
  constructor() {
    this.currentAnalysis = null;
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.requestAnalysis();
  }

  setupEventListeners() {
    document.getElementById('exportBtn').addEventListener('click', () => this.exportJSON());
    document.getElementById('reloadBtn').addEventListener('click', () => this.requestAnalysis());
    document.getElementById('settingsBtn').addEventListener('click', () => alert('Configuracoes em breve!'));
  }

  requestAnalysis() {
    const loading = document.getElementById('loading');
    const results = document.getElementById('results');
    const error = document.getElementById('error');

    loading.style.display = 'block';
    results.style.display = 'none';
    error.style.display = 'none';

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) {
        this.showError('Aba nao encontrada');
        loading.style.display = 'none';
        error.style.display = 'block';
        return;
      }

      chrome.tabs.sendMessage(tabs[0].id, { type: 'REQUEST_ANALYSIS' }, (response) => {
        if (chrome.runtime.lastError) {
          chrome.storage.local.get('lastAnalysis', (result) => {
            if (result.lastAnalysis) {
              this.currentAnalysis = result.lastAnalysis;
              this.renderResults();
              loading.style.display = 'none';
              results.style.display = 'block';
            } else {
              this.showError('Nao foi possivel analisar esta pagina. Recarregue a pagina.');
              loading.style.display = 'none';
              error.style.display = 'block';
            }
          });
        } else if (response && response.success) {
          this.currentAnalysis = response.data;
          this.renderResults();
          loading.style.display = 'none';
          results.style.display = 'block';
        } else {
          this.showError('Erro ao obter dados');
          loading.style.display = 'none';
          error.style.display = 'block';
        }
      });
    });
  }

  renderResults() {
    const data = this.currentAnalysis;

    try {
      const hostname = new URL(data.url).hostname;
      document.getElementById('urlDisplay').textContent = hostname;
    } catch (e) {
      document.getElementById('urlDisplay').textContent = data.url;
    }

    const score = this.calculateScore();
    document.getElementById('scoreValue').textContent = score.toFixed(1);
    document.getElementById('scoreMsg').textContent = this.getScoreMessage(score);

    this.setCheckItem('title', data.meta && data.meta.titleOptimal,
      `${(data.meta && data.meta.titleLength) || 0} caracteres ${(data.meta && data.meta.titleOptimal) ? '(otimo)' : '(fora do ideal: 30-60)'}`);

    this.setCheckItem('desc', data.meta && data.meta.descriptionOptimal,
      `${(data.meta && data.meta.descriptionLength) || 0} caracteres ${(data.meta && data.meta.descriptionOptimal) ? '(otimo)' : '(ideal: 120-160)'}`);

    const h1Count = (data.headings && data.headings.distribution && data.headings.distribution.h1) || 0;
    this.setCheckItem('h1', h1Count === 1,
      `${h1Count} H1 encontrado(s) ${h1Count === 1 ? '(ideal)' : '(ideal: 1)'}`);

    this.setCheckItem('mobile', data.technical && data.technical.mobile,
      (data.technical && data.technical.mobile) ? 'Detectado' : 'Nao configurado');

    this.setCheckItem('https', data.technical && data.technical.isHTTPS,
      (data.technical && data.technical.isHTTPS) ? 'Seguro' : 'Inseguro');

    const totalImages = (data.images && data.images.total) || 0;
    const imagesWithAlt = (data.images && data.images.withAlt) || 0;
    const altPercentage = totalImages > 0 ? Math.round((imagesWithAlt / totalImages) * 100) : 100;
    this.setCheckItem('images', altPercentage >= 80,
      `${altPercentage}% das imagens tem alt text`);

    const wordCount = (data.keywords && data.keywords.wordCount) || 0;
    const readingTime = (data.keywords && data.keywords.readingTime) || 0;
    document.getElementById('wordCountMsg').textContent =
      `${wordCount} palavras (${readingTime} min de leitura)`;
  }

  setCheckItem(id, isGood, message) {
    const icon = document.getElementById(`${id}Check`);
    const msg = document.getElementById(`${id}Msg`);

    icon.textContent = isGood ? 'OK' : '!';
    icon.className = `check-icon ${isGood ? 'good' : 'warning'}`;
    msg.textContent = message;
  }

  calculateScore() {
    const data = this.currentAnalysis;
    let score = 5;

    if (data.meta && data.meta.titleOptimal) score += 1;
    if (data.meta && data.meta.descriptionOptimal) score += 1;
    if (data.headings && data.headings.distribution && data.headings.distribution.h1 === 1) score += 1;
    if (data.technical && data.technical.mobile) score += 1;
    if (data.technical && data.technical.isHTTPS) score += 1;

    const totalImages = (data.images && data.images.total) || 0;
    const imagesWithAlt = (data.images && data.images.withAlt) || 0;
    if (totalImages > 0 && (imagesWithAlt / totalImages) >= 0.8) score += 1;

    if (data.keywords && data.keywords.wordCount > 300) score += 1;

    return Math.min(score, 10);
  }

  getScoreMessage(score) {
    if (score >= 8) return 'Excelente! Seu SEO esta muito bom';
    if (score >= 6) return 'Bom, mas ha melhorias possiveis';
    if (score >= 4) return 'Precisa de otimizacoes';
    return 'Muitos problemas identificados';
  }

  exportJSON() {
    if (!this.currentAnalysis) return;

    const dataStr = JSON.stringify(this.currentAnalysis, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `seo-analysis-${Date.now()}.json`;
    link.click();

    URL.revokeObjectURL(url);
  }

  showError(message) {
    document.getElementById('errorMsg').textContent = message;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new PopupManager();
});
