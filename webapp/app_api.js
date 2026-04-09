const diseases = [];
const STORAGE_KEYS = {
  specialty: "rare-disease:last-specialty",
  excludeThreePlus: "rare-disease:exclude-three-plus",
  excludeTwoPlus: "rare-disease:exclude-two-plus",
  primaryOnly: "rare-disease:primary-only",
};

const state = {
  selectedDisease: null,
  specialtyDisclosureAccepted: false,
  expandedGlobalId: null,
  expandedSpecialtyId: null,
  addSpecialtyTargetId: null,
  currentSpecialty: "",
  hpoResults: [],
  selectedHpoTerms: [],
  hpoSearchTimer: null,
  adminPassword: "",
};

const els = {
  tabs: [...document.querySelectorAll(".tab")],
  panels: [...document.querySelectorAll(".panel")],
  diseaseCount: document.getElementById("disease-count"),
  selectedBadge: document.getElementById("selected-disease-badge"),
  globalSearchInput: document.getElementById("global-search-input"),
  globalResultMeta: document.getElementById("global-result-meta"),
  globalResults: document.getElementById("global-results"),
  specialtyFilter: document.getElementById("specialty-filter"),
  specialtySearchInput: document.getElementById("specialty-search-input"),
  excludeMultidisciplinaryCheckbox: document.getElementById("exclude-multidisciplinary-checkbox"),
  excludeRelatedTwoOrMoreCheckbox: document.getElementById("exclude-related-two-or-more-checkbox"),
  primaryOnlyCheckbox: document.getElementById("primary-only-checkbox"),
  specialtySummary: document.getElementById("specialty-summary"),
  specialtyResults: document.getElementById("specialty-results"),
  disclaimerModal: document.getElementById("specialty-disclaimer-modal"),
  acceptDisclaimerButton: document.getElementById("accept-disclaimer-button"),
  closeDisclaimerButton: document.getElementById("close-disclaimer-button"),
  openDisclaimerButton: document.getElementById("open-disclaimer-button"),
  addSpecialtyModal: document.getElementById("add-specialty-modal"),
  addSpecialtySelect: document.getElementById("add-specialty-select"),
  cancelAddSpecialtyButton: document.getElementById("cancel-add-specialty-button"),
  confirmAddSpecialtyButton: document.getElementById("confirm-add-specialty-button"),
  downloadPdfButton: document.getElementById("download-pdf-button"),
  referralForm: document.getElementById("referral-form"),
  hpoHiddenInput: document.getElementById("hpo-hidden-input"),
  hpoSelectedList: document.getElementById("hpo-selected-list"),
  openHpoModalButton: document.getElementById("open-hpo-modal-button"),
  openHpoHelpButton: document.getElementById("open-hpo-help-button"),
  clearHpoButton: document.getElementById("clear-hpo-button"),
  hpoModal: document.getElementById("hpo-modal"),
  hpoHelpModal: document.getElementById("hpo-help-modal"),
  hpoSearchInput: document.getElementById("hpo-search-input"),
  hpoResultMeta: document.getElementById("hpo-result-meta"),
  hpoResults: document.getElementById("hpo-results"),
  hpoManualInput: document.getElementById("hpo-manual-input"),
  addHpoManualButton: document.getElementById("add-hpo-manual-button"),
  closeHpoModalButton: document.getElementById("close-hpo-modal-button"),
  closeHpoHelpButton: document.getElementById("close-hpo-help-button"),
  suspectedDiseaseInput: document.getElementById("suspected-disease-input"),
  copyMailButton: document.getElementById("copy-mail-button"),
  copyMailFeedback: document.getElementById("copy-mail-feedback"),
};

let specialtyList = [];

const formFieldLabels = [
  ["registrationNumber", "등록번호"],
  ["sex", "성별"],
  ["birthDate", "생년월일"],
  ["hpo", "HPO"],
  ["suspectedDisease", "의심질환명"],
  ["clinicalFinding", "임상소견"],
  ["symptomOnset", "증상발현시기"],
  ["symptomDuration", "증상지속시간"],
  ["symptomFrequency", "증상발생빈도"],
  ["symptomDetail", "증상세부내용"],
  ["familyHistory", "가족력"],
  ["familyMember", "가족구성원"],
  ["geneticTestPerformed", "유전자검사시행여부"],
  ["testOpinion", "검사소견"],
  ["physicalExam", "신체검진"],
  ["imagingStudy", "영상의학검사"],
  ["histologyStudy", "조직학검사"],
  ["bloodStudy", "혈액검사"],
  ["geneticStudy", "유전자검사"],
  ["otherFunctionalStudy", "기타(기능검사)"],
  ["suspectedGene", "의심되는 원인 유전자"],
];

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizeDisease(disease) {
  const specialtySet = new Set(
    [disease.primarySpecialty, ...(disease.allSpecialties || [])]
      .filter((specialty) => specialty && specialty !== "미분류")
  );
  const unifiedSpecialties = [...specialtySet].sort((a, b) => a.localeCompare(b, "ko"));
  let primarySpecialty = disease.primarySpecialty;
  if (!primarySpecialty || primarySpecialty === "미분류") {
    primarySpecialty = unifiedSpecialties[0] || "미분류";
  } else if (!specialtySet.has(primarySpecialty) && primarySpecialty !== "미분류") {
    unifiedSpecialties.unshift(primarySpecialty);
  }
  return {
    ...disease,
    primarySpecialty,
    allSpecialties: unifiedSpecialties,
  };
}

