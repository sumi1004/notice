// ===== 워크숍 리마인드 자동 발송 (Apps Script) =====
// 8개 날짜 각 날 15:20에, 시트에 등록된 신청자 전원에게 "곧 시작" 알림 메일 발송.
// 사용법:
//   1) 이 코드를 notice2026의 Apps Script에 추가(새 파일 또는 기존 코드 아래에 붙여넣기)
//   2) 함수 드롭다운에서 setupReminderTriggers 선택 → 실행(▶) → 권한 승인  (※딱 1번)
//      → 8개 날짜에 자동 발송 예약이 등록됨 (트리거 ⏰ 메뉴에서 확인 가능)
//   3) 끝. 각 날짜 15:20에 sendReminders가 자동 실행되어 전원 발송.

// 날짜 → 회차 라벨 (필요하면 라벨/날짜 자유롭게 수정)
var WORKSHOP_DATES = {
  "2026-06-13": "1주차",
  "2026-06-20": "2주차",
  "2026-06-27": "3주차",
  "2026-07-11": "4주차",
  "2026-07-18": "5주차",
  "2026-07-25": "6주차",
  "2026-08-01": "7주차",
  "2026-08-08": "8주차"
};
var REMIND_HHMM = "15:20:00";  // 발송 시각(15:30 시작 10분 전)
var ZOOM_LINK = "https://us06web.zoom.us/j/84864599988?pwd=oUBPD7bEP0A39b10Ezw9ibbVFopeuS.1";

// ── 1회만 실행: 8개 날짜에 발송 예약 트리거 생성 ──
function setupReminderTriggers() {
  // 기존 sendReminders 트리거 정리(중복 방지)
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "sendReminders") ScriptApp.deleteTrigger(t);
  });
  var made = 0;
  Object.keys(WORKSHOP_DATES).forEach(function (dateStr) {
    var when = new Date(dateStr + "T" + REMIND_HHMM + "+09:00"); // KST
    if (when.getTime() > Date.now()) {           // 미래 날짜만 예약
      ScriptApp.newTrigger("sendReminders").timeBased().at(when).create();
      made++;
    }
  });
  Logger.log("예약된 발송 트리거: " + made + "개");
}

// ── 트리거가 각 날짜 15:20에 자동 실행 ──
function sendReminders() {
  var today = Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd");
  var week = WORKSHOP_DATES[today];
  if (!week) return;  // 오늘은 워크숍 날이 아니면 종료

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  var rows = sheet.getDataRange().getValues();  // [신청일시, 이름, 휴대폰, 이메일]
  var seen = {};
  var count = 0;
  for (var i = 1; i < rows.length; i++) {
    var name = rows[i][1];
    var email = String(rows[i][3] || "").trim();
    if (!email || seen[email]) continue;          // 빈값·중복 제외
    seen[email] = true;
    MailApp.sendEmail({
      to: email,
      subject: "[호서대 AI 워크숍] " + week + " 곧 시작합니다 (15:30)",
      name: "호서대 AI 워크숍",
      htmlBody: reminderHtml(name || "", week)
    });
    count++;
  }
  Logger.log(today + " " + week + " 리마인드 발송: " + count + "명");
}

function reminderHtml(name, week) {
  return '' +
  '<div style="margin:0;background:#f4f6fb;padding:24px;font-family:Malgun Gothic,Apple SD Gothic Neo,sans-serif">' +
  '  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 18px rgba(0,0,0,.06)">' +
  '    <div style="background:#1a3c7a;color:#fff;padding:22px 26px">' +
  '      <div style="font-size:12px;opacity:.8;letter-spacing:1px">호서대 2026 AI 활용 8주 완성 실전 워크숍 · ' + week + '</div>' +
  '      <div style="font-size:20px;font-weight:700;margin-top:6px">잠시 후 15:30 시작합니다 ⏰</div>' +
  '    </div>' +
  '    <div style="padding:26px">' +
  '      <p style="font-size:15px;color:#222"><b>' + name + '</b>님,</p>' +
  '      <p style="font-size:14px;color:#444;line-height:1.7">잠시 후 <b>15:30</b>, AI 활용 8주 완성 실전 워크숍 <b>(' + week + ')</b>이 시작됩니다.<br>정시에 입장해 주세요!</p>' +
  '      <p style="text-align:center;margin:24px 0">' +
  '        <a href="' + ZOOM_LINK + '" style="display:inline-block;background:#ffe14d;color:#1a1a1a;font-weight:700;text-decoration:none;padding:13px 26px;border-radius:10px;font-size:15px">▶ Zoom 라이브 입장하기</a>' +
  '      </p>' +
  '      <p style="font-size:12px;color:#888;line-height:1.6">버튼이 안 보이면 링크를 복사하세요:<br>' + ZOOM_LINK + '</p>' +
  '    </div>' +
  '  </div>' +
  '</div>';
}
