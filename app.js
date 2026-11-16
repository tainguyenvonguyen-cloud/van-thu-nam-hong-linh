/**
 * ============================================================================
 * LOGIC ỨNG DỤNG VĂN THƯ SỐ - PHƯỜNG NAM HỒNG LĨNH, TỈNH HÀ TĨNH
 * Nguyên tắc cốt lõi:
 * 1. Chỉ sử dụng dữ liệu công khai trên mạng (đã khai báo trong config.js).
 * 2. Không truy cập hệ thống nội bộ.
 * 3. Phần nào chưa biết -> Hỏi trực tiếp người dùng ngay trên giao diện Web,
 *    tuyệt đối không tự đoán hoặc tự bịa số liệu.
 * ============================================================================
 */

const STORAGE_KEYS = {
  API_KEY: "NHL_GEMINI_API_KEY",
  MODEL: "NHL_GEMINI_MODEL",
  SIGNERS: "NHL_CUSTOM_SIGNERS",
  TOTAL_TDP: "NHL_TOTAL_TDP",
  TDP_NAMES: "NHL_NAMED_TDP_LIST",
  ABBREVS: "NHL_SAVED_ABBREVS",
  HISTORY: "NHL_DOC_HISTORY",
  CMD_HISTORY: "NHL_CMD_UNDO_STACK"
};

// Danh sách các chức danh chưa có họ tên trên nguồn công khai (Khi chọn sẽ hỏi người dùng trên Web)
const UNKNOWN_PUBLIC_ROLES = [
  {
    id: "role_pct_ubnd_other",
    label: "➕ Phó Chủ tịch UBND phường khác (Bấm để nhập tên...)",
    coQuan: "UBND",
    quyenHanKy: "TM. ỦY BAN NHÂN DÂN\nKT. CHỦ TỊCH",
    chucVuKy: "PHÓ CHỦ TỊCH",
    chucVuMoTa: "Phó Chủ tịch UBND phường"
  },
  {
    id: "role_pct_hdnd",
    label: "➕ Phó Chủ tịch HĐND phường (Chưa có trên mạng - Bấm để nhập tên...)",
    coQuan: "HDND",
    quyenHanKy: "TM. THƯỜNG TRỰC HĐND\nKT. CHỦ TỊCH",
    chucVuKy: "PHÓ CHỦ TỊCH",
    chucVuMoTa: "Phó Chủ tịch HĐND phường"
  },
  {
    id: "role_ct_mttq",
    label: "➕ Chủ tịch Ủy ban MTTQ phường (Chưa có trên mạng - Bấm để nhập tên...)",
    coQuan: "UBMTTQ",
    quyenHanKy: "TM. BAN THƯỜNG TRỰC",
    chucVuKy: "CHỦ TỊCH",
    chucVuMoTa: "Chủ tịch Ủy ban MTTQ Việt Nam phường"
  },
  {
    id: "role_cvp",
    label: "➕ Chánh Văn phòng HĐND và UBND (Bấm để nhập tên...)",
    coQuan: "VP",
    quyenHanKy: "TL. CHỦ TỊCH",
    chucVuKy: "CHÁNH VĂN PHÒNG",
    chucVuMoTa: "Chánh Văn phòng HĐND và UBND phường"
  },
  {
    id: "role_tp_kthtdt",
    label: "➕ Trưởng phòng Kinh tế, Hạ tầng và Đô thị (Bấm để nhập tên...)",
    coQuan: "KTHTDT",
    quyenHanKy: "",
    chucVuKy: "TRƯỞNG PHÒNG",
    chucVuMoTa: "Trưởng phòng Kinh tế, Hạ tầng và Đô thị"
  },
  {
    id: "role_tp_vhxh",
    label: "➕ Trưởng phòng Văn hóa - Xã hội (Bấm để nhập tên...)",
    coQuan: "VHXH",
    quyenHanKy: "",
    chucVuKy: "TRƯỞNG PHÒNG",
    chucVuMoTa: "Trưởng phòng Văn hóa - Xã hội"
  },
  {
    id: "role_gd_ttpvhcc",
    label: "➕ Giám đốc Trung tâm Phục vụ hành chính công (Bấm để nhập tên...)",
    coQuan: "TTPVHCC",
    quyenHanKy: "",
    chucVuKy: "GIÁM ĐỐC",
    chucVuMoTa: "Giám đốc Trung tâm Phục vụ hành chính công"
  }
];

const TEN_LOAI_VAN_BAN_MAP = {
  BC: "BÁO CÁO",
  CV: "", // Công văn không có dòng tên loại văn bản
  GM: "GIẤY MỜI",
  TB: "THÔNG BÁO",
  TTr: "TỜ TRÌNH",
  QD: "QUYẾT ĐỊNH",
  KH: "KẾ HOẠCH"
};

// State câu hỏi trực tiếp trên Web
let activeWebQuestions = [];

// State Lịch sử Lệnh & Trạng thái văn bản (Undo / Redo)
let commandHistoryStack = [];
let commandHistoryCursor = -1;

// State Danh sách File đính kèm để đọc & trích xuất
let attachedFilesState = []; // Mỗi phần tử: { id, name, size, mimeType, kind: 'pdf'|'image'|'text', base64Data, extractedText }
let lastExtractedSummaryText = "";

// KHỞI TẠO KHI TẢI TRANG
document.addEventListener("DOMContentLoaded", () => {
  initCoQuanDropdown();
  initSignersDropdown();
  initSavedAbbreviations();
  setTodayDate();
  initTdpSelector();
  checkApiStatus();
  updateHistoryBadge();
  onCoQuanChange();
  initCommandHistoryStack();
  checkInitialUnknownsAndAskOnWeb();
});

// ============================================================================
// 1. CƠ CHẾ "KHÔNG TỰ ĐOÁN - HỎI TRỰC TIẾP TRÊN WEB"
// ============================================================================
function checkInitialUnknownsAndAskOnWeb() {
  activeWebQuestions = [];

  // Kiểm tra 1: Danh sách tên các Tổ dân phố (TDP) của phường Nam Hồng Lĩnh đã được xác nhận chưa?
  const savedTdpNames = localStorage.getItem(STORAGE_KEYS.TDP_NAMES);
  if (!savedTdpNames) {
    activeWebQuestions.push({
      id: "q_total_tdp",
      question:
        "1. Bạn muốn thiết lập danh sách tên các Tổ dân phố của phường Nam Hồng Lĩnh như thế nào? (Nhập danh sách tên các TDP cách nhau bằng dấu phẩy, hoặc để mặc định rồi sửa sau):",
      placeholder: "Ví dụ: Tổ dân phố 1, Tổ dân phố 2, TDP Nam Xuyên, TDP Đậu Liêu...",
      type: "text",
      defaultValue: "",
      buttonText: "Lưu danh sách tên TDP",
      onAnswer: (val) => {
        let list = [];
        if (val && val.trim()) {
          list = val
            .split(/[,;\n]/)
            .map((s) => s.trim())
            .filter(Boolean);
        }
        if (list.length === 0) {
          list = Array.from({ length: 21 }, (_, i) => `Tổ dân phố ${i + 1}`);
        }
        saveTdpNames(list);
        removeWebQuestion("q_total_tdp");
      }
    });
  }

  // Kiểm tra 2: Khóa Gemini API Key đã được dán vào config.js hoặc lưu trên trình duyệt chưa?
  const apiKey = getEffectiveApiKey();
  if (!apiKey) {
    activeWebQuestions.push({
      id: "q_gemini_key",
      question:
        "2. Bạn chưa dán Gemini API Key vào file config.js. Bạn có muốn dán trực tiếp khóa Gemini Pro API vào đây để dùng ngay không?",
      placeholder: "Dán khóa AIzaSy... của bạn vào đây",
      type: "password",
      defaultValue: "",
      buttonText: "Kết nối Gemini Pro",
      onAnswer: (val) => {
        if (val && val.trim().length > 10) {
          localStorage.setItem(STORAGE_KEYS.API_KEY, val.trim());
          checkApiStatus();
          removeWebQuestion("q_gemini_key");
        } else {
          alert("Vui lòng nhập khóa Gemini API Key hợp lệ.");
        }
      }
    });
  }

  renderWebQuestionsBanner();
}

function addWebQuestion(qObj) {
  // Tránh trùng lặp
  activeWebQuestions = activeWebQuestions.filter((q) => q.id !== qObj.id);
  activeWebQuestions.unshift(qObj);
  renderWebQuestionsBanner();
}

function removeWebQuestion(qId) {
  activeWebQuestions = activeWebQuestions.filter((q) => q.id !== qId);
  renderWebQuestionsBanner();
}

function dismissQuestionBanner() {
  document.getElementById("webQuestionBanner").style.display = "none";
}

function renderWebQuestionsBanner() {
  const banner = document.getElementById("webQuestionBanner");
  const listEl = document.getElementById("webQuestionList");
  if (!activeWebQuestions || activeWebQuestions.length === 0) {
    banner.style.display = "none";
    listEl.innerHTML = "";
    return;
  }

  banner.style.display = "block";
  listEl.innerHTML = activeWebQuestions
    .map(
      (q) => `
    <div class="question-item" id="web_q_box_${q.id}">
      <label>${escapeHtml(q.question)}</label>
      <div class="question-item-row">
        <input
          type="${q.type || "text"}"
          id="web_q_input_${q.id}"
          class="form-control"
          placeholder="${escapeHtml(q.placeholder || "")}"
          value="${escapeHtml(q.defaultValue || "")}"
        />
        <button type="button" class="btn btn-primary" style="white-space: nowrap;" onclick="submitWebQuestion('${q.id}')">
          ${escapeHtml(q.buttonText || "Xác nhận")}
        </button>
      </div>
    </div>
  `
    )
    .join("");
}

function submitWebQuestion(qId) {
  const q = activeWebQuestions.find((item) => item.id === qId);
  if (!q) return;
  const inputEl = document.getElementById(`web_q_input_${qId}`);
  const val = inputEl ? inputEl.value : "";
  if (typeof q.onAnswer === "function") {
    q.onAnswer(val);
  }
}

// ============================================================================
// 2. QUẢN LÝ CƠ QUAN BAN HÀNH, SỐ KÝ HIỆU & NGƯỜI KÝ
// ============================================================================
function initCoQuanDropdown() {
  const select = document.getElementById("selectCoQuan");
  const list = window.APP_CONFIG.CO_QUAN_BAN_HANH || [];
  select.innerHTML = list
    .map((cq) => `<option value="${cq.ma}">${escapeHtml(cq.tenHienThi)}</option>`)
    .join("");
}

function onCoQuanChange() {
  const ma = document.getElementById("selectCoQuan").value;
  const cq = (window.APP_CONFIG.CO_QUAN_BAN_HANH || []).find((item) => item.ma === ma);
  if (!cq) return;

  const toggleParent = document.getElementById("toggleParentOrg");
  const parentGroup = document.getElementById("parentOrgGroup");
  const inputParent = document.getElementById("inputParentOrg");
  const inputIssuing = document.getElementById("inputIssuingOrg");

  toggleParent.checked = !!cq.batDongCapTrenMacDinh;
  parentGroup.style.display = toggleParent.checked ? "block" : "none";
  inputParent.value = cq.dongCapTrenMacDinh || "ỦY BAN NHÂN DÂN TỈNH HÀ TĨNH";
  inputIssuing.value = (cq.dongTenCoQuan || "").replace(/\n/g, " / ");

  // Chọn người ký mặc định phù hợp với cơ quan
  const allSigners = getAllSigners();
  const matchingSigner = allSigners.find((s) => s.coQuan === ma) || allSigners[0];
  if (matchingSigner) {
    document.getElementById("selectNguoiKy").value = matchingSigner.id;
    applySignerToInputs(matchingSigner);
  }

  updateSoKyHieu();
  renderDocumentPreview();
}

function onToggleParentOrg() {
  const checked = document.getElementById("toggleParentOrg").checked;
  document.getElementById("parentOrgGroup").style.display = checked ? "block" : "none";
  renderDocumentPreview();
}