function readBoolStorage(key) {
  return window.localStorage.getItem(key) === "true";
}

function persistSpecialtyPreferences() {
  window.localStorage.setItem(STORAGE_KEYS.specialty, state.currentSpecialty || "");
  window.localStorage.setItem(STORAGE_KEYS.excludeThreePlus, String(els.excludeMultidisciplinaryCheckbox.checked));
  window.localStorage.setItem(STORAGE_KEYS.excludeTwoPlus, String(els.excludeRelatedTwoOrMoreCheckbox.checked));
  window.localStorage.setItem(STORAGE_KEYS.primaryOnly, String(els.primaryOnlyCheckbox.checked));
}

function hydrateSpecialtyPreferences() {
  state.currentSpecialty = window.localStorage.getItem(STORAGE_KEYS.specialty) || "";
  els.excludeMultidisciplinaryCheckbox.checked = readBoolStorage(STORAGE_KEYS.excludeThreePlus);
  els.excludeRelatedTwoOrMoreCheckbox.checked = readBoolStorage(STORAGE_KEYS.excludeTwoPlus);
  els.primaryOnlyCheckbox.checked = readBoolStorage(STORAGE_KEYS.primaryOnly);
}

function searchText(disease) {
  return [
    disease.koreanName,
    disease.englishName,
    disease.kcd,
    disease.vcode,
    disease.primarySpecialty,
    disease.orphaName,
    disease.support,
    (disease.allSpecialties || []).join(" "),
  ].join(" ").toLowerCase();
}

async function apiFetchJson(url, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  const response = await fetch(url, {
    headers,
    ...options,
  });
  if (!response.ok) {
    const message = await response.text();
    const error = new Error(`API error: ${response.status}`);
    error.status = response.status;
    error.payload = message;
    throw error;
  }
  return response.json();
}

function requestAdminPassword(forceReset = false) {
  if (!forceReset && state.adminPassword) {
    return state.adminPassword;
  }
  const password = window.prompt("데이터베이스 수정을 위해 공통 비밀번호를 입력해 주세요.");
  if (!password) {
    return "";
  }
  state.adminPassword = password;
  return password;
}

async function apiFetchProtectedJson(url, options = {}, retry = true) {
  const password = requestAdminPassword(!retry);
  if (!password) {
    throw new Error("Password entry cancelled");
  }
  try {
    return await apiFetchJson(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        "X-Admin-Password": password,
      },
    });
  } catch (error) {
    if (error.status === 403 && retry) {
      state.adminPassword = "";
      window.alert("비밀번호가 올바르지 않습니다. 다시 입력해 주세요.");
      return apiFetchProtectedJson(url, options, false);
    }
    throw error;
  }
}

async function loadDiseases() {
  const data = await apiFetchJson("/api/diseases");
  diseases.splice(0, diseases.length, ...data.items.map(normalizeDisease));
}

async function loadSpecialties() {
  const data = await apiFetchJson("/api/specialties");
  specialtyList = data.items.slice().sort((a, b) => a.localeCompare(b, "ko"));
}

async function loadInitialData() {
  await Promise.all([loadDiseases(), loadSpecialties()]);
  els.diseaseCount.textContent = diseases.length.toLocaleString("ko-KR");
  renderGlobalResults();
  renderSpecialtyFilter();
  renderSpecialtyResults();
}

function upsertDisease(updatedDisease) {
  const normalized = normalizeDisease(updatedDisease);
  const index = diseases.findIndex((item) => item.id === normalized.id);
  if (index >= 0) {
    diseases[index] = normalized;
  } else {
    diseases.push(normalized);
  }
}

