/**
 * 📬 메일함 — 여러 메일함을 PMS 한 화면에 모음
 *  - 지메일(koreahotelov@gmail.com): 이 스크립트 계정의 Gmail 을 직접 읽음 (id 앞에 'g:')
 *  - front@hoteloceanview.co.kr (+ 홈페이지 문의, 한메일 자동전달): front@ 메일 허브 웹앱 경유
 * 상자: inbox(받은 메일) / hold(보류 — 손님이 다시 메일하면 자동으로 받은 메일로) / done(처리완료)
 * 답장: 호텔 서명(로고) 자동 첨부 + 파일 첨부 가능
 * 스크립트 속성: MAIL_HUB_URL, MAIL_HUB_TOKEN (허브 설정이 없으면 지메일만 표시)
 * 화면: Mailbox.html (doGet 에서 Index 뒤에 붙임)
 */
const MBX_DONE_LABEL = '처리완료';
const MBX_HOLD_LABEL = '보류';
const MBX_MAX_ATTACH_MB = 20;
let MBX_ME_ = null; // 이 스크립트를 실행하는 계정 (메일함을 쓸 때만 조회)
const mbxMe_ = () => MBX_ME_ || (MBX_ME_ = Session.getEffectiveUser().getEmail().toLowerCase());

const MBX_SIGNATURE_TEXT = [
  '', '--', '호텔 오션뷰 Hotel Ocean View',
  '울산광역시 동구 해수욕장1길 50 · 50 Haesuyokjang 1-gil, Dong-gu, Ulsan, Korea',
  'T. +82-52-235-7777 · front@hoteloceanview.co.kr',
  'www.hoteloceanview.co.kr',
].join('\n');

const MBX_SIGNATURE_HTML =
  '<table cellpadding="0" cellspacing="0" border="0" style="margin-top:22px;border-top:1px solid #e5e7eb;padding-top:14px;font-family:Arial,\'Malgun Gothic\',sans-serif">' +
  '<tr><td style="padding:14px 16px 0 0;vertical-align:top">' +
  '<a href="https://www.hoteloceanview.co.kr"><img src="https://www.hoteloceanview.co.kr/images/email-logo.png" width="176" height="48" alt="Hotel Ocean View" style="display:block;border:0;border-radius:6px"></a></td>' +
  '<td style="padding-top:12px;vertical-align:top;font-size:12px;line-height:1.65;color:#4b5563">' +
  '<div style="font-size:14px;font-weight:bold;color:#12263a">호텔 오션뷰 &nbsp;Hotel Ocean View</div>' +
  '<div>울산광역시 동구 해수욕장1길 50 · 50 Haesuyokjang 1-gil, Dong-gu, Ulsan, Korea</div>' +
  '<div>T. +82-52-235-7777 · <a href="mailto:front@hoteloceanview.co.kr" style="color:#3f7d97;text-decoration:none">front@hoteloceanview.co.kr</a></div>' +
  '<div><a href="https://www.hoteloceanview.co.kr" style="color:#3f7d97;text-decoration:none">www.hoteloceanview.co.kr</a>' +
  ' &nbsp;<span style="color:#b8925a">HD현대중공업 · 미포 · 해양 차량 10분</span></div>' +
  '</td></tr></table>';

// ---------- 화면에서 호출 ----------

function mailList(box) {
  box = ['inbox', 'hold', 'done'].indexOf(box) >= 0 ? box : 'inbox';
  let hub = [], hubError = '';
  try { hub = mbxHub_('list', { box }).threads.filter(t => t.source.key !== 'gmail'); }
  catch (e) { hubError = String(e.message || e); }
  const local = mbxLocalList_(box);
  const all = hub.concat(local).sort((a, b) => (a.date < b.date ? 1 : -1));
  if (hubError && all.length === 0) throw new Error(hubError);
  return all;
}

function mailThread(id) {
  return mbxIsLocal_(id) ? mbxLocalThread_(id) : mbxHub_('thread', { id }).thread;
}

/** files: [{ name, mime, data(base64) }] */
function mailReply(id, body, by, files) {
  const text = String(body || '').trim();
  if (!text) throw new Error('답장 내용이 비어 있습니다');
  files = files || [];
  const totalMb = files.reduce((s, f) => s + String(f.data || '').length * 0.75, 0) / 1048576;
  if (totalMb > MBX_MAX_ATTACH_MB) throw new Error(`첨부 파일이 너무 큽니다 (${totalMb.toFixed(1)}MB / 최대 ${MBX_MAX_ATTACH_MB}MB)`);
  const plain = text + '\n' + MBX_SIGNATURE_TEXT;
  const html = '<div style="font-family:Arial,\'Malgun Gothic\',sans-serif;font-size:14px;line-height:1.6;color:#111827">' +
    mbxEsc_(text).replace(/\n/g, '<br>') + '</div>' + MBX_SIGNATURE_HTML;
  if (mbxIsLocal_(id)) return mbxLocalReply_(id, plain, html, files);
  return mbxHub_('reply', { id, body: plain, html, by: by || '', files: JSON.stringify(files) }).thread;
}

