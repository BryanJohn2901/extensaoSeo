class PopupManager {
  constructor() {
    this.data = null;
    this.init();
  }

  init() {
    document.getElementById('reloadBtn').addEventListener('click', () => this.requestAnalysis());
    document.getElementById('exportBtn').addEventListener('click', () => this.exportJSON());
    document.getElementById('retryBtn').addEventListener('click', () => this.requestAnalysis());
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
    });
    this.requestAnalysis();
  }

  switchTab(id) {
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === id));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.toggle('active', p.id === 'tab-' + id));
  }

  async requestAnalysis() {
    document.getElementById('loading').style.display = 'flex';
    document.getElementById('main').style.display = 'none';
    document.getElementById('error').style.display = 'none';

    const tabs = await new Promise(r => chrome.tabs.query({ active: true, currentWindow: true }, r));
    if (!tabs[0]) return this.showError('Aba nao encontrada.');
    const tabId = tabs[0].id;

    // DOM analysis (meta, headings, links, keywords, etc.)
    const domData = await new Promise(resolve => {
      chrome.tabs.sendMessage(tabId, { type: 'REQUEST_ANALYSIS' }, response => {
        if (chrome.runtime.lastError) resolve(null);
        else resolve(response && response.data || null);
      });
    });

    if (!domData) {
      const stored = await new Promise(r => chrome.storage.local.get('lastAnalysis', r));
      if (stored.lastAnalysis) {
        await this.enrichTagsViaScripting(stored.lastAnalysis, tabId);
        return this.render(stored.lastAnalysis);
      }
      return this.showError('Recarregue a pagina (F5) e tente novamente.');
    }

    // JS-globals analysis — runs in the page's own JS context
    await this.enrichTagsViaScripting(domData, tabId);
    this.render(domData);
  }

  async enrichTagsViaScripting(data, tabId) {
    try {
      const results = await new Promise(resolve => {
        chrome.scripting.executeScript(
          { target: { tabId }, world: 'MAIN', func: detectTagsInPageContext },
          res => {
            if (chrome.runtime.lastError) resolve([]);
            else resolve(res);
          }
        );
      });
      const jsTags = results && results[0] && results[0].result || [];
      data.tags = this.mergeTags(data.tags || [], jsTags);
    } catch (e) {
      // scripting API not available on this page (chrome://, etc.)
    }
  }

  mergeTags(domTags, jsTags) {
    const merged = [];
    const seen = new Set();
    // JS globals take priority — they're post-load, reflect reality
    jsTags.forEach(t => { if (!seen.has(t.name)) { seen.add(t.name); merged.push({ ...t }); } });
    // DOM fallback for tags not yet initialized as globals
    domTags.forEach(t => {
      if (!seen.has(t.name)) { seen.add(t.name); merged.push({ ...t }); }
      else if (t.id) {
        const ex = merged.find(m => m.name === t.name);
        if (ex && !ex.id) ex.id = t.id;
      }
    });
    return merged;
  }

  render(data) {
    this.data = data;
    try { document.getElementById('urlDisplay').textContent = new URL(data.url).hostname; } catch (e) {}

    this.renderSEO();
    this.renderTags();
    this.renderLinks();
    this.renderContent();
    this.renderPlan();
    this.updateBadges();

    document.getElementById('loading').style.display = 'none';
    document.getElementById('main').style.display = 'flex';
  }

  // ─── SEO TAB ─────────────────────────────────────────────────

  renderSEO() {
    const score = this.calcScore();

    // Score card
    const el = document.getElementById('scoreValue');
    el.textContent = score.toFixed(1);
    el.className = 'score-number ' + this.scoreClass(score);
    document.getElementById('scoreFill').style.width = (score / 10 * 100) + '%';
    document.getElementById('scoreFill').className = 'score-fill ' + this.scoreClass(score);
    document.getElementById('scoreMsg').textContent = this.scoreLabel(score);

    // Meta tags
    const meta = this.data.meta || {};

    this.setMetaField('titleContent', 'titleBadge', meta.title, meta.titleLength, meta.titleOptimal, '(ausente)', '30-60 chars');
    this.setMetaField('descContent', 'descBadge', meta.description, meta.descriptionLength, meta.descriptionOptimal, '(ausente)', '120-160 chars');

    const h1List = (this.data.headings && this.data.headings.h1) || [];
    if (h1List.length > 0) {
      document.getElementById('h1Block').style.display = 'block';
      document.getElementById('h1Content').textContent = h1List.map(h => h.text).join(' / ');
    }

    if (meta.canonical) {
      document.getElementById('canonicalBlock').style.display = 'block';
      document.getElementById('canonicalContent').textContent = meta.canonical;
    }

    // Checks
    this.renderChecks();
  }

  setMetaField(contentId, badgeId, text, length, optimal, emptyLabel, rangeLabel) {
    const contentEl = document.getElementById(contentId);
    const badgeEl   = document.getElementById(badgeId);
    if (text) {
      contentEl.textContent = text;
      contentEl.classList.remove('absent');
      badgeEl.textContent   = length + ' chars';
      badgeEl.className     = 'len-badge ' + (optimal ? 'badge-ok' : 'badge-warn');
    } else {
      contentEl.textContent = emptyLabel;
      contentEl.classList.add('absent');
      badgeEl.textContent   = 'ausente';
      badgeEl.className     = 'len-badge badge-bad';
    }
  }

  renderChecks() {
    const d    = this.data;
    const meta = d.meta || {};
    const tech = d.technical || {};
    const img  = d.images || {};
    const h1   = (d.headings && d.headings.distribution && d.headings.distribution.h1) || 0;
    const wc   = (d.keywords && d.keywords.wordCount) || 0;

    const checks = [
      {
        label: 'Title Tag',
        status: !meta.title ? 'bad' : meta.titleOptimal ? 'good' : 'warn',
        msg: !meta.title ? 'Ausente' : meta.titleLength + ' chars — ideal: 30-60'
      },
      {
        label: 'Meta Description',
        status: !meta.description ? 'bad' : meta.descriptionOptimal ? 'good' : 'warn',
        msg: !meta.description ? 'Ausente' : meta.descriptionLength + ' chars — ideal: 120-160'
      },
      {
        label: 'H1 Heading',
        status: h1 === 0 ? 'bad' : h1 === 1 ? 'good' : 'warn',
        msg: h1 === 0 ? 'Nenhuma H1 encontrada' : h1 === 1 ? '1 H1 (ideal)' : h1 + ' H1s — ideal: somente 1'
      },
      {
        label: 'HTTPS / SSL',
        status: tech.isHTTPS ? 'good' : 'bad',
        msg: tech.isHTTPS ? 'Conexao segura' : 'Pagina sem HTTPS'
      },
      {
        label: 'Mobile Friendly',
        status: tech.mobile ? 'good' : 'bad',
        msg: tech.mobile ? 'Meta viewport configurado' : 'Meta viewport ausente'
      },
      {
        label: 'Alt Text em Imagens',
        status: img.total === 0 ? 'good' : img.missingAlt === 0 ? 'good' : img.missingAlt > img.total * 0.5 ? 'bad' : 'warn',
        msg: img.total === 0 ? 'Sem imagens' : img.missingAlt === 0
          ? img.total + ' imagens — todas com alt'
          : img.missingAlt + ' de ' + img.total + ' sem alt text'
      },
      {
        label: 'Volume de Conteudo',
        status: wc >= 300 ? 'good' : wc >= 100 ? 'warn' : 'bad',
        msg: wc + ' palavras — ' + (d.keywords && d.keywords.readingTime || 0) + ' min leitura' + (wc < 300 ? ' (recomendado: 300+)' : '')
      },
      {
        label: 'Tag Canonical',
        status: tech.hasCanonical ? 'good' : 'warn',
        msg: tech.hasCanonical ? 'Presente' : 'Ausente — recomendada para evitar conteudo duplicado'
      },
      {
        label: 'Atributo Lang',
        status: tech.lang ? 'good' : 'warn',
        msg: tech.lang ? 'lang="' + tech.lang + '"' : 'Ausente na tag <html>'
      }
    ];

    const icons = { good: '✓', warn: '!', bad: '✕' };
    document.getElementById('checksContainer').innerHTML = checks.map(c =>
      '<div class="check-item border-' + c.status + '">' +
        '<span class="check-icon icon-' + c.status + '">' + icons[c.status] + '</span>' +
        '<div class="check-body"><strong>' + c.label + '</strong><small>' + c.msg + '</small></div>' +
      '</div>'
    ).join('');
  }

  calcScore() {
    const d = this.data;
    const meta = d.meta || {};
    const tech = d.technical || {};
    const img  = d.images || {};
    let s = 3;
    if (meta.titleOptimal) s++;
    if (meta.descriptionOptimal) s++;
    if ((d.headings && d.headings.distribution && d.headings.distribution.h1) === 1) s++;
    if (tech.isHTTPS) s++;
    if (tech.mobile) s++;
    if (img.total === 0 || (img.withAlt / img.total) >= 0.8) s++;
    if ((d.keywords && d.keywords.wordCount) >= 300) s++;
    return Math.min(s, 10);
  }

  scoreClass(s) { return s >= 8 ? 'green' : s >= 5 ? 'amber' : 'red'; }

  scoreLabel(s) {
    if (s >= 8) return 'Excelente — SEO bem otimizado';
    if (s >= 6) return 'Bom — ha melhorias possiveis';
    if (s >= 4) return 'Regular — varios pontos para otimizar';
    return 'Critico — muitos problemas identificados';
  }

  // ─── TAGS TAB ────────────────────────────────────────────────

  renderTags() {
    const tags     = this.data.tags || [];
    const webhooks = this.data.webhooks || [];

    // Group tags by category
    const grouped = {};
    tags.forEach(t => {
      if (!grouped[t.category]) grouped[t.category] = [];
      grouped[t.category].push(t);
    });

    const CATEGORY_COLOR = {
      'Tag Manager': '#5a67d8',
      'Analytics':   '#0891b2',
      'Ads':         '#7c3aed',
      'Heatmap':     '#d97706',
      'Chat':        '#059669',
      'CRM':         '#db2777',
      'Email':       '#dc2626'
    };

    if (tags.length === 0) {
      document.getElementById('tagsList').innerHTML = '<p class="empty-msg">Nenhuma tag detectada nesta pagina.</p>';
    } else {
      document.getElementById('tagsList').innerHTML = Object.entries(grouped).map(([cat, items]) =>
        '<div class="tag-group">' +
          '<p class="tag-group-label" style="color:' + (CATEGORY_COLOR[cat] || '#555') + '">' + cat + '</p>' +
          items.map(t =>
            '<div class="tag-item">' +
              '<span class="tag-dot" style="background:' + (CATEGORY_COLOR[cat] || '#555') + '"></span>' +
              '<div class="tag-info">' +
                '<span class="tag-name">' + t.name + '</span>' +
                (t.id ? '<span class="tag-id">' + t.id + '</span>' : '') +
              '</div>' +
              '<span class="tag-status">ativo</span>' +
            '</div>'
          ).join('') +
        '</div>'
      ).join('');
    }

    if (webhooks.length === 0) {
      document.getElementById('webhooksList').innerHTML = '<p class="empty-msg">Nenhum webhook detectado.</p>';
    } else {
      document.getElementById('webhooksList').innerHTML = webhooks.map(w =>
        '<div class="webhook-item">' +
          '<div class="webhook-name">' + w.name + '</div>' +
          '<div class="webhook-url">' + w.url + '</div>' +
        '</div>'
      ).join('');
    }
  }

  // ─── LINKS TAB ───────────────────────────────────────────────

  renderLinks() {
    const links = this.data.links || {};

    document.getElementById('statInternal').textContent  = links.internal || 0;
    document.getElementById('statExternal').textContent  = links.external || 0;
    document.getElementById('statRedirects').textContent = (links.redirects || []).length;
    document.getElementById('statNofollow').textContent  = links.nofollow || 0;

    // Redirects
    const redirects = links.redirects || [];
    if (redirects.length === 0) {
      document.getElementById('redirectsList').innerHTML = '<p class="empty-msg">Nenhum link de redirecionamento encontrado.</p>';
    } else {
      document.getElementById('redirectsList').innerHTML = redirects.map(r =>
        '<div class="link-item">' +
          '<span class="link-service">' + r.service + '</span>' +
          '<div class="link-detail">' +
            '<span class="link-text">' + r.text + '</span>' +
            '<span class="link-href">' + r.href + '</span>' +
          '</div>' +
        '</div>'
      ).join('');
    }

    // External domains
    const domains = links.topExternalDomains || [];
    if (domains.length === 0) {
      document.getElementById('externalDomainsList').innerHTML = '<p class="empty-msg">Nenhum dominio externo encontrado.</p>';
    } else {
      const max = domains[0].count;
      document.getElementById('externalDomainsList').innerHTML = domains.map(d =>
        '<div class="domain-row">' +
          '<span class="domain-name">' + d.domain + '</span>' +
          '<div class="domain-bar-wrap"><div class="domain-bar" style="width:' + Math.round(d.count / max * 100) + '%"></div></div>' +
          '<span class="domain-count">' + d.count + '</span>' +
        '</div>'
      ).join('');
    }

    // Forms
    const forms = links.forms || [];
    if (forms.length === 0) {
      document.getElementById('formsList').innerHTML = '<p class="empty-msg">Nenhum formulario encontrado.</p>';
    } else {
      document.getElementById('formsList').innerHTML = forms.map(f =>
        '<div class="form-item">' +
          '<span class="form-method ' + (f.method === 'POST' ? 'method-post' : 'method-get') + '">' + f.method + '</span>' +
          '<div class="form-detail">' +
            '<span class="form-action">' + f.action + '</span>' +
            '<span class="form-inputs">' + f.inputs + ' campo(s)</span>' +
          '</div>' +
        '</div>'
      ).join('');
    }
  }

  // ─── CONTENT TAB ─────────────────────────────────────────────

  renderContent() {
    const kw = this.data.keywords || {};
    document.getElementById('statWords').textContent      = kw.wordCount || 0;
    document.getElementById('statReading').textContent    = kw.readingTime || 0;
    document.getElementById('statParagraphs').textContent = kw.paragraphs || 0;

    const keywords = kw.topKeywords || [];
    if (keywords.length === 0) {
      document.getElementById('keywordsTable').innerHTML = '<p class="empty-msg">Nenhuma palavra-chave identificada.</p>';
      return;
    }
    const max = keywords[0].count;
    document.getElementById('keywordsTable').innerHTML = keywords.map((item, i) =>
      '<div class="kw-row">' +
        '<span class="kw-rank">' + (i + 1) + '</span>' +
        '<span class="kw-word">' + item.word + '</span>' +
        '<div class="kw-bar-wrap"><div class="kw-bar" style="width:' + Math.round(item.count / max * 100) + '%"></div></div>' +
        '<span class="kw-count">' + item.count + 'x</span>' +
      '</div>'
    ).join('');
  }

  // ─── PLAN TAB ────────────────────────────────────────────────

  renderPlan() {
    const actions = this.buildActionPlan();
    if (actions.length === 0) {
      document.getElementById('actionPlan').innerHTML = '';
      document.getElementById('allGood').style.display = 'block';
      return;
    }
    document.getElementById('allGood').style.display = 'none';
    const order = { critico: 0, importante: 1, recomendado: 2 };
    actions.sort((a, b) => order[a.p] - order[b.p]);
    document.getElementById('actionPlan').innerHTML = actions.map((a, i) =>
      '<div class="action-item action-' + a.p + '">' +
        '<div class="action-head">' +
          '<span class="action-num">' + (i + 1) + '</span>' +
          '<span class="action-badge badge-' + a.p + '">' + a.p.toUpperCase() + '</span>' +
          '<span class="action-impact">Impacto: ' + a.impact + '</span>' +
        '</div>' +
        '<p class="action-text">' + a.text + '</p>' +
      '</div>'
    ).join('');
  }

  buildActionPlan() {
    const d = this.data;
    const meta = d.meta || {};
    const tech = d.technical || {};
    const img  = d.images || {};
    const kw   = d.keywords || {};
    const h1   = (d.headings && d.headings.distribution && d.headings.distribution.h1) || 0;
    const acts = [];

    if (!tech.isHTTPS)
      acts.push({ p: 'critico', impact: 'Alto', text: 'Migrar para HTTPS. SSL e fator de ranqueamento confirmado pelo Google e aumenta a confianca do usuario.' });

    if (!meta.title)
      acts.push({ p: 'critico', impact: 'Alto', text: 'Adicionar tag <title> com 30-60 caracteres incluindo a palavra-chave principal logo no inicio.' });
    else if (meta.titleLength < 30)
      acts.push({ p: 'importante', impact: 'Alto', text: 'Expandir o title (atual: ' + meta.titleLength + ' chars). Ideal entre 30-60 caracteres com palavra-chave principal.' });
    else if (meta.titleLength > 60)
      acts.push({ p: 'importante', impact: 'Medio', text: 'Reduzir o title (atual: ' + meta.titleLength + ' chars). Acima de 60 chars o Google trunca nos resultados de busca.' });

    if (!meta.description)
      acts.push({ p: 'critico', impact: 'Alto', text: 'Adicionar meta description com 120-160 caracteres. Inclua a palavra-chave e um call-to-action para aumentar o CTR.' });
    else if (meta.descriptionLength < 120)
      acts.push({ p: 'importante', impact: 'Alto', text: 'Expandir a meta description (atual: ' + meta.descriptionLength + ' chars). Ideal entre 120-160 caracteres com call-to-action.' });
    else if (meta.descriptionLength > 160)
      acts.push({ p: 'importante', impact: 'Medio', text: 'Reduzir a meta description (atual: ' + meta.descriptionLength + ' chars). Acima de 160 chars o Google trunca o texto.' });

    if (h1 === 0)
      acts.push({ p: 'critico', impact: 'Alto', text: 'Adicionar uma tag H1 unica com a palavra-chave principal. H1 e o titulo de maior peso para o Google.' });
    else if (h1 > 1)
      acts.push({ p: 'importante', impact: 'Medio', text: 'Manter apenas 1 H1 por pagina (atual: ' + h1 + '). Use H2 e H3 para subtitulos hierarquicos.' });

    if (!tech.mobile)
      acts.push({ p: 'critico', impact: 'Alto', text: "Adicionar <meta name='viewport' content='width=device-width, initial-scale=1'>. Google usa indexacao mobile-first." });

    const missing = img.missingAlt || 0;
    const total   = img.total || 0;
    if (missing > 0)
      acts.push({ p: missing > total * 0.5 ? 'importante' : 'recomendado', impact: 'Medio', text: 'Adicionar atributo alt em ' + missing + ' imagem(ns). Alt text melhora acessibilidade e indexacao de imagens.' });

    if ((kw.wordCount || 0) < 300)
      acts.push({ p: 'recomendado', impact: 'Medio', text: 'Aumentar o conteudo da pagina (atual: ' + (kw.wordCount || 0) + ' palavras). Paginas com 300+ palavras tendem a ranquear melhor.' });

    if (!tech.hasCanonical)
      acts.push({ p: 'recomendado', impact: 'Medio', text: "Adicionar <link rel='canonical' href='URL'> para evitar penalizacao por conteudo duplicado." });

    if (!tech.lang)
      acts.push({ p: 'recomendado', impact: 'Baixo', text: "Adicionar atributo lang na tag <html> (ex: lang='pt-BR'). Ajuda buscadores a identificar o idioma da pagina." });

    return acts;
  }

  // ─── BADGES ──────────────────────────────────────────────────

  updateBadges() {
    const checks = this.data && document.querySelectorAll('.check-item.border-bad, .check-item.border-warn');
    const issues  = checks ? Array.from(checks).filter(c => c.classList.contains('border-bad')).length : 0;
    const actions = document.getElementById('actionPlan').children.length;
    const tagsCount = (this.data.tags || []).length;
    const redirectsCount = ((this.data.links || {}).redirects || []).length;

    this.setBadge('badge-seo',   issues,        'red');
    this.setBadge('badge-tags',  tagsCount,     'blue');
    this.setBadge('badge-links', redirectsCount,'orange');
    this.setBadge('badge-plan',  actions,       'red');
  }

  setBadge(id, count, color) {
    const el = document.getElementById(id);
    if (!el) return;
    if (count > 0) {
      el.textContent = count;
      el.className = 'tab-badge badge-' + color;
    } else {
      el.textContent = '';
      el.className = 'tab-badge';
    }
  }

  // ─── EXPORT ──────────────────────────────────────────────────

  exportJSON() {
    if (!this.data) return;
    const out = { ...this.data, score: this.calcScore(), actionPlan: this.buildActionPlan(), exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'seo-analysis-' + Date.now() + '.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  showError(msg) {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('error').style.display   = 'flex';
    document.getElementById('errorMsg').textContent  = msg;
  }
}

