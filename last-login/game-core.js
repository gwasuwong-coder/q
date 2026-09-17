'use strict';
const normalizeQuery = value => String(value || '').normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');
class CaseEngine {
  constructor(data, saved = null) {
    this.data = data; this.map = new Map(data.posts.map(p => [p.id, p]));
    const valid = ids => [...new Set((Array.isArray(ids) ? ids : []).filter(id => this.map.has(id)))];
    this.state = { read: valid(saved?.read), found: valid(saved?.found), pinned: valid(saved?.pinned), queries: (Array.isArray(saved?.queries) ? saved.queries : []).filter(q => typeof q === 'string').slice(0, 30), notes: typeof saved?.notes === 'string' ? saved.notes.slice(0, 6000) : '', hints: Number.isFinite(saved?.hints) ? Math.max(0, saved.hints) : 0, ending: saved?.ending === 'resolved' ? 'resolved' : null };
    this.state.started = Boolean(saved?.started);
    for (const p of data.posts.filter(p => p.home)) if (!this.state.found.includes(p.id)) this.state.found.push(p.id);
  }
  available(p) { return p.requires.every(id => this.state.read.includes(id)); }
  search(query, remember = true) {
    const q = normalizeQuery(query);
    if (!q) return this.data.posts.filter(p => p.home);
    if (remember && query.trim()) this.state.queries = [query.trim().slice(0, 80), ...this.state.queries.filter(x => x !== query.trim())].slice(0, 30);
    const tokens = String(query).trim().split(/\s+/).map(normalizeQuery).filter(Boolean);
    const results = this.data.posts.filter(p => {
      const corpus = normalizeQuery([p.title, p.author, p.date, ...p.terms, ...p.body, ...p.comments.map(c => `${c.author} ${c.text}`), p.attachment?.text || ''].join(' '));
      return this.available(p) && (corpus.includes(q) || (tokens.length > 1 && tokens.every(t => corpus.includes(t))));
    });
    for (const p of results) if (!this.state.found.includes(p.id)) this.state.found.push(p.id);
    return results;
  }
  read(id) {
    const p = this.map.get(id);
    if (!p || !this.available(p)) return null;
    if (!this.state.found.includes(id)) this.state.found.push(id);
    if (!this.state.read.includes(id)) this.state.read.push(id);
    return p;
  }
  pin(id) {
    if (!this.state.read.includes(id)) return;
    const n = this.state.pinned.indexOf(id);
    if (n < 0) this.state.pinned.push(id); else this.state.pinned.splice(n, 1);
  }
  list(kind) {
    return this.data.posts.filter(p => kind === 'home' ? p.home : kind === 'pinned' ? this.state.pinned.includes(p.id) : kind === 'read' ? this.state.read.includes(p.id) : this.state.found.includes(p.id));
  }
  hint() {
    this.state.hints++;
    const unreadHome = this.data.posts.find(p => p.home && !this.state.read.includes(p.id) && p.id !== 'p04');
    if (unreadHome) return `첫 화면의 「${unreadHome.title}」을 읽어보세요. 댓글도 기록의 일부입니다.`;
    const target = this.data.posts.find(p => !p.home && !['p13','p16','p20','p22'].includes(p.id) && this.available(p) && !this.state.read.includes(p.id));
    if (target) return `지금까지 읽은 기록에 연결되는 검색어가 있습니다. 「${target.terms[0]}」로 찾아보세요.`;
    return '접속 기록, 서진의 답장, 인쇄소 접수 기록을 증거함에 넣고 사건 보고서를 작성해 보세요.';
  }
  submit(answers, evidence) {
    const issues = [];
    for (const q of this.data.questions) {
      if (answers[q.id] !== q.answer) issues.push('결론과 기록이 맞지 않는 항목이 있습니다.');
      if (!q.evidence.some(id => evidence[q.id] === id && this.state.pinned.includes(id) && this.state.read.includes(id))) issues.push('각 결론을 직접 뒷받침하는 자료를 증거함에서 골라주세요.');
    }
    if (!this.state.read.includes('p21')) issues.push('윤서진의 이후 행적을 확인할 마지막 기록이 아직 부족합니다.');
    const accepted = issues.length === 0;
    if (accepted) this.state.ending = 'resolved';
    return { accepted, issues: [...new Set(issues)] };
  }
}
if (typeof module !== 'undefined') module.exports = { CaseEngine, normalizeQuery };
