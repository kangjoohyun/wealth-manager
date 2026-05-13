import React, { useState, useCallback, useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Legend, BarChart, Bar } from "recharts";

// ─────────────────────────────────────────────
// 상수 & 데이터 모델
// ─────────────────────────────────────────────
const DEFAULT_INCOME_CATS = [
  { id: "regular_income", label: "정기수입", color: "#4F86C6", isIncome: true, isRegular: true },
  { id: "irregular_income", label: "비정기수입", color: "#82C596", isIncome: true, isRegular: false },
];
const DEFAULT_EXPENSE_CATS = [
  { id: "fixed", label: "고정지출", color: "#4F86C6", isIncome: false, isRegular: true },
  { id: "financial_cost", label: "금융비용", color: "#E85D75", isIncome: false, isRegular: true },
  { id: "savings", label: "저축", color: "#82C596", isIncome: false, isRegular: true },
  { id: "pension_exp", label: "연금", color: "#E8A87C", isIncome: false, isRegular: true },
  { id: "living", label: "생활비", color: "#9B6FD4", isIncome: false, isRegular: true },
  { id: "irregular", label: "비정기지출", color: "#F0C040", isIncome: false, isRegular: false },
];

const DEFAULT_DATA = {
  members: [
    { id: "m1", name: "강주현", color: "#4F86C6" },
    { id: "m2", name: "문채원", color: "#E8A87C" },
    { id: "m3", name: "강하겸", color: "#82C596" },
  ],
  realEstate: [],
  accounts: [],
  loans: [],
  incomeExpensePlans: [],
  monthlyActuals: [],
  balanceSheetSnapshots: [],
  accountBook: [],
  incomeCategories: DEFAULT_INCOME_CATS,
  expenseCategories: DEFAULT_EXPENSE_CATS,
  mumuPorts: [],
  mumuCycles: [],
};

const ACCOUNT_CATEGORIES = [
  { value: "cash", label: "현금/예금", color: "#4F86C6" },
  { value: "domestic_stock", label: "주식(국내)", color: "#E85D75" },
  { value: "foreign_stock_etf", label: "주식(해외/ETF)", color: "#E85D75" },
  { value: "pension", label: "연금", color: "#E8A87C" },
  { value: "fund", label: "펀드", color: "#82C596" },
  { value: "other", label: "기타", color: "#A0A0A0" },
];
// 주식 통합 표시용
const DISPLAY_CATEGORIES = [
  { value: "cash", label: "현금/예금", color: "#4F86C6" },
  { value: "stock", label: "주식", color: "#E85D75" },
  { value: "pension", label: "연금", color: "#E8A87C" },
  { value: "fund", label: "펀드", color: "#82C596" },
  { value: "other", label: "기타", color: "#A0A0A0" },
];
const toDisplayCat = (cat) => (cat === "domestic_stock" || cat === "foreign_stock_etf") ? "stock" : cat;

const INCOME_CATEGORIES = [
  { value: "regular_income", label: "정기수입", color: "#4F86C6", isIncome: true },
  { value: "irregular_income", label: "비정기수입", color: "#82C596", isIncome: true },
];

const EXPENSE_CATEGORIES = [
  { value: "fixed", label: "고정지출", color: "#4F86C6" },
  { value: "financial_cost", label: "금융비용", color: "#E85D75" },
  { value: "savings", label: "저축", color: "#82C596" },
  { value: "pension_exp", label: "연금", color: "#E8A87C" },
  { value: "living", label: "생활비", color: "#9B6FD4" },
  { value: "irregular", label: "비정기지출", color: "#F0C040" },
];

const REGULAR_INCOME_CATS = INCOME_CATEGORIES.filter(c => c.value === "regular_income");
const IRREGULAR_INCOME_CATS = INCOME_CATEGORIES.filter(c => c.value === "irregular_income");
const REGULAR_EXPENSE_CATS = EXPENSE_CATEGORIES.filter(c => c.value !== "irregular");
const IRREGULAR_EXPENSE_CATS = EXPENSE_CATEGORIES.filter(c => c.value === "irregular");
const ALL_PLAN_CATEGORIES = [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES];
const REGULAR_CATEGORIES = [...REGULAR_INCOME_CATS, ...REGULAR_EXPENSE_CATS];

// 데이터 기반 카테고리 헬퍼 (customCategories 있으면 그거 사용)
const getIncomeCats = (data) => (data.incomeCategories||DEFAULT_INCOME_CATS).map(c=>({...c, value:c.id}));
const getExpenseCats = (data) => (data.expenseCategories||DEFAULT_EXPENSE_CATS).map(c=>({...c, value:c.id}));
const getAllCats = (data) => [...getIncomeCats(data), ...getExpenseCats(data)];
const getRegularCats = (data) => getAllCats(data).filter(c=>c.isRegular);
const getIrregularCats = (data) => getAllCats(data).filter(c=>!c.isRegular);
const getRegularExpCats = (data) => getExpenseCats(data).filter(c=>c.isRegular);
const getIrregularExpCats = (data) => getExpenseCats(data).filter(c=>!c.isRegular);
const MEMBER_COLORS = ["#4F86C6","#E8A87C","#82C596","#E85D75","#9B6FD4","#F0C040","#5BC8C0","#C87060"];

// ─────────────────────────────────────────────
// 스토리지
// ─────────────────────────────────────────────
const STORAGE_KEY = "wealth_manager_v2";
const GAS_URL = "https://script.google.com/macros/s/AKfycbx7kmdJuLA2ZKAPDW8Ip37xogGYmG4n5nlOl0Z6teL1R5lUEl2JUE96htjYA-0p3h5MZg/exec";

// Google Sheets 동기화
const syncToSheets = async (data) => {
  try {
    await fetch(GAS_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return true;
  } catch (e) {
    console.error("Sheets 저장 실패:", e);
    return false;
  }
};

const syncFromSheets = async () => {
  try {
    const res = await fetch(GAS_URL + "?t=" + Date.now());
    const text = await res.text();
    if (!text || text === "{}") return null;
    return JSON.parse(text);
  } catch (e) {
    console.error("Sheets 불러오기 실패:", e);
    return null;
  }
};
const loadData = () => {
  try { const r = localStorage.getItem(STORAGE_KEY); return r ? { ...DEFAULT_DATA, ...JSON.parse(r) } : DEFAULT_DATA; }
  catch { return DEFAULT_DATA; }
};
const saveData = (d) => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch {} };
const genId = () => Math.random().toString(36).slice(2, 10);

// ─────────────────────────────────────────────
// 유틸
// ─────────────────────────────────────────────
const fmt = (n) => n == null ? "-" : "₩" + Number(n).toLocaleString();
const fmtShort = (n) => {
  if (n == null) return "-";
  const abs = Math.abs(n);
  if (abs >= 1e8) return (n < 0 ? "-" : "") + (abs / 1e8).toFixed(1) + "억";
  if (abs >= 1e4) return (n < 0 ? "-" : "") + Math.round(abs / 1e4) + "만";
  return fmt(n);
};
const thisYearMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; };
const ymLabel = (ym) => { const [y,m] = ym.split("-"); return `${y}.${m}`; };

// ─────────────────────────────────────────────
// 공통 UI
// ─────────────────────────────────────────────
const Card = ({ children, className = "" }) => (
  <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-5 ${className}`}>{children}</div>
);
const SectionTitle = ({ children }) => (
  <h2 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">{children}</h2>
);
const Badge = ({ color, label }) => (
  <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: color + "22", color }}>{label}</span>
);
const Btn = ({ onClick, children, variant = "primary", size = "md", className = "", disabled = false }) => {
  const base = "inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-150 disabled:opacity-40 cursor-pointer";
  const v = { primary: "bg-[#1a2744] text-white hover:bg-[#243563] active:scale-95", secondary: "bg-gray-100 text-gray-700 hover:bg-gray-200 active:scale-95", danger: "bg-red-50 text-red-600 hover:bg-red-100 active:scale-95", ghost: "text-gray-500 hover:bg-gray-100 active:scale-95", success: "bg-green-50 text-green-700 hover:bg-green-100 active:scale-95" };
  const s = { sm: "px-3 py-1.5 text-xs", md: "px-4 py-2 text-sm", lg: "px-6 py-3 text-base" };
  return <button onClick={onClick} disabled={disabled} className={`${base} ${v[variant]} ${s[size]} ${className}`}>{children}</button>;
};
const Inp = ({ label, value, onChange, type = "text", placeholder = "", required = false, className = "" }) => (
  <div className={`flex flex-col gap-1 ${className}`}>
    {label && <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}{required && <span className="text-red-400 ml-0.5">*</span>}</label>}
    <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#1a2744]/30 focus:border-[#1a2744] transition" />
  </div>
);
const Sel = ({ label, value, onChange, options, className = "" }) => (
  <div className={`flex flex-col gap-1 ${className}`}>
    {label && <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</label>}
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#1a2744]/30 bg-white transition">
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
);
const Modal = ({ open, onClose, title, children, wide = false }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }}>
      <div className={`bg-white rounded-2xl shadow-2xl w-full ${wide ? "max-w-2xl" : "max-w-md"} max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <span className="font-bold text-gray-800 text-base">{title}</span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
};
const Confirm = ({ open, message, onConfirm, onCancel }) => (
  <Modal open={open} onClose={onCancel} title="확인">
    <p className="text-sm text-gray-700 mb-5">{message}</p>
    <div className="flex gap-2 justify-end"><Btn variant="secondary" onClick={onCancel}>취소</Btn><Btn variant="danger" onClick={onConfirm}>삭제</Btn></div>
  </Modal>
);

// ─────────────────────────────────────────────
// CSV 내보내기 유틸
// ─────────────────────────────────────────────
const toCSV = (rows) => {
  return rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
};
const downloadCSV = (filename, rows) => {
  const bom = "\uFEFF";
  const b = new Blob([bom + toCSV(rows)], { type: "text/csv;charset=utf-8;" });
  const u = URL.createObjectURL(b);
  const a = document.createElement("a"); a.href = u; a.download = filename; a.click();
};