document.addEventListener('DOMContentLoaded', () => new PopupManager());

// ─── MAIN-WORLD TAG DETECTOR ──────────────────────────────────────────────────
// Esta funcao e serializada e injetada no contexto JS real da pagina
// (world: "MAIN"), permitindo acesso a window.gtag, window.fbq, etc.
function detectTagsInPageContext() {
  const tags = [];
  const add = (name, category, id) => tags.push({ name, category, id: id || '' });

  try {
    // ── Google Tag Manager ──────────────────────────────────────
    if (window.google_tag_manager) {
      const ids = Object.keys(window.google_tag_manager).filter(k => /^GTM-/.test(k));
      ids.length ? ids.forEach(id => add('Google Tag Manager', 'Tag Manager', id))
                 : add('Google Tag Manager', 'Tag Manager', '');
    } else if (Array.isArray(window.dataLayer)) {
      add('Google Tag Manager', 'Tag Manager', '');
    }

    // ── Google Analytics 4 ──────────────────────────────────────
    if (typeof window.gtag === 'function') {
      let id = '';
      if (Array.isArray(window.dataLayer)) {
        for (const item of window.dataLayer) {
          if (Array.isArray(item) && item[0] === 'config' && typeof item[1] === 'string' && item[1].startsWith('G-')) {
            id = item[1]; break;
          }
        }
      }
      add('Google Analytics 4', 'Analytics', id);
    }

    // ── Google Analytics Universal ───────────────────────────────
    if (typeof window.ga === 'function' || typeof window.GoogleAnalyticsObject !== 'undefined') {
      let id = '';
      try {
        const obj = window.GoogleAnalyticsObject ? window[window.GoogleAnalyticsObject] : window.ga;
        if (obj && obj.getAll) id = (obj.getAll()[0] || {get: () => ''}).get('trackingId') || '';
      } catch (e) {}
      add('Google Analytics Universal', 'Analytics', id);
    }

    // ── Google Ads ───────────────────────────────────────────────
    if (typeof window.gtag === 'function' && Array.isArray(window.dataLayer)) {
      for (const item of window.dataLayer) {
        if (Array.isArray(item) && item[0] === 'config' && typeof item[1] === 'string' && item[1].startsWith('AW-')) {
          add('Google Ads', 'Ads', item[1]); break;
        }
      }
    }

    // ── Facebook Pixel ───────────────────────────────────────────
    if (typeof window.fbq === 'function') {
      let id = '';
      try {
        if (window.fbq.getState) {
          const pixels = window.fbq.getState().pixels;
          if (pixels && pixels.length) id = String(pixels[0].id || '');
        }
      } catch (e) {}
      add('Facebook Pixel', 'Ads', id);
    }

    // ── HotJar ───────────────────────────────────────────────────
    if (typeof window.hj === 'function' || window.hjSiteSettings) {
      const id = window.hjSiteSettings && window.hjSiteSettings.site_id
        ? String(window.hjSiteSettings.site_id) : '';
      add('HotJar', 'Heatmap', id);
    }

    // ── Microsoft Clarity ────────────────────────────────────────
    if (typeof window.clarity === 'function') add('Microsoft Clarity', 'Heatmap', '');

    // ── LinkedIn Insight ─────────────────────────────────────────
    if (Array.isArray(window._linkedin_data_partner_ids) && window._linkedin_data_partner_ids.length) {
      add('LinkedIn Insight', 'Ads', String(window._linkedin_data_partner_ids[0]));
    } else if (typeof window._linkedin_partner_id !== 'undefined') {
      add('LinkedIn Insight', 'Ads', String(window._linkedin_partner_id));
    }

    // ── TikTok Pixel ─────────────────────────────────────────────
    if (typeof window.ttq !== 'undefined') add('TikTok Pixel', 'Ads', '');

    // ── Twitter / X Pixel ────────────────────────────────────────
    if (typeof window.twq === 'function') add('Twitter / X Pixel', 'Ads', '');

    // ── Pinterest ────────────────────────────────────────────────
    if (typeof window.pintrk === 'function') add('Pinterest Tag', 'Ads', '');

    // ── Snapchat ─────────────────────────────────────────────────
    if (typeof window.snaptr === 'function') add('Snapchat Pixel', 'Ads', '');

    // ── HubSpot ──────────────────────────────────────────────────
    if (window._hsq || window.HubSpotConversations || window.hsConversationsSettings)
      add('HubSpot', 'CRM', '');

    // ── Intercom ─────────────────────────────────────────────────
    if (typeof window.Intercom === 'function') {
      const id = window.intercomSettings && window.intercomSettings.app_id
        ? window.intercomSettings.app_id : '';
      add('Intercom', 'Chat', id);
    }

    // ── Crisp ────────────────────────────────────────────────────
    if (window.$crisp)
      add('Crisp Chat', 'Chat', window.CRISP_WEBSITE_ID || '');

    // ── Drift ────────────────────────────────────────────────────
    if (window.drift || window.driftt) add('Drift', 'Chat', '');

    // ── Zendesk ──────────────────────────────────────────────────
    if (window.zE || window.zEmbed) add('Zendesk', 'Chat', '');

    // ── Segment ──────────────────────────────────────────────────
    if (window.analytics && typeof window.analytics.track === 'function')
      add('Segment', 'Analytics', '');

    // ── Mixpanel ─────────────────────────────────────────────────
    if (window.mixpanel && typeof window.mixpanel.track === 'function')
      add('Mixpanel', 'Analytics', '');

    // ── Amplitude ────────────────────────────────────────────────
    if (window.amplitude && window.amplitude.getInstance)
      add('Amplitude', 'Analytics', '');

    // ── Klaviyo ──────────────────────────────────────────────────
    if (window._learnq) add('Klaviyo', 'Email', '');

    // ── ActiveCampaign ───────────────────────────────────────────
    if (window.vgo || window.ac_cvs) add('ActiveCampaign', 'Email', '');

    // ── RD Station ───────────────────────────────────────────────
    if (window.RdIntegration || window.RD || window.rdstation)
      add('RD Station', 'CRM', '');

  } catch (e) {}

  return tags;
}
