/**
 * 호텔 오션뷰 메일 허브 (front@hoteloceanview.co.kr 계정의 Apps Script 웹앱)
 *
 * 1) 홈페이지 예약 양식 → '예약문의' 시트 기록 + front@ 로 알림 메일 (누구나 POST 가능, 받기만 함)
 * 2) PMS(호텔 pms) 메일함 API → front@ 받은편지함 목록/읽기/답장/처리완료
 *    action=api + token 이 맞을 때만 동작. 토큰은 setup() 실행 시 스크립트 속성 HUB_TOKEN 에 생성됨.
 *
 * 메일 출처 구분: hotelov@hanmail.net / koreahotelov@gmail.com 에서 front@ 로 자동전달된 메일은
 * 원래 받는 사람(To/Cc) 주소로 구분하고, 홈페이지 문의는 제목 머리말로 구분.
 *
 * 설치: 배포 > 새 배포 > 웹 앱 (실행: 나 / 액세스: 모든 사용자)
 *       → URL 을 홈페이지 site/config.js 의 reservationEndpoint, PMS 스크립트 속성 MAIL_HUB_URL 에 넣기.
 */
const NOTIFY_TO = 'front@hoteloceanview.co.kr';
const WEB_SUBJECT_PREFIX = '[홈페이지 예약문의]';
const DONE_LABEL = '처리완료';
const HOLD_LABEL = '보류';
const SOURCES = [
  { key: 'hanmail', label: '한메일', match: 'hotelov@hanmail.net' },
  { key: 'gmail', label: '지메일', match: 'koreahotelov@gmail.com' },
];
const HEADERS = ['접수시각', '체크인', '체크아웃', '객실', '객실수', '인원', '성함', '연락처', '이메일', '요청사항', '언어', '처리상태'];

function doPost(e) {
  const p = (e && e.parameter) || {};
  if (p.action === 'api') return api_(p);
  return webForm_(p);
}

function doGet() {
  return ContentService.createTextOutput('Hotel Ocean View mail hub is running.');
}

// 처음 한 번 편집기에서 실행: 권한 승인 + 시트/라벨/토큰 생성. 실행 로그에 토큰이 표시됨.
function setup() {
  getSheet_();
  doneLabel_();
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('HUB_TOKEN')) props.setProperty('HUB_TOKEN', Utilities.getUuid() + Utilities.getUuid());
  Logger.log('HUB_TOKEN = ' + props.getProperty('HUB_TOKEN'));
}

// ---------------- 1) 홈페이지 예약 양식 ----------------

function webForm_(p) {
  if (p.website) return json_({ ok: true }); // honeypot: bots fill hidden field

  const clean = v => String(v || '').slice(0, 1000).replace(/^[=+\-@]/, "'$&"); // block spreadsheet formula injection
  const row = [
    new Date(), clean(p.checkin), clean(p.checkout), clean(p.roomLabel || p.room), clean(p.rooms),
    clean(p.guests), clean(p.name), clean(p.phone), clean(p.email), clean(p.message), clean(p.lang), '신규',
  ];

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    getSheet_().appendRow(row);
  } finally {
    lock.releaseLock();
  }

  const subject = `${WEB_SUBJECT_PREFIX} ${row[6]} / ${row[1]} ~ ${row[2]} / ${row[3]}`;
  const body = HEADERS.slice(1, 11).map((h, i) => `${h}: ${row[i + 1] || '-'}`).join('\n');
  const options = { name: 'Hotel Ocean View 홈페이지' };
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(p.email || '')) options.replyTo = p.email;
  MailApp.sendEmail(NOTIFY_TO, subject, body, options);
  return json_({ ok: true });
}

function getSheet_() {
  const ss = SpreadsheetApp.getActive();
  let sheet = ss.getSheetByName('예약문의');
  if (!sheet) {
    sheet = ss.insertSheet('예약문의');
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold').setBackground('#efe6d6');
  }
  return sheet;
}

// ---------------- 2) PMS 메일함 API ----------------

