document.addEventListener('DOMContentLoaded', init);

async function init() {
  await loadKeywords();
  await loadEnabled();
  setupEventListeners();
}

function setupEventListeners() {
  document.getElementById('add-btn').addEventListener('click', addKeyword);
  document.getElementById('keyword-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addKeyword();
  });
  document.getElementById('enabled-toggle').addEventListener('change', toggleEnabled);
}

async function loadKeywords() {
  const result = await chrome.storage.sync.get(['keywords']);
  const keywords = result.keywords || [];
  renderKeywords(keywords);
}

async function loadEnabled() {
  const result = await chrome.storage.sync.get(['enabled']);
  const enabled = result.enabled !== false;
  document.getElementById('enabled-toggle').checked = enabled;
}

function renderKeywords(keywords) {
  const list = document.getElementById('keywords-list');

  if (keywords.length === 0) {
    list.innerHTML = '<li class="empty-message">Chưa có từ khóa nào</li>';
    return;
  }

  list.innerHTML = keywords.map((keyword, index) => `
    <li>
      <span>${escapeHtml(keyword)}</span>
      <button class="delete-btn" data-index="${index}">Xóa</button>
    </li>
  `).join('');

  list.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteKeyword(parseInt(btn.dataset.index)));
  });
}

async function addKeyword() {
  const input = document.getElementById('keyword-input');
  const keyword = input.value.trim();

  if (!keyword) return;

  const result = await chrome.storage.sync.get(['keywords']);
  const keywords = result.keywords || [];

  if (keywords.includes(keyword)) {
    alert('Từ khóa này đã tồn tại!');
    return;
  }

  keywords.push(keyword);
  await chrome.storage.sync.set({ keywords });

  input.value = '';
  renderKeywords(keywords);
  notifyContentScript();
}

async function deleteKeyword(index) {
  const result = await chrome.storage.sync.get(['keywords']);
  const keywords = result.keywords || [];

  keywords.splice(index, 1);
  await chrome.storage.sync.set({ keywords });

  renderKeywords(keywords);
  notifyContentScript();
}

async function toggleEnabled() {
  const enabled = document.getElementById('enabled-toggle').checked;
  await chrome.storage.sync.set({ enabled });
  notifyContentScript();
}

async function notifyContentScript() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.url?.includes('facebook.com')) {
    chrome.tabs.sendMessage(tab.id, { action: 'update' }).catch(() => {});
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