function mailDone(id, undo) {
  return mbxIsLocal_(id) ? mbxLocalLabel_(id, MBX_DONE_LABEL, !undo) : mbxHub_('done', { id, undo: undo ? '1' : '' }).done;
}

/** 휴지통으로 이동 (Gmail 휴지통에서 30일 안에 복구 가능) */
function mailTrash(id) {
  if (!mbxIsLocal_(id)) return mbxHub_('trash', { id }).trashed;
  const t = GmailApp.getThreadById(mbxLocalId_(id));
  if (!t) throw new Error('메일을 찾을 수 없습니다');
  t.moveToTrash();
  return true;
}

function mailHold(id, undo) {
  return mbxIsLocal_(id) ? mbxLocalLabel_(id, MBX_HOLD_LABEL, !undo) : mbxHub_('hold', { id, undo: undo ? '1' : '' }).hold;
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

function mbxQuery_(box) {
  if (box === 'done') return `label:${MBX_DONE_LABEL} newer_than:60d`;
  if (box === 'hold') return `label:${MBX_HOLD_LABEL} -label:${MBX_DONE_LABEL} newer_than:90d`;
  // 보류 중이라도 손님이 새로 메일하면(안 읽음) 받은 메일에 다시 보임
  return `in:inbox -category:promotions -category:social -label:${MBX_DONE_LABEL} {-label:${MBX_HOLD_LABEL} is:unread} newer_than:60d`;
}

function mbxLocalList_(box) {
  return GmailApp.search(mbxQuery_(box), 0, 60).map(t => {
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
      hold: t.getLabels().some(l => l.getName() === MBX_HOLD_LABEL),
      source: MBX_GMAIL_SOURCE,
    };
  });
}

function mbxLocalThread_(id) {
  const t = GmailApp.getThreadById(mbxLocalId_(id));
  if (!t) throw new Error('메일을 찾을 수 없습니다');
  t.markRead();
  const labels = t.getLabels().map(l => l.getName());
  return {
    id: 'g:' + t.getId(),
    subject: t.getFirstMessageSubject(),
    source: MBX_GMAIL_SOURCE,
    done: labels.indexOf(MBX_DONE_LABEL) >= 0,
    hold: labels.indexOf(MBX_HOLD_LABEL) >= 0,
    messages: t.getMessages().map(m => ({
      from: m.getFrom(), to: m.getTo(), date: m.getDate().toISOString(),
      mine: mbxMine_(m), body: mbxPlain_(m).slice(0, 20000),
      attachments: m.getAttachments().map(a => a.getName()),
    })),
  };
}

function mbxLocalReply_(id, plain, html, files) {
  const t = GmailApp.getThreadById(mbxLocalId_(id));
  if (!t) throw new Error('메일을 찾을 수 없습니다');
  const msgs = t.getMessages();
  const target = msgs.filter(m => !mbxMine_(m)).pop() || msgs[msgs.length - 1];
  target.reply(plain, { name: '호텔 오션뷰 Hotel Ocean View', htmlBody: html, attachments: mbxBlobs_(files) });
  return mbxLocalThread_(id);
}

function mbxLocalLabel_(id, name, on) {
  const t = GmailApp.getThreadById(mbxLocalId_(id));
  if (!t) throw new Error('메일을 찾을 수 없습니다');
  const label = GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
  if (on) {
    t.addLabel(label); t.markRead();
    if (name === MBX_DONE_LABEL) { t.moveToArchive(); const h = GmailApp.getUserLabelByName(MBX_HOLD_LABEL); if (h) t.removeLabel(h); }
  } else {
    t.removeLabel(label);
    if (name === MBX_DONE_LABEL) t.moveToInbox();
  }
  return on;
}

function mbxBlobs_(files) {
  return (files || []).map(f => Utilities.newBlob(Utilities.base64Decode(f.data), f.mime || 'application/octet-stream', f.name || 'file'));
}

function mbxMine_(m) {
  return (m.getFrom() || '').toLowerCase().indexOf(mbxMe_()) >= 0;
}

function mbxPlain_(m) {
  const t = m.getPlainBody();
  return (t || m.getBody().replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ')).replace(/\n{3,}/g, '\n\n').trim();
}

function mbxEsc_(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