function onLoaiVanBanChange() {
  const loai = document.getElementById("selectLoaiVanBan").value;
  // Якщо là Công văn mà chưa nhập chữ viết tắt bộ phận soạn thảo -> Hỏi trực tiếp trên web!
  const maBoPhan = document.getElementById("inputMaBoPhan").value.trim();
  const maCoQuan = document.getElementById("selectCoQuan").value;
  if (loai === "CV" && !maBoPhan && (maCoQuan === "UBND" || maCoQuan === "HDND")) {
    addWebQuestion({
      id: "q_ma_bo_phan_cv",
      question:
        "Bạn đang chọn tạo Công văn. Công văn này do bộ phận/phòng nào của phường tham mưu soạn thảo? (Nhập chữ viết tắt để ghép vào Số: .../UBND-...)",
      placeholder: "Ví dụ: VP (Văn phòng), VHXH (Văn hóa - Xã hội), KTHTĐT (Kinh tế Hạ tầng)...",
      type: "text",
      defaultValue: "",
      buttonText: "Điền & Lưu ký hiệu",
      onAnswer: (val) => {
        const clean = val.trim().toUpperCase();
        if (!clean) {
          alert("Vui lòng nhập chữ viết tắt bộ phận soạn thảo.");
          return;
        }
        document.getElementById("inputMaBoPhan").value = clean;
        saveAbbrevToStorage(clean);
        updateSoKyHieu();
        removeWebQuestion("q_ma_bo_phan_cv");
      }
    });
  } else {
    removeWebQuestion("q_ma_bo_phan_cv");
  }

  // Cập nhật gợi ý mặc định cho Kính gửi nếu là Giấy mời / Báo cáo
  updateSoKyHieu();
  renderDocumentPreview();
}

function updateSoKyHieu() {
  const maCoQuan = document.getElementById("selectCoQuan").value;
  const cq = (window.APP_CONFIG.CO_QUAN_BAN_HANH || []).find((item) => item.ma === maCoQuan);
  const kyHieuCQ = cq ? cq.kyHieuCoQuan : "UBND";

  const loai = document.getElementById("selectLoaiVanBan").value;
  const so = document.getElementById("inputSoVanBan").value.trim() || "...";
  const boPhan = document.getElementById("inputMaBoPhan").value.trim().toUpperCase();

  let kyHieuFull = "";
  if (loai === "CV") {
    // Công văn: Số: .../UBND-VP
    if (boPhan) {
      kyHieuFull = `Số: ${so}/${kyHieuCQ}-${boPhan}`;
    } else {
      kyHieuFull = `Số: ${so}/${kyHieuCQ}-...`;
    }
  } else {
    // Văn bản có tên loại: Số: .../BC-UBND, Số: .../GM-UBND, Số: .../QĐ-UBND
    const loaiKyHieu = loai === "QD" ? "QĐ" : loai;
    kyHieuFull = `Số: ${so}/${loaiKyHieu}-${kyHieuCQ}`;
  }

  document.getElementById("inputKyHieuFull").value = kyHieuFull;
  renderDocumentPreview();
}

// Lưu chữ viết tắt bộ phận để chọn nhanh
function initSavedAbbreviations() {
  const saved = getSavedAbbreviations();
  renderSavedAbbrevChips(saved);
}

function getSavedAbbreviations() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ABBREVS);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return ["VP", "VHXH", "KTHTĐT", "TTPVHCC"];
}

function saveAbbrevToStorage(abbr) {
  const list = getSavedAbbreviations();
  if (!list.includes(abbr)) {
    list.push(abbr);
    localStorage.setItem(STORAGE_KEYS.ABBREVS, JSON.stringify(list));
  }
  renderSavedAbbrevChips(list);
}

function saveCustomAbbreviation() {
  const val = document.getElementById("inputMaBoPhan").value.trim().toUpperCase();
  if (!val) {
    alert("Bạn hãy gõ chữ viết tắt phòng/bộ phận vào ô trước khi bấm Lưu nhé!");
    return;
  }
  saveAbbrevToStorage(val);
  updateSoKyHieu();
}

function renderSavedAbbrevChips(list) {
  const container = document.getElementById("savedAbbrevChips");
  const current = document.getElementById("inputMaBoPhan").value.trim().toUpperCase();
  container.innerHTML = list
    .map(
      (abbr) => `
    <span class="chip ${current === abbr ? "active" : ""}" onclick="selectAbbrevChip('${escapeHtml(abbr)}')">
      ${escapeHtml(abbr)}
    </span>
  `
    )
    .join("");
}

function selectAbbrevChip(abbr) {
  document.getElementById("inputMaBoPhan").value = abbr;
  renderSavedAbbrevChips(getSavedAbbreviations());
  removeWebQuestion("q_ma_bo_phan_cv");
  updateSoKyHieu();
}

// ============================================================================
// 3. QUẢN LÝ NGƯỜI KÝ (HỎI TRỰC TIẾP TRÊN WEB KHI CHỌN CHỨC DANH CHƯA BIẾT TÊN)
// ============================================================================
function getAllSigners() {
  const publicSigners = window.APP_CONFIG.LANH_DAO_CONG_KHAI || [];
  let customSigners = [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SIGNERS);
    if (raw) customSigners = JSON.parse(raw);
  } catch (e) {}
  return [...publicSigners, ...customSigners];
}

function initSignersDropdown() {
  const select = document.getElementById("selectNguoiKy");
  const signers = getAllSigners();

  const knownOptions = signers
    .map(
      (s) =>
        `<option value="${s.id}">✅ Đ/c ${escapeHtml(s.hoTen)} — ${escapeHtml(s.chucVu)}</option>`
    )
    .join("");

  const unknownOptions = UNKNOWN_PUBLIC_ROLES.map(
    (r) => `<option value="${r.id}">${escapeHtml(r.label)}</option>`
  ).join("");

  select.innerHTML = `
    <optgroup label="Lãnh đạo đã có thông tin công khai / Đã lưu">
      ${knownOptions}
    </optgroup>
    <optgroup label="Chức danh khác (Chưa công khai trên mạng - Chọn để nhập tên trực tiếp)">
      ${unknownOptions}
    </optgroup>
  `;

  renderSignerDirectoryTable();
}

function onNguoiKyChange() {
  const selectedId = document.getElementById("selectNguoiKy").value;
  const signers = getAllSigners();
  const known = signers.find((s) => s.id === selectedId);

  if (known) {
    removeWebQuestion("q_unknown_signer");
    applySignerToInputs(known);
    renderDocumentPreview();
    return;
  }

  // Nếu người dùng chọn 1 chức danh chưa có tên công khai -> Hỏi trực tiếp trên Web, tuyệt đối không tự đoán!
  const unknownRole = UNKNOWN_PUBLIC_ROLES.find((r) => r.id === selectedId);
  if (unknownRole) {
    document.getElementById("inputQuyenHanKy").value = unknownRole.quyenHanKy;
    document.getElementById("inputChucVuKy").value = unknownRole.chucVuKy;
    document.getElementById("inputHoTenKy").value = "";
    renderDocumentPreview();

    addWebQuestion({
      id: "q_unknown_signer",
      question: `Bạn vừa chọn người ký là "${unknownRole.chucVuMoTa}". Do thông tin này chưa công khai đầy đủ trên mạng, xin hỏi Họ và tên của đồng chí giữ chức vụ "${unknownRole.chucVuMoTa}" tại phường Nam Hồng Lĩnh là gì ạ?`,
      placeholder: `Nhập họ và tên ${unknownRole.chucVuMoTa}...`,
      type: "text",
      defaultValue: "",
      buttonText: "Điền tên & Lưu nhớ",
      onAnswer: (fullName) => {
        const cleanName = fullName.trim();
        if (!cleanName) {
          alert("Vui lòng nhập họ và tên người ký.");
          return;
        }
        const newSigner = {
          id: "custom_" + Date.now(),
          hoTen: cleanName,
          chucVu: unknownRole.chucVuMoTa,
          coQuan: unknownRole.coQuan,
          quyenHanKy: unknownRole.quyenHanKy,
          chucVuKy: unknownRole.chucVuKy
        };
        saveCustomSigner(newSigner);
        initSignersDropdown();
        document.getElementById("selectNguoiKy").value = newSigner.id;
        applySignerToInputs(newSigner);
        removeWebQuestion("q_unknown_signer");
        renderDocumentPreview();
      }
    });
  }
}

function applySignerToInputs(signer) {
  document.getElementById("inputQuyenHanKy").value = signer.quyenHanKy || "";
  document.getElementById("inputChucVuKy").value = signer.chucVuKy || "";
  document.getElementById("inputHoTenKy").value = signer.hoTen || "";
}

function saveCustomSigner(newSigner) {
  let customSigners = [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SIGNERS);
    if (raw) customSigners = JSON.parse(raw);
  } catch (e) {}
  customSigners.push(newSigner);
  localStorage.setItem(STORAGE_KEYS.SIGNERS, JSON.stringify(customSigners));
}

function addNewSignerFromModal() {
  const hoTen = document.getElementById("newSignerName").value.trim();
  const chucVu = document.getElementById("newSignerRole").value.trim();
  const quyenHanKy = document.getElementById("newSignerAuth").value.trim();
  const chucVuKy = document.getElementById("newSignerTitle").value.trim();

  if (!hoTen || !chucVuKy) {
    alert("Vui lòng nhập tối thiểu Họ và tên và Chức vụ ký!");
    return;
  }

  const newSigner = {
    id: "custom_" + Date.now(),
    hoTen,
    chucVu: chucVu || chucVuKy,
    coQuan: "UBND",
    quyenHanKy: quyenHanKy.replace(/\s*\/\s*/g, "\n"),
    chucVuKy
  };

  saveCustomSigner(newSigner);
  initSignersDropdown();
  document.getElementById("selectNguoiKy").value = newSigner.id;
  applySignerToInputs(newSigner);
  renderDocumentPreview();

  document.getElementById("newSignerName").value = "";
  document.getElementById("newSignerRole").value = "";
  document.getElementById("newSignerAuth").value = "";
  document.getElementById("newSignerTitle").value = "";
}

function deleteCustomSigner(id) {
  let customSigners = [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SIGNERS);
    if (raw) customSigners = JSON.parse(raw);
  } catch (e) {}
  customSigners = customSigners.filter((s) => s.id !== id);
  localStorage.setItem(STORAGE_KEYS.SIGNERS, JSON.stringify(customSigners));
  initSignersDropdown();
}

function renderSignerDirectoryTable() {
  const tbody = document.getElementById("signerTableBody");
  if (!tbody) return;
  const all = getAllSigners();
  tbody.innerHTML = all
    .map((s) => {
      const isCustom = String(s.id).startsWith("custom_");
      return `
      <tr>
        <td><strong>${escapeHtml(s.hoTen)}</strong></td>
        <td>${escapeHtml(s.chucVu)}</td>
        <td><small>${escapeHtml((s.quyenHanKy ? s.quyenHanKy + " — " : "") + s.chucVuKy)}</small></td>
        <td>
          ${
            isCustom
              ? `<button class="btn btn-sm btn-outline" onclick="deleteCustomSigner('${s.id}')">🗑️ Xóa</button>`
              : `<span style="font-size: 11.5px; color: #15803d; font-weight: 600;">Công khai</span>`
          }
        </td>
      </tr>
    `;
    })
    .join("");
}

// ============================================================================
// 4. QUẢN LÝ & CHỌN TỔ DÂN PHỐ THEO TÊN RIÊNG
// ============================================================================
function getSavedTdpNames() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TDP_NAMES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {}

  // Mặc định ban đầu nếu chưa có: lấy số lượng từ TOTAL_TDP hoặc 21 tổ
  const total = parseInt(localStorage.getItem(STORAGE_KEYS.TOTAL_TDP) || "21", 10);
  const defaultList = Array.from({ length: total }, (_, i) => `Tổ dân phố ${i + 1}`);
  localStorage.setItem(STORAGE_KEYS.TDP_NAMES, JSON.stringify(defaultList));
  return defaultList;
}

function saveTdpNames(list) {
  const cleanList = (list || [])
    .map((s) => String(s || "").trim())
    .filter(Boolean);
  // Loại bỏ tên trùng lặp nhưng giữ thứ tự
  const uniqueList = Array.from(new Set(cleanList));
  localStorage.setItem(STORAGE_KEYS.TDP_NAMES, JSON.stringify(uniqueList));
  renderTdpCheckboxes();
}

function initTdpSelector() {
  renderTdpCheckboxes();
}