// ─────────────────────────────────────────────
// 설정
// ─────────────────────────────────────────────
const SettingsSection = ({ data, setData }) => {
  const [mm, setMm] = useState(false);
  const [em, setEm] = useState(null);
  const [form, setForm] = useState({ name: "", color: MEMBER_COLORS[0] });
  const [cd, setCd] = useState(null);

  // Claude Vision 파싱 (다중 이미지)
  const [visionModal, setVisionModal] = useState(false);
  const [visionImgs, setVisionImgs] = useState([]); // [{b64, type, name}]
  const [visionResult, setVisionResult] = useState(null);
  const [visionLoading, setVisionLoading] = useState(false);
  const [visionProgress, setVisionProgress] = useState(""); // 진행상황 텍스트
  const [visionError, setVisionError] = useState("");
  const [visionMember, setVisionMember] = useState(data.members[0]?.id || "");

  const open = (m) => { setEm(m||null); setForm(m ? { name: m.name, color: m.color } : { name: "", color: MEMBER_COLORS[0] }); setMm(true); };
  const save = () => { if (!form.name.trim()) return; setData((d) => ({ ...d, members: em ? d.members.map((m) => m.id === em.id ? { ...m, ...form } : m) : [...d.members, { id: genId(), ...form }] })); setMm(false); };

  // 다중 이미지 → base64 배열
  const handleImgUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setVisionResult(null);
    setVisionError("");
    Promise.all(files.map((file) => new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (ev) => resolve({ b64: ev.target.result.split(",")[1], type: file.type || "image/jpeg", name: file.name });
      reader.readAsDataURL(file);
    }))).then((imgs) => setVisionImgs((prev) => [...prev, ...imgs]));
  };

  // 이미지 한 장 파싱
  const parseOneImage = async (img) => {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: img.type, data: img.b64 } },
            { type: "text", text: `이 이미지에서 계좌/금융상품 정보를 추출해줘. 반드시 JSON 배열만 반환하고 다른 텍스트는 절대 포함하지 마.
형식: [{"bank":"은행명","accountNumber":"계좌번호(없으면 빈문자열)","description":"상품명/설명","balance":잔액숫자(없으면0),"category":"cash|domestic_stock|foreign_stock_etf|pension|fund|other"}]
category 규칙: 예금/입출금→cash, 국내주식/ETF→domestic_stock, 해외주식/ETF→foreign_stock_etf, IRP/연금저축/연금→pension, 펀드→fund, 나머지→other` }
          ]
        }]
      })
    });
    const json = await res.json();
    const text = json.content?.find((c) => c.type === "text")?.text || "";
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];
    return JSON.parse(match[0]);
  };

  // 전체 파싱 실행 (순서대로)
  const runVision = async () => {
    if (!visionImgs.length) return;
    setVisionLoading(true);
    setVisionError("");
    setVisionResult(null);
    const allResults = [];
    try {
      for (let i = 0; i < visionImgs.length; i++) {
        setVisionProgress(`분석 중... (${i + 1}/${visionImgs.length})`);
        const results = await parseOneImage(visionImgs[i]);
        allResults.push(...results);
      }
      setVisionResult(allResults.map((p) => ({ ...p, selected: true })));
    } catch (e) {
      setVisionError("파싱 실패: " + e.message);
    } finally {
      setVisionLoading(false);
      setVisionProgress("");
    }
  };

  // 선택된 항목을 계좌에 추가
  const applyVisionResult = () => {
    const toAdd = visionResult.filter((r) => r.selected).map((r) => ({
      id: genId(),
      memberId: visionMember,
      bank: r.bank || "",
      accountNumber: r.accountNumber || "",
      description: r.description || "",
      category: r.category || "cash",
      balance: Number(r.balance) || 0,
      monthlyDeposit: 0,
      memo: "Vision 자동파싱",
    }));
    setData((d) => ({ ...d, accounts: [...d.accounts, ...toAdd] }));
    setVisionModal(false);
    setVisionImgs([]);
    setVisionResult(null);
    alert(`${toAdd.length}개 계좌가 추가되었습니다!`);
  };

  // CSV 내보내기
  const exportAccountsCSV = () => {
    const getMemberName = (id) => data.members.find((m) => m.id === id)?.name || "-";
    const getCatLabel = (v) => ACCOUNT_CATEGORIES.find((c) => c.value === v)?.label || v;
    const rows = [
      ["소유자", "은행/증권사", "계좌번호", "설명", "카테고리", "잔액", "월적립금", "메모"],
      ...data.accounts.map((a) => [getMemberName(a.memberId), a.bank, a.accountNumber, a.description, getCatLabel(a.category), a.balance, a.monthlyDeposit, a.memo])
    ];
    downloadCSV(`계좌현황_${new Date().toISOString().slice(0,10)}.csv`, rows);
  };

  const exportSnapshotCSV = () => {
    const sorted = [...data.balanceSheetSnapshots].sort((a,b) => a.yearMonth.localeCompare(b.yearMonth));
    const rows = [
      ["연월", "총자산", "부동산", "금융자산", "총부채", "순자산", "메모"],
      ...sorted.map((s) => [s.yearMonth, s.totalAssets, s.realEstateAssets, s.financialAssets, s.totalLiabilities, s.netWorth, s.memo])
    ];
    downloadCSV(`재무상태표이력_${new Date().toISOString().slice(0,10)}.csv`, rows);
  };

  const exportActualsCSV = () => {
    const rows = [["연월", "카테고리", "항목명", "계획금액", "실적금액", "비고"]];
    data.monthlyActuals.sort((a,b)=>a.yearMonth.localeCompare(b.yearMonth)).forEach((a) => {
      a.items.forEach((i) => rows.push([a.yearMonth, i.category, i.label, i.plannedAmount, i.actualAmount, "계획항목"]));
      (a.extraItems||[]).forEach((i) => rows.push([a.yearMonth, i.category, i.label, "", i.actualAmount||i.amount, "추가항목"]));
    });
    downloadCSV(`수입지출실적_${new Date().toISOString().slice(0,10)}.csv`, rows);
  };

  return (
    <div className="space-y-6">
      {/* 구성원 */}
      <Card>
        <div className="flex items-center justify-between mb-4"><SectionTitle>👥 구성원 관리</SectionTitle><Btn size="sm" onClick={() => open(null)}>+ 추가</Btn></div>
        <div className="space-y-2">{data.members.map((m) => (
          <div key={m.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
            <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ background: m.color }}>{m.name[0]}</div><span className="text-sm font-semibold text-gray-800">{m.name}</span></div>
            <div className="flex gap-2"><Btn size="sm" variant="ghost" onClick={() => open(m)}>수정</Btn><Btn size="sm" variant="danger" onClick={() => setCd(m.id)}>삭제</Btn></div>
          </div>
        ))}</div>
      </Card>

      {/* 수입/지출 카테고리 관리 */}
      {(() => {
        const [catModal, setCatModal] = React.useState(false);
        const [editCat, setEditCat] = React.useState(null);
        const [catType, setCatType] = React.useState("income"); // income | expense
        const [catForm, setCatForm] = React.useState({ label:"", color:MEMBER_COLORS[0], isRegular:true });
        const [catTab, setCatTab] = React.useState("income");

        const incomeCats = data.incomeCategories || DEFAULT_INCOME_CATS;
        const expenseCats = data.expenseCategories || DEFAULT_EXPENSE_CATS;

        const openAddCat = (type) => { setCatType(type); setEditCat(null); setCatForm({ label:"", color:MEMBER_COLORS[0], isRegular: type==="income" ? true : true }); setCatModal(true); };
        const openEditCat = (cat, type) => { setCatType(type); setEditCat(cat); setCatForm({ label:cat.label, color:cat.color, isRegular:cat.isRegular }); setCatModal(true); };
        const saveCat = () => {
          if (!catForm.label.trim()) return;
          const newCat = { id: editCat?.id || genId(), ...catForm, isIncome: catType==="income" };
          setData((d) => {
            if (catType === "income") {
              const cats = editCat ? (d.incomeCategories||DEFAULT_INCOME_CATS).map(c=>c.id===editCat.id?newCat:c) : [...(d.incomeCategories||DEFAULT_INCOME_CATS), newCat];
              return { ...d, incomeCategories: cats };
            } else {
              const cats = editCat ? (d.expenseCategories||DEFAULT_EXPENSE_CATS).map(c=>c.id===editCat.id?newCat:c) : [...(d.expenseCategories||DEFAULT_EXPENSE_CATS), newCat];
              return { ...d, expenseCategories: cats };
            }
          });
          setCatModal(false);
        };
        const deleteCat = (catId, type) => {
          if (!window.confirm("삭제하시겠습니까? 해당 카테고리 항목들이 영향받을 수 있습니다.")) return;
          setData((d) => {
            if (type==="income") return { ...d, incomeCategories: (d.incomeCategories||DEFAULT_INCOME_CATS).filter(c=>c.id!==catId) };
            return { ...d, expenseCategories: (d.expenseCategories||DEFAULT_EXPENSE_CATS).filter(c=>c.id!==catId) };
          });
        };

        return (
          <Card>
            <SectionTitle>🏷️ 수입/지출 카테고리</SectionTitle>
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-4">
              {[["income","수입"],["expense","지출"]].map(([k,l])=><button key={k} onClick={()=>setCatTab(k)} className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${catTab===k?"bg-white text-[#1a2744] shadow-sm":"text-gray-500"}`}>{l}</button>)}
            </div>
            {catTab==="income" && <>
              <div className="space-y-1 mb-3">{incomeCats.map(cat=>(
                <div key={cat.id} className="flex items-center justify-between px-3 py-2 rounded-xl bg-gray-50">
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{background:cat.color}}/><span className="text-sm text-gray-700">{cat.label}</span><span className={`text-xs px-1.5 py-0.5 rounded-full ${cat.isRegular?"bg-blue-50 text-blue-500":"bg-orange-50 text-orange-500"}`}>{cat.isRegular?"정기":"비정기"}</span></div>
                  <div className="flex gap-1"><Btn size="sm" variant="ghost" onClick={()=>openEditCat(cat,"income")}>수정</Btn><Btn size="sm" variant="danger" onClick={()=>deleteCat(cat.id,"income")}>삭제</Btn></div>
                </div>
              ))}</div>
              <Btn size="sm" onClick={()=>openAddCat("income")}>+ 수입 카테고리 추가</Btn>
            </>}
            {catTab==="expense" && <>
              <div className="space-y-1 mb-3">{expenseCats.map(cat=>(
                <div key={cat.id} className="flex items-center justify-between px-3 py-2 rounded-xl bg-gray-50">
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{background:cat.color}}/><span className="text-sm text-gray-700">{cat.label}</span><span className={`text-xs px-1.5 py-0.5 rounded-full ${cat.isRegular?"bg-blue-50 text-blue-500":"bg-orange-50 text-orange-500"}`}>{cat.isRegular?"정기":"비정기"}</span></div>
                  <div className="flex gap-1"><Btn size="sm" variant="ghost" onClick={()=>openEditCat(cat,"expense")}>수정</Btn><Btn size="sm" variant="danger" onClick={()=>deleteCat(cat.id,"expense")}>삭제</Btn></div>
                </div>
              ))}</div>
              <Btn size="sm" onClick={()=>openAddCat("expense")}>+ 지출 카테고리 추가</Btn>
            </>}
            <Modal open={catModal} onClose={()=>setCatModal(false)} title={editCat?"카테고리 수정":"카테고리 추가"}>
              <div className="space-y-3">
                <Inp label="카테고리명" value={catForm.label} onChange={(v)=>setCatForm(f=>({...f,label:v}))} required/>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">색상</label>
                  <div className="flex gap-2 flex-wrap">{MEMBER_COLORS.map(c=><button key={c} onClick={()=>setCatForm(f=>({...f,color:c}))} className="w-8 h-8 rounded-full" style={{background:c, outline:catForm.color===c?`3px solid ${c}`:"none", outlineOffset:2}}/>)}</div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">구분</label>
                  <div className="flex gap-2">
                    <button onClick={()=>setCatForm(f=>({...f,isRegular:true}))} className={`px-3 py-1.5 rounded-xl text-sm font-semibold transition-all ${catForm.isRegular?"bg-blue-500 text-white":"bg-gray-100 text-gray-600"}`}>📅 정기</button>
                    <button onClick={()=>setCatForm(f=>({...f,isRegular:false}))} className={`px-3 py-1.5 rounded-xl text-sm font-semibold transition-all ${!catForm.isRegular?"bg-orange-500 text-white":"bg-gray-100 text-gray-600"}`}>⚡ 비정기</button>
                  </div>
                </div>
                <div className="flex gap-2 justify-end"><Btn variant="secondary" onClick={()=>setCatModal(false)}>취소</Btn><Btn onClick={saveCat}>저장</Btn></div>
              </div>
            </Modal>
          </Card>
        );
      })()}

      {/* Claude Vision 계좌 파싱 */}
      <Card>
        <SectionTitle>🤖 AI 계좌 자동 파싱</SectionTitle>
        <p className="text-xs text-gray-500 mb-3">은행 앱 스크린샷을 업로드하면 Claude가 계좌 정보를 자동으로 추출합니다.</p>
        <Btn size="sm" variant="secondary" onClick={() => { setVisionMember(data.members[0]?.id||""); setVisionImg(null); setVisionResult(null); setVisionError(""); setVisionModal(true); }}>
          📸 스크린샷으로 계좌 추가
        </Btn>
      </Card>

      {/* 데이터 관리 */}
      <Card>
        <SectionTitle>💾 데이터 관리</SectionTitle>
        <div className="space-y-3">
          {/* Google Sheets 동기화 */}
          <div className="p-3 rounded-xl bg-green-50 border border-green-100">
            <p className="text-xs font-semibold text-green-700 mb-1">☁️ Google Sheets 동기화</p>
            <p className="text-xs text-green-500 mb-2">모든 기기에서 동일한 데이터 사용</p>
            <div className="flex gap-2 flex-wrap">
              <Btn size="sm" variant="secondary" onClick={async () => {
                const ok = await syncToSheets(data);
                alert(ok ? "✅ Google Sheets에 저장됐어요!" : "❌ 저장 실패. 인터넷 연결을 확인해주세요.");
              }}>☁️ 업로드 (저장)</Btn>
              <Btn size="sm" variant="secondary" onClick={async () => {
                if (!window.confirm("Google Sheets 데이터로 덮어쓸까요?")) return;
                const remote = await syncFromSheets();
                if (!remote) { alert("❌ 불러오기 실패. 저장된 데이터가 없거나 오류가 발생했어요."); return; }
                setData({ ...DEFAULT_DATA, ...remote });
                alert("✅ 불러오기 완료!");
              }}>📥 다운로드 (불러오기)</Btn>
            </div>
          </div>
          {/* JSON */}
          <div className="p-3 rounded-xl bg-blue-50 border border-blue-100">
            <p className="text-xs font-semibold text-blue-700 mb-2">전체 백업 (JSON)</p>
            <div className="flex gap-2 flex-wrap">
              <Btn size="sm" variant="secondary" onClick={() => { const b=new Blob([JSON.stringify(data,null,2)],{type:"application/json"}); const u=URL.createObjectURL(b); const a=document.createElement("a"); a.href=u; a.download=`wealth_${new Date().toISOString().slice(0,10)}.json`; a.click(); }}>📤 JSON 내보내기</Btn>
              <label className="cursor-pointer"><span className="inline-flex items-center px-3 py-1.5 text-xs font-semibold bg-white border border-blue-200 rounded-xl text-blue-700 hover:bg-blue-50 transition">📥 JSON 가져오기</span><input type="file" accept=".json" className="hidden" onChange={(e) => { const f=e.target.files?.[0]; if(!f) return; const r=new FileReader(); r.onload=(ev)=>{ try{setData({...DEFAULT_DATA,...JSON.parse(ev.target.result)}); alert("완료!");}catch{alert("파일 오류");} }; r.readAsText(f); }} /></label>
            </div>
          </div>
          {/* CSV - Google Sheets용 */}
          <div className="p-3 rounded-xl bg-green-50 border border-green-100">
            <p className="text-xs font-semibold text-green-700 mb-1">CSV 내보내기 (Google Sheets용)</p>
            <p className="text-xs text-green-500 mb-2">각 CSV를 Google Sheets에 시트별로 붙여넣기 하세요</p>
            <div className="flex gap-2 flex-wrap">
              <Btn size="sm" variant="secondary" onClick={exportAccountsCSV}>📊 계좌현황</Btn>
              <Btn size="sm" variant="secondary" onClick={exportSnapshotCSV}>📋 재무상태표 이력</Btn>
              <Btn size="sm" variant="secondary" onClick={exportActualsCSV}>💰 수입지출 실적</Btn>
            </div>
          </div>
          {/* 초기화 */}
          <div className="p-3 rounded-xl bg-red-50 border border-red-100">
            <p className="text-xs font-semibold text-red-700 mb-2">데이터 초기화</p>
            <Btn size="sm" variant="danger" onClick={() => { if(window.confirm("초기화하시겠습니까?")) setData(DEFAULT_DATA); }}>🗑 초기화</Btn>
          </div>
        </div>
      </Card>

      {/* 구성원 모달 */}
      <Modal open={mm} onClose={() => setMm(false)} title={em ? "구성원 수정" : "구성원 추가"}>
        <div className="space-y-4">
          <Inp label="이름" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} required />
          <div><label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">색상</label><div className="flex gap-2 flex-wrap">{MEMBER_COLORS.map((c) => <button key={c} onClick={() => setForm((f) => ({ ...f, color: c }))} className="w-8 h-8 rounded-full" style={{ background: c, outline: form.color===c ? `3px solid ${c}` : "none", outlineOffset: 2 }} />)}</div></div>
          <div className="flex gap-2 justify-end"><Btn variant="secondary" onClick={() => setMm(false)}>취소</Btn><Btn onClick={save}>저장</Btn></div>
        </div>
      </Modal>

      {/* Vision 모달 */}
      <Modal open={visionModal} onClose={() => setVisionModal(false)} title="📸 AI 계좌 파싱" wide>
        <div className="space-y-4">
          <Sel label="소유자" value={visionMember} onChange={setVisionMember} options={data.members.map((m) => ({ value: m.id, label: m.name }))} />

          {/* 이미지 업로드 영역 */}
          <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">
                스크린샷 업로드 <span className="text-blue-500 normal-case font-normal">(여러 장 동시 선택 가능)</span>
              </label>
              <label className="cursor-pointer flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-xl p-5 hover:border-[#1a2744] transition">
                <div className="text-center">
                  <div className="text-3xl mb-1">📸</div>
                  <p className="text-sm text-gray-500">탭해서 사진 선택</p>
                  <p className="text-xs text-gray-400 mt-0.5">여러 장 동시 선택 가능</p>
                </div>
                <input type="file" accept="image/*" multiple className="hidden" onChange={handleImgUpload} />
              </label>
            </div>

            {/* 선택된 이미지 목록 */}
            {visionImgs.length > 0 && !visionResult && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-600">{visionImgs.length}장 선택됨</p>
                  <button onClick={() => setVisionImgs([])} className="text-xs text-red-400 hover:text-red-600">전체 삭제</button>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {visionImgs.map((img, i) => (
                    <div key={i} className="relative">
                      <img src={`data:${img.type};base64,${img.b64}`} className="w-16 h-16 rounded-lg object-cover border border-gray-200" alt={`img${i+1}`} />
                      <button onClick={() => setVisionImgs((prev) => prev.filter((_,j) => j !== i))} className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-xs flex items-center justify-center leading-none">×</button>
                    </div>
                  ))}
                  {/* 추가 업로드 버튼 */}
                  <label className="cursor-pointer w-16 h-16 rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-400 hover:border-[#1a2744] transition">
                    <span className="text-xl">+</span>
                    <input type="file" accept="image/*" multiple className="hidden" onChange={handleImgUpload} />
                  </label>
                </div>
                <Btn onClick={runVision} disabled={visionLoading} className="w-full">
                  {visionLoading ? `⏳ ${visionProgress}` : `🤖 ${visionImgs.length}장 AI 분석 시작`}
                </Btn>
              </div>
            )}

          {visionError && <p className="text-xs text-red-500 p-3 bg-red-50 rounded-xl">{visionError}</p>}

          {/* 파싱 결과 */}
          {visionResult && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-700">추출된 계좌 ({visionResult.filter((r)=>r.selected).length}/{visionResult.length}개 선택)</p>
                <div className="flex gap-2">
                  <button onClick={() => setVisionResult((p) => p.map((x) => ({...x,selected:true})))} className="text-xs text-blue-500">전체선택</button>
                  <button onClick={() => setVisionResult((p) => p.map((x) => ({...x,selected:false})))} className="text-xs text-gray-400">전체해제</button>
                </div>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {visionResult.map((r, i) => (
                  <div key={i} className={`p-3 rounded-xl border transition ${r.selected ? "border-[#1a2744] bg-blue-50" : "border-gray-100 bg-gray-50 opacity-60"}`}>
                    <div className="flex items-start gap-2">
                      <input type="checkbox" checked={r.selected} onChange={(e) => setVisionResult((prev) => prev.map((x,j) => j===i ? {...x,selected:e.target.checked} : x))} className="mt-1 cursor-pointer" />
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-gray-800">{r.bank}</span>
                          {r.description && <span className="text-xs text-gray-500">{r.description}</span>}
                          <Badge color={ACCOUNT_CATEGORIES.find((c)=>c.value===r.category)?.color||"#aaa"} label={ACCOUNT_CATEGORIES.find((c)=>c.value===r.category)?.label||r.category} />
                        </div>
                        {r.accountNumber && <p className="text-xs text-gray-400 font-mono">{r.accountNumber}</p>}
                        <div className="grid grid-cols-2 gap-1 mt-1">
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-gray-400">은행:</span>
                            <input value={r.bank} onChange={(e) => setVisionResult((prev) => prev.map((x,j) => j===i ? {...x,bank:e.target.value} : x))} className="flex-1 border border-gray-200 rounded px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#1a2744]/30 bg-white" />
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-gray-400">잔액:</span>
                            <input type="number" value={r.balance} onChange={(e) => setVisionResult((prev) => prev.map((x,j) => j===i ? {...x,balance:Number(e.target.value)} : x))} className="flex-1 border border-gray-200 rounded px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#1a2744]/30 bg-white" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 justify-end">
                <Btn variant="secondary" onClick={() => { setVisionImgs([]); setVisionResult(null); }}>다시 업로드</Btn>
                <Btn onClick={applyVisionResult} disabled={!visionResult.some((r)=>r.selected)}>✅ 선택 항목 추가</Btn>
              </div>
            </div>
          )}
        </div>
      </Modal>

      <Confirm open={!!cd} message="이 구성원을 삭제하시겠습니까?" onConfirm={() => { setData((d) => ({ ...d, members: d.members.filter((m) => m.id !== cd) })); setCd(null); }} onCancel={() => setCd(null)} />
    </div>
  );
};

// ─────────────────────────────────────────────
// 자산현황
// ─────────────────────────────────────────────
const AssetsSection = ({ data, setData }) => {
  const [tab, setTab] = useState("accounts");
  const [am, setAm] = useState(false); const [ea, setEa] = useState(null); const [af, setAf] = useState({ memberId:"", bank:"", accountNumber:"", description:"", category:"cash", balance:"", monthlyDeposit:"", memo:"" }); const [cda, setCda] = useState(null);
  const [rm, setRm] = useState(false); const [er, setEr] = useState(null); const [rf, setRf] = useState({ name:"", purchasePrice:"", currentPrice:"", loanId:"", memo:"" }); const [cdr, setCdr] = useState(null);
  const [lm, setLm] = useState(false); const [el, setEl] = useState(null); const [lf, setLf] = useState({ memberId:"", name:"", balance:"", interestRate:"", monthlyPayment:"", dueDate:"", linkedRealEstateId:"", memo:"" }); const [cdl, setCdl] = useState(null);
  const mn = (id) => data.members.find((m) => m.id === id)?.name || "-";
  const mc = (id) => data.members.find((m) => m.id === id)?.color || "#aaa";
  const cc = (v) => ACCOUNT_CATEGORIES.find((c) => c.value === v)?.color || "#aaa";
  const oa = () => { setEa(null); setAf({ memberId: data.members[0]?.id||"", bank:"", accountNumber:"", description:"", category:"cash", balance:"", monthlyDeposit:"", memo:"" }); setAm(true); };
  const sa = () => { if(!af.bank.trim()) return; setData((d) => ({ ...d, accounts: ea ? d.accounts.map((a) => a.id===ea.id ? {...a,...af,balance:Number(af.balance)||0,monthlyDeposit:Number(af.monthlyDeposit)||0} : a) : [...d.accounts, {id:genId(),...af,balance:Number(af.balance)||0,monthlyDeposit:Number(af.monthlyDeposit)||0}] })); setAm(false); };
  const or = () => { setEr(null); setRf({ name:"", purchasePrice:"", currentPrice:"", loanId:"", memo:"" }); setRm(true); };
  const sr = () => { if(!rf.name.trim()) return; setData((d) => ({ ...d, realEstate: er ? d.realEstate.map((r) => r.id===er.id ? {...r,...rf,purchasePrice:Number(rf.purchasePrice)||0,currentPrice:Number(rf.currentPrice)||0} : r) : [...d.realEstate, {id:genId(),...rf,purchasePrice:Number(rf.purchasePrice)||0,currentPrice:Number(rf.currentPrice)||0}] })); setRm(false); };
  const ol = () => { setEl(null); setLf({ memberId: data.members[0]?.id||"", name:"", balance:"", interestRate:"", monthlyPayment:"", dueDate:"", linkedRealEstateId:"", memo:"" }); setLm(true); };
  const sl = () => { if(!lf.name.trim()) return; setData((d) => ({ ...d, loans: el ? d.loans.map((l) => l.id===el.id ? {...l,...lf,balance:Number(lf.balance)||0,interestRate:Number(lf.interestRate)||0,monthlyPayment:Number(lf.monthlyPayment)||0} : l) : [...d.loans, {id:genId(),...lf,balance:Number(lf.balance)||0,interestRate:Number(lf.interestRate)||0,monthlyPayment:Number(lf.monthlyPayment)||0}] })); setLm(false); };
  const totB = data.accounts.reduce((s,a)=>s+(a.balance||0),0);
  const totR = data.realEstate.reduce((s,r)=>s+(r.currentPrice||0),0);
  const totL = data.loans.reduce((s,l)=>s+(l.balance||0),0);
  const totM = data.accounts.reduce((s,a)=>s+(a.monthlyDeposit||0),0);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[["금융자산",totB,"#4F86C6"],["부동산자산",totR,"#82C596"],["총부채",totL,"#E85D75"],["월 총 적립금",totM,"#E8A87C"]].map(([l,v,c]) => <Card key={l} className="!p-4"><p className="text-xs text-gray-500 mb-1">{l}</p><p className="text-base font-bold" style={{color:c}}>{fmt(v)}</p></Card>)}
      </div>
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {[["accounts","금융계좌"],["realestate","부동산"],["loans","대출/부채"]].map(([k,l]) => <button key={k} onClick={()=>setTab(k)} className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${tab===k?"bg-white text-[#1a2744] shadow-sm":"text-gray-500"}`}>{l}</button>)}
      </div>
      {tab==="accounts" && <Card>
        <div className="flex items-center justify-between mb-4"><SectionTitle>🏦 금융계좌</SectionTitle><Btn size="sm" onClick={oa}>+ 계좌 추가</Btn></div>
        {ACCOUNT_CATEGORIES.map((cat) => { const cats=data.accounts.filter((a)=>a.category===cat.value); if(!cats.length) return null; return (
          <div key={cat.value} className="mb-5">
            <div className="flex items-center gap-2 mb-2"><div className="w-2 h-2 rounded-full" style={{background:cat.color}}/><span className="text-xs font-bold text-gray-500 uppercase tracking-wide">{cat.label}</span><span className="text-xs text-gray-400">({fmt(cats.reduce((s,a)=>s+a.balance,0))})</span></div>
            <div className="space-y-2">{cats.map((acc) => (
              <div key={acc.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition">
                <div className="flex-1 min-w-0"><div className="flex items-center gap-2 flex-wrap"><span className="text-sm font-semibold text-gray-800">{acc.bank}</span>{acc.description&&<span className="text-xs text-gray-500">{acc.description}</span>}<Badge color={mc(acc.memberId)} label={mn(acc.memberId)} />{acc.monthlyDeposit>0&&<Badge color="#E8A87C" label={`적립 ${fmt(acc.monthlyDeposit)}/월`}/>}</div>{acc.accountNumber&&<p className="text-xs text-gray-400 mt-0.5">{acc.accountNumber}</p>}</div>
                <div className="flex items-center gap-2 ml-2 shrink-0"><span className="text-sm font-bold text-gray-800">{fmt(acc.balance)}</span><Btn size="sm" variant="ghost" onClick={()=>{setEa(acc);setAf({...acc,balance:acc.balance??"",monthlyDeposit:acc.monthlyDeposit??""});setAm(true);}}>수정</Btn><Btn size="sm" variant="danger" onClick={()=>setCda(acc.id)}>삭제</Btn></div>
              </div>
            ))}</div>
          </div>
        );})}
        {!data.accounts.length&&<p className="text-sm text-gray-400 text-center py-6">등록된 계좌가 없습니다</p>}
        {totM>0&&<div className="mt-4 p-3 rounded-xl bg-amber-50 border border-amber-100 flex justify-between"><span className="text-xs font-semibold text-amber-700">💰 월 총 적립금</span><span className="text-sm font-bold text-amber-700">{fmt(totM)}</span></div>}
      </Card>}
      {tab==="realestate" && <Card>
        <div className="flex items-center justify-between mb-4"><SectionTitle>🏠 부동산</SectionTitle><Btn size="sm" onClick={or}>+ 추가</Btn></div>
        <div className="space-y-3">{data.realEstate.map((re) => { const linked=data.loans.find((l)=>l.id===re.loanId); const gain=re.currentPrice-re.purchasePrice; return (
          <div key={re.id} className="p-4 rounded-xl bg-gray-50">
            <div className="flex items-center justify-between"><div><p className="text-sm font-bold text-gray-800">{re.name}</p>{re.memo&&<p className="text-xs text-gray-400">{re.memo}</p>}</div><div className="flex gap-2"><Btn size="sm" variant="ghost" onClick={()=>{setEr(re);setRf({...re});setRm(true);}}>수정</Btn><Btn size="sm" variant="danger" onClick={()=>setCdr(re.id)}>삭제</Btn></div></div>
            <div className="grid grid-cols-3 gap-2 mt-3 text-center">{[["취득가",fmt(re.purchasePrice),""],["현재가",fmt(re.currentPrice),""],["평가손익",(gain>=0?"+":"")+fmt(gain),gain>=0?"text-green-600":"text-red-500"]].map(([l,v,c])=><div key={l} className="bg-white rounded-lg p-2"><p className="text-xs text-gray-400">{l}</p><p className={`text-xs font-bold ${c||"text-gray-700"}`}>{v}</p></div>)}</div>
            {linked&&<p className="text-xs text-blue-500 mt-2">🔗 연결대출: {linked.name} ({fmt(linked.balance)})</p>}
          </div>
        );})}{!data.realEstate.length&&<p className="text-sm text-gray-400 text-center py-6">등록된 부동산이 없습니다</p>}</div>
      </Card>}
      {tab==="loans" && <Card>
        <div className="flex items-center justify-between mb-4"><SectionTitle>💳 대출/부채</SectionTitle><Btn size="sm" onClick={ol}>+ 추가</Btn></div>
        <div className="space-y-3">{data.loans.map((loan) => (
          <div key={loan.id} className="p-4 rounded-xl bg-red-50">
            <div className="flex items-center justify-between"><div><div className="flex items-center gap-2"><p className="text-sm font-bold text-gray-800">{loan.name}</p><Badge color={mc(loan.memberId)} label={mn(loan.memberId)}/></div>{loan.memo&&<p className="text-xs text-gray-400">{loan.memo}</p>}</div><div className="flex gap-2"><Btn size="sm" variant="ghost" onClick={()=>{setEl(loan);setLf({...loan});setLm(true);}}>수정</Btn><Btn size="sm" variant="danger" onClick={()=>setCdl(loan.id)}>삭제</Btn></div></div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 text-center">{[["잔액",fmt(loan.balance),"text-red-600"],["금리",loan.interestRate+"%",""],["월상환",fmt(loan.monthlyPayment),""],["만기",loan.dueDate||"-",""]].map(([l,v,c])=><div key={l} className="bg-white rounded-lg p-2"><p className="text-xs text-gray-400">{l}</p><p className={`text-xs font-bold ${c||"text-gray-700"}`}>{v}</p></div>)}</div>
          </div>
        ))}{!data.loans.length&&<p className="text-sm text-gray-400 text-center py-6">등록된 대출이 없습니다</p>}</div>
      </Card>}
      <Modal open={am} onClose={()=>setAm(false)} title={ea?"계좌 수정":"계좌 추가"}><div className="space-y-3"><Sel label="소유자" value={af.memberId} onChange={(v)=>setAf((f)=>({...f,memberId:v}))} options={data.members.map((m)=>({value:m.id,label:m.name}))}/><Sel label="카테고리" value={af.category} onChange={(v)=>setAf((f)=>({...f,category:v}))} options={ACCOUNT_CATEGORIES}/><Inp label="은행/증권사" value={af.bank} onChange={(v)=>setAf((f)=>({...f,bank:v}))} required/><Inp label="계좌번호" value={af.accountNumber} onChange={(v)=>setAf((f)=>({...f,accountNumber:v}))}/><Inp label="설명" value={af.description} onChange={(v)=>setAf((f)=>({...f,description:v}))}/><Inp label="현재 잔액 (원)" type="number" value={af.balance} onChange={(v)=>setAf((f)=>({...f,balance:v}))}/><Inp label="월 적립금 (원)" type="number" value={af.monthlyDeposit} onChange={(v)=>setAf((f)=>({...f,monthlyDeposit:v}))}/><Inp label="메모" value={af.memo} onChange={(v)=>setAf((f)=>({...f,memo:v}))}/><div className="flex gap-2 justify-end"><Btn variant="secondary" onClick={()=>setAm(false)}>취소</Btn><Btn onClick={sa}>저장</Btn></div></div></Modal>
      <Modal open={rm} onClose={()=>setRm(false)} title={er?"부동산 수정":"부동산 추가"}><div className="space-y-3"><Inp label="물건명" value={rf.name} onChange={(v)=>setRf((f)=>({...f,name:v}))} required/><Inp label="취득가 (원)" type="number" value={rf.purchasePrice} onChange={(v)=>setRf((f)=>({...f,purchasePrice:v}))}/><Inp label="현재 시세 (원)" type="number" value={rf.currentPrice} onChange={(v)=>setRf((f)=>({...f,currentPrice:v}))}/><Sel label="연결 대출" value={rf.loanId} onChange={(v)=>setRf((f)=>({...f,loanId:v}))} options={[{value:"",label:"없음"},...data.loans.map((l)=>({value:l.id,label:l.name}))]}/><Inp label="메모" value={rf.memo} onChange={(v)=>setRf((f)=>({...f,memo:v}))}/><div className="flex gap-2 justify-end"><Btn variant="secondary" onClick={()=>setRm(false)}>취소</Btn><Btn onClick={sr}>저장</Btn></div></div></Modal>
      <Modal open={lm} onClose={()=>setLm(false)} title={el?"대출 수정":"대출 추가"}><div className="space-y-3"><Sel label="소유자" value={lf.memberId} onChange={(v)=>setLf((f)=>({...f,memberId:v}))} options={data.members.map((m)=>({value:m.id,label:m.name}))}/><Inp label="대출명" value={lf.name} onChange={(v)=>setLf((f)=>({...f,name:v}))} required/><Inp label="잔액 (원)" type="number" value={lf.balance} onChange={(v)=>setLf((f)=>({...f,balance:v}))}/><Inp label="금리 (%)" type="number" value={lf.interestRate} onChange={(v)=>setLf((f)=>({...f,interestRate:v}))}/><Inp label="월 상환액 (원)" type="number" value={lf.monthlyPayment} onChange={(v)=>setLf((f)=>({...f,monthlyPayment:v}))}/><Inp label="만기일" type="date" value={lf.dueDate} onChange={(v)=>setLf((f)=>({...f,dueDate:v}))}/><Sel label="연결 부동산" value={lf.linkedRealEstateId} onChange={(v)=>setLf((f)=>({...f,linkedRealEstateId:v}))} options={[{value:"",label:"없음"},...data.realEstate.map((r)=>({value:r.id,label:r.name}))]}/><Inp label="메모" value={lf.memo} onChange={(v)=>setLf((f)=>({...f,memo:v}))}/><div className="flex gap-2 justify-end"><Btn variant="secondary" onClick={()=>setLm(false)}>취소</Btn><Btn onClick={sl}>저장</Btn></div></div></Modal>
      <Confirm open={!!cda} message="이 계좌를 삭제하시겠습니까?" onConfirm={()=>{setData((d)=>({...d,accounts:d.accounts.filter((a)=>a.id!==cda)}));setCda(null);}} onCancel={()=>setCda(null)}/>
      <Confirm open={!!cdr} message="이 부동산을 삭제하시겠습니까?" onConfirm={()=>{setData((d)=>({...d,realEstate:d.realEstate.filter((r)=>r.id!==cdr)}));setCdr(null);}} onCancel={()=>setCdr(null)}/>
      <Confirm open={!!cdl} message="이 대출을 삭제하시겠습니까?" onConfirm={()=>{setData((d)=>({...d,loans:d.loans.filter((l)=>l.id!==cdl)}));setCdl(null);}} onCancel={()=>setCdl(null)}/>
    </div>
  );
};

// ─────────────────────────────────────────────
// 수입/지출
// ─────────────────────────────────────────────
const IncomeExpenseSection = ({ data, setData }) => {
  const [tab, setTab] = useState("plan");
  const [selVer, setSelVer] = useState(null);
  const [im, setIm] = useState(false); const [ei, setEi] = useState(null); const [iForm, setIForm] = useState({ category:"regular_income", label:"", amount:"", memo:"", memberId:"" });
  const [memberFilter, setMemberFilter] = useState("all"); // 구성원 필터
  const [vm, setVm] = useState(false); const [vForm, setVForm] = useState({ label:"", startDate:"" });
  const [aYM, setAYM] = useState(thisYearMonth()); const [aEdits, setAEdits] = useState({}); const [extras, setExtras] = useState([]);
  const [sumTab, setSumTab] = useState("monthly"); const [sumYM, setSumYM] = useState(thisYearMonth()); const [sumYear, setSumYear] = useState(String(new Date().getFullYear()));
  const [cdi, setCdi] = useState(null); const [cdv, setCdv] = useState(null);

  const activePlan = data.incomeExpensePlans.find((p) => p.isActive) || data.incomeExpensePlans.slice(-1)[0];
  const curPlan = selVer ? data.incomeExpensePlans.find((p) => p.id === selVer) : activePlan;

  const createVer = () => {
    if (!vForm.label || !vForm.startDate) return;
    const base = activePlan ? activePlan.items.map((i) => ({ ...i, id: genId() })) : [];
    const np = { id: genId(), label: vForm.label, startDate: vForm.startDate, isActive: true, items: base };
    setData((d) => ({ ...d, incomeExpensePlans: [...d.incomeExpensePlans.map((p) => ({ ...p, isActive: false })), np] }));
    setSelVer(np.id); setVm(false); setVForm({ label:"", startDate:"" });
  };

  const saveItem = () => {
    if (!iForm.label.trim() || !curPlan) return;
    const ni = { id: ei?.id || genId(), ...iForm, amount: Number(iForm.amount)||0, memberId: iForm.memberId||"" };
    setData((d) => ({ ...d, incomeExpensePlans: d.incomeExpensePlans.map((p) => p.id===curPlan.id ? {...p, items: ei ? p.items.map((i)=>i.id===ei.id?ni:i) : [...p.items,ni]} : p) }));
    setIm(false);
  };

  const moveItem = (itemId, dir) => {
    if (!curPlan) return;
    setData((d) => ({
      ...d,
      incomeExpensePlans: d.incomeExpensePlans.map((p) => {
        if (p.id !== curPlan.id) return p;
        const items = [...p.items];
        const idx = items.findIndex(i => i.id === itemId);
        const newIdx = idx + dir;
        if (newIdx < 0 || newIdx >= items.length) return p;
        [items[idx], items[newIdx]] = [items[newIdx], items[idx]];
        return { ...p, items };
      })
    }));
  };

  // PC 드래그 상태
  const dragItem = React.useRef(null);
  const handleDragStart = (e, itemId) => {
    dragItem.current = itemId;
    e.dataTransfer.effectAllowed = "move";
    e.currentTarget.style.opacity = "0.5";
  };
  const handleDragEnd = (e) => {
    e.currentTarget.style.opacity = "1";
    dragItem.current = null;
  };
  const handleDragOver = (e) => { e.preventDefault(); };
  const handleDrop = (e, toItemId) => {
    e.preventDefault();
    const fromId = dragItem.current;
    if (!curPlan || !fromId || fromId === toItemId) return;
    setData((d) => ({
      ...d,
      incomeExpensePlans: d.incomeExpensePlans.map((p) => {
        if (p.id !== curPlan.id) return p;
        const items = [...p.items];
        const fromIdx = items.findIndex(i => i.id === fromId);
        const toIdx = items.findIndex(i => i.id === toItemId);
        if (fromIdx < 0 || toIdx < 0) return p;
        const [moved] = items.splice(fromIdx, 1);
        items.splice(toIdx, 0, moved);
        return { ...p, items };
      })
    }));
    dragItem.current = null;
  };

  // 터치 드래그 (모바일) - onTouchMove로 실시간 감지
  const touchDragId = React.useRef(null);
  const touchDragEl = React.useRef(null);
  const handleTouchStart = (e, itemId) => {
    touchDragId.current = itemId;
    touchDragEl.current = e.currentTarget;
    e.currentTarget.style.opacity = "0.5";
    e.currentTarget.style.transform = "scale(1.02)";
  };
  const handleTouchMove = (e) => {
    e.preventDefault(); // 스크롤 막기
  };
  const handleTouchEnd = (e) => {
    if (!curPlan || !touchDragId.current) return;
    if (touchDragEl.current) {
      touchDragEl.current.style.opacity = "1";
      touchDragEl.current.style.transform = "";
    }
    const touch = e.changedTouches[0];
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    const targetEl = el?.closest("[data-item-id]");
    const toItemId = targetEl?.dataset?.itemId;
    const fromId = touchDragId.current;
    touchDragId.current = null;
    touchDragEl.current = null;
    if (!toItemId || toItemId === fromId) return;
    setData((d) => ({
      ...d,
      incomeExpensePlans: d.incomeExpensePlans.map((p) => {
        if (p.id !== curPlan.id) return p;
        const items = [...p.items];
        const fromIdx = items.findIndex(i => i.id === fromId);
        const toIdx = items.findIndex(i => i.id === toItemId);
        if (fromIdx < 0 || toIdx < 0) return p;
        const [moved] = items.splice(fromIdx, 1);
        items.splice(toIdx, 0, moved);
        return { ...p, items };
      })
    }));
  };

  const IRREG_CATS = new Set(["irregular_income", "irregular"]);

  const initActual = (ym) => {
    const ex = data.monthlyActuals.find((a) => a.yearMonth === ym);
    if (ex) {
      const eds={};
      ex.items.forEach((i)=>{eds[i.planItemId]=i.actualAmount;});
      setAEdits(eds); setExtras(ex.extraItems||[]);
    } else if (activePlan) {
      const eds={};
      activePlan.items.forEach((i)=>{
        // 비정기(irregular_income, irregular)는 0, 정기는 계획값
        eds[i.id] = IRREG_CATS.has(i.category) ? 0 : i.amount;
      });
      setAEdits(eds); setExtras([]);
    } else {
      setAEdits({}); setExtras([]);
    }
  };

  // 항목이 다른 달 실적에 이미 0 초과로 저장됐는지 확인 (수입/지출 모두)
  const getItemReceivedMonth = (itemId) => {
    for (const actual of data.monthlyActuals) {
      if (actual.yearMonth === aYM) continue; // 현재 달 제외
      const found = actual.items.find(i => i.planItemId === itemId && Number(i.actualAmount) > 0);
      if (found) return { ym: actual.yearMonth, amount: found.actualAmount };
      // extraItems도 확인
      const foundExtra = (actual.extraItems||[]).find(i => i.id === itemId && Number(i.actualAmount||i.amount) > 0);
      if (foundExtra) return { ym: actual.yearMonth, amount: foundExtra.actualAmount||foundExtra.amount };
    }
    return null;
  };

  const saveActual = () => {
    if (!activePlan) return;
    const items = activePlan.items.map((i) => ({ planItemId:i.id, label:i.label, category:i.category, plannedAmount:i.amount, actualAmount:Number(aEdits[i.id])||0 }));
    const ex = data.monthlyActuals.find((a) => a.yearMonth === aYM);
    const na = { id:ex?.id||genId(), yearMonth:aYM, planVersionId:activePlan.id, items, extraItems:extras };
    setData((d) => ({ ...d, monthlyActuals: ex ? d.monthlyActuals.map((a)=>a.yearMonth===aYM?na:a) : [...d.monthlyActuals,na] }));
    alert("저장되었습니다!");
  };

  const monthlyData = useMemo(() => data.monthlyActuals.sort((a,b)=>a.yearMonth.localeCompare(b.yearMonth)).map((a) => {
    const all=[...a.items,...(a.extraItems||[])];
    const regInc=all.filter((i)=>i.category==="regular_income").reduce((s,i)=>s+(Number(i.actualAmount)||0),0);
    const regExp=all.filter((i)=>REGULAR_EXPENSE_CATS.find((c)=>c.value===i.category)).reduce((s,i)=>s+(Number(i.actualAmount)||0),0);
    const irregInc=all.filter((i)=>i.category==="irregular_income").reduce((s,i)=>s+(Number(i.actualAmount)||0),0);
    const irregExp=all.filter((i)=>i.category==="irregular").reduce((s,i)=>s+(Number(i.actualAmount)||0),0);
    return { ym:a.yearMonth, label:ymLabel(a.yearMonth), income:regInc, expense:regExp, net:regInc-regExp, irregInc, irregExp };
  }), [data.monthlyActuals]);

  const yearData = useMemo(() => { const f=monthlyData.filter((d)=>d.ym.startsWith(sumYear)); return { income:f.reduce((s,d)=>s+d.income,0), expense:f.reduce((s,d)=>s+d.expense,0), months:f }; }, [monthlyData,sumYear]);

  const monthCatPie = useMemo(() => {
    const a = data.monthlyActuals.find((x)=>x.yearMonth===sumYM); if(!a) return [];
    const sums={}; [...a.items,...(a.extraItems||[])].filter((i)=>EXPENSE_CATEGORIES.find((c)=>c.value===i.category)).forEach((i)=>{sums[i.category]=(sums[i.category]||0)+(i.actualAmount||0);});
    return EXPENSE_CATEGORIES.filter((c)=>sums[c.value]>0).map((c)=>({name:c.label,value:sums[c.value],color:c.color}));
  }, [data.monthlyActuals,sumYM]);

  const years = [...new Set(data.monthlyActuals.map((a)=>a.yearMonth.slice(0,4)))].sort();
  const curActual = data.monthlyActuals.find((a)=>a.yearMonth===aYM);

  const planTotIncome = curPlan?.items.filter((i)=>INCOME_CATEGORIES.find((c)=>c.value===i.category)).reduce((s,i)=>s+i.amount,0)||0;
  const planTotExp = curPlan?.items.filter((i)=>EXPENSE_CATEGORIES.find((c)=>c.value===i.category)).reduce((s,i)=>s+i.amount,0)||0;

  return (
    <div className="space-y-4">
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {[["plan","📋 계획"],["actual","✏️ 실적 입력"],["summary","📊 Summary"]].map(([k,l]) => (
          <button key={k} onClick={()=>{setTab(k);if(k==="actual")initActual(aYM);}} className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${tab===k?"bg-white text-[#1a2744] shadow-sm":"text-gray-500"}`}>{l}</button>
        ))}
      </div>

      {tab==="plan" && <div className="space-y-4">
        <Card className="!p-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-gray-600">버전:</span>
              {data.incomeExpensePlans.map((p) => <button key={p.id} onClick={()=>setSelVer(p.id)} className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${(selVer||activePlan?.id)===p.id?"bg-[#1a2744] text-white":"bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>{p.label}{p.isActive?" ✓":""}</button>)}
              {!data.incomeExpensePlans.length&&<span className="text-xs text-gray-400">버전이 없습니다</span>}
            </div>
            <div className="flex gap-2">
              {curPlan&&!curPlan.isActive&&<Btn size="sm" variant="success" onClick={()=>setData((d)=>({...d,incomeExpensePlans:d.incomeExpensePlans.map((p)=>({...p,isActive:p.id===curPlan.id}))}))}>활성화</Btn>}
              <Btn size="sm" onClick={()=>setVm(true)}>+ 새 버전</Btn>
              {curPlan&&<Btn size="sm" variant="danger" onClick={()=>setCdv(curPlan.id)}>삭제</Btn>}
            </div>
          </div>
          {curPlan&&<p className="text-xs text-gray-400 mt-2">적용시작: {curPlan.startDate}</p>}
        </Card>
        {curPlan ? <Card>
          <div className="flex items-center justify-between mb-3"><SectionTitle>💡 {curPlan.label} {curPlan.isActive&&<Badge color="#4F86C6" label="활성"/>}</SectionTitle><Btn size="sm" onClick={()=>{setEi(null);setIForm({category:"regular_income",label:"",amount:"",memo:"",memberId:""});setIm(true);}}>+ 항목 추가</Btn></div>
          {/* 구성원 필터 */}
          <div className="flex gap-1 flex-wrap mb-4">
            <button onClick={()=>setMemberFilter("all")} className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${memberFilter==="all"?"bg-[#1a2744] text-white":"bg-gray-100 text-gray-600"}`}>전체</button>
            {data.members.map(m=><button key={m.id} onClick={()=>setMemberFilter(m.id)} className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${memberFilter===m.id?"text-white":"bg-gray-100 text-gray-600"}`} style={memberFilter===m.id?{background:m.color}:{}}>{m.name}</button>)}
            <button onClick={()=>setMemberFilter("none")} className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${memberFilter==="none"?"bg-gray-500 text-white":"bg-gray-100 text-gray-600"}`}>공용</button>
          </div>
          {/* 정기 섹션 */}
          {(() => {
            const regCats = REGULAR_CATEGORIES;
            const regItems = regCats.map(cat => ({ cat, items: curPlan.items.filter(i => i.category === cat.value) })).filter(x => x.items.length > 0);
            const regInc = curPlan.items.filter(i=>i.category==="regular_income").reduce((s,i)=>s+i.amount,0);
            const regExp = curPlan.items.filter(i=>REGULAR_EXPENSE_CATS.find(c=>c.value===i.category)).reduce((s,i)=>s+i.amount,0);
            return regItems.length > 0 ? (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3 pb-2 border-b-2 border-blue-100">
                  <span className="text-sm font-extrabold text-blue-700">📅 정기</span>
                  <div className="flex gap-3 text-xs">
                    <span className="text-blue-500">수입 {fmtShort(regInc)}</span>
                    <span className="text-red-400">지출 {fmtShort(regExp)}</span>
                    <span className={`font-bold ${(regInc-regExp)>=0?"text-green-600":"text-red-500"}`}>순 {fmtShort(regInc-regExp)}</span>
                  </div>
                </div>
                {regItems.map(({cat, items}) => {
                  const filtItems = memberFilter==="all" ? items : memberFilter==="none" ? items.filter(i=>!i.memberId) : items.filter(i=>i.memberId===memberFilter);
                  if(!filtItems.length) return null;
                  const tot = filtItems.reduce((s,i)=>s+i.amount,0);
                  return (
                    <div key={cat.value} className="mb-4">
                      <div className="flex items-center justify-between mb-2"><div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full" style={{background:cat.color}}/><span className="text-xs font-bold text-gray-500 uppercase tracking-wide">{cat.label}</span></div><span className={`text-xs font-bold ${cat.isIncome?"text-blue-600":"text-gray-600"}`}>{fmt(tot)}</span></div>
                      <div className="space-y-1">{filtItems.map((item, idx) => {
                        const mColor = data.members.find(m=>m.id===item.memberId)?.color;
                        return (
                        <div key={item.id} data-item-id={item.id}
                          draggable onDragStart={(e)=>handleDragStart(e,item.id)} onDragEnd={handleDragEnd} onDragOver={handleDragOver} onDrop={(e)=>handleDrop(e,item.id)} onTouchStart={(e)=>handleTouchStart(e,item.id)} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
                          className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition cursor-grab active:cursor-grabbing select-none"
                          style={mColor?{borderLeft:`3px solid ${mColor}`,touchAction:"none"}:{touchAction:"none"}}>
                          <div className="text-gray-300 mr-2 shrink-0 select-none">⠿</div>
                          <div className="flex-1 min-w-0 flex items-center gap-2">
                            {mColor&&<div className="w-1.5 h-1.5 rounded-full shrink-0" style={{background:mColor}}/>}
                            <span className="text-sm text-gray-700">{item.label}</span>
                            {item.memo&&<span className="text-xs text-gray-400">{item.memo}</span>}
                          </div>
                          <div className="flex items-center gap-2 shrink-0"><span className="text-sm font-semibold text-gray-800">{fmt(item.amount)}</span><Btn size="sm" variant="ghost" onClick={()=>{setEi(item);setIForm({category:item.category,label:item.label,amount:String(item.amount),memo:item.memo||"",memberId:item.memberId||""});setIm(true);}}>수정</Btn><Btn size="sm" variant="danger" onClick={()=>setCdi(item.id)}>삭제</Btn></div>
                        </div>
                        );
                      })}</div>
                    </div>
                  );
                })}
              </div>
            ) : null;
          })()}
          {/* 비정기 섹션 */}
          {(() => {
            const irregCats = [...IRREGULAR_INCOME_CATS, ...IRREGULAR_EXPENSE_CATS];
            const irregItems = irregCats.map(cat => ({ cat, items: curPlan.items.filter(i => i.category === cat.value) })).filter(x => x.items.length > 0);
            const irregInc = curPlan.items.filter(i=>i.category==="irregular_income").reduce((s,i)=>s+i.amount,0);
            const irregExp = curPlan.items.filter(i=>i.category==="irregular").reduce((s,i)=>s+i.amount,0);
            return irregItems.length > 0 ? (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-3 pb-2 border-b-2 border-orange-100">
                  <span className="text-sm font-extrabold text-orange-600">⚡ 비정기</span>
                  <div className="flex gap-3 text-xs">
                    <span className="text-blue-400">수입 {fmtShort(irregInc)}</span>
                    <span className="text-orange-400">지출 {fmtShort(irregExp)}</span>
                  </div>
                </div>
                {irregItems.map(({cat, items}) => {
                  const tot = items.reduce((s,i)=>s+i.amount,0);
                  return (
                    <div key={cat.value} className="mb-4">
                      <div className="flex items-center justify-between mb-2"><div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full" style={{background:cat.color}}/><span className="text-xs font-bold text-gray-500 uppercase tracking-wide">{cat.label}</span></div><span className={`text-xs font-bold ${cat.isIncome?"text-blue-600":"text-orange-500"}`}>{fmt(tot)}</span></div>
                      <div className="space-y-1">{items.map((item, idx) => (
                        <div key={item.id} data-item-id={item.id}
                          draggable
                          onDragStart={(e)=>handleDragStart(e,item.id)}
                          onDragEnd={handleDragEnd}
                          onDragOver={(e)=>handleDragOver(e,item.id)}
                          onDrop={(e)=>handleDrop(e,item.id)}
                          onTouchStart={(e)=>handleTouchStart(e,item.id)}
                          onTouchEnd={(e)=>handleTouchEnd(e,item.id)}
                          className="flex items-center justify-between px-3 py-2 rounded-lg bg-orange-50 hover:bg-orange-100 transition cursor-grab active:cursor-grabbing">
                          <div className="text-orange-300 mr-2 shrink-0 select-none">⠿</div>
                          <div className="flex-1 min-w-0"><span className="text-sm text-gray-700">{item.label}</span>{item.memo&&<span className="text-xs text-gray-400 ml-2">{item.memo}</span>}</div>
                          <div className="flex items-center gap-2 shrink-0"><span className="text-sm font-semibold text-gray-800">{fmt(item.amount)}</span><Btn size="sm" variant="ghost" onClick={()=>{setEi(item);setIForm({category:item.category,label:item.label,amount:String(item.amount),memo:item.memo||""});setIm(true);}}>수정</Btn><Btn size="sm" variant="danger" onClick={()=>setCdi(item.id)}>삭제</Btn></div>
                        </div>
                      ))}</div>
                    </div>
                  );
                })}
              </div>
            ) : null;
          })()}
          {(() => {
            // 필터 적용된 항목
            const filtItems = memberFilter==="all" ? curPlan.items
              : memberFilter==="none" ? curPlan.items.filter(i=>!i.memberId)
              : curPlan.items.filter(i=>i.memberId===memberFilter);
            const filtMember = data.members.find(m=>m.id===memberFilter);

            const regInc = filtItems.filter(i=>i.category==="regular_income").reduce((s,i)=>s+i.amount,0);
            const irregInc = filtItems.filter(i=>i.category==="irregular_income").reduce((s,i)=>s+i.amount,0);
            const regExp = filtItems.filter(i=>REGULAR_EXPENSE_CATS.find(c=>c.value===i.category)).reduce((s,i)=>s+i.amount,0);
            const irregExp = filtItems.filter(i=>i.category==="irregular").reduce((s,i)=>s+i.amount,0);
            const net = regInc - regExp;

            // 카테고리별 합계 (필터 적용)
            const catSums = [...REGULAR_EXPENSE_CATS, ...IRREGULAR_EXPENSE_CATS].map(cat => ({
              cat,
              amount: filtItems.filter(i=>i.category===cat.value).reduce((s,i)=>s+i.amount,0)
            })).filter(d=>d.amount>0);

            return (
              <div className="border-t border-gray-100 pt-3 space-y-2">
                {memberFilter!=="all"&&<p className="text-xs font-bold text-gray-400 mb-1">
                  {filtMember?<span style={{color:filtMember.color}}>● {filtMember.name}</span>:"공용"} 기준
                </p>}
                {/* 수입/지출/순저축 요약 */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-2 rounded-xl bg-blue-50 text-center">
                    <p className="text-xs text-gray-400">정기수입</p>
                    <p className="text-sm font-bold text-blue-600">{fmt(regInc)}</p>
                  </div>
                  <div className="p-2 rounded-xl bg-red-50 text-center">
                    <p className="text-xs text-gray-400">정기지출</p>
                    <p className="text-sm font-bold text-red-500">{fmt(regExp)}</p>
                  </div>
                  <div className={`p-2 rounded-xl text-center ${net>=0?"bg-green-50":"bg-red-50"}`}>
                    <p className="text-xs text-gray-400">순저축</p>
                    <p className={`text-sm font-bold ${net>=0?"text-green-600":"text-red-500"}`}>{fmt(net)}</p>
                  </div>
                </div>
                {irregInc>0&&<div className="grid grid-cols-2 gap-2">
                  <div className="p-2 rounded-xl bg-blue-50 text-center">
                    <p className="text-xs text-gray-400">비정기수입</p>
                    <p className="text-sm font-bold text-blue-400">{fmt(irregInc)}</p>
                  </div>
                  <div className="p-2 rounded-xl bg-orange-50 text-center">
                    <p className="text-xs text-gray-400">비정기지출</p>
                    <p className="text-sm font-bold text-orange-500">{fmt(irregExp)}</p>
                  </div>
                </div>}
                {/* 카테고리별 지출 세부 */}
                {catSums.length>0&&<div className="mt-1 space-y-1">
                  <p className="text-xs font-bold text-gray-400">지출 카테고리별</p>
                  {catSums.map(({cat,amount})=>(
                    <div key={cat.value} className="flex items-center justify-between px-2 py-1 rounded-lg bg-gray-50 text-xs">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{background:cat.color}}/>
                        <span className="text-gray-600">{cat.label}</span>
                        {cat.value==="irregular"&&<span className="text-orange-400">(비정기)</span>}
                      </div>
                      <span className="font-bold text-gray-700">{fmt(amount)}</span>
                    </div>
                  ))}
                </div>}
              </div>
            );
          })()}
        </Card> : <Card><div className="text-center py-8 text-gray-400"><p className="text-4xl mb-3">📋</p><p className="text-sm">버전을 먼저 생성해주세요</p></div></Card>}
      </div>}

      {tab==="actual" && <div className="space-y-4">
        <Card className="!p-4">
          <div className="flex items-center gap-3 flex-wrap">
            <label className="text-sm font-semibold text-gray-600">월 선택:</label>
            <input type="month" value={aYM} onChange={(e)=>{setAYM(e.target.value);initActual(e.target.value);}} className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a2744]/30"/>
            {curActual&&<Badge color="#82C596" label="저장된 실적 있음"/>}
            <Btn size="sm" variant="success" onClick={saveActual} disabled={!activePlan}>💾 저장</Btn>
          </div>
        </Card>
        {activePlan ? <Card>
          <SectionTitle>✏️ {ymLabel(aYM)} 실적 입력</SectionTitle>
          {ALL_PLAN_CATEGORIES.map((cat) => {
            const items=activePlan.items.filter((i)=>i.category===cat.value);
            const exts=extras.filter((r)=>r.category===cat.value);
            if(!items.length&&!exts.length) return null;
            const planTot=items.reduce((s,i)=>s+i.amount,0);
            const actTot=items.reduce((s,i)=>s+(Number(aEdits[i.id])||0),0)+exts.reduce((s,r)=>s+(Number(r.amount)||0),0);
            const diff=actTot-planTot;
            const isInc=!!cat.isIncome;
            return (
              <div key={cat.value} className="mb-5">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full" style={{background:cat.color}}/><span className="text-xs font-bold text-gray-500 uppercase">{cat.label}</span></div>
                  <div className="flex items-center gap-2"><span className="text-xs text-gray-400">계획 {fmt(planTot)}</span><span className={`text-xs font-bold ${diff>0?(isInc?"text-green-600":"text-red-500"):diff<0?(isInc?"text-red-500":"text-green-600"):"text-gray-400"}`}>{diff>0?"+":""}{fmt(diff)}</span></div>
                </div>
                <div className="space-y-1">
                  {items.map((item) => (
                    <div key={item.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50">
                      <span className="text-sm text-gray-700 flex-1 min-w-0 truncate">{item.label}</span>
                      <span className="text-xs text-gray-400 shrink-0 hidden sm:inline">계획 {fmt(item.amount)}</span>
                      <input type="number" value={aEdits[item.id]??item.amount} onChange={(e)=>setAEdits((ed)=>({...ed,[item.id]:e.target.value}))} className="w-28 border border-gray-200 rounded-lg px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-[#1a2744]/30 shrink-0"/>
                    </div>
                  ))}
                  {exts.map((r) => (
                    <div key={r.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50">
                      <input value={r.label} onChange={(e)=>setExtras((rows)=>rows.map((x)=>x.id===r.id?{...x,label:e.target.value}:x))} placeholder="항목명" className="flex-1 border border-blue-200 rounded-lg px-2 py-1 text-sm focus:outline-none bg-white min-w-0"/>
                      <input type="number" value={r.amount} onChange={(e)=>setExtras((rows)=>rows.map((x)=>x.id===r.id?{...x,amount:e.target.value}:x))} className="w-28 border border-blue-200 rounded-lg px-2 py-1 text-sm text-right focus:outline-none bg-white shrink-0"/>
                      <button onClick={()=>setExtras((rows)=>rows.filter((x)=>x.id!==r.id))} className="text-red-400 hover:text-red-600 shrink-0">✕</button>
                    </div>
                  ))}
                  <button onClick={()=>setExtras((rows)=>[...rows,{id:genId(),category:cat.value,label:"",amount:""}])} className="text-xs text-blue-500 hover:text-blue-700 font-semibold mt-1 ml-3">+ 행 추가</button>
                </div>
              </div>
            );
          })}
          {/* 비정기 구분선 */}
          <div className="flex items-center gap-2 mt-4 mb-3 pb-2 border-b-2 border-orange-100"><span className="text-sm font-extrabold text-orange-600">⚡ 비정기</span></div>
          {[...IRREGULAR_INCOME_CATS, ...IRREGULAR_EXPENSE_CATS].map((cat) => {
            const items=activePlan.items.filter((i)=>i.category===cat.value);
            const exts=extras.filter((r)=>r.category===cat.value);
            if(!items.length&&!exts.length) return null;
            const planTot=items.reduce((s,i)=>s+i.amount,0);
            const actTot=items.reduce((s,i)=>s+(Number(aEdits[i.id])||0),0)+exts.reduce((s,r)=>s+(Number(r.amount)||0),0);
            const diff=actTot-planTot;
            const isInc=!!cat.isIncome;
            return (
              <div key={cat.value} className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full" style={{background:cat.color}}/><span className="text-xs font-bold text-gray-500 uppercase">{cat.label}</span></div>
                  <div className="flex items-center gap-2"><span className="text-xs text-gray-400">계획 {fmt(planTot)}</span><span className={`text-xs font-bold ${diff>0?(isInc?"text-green-600":"text-red-500"):diff<0?(isInc?"text-red-500":"text-green-600"):"text-gray-400"}`}>{diff>0?"+":""}{fmt(diff)}</span></div>
                </div>
                <div className="space-y-1">
                  {items.map((item) => {
                    // 비정기수입/지출 모두 다른 달 입력 확인
                    const isIrregCat = item.category === "irregular_income" || item.category === "irregular";
                    const received = isIrregCat ? getItemReceivedMonth(item.id) : null;
                    const isDisabled = !!received;
                    const isExpense = item.category === "irregular";
                    return (
                      <div key={item.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg ${isDisabled?"bg-gray-100":"bg-orange-50"}`}>
                        <span className={`text-sm flex-1 min-w-0 truncate ${isDisabled?"text-gray-400":"text-gray-700"}`}>{item.label}</span>
                        {isDisabled ? (
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-gray-400">{ymLabel(received.ym)} {isExpense?"지출됨":"수령"}</span>
                            <span className="text-sm font-bold text-gray-500">{fmt(received.amount)}</span>
                            <span className="text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full">완료</span>
                          </div>
                        ) : (
                          <>
                            <span className="text-xs text-gray-400 shrink-0 hidden sm:inline">계획 {fmt(item.amount)}</span>
                            <input type="number" value={aEdits[item.id]??0} onChange={(e)=>setAEdits((ed)=>({...ed,[item.id]:e.target.value}))} className="w-28 border border-orange-200 rounded-lg px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-orange-300/30 shrink-0"/>
                          </>
                        )}
                      </div>
                    );
                  })}
                  {exts.map((r) => (
                    <div key={r.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-100">
                      <input value={r.label} onChange={(e)=>setExtras((rows)=>rows.map((x)=>x.id===r.id?{...x,label:e.target.value}:x))} placeholder="항목명" className="flex-1 border border-orange-200 rounded-lg px-2 py-1 text-sm focus:outline-none bg-white min-w-0"/>
                      <input type="number" value={r.amount} onChange={(e)=>setExtras((rows)=>rows.map((x)=>x.id===r.id?{...x,amount:e.target.value}:x))} className="w-28 border border-orange-200 rounded-lg px-2 py-1 text-sm text-right focus:outline-none bg-white shrink-0"/>
                      <button onClick={()=>setExtras((rows)=>rows.filter((x)=>x.id!==r.id))} className="text-red-400 hover:text-red-600 shrink-0">✕</button>
                    </div>
                  ))}
                  <button onClick={()=>setExtras((rows)=>[...rows,{id:genId(),category:cat.value,label:"",amount:""}])} className="text-xs text-orange-500 hover:text-orange-700 font-semibold mt-1 ml-3">+ 행 추가</button>
                </div>
              </div>
            );
          })}
          {(() => {
            const totIncPlan=activePlan.items.filter((i)=>INCOME_CATEGORIES.find((c)=>c.value===i.category)).reduce((s,i)=>s+i.amount,0);
            const totIncAct=activePlan.items.filter((i)=>INCOME_CATEGORIES.find((c)=>c.value===i.category)).reduce((s,i)=>s+(Number(aEdits[i.id])||0),0)+extras.filter((r)=>INCOME_CATEGORIES.find((c)=>c.value===r.category)).reduce((s,r)=>s+(Number(r.amount)||0),0);
            const totExpPlan=activePlan.items.filter((i)=>EXPENSE_CATEGORIES.find((c)=>c.value===i.category)).reduce((s,i)=>s+i.amount,0);
            const totExpAct=activePlan.items.filter((i)=>EXPENSE_CATEGORIES.find((c)=>c.value===i.category)).reduce((s,i)=>s+(Number(aEdits[i.id])||0),0)+extras.filter((r)=>EXPENSE_CATEGORIES.find((c)=>c.value===r.category)).reduce((s,r)=>s+(Number(r.amount)||0),0);
            return <div className="border-t border-gray-100 pt-3 space-y-1">
              {[["수입 실적",totIncAct,"text-blue-600",`계획 ${fmt(totIncPlan)}`],["지출 실적",totExpAct,"text-red-500",`계획 ${fmt(totExpPlan)}`],["순저축",totIncAct-totExpAct,"text-green-600",""]].map(([l,v,c,sub])=>(
                <div key={l} className="flex justify-between items-center"><div><span className="text-sm font-semibold text-gray-700">{l}</span>{sub&&<span className="text-xs text-gray-400 ml-2">{sub}</span>}</div><span className={`text-sm font-bold ${c}`}>{fmt(v)}</span></div>
              ))}
            </div>;
          })()}
        </Card> : <Card><div className="text-center py-8 text-gray-400 text-sm">활성 계획 버전이 없습니다</div></Card>}
      </div>}

      {tab==="summary" && <div className="space-y-4">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
          {[["monthly","월간"],["yearly","연간"]].map(([k,l])=><button key={k} onClick={()=>setSumTab(k)} className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${sumTab===k?"bg-white text-[#1a2744] shadow-sm":"text-gray-500"}`}>{l}</button>)}
        </div>
        {sumTab==="monthly" && <div className="space-y-4">
          <Card className="!p-4"><div className="flex items-center gap-3"><label className="text-sm font-semibold text-gray-600">월 선택:</label><input type="month" value={sumYM} onChange={(e)=>setSumYM(e.target.value)} className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a2744]/30"/></div></Card>
          {(() => { const a=data.monthlyActuals.find((x)=>x.yearMonth===sumYM); if(!a) return <Card><div className="text-center py-8 text-gray-400 text-sm">해당 월 실적이 없습니다</div></Card>;
            const allItems=[...a.items,...(a.extraItems||[])];
            const regInc=allItems.filter((i)=>i.category==="regular_income").reduce((s,i)=>s+(i.actualAmount||0),0);
            const irregInc=allItems.filter((i)=>i.category==="irregular_income").reduce((s,i)=>s+(i.actualAmount||0),0);
            const regExp=allItems.filter((i)=>REGULAR_EXPENSE_CATS.find((c)=>c.value===i.category)).reduce((s,i)=>s+(i.actualAmount||0),0);
            const irregExp=allItems.filter((i)=>i.category==="irregular").reduce((s,i)=>s+(i.actualAmount||0),0);
            const inc=regInc; const exp=regExp; const net=inc-exp;
            // 계획 기준
            const planRegInc=a.items.filter((i)=>i.category==="regular_income").reduce((s,i)=>s+(i.plannedAmount||0),0);
            const planRegExp=a.items.filter((i)=>REGULAR_EXPENSE_CATS.find((c)=>c.value===i.category)).reduce((s,i)=>s+(i.plannedAmount||0),0);
            const planIrregInc=a.items.filter((i)=>i.category==="irregular_income").reduce((s,i)=>s+(i.plannedAmount||0),0);
            const planIrregExp=a.items.filter((i)=>i.category==="irregular").reduce((s,i)=>s+(i.plannedAmount||0),0);
            return <>
              <p className="text-xs font-bold text-gray-500 mb-2">📅 정기 수입/지출</p>
              <div className="grid grid-cols-2 gap-2 mb-1">
                <div className="text-center p-2 rounded-xl bg-blue-50"><p className="text-xs text-gray-400">계획 수입</p><p className="text-sm font-bold text-blue-400">{fmtShort(planRegInc)}</p></div>
                <div className="text-center p-2 rounded-xl bg-blue-50"><p className="text-xs text-gray-400">실적 수입</p><p className="text-sm font-bold text-blue-600">{fmtShort(regInc)}</p></div>
                <div className="text-center p-2 rounded-xl bg-red-50"><p className="text-xs text-gray-400">계획 지출</p><p className="text-sm font-bold text-red-300">{fmtShort(planRegExp)}</p></div>
                <div className="text-center p-2 rounded-xl bg-red-50"><p className="text-xs text-gray-400">실적 지출</p><p className="text-sm font-bold text-red-500">{fmtShort(regExp)}</p></div>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="text-center p-2 rounded-xl bg-green-50"><p className="text-xs text-gray-400">계획 순저축</p><p className="text-sm font-bold text-green-400">{fmtShort(planRegInc-planRegExp)}</p></div>
                <div className="text-center p-2 rounded-xl bg-green-50"><p className="text-xs text-gray-400">실적 순저축</p><p className={`text-sm font-bold ${net>=0?"text-green-600":"text-red-500"}`}>{fmtShort(net)}</p></div>
              </div>
              {(irregInc>0||irregExp>0||planIrregInc>0||planIrregExp>0)&&<>
                <p className="text-xs font-bold text-gray-500 mb-2">⚡ 비정기 수입/지출</p>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <div className="text-center p-2 rounded-xl bg-blue-50"><p className="text-xs text-gray-400">계획 수입</p><p className="text-sm font-bold text-blue-400">{fmtShort(planIrregInc)}</p></div>
                  <div className="text-center p-2 rounded-xl bg-blue-50"><p className="text-xs text-gray-400">실적 수입</p><p className="text-sm font-bold text-blue-600">{fmtShort(irregInc)}</p></div>
                  <div className="text-center p-2 rounded-xl bg-orange-50"><p className="text-xs text-gray-400">계획 지출</p><p className="text-sm font-bold text-orange-300">{fmtShort(planIrregExp)}</p></div>
                  <div className="text-center p-2 rounded-xl bg-orange-50"><p className="text-xs text-gray-400">실적 지출</p><p className="text-sm font-bold text-orange-500">{fmtShort(irregExp)}</p></div>
                </div>
              </>}
              {(() => {
                const regCatPie = REGULAR_EXPENSE_CATS.map(cat => ({
                  name: cat.label,
                  value: allItems.filter(i=>i.category===cat.value).reduce((s,i)=>s+(i.actualAmount||0),0),
                  color: cat.color
                })).filter(d=>d.value>0);
                return regCatPie.length>0 ? (
                  <Card>
                    <SectionTitle>📊 정기지출 비중</SectionTitle>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={regCatPie} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({percent})=>`${(percent*100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                          {regCatPie.map((d,i)=><Cell key={i} fill={d.color}/>)}
                        </Pie>
                        <Tooltip formatter={(v)=>fmt(v)}/>
                        <Legend wrapperStyle={{fontSize:10}} formatter={(value,entry)=>`${value} ${fmtShort(entry.payload.value)}`}/>
                      </PieChart>
                    </ResponsiveContainer>
                  </Card>
                ) : null;
              })()}
              <Card><SectionTitle>계획 vs 실적</SectionTitle><div className="space-y-1">{a.items.map((item)=>{const diff=item.actualAmount-item.plannedAmount; const isInc=!!INCOME_CATEGORIES.find((c)=>c.value===item.category); return(<div key={item.planItemId} className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 text-xs"><span className="text-gray-700 flex-1">{item.label}</span><span className="text-gray-400 w-20 text-right">{fmtShort(item.plannedAmount)}</span><span className="font-bold w-20 text-right text-gray-800">{fmtShort(item.actualAmount)}</span><span className={`w-16 text-right font-bold ${diff>0?(isInc?"text-green-600":"text-red-500"):diff<0?(isInc?"text-red-500":"text-green-600"):"text-gray-400"}`}>{diff>0?"+":""}{fmtShort(diff)}</span></div>);})}
              {(a.extraItems||[]).map((item)=><div key={item.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-blue-50 text-xs"><span className="text-blue-700 flex-1">{item.label} <span className="text-blue-400">(추가)</span></span><span className="font-bold w-20 text-right text-blue-800">{fmtShort(item.actualAmount||item.amount)}</span></div>)}</div></Card>
            </>;
          })()}
        </div>}
        {sumTab==="yearly" && <div className="space-y-4">
          <Card className="!p-4"><div className="flex items-center gap-3"><label className="text-sm font-semibold text-gray-600">연도:</label><select value={sumYear} onChange={(e)=>setSumYear(e.target.value)} className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none bg-white">{(years.length?years:[String(new Date().getFullYear())]).map((y)=><option key={y} value={y}>{y}년</option>)}</select></div></Card>
          {(() => {
            const yearActuals = data.monthlyActuals.filter(a=>a.yearMonth?.startsWith?.(sumYear));
            const nMonths = yearActuals.length || 12;
            // 계획: 정기 *12, 비정기는 그대로 (1회성)
            const planCatData = activePlan ? [...REGULAR_EXPENSE_CATS, ...IRREGULAR_EXPENSE_CATS].map(cat => {
              const isIrreg = cat.value === "irregular";
              const sum = activePlan.items.filter(i=>i.category===cat.value).reduce((s,i)=>s+i.amount,0);
              return { name: cat.label, value: isIrreg ? sum : sum*12, color: cat.color };
            }).filter(d=>d.value>0) : [];
            // 실적 카테고리별
            const actCatData = [...REGULAR_EXPENSE_CATS, ...IRREGULAR_EXPENSE_CATS].map(cat => ({
              name: cat.label, color: cat.color,
              value: yearActuals.flatMap(a=>[...a.items,...(a.extraItems||[])]).filter(i=>i.category===cat.value).reduce((s,i)=>s+(Number(i.actualAmount)||0),0)
            })).filter(d=>d.value>0);
            // 계획 수입: 정기*12 + 비정기수입 그대로
            const planRegInc = activePlan ? activePlan.items.filter(i=>i.category==="regular_income").reduce((s,i)=>s+i.amount,0)*12 : 0;
            const planIrregInc = activePlan ? activePlan.items.filter(i=>i.category==="irregular_income").reduce((s,i)=>s+i.amount,0) : 0;
            const planInc = planRegInc + planIrregInc;
            // 비정기수입 90% 저축, 10% 생활비 가정
            const irregInc90 = Math.round(planIrregInc * 0.9);
            const irregInc10 = planIrregInc - irregInc90;
            // 계획 지출: 정기*12 + 비정기 그대로
            const planRegExp = activePlan ? activePlan.items.filter(i=>REGULAR_EXPENSE_CATS.find(c=>c.value===i.category)).reduce((s,i)=>s+i.amount,0)*12 : 0;
            const planIrregExp = activePlan ? activePlan.items.filter(i=>i.category==="irregular").reduce((s,i)=>s+i.amount,0) : 0;
            const planExp = planRegExp + planIrregExp;
            // 계획 카테고리별 (비정기수입 90% 저축 반영)
            const planSavings = activePlan ? activePlan.items.filter(i=>i.category==="savings").reduce((s,i)=>s+i.amount,0)*12 + irregInc90 : 0;
            const planLiving = activePlan ? activePlan.items.filter(i=>i.category==="living").reduce((s,i)=>s+i.amount,0)*12 + irregInc10 : 0;
            // 실적 수입/지출
            const actInc = yearActuals.flatMap(a=>[...a.items,...(a.extraItems||[])]).filter(i=>i.category==="regular_income"||i.category==="irregular_income").reduce((s,i)=>s+(Number(i.actualAmount)||0),0);
            const actExp = yearActuals.flatMap(a=>[...a.items,...(a.extraItems||[])]).filter(i=>EXPENSE_CATEGORIES.find(c=>c.value===i.category)).reduce((s,i)=>s+(Number(i.actualAmount)||0),0);
            // "이대로라면 연간" 프로젝션: 입력된 달 실적 + 나머지 달 계획
            const allMonths = Array.from({length:12},(_,i)=>`${sumYear}-${String(i+1).padStart(2,"0")}`);
            const enteredMonths = new Set(yearActuals.map(a=>a.yearMonth));
            const remainMonths = 12 - enteredMonths.size;
            // 각 카테고리별 프로젝션
            const projByCat = {};
            [...REGULAR_EXPENSE_CATS,...IRREGULAR_EXPENSE_CATS].forEach(cat=>{
              const actVal = yearActuals.flatMap(a=>[...a.items,...(a.extraItems||[])]).filter(i=>i.category===cat.value).reduce((s,i)=>s+(Number(i.actualAmount)||0),0);
              const planMonthly = activePlan ? activePlan.items.filter(i=>i.category===cat.value).reduce((s,i)=>s+i.amount,0) : 0;
              const isIrreg = cat.value==="irregular";
              // 비정기는 실적 있으면 실적, 없으면 계획 전체
              const proj = isIrreg ? (actVal>0?actVal:planMonthly) : actVal + planMonthly*remainMonths;
              projByCat[cat.value] = proj;
            });
            // 수입 프로젝션
            const actIncRegular = yearActuals.flatMap(a=>a.items).filter(i=>i.category==="regular_income").reduce((s,i)=>s+(Number(i.actualAmount)||0),0);
            const planMonthlyInc = activePlan ? activePlan.items.filter(i=>i.category==="regular_income").reduce((s,i)=>s+i.amount,0) : 0;
            const projInc = actIncRegular + planMonthlyInc*remainMonths + planIrregInc;
            const projSavings = projByCat["savings"]||0;
            const projPension = projByCat["pension_exp"]||0;
            return <>
              {/* 수입/지출 요약 */}
              <div className="space-y-2 mb-2">
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 rounded-xl bg-blue-50">
                    <p className="text-xs text-gray-400 mb-0.5">연간 계획 수입</p>
                    <p className="text-base font-bold text-blue-400">{fmtShort(planInc)}</p>
                    <p className="text-xs text-gray-300">정기{fmtShort(planRegInc)} + 비정기{fmtShort(planIrregInc)}</p>
                  </div>
                  <div className="p-2 rounded-xl bg-blue-50">
                    <p className="text-xs text-gray-400 mb-0.5">실적 ({nMonths}개월)</p>
                    <p className="text-base font-bold text-blue-600">{fmtShort(actInc)}</p>
                    <p className="text-xs text-blue-300">이대로라면 {fmtShort(projInc)}</p>
                  </div>
                </div>
                {planIrregInc>0&&<div className="p-2 rounded-xl bg-amber-50 border border-amber-100 text-xs text-amber-700">
                  💡 비정기수입 {fmtShort(planIrregInc)} 중 90%({fmtShort(irregInc90)})는 저축, 10%({fmtShort(irregInc10)})는 생활비로 가정
                </div>}
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 rounded-xl bg-green-50">
                    <p className="text-xs text-gray-400 mb-0.5">계획 저축 (비정기90% 포함)</p>
                    <p className="text-base font-bold text-green-400">{fmtShort(planSavings)}</p>
                  </div>
                  <div className="p-2 rounded-xl bg-green-50">
                    <p className="text-xs text-gray-400 mb-0.5">실적 저축</p>
                    <p className="text-base font-bold text-green-600">{fmtShort(yearActuals.flatMap(a=>a.items).filter(i=>i.category==="savings").reduce((s,i)=>s+(Number(i.actualAmount)||0),0))}</p>
                    <p className="text-xs text-green-300">이대로라면 {fmtShort(projSavings)}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 rounded-xl bg-red-50">
                    <p className="text-xs text-gray-400 mb-0.5">계획 지출</p>
                    <p className="text-base font-bold text-red-300">{fmtShort(planExp)}</p>
                    <p className="text-xs text-gray-300">정기{fmtShort(planRegExp)} + 비정기{fmtShort(planIrregExp)}</p>
                  </div>
                  <div className="p-2 rounded-xl bg-red-50">
                    <p className="text-xs text-gray-400 mb-0.5">실적 지출</p>
                    <p className="text-base font-bold text-red-500">{fmtShort(actExp)}</p>
                    <p className="text-xs text-red-300">이대로라면 {fmtShort(Object.values(projByCat).reduce((s,v)=>s+v,0))}</p>
                  </div>
                </div>
              </div>
              {/* 계획 도넛(왼) vs 실적 도넛(오) */}
              {(planCatData.length>0||actCatData.length>0)&&<Card>
                <SectionTitle>📊 지출 구성 비교</SectionTitle>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-xs font-bold text-center text-gray-400 mb-2">계획</p>
                    <ResponsiveContainer width="100%" height={160}>
                      <PieChart><Pie data={planCatData} cx="50%" cy="50%" outerRadius={55} dataKey="value" label={({percent})=>`${(percent*100).toFixed(0)}%`} labelLine={false} fontSize={9}>{planCatData.map((d,i)=><Cell key={i} fill={d.color}/>)}</Pie><Tooltip formatter={(v)=>fmt(v)}/></PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-center text-gray-400 mb-2">실적</p>
                    <ResponsiveContainer width="100%" height={160}>
                      <PieChart><Pie data={actCatData} cx="50%" cy="50%" outerRadius={55} dataKey="value" label={({percent})=>`${(percent*100).toFixed(0)}%`} labelLine={false} fontSize={9}>{actCatData.map((d,i)=><Cell key={i} fill={d.color}/>)}</Pie><Tooltip formatter={(v)=>fmt(v)}/></PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                {/* 범례 + 금액표 */}
                <div className="mt-3 space-y-1">{[...REGULAR_EXPENSE_CATS,...IRREGULAR_EXPENSE_CATS].map(cat=>{
                  const pv=planCatData.find(d=>d.name===cat.label)?.value||0;
                  const av=actCatData.find(d=>d.name===cat.label)?.value||0;
                  const proj=projByCat[cat.value]||0;
                  if(!pv&&!av) return null;
                  const diff = av>pv?"text-red-500":av<pv?"text-green-600":"text-gray-700";
                  return <div key={cat.value} className="flex items-center text-xs px-2 py-1.5 rounded-lg bg-gray-50">
                    <div className="w-2 h-2 rounded-full mr-2 shrink-0" style={{background:cat.color}}/>
                    <span className="flex-1 text-gray-600">{cat.label}</span>
                    <span className="w-14 text-right text-gray-400">{fmtShort(pv)}</span>
                    <span className="w-4 text-center text-gray-300">→</span>
                    <span className={`font-bold ${diff}`}>{fmtShort(av)}</span>
                    {nMonths>0&&nMonths<12&&<span className="text-gray-300 ml-1">({fmtShort(proj)})</span>}
                  </div>;
                })}</div>
              </Card>}
              {/* 월별 차트 */}
              {yearData.months.length>0&&<Card><SectionTitle>월별 수입/지출</SectionTitle><ResponsiveContainer width="100%" height={200}><BarChart data={yearData.months} margin={{top:5,right:5,bottom:5,left:0}}><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/><XAxis dataKey="label" tick={{fontSize:10}}/><YAxis tickFormatter={(v)=>fmtShort(v)} tick={{fontSize:10}}/><Tooltip formatter={(v)=>fmt(v)}/><Legend wrapperStyle={{fontSize:10}}/><Bar dataKey="income" name="수입" fill="#4F86C6" radius={[4,4,0,0]}/><Bar dataKey="expense" name="지출" fill="#E85D75" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></Card>}
            </>;
          })()}
        </div>}
      </div>}

      <Modal open={im} onClose={()=>setIm(false)} title={ei?"항목 수정":"항목 추가"}><div className="space-y-3"><Sel label="카테고리" value={iForm.category} onChange={(v)=>setIForm((f)=>({...f,category:v}))} options={ALL_PLAN_CATEGORIES}/><Sel label="구성원" value={iForm.memberId||""} onChange={(v)=>setIForm((f)=>({...f,memberId:v}))} options={[{value:"",label:"공용/미지정"},...data.members.map(m=>({value:m.id,label:m.name}))]}/><Inp label="항목명" value={iForm.label} onChange={(v)=>setIForm((f)=>({...f,label:v}))} required/><Inp label="금액 (원)" type="number" value={iForm.amount} onChange={(v)=>setIForm((f)=>({...f,amount:v}))}/><Inp label="메모" value={iForm.memo} onChange={(v)=>setIForm((f)=>({...f,memo:v}))}/><div className="flex gap-2 justify-end"><Btn variant="secondary" onClick={()=>setIm(false)}>취소</Btn><Btn onClick={saveItem}>저장</Btn></div></div></Modal>
      <Modal open={vm} onClose={()=>setVm(false)} title="새 버전 생성"><div className="space-y-3"><p className="text-xs text-gray-500">기존 활성 버전을 복사해서 새 버전이 만들어집니다.</p><Inp label="버전 이름" value={vForm.label} onChange={(v)=>setVForm((f)=>({...f,label:v}))} placeholder="ex) v2 (2025.07~)" required/><Inp label="적용 시작일" type="date" value={vForm.startDate} onChange={(v)=>setVForm((f)=>({...f,startDate:v}))} required/><div className="flex gap-2 justify-end"><Btn variant="secondary" onClick={()=>setVm(false)}>취소</Btn><Btn onClick={createVer}>생성</Btn></div></div></Modal>
      <Confirm open={!!cdi} message="이 항목을 삭제하시겠습니까?" onConfirm={()=>{if(!curPlan)return; setData((d)=>({...d,incomeExpensePlans:d.incomeExpensePlans.map((p)=>p.id===curPlan.id?{...p,items:p.items.filter((i)=>i.id!==cdi)}:p)})); setCdi(null);}} onCancel={()=>setCdi(null)}/>
      <Confirm open={!!cdv} message="이 버전을 삭제하시겠습니까?" onConfirm={()=>{setData((d)=>({...d,incomeExpensePlans:d.incomeExpensePlans.filter((p)=>p.id!==cdv)})); setCdv(null); setSelVer(null);}} onCancel={()=>setCdv(null)}/>
    </div>
  );
};

// ─────────────────────────────────────────────
// 재무상태표
// ─────────────────────────────────────────────
const BalanceSheetSection = ({ data, setData }) => {
  const [selSnap, setSelSnap] = useState(null);
  const [sm, setSm] = useState(false); const [sf, setSf] = useState({ yearMonth:thisYearMonth(), memo:"" });
  const [cd, setCd] = useState(null);
  const totF=data.accounts.reduce((s,a)=>s+(a.balance||0),0);
  const totR=data.realEstate.reduce((s,r)=>s+(r.currentPrice||0),0);
  const totL=data.loans.reduce((s,l)=>s+(l.balance||0),0);
  const totA=totF+totR; const nw=totA-totL;
  const takeSnap = () => {
    const detail={ financialByCategory:ACCOUNT_CATEGORIES.map((cat)=>({category:cat.label,amount:data.accounts.filter((a)=>a.category===cat.value).reduce((s,a)=>s+(a.balance||0),0)})).filter((d)=>d.amount>0), realEstateItems:data.realEstate.map((r)=>({name:r.name,currentPrice:r.currentPrice})), loanItems:data.loans.map((l)=>({name:l.name,balance:l.balance})) };
    const ex=data.balanceSheetSnapshots.find((s)=>s.yearMonth===sf.yearMonth);
    const snap={id:ex?.id||genId(),yearMonth:sf.yearMonth,memo:sf.memo,totalAssets:totA,realEstateAssets:totR,financialAssets:totF,totalLiabilities:totL,netWorth:nw,detail,createdAt:new Date().toISOString()};
    setData((d)=>({...d,balanceSheetSnapshots:ex?d.balanceSheetSnapshots.map((s)=>s.yearMonth===sf.yearMonth?snap:s):[...d.balanceSheetSnapshots,snap]}));
    setSm(false); alert("스냅샷이 저장되었습니다!");
  };
  const sorted=[...data.balanceSheetSnapshots].sort((a,b)=>a.yearMonth.localeCompare(b.yearMonth));
  const chartData=sorted.map((s)=>({label:ymLabel(s.yearMonth),자산:s.totalAssets,부채:s.totalLiabilities,순자산:s.netWorth}));
  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center justify-between mb-4"><SectionTitle>📋 현재 재무 현황</SectionTitle><Btn size="sm" onClick={()=>{setSf({yearMonth:thisYearMonth(),memo:""});setSm(true);}}>📸 스냅샷 저장</Btn></div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[["총자산",totA,"#1a2744"],["부동산",totR,"#82C596"],["금융자산",totF,"#4F86C6"],["총부채",totL,"#E85D75"]].map(([l,v,c])=><div key={l} className="p-3 rounded-xl bg-gray-50 text-center"><p className="text-xs text-gray-400 mb-1">{l}</p><p className="text-sm font-bold" style={{color:c}}>{fmtShort(v)}</p></div>)}</div>
        <div className="mt-3 p-4 rounded-xl bg-[#1a2744] text-white text-center"><p className="text-xs text-blue-200 mb-1">순자산</p><p className="text-2xl font-extrabold">{fmt(nw)}</p></div>
      </Card>
      {chartData.length>=2&&<Card><SectionTitle>📈 순자산 추이</SectionTitle><ResponsiveContainer width="100%" height={220}><LineChart data={chartData} margin={{top:5,right:5,bottom:5,left:0}}><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/><XAxis dataKey="label" tick={{fontSize:11}}/><YAxis tickFormatter={(v)=>fmtShort(v)} tick={{fontSize:11}}/><Tooltip formatter={(v)=>fmt(v)}/><Legend wrapperStyle={{fontSize:11}}/><Line type="monotone" dataKey="자산" stroke="#4F86C6" strokeWidth={2} dot={false}/><Line type="monotone" dataKey="부채" stroke="#E85D75" strokeWidth={2} dot={false}/><Line type="monotone" dataKey="순자산" stroke="#82C596" strokeWidth={2.5} dot={{fill:"#82C596",r:3}}/></LineChart></ResponsiveContainer></Card>}
      <Card>
        <SectionTitle>🗓 월별 스냅샷 이력</SectionTitle>
        {!sorted.length&&<p className="text-sm text-gray-400 text-center py-6">저장된 스냅샷이 없습니다</p>}
        <div className="space-y-2">{[...sorted].reverse().map((s) => {
          const idx=sorted.findIndex((x)=>x.id===s.id); const prev=sorted[idx-1]; const diff=prev?s.netWorth-prev.netWorth:null;
          return (
            <div key={s.id} className={`p-3 rounded-xl border cursor-pointer transition-all ${selSnap===s.id?"border-[#1a2744] bg-blue-50":"border-gray-100 bg-gray-50 hover:bg-gray-100"}`} onClick={()=>setSelSnap(selSnap===s.id?null:s.id)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3"><span className="text-sm font-bold text-gray-700">{ymLabel(s.yearMonth)}</span>{s.memo&&<span className="text-xs text-gray-400">{s.memo}</span>}</div>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  <div className="text-right"><p className="text-xs text-gray-400">총자산</p><p className="text-xs font-bold text-[#4F86C6]">{fmtShort(s.totalAssets)}</p></div>
                  <div className="text-right"><p className="text-xs text-gray-400">부채</p><p className="text-xs font-bold text-red-400">{fmtShort(s.totalLiabilities)}</p></div>
                  <div className="text-right"><p className="text-xs text-gray-400">순자산</p><p className="text-sm font-bold text-[#1a2744]">{fmtShort(s.netWorth)}</p></div>
                  {diff!=null&&<span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${diff>=0?"bg-green-50 text-green-600":"bg-red-50 text-red-500"}`}>{diff>=0?"+":""}{fmtShort(diff)}</span>}
                  <Btn size="sm" variant="danger" onClick={(e)=>{e.stopPropagation();setCd(s.id);}}>삭제</Btn>
                </div>
              </div>
              {selSnap===s.id&&<div className="mt-3 pt-3 border-t border-blue-100 space-y-3">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{[["총자산",s.totalAssets],["부동산",s.realEstateAssets],["금융자산",s.financialAssets],["총부채",s.totalLiabilities]].map(([l,v])=><div key={l} className="bg-white rounded-lg p-2 text-center"><p className="text-xs text-gray-400">{l}</p><p className="text-xs font-bold text-gray-700">{fmtShort(v)}</p></div>)}</div>
                {s.detail?.financialByCategory?.length>0&&<div><p className="text-xs font-bold text-gray-500 mb-1">금융자산 세부</p><div className="grid grid-cols-2 gap-1">{s.detail.financialByCategory.map((d)=><div key={d.category} className="flex justify-between bg-white rounded-lg px-2 py-1 text-xs"><span className="text-gray-500">{d.category}</span><span className="font-semibold">{fmtShort(d.amount)}</span></div>)}</div></div>}
                {s.detail?.realEstateItems?.length>0&&<div><p className="text-xs font-bold text-gray-500 mb-1">부동산 세부</p>{s.detail.realEstateItems.map((r)=><div key={r.name} className="flex justify-between bg-white rounded-lg px-2 py-1 text-xs"><span className="text-gray-500">{r.name}</span><span className="font-semibold">{fmtShort(r.currentPrice)}</span></div>)}</div>}
                {s.detail?.loanItems?.length>0&&<div><p className="text-xs font-bold text-gray-500 mb-1">부채 세부</p>{s.detail.loanItems.map((l)=><div key={l.name} className="flex justify-between bg-white rounded-lg px-2 py-1 text-xs"><span className="text-gray-500">{l.name}</span><span className="font-semibold text-red-500">{fmtShort(l.balance)}</span></div>)}</div>}
              </div>}
            </div>
          );
        })}</div>
      </Card>
      <Modal open={sm} onClose={()=>setSm(false)} title="스냅샷 저장"><div className="space-y-3"><p className="text-xs text-gray-500">현재 자산/부채 데이터를 해당 월 기록으로 저장합니다.</p><Inp label="기록 월" type="month" value={sf.yearMonth} onChange={(v)=>setSf((f)=>({...f,yearMonth:v}))}/><Inp label="메모" value={sf.memo} onChange={(v)=>setSf((f)=>({...f,memo:v}))}/><div className="p-3 rounded-xl bg-gray-50 space-y-1 text-sm">{[["총자산",totA],["부동산",totR],["금융자산",totF],["총부채",totL],["순자산",nw]].map(([l,v])=><div key={l} className="flex justify-between"><span className="text-gray-500">{l}</span><span className="font-bold">{fmt(v)}</span></div>)}</div><div className="flex gap-2 justify-end"><Btn variant="secondary" onClick={()=>setSm(false)}>취소</Btn><Btn onClick={takeSnap}>저장</Btn></div></div></Modal>
      <Confirm open={!!cd} message="이 스냅샷을 삭제하시겠습니까?" onConfirm={()=>{setData((d)=>({...d,balanceSheetSnapshots:d.balanceSheetSnapshots.filter((s)=>s.id!==cd)}));setCd(null);setSelSnap(null);}} onCancel={()=>setCd(null)}/>
    </div>
  );
};

// ─────────────────────────────────────────────
// 대시보드
// ─────────────────────────────────────────────
const DashboardSection = ({ data }) => {
  const totF=data.accounts.reduce((s,a)=>s+(a.balance||0),0);
  const totR=data.realEstate.reduce((s,r)=>s+(r.currentPrice||0),0);
  const totL=data.loans.reduce((s,l)=>s+(l.balance||0),0);
  const totA=totF+totR; const nw=totA-totL;
  const lastSnaps=[...data.balanceSheetSnapshots].sort((a,b)=>b.yearMonth.localeCompare(a.yearMonth));
  const snapDiff=lastSnaps.length>=2?lastSnaps[0].netWorth-lastSnaps[1].netWorth:null;
  const thisYM=thisYearMonth();
  const thisActual=data.monthlyActuals.find((a)=>a.yearMonth===thisYM);
  const getIncExp=(a)=>{if(!a)return[null,null]; const inc=a.items.filter((i)=>INCOME_CATEGORIES.find((c)=>c.value===i.category)).reduce((s,i)=>s+(i.actualAmount||0),0)+(a.extraItems||[]).filter((i)=>INCOME_CATEGORIES.find((c)=>c.value===i.category)).reduce((s,i)=>s+(i.actualAmount||0),0); const exp=a.items.filter((i)=>EXPENSE_CATEGORIES.find((c)=>c.value===i.category)).reduce((s,i)=>s+(i.actualAmount||0),0)+(a.extraItems||[]).filter((i)=>EXPENSE_CATEGORIES.find((c)=>c.value===i.category)).reduce((s,i)=>s+(i.actualAmount||0),0); return[inc,exp];};
  const [tInc,tExp]=getIncExp(thisActual);
  const assetPie=[{name:"부동산",value:totR,color:"#82C596"},{name:"금융자산",value:totF,color:"#4F86C6"}].filter((d)=>d.value>0);
  const finPie=DISPLAY_CATEGORIES.map((cat)=>({name:cat.label,value:data.accounts.filter((a)=>toDisplayCat(a.category)===cat.value).reduce((s,a)=>s+(a.balance||0),0),color:cat.color})).filter((d)=>d.value>0);
  const snapChart=[...data.balanceSheetSnapshots].sort((a,b)=>a.yearMonth.localeCompare(b.yearMonth)).slice(-12).map((s)=>({label:ymLabel(s.yearMonth),순자산:s.netWorth}));
  return (
    <div className="space-y-4">
      <div className="p-5 rounded-2xl text-white shadow-lg" style={{background:"linear-gradient(135deg, #1a2744 0%, #2d4270 100%)"}}>
        <p className="text-xs text-blue-200 mb-1">총 순자산</p>
        <p className="text-3xl font-extrabold mb-2">{fmt(nw)}</p>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs text-blue-200">총자산 {fmtShort(totA)}</span>
          <span className="text-xs text-blue-300">|</span>
          <span className="text-xs text-blue-200">총부채 {fmtShort(totL)}</span>
          {snapDiff!=null&&<span className={`text-xs font-bold px-2 py-0.5 rounded-full ${snapDiff>=0?"bg-green-500/20 text-green-300":"bg-red-500/20 text-red-300"}`}>전월비 {snapDiff>=0?"+":""}{fmtShort(snapDiff)}</span>}
        </div>
      </div>
      {assetPie.length>0&&<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card><SectionTitle>부동산 vs 금융자산</SectionTitle><ResponsiveContainer width="100%" height={180}><PieChart><Pie data={assetPie} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value" label={({name,percent})=>`${name} ${(percent*100).toFixed(0)}%`} labelLine={false} fontSize={11}>{assetPie.map((d,i)=><Cell key={i} fill={d.color}/>)}</Pie><Tooltip formatter={(v)=>fmt(v)}/></PieChart></ResponsiveContainer></Card>
        <Card><SectionTitle>금융자산 구성</SectionTitle>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={finPie} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" label={({percent})=>`${(percent*100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                {finPie.map((d,i)=><Cell key={i} fill={d.color}/>)}
              </Pie>
              <Tooltip formatter={(v)=>fmt(v)}/>
              <Legend wrapperStyle={{fontSize:10}} formatter={(value, entry)=>`${value} ${fmtShort(entry.payload.value)}`}/>
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>}
      {(() => {
        const thisYear = String(new Date().getFullYear());
        const yearActuals = data.monthlyActuals.filter(a=>a.yearMonth?.startsWith?.(thisYear));
        const activePlan = data.incomeExpensePlans.find(p=>p.isActive)||data.incomeExpensePlans.slice(-1)[0];
        if(!activePlan) return null;
        // 컬럼 정의: 수입 / 고정지출 / 생활비 / 저축 / 연금
        const COLS = [
          {key:"income", label:"수입", cats:["regular_income"], color:"#4F86C6"},
          {key:"irreg_inc", label:"비정기수입", cats:["irregular_income"], color:"#82C596", isIrreg:true},
          {key:"fixed", label:"고정지출", cats:["fixed","financial_cost"], color:"#E85D75"},
          {key:"living", label:"생활비", cats:["living"], color:"#9B6FD4"},
          {key:"savings", label:"저축", cats:["savings"], color:"#82C596"},
          {key:"pension", label:"연금", cats:["pension_exp"], color:"#E8A87C"},
          {key:"net", label:"순저축", cats:[], color:"#1a2744", isCalc:true},
        ];
        const getPlan = (cats) => cats.reduce((s,c)=>s+activePlan.items.filter(i=>i.category===c).reduce((ss,i)=>ss+i.amount,0),0);
        const getActual = (a, cats) => {
          if(!a) return null;
          return [...a.items,...(a.extraItems||[])].filter(i=>cats.includes(i.category)).reduce((s,i)=>s+(Number(i.actualAmount)||0),0);
        };
        const getColVal = (a, col, isFuture, isEntered) => {
          if(col.isCalc) {
            // 순저축 = 수입 - 고정지출 - 생활비 - 저축 - 연금
            const inc = isEntered ? getActual(a,["regular_income"]) : isFuture ? null : getPlan(["regular_income"]);
            const exp = isEntered ? getActual(a,["fixed","financial_cost","living","savings","pension_exp"]) : isFuture ? null : getPlan(["fixed","financial_cost","living","savings","pension_exp"]);
            return (inc!=null && exp!=null) ? inc - exp : null;
          }
          if(col.isIrreg) {
            // 비정기수입: 실적 입력된 달만 표시, 미입력/미래는 -
            return isEntered ? getActual(a, col.cats) : null;
          }
          return isEntered ? getActual(a,col.cats) : isFuture ? null : getPlan(col.cats);
        };
        const months = Array.from({length:12},(_,i)=>`${thisYear}-${String(i+1).padStart(2,"0")}`);
        const now = thisYearMonth();
        return (
          <Card>
            <SectionTitle>💰 수입/지출 현황</SectionTitle>
            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-xs min-w-[420px]">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 pl-2 text-gray-400 font-semibold w-10">월</th>
                    {COLS.map(c=><th key={c.key} className="text-right py-2 pr-1.5 font-semibold whitespace-nowrap" style={{color:c.color}}>{c.label}</th>)}
                  </tr>
                  <tr className="border-b-2 border-gray-200 bg-gray-50">
                    <td className="py-1.5 pl-2 text-gray-400 font-bold">계획</td>
                    {COLS.map(c=>{
                      let planVal;
                      if(c.isCalc) {
                        const inc = getPlan(["regular_income"]);
                        const exp = getPlan(["fixed","financial_cost","living","savings","pension_exp"]);
                        planVal = inc - exp;
                      } else if(c.isIrreg) {
                        planVal = getPlan(c.cats); // 비정기수입 계획 합계
                      } else {
                        planVal = getPlan(c.cats);
                      }
                      return <td key={c.key} className={`py-1.5 pr-1.5 text-right font-bold ${c.isCalc?(planVal>=0?"text-green-600":"text-red-500"):"text-gray-500"}`}>{fmtShort(planVal)}</td>;
                    })}
                  </tr>
                </thead>
                <tbody>
                  {months.map(ym=>{
                    const a = data.monthlyActuals.find(x=>x.yearMonth===ym);
                    const isFuture = ym > now;
                    const isEntered = !!a;
                    return (
                      <tr key={ym} className={`border-b border-gray-50 ${isFuture?"opacity-30":isEntered?"":"opacity-50"}`}>
                        <td className="py-1.5 pl-2 font-semibold text-gray-600">{ym.slice(5)}월</td>
                        {COLS.map(c=>{
                          const val = getColVal(a, c, isFuture, isEntered);
                          const plan = c.isCalc ? getPlan(["regular_income"])-getPlan(["fixed","financial_cost","living","savings","pension_exp"]) : getPlan(c.cats);
                          const isOver = val!=null && !c.isIrreg && c.key!=="income" && c.key!=="savings" && c.key!=="pension" && !c.isCalc && val>plan;
                          const isUnder = val!=null && (c.key==="savings"||c.key==="pension") && val<plan;
                          const netColor = c.isCalc && val!=null ? (val>=0?"text-green-600":"text-red-500") : "";
                          return <td key={c.key} className={`py-1.5 pr-1.5 text-right font-semibold ${netColor||( isFuture?"text-gray-300":isEntered?(isOver?"text-red-500":isUnder?"text-orange-400":"text-gray-700"):"text-gray-300 italic")}`}>
                            {val!=null?fmtShort(val):"-"}
                          </td>;
                        })}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200 bg-gray-50">
                    <td className="py-1.5 pl-2 text-gray-500 font-bold">누적</td>
                    {COLS.map(c=>{
                      let tot;
                      if(c.isCalc) {
                        const incTot = yearActuals.flatMap(a=>[...a.items,...(a.extraItems||[])]).filter(i=>["regular_income"].includes(i.category)).reduce((s,i)=>s+(Number(i.actualAmount)||0),0);
                        const expTot = yearActuals.flatMap(a=>[...a.items,...(a.extraItems||[])]).filter(i=>["fixed","financial_cost","living","savings","pension_exp"].includes(i.category)).reduce((s,i)=>s+(Number(i.actualAmount)||0),0);
                        tot = incTot - expTot;
                      } else {
                        tot = yearActuals.flatMap(a=>[...a.items,...(a.extraItems||[])]).filter(i=>c.cats.includes(i.category)).reduce((s,i)=>s+(Number(i.actualAmount)||0),0);
                      }
                      const netColor = c.isCalc ? (tot>=0?"text-green-600":"text-red-500") : "";
                      return <td key={c.key} className={`py-1.5 pr-1.5 text-right font-bold ${netColor}`} style={!netColor?{color:c.color}:{}}>{tot!==0?fmtShort(tot):"-"}</td>;
                    })}
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
        );
      })()}
      {snapChart.length>=1&&<Card>
        <SectionTitle>📈 자산 추이</SectionTitle>
        {snapChart.length>=2&&<ResponsiveContainer width="100%" height={200}>
          <LineChart data={[...data.balanceSheetSnapshots].sort((a,b)=>a.yearMonth.localeCompare(b.yearMonth)).slice(-12).map((s)=>({label:ymLabel(s.yearMonth),총자산:s.totalAssets,부채:s.totalLiabilities,순자산:s.netWorth}))} margin={{top:5,right:5,bottom:5,left:0}}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
            <XAxis dataKey="label" tick={{fontSize:10}}/>
            <YAxis tickFormatter={(v)=>fmtShort(v)} tick={{fontSize:10}}/>
            <Tooltip formatter={(v)=>fmt(v)}/>
            <Legend wrapperStyle={{fontSize:11}}/>
            <Line type="monotone" dataKey="총자산" stroke="#4F86C6" strokeWidth={2} dot={false}/>
            <Line type="monotone" dataKey="부채" stroke="#E85D75" strokeWidth={2} dot={false}/>
            <Line type="monotone" dataKey="순자산" stroke="#82C596" strokeWidth={2.5} dot={{fill:"#82C596",r:3}}/>
          </LineChart>
        </ResponsiveContainer>}
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="border-b border-gray-100">{["월","총자산","부채","순자산","전월대비"].map(h=><th key={h} className="text-right py-1.5 pr-2 text-gray-400 font-semibold first:text-left">{h}</th>)}</tr></thead>
            <tbody>{[...data.balanceSheetSnapshots].sort((a,b)=>b.yearMonth.localeCompare(a.yearMonth)).slice(0,12).map((s,i,arr)=>{
              const prev=arr[i+1]; const diff=prev?s.netWorth-prev.netWorth:null;
              return <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="py-1.5 pr-2 font-semibold text-gray-700">{ymLabel(s.yearMonth)}</td>
                <td className="py-1.5 pr-2 text-right text-gray-600">{fmtShort(s.totalAssets)}</td>
                <td className="py-1.5 pr-2 text-right text-red-400">{fmtShort(s.totalLiabilities)}</td>
                <td className="py-1.5 pr-2 text-right font-bold text-[#1a2744]">{fmtShort(s.netWorth)}</td>
                <td className="py-1.5 text-right font-bold">{diff!=null?<span className={diff>=0?"text-green-600":"text-red-500"}>{diff>=0?"+":""}{fmtShort(diff)}</span>:<span className="text-gray-300">-</span>}</td>
              </tr>;
            })}</tbody>
          </table>
        </div>
      </Card>}
      {/* 연간 계획 vs 실적 */}
      {(() => {
        const thisYear = String(new Date().getFullYear());
        const activePlan = data.incomeExpensePlans.find(p=>p.isActive) || data.incomeExpensePlans.slice(-1)[0];
        const yearActuals = data.monthlyActuals.filter(a=>a.yearMonth?.startsWith?.(thisYear));
        if (!activePlan) return null;
        // 계획
        // 정기*12 + 비정기 그대로
        const planCatRows = [...REGULAR_EXPENSE_CATS, ...IRREGULAR_EXPENSE_CATS].map(cat => ({
          cat,
          plan: activePlan.items.filter(i=>i.category===cat.value).reduce((s,i)=>s+i.amount,0) * (cat.value==="irregular" ? 1 : 12),
          actual: yearActuals.flatMap(a=>[...a.items,...(a.extraItems||[])]).filter(i=>i.category===cat.value).reduce((s,i)=>s+(Number(i.actualAmount)||0),0)
        })).filter(r=>r.plan>0||r.actual>0);
        const planPieData = planCatRows.map(r=>({name:r.cat.label,value:r.plan,color:r.cat.color})).filter(d=>d.value>0);
        const actPieData = planCatRows.map(r=>({name:r.cat.label,value:r.actual,color:r.cat.color})).filter(d=>d.value>0);
        const planRegInc2 = activePlan.items.filter(i=>i.category==="regular_income").reduce((s,i)=>s+i.amount,0)*12;
        const planIrregInc2 = activePlan.items.filter(i=>i.category==="irregular_income").reduce((s,i)=>s+i.amount,0);
        const planInc = planRegInc2 + planIrregInc2;
        const actInc = yearActuals.flatMap(a=>[...a.items,...(a.extraItems||[])]).filter(i=>i.category==="regular_income"||i.category==="irregular_income").reduce((s,i)=>s+(Number(i.actualAmount)||0),0);
        return (
          <Card>
            <SectionTitle>📊 {thisYear}년 계획 vs 실적</SectionTitle>
            {/* 수입 비교 */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="p-2 rounded-xl bg-blue-50 text-center"><p className="text-xs text-gray-400">연간 계획 수입</p><p className="text-sm font-bold text-blue-400">{fmtShort(planInc)}</p></div>
              <div className="p-2 rounded-xl bg-blue-50 text-center"><p className="text-xs text-gray-400">실적 수입 ({yearActuals.length}개월)</p><p className="text-sm font-bold text-blue-600">{fmtShort(actInc)}</p></div>
            </div>
            {/* 계획 도넛(왼) vs 실적 도넛(오) */}
            {(planPieData.length>0||actPieData.length>0)&&<div className="grid grid-cols-2 gap-1">
              <div><p className="text-xs text-center text-gray-400 mb-1">계획 지출</p>
                <ResponsiveContainer width="100%" height={140}><PieChart><Pie data={planPieData} cx="50%" cy="50%" outerRadius={50} dataKey="value" label={({percent})=>`${(percent*100).toFixed(0)}%`} labelLine={false} fontSize={9}>{planPieData.map((d,i)=><Cell key={i} fill={d.color}/>)}</Pie><Tooltip formatter={(v)=>fmt(v)}/></PieChart></ResponsiveContainer>
              </div>
              <div><p className="text-xs text-center text-gray-400 mb-1">실적 지출</p>
                <ResponsiveContainer width="100%" height={140}><PieChart><Pie data={actPieData} cx="50%" cy="50%" outerRadius={50} dataKey="value" label={({percent})=>`${(percent*100).toFixed(0)}%`} labelLine={false} fontSize={9}>{actPieData.map((d,i)=><Cell key={i} fill={d.color}/>)}</Pie><Tooltip formatter={(v)=>fmt(v)}/></PieChart></ResponsiveContainer>
              </div>
            </div>}
            {/* 카테고리별 표 */}
            {(() => {
              const nMonths = yearActuals.length;
              const remainMonths = 12 - nMonths;
              return (
                <div className="mt-3 space-y-1">{planCatRows.map(({cat,plan,actual})=>{
                  // 프로젝션: 실적 + 남은달 * 월계획
                  const monthlyPlan = activePlan.items.filter(i=>i.category===cat.value).reduce((s,i)=>s+i.amount,0);
                  const isIrreg = cat.value==="irregular";
                  const proj = isIrreg ? (actual>0?actual:plan) : actual + monthlyPlan*remainMonths;
                  const diff = actual>plan?"text-red-500":actual<plan&&actual>0?"text-green-600":"text-gray-700";
                  return (
                    <div key={cat.value} className="flex items-center text-xs px-2 py-1.5 rounded-lg bg-gray-50">
                      <div className="w-2 h-2 rounded-full mr-2 shrink-0" style={{background:cat.color}}/>
                      <span className="flex-1 text-gray-600">{cat.label}</span>
                      <span className="w-14 text-right text-gray-400">{fmtShort(plan)}</span>
                      <span className="w-4 text-center text-gray-300">→</span>
                      <span className={`font-bold ${diff}`}>{fmtShort(actual)}</span>
                      {nMonths>0&&nMonths<12&&<span className="text-gray-300 ml-1">({fmtShort(proj)})</span>}
                    </div>
                  );
                })}</div>
              );
            })()}
          </Card>
        );
      })()}
      <Card><SectionTitle>📌 요약</SectionTitle><div className="grid grid-cols-2 gap-2 text-sm">{[["계좌 수",data.accounts.length+"개"],["부동산",data.realEstate.length+"건"],["대출",data.loans.length+"건"],["월 총 적립금",fmtShort(data.accounts.reduce((s,a)=>s+(a.monthlyDeposit||0),0))]].map(([l,v])=><div key={l} className="flex justify-between p-2 rounded-lg bg-gray-50"><span className="text-gray-500">{l}</span><span className="font-bold text-gray-800">{v}</span></div>)}</div></Card>
    </div>
  );
};

// ─────────────────────────────────────────────
// 계좌관리
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// 무한매수법 유틸
// ─────────────────────────────────────────────
const fmtUSD = (n, dec=2) => n==null ? '-' : '$' + Number(n).toLocaleString('en-US', {minimumFractionDigits:dec, maximumFractionDigits:dec});
const mumuCalcT = (port) => {
  if (port.tManual != null) return port.tManual;
  if (!port.trades?.length) return 0;
  let T = 0, h = 0;
  port.trades.forEach(tr => {
    if (tr.type === '매수') {
      if (tr.tTag === 'T+1') T += 1; else if (tr.tTag === 'T+0.5') T += 0.5; else if (tr.tTag === 'T+0.25') T += 0.25; else T += 1;
      h += tr.qty;
    } else {
      if (tr.tTag === '퀴터매도') T = T * 0.75;
      else if (tr.tTag === 'MOC') T = T * (1 - 1/(port.splits===20?10:20));
      else if (tr.tTag === '전량매도') T = 0;
      else if (h > 0 && tr.qty > 0) T = T * (1 - Math.min(tr.qty/h, 1));
      h = Math.max(0, h - tr.qty);
    }
  });
  return Math.round(T * 1000000) / 1000000;
};
const mumuCalcH = (port) => { if (!port.trades) return 0; let s=0; port.trades.forEach(t=>{if(t.type==='매수')s+=t.qty;else s-=t.qty;}); return Math.max(0,s); };
const mumuCalcInv = (port) => { if (!port.trades) return 0; let inv=0,h=0; port.trades.forEach(t=>{if(t.type==='매수'){inv+=t.price*t.qty;h+=t.qty;}else if(h>0){inv-=(inv/h)*t.qty;h-=t.qty;}}); return Math.max(0,inv); };
const mumuCalcAvg = (port) => { const inv=mumuCalcInv(port),h=mumuCalcH(port); return h>0?inv/h:0; };
const mumuCalcRem = (port) => { if(!port.trades)return port.seed; let c=port.seed; port.trades.forEach(t=>{if(t.type==='매수')c-=t.price*t.qty*(1+port.fee/100);else c+=t.price*t.qty*(1-port.fee/100);}); return c; };
const mumuCalcUnit = (port) => { const T=mumuCalcT(port),r=mumuCalcRem(port),d=port.splits-T; return d<=0?0:r/d; };
const mumuStarPct = (ticker,splits,T) => { const s=ticker==='SOXL'; if(splits===40)return s?(20-T):(15-0.75*T); if(splits===30)return s?(20-(4/3)*T):(15-T); if(splits===20)return s?(20-2*T):(15-1.5*T); return s?(20-(40/splits)*T):(15-(30/splits)*T); };
const mumuStarPrice = (port) => { const T=mumuCalcT(port),avg=mumuCalcAvg(port); if(avg===0)return 0; return Math.round(avg*(1+mumuStarPct(port.ticker,port.splits,T)/100)*100)/100; };
const mumuPhase = (port) => { const T=mumuCalcT(port),h=port.splits/2; if(T===0)return 'init'; if(T<h)return 'first'; if(T<port.splits-1)return 'second'; return 'exhaust'; };
const mumuMode = (port) => mumuCalcT(port) > port.splits-1 ? 'reverse' : 'normal';

// ─────────────────────────────────────────────
// 무한매수법 섹션
// ─────────────────────────────────────────────
const MumuSection = ({ data, setData }) => {
  const ports = data.mumuPorts || [];
  const cycles = data.mumuCycles || [];

  // 뷰 상태: 'list'(진행중/이력) | 'detail'(포트 상세)
  const [view, setView] = useState('list');
  const [mainTab, setMainTab] = useState('active'); // active | history
  const [curId, setCurId] = useState(null);

  // 포트 모달
  const [portModal, setPortModal] = useState(false);
  const [editPort, setEditPort] = useState(null);
  const [portForm, setPortForm] = useState({ticker:'SOXL',nickname:'',seed:'15000',splits:'40',targetPct:'20',fee:'0.07'});

  // 거래 모달
  const [tradeModal, setTradeModal] = useState(false);
  const [tradeForm, setTradeForm] = useState({date:'',type:'매수',price:'',qty:'',tTag:'T+1',memo:''});

  // 문자 파싱 모달
  const [parseModal, setParseModal] = useState(false);
  const [parseText, setParseText] = useState('');
  const [parsedTrade, setParsedTrade] = useState(null);
  const [parseTag, setParseTag] = useState('T+0.5');

  // 현재가
  const [priceInput, setPriceInput] = useState('');

  // T값 수동
  const [tManualMode, setTManualMode] = useState(false);
  const [tManualInput, setTManualInput] = useState('');

  // 사이클 종료
  const [cycleModal, setCycleModal] = useState(false);

  // 이력 수동 추가
  const [histModal, setHistModal] = useState(false);
  const [histForm, setHistForm] = useState({portId:'',ticker:'',nickname:'',startDate:'',endDate:'',seed:'',splits:'40',reason:'',profitAmt:'',profitPct:''});

  // 삭제 확인
  const [confirmDel, setConfirmDel] = useState(null);
  const [confirmDelPort, setConfirmDelPort] = useState(null);

  const port = ports.find(p=>p.id===curId);
  const T = port ? mumuCalcT(port) : 0;
  const holdings = port ? mumuCalcH(port) : 0;
  const avg = port ? mumuCalcAvg(port) : 0;
  const remaining = port ? mumuCalcRem(port) : 0;
  const unitBuy = port ? mumuCalcUnit(port) : 0;
  const starPct = port ? mumuStarPct(port.ticker,port.splits,T) : 0;
  const starPrice = port ? mumuStarPrice(port) : 0;
  const starBuyPrice = Math.round((starPrice-0.01)*100)/100;
  const phase = port ? mumuPhase(port) : 'init';
  const mode = port ? mumuMode(port) : 'normal';
  const curPrice = port?.lastPrice || 0;
  const evalAmt = holdings * curPrice;
  const evalPct = avg > 0 ? (curPrice/avg-1)*100 : 0;
  const portCycles = cycles.filter(c=>c.portId===curId);
  const PHASE_LABEL = {init:'초기 매수',first:'전반전',second:'후반전',exhaust:'소진→리버스'};
  const PHASE_COLOR = {init:'#9B6FD4',first:'#4F86C6',second:'#E8A87C',exhaust:'#E85D75'};

  // 오늘의 가이드
  const getGuide = () => {
    if (!port) return {buys:[],sells:[]};
    const buys=[], sells=[];
    if (mode==='normal') {
      if (phase==='init') {
        const bp = curPrice ? Math.round(curPrice*1.125*100)/100 : 0;
        buys.push({label:'큰수 LOC (현재가 +12.5%)', price:bp, qty:bp>0?Math.max(1,Math.floor(unitBuy/bp)):0});
      } else if (phase==='first') {
        const half=unitBuy/2;
        buys.push({label:`별지점 LOC (${starPct.toFixed(1)}%)`, price:starBuyPrice, qty:starBuyPrice>0?Math.max(1,Math.floor(half/starBuyPrice)):0});
        buys.push({label:'평단 LOC', price:Math.round(avg*100)/100, qty:avg>0?Math.max(1,Math.ceil(half/avg)):0});
      } else if (phase==='second') {
        buys.push({label:`별지점 LOC (${starPct.toFixed(1)}%)`, price:starBuyPrice, qty:starBuyPrice>0?Math.max(1,Math.floor(unitBuy/starBuyPrice)):0});
      } else {
        sells.push({label:'별지점 퀴터매도', price:starPrice, qty:Math.ceil(holdings*0.25)});
      }
    } else {
      sells.push({label:'MOC 매도', price:curPrice, qty:Math.ceil(holdings*(1/(port.splits===20?10:20)))});
    }
    return {buys,sells};
  };
  const guide = getGuide();

  // 포트 저장
  const savePort = () => {
    if (!portForm.ticker.trim()) return;
    const np = {id:editPort?.id||'mu_'+genId(),version:'v4.0',currency:'USD',ticker:portForm.ticker.toUpperCase(),nickname:portForm.nickname,seed:Number(portForm.seed),splits:Number(portForm.splits),targetPct:Number(portForm.targetPct),fee:Number(portForm.fee),trades:editPort?.trades||[],cycleNo:editPort?.cycleNo||1,lastPrice:editPort?.lastPrice||0,recentPrices:editPort?.recentPrices||[],createdAt:editPort?.createdAt||new Date().toISOString().slice(0,10)};
    setData(d=>({...d,mumuPorts:editPort?d.mumuPorts.map(p=>p.id===editPort.id?np:p):[...(d.mumuPorts||[]),np]}));
    if (!editPort) { setCurId(np.id); setView('detail'); }
    setPortModal(false);
  };

  // 거래 저장
  const saveTrade = () => {
    if (!port||!tradeForm.price||!tradeForm.qty) return;
    const tr = {id:'tr'+genId(),date:tradeForm.date||new Date().toISOString().slice(0,10),type:tradeForm.type,price:Number(tradeForm.price),qty:Number(tradeForm.qty),tTag:tradeForm.tTag,memo:tradeForm.memo,amount:Math.round(Number(tradeForm.price)*Number(tradeForm.qty)*100)/100};
    setData(d=>({...d,mumuPorts:d.mumuPorts.map(p=>p.id===curId?{...p,trades:[...(p.trades||[]),tr]}:p)}));
    setTradeModal(false); setTradeForm({date:'',type:'매수',price:'',qty:'',tTag:'T+1',memo:''});
  };

  // 문자 파싱
  const parseMsgText = (text) => {
    const lines = text.split('\n').map(l=>l.trim());
    const get = (key) => { const l = lines.find(l=>l.startsWith(key)); return l ? l.split(':').slice(1).join(':').trim() : ''; };
    const typeStr = get('매매구분');
    const priceStr = get('체결단가').replace(/USD\s*/i,'').trim();
    const qtyStr = get('체결수량').replace('주','').trim();
    const dateStr = get('체결일자'); // MM/DD
    const ticker = get('종목명');
    if (!priceStr || !qtyStr) return null;
    const type = typeStr.includes('매수') ? '매수' : '매도';
    let date = new Date().toISOString().slice(0,10);
    if (dateStr) {
      const [m,d] = dateStr.split('/');
      date = `${new Date().getFullYear()}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
    }
    return { type, price:Number(priceStr), qty:Number(qtyStr), date, ticker };
  };

  const handleParse = () => {
    const result = parseMsgText(parseText);
    if (!result) { alert('파싱 실패. 문자 형식을 확인해주세요.'); return; }
    setParsedTrade(result);
  };

  const saveParsedTrade = () => {
    if (!port || !parsedTrade) return;
    const tr = {id:'tr'+genId(),date:parsedTrade.date,type:parsedTrade.type,price:parsedTrade.price,qty:parsedTrade.qty,tTag:parseTag,memo:'',amount:Math.round(parsedTrade.price*parsedTrade.qty*100)/100};
    setData(d=>({...d,mumuPorts:d.mumuPorts.map(p=>p.id===curId?{...p,trades:[...(p.trades||[]),tr]}:p)}));
    setParseModal(false); setParseText(''); setParsedTrade(null);
  };

  // 현재가 업데이트
  const updatePrice = () => {
    if (!port||!priceInput) return;
    const price=Number(priceInput);
    setData(d=>({...d,mumuPorts:d.mumuPorts.map(p=>p.id===curId?{...p,lastPrice:price,recentPrices:[...(p.recentPrices||[]).slice(-4),price]}:p)}));
    setPriceInput('');
  };

  // T값 수동
  const setTManual = () => {
    const val = tManualInput===''?null:Number(tManualInput);
    setData(d=>({...d,mumuPorts:d.mumuPorts.map(p=>p.id===curId?{...p,tManual:val}:p)}));
    setTManualMode(false); setTManualInput('');
  };

  // 사이클 종료
  const endCycle = () => {
    if (!port) return;
    const allT=port.trades||[]; let totalBuy=0,costBasis=0,hTrack=0;
    allT.forEach(t=>{if(t.type==='매수'){totalBuy+=t.price*t.qty;costBasis+=t.price*t.qty;hTrack+=t.qty;}else if(hTrack>0){const ac=costBasis/hTrack;costBasis-=ac*t.qty;hTrack=Math.max(0,hTrack-t.qty);}});
    const sellTotal=allT.filter(t=>t.type==='매도').reduce((s,t)=>s+t.price*t.qty,0);
    const soldCost=totalBuy-costBasis;
    const profitAmt=Math.round((sellTotal-soldCost)*100)/100;
    const profitPct=Math.round((soldCost>0?profitAmt/soldCost*100:0)*100)/100;
    const newCy={id:'cy'+genId(),portId:curId,cycleNo:portCycles.length+1,ticker:port.ticker,nickname:port.nickname,seed:port.seed,splits:port.splits,targetPct:port.targetPct,startDate:allT[0]?.date||port.createdAt,endDate:new Date().toISOString().slice(0,10),reason:'수동종료',trades:[...allT],finalT:T,finalAvg:avg,finalHoldings:holdings,buyTotal:totalBuy,sellTotal,profitAmt,profitPct,remaining};
    setData(d=>({...d,mumuCycles:[...(d.mumuCycles||[]),newCy],mumuPorts:d.mumuPorts.map(p=>p.id===curId?{...p,trades:[],tManual:undefined,lastPrice:0,cycleNo:(p.cycleNo||1)+1}:p)}));
    setCycleModal(false);
  };

  // 거래 삭제
  const deleteTrade = (trId) => { setData(d=>({...d,mumuPorts:d.mumuPorts.map(p=>p.id===curId?{...p,trades:p.trades.filter(t=>t.id!==trId)}:p)})); setConfirmDel(null); };

  // 포트 삭제
  const deletePort = (portId) => {
    setData(d=>({...d,mumuPorts:d.mumuPorts.filter(p=>p.id!==portId),mumuCycles:d.mumuCycles.filter(c=>c.portId!==portId)}));
    setConfirmDelPort(null); setView('list'); setCurId(null);
  };

  // 이력 수동 추가
  const saveHist = () => {
    const cy = {id:'cy'+genId(),portId:histForm.portId||'manual',cycleNo:cycles.length+1,ticker:histForm.ticker,nickname:histForm.nickname,seed:Number(histForm.seed)||0,splits:Number(histForm.splits)||40,startDate:histForm.startDate,endDate:histForm.endDate,reason:histForm.reason||'수동입력',trades:[],finalT:0,finalAvg:0,finalHoldings:0,buyTotal:0,sellTotal:0,profitAmt:Number(histForm.profitAmt)||0,profitPct:Number(histForm.profitPct)||0,remaining:0};
    setData(d=>({...d,mumuCycles:[...(d.mumuCycles||[]),cy]}));
    setHistModal(false); setHistForm({portId:'',ticker:'',nickname:'',startDate:'',endDate:'',seed:'',splits:'40',reason:'',profitAmt:'',profitPct:''});
  };

  // 누적 실현 손익
  const totalProfit = cycles.reduce((s,c)=>s+(c.profitAmt||0),0);

  return (
    <div className="space-y-4">
      {view==='list' && <>
        {/* 상단 탭 */}
        <div className="flex border-b border-gray-200">
          {[['active',`진행중 (${ports.length})`],['history',`이력 (${cycles.length})`]].map(([k,l])=>(
            <button key={k} onClick={()=>setMainTab(k)} className={`flex-1 py-2.5 text-sm font-bold transition-all border-b-2 ${mainTab===k?"border-[#1a2744] text-[#1a2744]":"border-transparent text-gray-400"}`}>{l}</button>
          ))}
        </div>

        {/* 진행중 탭 */}
        {mainTab==='active' && <div className="space-y-3">
          <div className="flex justify-end"><Btn size="sm" onClick={()=>{setEditPort(null);setPortForm({ticker:'SOXL',nickname:'',seed:'15000',splits:'40',targetPct:'20',fee:'0.07'});setPortModal(true);}}>+ 추가</Btn></div>
          {ports.length===0 && <Card><div className="text-center py-10 text-gray-400"><p className="text-4xl mb-3">📈</p><p className="text-sm">진행중인 포트폴리오가 없습니다</p></div></Card>}
          {ports.map(p=>{
            const pT=mumuCalcT(p), pH=mumuCalcH(p), pAvg=mumuCalcAvg(p), pRem=mumuCalcRem(p);
            const pPhase=mumuPhase(p), pMode=mumuMode(p);
            const pStar=mumuStarPct(p.ticker,p.splits,pT);
            const pStarPrice=mumuStarPrice(p);
            return (
              <div key={p.id} className="bg-white rounded-2xl shadow-sm p-4 cursor-pointer hover:shadow-md transition-all active:scale-[0.99]" onClick={()=>{setCurId(p.id);setView('detail');}}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-extrabold text-[#1a2744]">{p.ticker}</span>
                    {p.nickname&&<span className="text-sm text-gray-500">{p.nickname}</span>}
                    <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{background:PHASE_COLOR[pPhase]+'22',color:PHASE_COLOR[pPhase]}}>{pMode==='reverse'?'🔄 리버스':PHASE_LABEL[pPhase]}</span>
                  </div>
                  <span className="text-xs text-gray-400">T={pT.toFixed(2)} · 사이클 {p.cycleNo||1}</span>
                </div>
                <div className="grid grid-cols-4 gap-2 text-xs text-center">
                  <div className="bg-gray-50 rounded-lg p-2"><p className="text-gray-400">평단</p><p className="font-bold text-gray-700">{pH>0?fmtUSD(pAvg):'-'}</p></div>
                  <div className="bg-gray-50 rounded-lg p-2"><p className="text-gray-400">보유</p><p className="font-bold text-gray-700">{pH}주</p></div>
                  <div className="bg-blue-50 rounded-lg p-2"><p className="text-gray-400">★%</p><p className="font-bold text-blue-600">{pStar.toFixed(1)}%</p></div>
                  <div className="bg-amber-50 rounded-lg p-2"><p className="text-gray-400">★가격</p><p className="font-bold text-amber-600">{pAvg>0?fmtUSD(pStarPrice):'-'}</p></div>
                </div>
              </div>
            );
          })}
        </div>}

        {/* 이력 탭 */}
        {mainTab==='history' && <div className="space-y-3">
          <div className="flex items-center justify-between">
            {totalProfit!==0&&<div className="p-3 rounded-xl bg-green-50 flex-1 mr-3"><p className="text-xs text-gray-400">누적 실현 손익</p><p className={`text-lg font-extrabold ${totalProfit>=0?"text-green-600":"text-red-500"}`}>{totalProfit>=0?'+':''}{fmtUSD(totalProfit)}</p><p className="text-xs text-gray-400">{cycles.length}사이클 완료 · 승률 {cycles.length>0?Math.round(cycles.filter(c=>c.profitAmt>=0).length/cycles.length*100):0}%</p></div>}
            <Btn size="sm" onClick={()=>setHistModal(true)}>+ 이력 추가</Btn>
          </div>
          {cycles.length===0&&<Card><p className="text-sm text-gray-400 text-center py-6">완료된 사이클이 없습니다</p></Card>}
          {/* 포트별 그룹 */}
          {(() => {
            const grouped = {};
            cycles.forEach(cy => {
              const key = cy.portId+'_'+cy.ticker+'_'+(cy.nickname||'');
              if (!grouped[key]) grouped[key] = {ticker:cy.ticker,nickname:cy.nickname,cycles:[]};
              grouped[key].cycles.push(cy);
            });
            return Object.values(grouped).map((g,gi)=>(
              <div key={gi}>
                <p className="text-xs font-bold text-gray-500 mb-2">{g.ticker} {g.nickname&&`· ${g.nickname}`}</p>
                {[...g.cycles].reverse().map(cy=>(
                  <Card key={cy.id} className="mb-2">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="text-sm font-bold text-gray-800">사이클 {cy.cycleNo}</span>
                        <span className="text-xs text-gray-400 ml-2">{cy.startDate} ~ {cy.endDate}</span>
                        <span className={`text-xs ml-2 px-1.5 py-0.5 rounded-full ${cy.reason==='수동입력'?'bg-gray-100 text-gray-500':'bg-blue-50 text-blue-500'}`}>{cy.reason}</span>
                      </div>
                      <span className={`text-sm font-extrabold ${cy.profitAmt>=0?"text-green-600":"text-red-500"}`}>{cy.profitAmt>=0?'+':''}{fmtUSD(cy.profitAmt)} <span className="text-xs">({cy.profitPct>=0?'+':''}{cy.profitPct.toFixed(2)}%)</span></span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      {[['시드',fmtUSD(cy.seed,0)],['분할',cy.splits+'분할'],['거래',cy.trades?.length+'건']].map(([l,v])=>(
                        <div key={l} className="bg-gray-50 rounded-lg p-1.5 text-center"><p className="text-gray-400">{l}</p><p className="font-bold text-gray-600">{v}</p></div>
                      ))}
                    </div>
                  </Card>
                ))}
              </div>
            ));
          })()}
        </div>}
      </>}

      {/* ── 포트 상세 뷰 ── */}
      {view==='detail' && port && <div className="space-y-4">
        {/* 헤더 */}
        <div className="flex items-center gap-3">
          <button onClick={()=>setView('list')} className="text-gray-400 hover:text-gray-700 text-lg">←</button>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-lg font-extrabold text-[#1a2744]">{port.ticker}</span>
              {port.nickname&&<span className="text-sm text-gray-500">{port.nickname}</span>}
              <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{background:PHASE_COLOR[phase]+'22',color:PHASE_COLOR[phase]}}>{mode==='reverse'?'🔄 리버스':PHASE_LABEL[phase]}</span>
              <span className="text-xs text-gray-400">사이클 {port.cycleNo||1}회차</span>
            </div>
          </div>
          <div className="flex gap-1">
            <Btn size="sm" variant="ghost" onClick={()=>{setEditPort(port);setPortForm({ticker:port.ticker,nickname:port.nickname||'',seed:String(port.seed),splits:String(port.splits),targetPct:String(port.targetPct),fee:String(port.fee)});setPortModal(true);}}>수정</Btn>
            <Btn size="sm" variant="danger" onClick={()=>setConfirmDelPort(port.id)}>삭제</Btn>
          </div>
        </div>

        {/* 현재가 입력 */}
        <Card className="!p-3">
          <div className="flex items-center gap-2">
            <input type="number" value={priceInput} onChange={e=>setPriceInput(e.target.value)} placeholder={`현재가 (${fmtUSD(curPrice)})`} className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a2744]/30"/>
            <Btn size="sm" onClick={updatePrice} disabled={!priceInput}>업데이트</Btn>
          </div>
        </Card>

        {/* 진행 상황 */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <SectionTitle>진행 상황</SectionTitle>
            {curPrice>0&&holdings>0&&<span className={`text-sm font-bold ${evalPct>=0?"text-green-600":"text-red-500"}`}>{evalPct>=0?'+':''}{evalPct.toFixed(2)}%</span>}
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[['시드',fmtUSD(port.seed,0)],['매입금액',fmtUSD(mumuCalcInv(port),0)],['평단가',holdings>0?fmtUSD(avg):'-'],['보유수량',holdings+'주'],['잔금',fmtUSD(remaining,0)],['현재수익률',curPrice>0&&holdings>0?`${evalPct>=0?'+':''}${evalPct.toFixed(2)}%`:'-']].map(([l,v])=>(
              <div key={l} className="flex justify-between border-b border-gray-50 pb-2"><span className="text-gray-400">{l}</span><span className="font-bold text-gray-800">{v}</span></div>
            ))}
          </div>
          {/* T값 & 별지점 */}
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div className="p-3 rounded-xl text-center" style={{background:PHASE_COLOR[phase]+'15'}}>
              <p className="text-xs text-gray-400 mb-1">T값 (진행 회차)</p>
              <p className="text-2xl font-extrabold" style={{color:PHASE_COLOR[phase]}}>{T.toFixed(2)}</p>
              <p className="text-xs text-gray-400 mt-1">1회 매수금: {fmtUSD(unitBuy,0)}</p>
            </div>
            <div className="p-3 rounded-xl bg-blue-50 text-center">
              <p className="text-xs text-gray-400 mb-1">★ 별% / 별지점</p>
              <p className="text-xl font-extrabold text-blue-600">{starPct.toFixed(2)}%</p>
              <p className="text-sm font-bold text-blue-500">{avg>0?fmtUSD(starPrice):'-'}</p>
            </div>
          </div>
          {/* T값 수동 */}
          <div className="mt-3 pt-2 border-t border-gray-100">
            {!tManualMode
              ?<button onClick={()=>{setTManualMode(true);setTManualInput(port.tManual!=null?String(port.tManual):'');}} className="text-xs text-gray-400 hover:text-gray-600">T값 수동 설정 {port.tManual!=null&&<span className="text-blue-500 ml-1">(현재: {port.tManual})</span>}</button>
              :<div className="flex items-center gap-2"><span className="text-xs text-gray-500">T값:</span><input type="number" value={tManualInput} onChange={e=>setTManualInput(e.target.value)} className="w-20 border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none" placeholder="자동"/><Btn size="sm" onClick={setTManual}>적용</Btn><button onClick={()=>{setTManualInput('');setTManual();}} className="text-xs text-red-400">초기화</button><button onClick={()=>setTManualMode(false)} className="text-xs text-gray-400">취소</button></div>
            }
          </div>
        </Card>

        {/* 오늘의 주문 가이드 */}
        <Card>
          <SectionTitle>🎯 오늘의 주문 가이드</SectionTitle>
          {guide.buys.length>0&&<div className="mb-3">
            <p className="text-xs font-bold text-blue-500 mb-2">● 매수 가이드 (LOC)</p>
            <div className="space-y-2">{guide.buys.map((g,i)=>(
              <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-blue-50">
                <span className="text-sm text-blue-700">{g.label}</span>
                <div className="text-right"><span className="text-base font-extrabold text-blue-800">{fmtUSD(g.price)}</span><span className="text-xs text-blue-500 ml-2">×{g.qty}주</span></div>
              </div>
            ))}</div>
          </div>}
          {guide.sells.length>0&&<div>
            <p className="text-xs font-bold text-red-500 mb-2">● 매도 가이드</p>
            <div className="space-y-2">{guide.sells.map((g,i)=>(
              <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-red-50">
                <span className="text-sm text-red-700">{g.label}</span>
                <div className="text-right"><span className="text-base font-extrabold text-red-800">{fmtUSD(g.price)}</span><span className="text-xs text-red-500 ml-2">×{g.qty}주</span></div>
              </div>
            ))}</div>
          </div>}
        </Card>

        {/* 거래 내역 */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <SectionTitle>거래 내역 ({(port.trades||[]).length}건)</SectionTitle>
            <div className="flex gap-1">
              <Btn size="sm" variant="secondary" onClick={()=>{setParseText('');setParsedTrade(null);setParseModal(true);}}>📱 문자</Btn>
              <Btn size="sm" onClick={()=>{setTradeForm({date:new Date().toISOString().slice(0,10),type:'매수',price:'',qty:'',tTag:'T+1',memo:''});setTradeModal(true);}}>+ 입력</Btn>
            </div>
          </div>
          {!(port.trades||[]).length&&<p className="text-sm text-gray-400 text-center py-4">거래 내역 없음</p>}
          <div className="space-y-2">{[...(port.trades||[])].reverse().map(tr=>(
            <div key={tr.id} className={`flex items-center justify-between p-3 rounded-xl ${tr.type==='매수'?"bg-blue-50":"bg-red-50"}`}>
              <div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${tr.type==='매수'?"bg-blue-200 text-blue-800":"bg-red-200 text-red-800"}`}>{tr.type}</span>
                  <span className="text-xs text-gray-500">{tr.tTag}</span>
                  <span className="text-xs text-gray-400">{tr.date}</span>
                </div>
                {tr.memo&&<p className="text-xs text-gray-400 mt-0.5">{tr.memo}</p>}
              </div>
              <div className="flex items-center gap-2">
                <div className="text-right"><p className="text-sm font-bold">{fmtUSD(tr.price)} × {tr.qty}주</p><p className="text-xs text-gray-400">{fmtUSD(tr.price*tr.qty,0)}</p></div>
                <Btn size="sm" variant="danger" onClick={()=>setConfirmDel(tr.id)}>삭제</Btn>
              </div>
            </div>
          ))}</div>
        </Card>

        {/* 설정 & 목표치 */}
        <Card>
          <SectionTitle>설정 & 목표치</SectionTitle>
          <div className="space-y-2 text-sm">
            {[['분할',port.splits+'일'],['1회 투자금',fmtUSD(port.seed/port.splits,0)],['목표 수익률',`+${port.targetPct}%`],['수수료율',port.fee+'%'],['리버스 발동',`T > ${port.splits-1}`],['현재 사이클',`${port.cycleNo||1}회차`]].map(([l,v])=>(
              <div key={l} className="flex justify-between border-b border-gray-50 pb-2"><span className="text-gray-400">{l}</span><span className="font-bold text-gray-700">{v}</span></div>
            ))}
          </div>
          <div className="flex gap-2 mt-4">
            <Btn className="flex-1" variant="secondary" onClick={()=>setCycleModal(true)}>↻ 사이클 종료 & 새 시작</Btn>
          </div>
        </Card>
      </div>}

      {/* ── 모달들 ── */}
      <Modal open={portModal} onClose={()=>setPortModal(false)} title={editPort?"포트 수정":"포트 추가"}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3"><Inp label="티커" value={portForm.ticker} onChange={v=>setPortForm(f=>({...f,ticker:v.toUpperCase()}))} required/><Inp label="닉네임" value={portForm.nickname} onChange={v=>setPortForm(f=>({...f,nickname:v}))} placeholder="메리츠1"/></div>
          <div className="grid grid-cols-2 gap-3"><Inp label="시드 ($)" type="number" value={portForm.seed} onChange={v=>setPortForm(f=>({...f,seed:v}))}/><Sel label="분할수" value={portForm.splits} onChange={v=>setPortForm(f=>({...f,splits:v}))} options={[{value:'20',label:'20분할'},{value:'30',label:'30분할'},{value:'40',label:'40분할'}]}/></div>
          <div className="grid grid-cols-2 gap-3"><Inp label="목표수익률 (%)" type="number" value={portForm.targetPct} onChange={v=>setPortForm(f=>({...f,targetPct:v}))}/><Inp label="수수료 (%)" type="number" value={portForm.fee} onChange={v=>setPortForm(f=>({...f,fee:v}))}/></div>
          <div className="flex gap-2 justify-end pt-2"><Btn variant="secondary" onClick={()=>setPortModal(false)}>취소</Btn><Btn onClick={savePort}>저장</Btn></div>
        </div>
      </Modal>

      <Modal open={tradeModal} onClose={()=>setTradeModal(false)} title="거래 입력">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Sel label="구분" value={tradeForm.type} onChange={v=>setTradeForm(f=>({...f,type:v,tTag:v==='매수'?'T+1':'퀴터매도'}))} options={[{value:'매수',label:'매수'},{value:'매도',label:'매도'}]}/>
            <Sel label="T 태그" value={tradeForm.tTag} onChange={v=>setTradeForm(f=>({...f,tTag:v}))} options={tradeForm.type==='매수'?[{value:'T+1',label:'T+1 (1회 전체)'},{value:'T+0.5',label:'T+0.5 (절반)'},{value:'T+0.25',label:'T+0.25'}]:[{value:'퀴터매도',label:'퀴터매도 (T×0.75)'},{value:'지정가매도',label:'지정가 (비율만큼 T감소)'},{value:'MOC',label:'MOC'},{value:'전량매도',label:'전량매도 (T→0)'}]}/>
          </div>
          <Inp label="날짜" type="date" value={tradeForm.date} onChange={v=>setTradeForm(f=>({...f,date:v}))}/>
          <div className="grid grid-cols-2 gap-3">
            <Inp label="체결가 (USD)" type="number" value={tradeForm.price} onChange={v=>setTradeForm(f=>({...f,price:v}))} required/>
            <Inp label="수량 (주)" type="number" value={tradeForm.qty} onChange={v=>setTradeForm(f=>({...f,qty:v}))} required/>
          </div>
          <Inp label="메모" value={tradeForm.memo} onChange={v=>setTradeForm(f=>({...f,memo:v}))}/>
          {tradeForm.price&&tradeForm.qty&&<div className="p-2 rounded-lg bg-gray-50 text-xs text-center">거래금액: <span className="font-bold">{fmtUSD(Number(tradeForm.price)*Number(tradeForm.qty),0)}</span></div>}
          <div className="flex gap-2 justify-end"><Btn variant="secondary" onClick={()=>setTradeModal(false)}>취소</Btn><Btn onClick={saveTrade}>저장</Btn></div>
        </div>
      </Modal>

      <Modal open={parseModal} onClose={()=>{setParseModal(false);setParseText('');setParsedTrade(null);}} title="체결 문자 입력">
        <div className="space-y-3">
          <p className="text-xs text-gray-400">카카오톡 체결 알림 복사 후 붙여넣기 · 해외주식 USD만 적용</p>
          <textarea value={parseText} onChange={e=>setParseText(e.target.value)} placeholder={"[메리츠증권] 해외주식 주문체결 안내\n계좌명 : ...\n체결단가 : USD ...\n체결수량 : N주"} className="w-full h-36 border border-gray-200 rounded-xl p-3 text-sm focus:outline-none resize-none" />
          <Sel label="T 태그" value={parseTag} onChange={v=>setParseTag(v)} options={[{value:'T+1',label:'T+1 (1회 전체)'},{value:'T+0.5',label:'T+0.5 (절반)'},{value:'T+0.25',label:'T+0.25'},{value:'퀴터매도',label:'퀴터매도'},{value:'지정가매도',label:'지정가매도'},{value:'MOC',label:'MOC'},{value:'전량매도',label:'전량매도'}]}/>
          {!parsedTrade
            ?<Btn className="w-full" onClick={handleParse} disabled={!parseText.trim()}>파싱 →</Btn>
            :<div className="space-y-3">
              <div className="p-3 rounded-xl bg-gray-50 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-gray-400">종목</span><span className="font-bold">{parsedTrade.ticker}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">구분</span><span className={`font-bold ${parsedTrade.type==='매수'?"text-blue-600":"text-red-500"}`}>{parsedTrade.type}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">가격</span><span className="font-bold">{fmtUSD(parsedTrade.price)}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">수량</span><span className="font-bold">{parsedTrade.qty}주</span></div>
                <div className="flex justify-between"><span className="text-gray-400">날짜</span><span className="font-bold">{parsedTrade.date}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">T태그</span><span className="font-bold text-blue-600">{parseTag}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">거래금액</span><span className="font-bold">{fmtUSD(parsedTrade.price*parsedTrade.qty,0)}</span></div>
              </div>
              <div className="flex gap-2"><Btn variant="secondary" onClick={()=>setParsedTrade(null)} className="flex-1">다시 파싱</Btn><Btn onClick={saveParsedTrade} className="flex-1">저장</Btn></div>
            </div>
          }
        </div>
      </Modal>

      <Modal open={cycleModal} onClose={()=>setCycleModal(false)} title="사이클 종료 & 새 시작">
        <div className="space-y-3">
          <p className="text-sm text-gray-600">사이클을 종료하면 거래 내역이 이력으로 저장되고 새 사이클이 시작됩니다.</p>
          <div className="p-3 rounded-xl bg-gray-50 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-gray-500">최종 T값</span><span className="font-bold">{T.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">보유</span><span className="font-bold">{holdings}주 (평단 {holdings>0?fmtUSD(avg):'-'})</span></div>
            <div className="flex justify-between"><span className="text-gray-500">잔금</span><span className="font-bold">{fmtUSD(remaining,0)}</span></div>
          </div>
          <div className="flex gap-2 justify-end"><Btn variant="secondary" onClick={()=>setCycleModal(false)}>취소</Btn><Btn variant="danger" onClick={endCycle}>사이클 종료</Btn></div>
        </div>
      </Modal>

      <Modal open={histModal} onClose={()=>setHistModal(false)} title="이력 수동 추가">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Inp label="티커" value={histForm.ticker} onChange={v=>setHistForm(f=>({...f,ticker:v.toUpperCase()}))} placeholder="SOXL" required/>
            <Inp label="닉네임" value={histForm.nickname} onChange={v=>setHistForm(f=>({...f,nickname:v}))} placeholder="메리츠1"/>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Inp label="시작일" type="date" value={histForm.startDate} onChange={v=>setHistForm(f=>({...f,startDate:v}))}/>
            <Inp label="종료일" type="date" value={histForm.endDate} onChange={v=>setHistForm(f=>({...f,endDate:v}))}/>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Inp label="시드 ($)" type="number" value={histForm.seed} onChange={v=>setHistForm(f=>({...f,seed:v}))}/>
            <Sel label="분할수" value={histForm.splits} onChange={v=>setHistForm(f=>({...f,splits:v}))} options={[{value:'20',label:'20분할'},{value:'30',label:'30분할'},{value:'40',label:'40분할'}]}/>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Inp label="수익금 ($)" type="number" value={histForm.profitAmt} onChange={v=>setHistForm(f=>({...f,profitAmt:v}))}/>
            <Inp label="수익률 (%)" type="number" value={histForm.profitPct} onChange={v=>setHistForm(f=>({...f,profitPct:v}))}/>
          </div>
          <Inp label="종료 사유" value={histForm.reason} onChange={v=>setHistForm(f=>({...f,reason:v}))} placeholder="수익 실현 / 손절 등"/>
          <div className="flex gap-2 justify-end"><Btn variant="secondary" onClick={()=>setHistModal(false)}>취소</Btn><Btn onClick={saveHist}>저장</Btn></div>
        </div>
      </Modal>

      <Confirm open={!!confirmDel} message="이 거래를 삭제하시겠습니까?" onConfirm={()=>deleteTrade(confirmDel)} onCancel={()=>setConfirmDel(null)}/>
      <Confirm open={!!confirmDelPort} message="이 포트와 관련 사이클 이력을 모두 삭제하시겠습니까?" onConfirm={()=>deletePort(confirmDelPort)} onCancel={()=>setConfirmDelPort(null)}/>
    </div>
  );
};


const AccountBookSection = ({ data, setData }) => {
  const [activeTab, setActiveTab] = useState(data.members[0]?.id||"");
  const [subTab, setSubTab] = useState("accounts");
  const [modal, setModal] = useState(false); const [editE, setEditE] = useState(null); const [form, setForm] = useState({ memberId:"", bank:"", accountNumber:"", description:"", category:"cash", note:"" }); const [cd, setCd] = useState(null);
  const [cardModal, setCardModal] = useState(false); const [editC, setEditC] = useState(null); const [cForm, setCForm] = useState({ memberId:"", cardName:"", description:"", autoDebitAmount:"", note:"" }); const [cdc, setCdc] = useState(null);
  const entries=(data.accountBook||[]).filter((e)=>e.memberId===activeTab&&!e.isCard);
  const cards=(data.accountBook||[]).filter((e)=>e.memberId===activeTab&&e.isCard);
  const getCatL=(v)=>ACCOUNT_CATEGORIES.find((c)=>c.value===v)?.label||v;
  const getCatC=(v)=>ACCOUNT_CATEGORIES.find((c)=>c.value===v)?.color||"#aaa";
  const oa=()=>{setEditE(null);setForm({memberId:activeTab,bank:"",accountNumber:"",description:"",category:"cash",note:""});setModal(true);};
  const sv=()=>{if(!form.bank.trim())return; const e={id:editE?.id||genId(),...form,isCard:false}; setData((d)=>({...d,accountBook:editE?(d.accountBook||[]).map((x)=>x.id===editE.id?e:x):[...(d.accountBook||[]),e]})); setModal(false);};
  const oc=()=>{setEditC(null);setCForm({memberId:activeTab,cardName:"",description:"",autoDebitAmount:"",note:""});setCardModal(true);};
  const sc=()=>{if(!cForm.cardName.trim())return; const e={id:editC?.id||genId(),...cForm,isCard:true,autoDebitAmount:Number(cForm.autoDebitAmount)||0}; setData((d)=>({...d,accountBook:editC?(d.accountBook||[]).map((x)=>x.id===editC.id?e:x):[...(d.accountBook||[]),e]})); setCardModal(false);};
  const totAD=cards.reduce((s,c)=>s+(c.autoDebitAmount||0),0);
  return (
    <div className="space-y-4">
      <div className="flex gap-1 flex-wrap">{data.members.map((m)=><button key={m.id} onClick={()=>setActiveTab(m.id)} className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeTab===m.id?"text-white shadow-sm":"bg-gray-100 text-gray-600 hover:bg-gray-200"}`} style={activeTab===m.id?{background:m.color}:{}}>{m.name}</button>)}</div>
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">{[["accounts","계좌 목록"],["cards","카드/자동이체"]].map(([k,l])=><button key={k} onClick={()=>setSubTab(k)} className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${subTab===k?"bg-white text-[#1a2744] shadow-sm":"text-gray-500"}`}>{l}</button>)}</div>
      {subTab==="accounts"&&<Card>
        <div className="flex items-center justify-between mb-4"><SectionTitle>📒 {data.members.find((m)=>m.id===activeTab)?.name} 계좌 목록</SectionTitle><Btn size="sm" onClick={oa}>+ 추가</Btn></div>
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-xs text-gray-400 border-b border-gray-100">{["No.","은행/증권사","계좌번호","설명","카테고리","비고",""].map((h)=><th key={h} className="text-left py-2 pr-2 font-semibold whitespace-nowrap">{h}</th>)}</tr></thead>
        <tbody>{entries.map((e,i)=><tr key={e.id} className="border-b border-gray-50 hover:bg-gray-50"><td className="py-2 pr-2 text-gray-400 text-xs">{i+1}</td><td className="py-2 pr-2 font-semibold text-gray-800 whitespace-nowrap">{e.bank}</td><td className="py-2 pr-2 text-gray-500 font-mono text-xs whitespace-nowrap">{e.accountNumber||"-"}</td><td className="py-2 pr-2 text-gray-600 text-xs">{e.description||"-"}</td><td className="py-2 pr-2"><Badge color={getCatC(e.category)} label={getCatL(e.category)}/></td><td className="py-2 pr-2 text-gray-400 text-xs">{e.note||"-"}</td><td className="py-2"><div className="flex gap-1"><Btn size="sm" variant="ghost" onClick={()=>{setEditE(e);setForm({...e});setModal(true);}}>수정</Btn><Btn size="sm" variant="danger" onClick={()=>setCd(e.id)}>삭제</Btn></div></td></tr>)}
        {!entries.length&&<tr><td colSpan={7} className="text-center py-8 text-gray-400 text-sm">등록된 계좌가 없습니다</td></tr>}</tbody></table></div>
      </Card>}
      {subTab==="cards"&&<Card>
        <div className="flex items-center justify-between mb-4"><SectionTitle>💳 {data.members.find((m)=>m.id===activeTab)?.name} 카드/자동이체</SectionTitle><Btn size="sm" onClick={oc}>+ 추가</Btn></div>
        <div className="space-y-2">{cards.map((c)=><div key={c.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50"><div className="flex-1"><div className="flex items-center gap-2"><span className="text-sm font-semibold text-gray-800">{c.cardName}</span>{c.description&&<span className="text-xs text-gray-500">{c.description}</span>}</div>{c.note&&<p className="text-xs text-gray-400">{c.note}</p>}</div><div className="flex items-center gap-2 ml-2 shrink-0">{c.autoDebitAmount>0&&<span className="text-sm font-bold text-gray-700">{fmt(c.autoDebitAmount)}</span>}<Btn size="sm" variant="ghost" onClick={()=>{setEditC(c);setCForm({...c});setCardModal(true);}}>수정</Btn><Btn size="sm" variant="danger" onClick={()=>setCdc(c.id)}>삭제</Btn></div></div>)}{!cards.length&&<p className="text-sm text-gray-400 text-center py-6">등록된 카드가 없습니다</p>}</div>
        {totAD>0&&<div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-100 flex justify-between"><span className="text-xs font-semibold text-amber-700">💳 월 자동이체 합계</span><span className="text-sm font-bold text-amber-700">{fmt(totAD)}</span></div>}
      </Card>}
      <Modal open={modal} onClose={()=>setModal(false)} title={editE?"계좌 수정":"계좌 추가"}><div className="space-y-3"><Sel label="소유자" value={form.memberId} onChange={(v)=>setForm((f)=>({...f,memberId:v}))} options={data.members.map((m)=>({value:m.id,label:m.name}))}/><Inp label="은행/증권사" value={form.bank} onChange={(v)=>setForm((f)=>({...f,bank:v}))} required/><Inp label="계좌번호" value={form.accountNumber} onChange={(v)=>setForm((f)=>({...f,accountNumber:v}))}/><Inp label="설명" value={form.description} onChange={(v)=>setForm((f)=>({...f,description:v}))}/><Sel label="카테고리" value={form.category} onChange={(v)=>setForm((f)=>({...f,category:v}))} options={ACCOUNT_CATEGORIES}/><Inp label="비고" value={form.note} onChange={(v)=>setForm((f)=>({...f,note:v}))}/><div className="flex gap-2 justify-end"><Btn variant="secondary" onClick={()=>setModal(false)}>취소</Btn><Btn onClick={sv}>저장</Btn></div></div></Modal>
      <Modal open={cardModal} onClose={()=>setCardModal(false)} title={editC?"카드 수정":"카드 추가"}><div className="space-y-3"><Sel label="소유자" value={cForm.memberId} onChange={(v)=>setCForm((f)=>({...f,memberId:v}))} options={data.members.map((m)=>({value:m.id,label:m.name}))}/><Inp label="카드명" value={cForm.cardName} onChange={(v)=>setCForm((f)=>({...f,cardName:v}))} required/><Inp label="설명" value={cForm.description} onChange={(v)=>setCForm((f)=>({...f,description:v}))}/><Inp label="월 자동이체 금액" type="number" value={cForm.autoDebitAmount} onChange={(v)=>setCForm((f)=>({...f,autoDebitAmount:v}))}/><Inp label="비고" value={cForm.note} onChange={(v)=>setCForm((f)=>({...f,note:v}))}/><div className="flex gap-2 justify-end"><Btn variant="secondary" onClick={()=>setCardModal(false)}>취소</Btn><Btn onClick={sc}>저장</Btn></div></div></Modal>
      <Confirm open={!!cd} message="삭제하시겠습니까?" onConfirm={()=>{setData((d)=>({...d,accountBook:(d.accountBook||[]).filter((e)=>e.id!==cd)}));setCd(null);}} onCancel={()=>setCd(null)}/>
      <Confirm open={!!cdc} message="삭제하시겠습니까?" onConfirm={()=>{setData((d)=>({...d,accountBook:(d.accountBook||[]).filter((e)=>e.id!==cdc)}));setCdc(null);}} onCancel={()=>setCdc(null)}/>
    </div>
  );
};

// ─────────────────────────────────────────────
// 메인 앱
// ─────────────────────────────────────────────
const NAV_ITEMS = [
  { key:"dashboard", label:"대시보드", icon:"📊" },
  { key:"assets", label:"자산현황", icon:"🏦" },
  { key:"income", label:"수입/지출", icon:"💰" },
  { key:"balance", label:"재무상태표", icon:"📋" },
  { key:"mumu", label:"무한매수", icon:"📈" },
  { key:"accountbook", label:"계좌관리", icon:"📒" },
  { key:"settings", label:"설정", icon:"⚙️" },
];

export default function App() {
  const [data, setDataRaw] = useState(loadData);
  const [activeNav, setActiveNav] = useState("dashboard");
  const [syncStatus, setSyncStatus] = useState(""); // "", "syncing", "ok", "error"
  const lastSyncRef = React.useRef(0);

  const setData = useCallback((updater) => {
    setDataRaw((prev) => { const next = typeof updater === "function" ? updater(prev) : updater; saveData(next); return next; });
  }, []);

  // 마지막 업로드 완료 시간
  const lastUploadRef = React.useRef(0);
  const UPLOAD_LOCK_MS = 60000; // 업로드 후 60초간 다운로드 차단

  // 데이터 변경 → 즉시 Sheets 업로드 (디바운스 500ms)
  const uploadTimerRef = React.useRef(null);
  const setData2 = useCallback((updater) => {
    setDataRaw((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      saveData(next);
      if (uploadTimerRef.current) clearTimeout(uploadTimerRef.current);
      uploadTimerRef.current = setTimeout(async () => {
        setSyncStatus("syncing");
        const ok = await syncToSheets(next);
        if (ok) {
          lastUploadRef.current = Date.now(); // 업로드 완료 시간 기록
          setSyncStatus("ok");
        } else {
          setSyncStatus("error");
        }
      }, 500);
      return next;
    });
  }, []);

  // 자동 다운로드: 30초마다 (업로드 후 60초간 차단)
  React.useEffect(() => {
    const autoSync = async () => {
      const now = Date.now();
      // 최근 업로드 후 60초 이내면 다운로드 건너뜀
      if (now - lastUploadRef.current < UPLOAD_LOCK_MS) return;
      setSyncStatus("syncing");
      try {
        const remote = await syncFromSheets();
        if (remote && Object.keys(remote).length > 0) {
          const remoteStr = JSON.stringify(remote);
          const localStr = JSON.stringify(loadData());
          if (remoteStr !== localStr) {
            setDataRaw(() => {
              const merged = { ...DEFAULT_DATA, ...remote };
              saveData(merged);
              return merged;
            });
          }
          setSyncStatus("ok");
        } else {
          setSyncStatus("ok");
        }
      } catch {
        setSyncStatus("error");
      }
    };

    // 앱 시작 시 딜레이 후 한번 (혹시 있을 다른 기기 변경사항 반영)
    const initTimer = setTimeout(autoSync, 3000);
    const interval = setInterval(autoSync, 30000);
    return () => { clearTimeout(initTimer); clearInterval(interval); };
  }, []);
  const nav = NAV_ITEMS.find((n) => n.key === activeNav);
  return (
    <div className="min-h-screen bg-[#f4f6fb] flex flex-col" style={{ fontFamily:"'Pretendard','Apple SD Gothic Neo','Noto Sans KR',sans-serif" }}>
      <header className="bg-[#1a2744] text-white px-5 py-3 flex items-center justify-between sticky top-0 z-30 shadow-lg">
        <div className="flex items-center gap-2">
          <span className="text-xl">💼</span>
          <div><h1 className="text-sm font-extrabold tracking-tight leading-tight">우리가정 자산관리사</h1><p className="text-xs text-blue-200 leading-tight">{data.members.map((m)=>m.name).join(" · ")}</p></div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-xs text-blue-200">{new Date().toLocaleDateString("ko-KR",{year:"numeric",month:"long"})}</div>
          {syncStatus==="syncing"&&<span className="text-xs text-blue-300 animate-pulse">⟳</span>}
          {syncStatus==="ok"&&<span className="text-xs text-green-300">☁️</span>}
          {syncStatus==="error"&&<span className="text-xs text-red-300">⚠️</span>}
        </div>
      </header>
      <div className="flex flex-1 overflow-hidden">
        <nav className="hidden sm:flex flex-col w-48 bg-white border-r border-gray-100 py-4 gap-0.5 sticky top-[52px] h-[calc(100vh-52px)] shadow-sm shrink-0">
          {NAV_ITEMS.map((item) => <button key={item.key} onClick={()=>setActiveNav(item.key)} className={`flex items-center gap-3 px-4 py-2.5 text-sm font-semibold transition-all ${activeNav===item.key?"bg-[#1a2744] text-white rounded-r-2xl":"text-gray-500 hover:bg-gray-50 hover:text-gray-800"}`}><span>{item.icon}</span>{item.label}</button>)}
        </nav>
        <main className="flex-1 overflow-y-auto p-4 pb-24 sm:pb-6">
          <div className="max-w-2xl mx-auto">
            <div className="mb-4 flex items-center gap-2"><span className="text-xl">{nav?.icon}</span><h2 className="text-lg font-extrabold text-[#1a2744]">{nav?.label}</h2></div>
            {activeNav==="dashboard"&&<DashboardSection data={data}/>}
            {activeNav==="assets"&&<AssetsSection data={data} setData={setData2}/>}
            {activeNav==="income"&&<IncomeExpenseSection data={data} setData={setData2}/>}
            {activeNav==="balance"&&<BalanceSheetSection data={data} setData={setData2}/>}
            {activeNav==="mumu"&&<MumuSection data={data} setData={setData2}/>}
            {activeNav==="accountbook"&&<AccountBookSection data={data} setData={setData2}/>}
            {activeNav==="settings"&&<SettingsSection data={data} setData={setData2}/>}
          </div>
        </main>
      </div>
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex justify-around items-center py-1.5 z-30 shadow-lg">
        {NAV_ITEMS.map((item) => <button key={item.key} onClick={()=>setActiveNav(item.key)} className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl transition-all ${activeNav===item.key?"text-[#1a2744]":"text-gray-400"}`}><span className="text-lg">{item.icon}</span><span className="text-[9px] font-semibold">{item.label}</span></button>)}
      </nav>
    </div>
  );
}