function setActiveTab(target) {
  els.tabs.forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.tabTarget === target);
  });
  els.panels.forEach((panel) => {
    panel.classList.toggle("is-active", panel.id === `tab-${target}`);
  });
  if (target === "specialty" && !state.specialtyDisclosureAccepted) {
    showDisclaimer();
  }
}

function setFormEnabled(enabled) {
  els.referralForm.classList.toggle("is-disabled", !enabled);
  els.downloadPdfButton.disabled = !enabled;
}

function selectDisease(diseaseId) {
  const disease = diseases.find((item) => item.id === diseaseId);
  if (!disease) return;
  state.selectedDisease = disease;
  els.selectedBadge.textContent = `${disease.koreanName} 선택됨`;
  els.downloadPdfButton.disabled = false;
  els.suspectedDiseaseInput.value = disease.koreanName;
  setFormEnabled(true);
  setActiveTab("form");
}

function detailCard(disease) {
  const sourceLabel = disease.classificationSource.startsWith("manual_primary_whitelist")
    ? "수동분류"
    : disease.classificationSource
      ? "Orphanet"
      : "-";
  const specialties = disease.allSpecialties || [];
  const chipMarkup = specialties.length
    ? specialties.map((specialty) => `
        <span class="chip-wrap">
          <button class="chip ${specialty === disease.primarySpecialty ? "chip-primary" : ""}" type="button" data-make-primary="${escapeHtml(disease.id)}::${escapeHtml(specialty)}">
            ${escapeHtml(specialty)}
          </button>
          ${specialty !== disease.primarySpecialty ? `<button class="chip-close chip-close-floating" type="button" data-remove-related="${escapeHtml(disease.id)}::${escapeHtml(specialty)}" aria-label="${escapeHtml(specialty)} 제외">×</button>` : ""}
        </span>
      `).join("")
    : `<span class="chip">과 목록 없음</span>`;

  return `
    <div class="expanded-card">
      <div class="detail-grid">
        <div class="detail-item">
          <strong>지원 구분</strong>
          <span>${escapeHtml(disease.support || "-")}</span>
        </div>
        <div class="detail-item">
          <strong>분류 출처</strong>
          <span>${escapeHtml(sourceLabel)}</span>
        </div>
        <div class="detail-item">
          <strong>주진료과</strong>
          <span>${escapeHtml(disease.primarySpecialty || "미분류")}</span>
        </div>
        <div class="detail-item">
          <strong>ORPHA 정보</strong>
          <span>${escapeHtml(disease.orphaCode ? `${disease.orphaCode} / ${disease.orphaName}` : "-")}</span>
        </div>
        <div class="detail-item">
          <strong>과 목록</strong>
          <div class="chip-row">${chipMarkup}</div>
          <div class="detail-actions">
            <button class="chip chip-add" type="button" data-open-add-modal="${escapeHtml(disease.id)}">+ 추가</button>
          </div>
        </div>
      </div>
      <div class="detail-actions">
        <button class="primary-button" type="button" data-select-id="${disease.id}">의뢰서 작성</button>
      </div>
    </div>
  `;
}

function globalRowsMarkup(filtered) {
  return filtered.slice(0, 250).map((disease) => {
    const isExpanded = state.expandedGlobalId === disease.id;
    return `
      <tr class="data-row" data-expand-global="${disease.id}">
        <td><strong>${escapeHtml(disease.koreanName)}</strong></td>
        <td>${escapeHtml(disease.englishName || "-")}</td>
        <td>${escapeHtml(disease.kcd || "-")}</td>
        <td>${escapeHtml(disease.vcode || "-")}</td>
        <td>${escapeHtml(disease.primarySpecialty || "미분류")}</td>
      </tr>
      ${isExpanded ? `<tr class="expanded-row"><td colspan="5">${detailCard(disease)}</td></tr>` : ""}
    `;
  }).join("");
}

function specialtyRowsMarkup(filtered) {
  return filtered.map((disease) => {
    const isExpanded = state.expandedSpecialtyId === disease.id;
    return `
      <tr class="data-row" data-expand-specialty="${disease.id}">
        <td><strong>${escapeHtml(disease.koreanName)}</strong></td>
        <td>${escapeHtml(disease.englishName || "-")}</td>
        <td>${escapeHtml(disease.kcd || "-")}</td>
        <td>${escapeHtml(disease.vcode || "-")}</td>
        <td>${escapeHtml(disease.primarySpecialty || "미분류")}</td>
      </tr>
      ${isExpanded ? `<tr class="expanded-row"><td colspan="5">${detailCard(disease)}</td></tr>` : ""}
    `;
  }).join("");
}