function renderTdpCheckboxes() {
  const container = document.getElementById("tdpGridContainer");
  const badge = document.getElementById("tdpCountBadge");
  const list = getSavedTdpNames();

  if (badge) badge.textContent = list.length;
  if (!container) return;

  if (list.length === 0) {
    container.innerHTML = `<div style="grid-column: 1/-1; color: #64748b; font-size: 12.5px; padding: 10px; text-align: center;">Chưa có Tổ dân phố nào. Hãy gõ tên và bấm "➕ Thêm TDP" hoặc "✏️ Sửa danh sách TDP".</div>`;
    return;
  }

  let html = "";
  list.forEach((name, idx) => {
    html += `
      <label class="tdp-item" id="tdp_label_${idx}">
        <div class="tdp-item-label" title="${escapeHtml(name)}">
          <input type="checkbox" class="tdp-checkbox" value="${escapeHtml(name)}" onchange="onTdpCheckChange(${idx})" />
          <span>${escapeHtml(name)}</span>
        </div>
        <button type="button" class="tdp-del-btn" onclick="deleteTdpByIndex(${idx}, event)" title="Xóa ${escapeHtml(name)}">✕</button>
      </label>
    `;
  });
  container.innerHTML = html;
}

function onTdpCheckChange(idx) {
  const label = document.getElementById(`tdp_label_${idx}`);
  const cb = label ? label.querySelector("input") : null;
  if (label && cb) {
    label.classList.toggle("checked", cb.checked);
  }
}

function addNewTdpByName() {
  const inp = document.getElementById("inputNewTdpName");
  const val = (inp ? inp.value : "").trim();
  if (!val) {
    alert("Vui lòng gõ tên Tổ dân phố cần thêm!");
    return;
  }

  const list = getSavedTdpNames();
  if (list.some((item) => item.toLowerCase() === val.toLowerCase())) {
    alert(`Tổ dân phố "${val}" đã có trong danh sách!`);
    return;
  }

  list.push(val);
  saveTdpNames(list);
  inp.value = "";
  inp.focus();
}

function deleteTdpByIndex(idx, event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  const list = getSavedTdpNames();
  const name = list[idx];
  if (!confirm(`Bạn có chắc muốn xóa "${name}" khỏi danh sách chọn nhanh?`)) return;

  list.splice(idx, 1);
  saveTdpNames(list);
}

function selectAllTdp(checked) {
  const checkboxes = document.querySelectorAll(".tdp-checkbox");
  checkboxes.forEach((cb, idx) => {
    cb.checked = checked;
    const label = document.getElementById(`tdp_label_${idx}`);
    if (label) label.classList.toggle("checked", checked);
  });
}

function getSelectedTdpNames() {
  const checkboxes = document.querySelectorAll(".tdp-checkbox:checked");
  return Array.from(checkboxes).map((cb) => cb.value.trim()).filter(Boolean);
}

function applySelectedTdpToDocument() {
  const selected = getSelectedTdpNames();
  const all = getSavedTdpNames();

  if (selected.length === 0) {
    alert("Bạn hãy tích chọn ít nhất 1 Tổ dân phố trước nhé!");
    return;
  }

  pushCommandSnapshot("Trước khi áp dụng TDP vào văn bản");

  let tdpTextKinhGui = "";
  let tdpTextNoiNhan = "";

  if (selected.length === all.length && all.length > 1) {
    tdpTextKinhGui = "Ban cán sự / Tổ trưởng các Tổ dân phố trên địa bàn phường";
    tdpTextNoiNhan = "- Các Tổ dân phố trên địa bàn phường (để t/h);";
  } else if (selected.length === 1) {
    tdpTextKinhGui = `Tổ trưởng ${selected[0]}`;
    tdpTextNoiNhan = `- ${selected[0]} (để t/h);`;
  } else {
    const listStr = selected.join(", ");
    tdpTextKinhGui = `Tổ trưởng các Tổ dân phố: ${listStr}`;
    tdpTextNoiNhan = `- Các Tổ dân phố: ${listStr} (để t/h);`;
  }

  // Đưa vào Kính gửi
  const kinhGuiEl = document.getElementById("inputKinhGui");
  if (!kinhGuiEl.value.trim()) {
    kinhGuiEl.value = tdpTextKinhGui;
  } else if (!kinhGuiEl.value.includes("Tổ dân phố") && !kinhGuiEl.value.includes("TDP")) {
    kinhGuiEl.value = kinhGuiEl.value.trim() + ";\n" + tdpTextKinhGui;
  } else {
    kinhGuiEl.value = tdpTextKinhGui;
  }

  // Đưa vào Nơi nhận
  const noiNhanEl = document.getElementById("inputNoiNhan");
  const lines = noiNhanEl.value
    .split("\n")
    .filter((l) => !l.includes("Tổ dân phố") && !l.includes("TDP"));
  const luuIndex = lines.findIndex((l) => l.includes("Lưu:"));
  if (luuIndex !== -1) {
    lines.splice(luuIndex, 0, tdpTextNoiNhan);
  } else {
    lines.push(tdpTextNoiNhan);
  }
  noiNhanEl.value = lines.join("\n");

  renderDocumentPreview();
  pushCommandSnapshot("Đưa danh sách TDP vào văn bản");
}

function saveTdpBulkFromModal() {
  const textarea = document.getElementById("tdpBulkTextarea");
  const raw = textarea ? textarea.value : "";
  const lines = raw
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    alert("Vui lòng nhập ít nhất 1 tên Tổ dân phố!");
    return;
  }

  saveTdpNames(lines);
  closeModal("tdpModal");
  alert(`✅ Đã lưu thành công ${lines.length} Tổ dân phố!`);
}

function resetDefaultTdpList() {
  if (!confirm("Bạn có muốn đặt lại danh sách thành 'Tổ dân phố 1' đến 'Tổ dân phố 21' không?")) return;
  const defaultList = Array.from({ length: 21 }, (_, i) => `Tổ dân phố ${i + 1}`);
  const textarea = document.getElementById("tdpBulkTextarea");
  if (textarea) textarea.value = defaultList.join("\n");
  saveTdpNames(defaultList);
  alert("Đã khôi phục danh sách mặc định!");
}

// ============================================================================
// 5. HIỂN THỊ BẢN XEM TRƯỚC A4 CHUẨN NGHỊ ĐỊNH 30/2020/NĐ-CP
// ============================================================================
function setTodayDate() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  document.getElementById("inputNgayThang").value = `${yyyy}-${mm}-${dd}`;
  renderDocumentPreview();
}

function formatVietnameseDateLine(diaDanh, dateStr) {
  let dd = "..",
    mm = "..",
    yyyy = "2026";
  if (dateStr && dateStr.includes("-")) {
    const parts = dateStr.split("-");
    yyyy = parts[0];
    mm = parts[1];
    dd = parts[2];
  }
  return `${diaDanh || "Nam Hồng Lĩnh"}, ngày ${dd} tháng ${mm} năm ${yyyy}`;
}

function formatBodyHtml(rawText) {
  if (!rawText || !rawText.trim()) {
    return `<p><em>[Nội dung văn bản sẽ hiển thị tại đây. Bạn có thể bấm nút "Tạo ngay nội dung văn bản (Gemini Pro)" hoặc nhập yêu cầu ở cột bên trái...]</em></p>`;
  }

  const lines = rawText.split("\n");
  return lines
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return "";

      // Highlight các vị trí [CẦN ĐIỀN: ...] để người dùng thấy ngay thông tin chưa biết
      let safeHtml = escapeHtml(trimmed).replace(
        /\[([^\]]+)\]/g,
        '<span class="nd30-placeholder-highlight">[$1]</span>'
      );

      // In đậm tự động các đề mục lớn (I., II., III., 1., 2., Điều 1., Điều 2.)
      if (/^(I|II|III|IV|V|VI|VII|VIII|IX|X|\d+)\.\s+/.test(trimmed) || /^Điều\s+\d+/i.test(trimmed)) {
        return `<p class="section-heading">${safeHtml}</p>`;
      }
      return `<p>${safeHtml}</p>`;
    })
    .join("");
}

function renderDocumentPreview() {
  const showParent = document.getElementById("toggleParentOrg").checked;
  const parentOrg = document.getElementById("inputParentOrg").value.trim();
  const issuingOrgRaw = document.getElementById("inputIssuingOrg").value.trim();
  const issuingOrgHtml = issuingOrgRaw
    .split(/\s*\/\s*|\n/)
    .map((s) => escapeHtml(s.trim()))
    .join("<br/>");

  const loai = document.getElementById("selectLoaiVanBan").value;
  const tenLoai = TEN_LOAI_VAN_BAN_MAP[loai] || "";
  const kyHieuFull = document.getElementById("inputKyHieuFull").value.trim();
  const diaDanh = document.getElementById("inputDiaDanh").value.trim();
  const ngayThangStr = document.getElementById("inputNgayThang").value;
  const ngayThangLine = formatVietnameseDateLine(diaDanh, ngayThangStr);

  const trichYeu = document.getElementById("inputTrichYeu").value.trim();
  const kinhGuiRaw = document.getElementById("inputKinhGui").value.trim();
  const noiDungRaw = document.getElementById("inputNoiDung").value;
  const noiNhanRaw = document.getElementById("inputNoiNhan").value.trim();

  const quyenHanKy = document.getElementById("inputQuyenHanKy").value.trim();
  const chucVuKy = document.getElementById("inputChucVuKy").value.trim();
  const hoTenKy = document.getElementById("inputHoTenKy").value.trim();

  // Xử lý Kính gửi
  let kinhGuiHtml = "";
  if (kinhGuiRaw) {
    const kgLines = kinhGuiRaw
      .split(/\n|;/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (kgLines.length === 1) {
      kinhGuiHtml = `<div class="nd30-kinh-gui"><strong>Kính gửi:</strong> ${escapeHtml(kgLines[0])}.</div>`;
    } else if (kgLines.length > 1) {
      const items = kgLines
        .map((item, idx) => `- ${escapeHtml(item)}${idx === kgLines.length - 1 ? "." : ";"}`)
        .join("<br/>");
      kinhGuiHtml = `
        <table style="width: 100%; border-collapse: collapse; margin: 10pt 0 12pt 0; font-size: 14pt;">
          <tr>
            <td style="width: 28%; text-align: right; vertical-align: top; padding-right: 8pt; font-weight: bold;">Kính gửi:</td>
            <td style="width: 72%; text-align: left; vertical-align: top;">${items}</td>
          </tr>
        </table>
      `;
    }
  }

  // Xử lý Nơi nhận
  const noiNhanHtml = noiNhanRaw
    .split("\n")
    .map((l) => escapeHtml(l.trim()))
    .filter(Boolean)
    .join("<br/>");

  // Xử lý phần tên loại & trích yếu:
  // - Nếu là Công văn (CV): Trích yếu nằm ở ô bên trái dưới Số/Ký hiệu ("V/v ...")
  // - Nếu là các loại khác (BC, GM, TB, TTr, QD, KH): Tên loại + Trích yếu nằm chính giữa trang
  let centerTitleHtml = "";
  let leftVvHtml = "";

  if (loai === "CV") {
    const vvText = trichYeu
      ? trichYeu.startsWith("V/v") || trichYeu.startsWith("v/v")
        ? trichYeu
        : `V/v ${trichYeu.charAt(0).toLowerCase() + trichYeu.slice(1)}`
      : "V/v ......................................................";
    leftVvHtml = `<div class="nd30-vv-congvan">${escapeHtml(vvText)}</div>`;
  } else {
    centerTitleHtml = `
      <div class="nd30-ten-loai-vb">${escapeHtml(tenLoai)}</div>
      <div class="nd30-trich-yeu-vb">${escapeHtml(trichYeu || "Về việc ....................................................................")}</div>
      <div class="nd30-line-trich-yeu"></div>
    `;
  }

  const pageEl = document.getElementById("a4DocumentPage");
  pageEl.innerHTML = `
    <table class="nd30-header-table">
      <tr>
        <td class="nd30-org-cell">
          ${showParent && parentOrg ? `<div class="nd30-parent-org">${escapeHtml(parentOrg)}</div>` : ""}
          <div class="nd30-issuing-org">${issuingOrgHtml}</div>
          <div class="nd30-line-short"></div>
          <div class="nd30-so-ky-hieu">${escapeHtml(kyHieuFull)}</div>
          ${leftVvHtml}
        </td>
        <td class="nd30-country-cell">
          <div class="nd30-quoc-hieu">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
          <div class="nd30-tieu-ngu">Độc lập - Tự do - Hạnh phúc</div>
          <div class="nd30-line-long"></div>
          <div class="nd30-ngay-thang">${escapeHtml(ngayThangLine)}</div>
        </td>
      </tr>
    </table>

    ${centerTitleHtml}
    ${kinhGuiHtml}

    <div class="nd30-body-content">
      ${formatBodyHtml(noiDungRaw)}
    </div>

    <table class="nd30-footer-table">
      <tr>
        <td class="nd30-noi-nhan-cell">
          <div class="nd30-noi-nhan-title">Nơi nhận:</div>
          <div>${noiNhanHtml}</div>
        </td>
        <td class="nd30-chu-ky-cell">
          ${quyenHanKy ? `<div class="nd30-quyen-han-ky">${escapeHtml(quyenHanKy)}</div>` : ""}
          <div class="nd30-chuc-vu-ky">${escapeHtml(chucVuKy)}</div>
          <div class="nd30-khoang-trong-ky"></div>
          <div class="nd30-ho-ten-ky">${escapeHtml(hoTenKy || "[Chưa chọn/nhập tên người ký]")}</div>
        </td>
      </tr>
    </table>
  `;
}

// ============================================================================
// 6A. QUAY LẠI LỆNH TRƯỚC ĐÓ (UNDO / REDO LỆNH & PHIÊN BẢN VĂN BẢN)
// ============================================================================
function captureCurrentSnapshot(label) {
  return {
    timestamp: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    label: label || document.getElementById("aiPromptInput").value.trim() || "Trạng thái văn bản",
    aiPrompt: document.getElementById("aiPromptInput").value,
    coQuanMa: document.getElementById("selectCoQuan").value,
    toggleParentOrg: document.getElementById("toggleParentOrg").checked,
    parentOrg: document.getElementById("inputParentOrg").value,
    issuingOrg: document.getElementById("inputIssuingOrg").value,
    loaiVanBan: document.getElementById("selectLoaiVanBan").value,
    soVanBan: document.getElementById("inputSoVanBan").value,
    maBoPhan: document.getElementById("inputMaBoPhan").value,
    kyHieuFull: document.getElementById("inputKyHieuFull").value,
    diaDanh: document.getElementById("inputDiaDanh").value,
    ngayThang: document.getElementById("inputNgayThang").value,
    trichYeu: document.getElementById("inputTrichYeu").value,
    kinhGui: document.getElementById("inputKinhGui").value,
    noiDung: document.getElementById("inputNoiDung").value,
    noiNhan: document.getElementById("inputNoiNhan").value,
    quyenHanKy: document.getElementById("inputQuyenHanKy").value,
    chucVuKy: document.getElementById("inputChucVuKy").value,
    hoTenKy: document.getElementById("inputHoTenKy").value
  };
}

function applySnapshotToForm(snap) {
  if (!snap) return;
  document.getElementById("aiPromptInput").value = snap.aiPrompt || "";
  document.getElementById("selectCoQuan").value = snap.coQuanMa || "UBND";
  document.getElementById("toggleParentOrg").checked = !!snap.toggleParentOrg;
  document.getElementById("parentOrgGroup").style.display = snap.toggleParentOrg ? "block" : "none";
  document.getElementById("inputParentOrg").value = snap.parentOrg || "";
  document.getElementById("inputIssuingOrg").value = snap.issuingOrg || "";
  document.getElementById("selectLoaiVanBan").value = snap.loaiVanBan || "BC";
  document.getElementById("inputSoVanBan").value = snap.soVanBan || "";
  document.getElementById("inputMaBoPhan").value = snap.maBoPhan || "";
  document.getElementById("inputKyHieuFull").value = snap.kyHieuFull || "";
  document.getElementById("inputDiaDanh").value = snap.diaDanh || "Nam Hồng Lĩnh";
  document.getElementById("inputNgayThang").value = snap.ngayThang || "";
  document.getElementById("inputTrichYeu").value = snap.trichYeu || "";
  document.getElementById("inputKinhGui").value = snap.kinhGui || "";
  document.getElementById("inputNoiDung").value = snap.noiDung || "";
  document.getElementById("inputNoiNhan").value = snap.noiNhan || "";
  document.getElementById("inputQuyenHanKy").value = snap.quyenHanKy || "";
  document.getElementById("inputChucVuKy").value = snap.chucVuKy || "";
  document.getElementById("inputHoTenKy").value = snap.hoTenKy || "";
  renderDocumentPreview();
}

function initCommandHistoryStack() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CMD_HISTORY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        commandHistoryStack = parsed;
        commandHistoryCursor = commandHistoryStack.length - 1;
        updateCmdHistoryUI();
        return;
      }
    }
  } catch (e) {}
  // Lưu mốc khởi đầu
  pushCommandSnapshot("Khởi tạo biểu mẫu ban đầu");
}

