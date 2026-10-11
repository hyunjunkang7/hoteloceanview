// ---------------- 📬 메일함 (front@ 메일 허브 연동) ----------------
// 스크립트 속성 MAIL_HUB_URL (front@ 메일 허브 웹앱 주소), MAIL_HUB_TOKEN (허브 setup() 로그의 토큰) 필요.

function mailHub_(op, params) {
  const props = PropertiesService.getScriptProperties();
  const url = props.getProperty('MAIL_HUB_URL');
  const token = props.getProperty('MAIL_HUB_TOKEN');
  if (!url || !token) throw new Error('메일함 설정이 안 되어 있습니다 (MAIL_HUB_URL / MAIL_HUB_TOKEN)');
  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    payload: Object.assign({ action: 'api', token: token, op: op }, params || {}),
    muteHttpExceptions: true,
  });
  let data;
  try { data = JSON.parse(res.getContentText()); } catch (e) { throw new Error('메일함 서버 응답 오류 (' + res.getResponseCode() + ')'); }
  if (!data.ok) throw new Error(data.error || '메일함 오류');
  return data;
}

function mailList(box) { return mailHub_('list', { box: box || 'inbox' }).threads; }
function mailThread(id) { return mailHub_('thread', { id: id }).thread; }
function mailReply(id, body, by) { return mailHub_('reply', { id: id, body: body, by: by || '' }).thread; }
function mailDone(id, undo) { return mailHub_('done', { id: id, undo: undo ? '1' : '' }).done; }
