// ===== 사전 설문 구글폼 자동 생성 (Apps Script / FormApp) =====
// 실행: buildPreSurvey 1회 → 구글폼 + 응답 스프레드시트 자동 생성.
//   실행 로그에 [폼 링크]·[응답시트 링크]가 출력됨.
// 척도: 5점 리커트. 요인별 그리드(행=문항코드). 응답시트 열에 코드가 들어가 SPSS 매핑 쉬움.

var LIKERT_COLS = ["1", "2", "3", "4", "5"];
var LIKERT_LEGEND = "1=전혀 그렇지 않다  2=그렇지 않다  3=보통이다  4=그렇다  5=매우 그렇다";
// 폼 상단 배너 이미지(가로형 권장). 다른 이미지로 바꾸려면 공개 이미지 URL로 교체.
var BANNER_URL = "https://raw.githubusercontent.com/sumi1004/notice/main/banner.png";

var FACTORS = [
  { title: "Ⅱ. 논문작성 자기효능감", rows: [
    "RSE1. 나는 연구주제를 스스로 설정할 수 있다.",
    "RSE2. 나는 선행연구를 찾아 체계적으로 정리할 수 있다.",
    "RSE3. 나는 논문 형식(체계)에 맞게 글을 작성할 수 있다.",
    "RSE4. 나는 연구결과를 논리적으로 서술할 수 있다." ] },
  { title: "Ⅲ. AI 활용 자기효능감", rows: [
    "ASE1. 나는 AI 도구의 기본 기능을 다룰 수 있다.",
    "ASE2. 나는 새로운 AI 도구도 스스로 익혀 사용할 수 있다.",
    "ASE3. 나는 AI에 적절한 질문(프롬프트)을 작성할 수 있다.",
    "ASE4. 나는 AI를 논문작성 과정에 적용할 자신이 있다." ] },
  { title: "Ⅳ. 인지된 유용성", rows: [
    "PU1. AI를 활용하면 논문작성 시간이 단축될 것이다.",
    "PU2. AI는 자료 조사·정리에 도움이 될 것이다.",
    "PU3. AI는 글쓰기·교정의 질을 높여줄 것이다.",
    "PU4. AI 활용은 내 연구역량 향상에 유용할 것이다." ] },
  { title: "Ⅴ. 인지된 용이성", rows: [
    "PE1. AI 도구는 사용하기 쉬울 것 같다.",
    "PE2. AI 도구 사용법을 배우는 것은 어렵지 않을 것이다.",
    "PE3. 나는 AI 도구를 큰 어려움 없이 쓸 수 있을 것이다.",
    "PE4. AI 도구의 조작은 명확하고 이해하기 쉬울 것이다." ] },
  { title: "Ⅵ. AI 신뢰·연구윤리 인식", rows: [
    "TE1. 나는 AI가 생성한 내용을 검증 없이 신뢰하지 않는다.",
    "TE2. 나는 AI 활용 시 표절·인용 문제를 주의해야 한다고 생각한다.",
    "TE3. AI 활용 결과는 반드시 사람이 확인·수정해야 한다.",
    "TE4. 나는 연구윤리를 지키며 AI를 활용할 수 있다." ] },
  { title: "Ⅶ. AI·논문작성 불안 (역코딩 문항)", rows: [
    "AX1. AI 도구를 사용할 때 실수할까 봐 걱정된다.",
    "AX2. AI 기술은 나에게 부담스럽게 느껴진다.",
    "AX3. 논문작성 자체가 막막하고 두렵다.",
    "AX4. AI를 잘 활용하지 못할까 봐 불안하다." ] },
  { title: "Ⅷ. 학습동기·기대", rows: [
    "MO1. 나는 이 워크숍을 통해 AI 활용 역량을 키우고 싶다.",
    "MO2. 나는 AI 학습에 적극적으로 참여할 의향이 있다.",
    "MO3. 이 워크숍이 내 논문 완성에 도움이 될 것으로 기대한다.",
    "MO4. 나는 AI를 활용한 연구방법을 더 배우고 싶다." ] },
  { title: "Ⅸ. 활용의도", rows: [
    "BI1. 나는 앞으로 논문작성에 AI를 적극 활용할 것이다.",
    "BI2. 나는 배운 AI 활용법을 실제 연구에 적용할 것이다.",
    "BI3. 나는 동료에게도 AI 활용을 권할 의향이 있다.",
    "BI4. 나는 향후에도 AI 도구를 지속적으로 사용할 것이다." ] }
];