function pushCommandSnapshot(customLabel) {
  const snap = captureCurrentSnapshot(customLabel);

  // Nếu đang ở giữa stack mà tạo lệnh mới thì cắt phần đuôi phía sau cursor
  if (commandHistoryCursor < commandHistoryStack.length - 1) {
    commandHistoryStack = commandHistoryStack.slice(0, commandHistoryCursor + 1);
  }

  // Tránh lưu trùng hệt bước ngay trước đó
  const prev = commandHistoryStack[commandHistoryStack.length - 1];
  if (
    prev &&
    prev.aiPrompt === snap.aiPrompt &&
    prev.trichYeu === snap.trichYeu &&
    prev.noiDung === snap.noiDung
  ) {
    return;
  }

  commandHistoryStack.push(snap);
  // Giới hạn tối đa 25 lệnh gần nhất
  if (commandHistoryStack.length > 25) {
    commandHistoryStack.shift();
  }
  commandHistoryCursor = commandHistoryStack.length - 1;

  try {
    localStorage.setItem(STORAGE_KEYS.CMD_HISTORY, JSON.stringify(commandHistoryStack));
  } catch (e) {}

  updateCmdHistoryUI();
}

function undoPreviousCommand() {
  // Nếu người dùng vừa sửa trên form mà chưa lưu snapshot hiện tại ở đầu mút, lưu lại để có thể Redo
  if (commandHistoryCursor === commandHistoryStack.length - 1) {
    const current = captureCurrentSnapshot("Bản đang soạn hiện tại");
    const top = commandHistoryStack[commandHistoryCursor];
    if (
      top &&
      (top.aiPrompt !== current.aiPrompt ||
        top.noiDung !== current.noiDung ||
        top.trichYeu !== current.trichYeu)
    ) {
      commandHistoryStack.push(current);
      commandHistoryCursor = commandHistoryStack.length - 1;
    }
  }

  if (commandHistoryCursor > 0) {
    commandHistoryCursor--;
    const snap = commandHistoryStack[commandHistoryCursor];
    applySnapshotToForm(snap);
    updateCmdHistoryUI();
    const statusEl = document.getElementById("aiStatusMessage");
    if (statusEl) {
      statusEl.style.display = "block";
      statusEl.textContent = `↩️ Đã quay lại lệnh trước đó (${snap.timestamp}): "${snap.label.slice(0, 60)}"`;
    }
  }
}

function redoNextCommand() {
  if (commandHistoryCursor < commandHistoryStack.length - 1) {
    commandHistoryCursor++;
    const snap = commandHistoryStack[commandHistoryCursor];
    applySnapshotToForm(snap);
    updateCmdHistoryUI();
    const statusEl = document.getElementById("aiStatusMessage");
    if (statusEl) {
      statusEl.style.display = "block";
      statusEl.textContent = `↪️ Đã tiến tới lệnh (${snap.timestamp}): "${snap.label.slice(0, 60)}"`;
    }
  }
}

function onSelectRecentCommand() {
  const select = document.getElementById("selectRecentCommands");
  const idx = parseInt(select.value, 10);
  if (isNaN(idx) || idx < 0 || idx >= commandHistoryStack.length) return;
  commandHistoryCursor = idx;
  const snap = commandHistoryStack[commandHistoryCursor];
  applySnapshotToForm(snap);
  updateCmdHistoryUI();
}

function updateCmdHistoryUI() {
  const btnUndo = document.getElementById("btnUndoCmd");
  const btnRedo = document.getElementById("btnRedoCmd");
  const indicator = document.getElementById("cmdStepIndicator");
  const select = document.getElementById("selectRecentCommands");

  if (btnUndo) btnUndo.disabled = commandHistoryCursor <= 0;
  if (btnRedo) btnRedo.disabled = commandHistoryCursor >= commandHistoryStack.length - 1;

  if (indicator) {
    indicator.textContent =
      commandHistoryStack.length > 0
        ? `Bước ${commandHistoryCursor + 1}/${commandHistoryStack.length}`
        : "";
  }

  if (select) {
    const options = [`<option value="">🕘 Chọn lại các lệnh trước đó (${commandHistoryStack.length})...</option>`];
    for (let i = commandHistoryStack.length - 1; i >= 0; i--) {
      const item = commandHistoryStack[i];
      const shortText = (item.aiPrompt || item.trichYeu || item.label || "Bản nháp").slice(0, 48);
      const selectedAttr = i === commandHistoryCursor ? "selected" : "";
      options.push(
        `<option value="${i}" ${selectedAttr}>[${item.timestamp}] ${escapeHtml(shortText)}</option>`
      );
    }
    select.innerHTML = options.join("");
  }
}

// ============================================================================
// 6B. ĐÍNH KÈM FILE, ĐỌC FILE (PDF, ẢNH, WORD .DOCX/.DOC, TEXT) & TRÍCH XUẤT
// ============================================================================
function onFileDragOver(e) {
  e.preventDefault();
  e.stopPropagation();
  document.getElementById("fileUploadDropzone")?.classList.add("dragover");
}

function onFileDragLeave(e) {
  e.preventDefault();
  e.stopPropagation();
  document.getElementById("fileUploadDropzone")?.classList.remove("dragover");
}

function onFileDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  document.getElementById("fileUploadDropzone")?.classList.remove("dragover");
  if (e.dataTransfer && e.dataTransfer.files) {
    handleFilesSelected(e.dataTransfer.files);
  }
}

async function handleFilesSelected(fileList) {
  if (!fileList || fileList.length === 0) return;

  const statusEl = document.getElementById("aiStatusMessage");
  statusEl.style.display = "block";
  statusEl.textContent = "⏳ Đang đọc file đính kèm trên trình duyệt...";

  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i];
    try {
      const processed = await processSingleAttachedFile(file);
      // Tránh trùng tên file đã có
      attachedFilesState = attachedFilesState.filter((f) => f.name !== processed.name);
      attachedFilesState.push(processed);
    } catch (err) {
      alert(`Không thể đọc file "${file.name}": ${err.message}`);
    }
  }

  document.getElementById("inputFileAttachment").value = "";
  renderAttachedFilesList();
  statusEl.textContent = `✅ Đã nạp ${attachedFilesState.length} file đính kèm. Bạn có thể bấm "🔍 Đọc File & Trích xuất thông tin" hoặc bấm "⚡ Tạo ngay văn bản".`;
}

async function processSingleAttachedFile(file) {
  const name = file.name;
  const ext = name.split(".").pop().toLowerCase();
  const sizeKB = Math.round(file.size / 1024);

  if (ext === "pdf" || file.type === "application/pdf") {
    const base64Data = await readFileAsBase64(file);
    return {
      id: "file_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
      name,
      sizeKB,
      mimeType: "application/pdf",
      kind: "pdf",
      base64Data,
      extractedText: ""
    };
  }

  if (["png", "jpg", "jpeg", "webp"].includes(ext) || file.type.startsWith("image/")) {
    const base64Data = await readFileAsBase64(file);
    const mimeType = file.type || (ext === "png" ? "image/png" : "image/jpeg");
    return {
      id: "file_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
      name,
      sizeKB,
      mimeType,
      kind: "image",
      base64Data,
      extractedText: ""
    };
  }

  if (ext === "docx") {
    const extractedText = await extractTextFromDocxFile(file);
    return {
      id: "file_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
      name,
      sizeKB,
      mimeType: "text/plain",
      kind: "text",
      base64Data: "",
      extractedText
    };
  }

  // Các file văn bản (.txt, .csv, .html, .doc dạng HTML/XML)
  const rawText = await readFileAsText(file);
  const cleanText = cleanHtmlOrXmlIfNeeded(rawText);
  return {
    id: "file_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
    name,
    sizeKB,
    mimeType: "text/plain",
    kind: "text",
    base64Data: "",
    extractedText: cleanText
  };
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const commaIdx = result.indexOf(",");
      resolve(commaIdx !== -1 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = () => reject(new Error("Lỗi khi đọc file Base64"));
    reader.readAsDataURL(file);
  });
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Lỗi khi đọc file văn bản"));
    reader.readAsText(file, "UTF-8");
  });
}

function cleanHtmlOrXmlIfNeeded(raw) {
  if (raw.includes("<html") || raw.includes("<w:WordDocument") || raw.includes("<body")) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(raw, "text/html");
    return (doc.body ? doc.body.innerText : raw).replace(/\n{3,}/g, "\n\n").trim();
  }
  return raw.trim();
}

