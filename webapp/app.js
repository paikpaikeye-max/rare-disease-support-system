const diseases = [];

const state = {
  selectedDisease: null,
  specialtyDisclosureAccepted: false,
  expandedGlobalId: null,
  expandedSpecialtyId: null,
  addSpecialtyTargetId: null,
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
  activateFormButton: document.getElementById("activate-form-button"),
  downloadPdfButton: document.getElementById("download-pdf-button"),
  referralForm: document.getElementById("referral-form"),
  suspectedDiseaseInput: document.getElementById("suspected-disease-input"),
  requestNote: document.getElementById("request-note"),
  copyRequestButton: document.getElementById("copy-request-button"),
  copyRequestFeedback: document.getElementById("copy-request-feedback"),
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

function searchText(disease) {
  return [
    disease.koreanName,
    disease.englishName,
    disease.kcd,
    disease.vcode,
    disease.primarySpecialty,
    disease.orphaName,
    disease.support,
  ].join(" ").toLowerCase();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
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
  els.activateFormButton.disabled = false;
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
  const specialties = (disease.allSpecialties || []);
  const chipMarkup = specialties.length
    ? specialties.map((specialty) => `
        <span class="chip-wrap">
          <button class="chip ${specialty === disease.primarySpecialty ? "chip-primary" : ""}" type="button" data-make-primary="${escapeHtml(disease.id)}::${escapeHtml(specialty)}">
            ${escapeHtml(specialty)}
          </button>
          ${specialty !== disease.primarySpecialty ? `<button class="chip-close chip-close-floating" type="button" data-remove-related="${escapeHtml(disease.id)}::${escapeHtml(specialty)}" aria-label="${escapeHtml(specialty)} 제외 요청">×</button>` : ""}
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
          <strong>주진료과</strong>
          <span>${escapeHtml(disease.primarySpecialty || "미분류")}</span>
        </div>
        <div class="detail-item">
          <strong>ORPHA 정보</strong>
          <span>${escapeHtml(disease.orphaCode ? `${disease.orphaCode} / ${disease.orphaName}` : "-")}</span>
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
          <strong>과 목록</strong>
          <div class="chip-row">
            ${chipMarkup}
          </div>
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
  const filtered = diseases.filter((disease) => {
    return !query || searchText(disease).includes(query);
  });
  els.globalResultMeta.textContent = `${filtered.length.toLocaleString("ko-KR")}건 검색됨`;
  els.globalResults.innerHTML = globalRowsMarkup(filtered);
}

function renderSpecialtyFilter() {
  els.specialtyFilter.innerHTML = specialtyList
    .map((specialty) => `<option value="${escapeHtml(specialty)}">${escapeHtml(specialty)}</option>`)
    .join("");
}

function renderSpecialtyResults() {
  const specialty = els.specialtyFilter.value;
  const query = els.specialtySearchInput.value.trim().toLowerCase();
  const excludeMultidisciplinary = els.excludeMultidisciplinaryCheckbox.checked;
  const filtered = diseases.filter((disease) => {
    const allSpecialties = disease.allSpecialties || [];
    const relatedCount = Math.max(0, allSpecialties.length - 1);
    const matchesSpecialty = allSpecialties.includes(specialty);
    const matchesQuery = !query || searchText(disease).includes(query);
    const matchesMultidisciplinary = !excludeMultidisciplinary || relatedCount < 3;
    return matchesSpecialty && matchesQuery && matchesMultidisciplinary;
  });
  els.specialtySummary.textContent = `${specialty} 관련 질환 ${filtered.length.toLocaleString("ko-KR")}건`;
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

function copyRequestNote() {
  const text = els.requestNote.value.trim() || "질환명 / 현재 분류 / 제안 분류 / 근거를 적어 주세요.";
  navigator.clipboard.writeText(text).then(() => {
    els.copyRequestFeedback.textContent = "요청 문구를 클립보드에 복사했습니다.";
    window.setTimeout(() => {
      els.copyRequestFeedback.textContent = "";
    }, 2000);
  });
}

function rerenderAllViews() {
  renderGlobalResults();
  renderSpecialtyResults();
  if (state.selectedDisease) {
    const updated = diseases.find((item) => item.id === state.selectedDisease.id);
    state.selectedDisease = updated;
    els.selectedBadge.textContent = `${updated.koreanName} 선택됨`;
    els.suspectedDiseaseInput.value = updated.koreanName;
  }
}

function handleRelatedSpecialtyRequest(action, diseaseId, specialty) {
  const disease = diseases.find((item) => item.id === diseaseId);
  if (!disease) return;
  if (action === "remove") {
    const ok = window.confirm(`"${specialty}"를 관련과에서 제외 요청하시겠습니까?`);
    if (ok) {
      disease.allSpecialties = (disease.allSpecialties || []).filter((item) => item !== specialty);
      if (disease.primarySpecialty === specialty) {
        disease.primarySpecialty = disease.allSpecialties[0] || "미분류";
      }
      rerenderAllViews();
    }
    return;
  }
  if (action === "add") {
    const ok = window.confirm(`"${specialty}"를 관련과에 추가 요청하시겠습니까?`);
    if (ok) {
      if (!disease.allSpecialties.includes(specialty)) {
        disease.allSpecialties.push(specialty);
      }
      if (!disease.primarySpecialty || disease.primarySpecialty === "미분류") {
        disease.primarySpecialty = specialty;
      }
      rerenderAllViews();
    }
  }
}

function changePrimarySpecialty(diseaseId, specialty) {
  const disease = diseases.find((item) => item.id === diseaseId);
  if (!disease || !specialty) return;
  const ok = window.confirm(`주진료과를 "${specialty}"로 변경하시겠습니까?`);
  if (!ok) return;
  if (!disease.allSpecialties.includes(specialty)) {
    disease.allSpecialties.push(specialty);
  }
  disease.primarySpecialty = specialty;
  rerenderAllViews();
}

function confirmAddSpecialtyFromModal() {
  const diseaseId = state.addSpecialtyTargetId;
  const specialty = els.addSpecialtySelect.value;
  if (!diseaseId || !specialty) {
    hideAddSpecialtyModal();
    return;
  }
  handleRelatedSpecialtyRequest("add", diseaseId, specialty);
  hideAddSpecialtyModal();
}

function getFormValues() {
  return Object.fromEntries(new FormData(els.referralForm).entries());
}

function wrapText(context, text, x, y, maxWidth, lineHeight) {
  const words = String(text || "").split(/\s+/);
  let line = "";
  let currentY = y;
  words.forEach((word) => {
    const testLine = line ? `${line} ${word}` : word;
    if (context.measureText(testLine).width > maxWidth && line) {
      context.fillText(line, x, currentY);
      line = word;
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  });
  if (line) {
    context.fillText(line, x, currentY);
    currentY += lineHeight;
  }
  return currentY;
}

function canvasToJpegData(canvas) {
  return canvas.toDataURL("image/jpeg", 0.92).split(",")[1];
}

function buildPdfFromCanvases(canvases, filename) {
  const pdfParts = [];
  const offsets = [];
  let position = 0;

  function push(line) {
    pdfParts.push(line);
    position += line.length;
  }

  push("%PDF-1.4\n");
  const objectCount = 2 + canvases.length * 3;
  const imageObjects = [];
  const contentObjects = [];
  const pageObjects = [];

  for (let index = 0; index < canvases.length; index += 1) {
    imageObjects.push(3 + index * 3);
    contentObjects.push(4 + index * 3);
    pageObjects.push(5 + index * 3);
  }

  offsets[1] = position; push("1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n");
  offsets[2] = position; push(`2 0 obj << /Type /Pages /Count ${canvases.length} /Kids [${pageObjects.map((n) => `${n} 0 R`).join(" ")}] >> endobj\n`);

  canvases.forEach((canvas, index) => {
    const jpeg = canvasToJpegData(canvas);
    const binary = atob(jpeg);
    const bytes = Array.from(binary, (char) => char.charCodeAt(0));
    const imageObj = imageObjects[index];
    const contentObj = contentObjects[index];
    const pageObj = pageObjects[index];
    const width = canvas.width;
    const height = canvas.height;
    const content = `q\n595 0 0 842 0 0 cm\n/I${index} Do\nQ\n`;

    offsets[imageObj] = position;
    push(`${imageObj} 0 obj << /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bytes.length} >> stream\n`);
    bytes.forEach((b) => push(String.fromCharCode(b)));
    push(`\nendstream endobj\n`);

    offsets[contentObj] = position;
    push(`${contentObj} 0 obj << /Length ${content.length} >> stream\n${content}endstream endobj\n`);

    offsets[pageObj] = position;
    push(`${pageObj} 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /I${index} ${imageObj} 0 R >> >> /Contents ${contentObj} 0 R >> endobj\n`);
  });

  const xrefStart = position;
  push(`xref\n0 ${objectCount + 1}\n`);
  push("0000000000 65535 f \n");
  for (let i = 1; i <= objectCount; i += 1) {
    push(`${String(offsets[i]).padStart(10, "0")} 00000 n \n`);
  }
  push(`trailer << /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`);

  const pdfBlob = new Blob(pdfParts, { type: "application/pdf" });
  const url = URL.createObjectURL(pdfBlob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadReferralPdf() {
  if (!state.selectedDisease) return;
  const values = getFormValues();
  const pages = [];
  let canvas = document.createElement("canvas");
  canvas.width = 1240;
  canvas.height = 1754;
  let ctx = canvas.getContext("2d");

  function resetPage() {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#222222";
    ctx.font = "bold 36px 'Malgun Gothic', sans-serif";
    ctx.fillText("희귀질환센터 유전자검사 의뢰서", 70, 80);
    ctx.font = "24px 'Malgun Gothic', sans-serif";
  }

  function newPage() {
    pages.push(canvas);
    canvas = document.createElement("canvas");
    canvas.width = 1240;
    canvas.height = 1754;
    ctx = canvas.getContext("2d");
    resetPage();
    return 150;
  }

  resetPage();
  let y = 150;
  formFieldLabels.forEach(([field, label]) => {
    const value = values[field] || "";
    const minHeight = 70;
    const estimatedLines = Math.max(1, Math.ceil((String(value).length || 1) / 36));
    const boxHeight = Math.max(minHeight, estimatedLines * 34 + 32);
    if (y + boxHeight > 1660) {
      y = newPage();
    }
    ctx.strokeStyle = "#d5cab5";
    ctx.lineWidth = 2;
    ctx.strokeRect(60, y, 1120, boxHeight);
    ctx.fillStyle = "#f7f1e5";
    ctx.fillRect(60, y, 240, boxHeight);
    ctx.fillStyle = "#222222";
    ctx.font = "bold 22px 'Malgun Gothic', sans-serif";
    ctx.fillText(label, 80, y + 38);
    ctx.font = "22px 'Malgun Gothic', sans-serif";
    wrapText(ctx, value || "-", 330, y + 38, 820, 30);
    y += boxHeight + 12;
  });
  pages.push(canvas);
  buildPdfFromCanvases(pages, `의뢰서_${state.selectedDisease.koreanName}.pdf`);
}

function bindEvents() {
  els.tabs.forEach((tab) => {
    tab.addEventListener("click", () => setActiveTab(tab.dataset.tabTarget));
  });
  els.globalSearchInput.addEventListener("input", renderGlobalResults);
  els.specialtyFilter.addEventListener("change", renderSpecialtyResults);
  els.specialtySearchInput.addEventListener("input", renderSpecialtyResults);
  els.excludeMultidisciplinaryCheckbox.addEventListener("change", renderSpecialtyResults);

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
      handleRelatedSpecialtyRequest("remove", diseaseId, specialty);
      return;
    }

    const makePrimary = event.target.getAttribute("data-make-primary");
    if (makePrimary) {
      event.stopPropagation();
      const [diseaseId, specialty] = makePrimary.split("::");
      changePrimarySpecialty(diseaseId, specialty);
      return;
    }

    const openAddModal = event.target.getAttribute("data-open-add-modal");
    if (openAddModal) {
      event.stopPropagation();
      showAddSpecialtyModal(openAddModal);
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
  els.closeDisclaimerButton.addEventListener("click", () => {
    setActiveTab("guide");
    hideDisclaimer();
  });
  els.openDisclaimerButton.addEventListener("click", showDisclaimer);
  els.cancelAddSpecialtyButton.addEventListener("click", hideAddSpecialtyModal);
  els.confirmAddSpecialtyButton.addEventListener("click", confirmAddSpecialtyFromModal);
  els.activateFormButton.addEventListener("click", () => {
    if (state.selectedDisease) {
      setFormEnabled(true);
      els.suspectedDiseaseInput.value = state.selectedDisease.koreanName;
    }
  });
  els.downloadPdfButton.addEventListener("click", downloadReferralPdf);
  els.copyRequestButton.addEventListener("click", copyRequestNote);
}

function init() {
  els.diseaseCount.textContent = diseases.length.toLocaleString("ko-KR");
  renderGlobalResults();
  renderSpecialtyFilter();
  renderSpecialtyResults();
  bindEvents();
  setFormEnabled(false);
}

init();
