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
  serviceTypes: [
    { id: "mt", label: "定期保養", color: "#2563eb", bg: "#eff6ff" },
    { id: "cl", label: "清洗服務", color: "#a21caf", bg: "#fdf4ff" },
    { id: "eg", label: "工程施作", color: "#0e7490", bg: "#ecfeff" },
    { id: "ur", label: "臨時急件", color: "#dc2626", bg: "#fef2f2" }
  ],
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
function Modal({ open, onClose, title, children, width = 500 }) {
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
  const [acc, setAcc] = useState(""); 
  const [pin, setPin] = useState(""); 
  const [err, setErr] = useState("");
  const [showPwd, setShowPwd] = useState(false);

  const tryLogin = () => {
    setErr("");
    setTimeout(() => {
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
    }, 50);
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
          <div style={{ position: "relative" }}>
            <input type={showPwd ? "text" : "password"} style={{ ...S.i, letterSpacing: showPwd ? 2 : 6, fontSize: 18, paddingRight: 40 }} value={pin} onChange={e => setPin(e.target.value)} onKeyDown={e => { if(e.key === "Enter") { e.preventDefault(); tryLogin(); } }} placeholder="••••" />
            <button onClick={() => setShowPwd(!showPwd)} style={{ position: "absolute", right: 10, top: 10, background: "none", border: "none", cursor: "pointer", fontSize: 16 }}>
              {showPwd ? "🙈" : "👁️"}
            </button>
          </div>
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
  const [sortConfig, setSortConfig] = useState(null);

  const [dragType, setDragType] = useState(null);
  const [dragItem, setDragItem] = useState(null);
  const [dragOverId, setDragOverId] = useState(null); 

  const ready = useRef(false);

  useEffect(() => { 
    loadDB().then(d => { 
      const safeData = (d && Object.keys(d).length > 0) ? { ...INIT_AOT, ...d } : INIT_AOT;
      if(!safeData.serviceTypes) safeData.serviceTypes = INIT_AOT.serviceTypes; 
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
  
  const safeTechs = Array.isArray(data.technicians) ? data.technicians : INIT_AOT.technicians;
  const safeCusts = Array.isArray(data.customers) ? data.customers : [];
  const safeTasks = Array.isArray(data.tasks) ? data.tasks : [];
  const safeLogs = Array.isArray(data.logs) ? data.logs : [];
  const safeServices = Array.isArray(data.serviceTypes) ? data.serviceTypes : INIT_AOT.serviceTypes;

  if (!session) return <Login techs={safeTechs} adminPin={data.adminPin || "0000"} appName={data.appName || "AOT排班系統"} logo={data.logo} onLogin={setSession} />;

  const isAdmin = session.isAdmin;
  
  const upd = (k, v) => setData(p => {
    if (!p) return p;
    const current = p[k];
    const passedVal = typeof v === 'function' ? v(Array.isArray(current) ? current : []) : v;
    return { ...p, [k]: passedVal };
  });
  
  const addLog = (msg) => {
    const newLog = { id: uid(), time: new Date().toLocaleString('zh-TW', {hour12:false}), msg, user: session.name, read: false };
    upd("logs", p => [newLog, ...(p || [])].slice(0, 50));
  };
  const unreadLogs = safeLogs.filter(l => !l.read).length;

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

  const handleSortCustomer = (key) => {
    let direction = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') direction = 'descending';
    setSortConfig({ key, direction });
    const sorted = [...safeCusts].sort((a, b) => {
      if ((a[key]||"") < (b[key]||"")) return direction === 'ascending' ? -1 : 1;
      if ((a[key]||"") > (b[key]||"")) return direction === 'ascending' ? 1 : -1;
      return 0;
    });
    upd("customers", sorted);
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

  const restoreJSON = (file) => {
    if (!file) return;
    if (!window.confirm("⚠️ 警告：還原將會【覆蓋】目前系統所有資料！確定要繼續嗎？")) return;
    const r = new FileReader();
    r.onload = (e) => {
      try { 
        const d = JSON.parse(e.target.result); 
        setData(d); 
        alert("✅ 系統還原成功！"); 
        addLog("執行了系統層級還原"); 
      } catch { alert("還原失敗，檔案格式不正確"); }
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
              🔔 動態通知 {unreadLogs > 0 && <span style={{ background:"#ef4444", fontSize:10, padding:"2px 6px", borderRadius:10, marginLeft:4 }}>{unreadLogs}</span>}
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
              <button onClick={() => { setEditing({ date: td(), time: "", serviceId: "mt", repeat: "none", repeatCount: 6 }); setModals({ task: true }); setSearchCust(""); }} style={S.b("#10b981", "#fff")}>➕ 手動新增排程</button>
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
              <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
                <button onClick={() => { const d = new Date(weekBase); d.setDate(d.getDate() - (viewMode==="week"?7:30)); setWeekBase(d.toISOString().split("T")[0]); }} style={S.b("#f1f5f9", "#475569")}>◀</button>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <b style={{ fontSize: 18, color:"#1e293b" }}>{viewMode === "week" ? `${gridDates[0]} ~ ${gridDates[6]}` : currentMonthLabel}</b>
                  <input type="date" value={weekBase} onChange={(e) => { if(e.target.value) setWeekBase(e.target.value); }} style={{ padding:"6px", borderRadius:6, border:"1px solid #cbd5e1" }} title="快速跳轉日期" />
                </div>
                <button onClick={() => { const d = new Date(weekBase); d.setDate(d.getDate() + (viewMode==="week"?7:30)); setWeekBase(d.toISOString().split("T")[0]); }} style={S.b("#f1f5f9", "#475569")}>▶</button>
              </div>
            </div>
            
            {viewMode === "month" && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginBottom: 6 }}>
                {DN.map(d => <div key={d} style={{ textAlign:"center", fontWeight:700, color:"#64748b", fontSize:13 }}>週{d}</div>)}
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, overflowX: "auto", paddingBottom: 10 }}>
              {gridDates.map((date, idx) => {
                const dayTasks = tfd(date);
                const isToday = date === td();
                const isCurrentMonth = new Date(date).getMonth() === new Date(weekBase).getMonth();
                
                return (
                  <div key={date} 
                       onDragOver={(e) => { e.preventDefault(); if (dragType === "TASK") e.dataTransfer.dropEffect = "move"; }} 
                       onDrop={(e) => handleDropTaskToDay(e, date)}
                       style={{ background: isToday ? "#f0f9ff" : (isCurrentMonth ? "#fff" : "#f8fafc"), borderRadius: 10, padding: 8, minHeight: viewMode==="week"?300:120, border: isToday ? "2px solid #38bdf8" : "1px solid #e2e8f0", opacity: isCurrentMonth?1:0.5 }}>
                    <div onClick={() => { 
                           if(viewMode === "month") { setModals({ dayView: date }); }
                           else if(isAdmin) { setEditing({ prefillDate: date, time:"", serviceId: "mt", repeat: "none", repeatCount: 6 }); setModals({ task: true }); setSearchCust(""); }
                         }} 
                         style={{ textAlign: "center", borderBottom: isToday ? "1px solid #bae6fd" : "1px solid #f1f5f9", paddingBottom: 6, marginBottom: 8, cursor: "pointer" }}
                         title={viewMode === "month" ? "點擊放大查看當日" : "點擊新增行程"}>
                      {viewMode === "week" && <div style={{ fontSize: 12, color: isToday ? "#0284c7" : "#64748b", fontWeight:600 }}>週{DN[idx]}</div>}
                      <div style={{ fontSize: viewMode==="week"?22:16, fontWeight: 900, color: isToday ? "#0c4a6e" : "#0f172a" }}>
                        {date.split("-")[2]} {viewMode==="month" && <span style={{fontSize:10, color:"#0ea5e9"}}>🔍</span>}
                      </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: viewMode==="month"?80:"none", overflowY:"auto" }}>
                      {dayTasks.map(t => {
                        if (!t) return null;
                        const cust = safeCusts.find(c => c && c.id === t.customerId) || {};
                        const tech = safeTechs.find(tc => tc && tc.id === t.techId) || {};
                        const tag = safeServices.find(s => s.id === t.serviceId) || safeServices[0];
                        const isDraggable = isAdmin || t.techId === session.techId;
                        
                        const cardBg = t.done ? "#f0fdf4" : (t.report ? "#f8fafc" : "#fff");
                        const cardBorder = t.done ? "#bbf7d0" : "#cbd5e1";
                        const cardLeftBorder = t.done ? "#22c55e" : (tag?.color || "#3b82f6");

                        return (
                          <div key={t.id} 
                               draggable={isDraggable}
                               onDragStart={() => { setDragType("TASK"); setDragItem(t); }}
                               onDragEnter={() => { if(dragType === "TASK") setDragOverId(t.id); }}
                               style={{ padding: "8px", borderRadius: 8, background: cardBg, border: `1px solid ${cardBorder}`, borderLeft: `5px solid ${cardLeftBorder}`, cursor: isDraggable ? "grab" : "default", opacity: dragOverId === t.id ? 0.4 : 1, transition: "opacity 0.2s" }}>
                            
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                              {t.time ? <span style={{ fontWeight: 800, color: "#1e293b", fontSize: 13 }}>{t.time}</span> : <span />}
                              {isAdmin && (
                                <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                                  {viewMode === "week" && <button onClick={() => { setEditing({...t, repeat:"none"}); setModals({ task: true }); setSearchCust(""); }} style={{ background:"none", border:"none", cursor:"pointer", padding:0, fontSize:12 }} title="編輯行程">✏️</button>}
                                  {viewMode === "month" ? 
                                    <span style={{ fontSize: 11, color: "#475569", fontWeight:800 }}>👷‍♂️ {tech.name || "未知"}</span> : 
                                    <span style={{ fontSize: 10, color: "#fff", background:"#64748b", padding:"2px 4px", borderRadius:4 }}>{tech.name || "未知"}</span>
                                  }
                                </div>
                              )}
                            </div>
                            
                            {tag && viewMode==="week" && <div style={{fontSize:10, color:tag.color, background:tag.bg, padding:"2px 6px", borderRadius:4, display:"inline-block", marginBottom:4, fontWeight:700}}>{tag.label}</div>}
                            
                            <div style={{ color: "#334155", fontWeight:700, fontSize: 13, textDecoration: t.done ? "line-through" : "none", opacity: t.done ? 0.7 : 1 }}>
                              {cust.name || "未知客戶"}
                              {cust.active === false && <span style={{color:"#ef4444", fontSize:11, marginLeft:4}}>(🔴已停用)</span>}
                            </div>
                            
                            {!isAdmin && viewMode==="week" && cust.contact && (
                              <div style={{ fontSize: 11, color: "#475569", marginTop: 4, background:"#f1f5f9", padding:"4px", borderRadius:4 }}>
                                👤 {cust.contact} <br/>📞 <a href={`tel:${cust.phone}`} style={{color:"#0ea5e9", textDecoration:"none", fontWeight:600}}>{cust.phone}</a>
                                <br/>💬 <a href={`https://wa.me/${cust.phone}`} target="_blank" rel="noreferrer" style={{color:"#22c55e", textDecoration:"none", fontWeight:600}}>WhatsApp</a>
                                {cust.address && <><br/>📍 <a href={`https://google.com/maps/search/?api=1&query=$${cust.address}`} target="_blank" rel="noreferrer" style={{color:"#64748b", textDecoration:"none"}}>{cust.address}</a></>}
                              </div>
                            )}

                            {t.report && viewMode==="week" && (
                              <div style={{ fontSize: 11, color:"#64748b", marginTop: 4 }}>📝 有新備註</div>
                            )}
                            
                            {t.techId === session.techId && viewMode==="week" && (
                              <div style={{ display: "flex", gap: 5, marginTop: 8 }}>
                                <button onClick={() => toggleDone(t)} style={{ flex: 1, background: t.done ? "#22c55e" : "#f1f5f9", color: t.done ? "#fff" : "#475569", border: "none", padding: "6px 0", borderRadius: 4, fontSize: 11, cursor: "pointer", fontWeight:700 }}>
                                  {t.done ? "✅ 已完成" : "⬜ 標記完成"}
                                </button>
                                <button onClick={() => { setEditing(t); setModals({ report: true }); }} style={{ flex: 1, background: "#f8fafc", color: "#475569", border: "1px solid #cbd5e1", padding: "6px 0", borderRadius: 4, fontSize: 11, cursor: "pointer", fontWeight:600 }}>
                                  📝 備註
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* --- 介面：客戶 --- */}
        {tab === "customers" && isAdmin && (
          <div style={S.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize:18 }}>客戶名單 ({safeCusts.length})</h3>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => { setEditing({ active: true, id: uid() }); setModals({ custForm: true }); }} style={S.b("#10b981", "#fff")}>➕ 手動新增客戶</button>
                <label style={{ ...S.b("#0ea5e9", "#fff"), cursor: "pointer" }}> 📂 匯入 CSV <input type="file" accept=".csv" style={{ display: "none" }} onChange={(e) => importCSV(e.target.files[0])} /></label>
              </div>
            </div>
            <div style={{ background: "#fff", borderRadius: 10, overflow: "hidden", border: "1px solid #e2e8f0" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, textAlign: "left" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", color: "#475569", cursor:"pointer", userSelect:"none" }}>
                    <th style={{ padding: "14px", borderBottom:"2px solid #e2e8f0", width:60 }}>狀態</th>
                    <th style={{ padding: "14px", borderBottom:"2px solid #e2e8f0" }} onClick={() => handleSortCustomer('code')}>編碼 ↕</th>
                    <th style={{ padding: "14px", borderBottom:"2px solid #e2e8f0" }} onClick={() => handleSortCustomer('name')}>客戶名稱 ↕</th>
                    <th style={{ padding: "14px", borderBottom:"2px solid #e2e8f0" }}>聯絡人 / 快速連結</th>
                    <th style={{ padding: "14px", borderBottom:"2px solid #e2e8f0", width: 130 }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {safeCusts.map((c, i) => {
                    if (!c) return null;
                    return (
                      <tr key={c.id || i} 
                          draggable 
                          onDragStart={() => { setDragType("CUST"); setDragItem(i); }} 
                          onDragOver={(e) => e.preventDefault()} 
                          onDrop={() => {
                            if(dragType !== "CUST") return;
                            const arr = [...safeCusts]; const temp = arr[dragItem];
                            arr.splice(dragItem, 1); arr.splice(i, 0, temp);
                            upd("customers", arr); setDragType(null); setDragItem(null);
                          }}
                          style={{ borderBottom: "1px solid #f1f5f9", background: c.active === false ? "#f8fafc" : "#fff", opacity: c.active === false ? 0.6 : 1, cursor:"grab" }}>
                        <td style={{ padding: "12px 14px", textAlign:"center" }}>{c.active === false ? "🔴" : "🟢"}</td>
                        <td style={{ padding: "12px 14px" }}>{c.code}</td>
                        <td style={{ padding: "12px 14px", fontWeight: 700, color: "#0f172a" }}>
                          {c.name}
                          {c.address && <div style={{fontSize:12, marginTop:4}}><a href={`https://google.com/maps/search/?api=1&query=$${c.address}`} target="_blank" rel="noreferrer" style={{color:"#64748b", textDecoration:"none"}}>📍 {c.address}</a></div>}
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <div>{c.contact} {c.phone && <a href={`tel:${c.phone}`} style={{color:"#0ea5e9", textDecoration:"none", fontWeight:600}}>📞 {c.phone}</a>}</div>
                          <div style={{marginTop:4, display:"flex", gap:8}}>
                            {c.phone && <a href={`https://wa.me/${c.phone}`} target="_blank" rel="noreferrer" style={{color:"#22c55e", textDecoration:"none", fontSize:12}}>💬 WhatsApp</a>}
                            {c.email && <a href={`mailto:${c.email}`} style={{color:"#f59e0b", textDecoration:"none", fontSize:12}}>✉️ Email</a>}
                          </div>
                        </td>
                        <td style={{ padding: "12px 14px", display:"flex", gap:5 }}>
                          <button onClick={() => { setEditing({...c, _prevActive: c.active}); setModals({ custForm: true }); }} style={{ color: "#0ea5e9", background: "rgba(14,165,233,0.1)", padding:"6px 10px", borderRadius:6, border: "none", cursor: "pointer", fontWeight:600 }}>編輯</button>
                          <button onClick={() => { if(window.confirm("確定徹底刪除此客戶嗎？此動作不可逆！")) upd("customers", p => p.filter(x => x.id !== c.id)) }} style={{ color: "#ef4444", background: "rgba(239,68,68,0.1)", padding:"6px 10px", borderRadius:6, border: "none", cursor: "pointer", fontWeight:600 }}>刪除</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* --- Modals --- */}
      <Modal open={modals.dayView} onClose={() => setModals({})} title={`🔍 ${modals.dayView} 詳細行程`} width={600}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {tfd(modals.dayView).length === 0 ? <div style={{textAlign:"center", color:"#64748b", padding:20}}>這天沒有排程喔！</div> : 
           tfd(modals.dayView).map(t => {
             const cust = safeCusts.find(c => c && c.id === t.customerId) || {};
             const tech = safeTechs.find(tc => tc && tc.id === t.techId) || {};
             const tag = safeServices.find(s => s.id === t.serviceId) || safeServices[0];
             return (
               <div key={t.id} style={{ padding: 12, borderRadius: 8, border: "1px solid #e2e8f0", borderLeft: `5px solid ${tag?.color || "#3b82f6"}`, background: "#f8fafc", display:"flex", justifyContent:"space-between" }}>
                 <div>
                   <div style={{display:"flex", alignItems:"center", gap:10, marginBottom:4}}>
                     <span style={{fontWeight:800, fontSize:15}}>{t.time || "待確認"}</span>
                     <span style={{fontSize:11, color:tag?.color, background:tag?.bg, padding:"2px 6px", borderRadius:4}}>{tag?.label}</span>
                   </div>
                   <div style={{fontWeight:700, fontSize:15, color:"#0f172a"}}>
                     {cust.name} {cust.active === false && <span style={{color:"#ef4444", fontSize:12}}>(停用)</span>}
                   </div>
                   {cust.contact && <div style={{fontSize:12, color:"#475569", marginTop:4}}>👤 {cust.contact} 📞 {cust.phone}</div>}
                   {t.report && <div style={{fontSize:12, color:"#22c55e", marginTop:4}}>📝 備註: {t.report}</div>}
                 </div>
                 <div style={{textAlign:"right"}}>
                   <div style={{fontSize:13, fontWeight:800, color:"#0ea5e9", background:"#e0f2fe", padding:"4px 8px", borderRadius:6}}>👷‍♂️ {tech.name}</div>
                   <div style={{marginTop:8, fontSize:12, color: t.done ? "#22c55e" : "#64748b", fontWeight:700}}>{t.done ? "✅ 已完成" : "未完成"}</div>
                 </div>
               </div>
             );
           })
          }
        </div>
      </Modal>

      {/* 指派/編輯行程 (加入循環排程) */}
      <Modal open={modals.task} onClose={() => setModals({})} title={editing.id ? "編輯排程" : "新增排程"}>
        <div style={S.f}>
          <label style={S.l}>日期</label>
          <input type="date" style={S.i} value={editing.date || editing.prefillDate || ""} onChange={e => setEditing({...editing, date: e.target.value})} />
        </div>
        <div style={S.f}>
          <label style={S.l}>服務類型</label>
          <div style={{display:"flex", gap:8, flexWrap:"wrap"}}>
            {safeServices.map(s => (
              <button key={s.id} onClick={() => setEditing({...editing, serviceId: s.id})} style={{ padding:"6px 12px", borderRadius:20, border:`1px solid ${s.color}`, background: editing.serviceId === s.id ? s.color : "#fff", color: editing.serviceId === s.id ? "#fff" : s.color, cursor:"pointer", fontWeight:600, fontSize:12 }}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <div style={S.f}>
          <label style={S.l}>選擇客戶 (過濾搜尋)</label>
          <input type="text" placeholder="🔍 快速搜尋名稱或編碼..." style={{...S.i, marginBottom: 8}} value={searchCust} onChange={e => setSearchCust(e.target.value)} />
          <select style={S.i} value={editing.customerId || ""} onChange={e => setEditing({...editing, customerId: e.target.value})}>
            <option value="">請從選單選擇符合的客戶...</option>
            {safeCusts
              .filter(c => c && c.active !== false && (String(c.name||"").toLowerCase().includes(safeSearch) || String(c.code||"").toLowerCase().includes(safeSearch)))
              .map(c => <option key={c.id} value={c.id}>[{c.code}] {c.name}</option>)}
          </select>
        </div>
        <div style={S.f}>
          <label style={S.l}>指派技師</label>
          <select style={S.i} value={editing.techId || ""} onChange={e => setEditing({...editing, techId: e.target.value})}>
            <option value="">請選擇技師...</option>
            {safeTechs.filter(t=>t&&t.active).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div style={S.f}>
          <label style={S.l}>約定時間 (非必填)</label>
          <input type="time" style={S.i} value={editing.time || ""} onChange={e => setEditing({...editing, time: e.target.value})} />
        </div>
        
        {/* 定期排程選項 (僅新增時顯示) */}
        {!editing.id && (
          <div style={{ background: "#f0f9ff", padding: 15, borderRadius: 8, marginBottom: 15, border: "1px solid #bae6fd" }}>
            <label style={S.l}>🔄 循環定期排程</label>
            <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
              {["none", "weekly", "biweekly", "monthly"].map(opt => {
                const labels = { none: "單次不循環", weekly: "每週", biweekly: "每雙週", monthly: "每月" };
                return (
                  <label key={opt} style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                    <input type="radio" checked={editing.repeat === opt} onChange={() => setEditing({...editing, repeat: opt})} /> {labels[opt]}
                  </label>
                );
              })}
            </div>
            {editing.repeat !== "none" && (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 13, color: "#475569" }}>自動產生接下來的</span>
                <input type="number" min="2" max="24" style={{...S.i, width: 80, padding:"6px"}} value={editing.repeatCount || 6} onChange={e => setEditing({...editing, repeatCount: Number(e.target.value)})} />
                <span style={{ fontSize: 13, color: "#475569" }}>期排程</span>
              </div>
            )}
          </div>
        )}
        
        {editing.id && (
          <div style={{ textAlign: "right", marginTop: 10, marginBottom: 10 }}>
            <button onClick={() => { if(window.confirm("確定刪除此行程？")) { upd("tasks", p => p.filter(t => t.id !== editing.id)); addLog("刪除了行程"); setModals({}); } }} style={{ background:"none", border:"none", color:"#ef4444", cursor:"pointer", fontSize:13 }}>🗑️ 刪除此行程</button>
          </div>
        )}

        <button onClick={() => {
          if (!editing.customerId || !editing.techId || (!editing.date && !editing.prefillDate)) return alert("日期、客戶與技師為必選");
          const baseDateStr = editing.date || editing.prefillDate;
          
          // 如果是編輯，或是單次新增
          if (editing.id || editing.repeat === "none" || !editing.repeat) {
             const newTask = { id: editing.id || uid(), date: baseDateStr, time: editing.time || "", customerId: editing.customerId, techId: editing.techId, serviceId: editing.serviceId || "mt", done: editing.done || false, report: editing.report || "", order: editing.order || Date.now() };
             if(editing.id) upd("tasks", p => p.map(t => t.id === editing.id ? { ...t, ...newTask } : t));
             else upd("tasks", p => [...(p || []), newTask]);
             addLog(`排定了 ${baseDateStr} 的行程`);
          } else {
             // 產生循環排程
             let generatedTasks = [];
             let baseDate = new Date(baseDateStr);
             let count = editing.repeatCount || 6;
             for (let i = 0; i < count; i++) {
                let d = new Date(baseDate);
                if (editing.repeat === "weekly") d.setDate(d.getDate() + (i * 7));
                if (editing.repeat === "biweekly") d.setDate(d.getDate() + (i * 14));
                if (editing.repeat === "monthly") d.setMonth(d.getMonth() + i);
                
                generatedTasks.push({ id: uid(), date: d.toISOString().split("T")[0], time: editing.time || "", customerId: editing.customerId, techId: editing.techId, serviceId: editing.serviceId || "mt", done: false, report: "", order: Date.now() + i });
             }
             upd("tasks", p => [...(p || []), ...generatedTasks]);
             addLog(`自動產生了 ${count} 期循環排程`);
          }
          setModals({});
        }} style={{ ...S.b("#0ea5e9", "#fff"), width: "100%", padding: "12px" }}>確認儲存排程</button>
      </Modal>

      <Modal open={modals.custForm} onClose={() => setModals({})} title={editing.name ? "編輯客戶" : "新增客戶"}>
        <div style={S.f}><label style={S.l}>客戶名稱 (必填)</label><input style={S.i} value={editing.name || ""} onChange={e => setEditing({...editing, name: e.target.value})} /></div>
        <div style={S.f}><label style={S.l}>客戶編碼</label><input style={S.i} value={editing.code || ""} onChange={e => setEditing({...editing, code: e.target.value})} /></div>
        <div style={S.f}><label style={S.l}>地址 (將支援地圖連結)</label><input style={S.i} value={editing.address || ""} onChange={e => setEditing({...editing, address: e.target.value})} /></div>
        <div style={{ display: "flex", gap:10, marginBottom:12 }}>
          <div style={{flex:1}}><label style={S.l}>聯絡人</label><input style={S.i} value={editing.contact || ""} onChange={e => setEditing({...editing, contact: e.target.value})} /></div>
          <div style={{flex:1}}><label style={S.l}>電話 (支援 WhatsApp)</label><input style={S.i} value={editing.phone || ""} onChange={e => setEditing({...editing, phone: e.target.value})} /></div>
        </div>
        <div style={S.f}><label style={S.l}>Email</label><input style={S.i} value={editing.email || ""} onChange={e => setEditing({...editing, email: e.target.value})} /></div>
        <div style={S.f}>
          <label style={{ fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontWeight:700, background:"#f1f5f9", padding:10, borderRadius:8 }}>
            <input type="checkbox" checked={editing.active !== false} onChange={e => setEditing({...editing, active: e.target.checked})} style={{transform:"scale(1.2)"}} /> 
            {editing.active !== false ? "🟢 啟用此客戶" : "🔴 停用此客戶 (將從新增排程選單隱藏)"}
          </label>
        </div>
        <button onClick={() => {
          if (!editing.name) return alert("請輸入客戶名稱");
          
          // 停用防呆處置：檢查是否有未來的行程
          if (editing._prevActive !== false && editing.active === false) {
             const futureTasks = safeTasks.filter(t => t.customerId === editing.id && t.date >= td() && !t.done);
             if (futureTasks.length > 0) {
                if (window.confirm(`⚠️ 注意：該客戶被設為「停用」。\n系統偵測到他還有 ${futureTasks.length} 筆未來的排程尚未執行。\n\n▶ 按【確定】：一併刪除這些未來行程 (保留歷史)。\n▶ 按【取消】：僅停用客戶，保留原本的未來排程。`)) {
                   upd("tasks", p => p.filter(t => !(t.customerId === editing.id && t.date >= td() && !t.done)));
                   addLog(`自動清除了停用客戶 [${editing.name}] 的未來排程`);
                }
             }
          }

          const isExist = safeCusts.find(c => c && c.id === editing.id);
          // 移除暫存變數
          const finalData = {...editing}; delete finalData._prevActive;

          if (isExist) upd("customers", p => p.map(c => c.id === editing.id ? finalData : c));
          else upd("customers", p => [finalData, ...(p||[])]);
          
          addLog(`更新了客戶資料: ${editing.name}`);
          setModals({});
        }} style={{ ...S.b("#10b981", "#fff"), width: "100%", padding: "12px" }}>儲存客戶資料</button>
      </Modal>

      <Modal open={modals.report} onClose={() => setModals({})} title="填寫狀態備註">
        <div style={S.f}><label style={S.l}>現場備註 / 處理狀況</label><textarea rows={5} style={S.i} value={editing.report || ""} onChange={e => setEditing({...editing, report: e.target.value})} placeholder="例如：已完成保養，建議下次更換馬達..." /></div>
        <button onClick={() => {
          upd("tasks", p => p.map(t => t.id === editing.id ? { ...t, report: editing.report } : t));
          addLog(`回報了行程備註`);
          setModals({});
        }} style={{ ...S.b("#0ea5e9", "#fff"), width: "100%", padding: "12px" }}>送出備註</button>
      </Modal>

      <Modal open={modals.tech} onClose={() => setModals({})} title="技師管理模組">
         <p style={{ fontSize: 13, color:"#64748b", marginBottom:15 }}>* 提示：按住技師區塊可上下拖曳調整顯示排序。</p>
         {safeTechs.map((t, idx) => {
           if(!t) return null;
           return (
           <div key={t.id || idx} draggable onDragStart={() => { setDragType("TECH"); setDragItem(idx); }} onDragOver={(e) => e.preventDefault()} onDrop={() => {
                  if(dragType !== "TECH") return;
                  const arr = [...safeTechs]; const temp = arr[dragItem];
                  arr.splice(dragItem, 1); arr.splice(idx, 0, temp);
                  upd("technicians", arr); setDragType(null); setDragItem(null);
                }}
                style={{ border: "1px solid #e2e8f0", padding: 16, borderRadius: 12, marginBottom: 12, background: t.active ? "#fff" : "#f8fafc", opacity: t.active ? 1 : 0.6, cursor:"grab" }}>
              <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                <div style={{ flex: 2 }}><label style={S.l}>姓名</label><input style={S.i} value={t.name || ""} onChange={e => { const n = [...safeTechs]; n[idx].name = e.target.value; upd("technicians", n); }} /></div>
                <div style={{ flex: 1 }}><label style={S.l}>PIN 碼</label><input type="password" style={{...S.i, letterSpacing:3}} maxLength={4} value={t.pin || ""} onChange={e => { const n = [...safeTechs]; n[idx].pin = e.target.value.replace(/\D/g,''); upd("technicians", n); }} /></div>
              </div>
              <div style={{ display: "flex", gap: 20, background:"#f1f5f9", padding:"8px 12px", borderRadius:8 }}>
                <label style={{ fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontWeight:600 }}>
                  <input type="checkbox" checked={t.isAdmin} onChange={e => { const n = [...safeTechs]; n[idx].isAdmin = e.target.checked; upd("technicians", n); }} /> 👑 設為管理員
                </label>
                <label style={{ fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontWeight:600, color: t.active ? "#22c55e" : "#ef4444" }}>
                  <input type="checkbox" checked={t.active !== false} onChange={e => { const n = [...safeTechs]; n[idx].active = e.target.checked; upd("technicians", n); }} /> {t.active ? "🟢 帳號啟用中" : "🔴 帳號已停用"}
                </label>
              </div>
           </div>
         )})}
         <button onClick={() => setModals({})} style={{ ...S.b("#0ea5e9", "#fff"), width: "100%", padding:"12px", marginTop:10 }}>儲存變更並關閉</button>
      </Modal>

      <Modal open={modals.logs} onClose={() => setModals({})} title="系統近期動態追蹤">
        <div style={{ display:"flex", justifyContent:"flex-end", marginBottom: 15 }}>
          <button onClick={() => { upd("logs", p => p.map(x => ({...x, read:true}))); }} style={{...S.b("none", "#64748b"), border:"1px solid #cbd5e1", padding:"6px 10px", fontSize:12}}>✔️ 全部標記為已讀</button>
        </div>
        <div style={{ maxHeight: 400, overflowY: "auto", paddingRight: 5 }}>
          {safeLogs.length > 0 ? safeLogs.map((l, i) => (
            <div key={l?.id || i} style={{ padding: "14px 12px", borderBottom: "1px solid #e2e8f0", fontSize: 14, display:"flex", gap:10, background: l.read ? "#fff" : "#fff1f2", borderLeft: l.read ? "none" : "4px solid #ef4444" }}>
              <div style={{ color: "#94a3b8", whiteSpace:"nowrap", fontSize:12 }}>{l?.time || ""}</div>
              <div style={{ lineHeight:1.4 }}><b style={{color:"#0ea5e9"}}>{l?.user || "系統"}</b> {l?.msg || ""}</div>
            </div>
          )) : <div style={{ textAlign:"center", padding:40, color:"#94a3b8", fontSize:15 }}>✅ 目前尚無任何新動態</div>}
        </div>
      </Modal>

      <Modal open={modals.cfg} onClose={() => setModals({})} title="系統環境設定">
         <div style={S.f}><label style={S.l}>系統名稱</label><input style={S.i} value={data.appName || ""} onChange={e => upd("appName", e.target.value)} /></div>
         <div style={S.f}><label style={S.l}>上傳公司 Logo</label><input type="file" accept="image/*" style={{...S.i, padding:"6px"}} onChange={e => { if (!e.target.files[0]) return; const r = new FileReader(); r.onload = ev => upd("logo", ev.target.result); r.readAsDataURL(e.target.files[0]); }} /></div>
         <hr style={{ border:"0", borderTop:"1px solid #e2e8f0", margin:"20px 0" }} />
         <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
           <h4 style={{margin:0, color:"#0f172a"}}>備份與還原</h4>
           <button onClick={() => {
             const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
             const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `AOT_Backup_${td()}.json`; a.click();
             addLog("下載了系統資料備份");
           }} style={{ ...S.b("#10b981", "#fff"), width: "100%", padding:"12px" }}>💾 點擊下載完整 JSON 備份</button>

           <label style={{ ...S.b("#ef4444", "#fff"), width: "100%", padding:"12px", textAlign:"center", cursor:"pointer", display:"block", boxSizing:"border-box" }}>
             ⚠️ 上傳還原備份檔 (將覆蓋現有資料)
             <input type="file" accept=".json" style={{ display: "none" }} onChange={(e) => restoreJSON(e.target.files[0])} />
           </label>
         </div>
      </Modal>
    </div>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, errorMsg: "" }; }
  static getDerivedStateFromError(error) { return { hasError: true, errorMsg: error.toString() }; }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "40px", textAlign: "center", fontFamily: "sans-serif" }}>
          <h2 style={{ color: "#ef4444" }}>⚠️ 系統畫面發生錯誤</h2>
          <button onClick={() => window.location.reload()} style={{ padding: "10px 20px", background: "#0ea5e9", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "16px", margin: "20px 0" }}>🔄 重新載入系統</button>
          <div style={{ background: "#f1f5f9", padding: "10px", borderRadius: "8px", color: "#334155", textAlign: "left", maxWidth: "800px", margin: "0 auto", overflowX: "auto" }}><code>{this.state.errorMsg}</code></div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return <ErrorBoundary><MainApp /></ErrorBoundary>;
}
