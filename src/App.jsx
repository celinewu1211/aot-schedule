import React, { useState, useEffect, useRef } from "react";
import * as Papa from "papaparse";
import { createClient } from '@supabase/supabase-js';

// --- Supabase 連線設定 ---
const supabaseUrl = 'https://gsrhvjxodnjsqaosgegl.supabase.co';
const supabaseKey = 'sb_publishable_n23wUeYIP_WCd1PUbrCmeg_1zbJwqSp';
const supabase = createClient(supabaseUrl, supabaseKey);
const SKEY = "main"; 

const loadDB = async () => { 
  try { 
    const { data, error } = await supabase.from('app_data').select('data').eq('id', SKEY).single();
    if (error) throw error;
    // 嚴格確保解析
    let parsed = data ? data.data : null;
    if (typeof parsed === 'string') { try { parsed = JSON.parse(parsed); } catch(e) {} }
    return parsed;
  } catch (e) { return null; } 
};

const saveDB = async (d) => { 
  try { 
    const { error } = await supabase.from('app_data').upsert({ id: SKEY, data: d, updated_at: new Date().toISOString() });
    return !error; 
  } catch (e) { return false; } 
};

// --- 預設資料格式 ---
const INIT_AOT = {
  appName: "AOT排班系統", logo: "", adminPin: "0000",
  technicians: [
    { id: "9mt6dztf", name: "Sam", pin: "0000", isAdmin: true, active: true },
    { id: "n1zposo1", name: "阿肥", pin: "1111", isAdmin: false, active: true }
  ],
  customers: [], tasks: [], logs: []
};

// --- 工具與樣式 ---
const td = () => new Date().toISOString().split("T")[0];
const uid = () => Math.random().toString(36).slice(2, 10);
const DN = ["一", "二", "三", "四", "五", "六", "日"];

const weekOf = (b) => {
  const d = new Date(b); const m = new Date(d); m.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => { const dd = new Date(m); dd.setDate(m.getDate() + i); return dd.toISOString().split("T")[0]; });
};

const monthOf = (b) => {
  const d = new Date(b); const y = d.getFullYear(); const m = d.getMonth();
  const firstDay = new Date(y, m, 1); firstDay.setDate(firstDay.getDate() - ((firstDay.getDay() + 6) % 7));
  return Array.from({ length: 42 }, (_, i) => { const cur = new Date(firstDay); cur.setDate(cur.getDate() + i); return cur.toISOString().split("T")[0]; });
};

