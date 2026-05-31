// ===== Zoom 출석 연동 (Apps Script) =====
// 회차별 Zoom 참가자 리포트를 가져와 신청자 명단과 매칭 → '출석' 시트에 자동 체크.
//
// [사전 설정] Apps Script 좌측 ⚙️(프로젝트 설정) → "스크립트 속성"에 4개 추가:
//   ZOOM_ACCOUNT_ID   = Zoom 앱의 Account ID
//   ZOOM_CLIENT_ID    = Client ID
//   ZOOM_CLIENT_SECRET= Client Secret
//   ZOOM_MEETING_ID   = 84864599988   (줌 링크의 /j/ 뒤 숫자)
//   ※ 값은 채팅에 적지 말고 여기에만 입력.
//
// [테스트 순서]
//   1) testZoomAuth      → 토큰 발급 확인 ("✅ ...")
//   2) testListInstances → 과거 회차 목록 (지금은 비어있어도 정상, API 연결 확인)
//   3) (회차 후) syncAttendance → 출석 시트 자동 작성

var ATT_DATES = {
  "2026-06-13": "1주차", "2026-06-20": "2주차", "2026-06-27": "3주차",
  "2026-07-11": "4주차", "2026-07-18": "5주차", "2026-07-25": "6주차",
  "2026-08-01": "7주차", "2026-08-08": "8주차"
};
var ATT_THRESHOLD = 6;   // 수료 기준(회)
var MIN_MINUTES = 10;    // 최소 참석 인정 시간(분)

function zoomProp_(k) {
  var v = PropertiesService.getScriptProperties().getProperty(k);
  if (!v) throw new Error("스크립트 속성 누락: " + k + " (프로젝트 설정 → 스크립트 속성에 추가)");
  return v;
}

function getZoomToken_() {
  var accountId = zoomProp_("ZOOM_ACCOUNT_ID");
  var basic = Utilities.base64Encode(zoomProp_("ZOOM_CLIENT_ID") + ":" + zoomProp_("ZOOM_CLIENT_SECRET"));
  var res = UrlFetchApp.fetch(
    "https://zoom.us/oauth/token?grant_type=account_credentials&account_id=" + encodeURIComponent(accountId),
    { method: "post", headers: { Authorization: "Basic " + basic }, muteHttpExceptions: true });
  var data = JSON.parse(res.getContentText());
  if (!data.access_token) throw new Error("토큰 발급 실패: " + res.getContentText());
  return data.access_token;
}

function zoomGet_(path, token) {
  var res = UrlFetchApp.fetch("https://api.zoom.us/v2" + path, {
    method: "get", headers: { Authorization: "Bearer " + token }, muteHttpExceptions: true });
  return { code: res.getResponseCode(), body: res.getContentText() };
}

function encodeUuid_(uuid) {
  return (uuid.indexOf("/") >= 0)
    ? encodeURIComponent(encodeURIComponent(uuid))   // '/' 포함 시 이중 인코딩
    : encodeURIComponent(uuid);
}

function normName_(s) { return String(s || "").replace(/\s+/g, "").toLowerCase(); }

// ── 테스트 1: 토큰 ──
function testZoomAuth() {
  var t = getZoomToken_();
  Logger.log("✅ Zoom 토큰 발급 성공 (length " + t.length + ")");
}

// ── 테스트 2: 과거 회차 목록 ──
function testListInstances() {
  var token = getZoomToken_();
  var r = zoomGet_("/past_meetings/" + zoomProp_("ZOOM_MEETING_ID") + "/instances", token);
  Logger.log("HTTP " + r.code);
  Logger.log(r.body);
}

// ── 자동화: 각 회차 당일 20:00에 syncAttendance 예약 (1회만 실행) ──
function setupAttendanceTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "syncAttendance") ScriptApp.deleteTrigger(t);
  });
  var made = 0;
  Object.keys(ATT_DATES).forEach(function (d) {
    var when = new Date(d + "T20:00:00+09:00");   // 회차 끝나고 Zoom 리포트 준비된 뒤
    if (when.getTime() > Date.now()) {
      ScriptApp.newTrigger("syncAttendance").timeBased().at(when).create();
      made++;
    }
  });
  Logger.log("출석 동기화 트리거: " + made + "개");
}

// ── 메인: 출석 동기화 ──
function syncAttendance() {
  var token = getZoomToken_();
  var mid = zoomProp_("ZOOM_MEETING_ID");
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var appSheet = ss.getSheets()[0];                 // 신청 명단(첫 시트)
  var att = ss.getSheetByName("출석") || ss.insertSheet("출석");

  var weeks = Object.keys(ATT_DATES).sort();
  var header = ["이름", "이메일"].concat(weeks.map(function (d) { return ATT_DATES[d]; })).concat(["합계", "수료대상"]);

  // 신청자 명단(이름/이메일) 수집 (이메일 중복 제외)
  var appRows = appSheet.getDataRange().getValues();
  var roster = [], seen = {};
  for (var i = 1; i < appRows.length; i++) {
    var nm = String(appRows[i][1] || "").trim();
    var em = String(appRows[i][3] || "").trim().toLowerCase();
    if (!em || seen[em]) continue; seen[em] = true;
    roster.push({ name: nm, email: em });
  }
  var rowByEmail = {}, rowByName = {};
  var grid = roster.map(function (r, idx) {
    rowByEmail[r.email] = idx; rowByName[normName_(r.name)] = idx;
    return [r.name, r.email].concat(weeks.map(function () { return ""; })).concat(["", ""]);
  });

  // 과거 회차 → 회차별 참가자 → 매칭 → 체크
  var inst = JSON.parse(zoomGet_("/past_meetings/" + mid + "/instances", token).body);
  var instances = inst.meetings || [];
  instances.forEach(function (occ) {
    var dateKey = Utilities.formatDate(new Date(occ.start_time), "Asia/Seoul", "yyyy-MM-dd");
    var wIdx = weeks.indexOf(dateKey);
    if (wIdx < 0) return;                            // 워크숍 날짜 아님
    var pr = zoomGet_("/report/meetings/" + encodeUuid_(occ.uuid) + "/participants?page_size=300", token);
    if (pr.code !== 200) { Logger.log("참가자 조회 실패 " + dateKey + ": " + pr.body); return; }
    (JSON.parse(pr.body).participants || []).forEach(function (p) {
      if (Math.round((p.duration || 0) / 60) < MIN_MINUTES) return;   // 너무 짧게 입장한 경우 제외
      var em = String(p.user_email || "").trim().toLowerCase();
      var idx = (em && rowByEmail[em] !== undefined) ? rowByEmail[em] : rowByName[normName_(p.name || "")];
      if (idx === undefined) return;                 // 매칭 실패 → 수동 확인 대상
      grid[idx][2 + wIdx] = "O";
    });
  });

  // 합계 + 수료대상
  grid.forEach(function (row) {
    var cnt = 0; for (var w = 0; w < weeks.length; w++) if (row[2 + w] === "O") cnt++;
    row[2 + weeks.length] = cnt;
    row[2 + weeks.length + 1] = (cnt >= ATT_THRESHOLD) ? "수료" : "";
  });

  att.clearContents();
  att.appendRow(header);
  if (grid.length) att.getRange(2, 1, grid.length, header.length).setValues(grid);
  Logger.log("출석 동기화 완료: " + roster.length + "명 / 회차 " + instances.length + "개");
}