function renderGlobalResults() {
  const query = els.globalSearchInput.value.trim().toLowerCase();
  const filtered = diseases.filter((disease) => !query || searchText(disease).includes(query));
  els.globalResultMeta.textContent = `${filtered.length.toLocaleString("ko-KR")}건 검색됨`;
  els.globalResults.innerHTML = globalRowsMarkup(filtered);
}

function renderSpecialtyFilter() {
  const previous = state.currentSpecialty || els.specialtyFilter.value;
  els.specialtyFilter.innerHTML = specialtyList
    .map((specialty) => `<option value="${escapeHtml(specialty)}">${escapeHtml(specialty)}</option>`)
    .join("");
  const nextValue = specialtyList.includes(previous) ? previous : (specialtyList[0] || "");
  els.specialtyFilter.value = nextValue;
  state.currentSpecialty = nextValue;
}

function getCurrentSpecialty() {
  return state.currentSpecialty || els.specialtyFilter.value || specialtyList[0] || "";
}

function getFilteredSpecialtyDiseases() {
  const specialty = getCurrentSpecialty();
  const query = els.specialtySearchInput.value.trim().toLowerCase();
  const excludeThreePlus = Boolean(els.excludeMultidisciplinaryCheckbox.checked);
  const excludeTwoPlus = Boolean(els.excludeRelatedTwoOrMoreCheckbox.checked);
  const primaryOnly = Boolean(els.primaryOnlyCheckbox.checked);

  return diseases.filter((disease) => {
    const allSpecialties = Array.isArray(disease.allSpecialties) ? disease.allSpecialties : [];
    const relatedSpecialties = allSpecialties.filter((item) => item !== disease.primarySpecialty);
    const relatedCount = relatedSpecialties.length;
    const matchesSpecialty = specialty ? allSpecialties.includes(specialty) : true;
    const matchesQuery = !query || searchText(disease).includes(query);
    const passesThreePlus = !excludeThreePlus || relatedCount < 3;
    const passesTwoPlus = !excludeTwoPlus || relatedCount < 2;
    const passesPrimaryOnly = !primaryOnly || disease.primarySpecialty === specialty;
    return matchesSpecialty && matchesQuery && passesThreePlus && passesTwoPlus && passesPrimaryOnly;
  });
}

function renderSpecialtyResults() {
  const specialty = getCurrentSpecialty();
  els.specialtyFilter.value = specialty;
  state.currentSpecialty = specialty;
  persistSpecialtyPreferences();
  const filtered = getFilteredSpecialtyDiseases();
  els.specialtySummary.textContent = specialty
    ? `${specialty} 관련 질환 ${filtered.length.toLocaleString("ko-KR")}건`
    : `${filtered.length.toLocaleString("ko-KR")}건`;
  els.specialtyResults.innerHTML = specialtyRowsMarkup(filtered);
}

function showDisclaimer() {
  els.disclaimerModal.classList.add("is-visible");
}

function hideDisclaimer() {
  els.disclaimerModal.classList.remove("is-visible");
}

function showAddSpecialtyModal(diseaseId) {
  const disease = diseases.find((item) => item.id === diseaseId);
  if (!disease) return;
  const available = specialtyList.filter((specialty) => !(disease.allSpecialties || []).includes(specialty));
  els.addSpecialtySelect.innerHTML = available.length
    ? available.map((specialty) => `<option value="${escapeHtml(specialty)}">${escapeHtml(specialty)}</option>`).join("")
    : `<option value="">추가 가능한 과 없음</option>`;
  state.addSpecialtyTargetId = diseaseId;
  els.addSpecialtyModal.classList.add("is-visible");
}

function hideAddSpecialtyModal() {
  state.addSpecialtyTargetId = null;
  els.addSpecialtyModal.classList.remove("is-visible");
}

function copyMailAddress() {
  navigator.clipboard.writeText("kdh6830@naver.com").then(() => {
    els.copyMailFeedback.textContent = "메일 주소를 클립보드에 복사했습니다.";
    window.setTimeout(() => {
      els.copyMailFeedback.textContent = "";
    }, 2000);
  });
}

function getFormValues() {
  const values = Object.fromEntries(new FormData(els.referralForm).entries());
  values.sex = values.sex || "";
  values.geneticTestPerformed = values.geneticTestPerformed || "";
  values.hpo = els.hpoHiddenInput.value || "";
  return values;
}

function syncHpoHiddenInput() {
  els.hpoHiddenInput.value = state.selectedHpoTerms
    .map((item) => item.id ? `${item.id} ${item.name}` : item.name)
    .join("; ");
}

