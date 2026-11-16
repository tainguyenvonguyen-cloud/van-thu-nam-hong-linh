/**
 * ============================================================================
 * FILE CẤU HÌNH HỆ THỐNG VĂN THƯ SỐ - PHƯỜNG NAM HỒNG LĨNH, TỈNH HÀ TĨNH
 * ============================================================================
 * Hướng dẫn:
 * Bạn hãy dán khóa Gemini API Key của bạn vào giữa cặp dấu nháy kép ở dòng
 * GEMINI_API_KEY bên dưới rồi lưu file lại (Ctrl + S).
 */

window.APP_CONFIG = {
  // 1. DÁN KHÓA GEMINI API KEY CỐ ĐỊNH CỦA BẠN VÀO ĐÂY:
  GEMINI_API_KEY: "",

  // 2. MODEL GEMINI SỬ DỤNG MẶC ĐỊNH (Chuẩn Gemini 4 Interactions API):
  // Có thể chọn: "gemini-4-hydrogen", "gemini-4-argon", "gemini-4-carbon", hoặc "gemini-3.5-flash-lite"
  GEMINI_MODEL: "gemini-4-hydrogen",

  // 3. THÔNG TIN CÔNG KHAI CỦA ĐƠN VỊ (Theo Cổng TTĐT tỉnh Hà Tĩnh & NQ 1665/NQ-UBTVQH15):
  DON_VI: {
    tenPhuong: "Nam Hồng Lĩnh",
    tinh: "Hà Tĩnh",
    diaDanhVanBan: "Nam Hồng Lĩnh",
    truSo: "Số 92, đường Nguyễn Xuân Linh, phường Nam Hồng Lĩnh, tỉnh Hà Tĩnh",
    ngayThanhLap: "01/07/2025",
    donViSapNhap: ["Phường Nam Hồng", "Phường Đậu Liêu", "Xã Thuận Lộc"]
  },

  // 4. DANH SÁCH LÃNH ĐẠO ĐÃ ĐƯỢC CÔNG KHAI TRÊN CỔNG THÔNG TIN ĐIỆN TỬ:
  // (Những chức danh khác chưa có trên mạng, hệ thống sẽ hỏi trực tiếp bạn trên Web, tuyệt đối không tự đoán)
  LANH_DAO_CONG_KHAI: [
    {
      id: "ld_ct_ubnd",
      hoTen: "Tôn Quang Ngọc",
      chucVu: "Chủ tịch UBND phường",
      coQuan: "UBND",
      quyenHanKy: "TM. ỦY BAN NHÂN DÂN",
      chucVuKy: "CHỦ TỊCH"
    },
    {
      id: "ld_pct_ubnd_1",
      hoTen: "Võ Thanh Định",
      chucVu: "Phó Chủ tịch UBND phường",
      coQuan: "UBND",
      quyenHanKy: "TM. ỦY BAN NHÂN DÂN\nKT. CHỦ TỊCH",
      chucVuKy: "PHÓ CHỦ TỊCH"
    },
    {
      id: "ld_bt_hdnd",
      hoTen: "Nguyễn Hữu Khiếu",
      chucVu: "Bí thư Đảng ủy - Chủ tịch HĐND phường",
      coQuan: "HDND",
      quyenHanKy: "TM. THƯỜNG TRỰC HĐND",
      chucVuKy: "CHỦ TỊCH"
    },
    {
      id: "ld_bt_danguy",
      hoTen: "Nguyễn Hữu Khiếu",
      chucVu: "Bí thư Đảng ủy phường",
      coQuan: "DANGUY",
      quyenHanKy: "T/M BAN THƯỜNG VỤ",
      chucVuKy: "BÍ THƯ"
    },
    {
      id: "ld_pbttt_danguy",
      hoTen: "Hoàng Bá Khang",
      chucVu: "Phó Bí thư Thường trực Đảng ủy",
      coQuan: "DANGUY",
      quyenHanKy: "T/M BAN THƯỜNG VỤ\nKT. BÍ THƯ",
      chucVuKy: "PHÓ BÍ THƯ THƯỜNG TRỰC"
    }
  ],

  // 5. CÁC CƠ QUAN / PHÒNG BAN CHUYÊN MÔN CÔNG KHAI:
  CO_QUAN_BAN_HANH: [
    {
      ma: "UBND",
      tenHienThi: "UBND phường Nam Hồng Lĩnh",
      dongCapTrenMacDinh: "",
      batDongCapTrenMacDinh: false,
      dongTenCoQuan: "ỦY BAN NHÂN DÂN\nPHƯỜNG NAM HỒNG LĨNH",
      kyHieuCoQuan: "UBND"
    },
    {
      ma: "HDND",
      tenHienThi: "HĐND phường Nam Hồng Lĩnh",
      dongCapTrenMacDinh: "",
      batDongCapTrenMacDinh: false,
      dongTenCoQuan: "HỘI ĐỒNG NHÂN DÂN\nPHƯỜNG NAM HỒNG LĨNH",
      kyHieuCoQuan: "HĐND"
    },
    {
      ma: "DANGUY",
      tenHienThi: "Đảng ủy phường Nam Hồng Lĩnh",
      dongCapTrenMacDinh: "TỈNH ỦY HÀ TĨNH",
      batDongCapTrenMacDinh: true,
      dongTenCoQuan: "ĐẢNG ỦY PHƯỜNG NAM HỒNG LĨNH\n*",
      kyHieuCoQuan: "ĐU"
    },
    {
      ma: "UBMTTQ",
      tenHienThi: "Ủy ban MTTQ Việt Nam phường Nam Hồng Lĩnh",
      dongCapTrenMacDinh: "MẶT TRẬN TỔ QUỐC VIỆT NAM",
      batDongCapTrenMacDinh: true,
      dongTenCoQuan: "ỦY BAN MTTQ VIỆT NAM\nPHƯỜNG NAM HỒNG LĨNH",
      kyHieuCoQuan: "MTTQ-BTT"
    },
    {
      ma: "VP",
      tenHienThi: "Văn phòng HĐND và UBND phường",
      dongCapTrenMacDinh: "UBND PHƯỜNG NAM HỒNG LĨNH",
      batDongCapTrenMacDinh: true,
      dongTenCoQuan: "VĂN PHÒNG HĐND VÀ UBND",
      kyHieuCoQuan: "VP"
    },
    {
      ma: "KTHTDT",
      tenHienThi: "Phòng Kinh tế, Hạ tầng và Đô thị",
      dongCapTrenMacDinh: "UBND PHƯỜNG NAM HỒNG LĨNH",
      batDongCapTrenMacDinh: true,
      dongTenCoQuan: "PHÒNG KINH TẾ, HẠ TẦNG\nVÀ ĐÔ THỊ",
      kyHieuCoQuan: "KTHTĐT"
    },
    {
      ma: "VHXH",
      tenHienThi: "Phòng Văn hóa - Xã hội",
      dongCapTrenMacDinh: "UBND PHƯỜNG NAM HỒNG LĨNH",
      batDongCapTrenMacDinh: true,
      dongTenCoQuan: "PHÒNG VĂN HÓA - XÃ HỘI",
      kyHieuCoQuan: "VHXH"
    },
    {
      ma: "TTPVHCC",
      tenHienThi: "Trung tâm Phục vụ hành chính công",
      dongCapTrenMacDinh: "UBND PHƯỜNG NAM HỒNG LĨNH",
      batDongCapTrenMacDinh: true,
      dongTenCoQuan: "TRUNG TÂM PHỤC VỤ\nHÀNH CHÍNH CÔNG",
      kyHieuCoQuan: "TTPVHCC"
    }
  ]
};