// Giải nén và đọc trực tiếp nội dung chữ trong file Word (.docx) ngay trên trình duyệt
async function extractTextFromDocxFile(file) {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const view = new DataView(arrayBuffer);

  let offset = 0;
  while (offset + 30 < bytes.length) {
    const sig = view.getUint32(offset, true);
    if (sig !== 0x04034b50) break; // Local file header signature

    const compression = view.getUint16(offset + 8, true);
    const compressedSize = view.getUint32(offset + 18, true);
    const fileNameLen = view.getUint16(offset + 26, true);
    const extraLen = view.getUint16(offset + 28, true);

    const fileNameBytes = bytes.slice(offset + 30, offset + 30 + fileNameLen);
    const fileName = new TextDecoder("utf-8").decode(fileNameBytes);
    const dataStart = offset + 30 + fileNameLen + extraLen;
    const dataEnd = dataStart + compressedSize;

    if (fileName === "word/document.xml" && dataEnd <= bytes.length) {
      const compData = bytes.slice(dataStart, dataEnd);
      let xmlString = "";
      if (compression === 0) {
        xmlString = new TextDecoder("utf-8").decode(compData);
      } else if (compression === 8 && typeof DecompressionStream !== "undefined") {
        const ds = new DecompressionStream("deflate-raw");
        const writer = ds.writable.getWriter();
        writer.write(compData);
        writer.close();
        const decompressedBuf = await new Response(ds.readable).arrayBuffer();
        xmlString = new TextDecoder("utf-8").decode(decompressedBuf);
      }

      if (xmlString) {
        const withNewlines = xmlString
          .replace(/<\/w:p>/g, "\n")
          .replace(/<\/w:tr>/g, "\n")
          .replace(/<w:tab\/>/g, "\t");
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(withNewlines, "application/xml");
        return (xmlDoc.documentElement ? xmlDoc.documentElement.textContent : "")
          .replace(/\n{3,}/g, "\n\n")
          .trim();
      }
    }

    offset = dataEnd;
  }

  return "[Không trích xuất được văn bản tự động từ file .docx này, bạn có thể lưu sang PDF hoặc copy nội dung]";
}

function renderAttachedFilesList() {
  const listEl = document.getElementById("attachedFilesList");
  const btnExtract = document.getElementById("btnExtractFileOnly");

  if (!attachedFilesState || attachedFilesState.length === 0) {
    listEl.innerHTML = "";
    if (btnExtract) btnExtract.style.display = "none";
    document.getElementById("fileExtractionResultBox").style.display = "none";
    return;
  }

  if (btnExtract) btnExtract.style.display = "inline-flex";

  listEl.innerHTML = attachedFilesState
    .map((f) => {
      const icon = f.kind === "pdf" ? "📕 PDF" : f.kind === "image" ? "🖼️ Ảnh" : "📘 Văn bản";
      const previewInfo =
        f.kind === "text" && f.extractedText
          ? ` • Đã đọc ${f.extractedText.length} ký tự`
          : " • Sẵn sàng gửi AI đọc";
      return `
      <div class="file-item">
        <div class="file-item-info">
          <span><strong>${icon}:</strong></span>
          <span class="file-item-name" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</span>
          <span class="file-item-meta">(${f.sizeKB} KB${previewInfo})</span>
        </div>
        <button type="button" class="btn btn-sm btn-outline" onclick="removeAttachedFile('${f.id}')">✕ Xóa</button>
      </div>
    `;
    })
    .join("");
}

function removeAttachedFile(fileId) {
  attachedFilesState = attachedFilesState.filter((f) => f.id !== fileId);
  renderAttachedFilesList();
}

// Tạo mảng input đa phương thức (Multimodal input) cho Gemini Interactions API (/v1/interactions)
function buildInteractionsInputWithFiles(promptText) {
  if (!attachedFilesState || attachedFilesState.length === 0) {
    return promptText;
  }

  const inputBlocks = [];
  const textFileSnippets = [];

  attachedFilesState.forEach((f) => {
    if (f.kind === "pdf" && f.base64Data) {
      inputBlocks.push({
        type: "document",
        data: f.base64Data,
        mime_type: "application/pdf"
      });
    } else if (f.kind === "image" && f.base64Data) {
      inputBlocks.push({
        type: "image",
        data: f.base64Data,
        mime_type: f.mimeType || "image/jpeg"
      });
    } else if (f.kind === "text" && f.extractedText) {
      textFileSnippets.push(
        `--- NỘI DUNG FILE ĐÍNH KÈM "${f.name}" ---\n${f.extractedText.slice(0, 35000)}\n--- HẾT FILE "${f.name}" ---`
      );
    }
  });

  const combinedPrompt =
    textFileSnippets.length > 0
      ? `${textFileSnippets.join("\n\n")}\n\n${promptText}`
      : promptText;

  inputBlocks.push({
    type: "text",
    text: combinedPrompt
  });

  return inputBlocks;
}

// ĐỌC FILE & TRÍCH XUẤT THÔNG TIN LIÊN QUAN RA KHUNG KẾT QUẢ
async function extractRelevantContentFromFile() {
  if (!attachedFilesState || attachedFilesState.length === 0) {
    alert("Bạn hãy chọn ít nhất 1 file đính kèm trước nhé!");
    return;
  }

  const apiKey = getEffectiveApiKey();
  // Nếu chưa có API Key mà file là Word/Text đã đọc được trên trình duyệt, hiển thị ngay nội dung đọc được
  if (!apiKey) {
    const localTexts = attachedFilesState
      .filter((f) => f.extractedText)
      .map((f) => `[File: ${f.name}]\n${f.extractedText}`)
      .join("\n\n");
    if (localTexts) {
      lastExtractedSummaryText = localTexts;
      document.getElementById("fileExtractionTextContent").textContent = localTexts;
      document.getElementById("fileExtractionResultBox").style.display = "block";
      return;
    }
    openModal("apiModal");
    return;
  }

  const userFocus = document.getElementById("aiPromptInput").value.trim();
  const statusEl = document.getElementById("aiStatusMessage");
  const btnExtract = document.getElementById("btnExtractFileOnly");

  statusEl.style.display = "block";
  statusEl.textContent = "⏳ Gemini đang đọc file đính kèm và trích xuất các nội dung liên quan...";
  if (btnExtract) btnExtract.disabled = true;

  const extractPrompt = `
Bạn là Trợ lý Văn thư số của Phường Nam Hồng Lĩnh, tỉnh Hà Tĩnh.
Hãy đọc kỹ (các) tài liệu/hình ảnh đính kèm và trích xuất chính xác các thông tin sau (CHỈ lấy thông tin có thật trong file, TUYỆT ĐỐI KHÔNG TỰ ĐOÁN):
1. Số, ký hiệu, ngày tháng và cơ quan ban hành của văn bản gốc trong file (nếu có).
2. Trích yếu hoặc chủ đề chính của tài liệu.
3. Các nội dung, chỉ tiêu, số liệu, thời hạn hoặc nhiệm vụ trọng tâm có liên quan để Phường Nam Hồng Lĩnh đưa vào văn bản/báo cáo${userFocus ? ` (Lưu ý yêu cầu của người dùng: "${userFocus}")` : ""}.
4. Viết sẵn một đoạn văn bản hành chính tổng hợp nội dung từ file này để cán bộ văn thư có thể chèn trực tiếp vào văn bản của phường.

Trả về JSON theo cấu trúc:
{
  "trichYeuGoiY": "Trích yếu gợi ý từ file",
  "tomTatThongTinFile": "Bản tóm tắt rõ ràng số hiệu, ngày tháng, các ý chính và số liệu trích xuất từ file",
  "doanVanBanTrichXuat": "Đoạn văn hành chính hoàn chỉnh được trích xuất từ file để đưa vào văn bản của phường"
}
`;

  const extractSchema = {
    type: "object",
    properties: {
      trichYeuGoiY: { type: "string" },
      tomTatThongTinFile: { type: "string" },
      doanVanBanTrichXuat: { type: "string" }
    },
    required: ["trichYeuGoiY", "tomTatThongTinFile", "doanVanBanTrichXuat"]
  };

  try {
    const rawJson = await callGeminiApi(
      apiKey,
      getEffectiveModel(),
      buildInteractionsInputWithFiles(extractPrompt),
      extractSchema
    );
    const res = JSON.parse(rawJson);

    lastExtractedSummaryText = res.doanVanBanTrichXuat || res.tomTatThongTinFile || "";
    const displayContent = `📌 TÓM TẮT THÔNG TIN TRONG FILE:\n${res.tomTatThongTinFile}\n\n📝 ĐOẠN VĂN BẢN DỰ THẢO TRÍCH XUẤT TỪ FILE:\n${res.doanVanBanTrichXuat}`;

    document.getElementById("fileExtractionTextContent").textContent = displayContent;
    document.getElementById("fileExtractionResultBox").style.display = "block";

    if (res.trichYeuGoiY && !document.getElementById("inputTrichYeu").value.trim()) {
      document.getElementById("inputTrichYeu").value = res.trichYeuGoiY;
      renderDocumentPreview();
    }

    statusEl.textContent =
      "✅ Đã đọc file và trích xuất thông tin thành công! Bạn có thể bấm '⬇️ Đưa thẳng vào Nội dung văn bản' hoặc '⚡ Tạo ngay văn bản'.";
  } catch (err) {
    statusEl.textContent = `❌ Lỗi khi đọc file bằng Gemini: ${err.message}`;
  } finally {
    if (btnExtract) btnExtract.disabled = false;
  }
}

function insertExtractedTextToBody() {
  if (!lastExtractedSummaryText) return;
  pushCommandSnapshot("Trước khi chèn nội dung trích xuất từ file");
  const noiDungEl = document.getElementById("inputNoiDung");
  if (noiDungEl.value.trim()) {
    noiDungEl.value = noiDungEl.value.trim() + "\n\n" + lastExtractedSummaryText;
  } else {
    noiDungEl.value = lastExtractedSummaryText;
  }
  renderDocumentPreview();
  extractPlaceholdersAndAskOnWeb(noiDungEl.value);
  pushCommandSnapshot("Chèn nội dung trích xuất từ file đính kèm");
}

// ============================================================================
// 6C. KẾT NỐI GEMINI INTERACTIONS API (KIỂM TRA THÔNG TIN THIẾU & TẠO VĂN BẢN)
// ============================================================================
function getEffectiveApiKey() {
  const fromConfig =
    window.APP_CONFIG && window.APP_CONFIG.GEMINI_API_KEY
      ? window.APP_CONFIG.GEMINI_API_KEY.trim()
      : "";
  if (fromConfig) return fromConfig;
  return (localStorage.getItem(STORAGE_KEYS.API_KEY) || "").trim();
}

function getEffectiveModel() {
  const fromStorage = localStorage.getItem(STORAGE_KEYS.MODEL);
  if (fromStorage) return fromStorage;
  return (window.APP_CONFIG && window.APP_CONFIG.GEMINI_MODEL) || "gemini-4-hydrogen";
}

function checkApiStatus() {
  const key = getEffectiveApiKey();
  const model = getEffectiveModel();
  const dot = document.getElementById("apiStatusDot");
  const text = document.getElementById("apiStatusText");

  const modalKeyInput = document.getElementById("modalInputApiKey");
  const modalModelSelect = document.getElementById("modalSelectModel");
  if (modalKeyInput && key) modalKeyInput.value = key;
  if (modalModelSelect && model) modalModelSelect.value = model;

  if (key && key.length > 10) {
    dot.classList.add("connected");
    text.textContent = `Gemini (${model}): Đã sẵn sàng`;
  } else {
    dot.classList.remove("connected");
    text.textContent = "Gemini Pro: Chưa gắn API Key (Bấm để cài)";
  }
}

function saveApiConfigFromModal() {
  const key = document.getElementById("modalInputApiKey").value.trim();
  const model = document.getElementById("modalSelectModel").value;
  if (key) {
    localStorage.setItem(STORAGE_KEYS.API_KEY, key);
    removeWebQuestion("q_gemini_key");
  }
  localStorage.setItem(STORAGE_KEYS.MODEL, model);
  checkApiStatus();
  closeModal("apiModal");
}

function deleteSavedApiKey() {
  if (!confirm("Bạn có chắc muốn xóa khóa đã lưu trên máy này không?")) return;
  localStorage.removeItem(STORAGE_KEYS.API_KEY);
  const inp = document.getElementById("modalInputApiKey");
  if (inp) inp.value = "";
  checkApiStatus();
  alert("Đã xóa khóa. Lần sau dùng AI bạn cần nhập lại.");
}

