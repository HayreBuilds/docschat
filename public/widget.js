/**
 * docschat widget — drop-in AI search for any documentation site
 * Usage: <script src="https://your-server.com/widget.js" data-server="https://your-server.com" data-api-key="nvapi-..."></script>
 */
(function() {
  const script = document.currentScript || document.querySelector('script[data-server]');
  const SERVER = (script && script.getAttribute('data-server')) || 'http://localhost:4242';
  const API_KEY = (script && script.getAttribute('data-api-key')) || '';
  const PLACEHOLDER = (script && script.getAttribute('data-placeholder')) || 'Search docs...';
  const TITLE = (script && script.getAttribute('data-title')) || 'Docs Search';

  const styles = `
  #docschat-btn{position:fixed;bottom:24px;right:24px;background:#6c63ff;color:white;border:none;border-radius:50%;width:52px;height:52px;font-size:22px;cursor:pointer;box-shadow:0 4px 20px rgba(108,99,255,.4);z-index:9999;transition:transform .2s}
  #docschat-btn:hover{transform:scale(1.1)}
  #docschat-panel{position:fixed;bottom:90px;right:24px;width:360px;max-height:560px;background:white;border-radius:16px;box-shadow:0 8px 40px rgba(0,0,0,.15);z-index:9999;display:none;flex-direction:column;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
  #docschat-panel.open{display:flex}
  #docschat-header{background:#6c63ff;color:white;padding:16px 20px;display:flex;justify-content:space-between;align-items:center}
  #docschat-header h3{font-size:15px;font-weight:600;margin:0}
  #docschat-close{background:none;border:none;color:white;cursor:pointer;font-size:20px;padding:0}
  #docschat-body{flex:1;overflow-y:auto;padding:16px}
  #docschat-answer{font-size:14px;line-height:1.6;color:#334155;white-space:pre-wrap}
  #docschat-sources{margin-top:12px}
  #docschat-sources a{display:block;font-size:12px;color:#6c63ff;text-decoration:none;margin-top:4px;word-break:break-all}
  #docschat-sources a:hover{text-decoration:underline}
  #docschat-footer{padding:12px;border-top:1px solid #e2e8f0;display:flex;gap:8px}
  #docschat-input{flex:1;border:1px solid #e2e8f0;border-radius:8px;padding:8px 12px;font-size:14px;outline:none;font-family:inherit}
  #docschat-input:focus{border-color:#6c63ff}
  #docschat-send{background:#6c63ff;color:white;border:none;border-radius:8px;padding:8px 14px;cursor:pointer;font-size:14px}
  #docschat-send:hover{background:#5b52f0}
  .docschat-loading{color:#94a3b8;font-size:14px;text-align:center;padding:20px}
  `;

  const style = document.createElement('style');
  style.textContent = styles;
  document.head.appendChild(style);

  document.body.insertAdjacentHTML('beforeend', `
  <button id="docschat-btn" title="Search Docs">💬</button>
  <div id="docschat-panel">
    <div id="docschat-header">
      <h3>${TITLE}</h3>
      <button id="docschat-close">✕</button>
    </div>
    <div id="docschat-body">
      <div id="docschat-answer" style="color:#94a3b8;font-size:14px">Ask a question about the documentation...</div>
      <div id="docschat-sources"></div>
    </div>
    <div id="docschat-footer">
      <input id="docschat-input" placeholder="${PLACEHOLDER}" onkeydown="if(event.key==='Enter')window._docschatSend()">
      <button id="docschat-send" onclick="window._docschatSend()">→</button>
    </div>
  </div>`);

  document.getElementById('docschat-btn').onclick = function() {
    const panel = document.getElementById('docschat-panel');
    panel.classList.toggle('open');
    if (panel.classList.contains('open')) document.getElementById('docschat-input').focus();
  };
  document.getElementById('docschat-close').onclick = function() {
    document.getElementById('docschat-panel').classList.remove('open');
  };

  window._docschatSend = async function() {
    const input = document.getElementById('docschat-input');
    const question = input.value.trim();
    if (!question) return;
    input.value = '';
    const answerEl = document.getElementById('docschat-answer');
    const sourcesEl = document.getElementById('docschat-sources');
    answerEl.innerHTML = '<div class="docschat-loading">Searching...</div>';
    sourcesEl.innerHTML = '';
    try {
      const resp = await fetch(SERVER + '/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, apiKey: API_KEY }),
      });
      const data = await resp.json();
      answerEl.textContent = data.answer || data.error || 'No answer found.';
      if (data.sources && data.sources.length > 0) {
        sourcesEl.innerHTML = '<div style="font-size:11px;color:#94a3b8;margin-top:12px;margin-bottom:4px;text-transform:uppercase;letter-spacing:.5px">Sources</div>' +
          data.sources.map(s => `<a href="${s.url}" target="_blank">📄 ${s.title}</a>`).join('');
      }
    } catch (e) {
      answerEl.textContent = 'Error: Could not reach docschat server.';
    }
  };
})();
// Deploy to any CDN:
// <script src="https://cdn.jsdelivr.net/gh/yourusername/docschat/public/widget.js" ...></script>
// Deploy to any CDN:
// <script src="https://cdn.jsdelivr.net/gh/yourusername/docschat/public/widget.js" ...></script>
