'use strict';
(() => {
  const KEY = 'last-login-case01-v1';
  const $ = id => document.getElementById(id);
  let saved = null, storageOk = true;
  try { saved = JSON.parse(localStorage.getItem(KEY)); } catch (_) { storageOk = false; }
  let game = new CaseEngine(CASE_DATA, saved);
  let view = 'home', query = '', previous = { view: 'home', query: '' }, toastTimer, saveTimer;
  function node(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function button(text, cls, click) { const b = node('button', cls, text); b.type = 'button'; b.addEventListener('click', click); return b; }
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(game.state)); storageOk = true; }
    catch (_) { storageOk = false; }
    $('save-status').textContent = storageOk ? '이 브라우저에 자동 저장됨' : '브라우저 저장 불가 · 현재 창에서만 유지';
  }
  function toast(text) { $('toast').textContent = text; $('toast').classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('show'), 2400); }
  function show(id) { if (!$(id).open) $(id).showModal(); }
  function close(id) { $(id).close(); }
  function refreshRails() {
    $('found-count').textContent = game.state.found.length;
    $('pin-count').textContent = game.state.pinned.length;
    $('read-count').textContent = game.state.read.length;
    $('progress-fill').style.width = `${game.state.read.length / CASE_DATA.posts.length * 100}%`;
    $('footer-status').textContent = game.state.ending ? 'CASE 001 RESOLVED / RECORDS PRESERVED' : 'NETWORK DISCONNECTED / LOCAL COPY';
    $('recent-searches').replaceChildren();
    if (!game.state.queries.length) $('recent-searches').append(node('p', 'muted', '아직 검색한 단어가 없습니다.'));
    for (const q of game.state.queries.slice(0, 7)) $('recent-searches').append(button(q, '', () => search(q)));
    $('evidence-preview').replaceChildren();
    if (!game.state.pinned.length) $('evidence-preview').append(node('p', 'muted', '중요한 글을 읽고\n‘증거 보관’을 눌러주세요.'));
    for (const id of game.state.pinned.slice(-4).reverse()) $('evidence-preview').append(button(game.map.get(id).title, '', () => readPost(id)));
    document.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  }
  function row(p) {
    const b = button('', `post-row${game.state.read.includes(p.id) ? ' read' : ''}`, () => readPost(p.id));
    const top = node('div', 'post-topline');
    top.append(node('span', 'post-board', p.board), node('span', '', game.state.read.includes(p.id) ? '읽음' : '미열람'));
    if (game.state.pinned.includes(p.id)) top.append(node('span', 'post-pin', '◇ 보관됨'));
    b.append(top, node('h3', '', p.title), node('div', 'preview', p.body[0]));
    const meta = node('div', 'post-meta'); meta.append(node('span', '', p.author), node('span', '', p.date));
    if (p.comments.length) meta.append(node('span', '', `댓글 ${p.comments.length}`));
    if (p.attachment) meta.append(node('span', '', '첨부 1'));
    b.append(meta); return b;
  }
  function renderList() {
    const content = $('content'); content.replaceChildren();
    let posts, title, description;
    if (view === 'search') {
      posts = game.search(query, false); title = `‘${query}’ 검색 결과`;
      description = '읽은 기록이 늘면 같은 검색어로 새로운 자료를 찾을 수도 있습니다.';
    } else {
      posts = game.list(view);
      title = { home: '처음 복구된 글', found: '발견한 기록', pinned: '나의 증거함' }[view] || '기록';
      description = { home: '운영자의 마지막 공지와, 그 무렵 남겨진 동네 사람들의 글입니다.', found: '검색으로 발견한 기록입니다. 제목을 눌러 다시 읽을 수 있습니다.', pinned: '보고서의 근거로 사용할 기록입니다. 보관은 글 안에서 해제할 수 있습니다.' }[view];
    }
    const heading = node('div', 'section-head'); heading.append(node('h2', '', title), node('small', '', `${String(posts.length).padStart(2,'0')} RECORDS`));
    content.append(heading, node('p', 'section-desc', description));
    if (view === 'home' && game.state.ending) content.append(node('div', 'inline-message', '사건 보고서가 확인되었습니다. 아직 읽지 않은 동네 기록도 둘러보세요.'));
    if (!posts.length) {
      const empty = node('div', 'empty'); empty.append(node('div', 'empty-icon', '⌕'), node('h3', '', view === 'pinned' ? '아직 보관한 증거가 없습니다.' : '검색된 기록이 없습니다.'));
      empty.append(node('p', '', view === 'pinned' ? '중요한 글을 읽고 ‘증거 보관’을 눌러주세요.' : '짧고 구체적인 이름이나 장소로 다시 찾아보세요.\n아직 복구되지 않은 기록일 수도 있습니다.'));
      empty.append(button('처음 복구된 글로 돌아가기', '', () => navigate('home'))); content.append(empty);
    } else posts.forEach(p => content.append(row(p)));
    content.append(node('p', 'archive-footnote', '사소한 댓글도 누군가 남긴 흔적입니다. 첨부파일과 작성 시각도 살펴보세요.'));
    refreshRails(); persist();
  }
  function navigate(next) { view = next; query = ''; $('search-input').value = ''; renderList(); }
  function search(text) {
    const q = text.trim().slice(0, 80);
    if (!q) return navigate('home');
    query = q; view = 'search'; $('search-input').value = q;
    const before = game.state.found.length; game.search(q); renderList();
    if (game.state.found.length > before) toast(`${game.state.found.length - before}개의 기록을 새로 찾았습니다.`);
  }
  function readPost(id) {
    const p = game.read(id);
    if (!p) { toast('아직 복구되지 않은 기록입니다.'); return; }
    if (view !== 'article') previous = { view, query };
    view = 'article'; const content = $('content'); content.replaceChildren();
    const toolbar = node('div', 'article-toolbar');
    toolbar.append(button('← 목록으로', 'back-button', () => { view = previous.view; query = previous.query; $('search-input').value = query; renderList(); }));
    const pinned = game.state.pinned.includes(id);
    toolbar.append(button(pinned ? '◆ 증거 보관됨' : '◇ 증거 보관', `pin-button${pinned ? ' pinned' : ''}`, () => { game.pin(id); toast(game.state.pinned.includes(id) ? '증거함에 보관했습니다.' : '증거함에서 꺼냈습니다.'); readPost(id); }));
    const byline = node('div', 'article-byline'); byline.append(node('strong', '', p.author), node('span', '', p.date), node('span', '', p.hits ? `당시 조회 ${p.hits}` : '복구 문서'));
    content.append(toolbar, node('div', 'article-board', p.board), node('h2', 'article-title', p.title), byline);
    const body = node('article', `article-body${p.id === 'p15' ? ' log' : ''}`); p.body.forEach(text => body.append(node('p', '', text))); content.append(body);
    if (p.attachment) {
      const attachment = node('details', 'attachment'); attachment.append(node('summary', '', `▤ 첨부파일 · ${p.attachment.name}`), node('pre', '', p.attachment.text)); content.append(attachment);
    }
    if (p.comments.length) {
      const comments = node('section', 'comments'); comments.append(node('h3', '', `댓글 ${p.comments.length}`));
      p.comments.forEach(c => { const comment = node('div', 'comment'); comment.append(node('strong', '', c.author), node('p', '', c.text)); comments.append(comment); }); content.append(comments);
    }
    if (p.footer) content.append(node('p', 'post-footer', p.footer));
    content.append(button('선택한 문구로 검색하기 ↗', 'selection-search', () => {
      const selected = window.getSelection()?.toString().trim();
      if (selected && selected.length <= 80) search(selected);
      else { $('search-input').focus(); toast('본문에서 짧은 문구를 드래그하거나 검색창에 직접 입력하세요.'); }
    }));
    content.append(node('div', 'record-id', `YEONMU ARCHIVE / ${p.id.toUpperCase()} / ORIGINAL TEXT PRESERVED`));
    refreshRails(); persist();
    if (id === 'p21') toast('마지막 행적을 확인했습니다. 증거를 모아 보고서를 작성하세요.');
  }
  function openReport() {
    const container = $('report-questions'); container.replaceChildren(); $('report-feedback').textContent = '';
    CASE_DATA.questions.forEach((q, n) => {
      const field = node('fieldset', 'report-question'); field.append(node('legend', '', `${String(n+1).padStart(2,'0')}. ${q.label}`));
      const choices = node('div', 'choices');
      q.options.forEach(([value, text]) => { const label = node('label'); const input = node('input'); input.type = 'radio'; input.name = q.id; input.value = value; input.required = true; label.append(input, document.createTextNode(text)); choices.append(label); });
      field.append(choices);
      const label = node('label', 'evidence-label', '이 결론을 뒷받침하는 증거'); label.htmlFor = 'proof-' + q.id;
      const select = node('select'); select.id = label.htmlFor; select.name = 'evidence-' + q.id; select.required = true;
      const placeholder = node('option', '', game.state.pinned.length ? '증거함에서 기록 선택' : '먼저 중요한 기록을 증거함에 보관하세요'); placeholder.value = ''; select.append(placeholder);
      game.state.pinned.forEach(id => { const option = node('option', '', game.map.get(id).title); option.value = id; select.append(option); });
      field.append(label, select); container.append(field);
    }); show('report-dialog');
  }
  $('search-form').addEventListener('submit', e => { e.preventDefault(); search($('search-input').value); });
  document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => navigate(b.dataset.view)));
  $('home-logo').addEventListener('click', e => { e.preventDefault(); navigate('home'); });
  $('notes').value = game.state.notes;
  $('notes').addEventListener('input', () => { game.state.notes = $('notes').value.slice(0,6000); $('save-status').textContent = '저장 중…'; clearTimeout(saveTimer); saveTimer = setTimeout(persist, 300); });
  window.addEventListener('beforeunload', persist);
  document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => close(b.dataset.close)));
  $('request-open').addEventListener('click', () => show('mail-dialog'));
  $('help-open').addEventListener('click', () => show('help-dialog'));
  $('begin-button').addEventListener('click', () => { game.state.started = true; persist(); close('mail-dialog'); $('search-input').focus(); });
  $('hint-button').addEventListener('click', () => { $('hint-text').textContent = game.hint(); persist(); show('hint-dialog'); });
  $('restart-button').addEventListener('click', () => show('restart-dialog'));
  $('restart-confirm').addEventListener('click', () => { clearTimeout(saveTimer); game = new CaseEngine(CASE_DATA); $('notes').value = ''; previous = { view: 'home', query: '' }; persist(); close('restart-dialog'); navigate('home'); show('mail-dialog'); });
  $('report-open').addEventListener('click', openReport);
  $('report-form').addEventListener('submit', e => {
    e.preventDefault(); const form = new FormData(e.currentTarget), answers = {}, evidence = {};
    CASE_DATA.questions.forEach(q => { answers[q.id] = form.get(q.id); evidence[q.id] = form.get('evidence-' + q.id); });
    const result = game.submit(answers, evidence);
    if (!result.accepted) { $('report-feedback').textContent = '보고서 보완 요청\n' + result.issues.join('\n'); return; }
    persist(); refreshRails(); close('report-dialog');
    $('ending-stats').textContent = `읽은 기록 ${game.state.read.length} / 22 · 보관한 증거 ${game.state.pinned.length} · 도움 사용 ${game.state.hints}회`;
    show('ending-dialog');
  });
  $('ending-continue').addEventListener('click', () => { close('ending-dialog'); navigate('home'); });
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k' && !document.querySelector('dialog[open]')) { e.preventDefault(); $('search-input').focus(); $('search-input').select(); }
  });
  CASE_DATA.intro.paragraphs.forEach(p => $('mail-body').append(node('p', '', p)));
  renderList();
  if (!game.state.started) show('mail-dialog');
})();