function api_(p) {
  const token = PropertiesService.getScriptProperties().getProperty('HUB_TOKEN');
  if (!token || p.token !== token) return json_({ ok: false, error: 'unauthorized' });
  try {
    switch (p.op) {
      case 'list': return json_({ ok: true, threads: listThreads_(p.box) });
      case 'count': return json_({ ok: true, count: GmailApp.search('is:unread ' + inboxQuery_(), 0, 99).length });
      case 'thread': return json_({ ok: true, thread: getThread_(p.id) });
      case 'reply': return json_({ ok: true, thread: reply_(p.id, p.body, p.by, p.html, p.files) });
      case 'done': return json_({ ok: true, done: setLabel_(p.id, DONE_LABEL, p.undo !== '1') });
      case 'hold': return json_({ ok: true, hold: setLabel_(p.id, HOLD_LABEL, p.undo !== '1') });
      case 'trash': return json_({ ok: true, trashed: trash_(p.id) });
      default: return json_({ ok: false, error: 'unknown op' });
    }
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

function inboxQuery_() {
  // 보류 중이라도 손님이 새로 메일하면(안 읽음) 받은 메일에 다시 보임
  return `in:inbox -label:${DONE_LABEL} {-label:${HOLD_LABEL} is:unread} newer_than:60d`;
}

function listThreads_(box) {
  const q = box === 'done' ? `label:${DONE_LABEL} newer_than:60d`
    : box === 'hold' ? `label:${HOLD_LABEL} -label:${DONE_LABEL} newer_than:90d`
    : inboxQuery_();
  const threads = GmailApp.search(q, 0, 40);
  if (!threads.length) return [];
  const all = GmailApp.getMessagesForThreads(threads); // 한 번에 읽어서 빠르게
  const holdIds = {};
  if (box !== 'hold' && box !== 'done') GmailApp.search(`label:${HOLD_LABEL} is:unread`, 0, 50).forEach(t => { holdIds[t.getId()] = 1; });
  return threads.map((t, i) => {
    const msgs = all[i];
    const first = msgs[0], last = msgs[msgs.length - 1];
    const lastIn = msgs.filter(m => !isFromUs_(m)).pop() || first;
    return {
      id: t.getId(),
      subject: t.getFirstMessageSubject() || '(제목 없음)',
      from: displayFrom_(lastIn),
      date: last.getDate().toISOString(),
      snippet: plain_(last).slice(0, 140),
      unread: t.isUnread(),
      count: msgs.length,
      replied: isFromUs_(last),
      hold: box === 'hold' || !!holdIds[t.getId()],
      source: sourceOf_(first),
    };
  });
}

function getThread_(id) {
  const t = GmailApp.getThreadById(id);
  if (!t) throw new Error('메일을 찾을 수 없습니다');
  t.markRead();
  const msgs = t.getMessages();
  return {
    id: t.getId(),
    subject: t.getFirstMessageSubject(),
    source: sourceOf_(msgs[0]),
    done: t.getLabels().some(l => l.getName() === DONE_LABEL),
    hold: t.getLabels().some(l => l.getName() === HOLD_LABEL),
    messages: msgs.map(m => ({
      from: m.getFrom(), to: m.getTo(), date: m.getDate().toISOString(),
      mine: isFromUs_(m), body: plain_(m).slice(0, 20000),
      attachments: m.getAttachments().map(a => a.getName()),
    })),
  };
}

function reply_(id, body, by, html, filesJson) {
  const t = GmailApp.getThreadById(id);
  if (!t) throw new Error('메일을 찾을 수 없습니다');
  const text = String(body || '').trim();
  if (!text) throw new Error('답장 내용이 비어 있습니다');
  const msgs = t.getMessages();
  const target = msgs.filter(m => !isFromUs_(m)).pop() || msgs[msgs.length - 1];
  if (sourceOf_(msgs[0]).key === 'web' && !target.getReplyTo()) {
    throw new Error('손님이 이메일을 남기지 않은 문의입니다. 연락처로 전화/문자 해주세요.');
  }
  const files = filesJson ? JSON.parse(filesJson) : [];
  const attachments = files.map(f => Utilities.newBlob(Utilities.base64Decode(f.data), f.mime || 'application/octet-stream', f.name || 'file'));
  const opts = { name: 'Hotel Ocean View', attachments };
  if (html) opts.htmlBody = html;
  target.reply(text, opts);
  if (by) Logger.log(`reply by ${by}: ${id}`);
  return getThread_(id);
}

// 휴지통으로 이동 (Gmail 휴지통에서 30일 안에 복구 가능)
function trash_(id) {
  const t = GmailApp.getThreadById(id);
  if (!t) throw new Error('메일을 찾을 수 없습니다');
  t.moveToTrash();
  return true;
}

function setLabel_(id, name, on) {
  const t = GmailApp.getThreadById(id);
  if (!t) throw new Error('메일을 찾을 수 없습니다');
  const label = GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
  if (on) {
    t.addLabel(label); t.markRead();
    if (name === DONE_LABEL) { t.moveToArchive(); const h = GmailApp.getUserLabelByName(HOLD_LABEL); if (h) t.removeLabel(h); }
  } else {
    t.removeLabel(label);
    if (name === DONE_LABEL) t.moveToInbox();
  }
  return on;
}

function sourceOf_(m) {
  if ((m.getSubject() || '').indexOf(WEB_SUBJECT_PREFIX) === 0) return { key: 'web', label: '홈페이지' };
  const rcpt = [m.getTo(), m.getCc(), m.getHeader('Delivered-To'), m.getHeader('X-Forwarded-To'), m.getHeader('X-Original-To')]
    .join(' ').toLowerCase();
  const s = SOURCES.find(x => rcpt.indexOf(x.match) >= 0);
  return s ? { key: s.key, label: s.label } : { key: 'front', label: 'front@' };
}

function isFromUs_(m) {
  return (m.getFrom() || '').toLowerCase().indexOf(NOTIFY_TO) >= 0 && (m.getSubject() || '').indexOf(WEB_SUBJECT_PREFIX) !== 0;
}

function displayFrom_(m) {
  const f = m.getFrom() || '';
  const replyTo = m.getReplyTo();
  if ((m.getSubject() || '').indexOf(WEB_SUBJECT_PREFIX) === 0 && replyTo) return replyTo;
  return f;
}

function plain_(m) {
  const t = m.getPlainBody();
  return (t || m.getBody().replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ')).replace(/\n{3,}/g, '\n\n').trim();
}

function doneLabel_() {
  return GmailApp.getUserLabelByName(DONE_LABEL) || GmailApp.createLabel(DONE_LABEL);
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