async function testGeminiConnection() {
  const key = document.getElementById("modalInputApiKey").value.trim() || getEffectiveApiKey();
  const model = document.getElementById("modalSelectModel").value || getEffectiveModel();
  const box = document.getElementById("apiTestResultBox");
  box.style.display = "block";

  if (!key) {
    box.style.color = "#b91c1c";
    box.textContent = "❌ Bạn chưa nhập Gemini API Key!";
    return;
  }

  box.style.color = "#1e3a8a";
  box.textContent = `⏳ Đang kiểm tra kết nối tới ${model}...`;

  try {
    const reply = await callGeminiApi(
      key,
      model,
      "Hãy trả lời ngắn gọn 1 câu: Kết nối thành công với Hệ thống Văn thư Phường Nam Hồng Lĩnh."
    );
    box.style.color = "#15803d";
    box.textContent = `✅ Thành công: ${reply}`;
    localStorage.setItem(STORAGE_KEYS.API_KEY, key);
    localStorage.setItem(STORAGE_KEYS.MODEL, model);
    removeWebQuestion("q_gemini_key");
    checkApiStatus();
  } catch (err) {
    box.style.color = "#b91c1c";
    box.textContent = `❌ Lỗi kết nối: ${err.message}`;
  }
}

async function callGeminiApi(apiKey, model, inputPayload, jsonSchema = null) {
  const endpoint = `https://generativelanguage.googleapis.com/v1/interactions`;

  const payload = {
    model: model || "gemini-4-hydrogen",
    input: inputPayload,
    generation_config: {
      temperature: 0.25
    }
  };

  if (jsonSchema) {
    payload.response_format = {
      type: "text",
      mime_type: "application/json",
      schema: jsonSchema
    };
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  if (!res.ok) {
    const errMsg =
      data && data.error && data.error.message
        ? data.error.message
        : `HTTP ${res.status}`;
    throw new Error(errMsg);
  }

  // Trích xuất output_text từ mảng steps của Interactions API (steps có type === "model_output")
  if (typeof data.output_text === "string" && data.output_text) {
    return data.output_text;
  }

  if (Array.isArray(data.steps)) {
    const textParts = [];
    for (let i = data.steps.length - 1; i >= 0; i--) {
      const step = data.steps[i];
      if (step && step.type === "model_output" && Array.isArray(step.content)) {
        const stepTexts = step.content
          .filter((c) => c && c.type === "text" && typeof c.text === "string")
          .map((c) => c.text);
        textParts.unshift(...stepTexts);
      } else if (textParts.length > 0) {
        break;
      }
    }
    return textParts.join("");
  }

  return "";
}

// BƯỚC 1: GEMINI PHÂN TÍCH YÊU CẦU (+ FILE ĐÍNH KÈM NẾU CÓ) & HỎI LẠI NGƯỜI DÙNG PHẦN CÒN THIẾU
async function askGeminiForMissingInfo() {
  const apiKey = getEffectiveApiKey();
  if (!apiKey) {
    openModal("apiModal");
    return;
  }

  const userRequest = document.getElementById("aiPromptInput").value.trim();
  if (!userRequest && attachedFilesState.length === 0) {
    alert("Bạn hãy nhập yêu cầu tạo văn bản hoặc đính kèm file tài liệu trước nhé!");
    return;
  }

  // Lưu mốc trước khi chạy lệnh để có thể Quay lại lệnh trước
  pushCommandSnapshot(userRequest || "Kiểm tra thông tin thiếu");

  const statusEl = document.getElementById("aiStatusMessage");
  const btnCheck = document.getElementById("btnAiCheckMissing");
  statusEl.style.display = "block";
  statusEl.textContent = "⏳ Gemini đang phân tích yêu cầu và file đính kèm để xem có thông tin nào cần hỏi bạn...";
  btnCheck.disabled = true;

  const loai = document.getElementById("selectLoaiVanBan").value;
  const tenLoai = TEN_LOAI_VAN_BAN_MAP[loai] || "CÔNG VĂN";
  const coQuan = document.getElementById("inputIssuingOrg").value;
  const hasFilesNote =
    attachedFilesState.length > 0
      ? `Người dùng có đính kèm ${attachedFilesState.length} file tài liệu. Hãy đọc kỹ thông tin đã có trong file đính kèm để KHÔNG hỏi lại những gì đã có sẵn trong file.`
      : "";

  const systemPrompt = `
Bạn là Trợ lý Văn thư số của ${coQuan} (Phường Nam Hồng Lĩnh, tỉnh Hà Tĩnh).
Nguyên tắc tối thượng của người dùng:
- Chỉ dùng thông tin công khai đã biết của Phường Nam Hồng Lĩnh (Trụ sở: Số 92 đường Nguyễn Xuân Linh, phường Nam Hồng Lĩnh, tỉnh Hà Tĩnh; thành lập từ 01/7/2025 trên cơ sở sáp nhập phường Nam Hồng, phường Đậu Liêu, xã Thuận Lộc; Chủ tịch UBND: Tôn Quang Ngọc; PCT UBND: Võ Thanh Định; Bí thư Đảng ủy/CT HĐND: Nguyễn Hữu Khiếu; Phó Bí thư TT: Hoàng Bá Khang) và thông tin trong File đính kèm (nếu có).
- TUYỆT ĐỐI KHÔNG ĐƯỢC TỰ ĐOÁN hay tự bịa ra số liệu, thời gian, địa điểm, tên cán bộ, hay nội dung chưa có.
${hasFilesNote}

Người dùng đang yêu cầu tạo văn bản loại "${tenLoai}" với nội dung:
"""
${userRequest || "Trích xuất nội dung từ file đính kèm để soạn văn bản triển khai của phường Nam Hồng Lĩnh"}
"""

Hãy liệt kê từ 2 đến 4 câu hỏi ngắn gọn, thiết thực nhất để hỏi người dùng về những thông tin/số liệu cụ thể còn thiếu (mà trong cả yêu cầu lẫn file đính kèm đều chưa có).
Trả về kết quả ĐÚNG định dạng JSON sau:
{
  "questions": [
    { "id": "q1", "question": "Câu hỏi 1...", "placeholder": "Gợi ý trả lời..." },
    { "id": "q2", "question": "Câu hỏi 2...", "placeholder": "Gợi ý trả lời..." }
  ]
}
`;

  const clarifySchema = {
    type: "object",
    properties: {
      questions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            question: { type: "string" },
            placeholder: { type: "string" }
          },
          required: ["id", "question", "placeholder"]
        }
      }
    },
    required: ["questions"]
  };

  try {
    const rawJson = await callGeminiApi(
      apiKey,
      getEffectiveModel(),
      buildInteractionsInputWithFiles(systemPrompt),
      clarifySchema
    );
    const parsed = JSON.parse(rawJson);
    const questions = parsed.questions || [];

    const container = document.getElementById("aiClarifyContainer");
    const listEl = document.getElementById("aiClarifyQuestionsList");

    if (questions.length > 0) {
      container.style.display = "block";
      listEl.innerHTML = questions
        .map(
          (q, idx) => `
        <div style="margin-bottom: 8px;">
          <label style="display: block; font-size: 12.5px; font-weight: 600; color: #78350f; margin-bottom: 3px;">
            ${idx + 1}. ${escapeHtml(q.question)}
          </label>
          <input
            type="text"
            class="form-control ai-clarify-answer"
            data-question="${escapeHtml(q.question)}"
            placeholder="${escapeHtml(q.placeholder || "Nhập thông tin (hoặc để trống nếu muốn chừa chỗ [...] trên văn bản)")}"
          />
        </div>
      `
        )
        .join("");
      statusEl.textContent = "✅ Gemini đã liệt kê các thông tin cần hỏi bạn ở khung màu vàng phía trên.";
    } else {
      statusEl.textContent = "✅ Yêu cầu và file của bạn đã đầy đủ thông tin, bấm 'Tạo ngay văn bản' để tiếp tục.";
    }
  } catch (err) {
    statusEl.textContent = `❌ Lỗi khi gọi Gemini API: ${err.message}`;
  } finally {
    btnCheck.disabled = false;
  }
}

