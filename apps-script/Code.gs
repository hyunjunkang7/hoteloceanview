/**
 * 호텔 오션뷰 홈페이지 예약 문의 수신기 (Google Apps Script 웹앱)
 *
 * 하는 일: 홈페이지 예약 양식 → 이 스크립트가 연결된 구글 시트에 한 줄 기록 + front@ 로 알림 메일.
 * 설치: front@hoteloceanview.co.kr 로 로그인 → 새 구글 시트 만들기 → 확장 프로그램 > Apps Script
 *       → 이 파일 내용 붙여넣기 → 배포 > 새 배포 > 유형: 웹 앱
 *       (실행: 나, 액세스: 모든 사용자) → 웹앱 URL 을 site/config.js 의 reservationEndpoint 에 넣기.
 */
const NOTIFY_TO = 'front@hoteloceanview.co.kr';
const HEADERS = ['접수시각', '체크인', '체크아웃', '객실', '객실수', '인원', '성함', '연락처', '이메일', '요청사항', '언어', '처리상태'];

function doPost(e) {
  const p = (e && e.parameter) || {};
  if (p.website) return ok_(); // honeypot: bots fill hidden field

  const clean = v => String(v || '').slice(0, 1000).replace(/^[=+\-@]/, "'$&"); // block spreadsheet formula injection
  const row = [
    new Date(), clean(p.checkin), clean(p.checkout), clean(p.roomLabel || p.room), clean(p.rooms),
    clean(p.guests), clean(p.name), clean(p.phone), clean(p.email), clean(p.message), clean(p.lang), '신규',
  ];

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getSheet_();
    sheet.appendRow(row);
  } finally {
    lock.releaseLock();
  }

  const subject = `[홈페이지 예약문의] ${row[6]} / ${row[1]} ~ ${row[2]} / ${row[3]}`;
  const body = HEADERS.slice(1, 11).map((h, i) => `${h}: ${row[i + 1] || '-'}`).join('\n');
  const options = { name: '호텔 오션뷰 홈페이지' };
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(p.email || '')) options.replyTo = p.email;
  MailApp.sendEmail(NOTIFY_TO, subject, body + '\n\n— 예약 장부: ' + SpreadsheetApp.getActive().getUrl(), options);

  return ok_();
}

function doGet() {
  return ContentService.createTextOutput('Hotel Ocean View reservation endpoint is running.');
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

function ok_() {
  return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
}