function renderSelectedHpoTerms() {
  if (!state.selectedHpoTerms.length) {
    els.hpoSelectedList.innerHTML = `<span class="hpo-placeholder">선택된 HPO가 없습니다.</span>`;
    syncHpoHiddenInput();
    return;
  }
  els.hpoSelectedList.innerHTML = state.selectedHpoTerms.map((item, index) => `
    <span class="chip hpo-chip">
      ${escapeHtml(item.id ? `${item.id} ${item.name}` : item.name)}
      <button type="button" data-remove-hpo="${index}" aria-label="HPO 제거">×</button>
    </span>
  `).join("");
  syncHpoHiddenInput();
}

function openHpoModal() {
  els.hpoModal.classList.add("is-visible");
  els.hpoSearchInput.focus();
}

function closeHpoModal() {
  els.hpoModal.classList.remove("is-visible");
}

function openHpoHelpModal() {
  els.hpoHelpModal.classList.add("is-visible");
}

function closeHpoHelpModal() {
  els.hpoHelpModal.classList.remove("is-visible");
}

function renderHpoResults() {
  if (!state.hpoResults.length) {
    els.hpoResults.innerHTML = `<div class="detail-item">검색 결과가 없습니다.</div>`;
    return;
  }
  els.hpoResults.innerHTML = state.hpoResults.map((item) => `
    <div class="hpo-result-item">
      <div class="hpo-result-head">
        <div>
          <div class="hpo-result-code">${escapeHtml(item.id || "-")}</div>
          <div class="hpo-result-name">${escapeHtml(item.name || "")}</div>
        </div>
        <button class="primary-button" type="button" data-add-hpo="${escapeHtml(item.id || item.name)}">선택</button>
      </div>
      ${item.definition ? `<div class="hpo-result-definition">${escapeHtml(item.definition)}</div>` : ""}
    </div>
  `).join("");
}