// BƯỚC 2: GEMINI SOẠN THẢO NỘI DUNG VĂN BẢN / BÁO CÁO TỪ LỆNH & FILE ĐÍNH KÈM
async function generateWithGemini(includeClarifications = false) {
  const apiKey = getEffectiveApiKey();
  if (!apiKey) {
    openModal("apiModal");
    return;
  }

  const userRequest = document.getElementById("aiPromptInput").value.trim();
  if (!userRequest && attachedFilesState.length === 0) {
    alert("Bạn hãy nhập yêu cầu tạo văn bản hoặc chọn file đính kèm trước nhé!");
    return;
  }

  // Lưu trạng thái hiện tại trước khi ghi đè văn bản mới (để nút Quay lại lệnh trước khôi phục được ngay)
  pushCommandSnapshot("Trước khi chạy lệnh: " + (userRequest || "Từ file đính kèm"));

  // Thu thập các câu trả lời làm rõ của người dùng (nếu có)
  let clarificationText = "";
  if (includeClarifications) {
    const answerInputs = document.querySelectorAll(".ai-clarify-answer");
    const pairs = [];
    answerInputs.forEach((inp) => {
      const q = inp.getAttribute("data-question");
      const a = inp.value.trim();
      pairs.push(`- Hỏi: ${q}\n  Trả lời của người dùng: ${a ? a : "(Chưa có số liệu, hãy để [CẦN ĐIỀN: ...] trong văn bản)"}`);
    });
    if (pairs.length > 0) {
      clarificationText = "\nThông tin bổ sung do người dùng trực tiếp cung cấp:\n" + pairs.join("\n");
    }
  }

  const loai = document.getElementById("selectLoaiVanBan").value;
  const tenLoai = TEN_LOAI_VAN_BAN_MAP[loai] || "CÔNG VĂN";
  const coQuan = document.getElementById("inputIssuingOrg").value;
  const selectedTdps = getSelectedTdpNames();
  const tdpContext =
    selectedTdps.length > 0
      ? `Các Tổ dân phố liên quan được chọn: ${selectedTdps.join(", ")}.`
      : `Các Tổ dân phố trên địa bàn phường gồm: ${getSavedTdpNames().join(", ")}.`;

  const fileInstruction =
    attachedFilesState.length > 0
      ? `\nĐẶC BIỆT: Người dùng có đính kèm ${attachedFilesState.length} file tài liệu (${attachedFilesState
          .map((f) => f.name)
          .join(", ")}). Bạn hãy ĐỌC KỸ nội dung trong các file đính kèm này và TRÍCH XUẤT các thông tin, số hiệu văn bản gốc, ngày tháng, số liệu, nhiệm vụ có liên quan để đưa chính xác vào văn bản của Phường Nam Hồng Lĩnh.`
      : "";

  const statusEl = document.getElementById("aiStatusMessage");
  const btnGen = document.getElementById("btnAiGenerate");
  statusEl.style.display = "block";
  statusEl.textContent = `⏳ Gemini (${getEffectiveModel()}) đang đọc yêu cầu${
    attachedFilesState.length > 0 ? " + file đính kèm" : ""
  } và soạn thảo văn bản chuẩn Nghị định 30/2020/NĐ-CP...`;
  btnGen.disabled = true;

  const prompt = `
Bạn là chuyên viên Văn thư - Tổng hợp cao cấp tại ${coQuan} (Phường Nam Hồng Lĩnh, tỉnh Hà Tĩnh).
Thông tin công khai chính xác của đơn vị:
- Tên đơn vị: Phường Nam Hồng Lĩnh, tỉnh Hà Tĩnh (thành lập từ 01/7/2025 theo NQ 1665/NQ-UBTVQH15 trên cơ sở sáp nhập phường Nam Hồng, phường Đậu Liêu và xã Thuận Lộc; mô hình chính quyền địa phương 2 cấp Tỉnh - Phường).
- Trụ sở: Số 92, đường Nguyễn Xuân Linh, phường Nam Hồng Lĩnh, tỉnh Hà Tĩnh.
- ${tdpContext}
${fileInstruction}

NGUYÊN TẮC BẮT BUỘC (KHÔNG ĐƯỢC VI PHẠM):
1. TUYỆT ĐỐI KHÔNG TỰ ĐOÁN hoặc tự bịa ra bất kỳ con số thống kê, ngày giờ họp, kinh phí, hay tên người nào không có trong thông tin được cung cấp hoặc trong file đính kèm.
2. Những chỗ nào cần số liệu thực tế hoặc thông tin chi tiết mà người dùng và file đính kèm chưa cung cấp, bạn BẮT BUỘC phải ghi rõ trong ngoặc vuông theo dạng: [CẦN ĐIỀN: mô tả thông tin cần điền] để người dùng dễ dàng nhìn thấy và điền vào.
3. Viết đúng văn phong hành chính công vụ Việt Nam theo Nghị định 30/2020/NĐ-CP.

Yêu cầu của người dùng:
- Loại văn bản cần tạo: ${tenLoai} (Mã: ${loai})
- Nội dung yêu cầu: """${userRequest || "Trích xuất thông tin liên quan từ file đính kèm để soạn thảo văn bản của Phường Nam Hồng Lĩnh."}"""
${clarificationText}

Hãy trả về kết quả ĐÚNG định dạng JSON sau:
{
  "loaiVanBanGoiY": "Mã loại văn bản phù hợp nhất trong (BC, CV, GM, TB, TTr, QD, KH)",
  "trichYeu": "Trích yếu nội dung văn bản ngắn gọn, chuẩn hành chính",
  "kinhGui": "Đơn vị hoặc đối tượng Kính gửi phù hợp",
  "noiDung": "Toàn bộ phần nội dung chính của văn bản (chia rõ các mục I, II, 1, 2 nếu là Báo cáo/Kế hoạch; mỗi đoạn cách nhau bằng ký tự xuống dòng \\n; KHÔNG lặp lại phần Quốc hiệu, Tiêu ngữ, Nơi nhận, Chữ ký vì phần đó biểu mẫu đã tự tạo).",
  "tomTatTrichXuatTuFile": "Tóm tắt ngắn gọn những thông tin bạn đã trích xuất từ file đính kèm (nếu có file đính kèm, nếu không có thì để chuỗi rỗng)",
  "cauHoiCanHoiThem": [
    "Liệt kê 1-2 thông tin cụ thể trong văn bản vừa tạo đang để ở dạng [CẦN ĐIỀN: ...] để trang web hiện hộp hỏi trực tiếp người dùng (nếu có)"
  ]
}
`;

  const docSchema = {
    type: "object",
    properties: {
      loaiVanBanGoiY: { type: "string" },
      trichYeu: { type: "string" },
      kinhGui: { type: "string" },
      noiDung: { type: "string" },
      tomTatTrichXuatTuFile: { type: "string" },
      cauHoiCanHoiThem: {
        type: "array",
        items: { type: "string" }
      }
    },
    required: ["loaiVanBanGoiY", "trichYeu", "kinhGui", "noiDung"]
  };

  try {
    const rawJson = await callGeminiApi(
      apiKey,
      getEffectiveModel(),
      buildInteractionsInputWithFiles(prompt),
      docSchema
    );
    const data = JSON.parse(rawJson);

    if (data.loaiVanBanGoiY && TEN_LOAI_VAN_BAN_MAP.hasOwnProperty(data.loaiVanBanGoiY)) {
      document.getElementById("selectLoaiVanBan").value = data.loaiVanBanGoiY;
      updateSoKyHieu();
    }

    if (data.trichYeu) {
      document.getElementById("inputTrichYeu").value = data.trichYeu;
    }

    if (data.kinhGui && !document.getElementById("inputKinhGui").value.trim()) {
      document.getElementById("inputKinhGui").value = data.kinhGui;
    }

    if (data.noiDung) {
      document.getElementById("inputNoiDung").value = data.noiDung;
    }

    if (data.tomTatTrichXuatTuFile && data.tomTatTrichXuatTuFile.trim()) {
      lastExtractedSummaryText = data.tomTatTrichXuatTuFile;
      document.getElementById("fileExtractionTextContent").textContent = data.tomTatTrichXuatTuFile;
      document.getElementById("fileExtractionResultBox").style.display = "block";
    }

    renderDocumentPreview();

    // Lưu mốc mới sau khi tạo xong để có thể Undo/Redo qua lại dễ dàng
    pushCommandSnapshot(userRequest || data.trichYeu || "Văn bản tạo từ Gemini");

    // Nếu trong văn bản có chỗ [CẦN ĐIỀN: ...], tự động đưa lên bảng hỏi trực tiếp trên Web để người dùng điền nhanh!
    extractPlaceholdersAndAskOnWeb(data.noiDung || "");

    statusEl.textContent = "✅ Đã tạo xong văn bản! Bạn có thể bấm '⬅️ Quay lại lệnh trước' nếu muốn hoàn tác về bản cũ.";
  } catch (err) {
    statusEl.textContent = `❌ Lỗi khi tạo văn bản với Gemini: ${err.message}`;
  } finally {
    btnGen.disabled = false;
  }
}

// Tự động tìm các vị trí [CẦN ĐIỀN: ...] trong văn bản và tạo ô hỏi trực tiếp trên Web để người dùng điền 1 chạm
function extractPlaceholdersAndAskOnWeb(bodyText) {
  const regex = /\[([^\]]+)\]/g;
  const matches = [];
  let match;
  while ((match = regex.exec(bodyText)) !== null) {
    const token = match[0]; // e.g. [CẦN ĐIỀN: số lượng hồ sơ]
    const inner = match[1];
    if (!matches.includes(token)) {
      matches.push({ token, inner });
    }
  }

  // Xóa các câu hỏi placeholder cũ
  activeWebQuestions = activeWebQuestions.filter((q) => !String(q.id).startsWith("q_ph_"));

  matches.slice(0, 4).forEach((item, idx) => {
    const qId = `q_ph_${idx}_${Date.now()}`;
    activeWebQuestions.push({
      id: qId,
      question: `Trong văn bản đang có mục chưa biết: "${item.inner}". Bạn muốn điền nội dung gì vào chỗ này?`,
      placeholder: `Nhập thông tin thay thế cho ${item.token}...`,
      type: "text",
      defaultValue: "",
      buttonText: "Điền vào văn bản",
      onAnswer: (val) => {
        if (!val.trim()) return;
        const currentBody = document.getElementById("inputNoiDung").value;
        document.getElementById("inputNoiDung").value = currentBody.split(item.token).join(val.trim());
        renderDocumentPreview();
        removeWebQuestion(qId);
      }
    });
  });

  renderWebQuestionsBanner();
}

// ============================================================================
// 7. TẠO KHUNG MẪU NHANH OFFLINE (KHÔNG CẦN API KEY)
// ============================================================================
function fillSamplePrompt() {
  const samples = [
    "Viết Báo cáo kết quả thực hiện công tác cải cách hành chính và chuyển đổi số tháng 11 năm 2026 của UBND phường Nam Hồng Lĩnh.",
    "Soạn Giấy mời Bí thư Chi bộ, Tổ trưởng các Tổ dân phố tham dự Hội nghị triển khai nhiệm vụ phát triển kinh tế - xã hội tháng 12/2026 tại Hội trường UBND phường Nam Hồng Lĩnh.",
    "Soạn Công văn của UBND phường Nam Hồng Lĩnh gửi các Tổ dân phố về việc tuyên truyền, hướng dẫn nhân dân thực hiện dịch vụ công trực tuyến và vệ sinh môi trường đô thị.",
    "Soạn Thông báo lịch tiếp công dân định kỳ của Chủ tịch UBND phường Nam Hồng Lĩnh tại trụ sở Số 92, đường Nguyễn Xuân Linh."
  ];
  const current = document.getElementById("aiPromptInput").value;
  const nextIdx = (samples.indexOf(current) + 1) % samples.length;
  document.getElementById("aiPromptInput").value = samples[nextIdx];
}

function generateOfflineTemplate() {
  pushCommandSnapshot("Trước khi tạo khung mẫu nhanh");
  const loai = document.getElementById("selectLoaiVanBan").value;
  const trichYeuEl = document.getElementById("inputTrichYeu");
  const kinhGuiEl = document.getElementById("inputKinhGui");
  const noiDungEl = document.getElementById("inputNoiDung");

  if (loai === "BC") {
    if (!trichYeuEl.value.trim()) {
      trichYeuEl.value = "Kết quả thực hiện nhiệm vụ công tác [CẦN ĐIỀN: tên lĩnh vực/tháng/quý] năm 2026";
    }
    if (!kinhGuiEl.value.trim()) {
      kinhGuiEl.value = "Ủy ban nhân dân tỉnh Hà Tĩnh;\nThường trực Đảng ủy - HĐND phường Nam Hồng Lĩnh";
    }
    noiDungEl.value = `Thực hiện chương trình công tác năm 2026 và văn bản chỉ đạo số [CẦN ĐIỀN: Số hiệu văn bản cấp trên], Ủy ban nhân dân phường Nam Hồng Lĩnh báo cáo kết quả thực hiện như sau:

I. CÔNG TÁC CHỈ ĐẠO, ĐIỀU HÀNH
1. Ngay sau khi tiếp nhận kế hoạch của cấp trên, UBND phường Nam Hồng Lĩnh đã ban hành các văn bản chỉ đạo, phân công nhiệm vụ cụ thể cho các phòng chuyên môn (Văn phòng HĐND và UBND, Phòng Kinh tế, Hạ tầng và Đô thị, Phòng Văn hóa - Xã hội, Trung tâm Phục vụ hành chính công) và Ban cán sự các Tổ dân phố trên địa bàn triển khai thực hiện.
2. Đẩy mạnh công tác tuyên truyền trên hệ thống truyền thanh và nhóm thông tin các Tổ dân phố.

II. KẾT QUẢ THỰC HIỆN CỤ THỂ
1. Về công tác chuyên môn:
- Tổng số hồ sơ/nhiệm vụ tiếp nhận trong kỳ: [CẦN ĐIỀN: Số lượng] hồ sơ/nhiệm vụ.
- Đã giải quyết đúng và trước hạn: [CẦN ĐIỀN: Số lượng] (đạt tỷ lệ [CẦN ĐIỀN: Tỷ lệ %]%).
2. Đánh giá chung:
- Ưu điểm: Cán bộ, công chức và các Tổ dân phố phối hợp chặt chẽ, kịp thời giải quyết nhu cầu của nhân dân.
- Tồn tại, hạn chế: [CẦN ĐIỀN: Nêu tồn tại, vướng mắc thực tế nếu có].

III. PHƯƠNG HƯỚNG, NHIỆM VỤ TRỌNG TÂM THỜI GIAN TỚI
1. Tiếp tục tăng cường kỷ luật, kỷ cương hành chính; đẩy mạnh ứng dụng chuyển đổi số trong giải quyết thủ tục hành chính tại phường Nam Hồng Lĩnh.
2. Giao các phòng chuyên môn và các Tổ dân phố hoàn thành các chỉ tiêu kế hoạch trước ngày [CẦN ĐIỀN: Ngày/tháng hoàn thành].

Trên đây là Báo cáo của UBND phường Nam Hồng Lĩnh, kính trình cấp trên xem xét, chỉ đạo./.`;
  } else if (loai === "GM") {
    if (!trichYeuEl.value.trim()) {
      trichYeuEl.value = "Dự hội nghị [CẦN ĐIỀN: Tên nội dung cuộc họp]";
    }
    if (!kinhGuiEl.value.trim()) {
      kinhGuiEl.value = "Đồng chí Tổ trưởng các Tổ dân phố trên địa bàn phường Nam Hồng Lĩnh";
    }
    noiDungEl.value = `Thực hiện chương trình công tác tháng [CẦN ĐIỀN: Tháng/năm], Ủy ban nhân dân phường Nam Hồng Lĩnh tổ chức hội nghị triển khai [CẦN ĐIỀN: Nội dung cuộc họp].

1. Thành phần trân trọng kính mời:
- Đại diện Thường trực Đảng ủy, HĐND, UBND, UBMTTQ phường;
- Trưởng, Phó các phòng chuyên môn thuộc UBND phường;
- Đồng chí Bí thư Chi bộ, Tổ trưởng các Tổ dân phố.

2. Thời gian: Bắt đầu vào lúc [CẦN ĐIỀN: Giờ, phút], ngày [CẦN ĐIỀN: Ngày/tháng/2026].

3. Địa điểm: Tại Hội trường UBND phường Nam Hồng Lĩnh (Số 92, đường Nguyễn Xuân Linh, phường Nam Hồng Lĩnh, tỉnh Hà Tĩnh).

4. Phân công chuẩn bị:
- Giao [CẦN ĐIỀN: Tên phòng/bộ phận] chuẩn bị tài liệu, báo cáo phục vụ hội nghị và điều kiện hậu cần.

Đề nghị các đại biểu bố trí công việc, tham dự đầy đủ, đúng thời gian quy định./.`;
  } else {
    if (!trichYeuEl.value.trim()) {
      trichYeuEl.value = "triển khai thực hiện [CẦN ĐIỀN: Nội dung công việc]";
    }
    if (!kinhGuiEl.value.trim()) {
      kinhGuiEl.value = "Các phòng chuyên môn thuộc phường; Ban cán sự các Tổ dân phố";
    }
    noiDungEl.value = `Thực hiện ý kiến chỉ đạo của cấp trên tại Văn bản số [CẦN ĐIỀN: Số hiệu văn bản], Ủy ban nhân dân phường Nam Hồng Lĩnh yêu cầu các đơn vị, cá nhân liên quan triển khai thực hiện tốt các nội dung sau:

1. Giao các phòng chuyên môn (Văn phòng HĐND và UBND, Phòng Kinh tế, Hạ tầng và Đô thị, Phòng Văn hóa - Xã hội) căn cứ chức năng, nhiệm vụ được giao chủ động tham mưu, hướng dẫn và đôn đốc thực hiện [CẦN ĐIỀN: Nội dung cụ thể].

2. Đề nghị Tổ trưởng các Tổ dân phố thông tin, tuyên truyền kịp thời đến toàn thể nhân dân trên địa bàn tổ dân phố biết và phối hợp thực hiện; tổng hợp kết quả báo cáo về UBND phường (qua [CẦN ĐIỀN: Tên phòng nhận báo cáo]) trước ngày [CẦN ĐIỀN: Hạn báo cáo].

Yêu cầu các đơn vị, Tổ dân phố nghiêm túc triển khai thực hiện./.`;
  }

  renderDocumentPreview();
  pushCommandSnapshot("Khung mẫu nhanh (" + loai + ")");
  extractPlaceholdersAndAskOnWeb(noiDungEl.value);
}

