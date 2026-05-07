const SEOAnalyzer = {

  // ── META & SOCIAL ─────────────────────────────────────────────
  analyzeMeta() {
    const get  = sel => document.querySelector(sel);
    const attr = (sel, a) => (get(sel) || {}).getAttribute && get(sel).getAttribute(a) || '';

    const title = document.title || '';
    const desc  = attr('meta[name="description"]', 'content');

    const og = {
      title:       attr('meta[property="og:title"]',       'content'),
      description: attr('meta[property="og:description"]', 'content'),
      image:       attr('meta[property="og:image"]',       'content'),
      url:         attr('meta[property="og:url"]',         'content'),
      type:        attr('meta[property="og:type"]',        'content'),
      siteName:    attr('meta[property="og:site_name"]',   'content'),
    };
    og.score = [og.title, og.description, og.image, og.url].filter(Boolean).length;

    const tw = {
      card:        attr('meta[name="twitter:card"]',        'content'),
      title:       attr('meta[name="twitter:title"]',       'content'),
      description: attr('meta[name="twitter:description"]', 'content'),
      image:       attr('meta[name="twitter:image"]',       'content'),
      site:        attr('meta[name="twitter:site"]',        'content'),
    };
    tw.present = !!(tw.card || tw.title);

    const robots    = attr('meta[name="robots"]', 'content').toLowerCase();
    const canonical = attr('link[rel="canonical"]', 'href');

    const jsonLd = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
    const schemaTypes = [];
    jsonLd.forEach(el => {
      try {
        const d = JSON.parse(el.textContent);
        const t = d['@type'] || (Array.isArray(d) && d[0] && d[0]['@type']) || '';
        if (t) schemaTypes.push(Array.isArray(t) ? t[0] : t);
      } catch (e) {}
    });

    const hreflangTags = Array.from(document.querySelectorAll('link[rel="alternate"][hreflang]'))
      .map(l => ({ lang: l.getAttribute('hreflang'), href: (l.getAttribute('href') || '').substring(0, 60) }));

    return {
      // Title
      title,
      titleLength:   title.length,
      titleOptimal:  title.length >= 30 && title.length <= 60,

      // Description
      description:           desc,
      descriptionLength:     desc.length,
      descriptionOptimal:    desc.length >= 120 && desc.length <= 160,
      descriptionHasCTA:     /saib|conheç|descubr|acesse|veja|clique|baixe|comece|compre|solicite|fale/i.test(desc),

      // Technical meta
      canonical,
      hasCanonical:    !!canonical,
      robots:          robots || 'não definido',
      isNoindex:       robots.includes('noindex'),
      isNofollow:      robots.includes('nofollow'),
      hasCharset:      !!( get('meta[charset]') || get('meta[http-equiv="Content-Type"]') ),
      lang:            document.documentElement.getAttribute('lang') || '',
      hasFavicon:      !!( get('link[rel="icon"]') || get('link[rel="shortcut icon"]') || get('link[rel="apple-touch-icon"]') ),
      hasAMP:          !!( get('link[rel="amphtml"]') || document.documentElement.hasAttribute('amp') ),

      // Social
      og,
      tw,
      hreflangTags,

      // Structured data
      schemaCount: jsonLd.length,
      schemaTypes,
    };
  },

  // ── HEADINGS ──────────────────────────────────────────────────
  analyzeHeadings() {
    const dist = {};
    for (let i = 1; i <= 6; i++) dist['h' + i] = document.querySelectorAll('h' + i).length;

    // DOM order — first 30
    const domOrder = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6'))
      .slice(0, 30)
      .map(h => ({ level: parseInt(h.tagName[1]), text: h.innerText.trim().substring(0, 90) }));

    // Hierarchy issues
    const issues = [];
    let prevLevel = 0;
    domOrder.forEach(h => {
      if (prevLevel > 0 && h.level > prevLevel + 1)
        issues.push('H' + prevLevel + ' → H' + h.level + ' (nivel pulado)');
      prevLevel = h.level;
    });

    // H1s
    const h1Texts = Array.from(document.querySelectorAll('h1'))
      .map(h => h.innerText.trim().substring(0, 100));

    return {
      distribution: dist,
      h1Texts,
      h1Optimal:     dist.h1 === 1,
      domOrder,
      hierarchyIssues: [...new Set(issues)],
      hasH2:         dist.h2 > 0,
      h2Texts:       Array.from(document.querySelectorAll('h2')).slice(0, 5).map(h => h.innerText.trim().substring(0, 70)),
    };
  },

  // ── IMAGES ───────────────────────────────────────────────────
  analyzeImages() {
    const GENERIC = /^(img|image|photo|pic|picture|screenshot|untitled|default|banner|hero|bg|background|thumb|thumbnail)\d*\./i;
    const result = {
      total: 0, withAlt: 0, missingAlt: 0,
      withLazy: 0,
      webp: 0,
      genericFilename: 0,
      oversized: [],
      missingAltList: [],
    };

    document.querySelectorAll('img').forEach(img => {
      result.total++;
      const alt = (img.getAttribute('alt') || '').trim();
      if (alt) result.withAlt++;
      else {
        result.missingAlt++;
        const src = (img.getAttribute('src') || img.getAttribute('data-src') || '').substring(0, 80);
        if (result.missingAltList.length < 8) result.missingAltList.push(src || '(sem src)');
      }

      const loading = img.getAttribute('loading');
      if (loading === 'lazy' || img.hasAttribute('data-src') || img.hasAttribute('data-lazy')) result.withLazy++;

      const src = (img.getAttribute('src') || '').toLowerCase();
      if (src.includes('.webp') || src.includes('format=webp')) result.webp++;

      const filename = src.split('/').pop().split('?')[0];
      if (GENERIC.test(filename)) result.genericFilename++;

      if (img.naturalWidth > 0 && img.offsetWidth > 0) {
        const ratio = img.naturalWidth / img.offsetWidth;
        if (ratio > 3 && result.oversized.length < 5)
          result.oversized.push({ src: src.substring(0, 60), ratio: Math.round(ratio) });
      }
    });

    result.altCoverage   = result.total > 0 ? Math.round(result.withAlt / result.total * 100) : 100;
    result.lazyCoverage  = result.total > 0 ? Math.round(result.withLazy / result.total * 100) : 0;
    result.webpCoverage  = result.total > 0 ? Math.round(result.webp / result.total * 100) : 0;

    return result;
  },

  // ── URL ──────────────────────────────────────────────────────
  analyzeURL() {
    const loc = window.location;
    const path = loc.pathname;
    return {
      full:            loc.href.substring(0, 120),
      pathname:        path,
      pathLength:      path.length,
      totalLength:     loc.href.length,
      depth:           path.split('/').filter(Boolean).length,
      hasParams:       loc.search.length > 1,
      params:          loc.search.substring(0, 80),
      hasHash:         loc.hash.length > 1,
      hasHyphens:      path.includes('-'),
      hasUnderscores:  path.includes('_'),
      hasUpperCase:    /[A-Z]/.test(path),
      hasDynamic:      /[?&](?:id|p|page|cat|tag|ref|utm_|fbclid|gclid)=/i.test(loc.search),
      isHTTPS:         loc.protocol === 'https:',
      isClean:         loc.search.length <= 1 && !path.includes('_') && !/[A-Z]/.test(path),
    };
  },

  // ── PERFORMANCE HINTS ────────────────────────────────────────
  analyzePerformance() {
    let blocking = 0, asyncDefer = 0, inline = 0, external = 0;

    document.querySelectorAll('script').forEach(s => {
      if (s.src) {
        external++;
        if (!s.async && !s.defer && !s.type?.includes('module')) blocking++;
        else asyncDefer++;
      } else if (s.textContent.trim().length > 0 && !s.type?.includes('json')) {
        inline++;
      }
    });

    const cssExternal = document.querySelectorAll('link[rel="stylesheet"]').length;
    const cssInline   = document.querySelectorAll('style').length;

    return {
      scripts:          external,
      scriptsBlocking:  blocking,
      scriptsAsyncDefer:asyncDefer,
      scriptsInline:    inline,
      cssExternal,
      cssInline,
      iframes:          document.querySelectorAll('iframe').length,
      hasPreconnect:    !!document.querySelector('link[rel="preconnect"]'),
      hasPreload:       !!document.querySelector('link[rel="preload"]'),
      hasDNSPrefetch:   !!document.querySelector('link[rel="dns-prefetch"]'),
    };
  },

  // ── CONTENT QUALITY ──────────────────────────────────────────
  analyzeContentQuality() {
    const POOR_ANCHORS = /^(clique aqui|click here|saiba mais|leia mais|aqui|here|link|mais|acesse|veja|more|read more)$/i;
    let poorAnchors = 0;
    document.querySelectorAll('a').forEach(a => {
      if (POOR_ANCHORS.test(a.textContent.trim())) poorAnchors++;
    });

    let publishDate = '';
    for (const sel of ['meta[property="article:published_time"]','meta[name="date"]','time[datetime]','meta[property="og:updated_time"]']) {
      const el = document.querySelector(sel);
      if (el) { publishDate = el.getAttribute('content') || el.getAttribute('datetime') || ''; if (publishDate) break; }
    }

    return { poorAnchorTexts: poorAnchors, publishDate, hasDateMarkup: !!publishDate };
  },

  // ── LINKS ────────────────────────────────────────────────────
  analyzeLinks() {
    const result = { internal: 0, external: 0, total: 0, nofollow: 0, redirects: [], topExternalDomains: [], forms: [] };
    const REDIRECTS = new Set(['bit.ly','goo.gl','t.co','ow.ly','tinyurl.com','short.io','rebrand.ly','cutt.ly','buff.ly','dlvr.it','ift.tt','tiny.cc','is.gd','lnkd.in','fb.me','tr.im','snip.ly','clck.ru','v.gd']);
    const currentDomain = new URL(window.location.href).hostname;
    const extDomains = {};

    // Cap at 300 to avoid slow scan on link-heavy pages
    const links = Array.from(document.querySelectorAll('a[href]')).slice(0, 300);
    links.forEach(link => {
      const href = link.getAttribute('href') || '';
      if (!href || /^(#|mailto:|tel:|javascript:)/.test(href)) return;
      if (href.startsWith('http') || href.startsWith('//')) {
        try {
          const u = new URL(href.startsWith('//') ? 'https:' + href : href);
          result.total++;
          if ((link.getAttribute('rel') || '').includes('nofollow')) result.nofollow++;
          const own = u.hostname === currentDomain || u.hostname === 'www.' + currentDomain;
          if (own) { result.internal++; }
          else {
            result.external++;
            if (REDIRECTS.has(u.hostname)) {
              result.redirects.push({ href: href.substring(0, 120), text: link.textContent.trim().substring(0, 50) || '(sem texto)', service: u.hostname });
            } else {
              extDomains[u.hostname] = (extDomains[u.hostname] || 0) + 1;
            }
          }
        } catch (e) {}
      }
    });

    result.topExternalDomains = Object.entries(extDomains).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([domain, count]) => ({ domain, count }));

    document.querySelectorAll('form').forEach(f => {
      result.forms.push({ action: f.getAttribute('action') || '(sem action)', method: (f.getAttribute('method') || 'GET').toUpperCase(), inputs: f.querySelectorAll('input:not([type="hidden"]), select, textarea').length });
    });

    return result;
  },

  // ── KEYWORDS ─────────────────────────────────────────────────
  analyzeContent() {
    const STOP = new Set(['de','a','o','que','e','do','da','em','um','para','com','uma','os','no','se','na','por','mais','as','dos','como','mas','ao','ele','das','seu','sua','ou','ser','quando','muito','nos','já','também','pelo','pela','até','isso','ela','entre','era','depois','sem','mesmo','aos','seus','nas','me','esse','eles','você','essa','nem','suas','meu','minha','pelos','elas','seja','qual','será','nós','lhe','essas','esses','pelas','este','dele','tu','te','vocês','foi','são','está','tem','não','num','nessa','neste','nesta','nesse','ter','sobre','aqui','ali','tudo','cada','onde','the','and','or','but','in','on','at','to','for','of','with','by','from','is','are','was','were','be','been','have','has','had','do','does','did','will','would','could','should','may','might','this','that','these','those','it','its','not','no','so','if','as','up','out','about','into','than','then','there','when','where','who','which','what','how','all','each','they','them','their','we','our','you','your','he','she','his','her','can','just','an','also','been','being']);

    // Single innerText call — reuse for both word count and keywords
    const bodyText = document.body.innerText || '';
    const allWords = bodyText.trim().split(/\s+/);

    // textContent on specific elements is faster (no layout forced)
    let ct = '';
    document.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li,td,th').forEach(el => { ct += ' ' + el.textContent; });
    if (!ct.trim()) ct = bodyText;

    const cleaned = ct.toLowerCase().replace(/[^a-záàâãéèêíïóôõöúüçñ\s]/gi, ' ').split(/\s+/).filter(w => w.length > 3 && !STOP.has(w) && !/^\d+$/.test(w));

    const freq = {};
    cleaned.forEach(w => { freq[w] = (freq[w] || 0) + 1; });
    const topKeywords = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([word, count]) => ({ word, count }));

    return { wordCount: allWords.length, topKeywords, paragraphs: document.querySelectorAll('p').length, readingTime: Math.ceil(allWords.length / 200) };
  },

  // ── TAGS & WEBHOOKS ──────────────────────────────────────────
  analyzeTags() {
    const srcs    = Array.from(document.querySelectorAll('script[src]')).map(s => s.src);
    const inline  = Array.from(document.querySelectorAll('script:not([src])')).map(s => s.textContent).join('\n');
    const noscript= Array.from(document.querySelectorAll('noscript')).map(n => n.innerHTML).join('\n');
    const all     = srcs.join('\n') + '\n' + inline + '\n' + noscript;

    const DEFS = [
      { name: 'Google Tag Manager',         cat: 'Tag Manager', chk: () => srcs.some(s => s.includes('googletagmanager.com/gtm.js')) || noscript.includes('googletagmanager.com/ns.html'), id: () => (all.match(/GTM-[A-Z0-9]+/)||[])[0]||'' },
      { name: 'Google Analytics 4',         cat: 'Analytics',   chk: () => srcs.some(s => s.includes('gtag/js')),                                                                          id: () => (all.match(/G-[A-Z0-9]{6,}/)||[])[0]||'' },
      { name: 'Google Analytics Universal', cat: 'Analytics',   chk: () => srcs.some(s => s.includes('analytics.js')) || inline.includes("ga('create'"),                                  id: () => (all.match(/UA-\d{4,}-\d+/)||[])[0]||'' },
      { name: 'Google Ads',                 cat: 'Ads',         chk: () => srcs.some(s => s.includes('googleadservices.com')||s.includes('googlesyndication.com')),                        id: () => (all.match(/AW-\d+/)||[])[0]||'' },
      { name: 'Facebook Pixel',             cat: 'Ads',         chk: () => srcs.some(s => s.includes('connect.facebook.net')) || inline.includes("fbq('init'"),                           id: () => { const m = inline.match(/fbq\(['"]init['"],\s*['"](\d+)['"]/); return m?m[1]:''; } },
      { name: 'HotJar',                     cat: 'Heatmap',     chk: () => srcs.some(s => s.includes('hotjar.com')),                                                                       id: () => { const m = inline.match(/hjid[:\s]+(\d+)/); return m?m[1]:''; } },
      { name: 'Microsoft Clarity',          cat: 'Heatmap',     chk: () => srcs.some(s => s.includes('clarity.ms')),                                                                       id: () => '' },
      { name: 'LinkedIn Insight',           cat: 'Ads',         chk: () => srcs.some(s => s.includes('snap.licdn.com')),                                                                   id: () => { const m = inline.match(/_linkedin_partner_id\s*=\s*['"]?(\d+)/); return m?m[1]:''; } },
      { name: 'TikTok Pixel',               cat: 'Ads',         chk: () => srcs.some(s => s.includes('analytics.tiktok.com')),                                                             id: () => '' },
      { name: 'Twitter / X Pixel',          cat: 'Ads',         chk: () => srcs.some(s => s.includes('ads-twitter.com')),                                                                  id: () => '' },
      { name: 'Pinterest Tag',              cat: 'Ads',         chk: () => inline.includes('pintrk') || srcs.some(s => s.includes('pinimg.com')),                                          id: () => '' },
      { name: 'Snapchat Pixel',             cat: 'Ads',         chk: () => srcs.some(s => s.includes('sc-static.net')),                                                                    id: () => '' },
      { name: 'HubSpot',                    cat: 'CRM',         chk: () => srcs.some(s => s.includes('hs-scripts.com')||s.includes('hubspot.com')),                                        id: () => { const m = (srcs.find(s=>s.includes('hs-scripts.com'))||'').match(/\/(\d+)\.js/); return m?m[1]:''; } },
      { name: 'Intercom',                   cat: 'Chat',        chk: () => srcs.some(s => s.includes('widget.intercom.io')||s.includes('intercomcdn.com'))||inline.includes('Intercom'),   id: () => { const m = inline.match(/app_id:\s*['"]([^'"]+)['"]/); return m?m[1]:''; } },
      { name: 'Crisp Chat',                 cat: 'Chat',        chk: () => srcs.some(s => s.includes('crisp.chat'))||inline.includes('CRISP_WEBSITE_ID'),                                  id: () => { const m = inline.match(/CRISP_WEBSITE_ID\s*=\s*['"]([^'"]+)['"]/); return m?m[1]:''; } },
      { name: 'Zendesk',                    cat: 'Chat',        chk: () => srcs.some(s => s.includes('zendesk.com')),                                                                       id: () => '' },
      { name: 'Drift',                      cat: 'Chat',        chk: () => srcs.some(s => s.includes('driftt.com')||s.includes('drift.com')),                                               id: () => '' },
      { name: 'Segment',                    cat: 'Analytics',   chk: () => srcs.some(s => s.includes('cdn.segment.com')||s.includes('cdn.segment.io')),                                    id: () => '' },
      { name: 'Mixpanel',                   cat: 'Analytics',   chk: () => srcs.some(s => s.includes('mxpnl.com')||s.includes('mixpanel.com')),                                            id: () => '' },
      { name: 'Amplitude',                  cat: 'Analytics',   chk: () => srcs.some(s => s.includes('cdn.amplitude.com')),                                                                id: () => '' },
      { name: 'Klaviyo',                    cat: 'Email',       chk: () => srcs.some(s => s.includes('klaviyo.com')),                                                                       id: () => '' },
      { name: 'RD Station',                 cat: 'CRM',         chk: () => srcs.some(s => s.includes('rdstation.com.br')||s.includes('d335luupugsy2.cloudfront.net')),                     id: () => '' },
    ];

    return DEFS.filter(d => { try { return d.chk(); } catch(e) { return false; } })
               .map(d => ({ name: d.name, category: d.cat, id: (() => { try { return d.id(); } catch(e) { return ''; } })() }));
  },

  detectWebhooks() {
    const content = [
      Array.from(document.querySelectorAll('script:not([src])')).map(s => s.textContent).join('\n'),
      Array.from(document.querySelectorAll('form[action]')).map(f => f.getAttribute('action')||'').join('\n'),
    ].join('\n');
    const PATTERNS = [
      { name: 'Zapier',          re: /https?:\/\/hooks\.zapier\.com\/hooks\/catch\/[^\s"'<>]+/ },
      { name: 'Make',            re: /https?:\/\/hook\.(integromat|eu1\.make|us1\.make)\.com\/[^\s"'<>]+/ },
      { name: 'n8n',             re: /https?:\/\/[^\s"'<>]*\.n8n\.cloud\/webhook\/[^\s"'<>]+/ },
      { name: 'Pipedream',       re: /https?:\/\/[^\s"'<>]*pipedream\.net\/[^\s"'<>]+/ },
      { name: 'IFTTT',           re: /https?:\/\/maker\.ifttt\.com\/trigger\/[^\s"'<>]+/ },
      { name: 'Formspree',       re: /https?:\/\/formspree\.io\/f\/[^\s"'<>]+/ },
    ];
    const found = []; const seen = new Set();
    PATTERNS.forEach(({ name, re }) => {
      const m = content.match(re);
      if (m && !seen.has(name)) { seen.add(name); found.push({ name, url: m[0].substring(0, 80) }); }
    });
    return found;
  },

  // ── FULL ANALYSIS ────────────────────────────────────────────
  runFullAnalysis() {
    try {
      return {
        url:            window.location.href,
        timestamp:      new Date().toISOString(),
        meta:           this.analyzeMeta(),
        headings:       this.analyzeHeadings(),
        images:         this.analyzeImages(),
        links:          this.analyzeLinks(),
        keywords:       this.analyzeContent(),
        url_analysis:   this.analyzeURL(),
        performance:    this.analyzePerformance(),
        contentQuality: this.analyzeContentQuality(),
        tags:           this.analyzeTags(),
      };
    } catch (err) {
      console.error('SEO Analyzer error:', err);
      return null;
    }
  },

  sendToBackground(data) {
    if (data) chrome.runtime.sendMessage({ type: 'SEO_ANALYSIS_COMPLETE', data }, () => { if (chrome.runtime.lastError) {} });
  }
};

// Cache result so popup requests return instantly without re-running analysis
let _analysisCache = null;

function getAnalysis() {
  if (!_analysisCache) _analysisCache = SEOAnalyzer.runFullAnalysis();
  return _analysisCache;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    _analysisCache = SEOAnalyzer.runFullAnalysis();
    SEOAnalyzer.sendToBackground(_analysisCache);
  });
} else {
  _analysisCache = SEOAnalyzer.runFullAnalysis();
  SEOAnalyzer.sendToBackground(_analysisCache);
}

chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if (req.type === 'REQUEST_ANALYSIS') sendResponse({ success: true, data: getAnalysis() });
});
