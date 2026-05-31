// 구글시트 Apps Script — 신청 데이터를 받아 ① 시트에 기록 ② 이메일 발송(MailApp)
// 시트 → 확장 프로그램 → Apps Script 에 이 코드를 전부 붙여넣고 저장 → 웹앱으로 배포.
// MailApp은 Google 서버에서 발송하므로 Railway의 SMTP 차단과 무관하게 메일이 나간다.

function doPost(e) {
  try {
    var d = JSON.parse(e.postData.contents);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];

    // 헤더 1회 생성
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(["신청일시", "이름", "휴대폰", "이메일"]);
    }
    var now = Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd HH:mm:ss");
    sheet.appendRow([now, d.name || "", d.phone || "", d.email || ""]);

    // 이메일 발송
    if (d.email) {
      MailApp.sendEmail({
        to: d.email,
        subject: "[호서대 2026 AI 워크숍] 신청이 완료되었습니다",
        name: "호서대 AI 워크숍",
        htmlBody: buildHtml(d.name || "", d.link || "", d.schedule || "", d.meetingId || "")
      });
    }

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function buildHtml(name, link, schedule, meetingId) {
  return '' +
  '<div style="margin:0;background:#f4f6fb;padding:24px;font-family:Malgun Gothic,Apple SD Gothic Neo,sans-serif">' +
  '  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 18px rgba(0,0,0,.06)">' +
  '    <div style="background:#1a3c7a;color:#fff;padding:22px 26px">' +
  '      <div style="font-size:12px;opacity:.8;letter-spacing:1px">호서대 2026 AI 활용 8주 완성 실전 워크숍</div>' +
  '      <div style="font-size:20px;font-weight:700;margin-top:6px">신청이 완료되었습니다 🎉</div>' +
  '    </div>' +
  '    <div style="padding:26px">' +
  '      <p style="font-size:15px;color:#222"><b>' + name + '</b>님, 안녕하세요.</p>' +
  '      <p style="font-size:14px;color:#444;line-height:1.7">아래 일정으로 진행되는 라이브에 입장하실 수 있습니다.</p>' +
  '      <div style="background:#f4f6fb;border-radius:10px;padding:16px 18px;margin:18px 0;font-size:13px;color:#333;line-height:2">' +
  '        <div>📅 <b>일시</b> &nbsp; ' + schedule + '</div>' +
  '        <div>💻 <b>방식</b> &nbsp; Zoom 온라인 라이브</div>' +
  '        <div>🔗 <b>회의 ID</b> &nbsp; ' + meetingId + '</div>' +
  '        <div>🔑 <b>입장</b> &nbsp; 아래 버튼 클릭 시 자동 입장(비밀번호 포함)</div>' +
  '      </div>' +
  '      <p style="text-align:center;margin:24px 0">' +
  '        <a href="' + link + '" style="display:inline-block;background:#ffe14d;color:#1a1a1a;font-weight:700;text-decoration:none;padding:13px 26px;border-radius:10px;font-size:15px">▶ Zoom 라이브 입장하기</a>' +
  '      </p>' +
  '      <p style="font-size:12px;color:#888;line-height:1.6">버튼이 안 보이면 링크를 복사하세요:<br>' + link + '</p>' +
  '      <hr style="border:none;border-top:1px solid #eee;margin:22px 0">' +
  '      <p style="font-size:12px;color:#999">본 메일은 워크숍 신청자에게 발송되는 정보성 안내입니다.</p>' +
  '    </div>' +
  '  </div>' +
  '</div>';
}