// ============================================================================
// 8. XUẤT FILE WORD (.DOC / .DOCX TƯƠNG THÍCH MICROSOFT WORD CHUẨN NĐ 30/2020)
// ============================================================================
function exportToWordDocx() {
  const pageContent = document.getElementById("a4DocumentPage").innerHTML;
  const trichYeu = document.getElementById("inputTrichYeu").value.trim() || "van-ban-nam-hong-linh";
  const loai = document.getElementById("selectLoaiVanBan").value;
  const ngay = document.getElementById("inputNgayThang").value || "2026";

  const wordDocumentHtml = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office'
          xmlns:w='urn:schemas-microsoft-com:office:word'
          xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset="utf-8">
      <title>Văn bản Phường Nam Hồng Lĩnh</title>
      <!--[if gte mso 9]>
      <xml>
        <w:WordDocument>
          <w:View>Print</w:View>
          <w:Zoom>100</w:Zoom>
          <w:DoNotOptimizeForBrowser/>
        </w:WordDocument>
      </xml>
      <![endif]-->
      <style>
        @page Section1 {
          size: 21.0cm 29.7cm;
          margin: 2.0cm 1.5cm 2.0cm 3.0cm;
          mso-header-margin: 1.0cm;
          mso-footer-margin: 1.0cm;
        }
        div.Section1 { page: Section1; }
        body {
          font-family: "Times New Roman", serif;
          font-size: 14pt;
          line-height: 1.35;
          color: #000000;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          border: none;
        }
        td {
          vertical-align: top;
          border: none;
          padding: 0;
        }
        .nd30-org-cell { width: 44%; text-align: center; font-size: 12.5pt; }
        .nd30-country-cell { width: 56%; text-align: center; font-size: 12.5pt; }
        .nd30-parent-org { text-transform: uppercase; font-size: 12pt; }
        .nd30-issuing-org { font-weight: bold; text-transform: uppercase; font-size: 12.5pt; }
        .nd30-quoc-hieu { font-weight: bold; text-transform: uppercase; font-size: 12.5pt; }
        .nd30-tieu-ngu { font-weight: bold; font-size: 13.5pt; }
        .nd30-so-ky-hieu { font-size: 13pt; margin-top: 6pt; }
        .nd30-vv-congvan { font-size: 12pt; margin-top: 4pt; }
        .nd30-ngay-thang { font-style: italic; font-size: 13.5pt; margin-top: 6pt; }
        .nd30-ten-loai-vb { text-align: center; font-weight: bold; font-size: 14pt; text-transform: uppercase; margin-top: 14pt; }
        .nd30-trich-yeu-vb { text-align: center; font-weight: bold; font-size: 14pt; margin-bottom: 10pt; }
        .nd30-kinh-gui { margin: 10pt 0; font-size: 14pt; text-indent: 1.0cm; }
        .nd30-body-content p { text-align: justify; text-indent: 1.0cm; margin: 0 0 6pt 0; font-size: 14pt; }
        .nd30-body-content .section-heading { font-weight: bold; text-indent: 0; margin-top: 8pt; margin-bottom: 4pt; }
        .nd30-noi-nhan-cell { width: 48%; font-size: 11pt; }
        .nd30-noi-nhan-title { font-weight: bold; font-style: italic; font-size: 12pt; }
        .nd30-chu-ky-cell { width: 52%; text-align: center; font-size: 13.5pt; }
        .nd30-quyen-han-ky, .nd30-chuc-vu-ky, .nd30-ho-ten-ky { font-weight: bold; }
        .nd30-khoang-trong-ky { height: 80pt; }
      </style>
    </head>
    <body>
      <div class="Section1">
        ${pageContent}
      </div>
    </body>
    </html>
  `;

  const blob = new Blob(["\ufeff", wordDocumentHtml], {
    type: "application/msword;charset=utf-8"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const safeSlug = trichYeu
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 45);

  a.href = url;
  a.download = `${ngay}_${loai}_${safeSlug || "nam-hong-linh"}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ============================================================================
// 9. LƯU LỊCH SỬ & SỔ VĂN BẢN ĐÃ TẠO
// ============================================================================
function getHistoryList() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.HISTORY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return [];
}

function saveDocumentToHistory() {
  const list = getHistoryList();
  const item = {
    id: "doc_" + Date.now(),
    createdAt: new Date().toISOString(),
    coQuanMa: document.getElementById("selectCoQuan").value,
    toggleParentOrg: document.getElementById("toggleParentOrg").checked,
    parentOrg: document.getElementById("inputParentOrg").value,
    issuingOrg: document.getElementById("inputIssuingOrg").value,
    loaiVanBan: document.getElementById("selectLoaiVanBan").value,
    soVanBan: document.getElementById("inputSoVanBan").value,
    maBoPhan: document.getElementById("inputMaBoPhan").value,
    kyHieuFull: document.getElementById("inputKyHieuFull").value,
    diaDanh: document.getElementById("inputDiaDanh").value,
    ngayThang: document.getElementById("inputNgayThang").value,
    trichYeu: document.getElementById("inputTrichYeu").value,
    kinhGui: document.getElementById("inputKinhGui").value,
    noiDung: document.getElementById("inputNoiDung").value,
    noiNhan: document.getElementById("inputNoiNhan").value,
    quyenHanKy: document.getElementById("inputQuyenHanKy").value,
    chucVuKy: document.getElementById("inputChucVuKy").value,
    hoTenKy: document.getElementById("inputHoTenKy").value
  };

  list.unshift(item);
  localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(list));
  updateHistoryBadge();
  alert("✅ Đã lưu văn bản vào Sổ lịch sử trên trình duyệt!");
}

function updateHistoryBadge() {
  const list = getHistoryList();
  const badge = document.getElementById("historyCountBadge");
  if (badge) badge.textContent = list.length;
  renderHistoryTable();
}

function renderHistoryTable() {
  const tbody = document.getElementById("historyTableBody");
  if (!tbody) return;
  const query = (document.getElementById("searchHistoryInput")?.value || "").toLowerCase();
  const list = getHistoryList().filter((item) => {
    if (!query) return true;
    return (
      (item.kyHieuFull || "").toLowerCase().includes(query) ||
      (item.trichYeu || "").toLowerCase().includes(query) ||
      (item.ngayThang || "").toLowerCase().includes(query) ||
      (item.hoTenKy || "").toLowerCase().includes(query)
    );
  });

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #64748b; padding: 18px;">Chưa có văn bản nào được lưu trong lịch sử.</td></tr>`;
    return;
  }

  tbody.innerHTML = list
    .map(
      (item) => `
    <tr>
      <td>${escapeHtml(item.ngayThang || "")}</td>
      <td><strong>${escapeHtml(item.kyHieuFull || "")}</strong></td>
      <td>${escapeHtml(item.loaiVanBan || "")}</td>
      <td>${escapeHtml(item.trichYeu || "(Chưa nhập trích yếu)")}</td>
      <td>${escapeHtml(item.hoTenKy || "")}</td>
      <td style="white-space: nowrap;">
        <button class="btn btn-sm btn-primary" onclick="loadDocumentFromHistory('${item.id}')">📂 Mở lại</button>
        <button class="btn btn-sm btn-outline" onclick="deleteHistoryItem('${item.id}')">🗑️</button>
      </td>
    </tr>
  `
    )
    .join("");
}

function loadDocumentFromHistory(id) {
  const list = getHistoryList();
  const item = list.find((d) => d.id === id);
  if (!item) return;

  document.getElementById("selectCoQuan").value = item.coQuanMa || "UBND";
  document.getElementById("toggleParentOrg").checked = !!item.toggleParentOrg;
  document.getElementById("parentOrgGroup").style.display = item.toggleParentOrg ? "block" : "none";
  document.getElementById("inputParentOrg").value = item.parentOrg || "";
  document.getElementById("inputIssuingOrg").value = item.issuingOrg || "";
  document.getElementById("selectLoaiVanBan").value = item.loaiVanBan || "BC";
  document.getElementById("inputSoVanBan").value = item.soVanBan || "";
  document.getElementById("inputMaBoPhan").value = item.maBoPhan || "";
  document.getElementById("inputKyHieuFull").value = item.kyHieuFull || "";
  document.getElementById("inputDiaDanh").value = item.diaDanh || "Nam Hồng Lĩnh";
  document.getElementById("inputNgayThang").value = item.ngayThang || "";
  document.getElementById("inputTrichYeu").value = item.trichYeu || "";
  document.getElementById("inputKinhGui").value = item.kinhGui || "";
  document.getElementById("inputNoiDung").value = item.noiDung || "";
  document.getElementById("inputNoiNhan").value = item.noiNhan || "";
  document.getElementById("inputQuyenHanKy").value = item.quyenHanKy || "";
  document.getElementById("inputChucVuKy").value = item.chucVuKy || "";
  document.getElementById("inputHoTenKy").value = item.hoTenKy || "";

  renderDocumentPreview();
  closeModal("historyModal");
}

function deleteHistoryItem(id) {
  const list = getHistoryList().filter((d) => d.id !== id);
  localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(list));
  updateHistoryBadge();
}

function exportHistoryToCSV() {
  const list = getHistoryList();
  if (list.length === 0) {
    alert("Chưa có dữ liệu trong sổ lịch sử để xuất Excel!");
    return;
  }

  const headers = ["STT", "Ngày ban hành", "Số & Ký hiệu", "Loại VB", "Trích yếu nội dung", "Kính gửi", "Người ký"];
  const rows = list.map((item, idx) => [
    idx + 1,
    item.ngayThang || "",
    item.kyHieuFull || "",
    item.loaiVanBan || "",
    item.trichYeu || "",
    (item.kinhGui || "").replace(/\n/g, "; "),
    item.hoTenKy || ""
  ]);

  const csvContent =
    "\uFEFF" +
    [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\r\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `So-van-ban-Nam-Hong-Linh-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ============================================================================
// TIỆN ÍCH CHUNG (MODALS, RESET, ESCAPE HTML)
// ============================================================================
function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add("open");
  if (id === "historyModal") renderHistoryTable();
  if (id === "directoryModal") renderSignerDirectoryTable();
  if (id === "tdpModal") {
    const area = document.getElementById("tdpBulkTextarea");
    if (area) area.value = getSavedTdpNames().join("\n");
  }
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove("open");
}

function resetForm() {
  pushCommandSnapshot("Trước khi làm mới biểu mẫu");
  document.getElementById("inputSoVanBan").value = "";
  document.getElementById("inputTrichYeu").value = "";
  document.getElementById("inputKinhGui").value = "";
  document.getElementById("inputNoiDung").value = "";
  selectAllTdp(false);
  updateSoKyHieu();
  renderDocumentPreview();
  pushCommandSnapshot("Biểu mẫu mới");
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

