/**
 * 📬 메일함 — 여러 메일함을 PMS 한 화면에 모음
 *  - 지메일(koreahotelov@gmail.com): 이 스크립트 계정의 Gmail 을 직접 읽음 (id 앞에 'g:')
 *  - front@hoteloceanview.co.kr (+ 홈페이지 문의, 한메일 자동전달): front@ 메일 허브 웹앱 경유
 * 스크립트 속성: MAIL_HUB_URL, MAIL_HUB_TOKEN (허브 설정이 없으면 지메일만 표시)
 * 화면: Mailbox.html (doGet 에서 Index 뒤에 붙임)
 */
const MBX_DONE_LABEL = '처리완료';
let MBX_ME_ = null; // 이 스크립트를 실행하는 계정 (메일함을 쓸 때만 조회)
const mbxMe_ = () => MBX_ME_ || (MBX_ME_ = Session.getEffectiveUser().getEmail().toLowerCase());

// ---------- 화면에서 호출 ----------

function mailList(box) {
  const done = box === 'done';
  let hub = [], hubError = '';
  try { hub = mbxHub_('list', { box: done ? 'done' : 'inbox' }).threads.filter(t => t.source.key !== 'gmail'); }
  catch (e) { hubError = String(e.message || e); }
  const local = mbxLocalList_(done);
  const all = hub.concat(local).sort((a, b) => (a.date < b.date ? 1 : -1));
  if (hubError && all.length === 0) throw new Error(hubError);
  return all;
}

function mailThread(id) {
  return mbxIsLocal_(id) ? mbxLocalThread_(id) : mbxHub_('thread', { id }).thread;
}

function mailReply(id, body, by) {
  return mbxIsLocal_(id) ? mbxLocalReply_(id, body) : mbxHub_('reply', { id, body, by: by || '' }).thread;
}

function mailDone(id, undo) {
  return mbxIsLocal_(id) ? mbxLocalDone_(id, !undo) : mbxHub_('done', { id, undo: undo ? '1' : '' }).done;
}

// ---------- front@ 허브 ----------

function mbxHub_(op, params) {
  const props = PropertiesService.getScriptProperties();
  const url = props.getProperty('MAIL_HUB_URL');
  const token = props.getProperty('MAIL_HUB_TOKEN');
  if (!url || !token) throw new Error('front@ 메일함 연결 설정이 없습니다 (MAIL_HUB_URL / MAIL_HUB_TOKEN)');
  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    payload: Object.assign({ action: 'api', token, op }, params || {}),
    muteHttpExceptions: true,
  });
  let data;
  try { data = JSON.parse(res.getContentText()); }
  catch (e) { throw new Error('front@ 메일함 응답 오류 (' + res.getResponseCode() + ')'); }
  if (!data.ok) throw new Error(data.error || 'front@ 메일함 오류');
  return data;
}

// ---------- 이 계정 지메일 (직접) ----------

const MBX_GMAIL_SOURCE = { key: 'gmail', label: '지메일' };
const mbxIsLocal_ = id => String(id).indexOf('g:') === 0;
const mbxLocalId_ = id => String(id).slice(2);

function mbxLocalList_(done) {
  const q = done ? `label:${MBX_DONE_LABEL} newer_than:60d` : `in:inbox -category:promotions -category:social -label:${MBX_DONE_LABEL} newer_than:60d`;
  return GmailApp.search(q, 0, 60).map(t => {
    const msgs = t.getMessages();
    const last = msgs[msgs.length - 1];
    const lastIn = msgs.filter(m => !mbxMine_(m)).pop() || msgs[0];
    return {
      id: 'g:' + t.getId(),
      subject: t.getFirstMessageSubject() || '(제목 없음)',
      from: lastIn.getFrom(),
      date: last.getDate().toISOString(),
      snippet: mbxPlain_(last).slice(0, 140),
      unread: t.isUnread(),
      count: msgs.length,
      replied: mbxMine_(last),
      source: MBX_GMAIL_SOURCE,
    };
  });
}

function mbxLocalThread_(id) {
  const t = GmailApp.getThreadById(mbxLocalId_(id));
  if (!t) throw new Error('메일을 찾을 수 없습니다');
  t.markRead();
  return {
    id: 'g:' + t.getId(),
    subject: t.getFirstMessageSubject(),
    source: MBX_GMAIL_SOURCE,
    done: t.getLabels().some(l => l.getName() === MBX_DONE_LABEL),
    messages: t.getMessages().map(m => ({
      from: m.getFrom(), to: m.getTo(), date: m.getDate().toISOString(),
      mine: mbxMine_(m), body: mbxPlain_(m).slice(0, 20000),
      attachments: m.getAttachments().map(a => a.getName()),
    })),
  };
}

function mbxLocalReply_(id, body) {
  const text = String(body || '').trim();
  if (!text) throw new Error('답장 내용이 비어 있습니다');
  const t = GmailApp.getThreadById(mbxLocalId_(id));
  if (!t) throw new Error('메일을 찾을 수 없습니다');
  const msgs = t.getMessages();
  (msgs.filter(m => !mbxMine_(m)).pop() || msgs[msgs.length - 1]).reply(text, { name: '호텔 오션뷰 Hotel Ocean View' });
  return mbxLocalThread_(id);
}

function mbxLocalDone_(id, done) {
  const t = GmailApp.getThreadById(mbxLocalId_(id));
  if (!t) throw new Error('메일을 찾을 수 없습니다');
  const label = GmailApp.getUserLabelByName(MBX_DONE_LABEL) || GmailApp.createLabel(MBX_DONE_LABEL);
  if (done) { t.addLabel(label); t.markRead(); t.moveToArchive(); }
  else { t.removeLabel(label); t.moveToInbox(); }
  return done;
}

function mbxMine_(m) {
  return (m.getFrom() || '').toLowerCase().indexOf(mbxMe_()) >= 0;
}

function mbxPlain_(m) {
  const t = m.getPlainBody();
  return (t || m.getBody().replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ')).replace(/\n{3,}/g, '\n\n').trim();
}
