const SEOAnalyzer = {

  data: {
    url: '',
    timestamp: new Date().toISOString(),
    meta: {},
    headings: {},
    links: {},
    images: {},
    keywords: {}
  },

  analyzeMeta() {
    const meta = {};

    meta.title = document.title || '';
    meta.titleLength = meta.title.length;
    meta.titleOptimal = meta.titleLength >= 30 && meta.titleLength <= 60;

    const descMeta = document.querySelector('meta[name="description"]');
    meta.description = descMeta ? (descMeta.getAttribute('content') || '') : '';
    meta.descriptionLength = meta.description.length;
    meta.descriptionOptimal = meta.descriptionLength >= 120 && meta.descriptionLength <= 160;

    const ogTitle = document.querySelector('meta[property="og:title"]');
    meta.ogTitle = ogTitle ? (ogTitle.getAttribute('content') || '') : '';

    const ogDesc = document.querySelector('meta[property="og:description"]');
    meta.ogDescription = ogDesc ? (ogDesc.getAttribute('content') || '') : '';

    const canonical = document.querySelector('link[rel="canonical"]');
    meta.canonical = canonical ? (canonical.getAttribute('href') || '') : '';

    const viewport = document.querySelector('meta[name="viewport"]');
    meta.hasViewport = !!viewport;

    const robots = document.querySelector('meta[name="robots"]');
    meta.robots = robots ? (robots.getAttribute('content') || '') : '';

    return meta;
  },

  analyzeHeadings() {
    const headings = {
      h1: [],
      h2: [],
      h3: [],
      distribution: {}
    };

    for (let i = 1; i <= 3; i++) {
      const tags = document.querySelectorAll('h' + i);
      headings['h' + i] = Array.from(tags).map(h => ({
        text: h.innerText.trim().substring(0, 80),
        length: h.innerText.trim().length
      }));
      headings.distribution['h' + i] = tags.length;
    }

    headings.h1Optimal = headings.distribution.h1 === 1;
    return headings;
  },

  analyzeLinks() {
    const links = { internal: 0, external: 0, total: 0, nofollow: 0 };
    const currentDomain = new URL(window.location.href).hostname;
    const allLinks = document.querySelectorAll('a[href]');

    allLinks.forEach(link => {
      const href = link.getAttribute('href');
      if (href && href.startsWith('http')) {
        try {
          const linkDomain = new URL(href).hostname;
          links.total++;
          if (linkDomain === currentDomain) {
            links.internal++;
          } else {
            links.external++;
          }
          if ((link.getAttribute('rel') || '').includes('nofollow')) {
            links.nofollow++;
          }
        } catch (e) {}
      }
    });

    return links;
  },

  analyzeImages() {
    const images = { total: 0, withAlt: 0, missingAlt: 0 };
    const allImages = document.querySelectorAll('img');
    images.total = allImages.length;

    allImages.forEach(img => {
      const alt = img.getAttribute('alt') || '';
      if (alt.trim() === '') {
        images.missingAlt++;
      } else {
        images.withAlt++;
      }
    });

    return images;
  },

  analyzeContent() {
    const stopWords = new Set([
      'de','a','o','que','e','do','da','em','um','para','com','uma','os','no',
      'se','na','por','mais','as','dos','como','mas','ao','ele','das','seu',
      'sua','ou','ser','quando','muito','nos','já','também','pelo','pela','até',
      'isso','ela','entre','era','depois','sem','mesmo','aos','seus','nas','me',
      'esse','eles','você','essa','nem','suas','meu','minha','pelos','elas',
      'seja','qual','será','nós','lhe','deles','essas','esses','pelas','este',
      'dele','tu','te','vocês','lhes','meus','minhas','teu','tua','nosso',
      'nossa','foi','são','está','tem','não','num','nessa','neste','nesta',
      'nesse','ter','sobre','este','essa','aqui','ali','tudo','cada','onde',
      'the','and','or','but','in','on','at','to','for','of','with','by','from',
      'is','are','was','were','be','been','have','has','had','do','does','did',
      'will','would','could','should','may','might','this','that','these','those',
      'it','its','not','no','so','if','as','up','out','about','into','than',
      'then','there','when','where','who','which','what','how','all','each',
      'they','them','their','we','our','you','your','he','she','his','her',
      'can','just','an','also','was','been','being','its'
    ]);

    const elements = document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, li, td, th');
    let contentText = '';
    elements.forEach(el => { contentText += ' ' + el.innerText; });
    if (!contentText.trim()) contentText = document.body.innerText;

    const allWords = document.body.innerText.trim().split(/\s+/);

    const cleaned = contentText.toLowerCase()
      .replace(/[^a-záàâãéèêíïóôõöúüçñ\s]/gi, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3 && !stopWords.has(w) && !/^\d+$/.test(w));

    const freq = {};
    cleaned.forEach(w => { freq[w] = (freq[w] || 0) + 1; });

    const topKeywords = Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([word, count]) => ({ word, count }));

    return {
      wordCount: allWords.length,
      topKeywords,
      paragraphs: document.querySelectorAll('p').length,
      readingTime: Math.ceil(allWords.length / 200)
    };
  },

  analyzeTechnical() {
    return {
      protocol: window.location.protocol.replace(':', ''),
      isHTTPS: window.location.protocol === 'https:',
      hasCanonical: !!document.querySelector('link[rel="canonical"]'),
      lang: document.documentElement.getAttribute('lang') || '',
      mobile: this.isMobileFriendly(),
      hasStructuredData: !!document.querySelector('script[type="application/ld+json"]'),
      hasSitemap: false
    };
  },

  isMobileFriendly() {
    const viewport = document.querySelector('meta[name="viewport"]');
    return !!(viewport && (viewport.getAttribute('content') || '').includes('width=device-width'));
  },

  runFullAnalysis() {
    try {
      this.data.url = window.location.href;
      this.data.meta = this.analyzeMeta();
      this.data.headings = this.analyzeHeadings();
      this.data.links = this.analyzeLinks();
      this.data.images = this.analyzeImages();
      this.data.keywords = this.analyzeContent();
      this.data.technical = this.analyzeTechnical();
      return this.data;
    } catch (error) {
      console.error('Erro na analise:', error);
      return null;
    }
  },

  sendToBackground() {
    const analysis = this.runFullAnalysis();
    if (analysis) {
      chrome.runtime.sendMessage(
        { type: 'SEO_ANALYSIS_COMPLETE', data: analysis },
        () => { if (chrome.runtime.lastError) {} }
      );
    }
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => SEOAnalyzer.sendToBackground());
} else {
  SEOAnalyzer.sendToBackground();
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'REQUEST_ANALYSIS') {
    sendResponse({ success: true, data: SEOAnalyzer.runFullAnalysis() });
  }
});