const S = {
  i: { width: "100%", padding: "10px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 14, boxSizing: "border-box", fontFamily: "inherit" },
  l: { display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 4 },
  b: (bg, c) => ({ padding: "8px 16px", background: bg, color: c || "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all 0.2s" }),
  card: { background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 4px 15px rgba(0,0,0,0.05)", border: "1px solid #e2e8f0" }
};

// --- 共用 Modal ---
function Modal({ open, onClose, title, children, width = 480 }) {
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,15,30,.6)", backdropFilter: "blur(4px)" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, padding: "24px", width: width, maxWidth: "90vw", maxHeight: "85vh", overflowY: "auto", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 18, color: "#0f172a" }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", color: "#94a3b8" }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// --- 登入模組 ---
function Login({ techs = [], adminPin, appName, logo, onLogin }) {
  const [acc, setAcc] = useState(""); const [pin, setPin] = useState(""); const [err, setErr] = useState("");

  const tryLogin = () => {
    const inputAcc = acc.trim().toLowerCase();
    if (inputAcc === "admin") {
      if (pin === adminPin) onLogin({ role: "admin", name: "系統總管", isAdmin: true }); else setErr("密碼錯誤");
      return;
    }
    const safeTechs = Array.isArray(techs) ? techs : [];
    const t = safeTechs.find(x => x && x.name && x.name.toLowerCase() === inputAcc);
    if (t) {
      if (t.active === false) setErr("此帳號已停用，請聯繫管理員");
      else if (t.pin === pin) onLogin({ role: t.isAdmin ? "admin" : "tech", techId: t.id, name: t.name, isAdmin: t.isAdmin });
      else setErr("密碼錯誤");
    } else setErr("找不到此帳號");
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #0f172a, #0ea5e9)", fontFamily: "'Noto Sans TC',sans-serif" }}>
      <div style={{ background: "#fff", borderRadius: 24, padding: "40px 30px", width: 360, boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)" }}>
        <div style={{ textAlign: "center", marginBottom: 30 }}>
          {logo ? <img src={logo} alt="logo" style={{ maxHeight: 70, maxWidth: "100%", marginBottom: 15, borderRadius: 8 }} /> : <div style={{ fontSize: 45, marginBottom: 10 }}>🐠</div>}
          <div style={{ fontSize: 22, fontWeight: 900, color: "#0f172a" }}>{appName || "AOT排班系統"}</div>
        </div>
        <div style={{ marginBottom: 15 }}>
          <label style={S.l}>帳號 <span style={{color:"#94a3b8", fontWeight:500}}>(不分大小寫)</span></label>
          <input style={S.i} value={acc} onChange={e => setAcc(e.target.value)} placeholder="請輸入姓名" />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={S.l}>PIN 碼</label>
          <input type="password" style={{ ...S.i, letterSpacing: 6, fontSize: 18 }} value={pin} onChange={e => setPin(e.target.value)} onKeyDown={e => { if(e.key === "Enter") { e.preventDefault(); tryLogin(); } }} placeholder="••••" />
        </div>
        {err && <div style={{ color: "#ef4444", fontSize: 13, marginBottom: 15, textAlign: "center", fontWeight: 700 }}>{err}</div>}
        <button onClick={tryLogin} style={{ ...S.b("#0ea5e9", "#fff"), width: "100%", padding: "12px", fontSize: 16 }}>登入系統</button>
      </div>
    </div>
  );
}

// --- 主系統介面 ---
function MainApp() {
  const [data, setData] = useState(null);
  const [session, setSession] = useState(null);
  const [tab, setTab] = useState("schedule");
  const [viewMode, setViewMode] = useState("week");
  const [weekBase, setWeekBase] = useState(td());
  const [saveStatus, setSaveStatus] = useState("");
  const [modals, setModals] = useState({});
  const [editing, setEditing] = useState({});
  const [filterTech, setFilterTech] = useState("ALL");
  const [searchCust, setSearchCust] = useState(""); 

  const [dragType, setDragType] = useState(null);
  const [dragItem, setDragItem] = useState(null);
  const [dragOverId, setDragOverId] = useState(null); 

  const ready = useRef(false);

  // 初始化防護網：混合預設值
  useEffect(() => { 
    loadDB().then(d => { 
      const safeData = (d && Object.keys(d).length > 0) ? { ...INIT_AOT, ...d } : INIT_AOT;
      setData(safeData); 
      setTimeout(() => { ready.current = true; }, 500); 
    }); 
  }, []);

  useEffect(() => {
    if (ready.current && data) { 
      setSaveStatus("saving");
      saveDB(data).then(ok => { setSaveStatus(ok ? "saved" : "error"); setTimeout(() => setSaveStatus(""), 3000); });
    }
  }, [data]);

  if (!data) return <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>連線中...</div>;
  
  // ⭐️ 終極白畫面防護：確保所有陣列絕對是陣列，不是 Object 或 null
  const safeTechs = Array.isArray(data.technicians) ? data.technicians : INIT_AOT.technicians;
  const safeCusts = Array.isArray(data.customers) ? data.customers : [];
  const safeTasks = Array.isArray(data.tasks) ? data.tasks : [];
  const safeLogs = Array.isArray(data.logs) ? data.logs : [];

  if (!session) return <Login techs={safeTechs} adminPin={data.adminPin || "0000"} appName={data.appName || "AOT排班系統"} logo={data.logo} onLogin={setSession} />;

  const isAdmin = session.isAdmin;
  
  // 嚴格更新函數
  const upd = (k, v) => setData(p => {
    if (!p) return p;
    const current = p[k];
    const passedVal = typeof v === 'function' ? v(Array.isArray(current) ? current : []) : v;
    return { ...p, [k]: passedVal };
  });
  
  const addLog = (msg) => {
    const newLog = { id: uid(), time: new Date().toLocaleString('zh-TW', {hour12:false}), msg, user: session.name };
    upd("logs", p => [newLog, ...(p || [])].slice(0, 50));
  };

  const gridDates = viewMode === "week" ? weekOf(weekBase) : monthOf(weekBase);
  
  const tfd = (ds) => {
    let tasks = safeTasks;
    if (!isAdmin) tasks = tasks.filter(t => t && t.techId === session.techId);
    else if (filterTech !== "ALL") tasks = tasks.filter(t => t && t.techId === filterTech);
    
    return tasks.filter(t => t && t.date === ds).sort((a, b) => {
      if (a.order !== undefined && b.order !== undefined) return a.order - b.order;
      return String(a.time || "23:59").localeCompare(String(b.time || "23:59")); 
    });
  };

  const toggleDone = (task) => {
    const isDone = !task.done;
    upd("tasks", p => p.map(t => t.id === task.id ? { ...t, done: isDone } : t));
    const custName = safeCusts.find(c => c && c.id === task.customerId)?.name || "未知客戶";
    addLog(`${isDone ? '✅ 完成了' : '🔄 取消完成'} [${custName}] 的行程`);
  };

  const handleDropTaskToDay = (e, targetDate) => {
    e.preventDefault();
    if (dragType !== "TASK" || !dragItem) return;
    
    upd("tasks", p => {
      let arr = [...p];
      const oldIdx = arr.findIndex(x => x && x.id === dragItem.id);
      if (oldIdx === -1) return arr;

      const temp = arr.splice(oldIdx, 1)[0];
      temp.date = targetDate; 

      if (dragOverId && dragOverId !== dragItem.id) {
        const targetIdx = arr.findIndex(x => x && x.id === dragOverId);
        if (targetIdx > -1) arr.splice(targetIdx, 0, temp); 
        else arr.push(temp);
      } else {
        arr.push(temp); 
      }

      arr.filter(x => x && x.date === targetDate).forEach((x, i) => { if(x) x.order = i; });
      return arr;
    });

    addLog(`調整了行程排期與順序`);
    setDragType(null); setDragItem(null); setDragOverId(null);
  };

  const importCSV = (file) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = (e) => {
      try {
        const res = Papa.parse(e.target.result, { header: true, skipEmptyLines: true });
        const mapped = res.data.map(r => ({
          id: uid(), name: String(r["客戶名稱"] || "").trim(), code: String(r["客戶編碼"] || "").trim(),
          address: String(r["地址"] || "").trim(), contact: String(r["聯絡人"] || "").trim(), phone: String(r["電話"] || "").trim(), email: String(r["Email"] || "").trim(), active: true
        })).filter(c => c.name);
        
        const existSet = new Set(safeCusts.map(c => c ? String(c.name || "") + String(c.code || "") : ""));
        const newCusts = mapped.filter(c => !existSet.has(c.name + c.code));
        upd("customers", p => [...(p || []), ...newCusts]);
        addLog(`匯入了 ${newCusts.length} 筆客戶資料`);
        alert(`成功匯入 ${newCusts.length} 筆新客戶 (已略過重複)`);
      } catch (err) { alert("匯入失敗，請確認 CSV 格式"); }
    };
    r.readAsText(file);
  };

  const currentMonthLabel = new Date(weekBase).toLocaleString('zh-TW', { year: 'numeric', month: 'long' });
  const safeSearch = String(searchCust || "").toLowerCase();

  return (
    <div style={{ fontFamily: "'Noto Sans TC',sans-serif", background: "#f8fafc", minHeight: "100vh", paddingBottom: 50 }}>
      {saveStatus && (
        <div style={{ position: "fixed", bottom: 12, right: 12, zIndex: 2000, padding: "8px 14px", borderRadius: 8, fontSize: 12, background: "#fff", border: "1px solid #e2e8f0", boxShadow: "0 4px 10px rgba(0,0,0,0.1)" }}>
          {saveStatus === "saving" ? "🔄 同步中..." : saveStatus === "saved" ? "✅ 雲端已同步" : "❌ 同步失敗"}
        </div>
      )}
      
      <div style={{ background: "linear-gradient(135deg,#0c4a6e,#0ea5e9)", padding: "12px 20px", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {data.logo && <img src={data.logo} alt="logo" style={{ height: 32, borderRadius: 4, background:"#fff", padding:2 }} />}
          <b style={{ fontSize: 18, letterSpacing: 1 }}>{data.appName || "AOT排班系統"}</b>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {isAdmin && (
            <button onClick={() => setModals({ logs: true })} style={{ background:"rgba(255,255,255,0.15)", border:"none", color:"#fff", cursor:"pointer", padding:"6px 12px", borderRadius:8 }}>
              🔔 動態通知 <span style={{ background:"#ef4444", fontSize:10, padding:"2px 6px", borderRadius:10, marginLeft:4 }}>{safeLogs.length}</span>
            </button>
          )}
          {isAdmin && <button onClick={() => setModals({ tech: true })} style={S.b("rgba(255,255,255,0.15)")}>技師管理</button>}
          {isAdmin && <button onClick={() => setModals({ cfg: true })} style={S.b("rgba(255,255,255,0.15)")}>系統設定</button>}
          <button onClick={() => setSession(null)} style={S.b("rgba(0,0,0,0.2)")}>登出</button>
        </div>
      </div>

      <div style={{ maxWidth: 1300, margin: "0 auto", padding: "20px 15px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ margin: 0, color: "#0f172a", fontSize: 22 }}>歡迎，{session.name} {isAdmin && <span style={{fontSize:12, background:"#0ea5e9", color:"#fff", padding:"4px 8px", borderRadius:6, verticalAlign:"middle", marginLeft:8}}>管理員</span>}</h2>
          {isAdmin && tab === "schedule" && (
            <div style={{ display: "flex", gap: 10 }}>
              <select style={{...S.i, width: "auto", padding: "8px 12px", background:"#fff"}} value={filterTech} onChange={e => setFilterTech(e.target.value)}>
                <option value="ALL">👀 查看所有人行程</option>
                {safeTechs.map(t => t ? <option key={t.id} value={t.id}>{t.name}</option> : null)}
              </select>
              <button onClick={() => { setEditing({ date: td(), time: "" }); setModals({ task: true }); setSearchCust(""); }} style={S.b("#10b981", "#fff")}>➕ 手動新增排程</button>
            </div>
          )}
        </div>
        
        <div style={{ display: "flex", gap: 20, borderBottom: "2px solid #e2e8f0", marginBottom: 20 }}>
          <button onClick={() => setTab("schedule")} style={{ padding: "10px 5px", background: "none", border: "none", fontSize: 16, fontWeight: tab === "schedule" ? 800 : 500, color: tab === "schedule" ? "#0ea5e9" : "#64748b", borderBottom: tab === "schedule" ? "3px solid #0ea5e9" : "3px solid transparent", cursor: "pointer" }}>📅 排程總覽</button>
          {isAdmin && <button onClick={() => setTab("customers")} style={{ padding: "10px 5px", background: "none", border: "none", fontSize: 16, fontWeight: tab === "customers" ? 800 : 500, color: tab === "customers" ? "#0ea5e9" : "#64748b", borderBottom: tab === "customers" ? "3px solid #0ea5e9" : "3px solid transparent", cursor: "pointer" }}>👥 客戶管理</button>}
        </div>

        {tab === "schedule" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 15, alignItems: "center", background:"#fff", padding:"12px 20px", borderRadius:12, border:"1px solid #e2e8f0" }}>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setViewMode("week")} style={{...S.b(viewMode==="week"?"#0ea5e9":"#f1f5f9", viewMode==="week"?"#fff":"#475569")}}>週視圖</button>
                <button onClick={() => setViewMode("month")} style={{...S.b(viewMode==="month"?"#0ea5e9":"#f1f5f9", viewMode==="month"?"#fff":"#475569")}}>月視圖</button>
              </div>
              <div style={{ display: "flex", alignItems:
