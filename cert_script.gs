// ===== 수료증 발급 (Apps Script) =====
// '출석' 시트의 수료대상(6회 이상)에게 HTML→PDF 수료증을 이메일로 발송.
// 테스트:  previewCertificate  → 본인 메일로 샘플 1장(디자인 확인)
// 실발급:  issueCertificates   → 수료대상 전원에게 발송
//
// ※ 아래 CERT 값만 고치면 내용/명의가 바뀝니다.

var CERT = {
  title: "수료증",
  org: "2026 호서대학교 벤처대학원",
  course: "AI 활용 8주완성 실전워크숍",
  period: "2026. 6. 13. ~ 8. 8. (8주)",
  issueDate: "2026년 8월 8일",
  issuer: "호서대학교 벤처대학원 원우회장",
  issuerName: "",              // 원우회장 성명(있으면 입력, 없으면 빈칸)
  numberPrefix: "HSAI-2026-",  // 발급번호 접두(빈 문자열이면 번호 미표시)
  sealImageUrl: ""             // 직인 이미지 URL(있으면 우측 하단 표시)
};

function certHtml_(name, number) {
  var seal = CERT.sealImageUrl
    ? '<img src="' + CERT.sealImageUrl + '" style="width:72px;height:72px;vertical-align:middle;margin-left:12px">'
    : '';
  var numHtml = number
    ? '<div style="position:absolute;top:18px;right:30px;font-size:13px;color:#555;letter-spacing:1px;">제 ' + number + ' 호</div>'
    : '';
  var issuerName = CERT.issuerName ? '&nbsp;&nbsp;' + CERT.issuerName : '';
  var FONT = "Gungsuh, GungsuhChe, '궁서', '궁서체', Batang, serif";
  // 코너 문양(❦) — 두꺼운 금색 테두리의 네 모서리
  function corner(pos) {
    return '<span style="position:absolute;' + pos + 'font-size:40px;line-height:1;color:#b8902f;">❦</span>';
  }
  return '' +
  '<div style="width:700px;margin:0 auto;padding:46px;box-sizing:border-box;font-family:' + FONT + ';font-weight:bold;">' +
  '  <div style="position:relative;border:8px solid #b8902f;padding:10px;">' +
         corner('top:-26px;left:-22px;') + corner('top:-26px;right:-22px;') +
         corner('bottom:-30px;left:-22px;') + corner('bottom:-30px;right:-22px;') +
  '    <div style="position:relative;border:2px solid #c9a85a;padding:46px 50px;">' +
           numHtml +
  '      <div style="text-align:center;font-size:48px;letter-spacing:26px;color:#1a1a1a;margin:26px 0 46px;padding-left:26px;">' + CERT.title + '</div>' +
  '      <table style="margin:0 auto 30px;font-size:19px;color:#222;line-height:2.4;border-collapse:collapse;">' +
  '        <tr><td style="padding-right:28px;color:#555;white-space:nowrap;">성&nbsp;&nbsp;&nbsp;&nbsp;명</td><td>' + name + '</td></tr>' +
  '        <tr><td style="padding-right:28px;color:#555;white-space:nowrap;">과 정 명</td><td>' + CERT.org + '<br>' + CERT.course + '</td></tr>' +
  '        <tr><td style="padding-right:28px;color:#555;white-space:nowrap;">교육기간</td><td>' + CERT.period + '</td></tr>' +
  '      </table>' +
  '      <div style="text-align:center;font-size:20px;color:#222;line-height:2;margin:40px 0 50px;">' +
  '        위 사람은 위 과정을 성실히 이수하였기에<br>이 증서를 수여합니다.' +
  '      </div>' +
  '      <div style="text-align:center;font-size:19px;color:#222;margin:34px 0;">' + CERT.issueDate + '</div>' +
  '      <div style="text-align:center;font-size:23px;color:#1a1a1a;margin-top:30px;">' +
           CERT.issuer + issuerName + seal +
  '      </div>' +
  '    </div>' +
  '  </div>' +
  '</div>';
}

function makeCertPdf_(name, number) {
  return Utilities.newBlob(certHtml_(name, number), "text/html", "cert.html")
    .getAs("application/pdf").setName(name + "_수료증.pdf");
}

// 디자인 미리보기 (본인 메일로 샘플 1장)
function previewCertificate() {
  var sample = CERT.numberPrefix ? CERT.numberPrefix + "000" : "";
  var pdf = makeCertPdf_("이수미", sample);
  var me = Session.getActiveUser().getEmail();
  MailApp.sendEmail({
    to: me, subject: "[수료증] 디자인 미리보기", name: "호서대 AI 워크숍",
    htmlBody: "수료증 미리보기 PDF를 첨부합니다. (실제 발급은 issueCertificates)",
    attachments: [pdf]
  });
  Logger.log("미리보기 발송: " + me);
}

// 실제 발급 (수료대상 전원)
function issueCertificates() {
  var att = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("출석");
  if (!att) throw new Error("'출석' 시트가 없습니다. 먼저 syncAttendance를 실행하세요.");
  var rows = att.getDataRange().getValues();
  var h = rows[0];
  var ni = h.indexOf("이름"), ei = h.indexOf("이메일"), pi = h.indexOf("수료대상");
  if (ni < 0 || ei < 0 || pi < 0) throw new Error("출석 시트 헤더(이름/이메일/수료대상)를 찾을 수 없습니다.");
  var n = 0;
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][pi]).trim() !== "수료") continue;
    var name = rows[i][ni], email = String(rows[i][ei]).trim();
    if (!email) continue;
    var number = CERT.numberPrefix ? CERT.numberPrefix + ("000" + (n + 1)).slice(-3) : "";
    MailApp.sendEmail({
      to: email,
      subject: "[호서대 AI 워크숍] 수료증 발급 안내",
      name: "호서대 AI 워크숍",
      htmlBody: "<p><b>" + name + "</b>님, 워크숍 수료를 진심으로 축하드립니다! 🎉<br>수료증을 첨부해 드립니다.</p>",
      attachments: [makeCertPdf_(name, number)]
    });
    n++;
  }
  Logger.log("수료증 발급 완료: " + n + "명");
}