function buildPreSurvey() {
  var form = FormApp.create("[호서대 벤처대학원] 2026 AI 활용 논문작성법 사전 설문");
  form.setDescription(
    "안녕하세요. 「2026 AI 활용 논문작성법」 워크숍에 참여해 주셔서 진심으로 감사합니다.\n\n" +
    "본 사전 설문은 두 가지 목적으로 활용됩니다.\n" +
    "① 수강생 여러분의 현재 수준과 요구를 파악하여, 첫 시간부터 수업 내용을 맞춤형으로 설계하는 데 사용합니다.\n" +
    "② 수업 중 '연구방법·통계분석' 실습에서 여러분이 직접 분석·해석하는 실제 연구 데이터로 사용됩니다. (내 응답이 곧 실습 자료가 됩니다)\n\n" +
    "정답이 없는 문항이므로, 평소 생각대로 솔직하게 응답해 주시면 됩니다. " +
    "응답 내용은 연구·교육 목적 외에는 사용되지 않으며, 개인을 식별하지 않는 통계 형태로만 처리됩니다.\n\n" +
    "▸ 소요 시간: 약 7~10분\n" +
    "▸ 리커트 척도 안내: " + LIKERT_LEGEND);
  form.setProgressBar(true);
  form.setCollectEmail(false);

  // ── 상단 배너 이미지 ──
  try {
    var banner = UrlFetchApp.fetch(BANNER_URL).getBlob();
    form.addImageItem().setImage(banner).setTitle("2026 AI 활용 논문작성법 워크숍");
  } catch (e) {
    Logger.log("배너 이미지 로드 실패(무시하고 진행): " + e);
  }

  // ── Part 1. 일반 사항 ──
  form.addSectionHeaderItem().setTitle("Ⅰ. 일반 사항");
  form.addTextItem().setTitle("성명").setRequired(true);
  form.addTextItem().setTitle("이메일").setRequired(true);
  form.addTextItem().setTitle("소속/학과").setRequired(true);
  form.addMultipleChoiceItem().setTitle("학위과정").setRequired(true)
    .setChoiceValues(["석사과정", "석사수료", "박사과정", "박사수료", "기타"]);
  form.addMultipleChoiceItem().setTitle("연령대").setRequired(true)
    .setChoiceValues(["20대", "30대", "40대", "50대 이상"]);
  form.addMultipleChoiceItem().setTitle("논문 작성 경험").setRequired(true)
    .setChoiceValues(["없음", "1편", "2~3편", "4편 이상"]);
  form.addMultipleChoiceItem().setTitle("통계분석 경험").setRequired(true)
    .setChoiceValues(["전혀 없음", "조금 있음", "보통", "많음"]);
  form.addCheckboxItem().setTitle("주로 사용하는 AI 도구 (복수 선택 가능)")
    .setChoiceValues(["ChatGPT", "Claude", "Gemini", "Copilot", "노트북LM(NotebookLM)", "이미지 생성(미드저니 등)", "기타", "없음"]);

  // ── Part 2. 리커트 요인 (요인별 그리드) ──
  FACTORS.forEach(function (f) {
    form.addSectionHeaderItem().setTitle(f.title).setHelpText(LIKERT_LEGEND);
    form.addGridItem()
      .setTitle(f.title.replace(/^[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]+\.\s*/, ""))
      .setRows(f.rows)
      .setColumns(LIKERT_COLS)
      .setRequired(true);
  });

  // ── Part 3. 주관식 ──
  form.addSectionHeaderItem().setTitle("Ⅹ. 주관식");
  form.addParagraphTextItem().setTitle("O1. 이 워크숍에서 가장 배우고 싶은 것은 무엇인가요?").setRequired(true);
  form.addParagraphTextItem().setTitle("O2. 현재 논문작성 또는 AI 활용에서 가장 어려운 점은 무엇인가요?").setRequired(true);
  form.addParagraphTextItem().setTitle("O3. 워크숍에 바라는 점이 있다면 자유롭게 적어주세요. (선택)");

  // ── 개인정보 수집·이용 동의 (맨 마지막) ──
  form.addSectionHeaderItem().setTitle("Ⅺ. 개인정보 수집·이용 동의");
  form.addMultipleChoiceItem()
    .setTitle("개인정보 수집·이용에 동의하시나요? (미동의 시 설문 참여가 제한됩니다)")
    .setHelpText(
      "▸ 수집 항목: 이름, 이메일, 소속(학과/기관)\n" +
      "▸ 수집·이용 목적: 워크숍 사전 진단, 수업 실습(데이터 분석) 자료, 워크숍 안내 및 자료 전달\n" +
      "▸ 보유·이용 기간: 워크숍 종료 후 1년까지 보관 후 파기\n" +
      "▸ 동의를 거부할 권리가 있으나, 미동의 시 설문 참여 및 워크숍 안내가 제한될 수 있습니다.")
    .setChoiceValues(["네, 동의합니다"])
    .setRequired(true);

  // ── 응답 스프레드시트 생성·연결 ──
  var ss = SpreadsheetApp.create("사전설문_응답_2026AI논문작성법");
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());

  Logger.log("✅ 설문 생성 완료");
  Logger.log("■ 응답(공유) 링크: " + form.getPublishedUrl());
  Logger.log("■ 편집 링크: " + form.getEditUrl());
  Logger.log("■ 응답 스프레드시트: " + ss.getUrl());
}
