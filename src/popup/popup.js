class PopupManager {
  constructor() {
    this.currentAnalysis = null;
    this.init();
  }

  init() {
    document.getElementById('exportBtn').addEventListener('click', () => this.exportJSON());
    document.getElementById('reloadBtn').addEventListener('click', () => this.requestAnalysis());
    document.getElementById('retryBtn') && document.getElementById('retryBtn').addEventListener('click', () => this.requestAnalysis());
    this.requestAnalysis();
  }

  requestAnalysis() {
    document.getElementById('loading').style.display = 'flex';
    document.getElementById('results').style.display = 'none';
    document.getElementById('error').style.display = 'none';

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) {
        return this.showError('Aba nao encontrada');
      }

      chrome.tabs.sendMessage(tabs[0].id, { type: 'REQUEST_ANALYSIS' }, (response) => {
        if (chrome.runtime.lastError) {
          chrome.storage.local.get('lastAnalysis', (result) => {
            if (result.lastAnalysis) {
              this.render(result.lastAnalysis);
            } else {
              this.showError('Nao foi possivel analisar esta pagina. Recarregue a pagina (F5) e tente novamente.');
            }
          });
        } else if (response && response.success && response.data) {
          this.render(response.data);
        } else {
          this.showError('Erro ao obter dados da pagina.');
        }
      });
    });
  }

  render(data) {
    this.currentAnalysis = data;

    try {
      document.getElementById('urlDisplay').textContent = new URL(data.url).hostname;
    } catch (e) {
      document.getElementById('urlDisplay').textContent = data.url || '';
    }

    this.renderScore();
    this.renderMetaTags();
    this.renderChecks();
    this.renderKeywords();
    this.renderActionPlan();

    document.getElementById('loading').style.display = 'none';
    document.getElementById('results').style.display = 'block';
  }

  // ─── SCORE ───────────────────────────────────────────────

  renderScore() {
    const score = this.calculateScore();
    const el = document.getElementById('scoreValue');
    el.textContent = score.toFixed(1);
    el.className = 'score-number ' + this.scoreClass(score);

    document.getElementById('scoreMsg').textContent = this.scoreMessage(score);

    const fill = document.getElementById('scoreFill');
    fill.style.width = (score / 10 * 100) + '%';
    fill.className = 'score-fill ' + this.scoreClass(score);
  }

  calculateScore() {
    const d = this.currentAnalysis;
    let s = 3;
    if (d.meta && d.meta.titleOptimal) s += 1;
    if (d.meta && d.meta.descriptionOptimal) s += 1;
    if (d.headings && d.headings.distribution && d.headings.distribution.h1 === 1) s += 1;
    if (d.technical && d.technical.isHTTPS) s += 1;
    if (d.technical && d.technical.mobile) s += 1;
    const tot = (d.images && d.images.total) || 0;
    const alt = (d.images && d.images.withAlt) || 0;
    if (tot === 0 || (alt / tot) >= 0.8) s += 1;
    if (d.keywords && d.keywords.wordCount >= 300) s += 1;
    return Math.min(s, 10);
  }

  scoreClass(score) {
    if (score >= 8) return 'green';
    if (score >= 5) return 'amber';
    return 'red';
  }

  scoreMessage(score) {
    if (score >= 8) return 'Excelente — SEO bem otimizado';
    if (score >= 6) return 'Bom — ha melhorias possiveis';
    if (score >= 4) return 'Regular — varios pontos para otimizar';
    return 'Critico — muitos problemas identificados';
  }

  // ─── META TAGS ───────────────────────────────────────────

  renderMetaTags() {
    const meta = this.currentAnalysis.meta || {};

    // Title
    const titleContent = document.getElementById('titleContent');
    const titleBadge = document.getElementById('titleBadge');
    if (meta.title) {
      titleContent.textContent = meta.title;
      titleBadge.textContent = meta.titleLength + ' chars';
      titleBadge.className = 'length-badge ' + (meta.titleOptimal ? 'badge-good' : 'badge-warn');
    } else {
      titleContent.textContent = 'Nao encontrada';
      titleContent.className = 'meta-value muted';
      titleBadge.textContent = 'ausente';
      titleBadge.className = 'length-badge badge-bad';
    }

    // Description
    const descContent = document.getElementById('descContent');
    const descBadge = document.getElementById('descBadge');
    if (meta.description) {
      descContent.textContent = meta.description;
      descBadge.textContent = meta.descriptionLength + ' chars';
      descBadge.className = 'length-badge ' + (meta.descriptionOptimal ? 'badge-good' : 'badge-warn');
    } else {
      descContent.textContent = 'Nao encontrada';
      descBadge.textContent = 'ausente';
      descBadge.className = 'length-badge badge-bad';
    }

    // Canonical
    if (meta.canonical) {
      document.getElementById('canonicalBlock').style.display = 'block';
      document.getElementById('canonicalContent').textContent = meta.canonical;
    }
  }

  // ─── VERIFICACOES ─────────────────────────────────────────

  renderChecks() {
    const d = this.currentAnalysis;
    const meta = d.meta || {};
    const tech = d.technical || {};
    const images = d.images || {};
    const h1Count = (d.headings && d.headings.distribution && d.headings.distribution.h1) || 0;

    // Title
    if (!meta.title) {
      this.setCheck('title', 'bad', 'Tag title ausente');
    } else if (meta.titleOptimal) {
      this.setCheck('title', 'good', meta.titleLength + ' chars — dentro do ideal (30-60)');
    } else {
      this.setCheck('title', 'warn', meta.titleLength + ' chars — ideal entre 30 e 60 caracteres');
    }

    // Description
    if (!meta.description) {
      this.setCheck('desc', 'bad', 'Meta description ausente');
    } else if (meta.descriptionOptimal) {
      this.setCheck('desc', 'good', meta.descriptionLength + ' chars — dentro do ideal (120-160)');
    } else {
      this.setCheck('desc', 'warn', meta.descriptionLength + ' chars — ideal entre 120 e 160 caracteres');
    }

    // H1
    if (h1Count === 0) {
      this.setCheck('h1', 'bad', 'Nenhuma tag H1 encontrada');
    } else if (h1Count === 1) {
      const h1Text = (d.headings && d.headings.h1 && d.headings.h1[0] && d.headings.h1[0].text) || '';
      this.setCheck('h1', 'good', '1 H1 — "' + h1Text.substring(0, 50) + (h1Text.length > 50 ? '...' : '') + '"');
    } else {
      this.setCheck('h1', 'warn', h1Count + ' tags H1 encontradas — o ideal e apenas 1');
    }

    // HTTPS
    this.setCheck('https', tech.isHTTPS ? 'good' : 'bad',
      tech.isHTTPS ? 'Conexao segura (HTTPS)' : 'Pagina sem HTTPS — fator de ranqueamento');

    // Mobile
    this.setCheck('mobile', tech.mobile ? 'good' : 'bad',
      tech.mobile ? 'Viewport configurado corretamente' : 'Meta viewport ausente — nao otimizado para mobile');

    // Images
    const missingAlt = images.missingAlt || 0;
    const total = images.total || 0;
    if (total === 0) {
      this.setCheck('images', 'good', 'Nenhuma imagem na pagina');
    } else if (missingAlt === 0) {
      this.setCheck('images', 'good', total + ' imagens — todas com alt text');
    } else {
      this.setCheck('images', missingAlt > total * 0.5 ? 'bad' : 'warn',
        missingAlt + ' de ' + total + ' imagens sem alt text');
    }

    // Word count
    const wc = (d.keywords && d.keywords.wordCount) || 0;
    const rt = (d.keywords && d.keywords.readingTime) || 0;
    this.setCheck('content', wc >= 300 ? 'good' : 'warn',
      wc + ' palavras — ' + rt + ' min de leitura' + (wc < 300 ? ' (recomendado: 300+)' : ''));

    // Canonical
    this.setCheck('canonical', tech.hasCanonical ? 'good' : 'warn',
      tech.hasCanonical ? 'Tag canonical presente' : 'Tag canonical ausente — recomendada para evitar conteudo duplicado');

    // Lang
    const lang = tech.lang || '';
    this.setCheck('lang', lang ? 'good' : 'warn',
      lang ? 'lang="' + lang + '"' : 'Atributo lang ausente no <html>');
  }

  setCheck(id, status, message) {
    const item = document.getElementById('check-' + id);
    if (!item) return;
    const icon = item.querySelector('.check-icon');
    const msg = item.querySelector('small');

    const map = { good: { symbol: '✓', cls: 'icon-good' }, warn: { symbol: '!', cls: 'icon-warn' }, bad: { symbol: '✕', cls: 'icon-bad' } };
    const s = map[status] || map.warn;
    icon.textContent = s.symbol;
    icon.className = 'check-icon ' + s.cls;
    item.className = 'check-item border-' + status;
    msg.textContent = message;
  }

  // ─── PALAVRAS-CHAVE ───────────────────────────────────────

  renderKeywords() {
    const kw = (this.currentAnalysis.keywords && this.currentAnalysis.keywords.topKeywords) || [];
    const container = document.getElementById('keywordsTable');

    if (kw.length === 0) {
      container.innerHTML = '<p class="muted-text">Nenhuma palavra-chave identificada.</p>';
    } else {
      const max = kw[0].count;
      container.innerHTML = kw.map((item, i) =>
        '<div class="kw-row">' +
          '<span class="kw-rank">' + (i + 1) + '</span>' +
          '<span class="kw-word">' + item.word + '</span>' +
          '<div class="kw-bar-wrap"><div class="kw-bar" style="width:' + Math.round(item.count / max * 100) + '%"></div></div>' +
          '<span class="kw-count">' + item.count + 'x</span>' +
        '</div>'
      ).join('');
    }

    const d = this.currentAnalysis.keywords || {};
    document.getElementById('wordCountStat').textContent = (d.wordCount || 0) + ' palavras';
    document.getElementById('readingTimeStat').textContent = (d.readingTime || 0) + ' min leitura';
    document.getElementById('paragraphsStat').textContent = (d.paragraphs || 0) + ' paragrafos';
  }

  // ─── PLANO DE ACAO ────────────────────────────────────────

  renderActionPlan() {
    const actions = this.generateActionPlan();
    const container = document.getElementById('actionPlan');
    const allGood = document.getElementById('allGood');

    if (actions.length === 0) {
      container.style.display = 'none';
      allGood.style.display = 'block';
      return;
    }

    container.style.display = 'block';
    allGood.style.display = 'none';

    const priorityOrder = { critico: 0, importante: 1, recomendado: 2 };
    actions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    container.innerHTML = actions.map((action, i) =>
      '<div class="action-item action-' + action.priority + '">' +
        '<div class="action-header">' +
          '<span class="action-num">' + (i + 1) + '</span>' +
          '<span class="action-badge badge-' + action.priority + '">' + action.priority.toUpperCase() + '</span>' +
          '<span class="action-impact">Impacto: ' + action.impact + '</span>' +
        '</div>' +
        '<p class="action-text">' + action.text + '</p>' +
      '</div>'
    ).join('');
  }

  generateActionPlan() {
    const d = this.currentAnalysis;
    const meta = d.meta || {};
    const tech = d.technical || {};
    const images = d.images || {};
    const kw = d.keywords || {};
    const h1Count = (d.headings && d.headings.distribution && d.headings.distribution.h1) || 0;
    const actions = [];

    // HTTPS
    if (!tech.isHTTPS) {
      actions.push({ priority: 'critico', impact: 'Alto', text: 'Migrar para HTTPS. SSL e fator de ranqueamento confirmado pelo Google e aumenta a confianca do usuario.' });
    }

    // Title
    if (!meta.title) {
      actions.push({ priority: 'critico', impact: 'Alto', text: 'Adicionar tag <title> unica com 30-60 caracteres. Inclua a palavra-chave principal logo no inicio.' });
    } else if (meta.titleLength < 30) {
      actions.push({ priority: 'importante', impact: 'Alto', text: 'Expandir o title (atual: ' + meta.titleLength + ' chars). Ideal entre 30-60 caracteres. Inclua a palavra-chave principal.' });
    } else if (meta.titleLength > 60) {
      actions.push({ priority: 'importante', impact: 'Medio', text: 'Reduzir o title (atual: ' + meta.titleLength + ' chars). Acima de 60 caracteres e truncado pelo Google nos resultados.' });
    }

    // Meta description
    if (!meta.description) {
      actions.push({ priority: 'critico', impact: 'Alto', text: 'Adicionar meta description com 120-160 caracteres. Inclua a palavra-chave principal e um call-to-action para aumentar o CTR.' });
    } else if (meta.descriptionLength < 120) {
      actions.push({ priority: 'importante', impact: 'Alto', text: 'Expandir a meta description (atual: ' + meta.descriptionLength + ' chars). Ideal entre 120-160 caracteres com call-to-action.' });
    } else if (meta.descriptionLength > 160) {
      actions.push({ priority: 'importante', impact: 'Medio', text: 'Reduzir a meta description (atual: ' + meta.descriptionLength + ' chars). Acima de 160 chars o Google trunca o texto nos resultados.' });
    }

    // H1
    if (h1Count === 0) {
      actions.push({ priority: 'critico', impact: 'Alto', text: 'Adicionar uma unica tag H1 com a palavra-chave principal. O H1 e o titulo mais importante para o Google.' });
    } else if (h1Count > 1) {
      actions.push({ priority: 'importante', impact: 'Medio', text: 'Manter apenas 1 tag H1 por pagina (atual: ' + h1Count + '). Use H2 e H3 para subtitulos hierarquicos.' });
    }

    // Mobile
    if (!tech.mobile) {
      actions.push({ priority: 'critico', impact: 'Alto', text: "Adicionar meta viewport: <meta name='viewport' content='width=device-width, initial-scale=1'>. Google usa indexacao mobile-first." });
    }

    // Images alt
    const missingAlt = images.missingAlt || 0;
    const totalImgs = images.total || 0;
    if (missingAlt > 0) {
      actions.push({
        priority: missingAlt > totalImgs * 0.5 ? 'importante' : 'recomendado',
        impact: 'Medio',
        text: 'Adicionar atributo alt descritivo em ' + missingAlt + ' imagem(ns). O alt text ajuda o Google a entender o conteudo visual e melhora a acessibilidade.'
      });
    }

    // Word count
    if ((kw.wordCount || 0) < 300) {
      actions.push({ priority: 'recomendado', impact: 'Medio', text: 'Aumentar o volume de conteudo (atual: ' + (kw.wordCount || 0) + ' palavras). Paginas com 300+ palavras tendem a ranquear melhor.' });
    }

    // Canonical
    if (!tech.hasCanonical) {
      actions.push({ priority: 'recomendado', impact: 'Medio', text: "Adicionar tag canonical: <link rel='canonical' href='URL_DA_PAGINA'>. Evita penalizacao por conteudo duplicado." });
    }

    // Lang
    if (!tech.lang) {
      actions.push({ priority: 'recomendado', impact: 'Baixo', text: "Adicionar atributo lang na tag <html>, por exemplo lang='pt-BR'. Ajuda mecanismos de busca a identificar o idioma." });
    }

    return actions;
  }

  // ─── EXPORT ──────────────────────────────────────────────

  exportJSON() {
    if (!this.currentAnalysis) return;
    const score = this.calculateScore();
    const actions = this.generateActionPlan();
    const exportData = { ...this.currentAnalysis, score, actionPlan: actions, exportedAt: new Date().toISOString() };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'seo-analysis-' + Date.now() + '.json';
    link.click();
    URL.revokeObjectURL(url);
  }

  showError(message) {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('error').style.display = 'flex';
    document.getElementById('errorMsg').textContent = message;
  }
}

document.addEventListener('DOMContentLoaded', () => new PopupManager());