async function searchHpoTerms() {
  const query = els.hpoSearchInput.value.trim();
  if (query.length < 2) {
    state.hpoResults = [];
    els.hpoResultMeta.textContent = "두 글자 이상 입력하면 HPO 검색 결과가 표시됩니다.";
    els.hpoResults.innerHTML = "";
    return;
  }
  els.hpoResultMeta.textContent = "검색 중...";
  try {
    const url = `https://clinicaltables.nlm.nih.gov/api/hpo/v3/search?terms=${encodeURIComponent(query)}&count=20&df=id,name&ef=definition`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HPO API error: ${response.status}`);
    }
    const payload = await response.json();
    const total = payload[0] || 0;
    const ids = payload[1] || [];
    const extras = payload[2] || {};
    const displays = payload[3] || [];
    state.hpoResults = ids.map((id, index) => ({
      id,
      name: Array.isArray(displays[index]) ? (displays[index][1] || displays[index][0] || "") : String(displays[index] || ""),
      definition: Array.isArray(extras.definition) ? (extras.definition[index] || "") : "",
    }));
    els.hpoResultMeta.textContent = `${total.toLocaleString("ko-KR")}건 중 최대 20건 표시`;
    renderHpoResults();
  } catch (error) {
    console.error(error);
    state.hpoResults = [];
    els.hpoResultMeta.textContent = "HPO 검색 서비스를 불러오지 못했습니다. 직접 입력을 이용해 주세요.";
    els.hpoResults.innerHTML = "";
  }
}

function addHpoTerm(term) {
  const key = term.id ? `${term.id} ${term.name}` : term.name;
  const exists = state.selectedHpoTerms.some((item) => (item.id ? `${item.id} ${item.name}` : item.name) === key);
  if (exists) return;
  state.selectedHpoTerms.push(term);
  renderSelectedHpoTerms();
}

function addHpoTermFromResult(key) {
  const term = state.hpoResults.find((item) => (item.id || item.name) === key);
  if (!term) return;
  addHpoTerm(term);
}

function addManualHpoTerm() {
  const raw = els.hpoManualInput.value.trim();
  if (!raw) return;
  const match = raw.match(/^(HP:\d+)\s+(.+)$/i);
  if (match) {
    addHpoTerm({ id: match[1].toUpperCase(), name: match[2].trim() });
  } else {
    addHpoTerm({ id: "", name: raw });
  }
  els.hpoManualInput.value = "";
}

function checkedMark(current, expected) {
  return current === expected ? "■" : "□";
}

function buildPrintableReferralHtml(values, diseaseName) {
  const text = (value) => escapeHtml(value || "");
  const titleImageUrl = `${window.location.origin}/title-image.png`;
  return `<!DOCTYPE html>
  <html lang="ko">
  <head>
    <meta charset="UTF-8">
    <title>의뢰서_${text(diseaseName)}</title>
    <style>
      body { font-family: "Malgun Gothic", sans-serif; margin: 0; background: #f3f3f3; color: #111; }
      .toolbar { position: sticky; top: 0; z-index: 10; display:flex; justify-content:center; gap:10px; padding: 12px; background: rgba(243,243,243,0.94); border-bottom: 1px solid #ddd; }
      .toolbar button { border: 1px solid #bbb; background: #fff; padding: 10px 16px; border-radius: 999px; font: inherit; cursor: pointer; }
      .page { width: 210mm; min-height: 297mm; margin: 14px auto; background: #fff; padding: 14mm 10mm 12mm; box-sizing: border-box; box-shadow: 0 6px 24px rgba(0,0,0,0.08); }
      .header { margin-bottom: 10px; }
      .header img { display:block; width: 100%; max-width: 100%; height: auto; }
      table { width:100%; border-collapse: collapse; table-layout: fixed; }
      col.label { width: 12%; }
      col.value { width: 21.333%; }
      th, td { border: 1px solid #111; padding: 6px 8px; font-size: 10.5pt; vertical-align: top; line-height: 1.45; }
      th { text-align:center; font-weight:700; white-space: normal; overflow-wrap: anywhere; word-break: break-word; }
      td { white-space: normal; overflow-wrap: anywhere; word-break: break-word; }
      .center { text-align:center; }
      .tall { height: 32mm; }
      .mid { height: 22mm; }
      .exam { height: 20mm; }
      .radio { display:flex; gap:16px; justify-content:center; align-items:center; flex-wrap: wrap; }
      @media print {
        body { background: #fff; }
        .toolbar { display: none; }
        .page { margin: 0; width: auto; min-height: auto; padding: 0; box-shadow: none; }
      }
    </style>
  </head>
  <body>
    <div class="toolbar">
      <button type="button" onclick="window.print()">인쇄 / PDF 저장</button>
      <button type="button" onclick="window.close()">닫기</button>
    </div>
    <div class="page">
      <div class="header">
        <img src="${titleImageUrl}" alt="부산권 희귀질환 전문기관 타이틀">
      </div>
      <table>
        <colgroup>
          <col class="label"><col class="value"><col class="label"><col class="value"><col class="label"><col class="value">
        </colgroup>
        <tr>
          <th>등록번호</th><td>${text(values.registrationNumber)}</td>
          <th>성별</th><td class="center"><div class="radio"><span>${checkedMark(values.sex, "남")} 남</span><span>${checkedMark(values.sex, "여")} 여</span></div></td>
          <th>생년월일</th><td>${text(values.birthDate)}</td>
        </tr>
        <tr><th>HPO</th><td colspan="5">${text(values.hpo)}</td></tr>
        <tr><th>의심질환명</th><td colspan="5">${text(values.suspectedDisease)}</td></tr>
        <tr><th class="mid">임상소견</th><td colspan="5" class="mid">${text(values.clinicalFinding).replace(/\n/g, "<br>")}</td></tr>
        <tr>
          <th>증상발현시기</th><td>${text(values.symptomOnset)}</td>
          <th>증상지속시간</th><td>${text(values.symptomDuration)}</td>
          <th>증상발생빈도</th><td>${text(values.symptomFrequency)}</td>
        </tr>
        <tr><th class="tall">증상세부내용</th><td colspan="5" class="tall">${text(values.symptomDetail).replace(/\n/g, "<br>")}</td></tr>
        <tr>
          <th class="mid">가족력</th><td class="mid">${text(values.familyHistory).replace(/\n/g, "<br>")}</td>
          <th class="mid">가족구성원</th><td class="mid">${text(values.familyMember).replace(/\n/g, "<br>")}</td>
          <th>유전자검사시행여부</th><td class="center">
            <div class="radio"><span>${checkedMark(values.geneticTestPerformed, "유")} 유</span><span>${checkedMark(values.geneticTestPerformed, "무")} 무</span></div>
            <div style="margin-top:6px; border-top:1px solid #111; padding-top:6px; text-align:left;">${text(values.geneticTestPerformedNote)}</div>
          </td>
        </tr>
        <tr>
          <th rowspan="6">검사소견</th>
          <th>신체검진</th><td colspan="4" class="exam">${text(values.physicalExam).replace(/\n/g, "<br>")}</td>
        </tr>
        <tr><th>영상의학검사</th><td colspan="4" class="exam">${text(values.imagingStudy).replace(/\n/g, "<br>")}</td></tr>
        <tr><th>조직학검사</th><td colspan="4" class="exam">${text(values.histologyStudy).replace(/\n/g, "<br>")}</td></tr>
        <tr><th>혈액검사</th><td colspan="4" class="exam">${text(values.bloodStudy).replace(/\n/g, "<br>")}</td></tr>
        <tr><th>유전자검사</th><td colspan="4" class="exam">${text(values.geneticStudy).replace(/\n/g, "<br>")}</td></tr>
        <tr><th>기타(기능검사)</th><td colspan="4" class="exam">${text(values.otherFunctionalStudy).replace(/\n/g, "<br>")}</td></tr>
        <tr><th class="tall">의심되는 원인 유전자</th><td colspan="5" class="tall">${text(values.suspectedGene).replace(/\n/g, "<br>")}</td></tr>
      </table>
    </div>
  </body>
  </html>`;
}

function downloadReferralPdf() {
  if (!state.selectedDisease) return;
  const values = getFormValues();
  const html = buildPrintableReferralHtml(values, state.selectedDisease.koreanName);
  const printWindow = window.open("", "_blank", "width=1100,height=900");
  if (!printWindow) {
    window.alert("출력 창을 열 수 없습니다. 팝업 차단을 확인해 주세요.");
    return;
  }
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  window.setTimeout(() => {
    try {
      printWindow.focus();
    } catch (error) {
      console.error(error);
    }
  }, 200);
}

function rerenderAllViews() {
  renderSpecialtyFilter();
  renderGlobalResults();
  renderSpecialtyResults();
  els.diseaseCount.textContent = diseases.length.toLocaleString("ko-KR");
  if (state.selectedDisease) {
    const updated = diseases.find((item) => item.id === state.selectedDisease.id);
    if (updated) {
      state.selectedDisease = updated;
      els.selectedBadge.textContent = `${updated.koreanName} 선택됨`;
      els.suspectedDiseaseInput.value = updated.koreanName;
    }
  }
}

async function handleRelatedSpecialtyRequest(action, diseaseId, specialty) {
  if (action === "remove") {
    if (!window.confirm(`"${specialty}"를 관련과에서 제외 요청하시겠습니까?`)) return;
    const updated = await apiFetchProtectedJson("/api/mutations", {
      method: "POST",
      body: JSON.stringify({ action: "removeSpecialty", diseaseId, specialty }),
    });
    upsertDisease(updated);
    await loadSpecialties();
    rerenderAllViews();
    return;
  }
  if (action === "add") {
    if (!window.confirm(`"${specialty}"를 관련과에 추가 요청하시겠습니까?`)) return;
    const updated = await apiFetchProtectedJson("/api/mutations", {
      method: "POST",
      body: JSON.stringify({ action: "addSpecialty", diseaseId, specialty }),
    });
    upsertDisease(updated);
    await loadSpecialties();
    rerenderAllViews();
  }
}

async function changePrimarySpecialty(diseaseId, specialty) {
  if (!window.confirm(`주진료과를 "${specialty}"로 변경하시겠습니까?`)) return;
  const updated = await apiFetchProtectedJson("/api/mutations", {
    method: "POST",
    body: JSON.stringify({ action: "setPrimary", diseaseId, specialty }),
  });
  upsertDisease(updated);
  await loadSpecialties();
  rerenderAllViews();
}

async function confirmAddSpecialtyFromModal() {
  const diseaseId = state.addSpecialtyTargetId;
  const specialty = els.addSpecialtySelect.value;
  if (!diseaseId || !specialty) {
    hideAddSpecialtyModal();
    return;
  }
  await handleRelatedSpecialtyRequest("add", diseaseId, specialty);
  hideAddSpecialtyModal();
}

function bindEvents() {
  els.tabs.forEach((tab) => tab.addEventListener("click", () => setActiveTab(tab.dataset.tabTarget)));
  els.globalSearchInput.addEventListener("input", renderGlobalResults);
  els.specialtyFilter.addEventListener("change", () => {
    state.currentSpecialty = els.specialtyFilter.value;
    persistSpecialtyPreferences();
    renderSpecialtyResults();
  });
  els.specialtySearchInput.addEventListener("input", renderSpecialtyResults);
  els.excludeMultidisciplinaryCheckbox.addEventListener("change", renderSpecialtyResults);
  els.excludeRelatedTwoOrMoreCheckbox.addEventListener("change", renderSpecialtyResults);
  els.primaryOnlyCheckbox.addEventListener("change", renderSpecialtyResults);

  document.body.addEventListener("click", (event) => {
    const selectId = event.target.getAttribute("data-select-id");
    if (selectId) {
      event.stopPropagation();
      selectDisease(selectId);
      return;
    }
    const removeRelated = event.target.getAttribute("data-remove-related");
    if (removeRelated) {
      event.stopPropagation();
      const [diseaseId, specialty] = removeRelated.split("::");
      handleRelatedSpecialtyRequest("remove", diseaseId, specialty).catch(console.error);
      return;
    }
    const makePrimary = event.target.getAttribute("data-make-primary");
    if (makePrimary) {
      event.stopPropagation();
      const [diseaseId, specialty] = makePrimary.split("::");
      changePrimarySpecialty(diseaseId, specialty).catch(console.error);
      return;
    }
    const openAddModal = event.target.getAttribute("data-open-add-modal");
    if (openAddModal) {
      event.stopPropagation();
      showAddSpecialtyModal(openAddModal);
      return;
    }
    const addHpo = event.target.getAttribute("data-add-hpo");
    if (addHpo) {
      event.stopPropagation();
      addHpoTermFromResult(addHpo);
      return;
    }
    const removeHpo = event.target.getAttribute("data-remove-hpo");
    if (removeHpo) {
      event.stopPropagation();
      state.selectedHpoTerms.splice(Number(removeHpo), 1);
      renderSelectedHpoTerms();
      return;
    }
    const globalExpandId = event.target.closest("[data-expand-global]")?.getAttribute("data-expand-global");
    if (globalExpandId) {
      state.expandedGlobalId = state.expandedGlobalId === globalExpandId ? null : globalExpandId;
      renderGlobalResults();
      return;
    }
    const specialtyExpandId = event.target.closest("[data-expand-specialty]")?.getAttribute("data-expand-specialty");
    if (specialtyExpandId) {
      state.expandedSpecialtyId = state.expandedSpecialtyId === specialtyExpandId ? null : specialtyExpandId;
      renderSpecialtyResults();
    }
  });

  els.acceptDisclaimerButton.addEventListener("click", () => {
    state.specialtyDisclosureAccepted = true;
    hideDisclaimer();
  });
  if (els.closeDisclaimerButton) {
    els.closeDisclaimerButton.addEventListener("click", () => {
      setActiveTab("guide");
      hideDisclaimer();
    });
  }
  els.openDisclaimerButton.addEventListener("click", showDisclaimer);
  els.cancelAddSpecialtyButton.addEventListener("click", hideAddSpecialtyModal);
  els.confirmAddSpecialtyButton.addEventListener("click", () => confirmAddSpecialtyFromModal().catch(console.error));
  els.openHpoModalButton.addEventListener("click", openHpoModal);
  els.openHpoHelpButton.addEventListener("click", openHpoHelpModal);
  els.closeHpoModalButton.addEventListener("click", closeHpoModal);
  els.closeHpoHelpButton.addEventListener("click", closeHpoHelpModal);
  els.clearHpoButton.addEventListener("click", () => {
    state.selectedHpoTerms = [];
    renderSelectedHpoTerms();
  });
  els.hpoSearchInput.addEventListener("input", () => {
    if (state.hpoSearchTimer) {
      window.clearTimeout(state.hpoSearchTimer);
    }
    state.hpoSearchTimer = window.setTimeout(() => {
      searchHpoTerms().catch(console.error);
    }, 250);
  });
  els.addHpoManualButton.addEventListener("click", addManualHpoTerm);
  els.hpoManualInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addManualHpoTerm();
    }
  });
  els.downloadPdfButton.addEventListener("click", downloadReferralPdf);
  els.copyMailButton.addEventListener("click", copyMailAddress);

  els.hpoModal.addEventListener("click", (event) => {
    if (event.target === els.hpoModal) {
      closeHpoModal();
    }
  });

  els.hpoHelpModal.addEventListener("click", (event) => {
    if (event.target === els.hpoHelpModal) {
      closeHpoHelpModal();
    }
  });

  els.addSpecialtyModal.addEventListener("click", (event) => {
    if (event.target === els.addSpecialtyModal) {
      hideAddSpecialtyModal();
    }
  });
}

function init() {
  hydrateSpecialtyPreferences();
  bindEvents();
  setFormEnabled(false);
  renderSelectedHpoTerms();
  els.diseaseCount.textContent = "…";
  els.globalResultMeta.textContent = "데이터를 불러오는 중입니다.";
  els.specialtySummary.textContent = "데이터를 불러오는 중입니다.";
  loadInitialData().catch((error) => {
    console.error(error);
    window.alert("데이터를 불러오지 못했습니다. 서버 또는 환경설정을 확인해 주세요.");
  });
}

init();
