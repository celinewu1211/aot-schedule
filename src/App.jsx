import { useState, useEffect, useRef } from "react";
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
    return data ? data.data : null;
  } catch (e) { return null; } 
};

const saveDB = async (d) => { 
  try { 
    const { error } = await supabase.from('app_data').upsert({ id: SKEY, data: d, updated_at: new Date().toISOString() });
    return !error; 
  } catch (e) { return false; } 
};

// --- AOT 預設格式 ---
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

const S = {
  i: { width: "100%", padding: "10px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 14, boxSizing: "border-box", fontFamily: "inherit" },
  l: { display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 4 },
  b: (bg, c) => ({ padding: "8px 16px", background: bg, color: c || "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all 0.2s" }),
  card: { background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 4px 15px rgba(0,0,0,0.05)", border: "1px solid #e2e8f0" }
};

// --- 共用 Modal ---
function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,15,30,.6)", backdropFilter: "blur(4px)" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, padding: "24px", width: 480, maxWidth: "90vw", maxHeight: "85vh", overflowY: "auto", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 18, color: "#0f172a" }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", color: "#94a3b8" }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// --- 登入模組 (需求1) ---
function Login({ techs, adminPin, appName, logo, onLogin }) {
  const [acc, setAcc] = useState(""); const [pin, setPin] = useState(""); const [err, setErr] = useState("");

  const tryLogin = () => {
    const inputAcc = acc.trim().toLowerCase();
    // 預設最高權限後門
    if (inputAcc === "admin") {
      if (pin === adminPin) onLogin({ role: "admin", name: "系統總管", isAdmin: true }); else setErr("密碼錯誤");
      return;
    }
    // 動態判斷技師與管理員
    const t = techs?.find(x => x.name.toLowerCase() === inputAcc);
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
          <div style={{ fontSize: 22, fontWeight: 900, color: "#0f172a" }}>{appName}</div>
        </div>
        <div style={{ marginBottom: 15 }}>
          <label style={S.l}>帳號 <span style={{color:"#94a3b8", fontWeight:500}}>(不分大小寫)</span></label>
          <input style={S.i} value={acc} onChange={e => setAcc(e.target.value)} placeholder="請輸入姓名" />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={S.l}>PIN 碼</label>
          <input type="password" style={{ ...S.i, letterSpacing: 6, fontSize: 18 }} value={pin} onChange={e => setPin(e.target.value)} onKeyDown={e => e.key === "Enter" && tryLogin()} placeholder="••••" />
        </div>
        {err && <div style={{ color: "#ef4444", fontSize: 13, marginBottom: 15, textAlign: "center", fontWeight: 700 }}>{err}</div>}
        <button onClick={tryLogin} style={{ ...S.b("#0ea5e9", "#fff"), width: "100%", padding: "12px", fontSize: 16 }}>登入系統</button>
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <button onClick={() => alert("【忘記密碼】\n請聯繫您的系統管理員，管理員可於「技師管理」後台直接為您重設 4 位數密碼。")} style={{ background: "none", border: "none", color: "#64748b", fontSize: 13, textDecoration: "underline", cursor: "pointer" }}>忘記密碼？</button>
        </div>
      </div>
    </div>
  );
}

// --- 主系統 ---
export default function App() {
  const [data, setData] = useState(null);
  const [session, setSession] = useState(null);
  const [tab, setTab] = useState("schedule");
  const [weekBase, setWeekBase] = useState(td());
  const [saveStatus, setSaveStatus] = useState("");
  const [modals, setModals] = useState({});
  const [editing, setEditing] = useState({});
  const [filterTech, setFilterTech] = useState("ALL");
  const [sortConfig, setSortConfig] = useState(null); // 客戶排序

  // 拖曳狀態 (Native DnD)
  const [dragType, setDragType] = useState(null);
  const [dragItem, setDragItem] = useState(null);
  const [dragTargetId, setDragTargetId] = useState(null);

  const ready = useRef(false);

  // 初始化與存檔 (嚴格遵守 JSONB 邏輯)
  useEffect(() => { loadDB().then(d => { setData(d || INIT_AOT); setTimeout(() => { ready.current = true; }, 500); }); }, []);
  useEffect(() => {
    if (ready.current && data) { 
      setSaveStatus("saving");
      saveDB(data).then(ok => { setSaveStatus(ok ? "saved" : "error"); setTimeout(() => setSaveStatus(""), 3000); });
    }
  }, [data]);

  if (!data) return <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>連線中...</div>;
  if (!session) return <Login techs={data.technicians} adminPin={data.adminPin} appName={data.appName} logo={data.logo} onLogin={setSession} />;

  const isAdmin = session.isAdmin;
  const upd = (k, v) => setData(p => ({ ...p, [k]: typeof v === 'function' ? v(p[k]) : v }));
  
  // 系統紀錄 (需求7)
  const addLog = (msg) => {
    const newLog = { id: uid(), time: new Date().toLocaleString('zh-TW', {hour12:false}), msg, user: session.name };
    upd("logs", p => [newLog, ...(p || [])].slice(0, 50));
  };

  const weekDates = weekOf(weekBase);
  
  // 排程檢視邏輯 (需求4 & 6)
  const tfd = (ds) => {
    let tasks = data.tasks || [];
    if (!isAdmin) tasks = tasks.filter(t => t.techId === session.techId);
    else if (filterTech !== "ALL") tasks = tasks.filter(t => t.techId === filterTech);
    return tasks.filter(t => t.date === ds).sort((a, b) => {
      // 若有自訂順序(order)，優先依順序；否則依時間
      if (a.order !== undefined && b.order !== undefined) return a.order - b.order;
      return a.time.localeCompare(b.time);
    });
  };

  // 拖曳行程處理 (需求3)
  const handleDropTask = (e, targetDate) => {
    e.preventDefault();
    if (dragType !== "TASK" || !dragItem) return;
    
    if (dragItem.date !== targetDate) {
      // 跨日拖曳：保留原時間
      upd("tasks", p => p.map(t => t.id === dragItem.id ? { ...t, date: targetDate } : t));
      addLog(`將行程移至 ${targetDate}`);
    } else {
      // 同日拖曳：觸發微調時間視窗
      if (dragItem.id !== dragTargetId) {
        setEditing({ ...dragItem, targetId: dragTargetId });
        setModals({ adjustTime: true });
      }
    }
    setDragType(null); setDragItem(null); setDragTargetId(null);
  };

  // 客戶匯入與防呆 (需求2)
  const importCSV = (file) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = (e) => {
      try {
        const res = Papa.parse(e.target.result, { header: true, skipEmptyLines: true });
        const mapped = res.data.map(r => ({
          id: uid(), name: (r["客戶名稱"] || "").trim(), code: (r["客戶編碼"] || "").trim(),
          address: (r["地址"] || "").trim(), contact: (r["聯絡人"] || "").trim(), phone: (r["電話"] || "").trim(), email: (r["Email"] || "").trim()
        })).filter(c => c.name);
        
        const existSet = new Set(data.customers.map(c => c.name + c.code));
        const newCusts = mapped.filter(c => !existSet.has(c.name + c.code));
        upd("customers", p => [...p, ...newCusts]);
        addLog(`匯入了 ${newCusts.length} 筆客戶資料`);
        alert(`成功匯入 ${newCusts.length} 筆新客戶 (已略過重複)`);
      } catch (err) { alert("匯入失敗，請確認 CSV 格式"); }
    };
    r.readAsText(file);
  };

  // 排序客戶 (需求2)
  const handleSortCustomer = (key) => {
    let direction = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
    const sorted = [...data.customers].sort((a, b) => {
      if (a[key] < b[key]) return direction === 'ascending' ? -1 : 1;
      if (a[key] > b[key]) return direction === 'ascending' ? 1 : -1;
      return 0;
    });
    upd("customers", sorted);
  };

  // 備份還原 (需求8)
  const restoreJSON = (file) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = (e) => {
      try { const d = JSON.parse(e.target.result); setData(d); alert("系統還原成功！"); addLog("執行了系統層級還原"); }
      catch { alert("還原失敗，請確認是否為正確的備份檔"); }
    };
    r.readAsText(file);
  };

  return (
    <div style={{ fontFamily: "'Noto Sans TC',sans-serif", background: "#f8fafc", minHeight: "100vh", paddingBottom: 50 }}>
      {/* 狀態列 */}
      {saveStatus && (
        <div style={{ position: "fixed", bottom: 12, right: 12, zIndex: 2000, padding: "8px 14px", borderRadius: 8, fontSize: 12, background: "#fff", border: "1px solid #e2e8f0", boxShadow: "0 4px 10px rgba(0,0,0,0.1)" }}>
          {saveStatus === "saving" ? "🔄 同步中..." : saveStatus === "saved" ? "✅ 雲端已同步" : "❌ 同步失敗"}
        </div>
      )}
      
      {/* 導航列 */}
      <div style={{ background: "linear-gradient(135deg,#0c4a6e,#0ea5e9)", padding: "12px 20px", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 2px 10px rgba(0,0,0,0.1)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {data.logo && <img src={data.logo} alt="logo" style={{ height: 32, borderRadius: 4, background:"#fff", padding:2 }} />}
          <b style={{ fontSize: 18, letterSpacing: 1 }}>{data.appName}</b>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {isAdmin && (
            <button onClick={() => setModals({ logs: true })} style={{ background:"rgba(255,255,255,0.15)", border:"none", color:"#fff", cursor:"pointer", position:"relative", padding:"6px 12px", borderRadius:8 }}>
              🔔 動態通知 <span style={{ background:"#ef4444", fontSize:10, padding:"2px 6px", borderRadius:10, marginLeft:4 }}>{data.logs?.length || 0}</span>
            </button>
          )}
          {isAdmin && <button onClick={() => setModals({ tech: true })} style={S.b("rgba(255,255,255,0.15)")}>技師管理</button>}
          {isAdmin && <button onClick={() => setModals({ cfg: true })} style={S.b("rgba(255,255,255,0.15)")}>系統設定</button>}
          <button onClick={() => setSession(null)} style={S.b("rgba(0,0,0,0.2)")}>登出</button>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "20px 15px" }}>
        {/* 歡迎與篩選區 */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ margin: 0, color: "#0f172a", fontSize: 22 }}>歡迎，{session.name} {isAdmin && <span style={{fontSize:12, background:"#0ea5e9", color:"#fff", padding:"4px 8px", borderRadius:6, verticalAlign:"middle", marginLeft:8}}>管理員</span>}</h2>
          {isAdmin && tab === "schedule" && (
            <select style={{...S.i, width: "auto", padding: "8px 12px", background:"#fff"}} value={filterTech} onChange={e => setFilterTech(e.target.value)}>
              <option value="ALL">👀 查看所有人行程</option>
              {data.technicians.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          )}
        </div>
        
        {/* 頁籤 */}
        <div style={{ display: "flex", gap: 20, borderBottom: "2px solid #e2e8f0", marginBottom: 20 }}>
          <button onClick={() => setTab("schedule")} style={{ padding: "10px 5px", background: "none", border: "none", fontSize: 16, fontWeight: tab === "schedule" ? 800 : 500, color: tab === "schedule" ? "#0ea5e9" : "#64748b", borderBottom: tab === "schedule" ? "3px solid #0ea5e9" : "3px solid transparent", cursor: "pointer" }}>📅 排程總覽</button>
          {isAdmin && <button onClick={() => setTab("customers")} style={{ padding: "10px 5px", background: "none", border: "none", fontSize: 16, fontWeight: tab === "customers" ? 800 : 500, color: tab === "customers" ? "#0ea5e9" : "#64748b", borderBottom: tab === "customers" ? "3px solid #0ea5e9" : "3px solid transparent", cursor: "pointer" }}>👥 客戶管理</button>}
        </div>

        {/* --- 介面：排程 (需求3 & 6) --- */}
        {tab === "schedule" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 15, alignItems: "center", background:"#fff", padding:"12px 20px", borderRadius:12, border:"1px solid #e2e8f0" }}>
              <button onClick={() => { const d = new Date(weekBase); d.setDate(d.getDate() - 7); setWeekBase(d.toISOString().split("T")[0]); }} style={S.b("#f1f5f9", "#475569")}>◀ 上週</button>
              <b style={{ fontSize: 18, color:"#1e293b" }}>{weekDates[0]} ~ {weekDates[6]}</b>
              <button onClick={() => { const d = new Date(weekBase); d.setDate(d.getDate() + 7); setWeekBase(d.toISOString().split("T")[0]); }} style={S.b("#f1f5f9", "#475569")}>下週 ▶</button>
            </div>
            
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 10, overflowX: "auto", paddingBottom: 10 }}>
              {weekDates.map((date, idx) => {
                const dayTasks = tfd(date);
                const isToday = date === td();
                return (
                  <div key={date} 
                       onDragOver={(e) => { e.preventDefault(); if (dragType === "TASK") e.dataTransfer.dropEffect = "move"; }} 
                       onDrop={(e) => handleDropTask(e, date)}
                       style={{ background: isToday ? "#f0f9ff" : "#fff", borderRadius: 12, padding: 12, minHeight: 300, border: isToday ? "2px solid #38bdf8" : "1px solid #e2e8f0", minWidth: 140 }}>
                    {/* 日曆標頭 - 點擊新增 */}
                    <div onClick={() => { if(isAdmin) { setEditing({ prefillDate: date }); setModals({ task: true }); } }} 
                         style={{ textAlign: "center", borderBottom: isToday ? "1px solid #bae6fd" : "1px solid #f1f5f9", paddingBottom: 10, marginBottom: 12, cursor: isAdmin ? "pointer" : "default" }}>
                      <div style={{ fontSize: 13, color: isToday ? "#0284c7" : "#64748b", fontWeight:600 }}>週{DN[idx]}</div>
                      <div style={{ fontSize: 24, fontWeight: 900, color: isToday ? "#0c4a6e" : "#0f172a" }}>{date.split("-")[2]}</div>
                      {isAdmin && <div style={{ fontSize: 11, color: "#0ea5e9", marginTop: 4 }}>+ 點擊新增</div>}
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {dayTasks.map((t, taskIndex) => {
                        const cust = data.customers.find(c => c.id === t.customerId) || {};
                        const tech = data.technicians.find(tc => tc.id === t.techId) || {};
                        const isDraggable = isAdmin || t.techId === session.techId;
                        
                        return (
                          <div key={t.id} 
                               draggable={isDraggable}
                               onDragStart={() => { setDragType("TASK"); setDragItem(t); }}
                               onDragEnter={() => setDragTargetId(t.id)}
                               style={{ padding: "10px", borderRadius: 10, background: t.report ? "#f0fdf4" : "#fff", border: t.report ? "1px solid #bbf7d0" : "1px solid #cbd5e1", borderLeft: `5px solid ${t.report ? "#22c55e" : "#3b82f6"}`, cursor: isDraggable ? "grab" : "default", opacity: dragTargetId === t.id ? 0.5 : 1, transition: "all 0.2s" }}>
                            
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                              <span style={{ fontWeight: 800, color: "#1e293b", fontSize: 14 }}>{t.time}</span>
                              {isAdmin && <span style={{ fontSize: 11, color: "#fff", background:"#64748b", padding:"2px 6px", borderRadius:4 }}>{tech.name}</span>}
                            </div>
                            
                            <div style={{ color: "#334155", fontWeight:700, fontSize: 13 }}>{cust.name || "未知客戶"}</div>
                            
                            {/* 技師視角：顯示聯絡人 */}
                            {!isAdmin && cust.contact && (
                              <div style={{ fontSize: 12, color: "#475569", marginTop: 6, background:"#f1f5f9", padding:"6px", borderRadius:6 }}>
                                👤 {cust.contact} <br/>📞 <a href={`tel:${cust.phone}`} style={{color:"#0ea5e9", textDecoration:"none", fontWeight:600}}>{cust.phone}</a>
                              </div>
                            )}
                            
                            {/* 回報按鈕 */}
                            {t.techId === session.techId && (
                              <button onClick={() => { setEditing(t); setModals({ report: true }); }} style={{ background: t.report ? "#22c55e" : "#f8fafc", color: t.report ? "#fff" : "#475569", border: t.report ? "none" : "1px solid #cbd5e1", width: "100%", padding: "6px", borderRadius: 6, marginTop: 8, fontSize: 12, cursor: "pointer", fontWeight:600 }}>
                                {t.report ? "已回報 ✓" : "📝 狀態回報"}
                              </button>
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

        {/* --- 介面：客戶 (需求2) --- */}
        {tab === "customers" && isAdmin && (
          <div style={S.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize:18 }}>客戶名單 ({data.customers.length})</h3>
              <label style={{ ...S.b("#0ea5e9", "#fff"), cursor: "pointer" }}> 📂 匯入 CSV (自動過濾重複) <input type="file" accept=".csv" style={{ display: "none" }} onChange={(e) => importCSV(e.target.files[0])} /></label>
            </div>
            <div style={{ background: "#fff", borderRadius: 10, overflow: "hidden", border: "1px solid #e2e8f0" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, textAlign: "left" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", color: "#475569", cursor:"pointer", userSelect:"none" }}>
                    <th style={{ padding: "14px", borderBottom:"2px solid #e2e8f0" }} onClick={() => handleSortCustomer('code')}>編碼 ↕</th>
                    <th style={{ padding: "14px", borderBottom:"2px solid #e2e8f0" }} onClick={() => handleSortCustomer('name')}>客戶名稱 ↕</th>
                    <th style={{ padding: "14px", borderBottom:"2px solid #e2e8f0" }}>地址</th>
                    <th style={{ padding: "14px", borderBottom:"2px solid #e2e8f0" }}>聯絡資訊 / Email連結</th>
                    <th style={{ padding: "14px", borderBottom:"2px solid #e2e8f0", width: 80 }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {data.customers.map((c, i) => (
                    <tr key={c.id} 
                        draggable 
                        onDragStart={() => { setDragType("CUST"); setDragItem(i); }} 
                        onDragOver={(e) => e.preventDefault()} 
                        onDrop={() => {
                          if(dragType !== "CUST") return;
                          const arr = [...data.customers]; const temp = arr[dragItem];
                          arr.splice(dragItem, 1); arr.splice(i, 0, temp);
                          upd("customers", arr); setDragType(null); setDragItem(null);
                        }}
                        style={{ borderBottom: "1px solid #f1f5f9", transition:"background 0.2s" }}
                        onMouseEnter={e=>e.currentTarget.style.background="#f8fafc"}
                        onMouseLeave={e=>e.currentTarget.style.background="#fff"}
                    >
                      <td style={{ padding: "12px 14px" }}>{c.code}</td>
                      <td style={{ padding: "12px 14px", fontWeight: 700, color: "#0f172a" }}>{c.name}</td>
                      <td style={{ padding: "12px 14px", color: "#64748b" }}>{c.address}</td>
                      <td style={{ padding: "12px 14px" }}>
                        <div>{c.contact} {c.phone && <a href={`tel:${c.phone}`} style={{color:"#0ea5e9", textDecoration:"none", fontWeight:600}}>📞 {c.phone}</a>}</div>
                        {c.email && <div style={{marginTop:4}}><a href={`mailto:${c.email}`} style={{color:"#f59e0b", textDecoration:"none", fontSize:12}}>✉️ {c.email}</a></div>}
                      </td>
                      <td style={{ padding: "12px 14px" }}><button onClick={() => { if(window.confirm("確定刪除？")) upd("customers", p => p.filter(x => x.id !== c.id)) }} style={{ color: "#ef4444", background: "rgba(239,68,68,0.1)", padding:"6px 10px", borderRadius:6, border: "none", cursor: "pointer", fontWeight:600 }}>刪除</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* --- Modals 區塊 --- */}

      {/* 指派行程 */}
      <Modal open={modals.task} onClose={() => setModals({})} title={`新增排程 - ${editing.prefillDate}`}>
        <div style={S.f}>
          <label style={S.l}>選擇客戶</label>
          <select style={S.i} onChange={e => setEditing({...editing, customerId: e.target.value})}>
            <option value="">請選擇客戶...</option>
            {data.customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div style={S.f}>
          <label style={S.l}>指派技師</label>
          <select style={S.i} onChange={e => setEditing({...editing, techId: e.target.value})}>
            <option value="">請選擇技師...</option>
            {data.technicians.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div style={S.f}>
          <label style={S.l}>時間</label>
          <input type="time" style={S.i} onChange={e => setEditing({...editing, time: e.target.value})} />
        </div>
        <button onClick={() => {
          if (!editing.customerId || !editing.techId) return alert("客戶與技師為必選");
          const newTask = { id: uid(), date: editing.prefillDate, time: editing.time || "09:00", customerId: editing.customerId, techId: editing.techId };
          upd("tasks", p => [...(p || []), newTask]);
          addLog(`新增了 ${editing.prefillDate} 的行程給 ${data.technicians.find(t=>t.id===editing.techId)?.name}`);
          setModals({});
        }} style={{ ...S.b("#0ea5e9", "#fff"), width: "100%", padding: "12px" }}>確認指派</button>
      </Modal>

      {/* 調整時間 Modal (同日拖曳觸發) */}
      <Modal open={modals.adjustTime} onClose={() => setModals({})} title="修改行程時間">
        <p style={{ fontSize: 14, color: "#64748b", marginBottom: 20 }}>您調整了順序，是否需要順便微調該行程的時間？</p>
        <div style={S.f}>
          <label style={S.l}>新時間設定</label>
          <input type="time" style={S.i} value={editing.time || ""} onChange={e => setEditing({...editing, time: e.target.value})} />
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button onClick={() => setModals({})} style={{ ...S.b("#f1f5f9", "#475569"), flex: 1 }}>不改時間，僅調整順序</button>
          <button onClick={() => {
            upd("tasks", p => {
              const arr = [...p];
              // 找到拖曳對象和目標對象
              const dragIdx = arr.findIndex(x => x.id === editing.id);
              const targetIdx = arr.findIndex(x => x.id === editing.targetId);
              if (dragIdx > -1 && targetIdx > -1) {
                const temp = arr[dragIdx];
                temp.time = editing.time; // 更新時間
                arr.splice(dragIdx, 1);
                arr.splice(targetIdx, 0, temp);
                // 重新賦予順序權重
                arr.filter(x=>x.date===editing.date).forEach((x, i) => { x.order = i; });
              }
              return arr;
            });
            addLog(`調整了行程時間與順序`);
            setModals({});
          }} style={{ ...S.b("#0ea5e9", "#fff"), flex: 1 }}>儲存變更</button>
        </div>
      </Modal>

      {/* 技師回報 Modal */}
      <Modal open={modals.report} onClose={() => setModals({})} title="狀態回報">
        <div style={S.f}>
          <label style={S.l}>現場備註 / 完成狀況</label>
          <textarea rows={4} style={S.i} value={editing.report || ""} onChange={e => setEditing({...editing, report: e.target.value})} placeholder="例如：已完成保養，馬達需更換..." />
        </div>
        <button onClick={() => {
          upd("tasks", p => p.map(t => t.id === editing.id ? { ...t, report: editing.report } : t));
          addLog(`回報了行程進度`);
          setModals({});
        }} style={{ ...S.b("#22c55e", "#fff"), width: "100%", padding: "12px" }}>送出回報</button>
      </Modal>

      {/* 技師管理 Modal (需求5) */}
      <Modal open={modals.tech} onClose={() => setModals({})} title="技師管理模組">
         <p style={{ fontSize: 13, color:"#64748b", marginBottom:15 }}>* 提示：按住技師區塊可上下拖曳調整排序。</p>
         {data.technicians && data.technicians.map((t, idx) => (
           <div key={t.id} 
                draggable 
                onDragStart={() => { setDragType("TECH"); setDragItem(idx); }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if(dragType !== "TECH") return;
                  const arr = [...data.technicians]; const temp = arr[dragItem];
                  arr.splice(dragItem, 1); arr.splice(idx, 0, temp);
                  upd("technicians", arr); setDragType(null); setDragItem(null);
                }}
                style={{ border: "1px solid #e2e8f0", padding: 16, borderRadius: 12, marginBottom: 12, background: t.active ? "#fff" : "#f8fafc", opacity: t.active ? 1 : 0.6, cursor:"grab", boxShadow:"0 2px 5px rgba(0,0,0,0.02)" }}>
              <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                <div style={{ flex: 2 }}><label style={S.l}>姓名</label><input style={S.i} value={t.name} onChange={e => {
                  const n = [...data.technicians]; n[idx].name = e.target.value; upd("technicians", n);
                }} /></div>
                <div style={{ flex: 1 }}><label style={S.l}>指派 PIN 碼</label><input type="password" style={{...S.i, letterSpacing:3}} maxLength={4} value={t.pin} onChange={e => {
                  const n = [...data.technicians]; n[idx].pin = e.target.value.replace(/\D/g,''); upd("technicians", n);
                }} /></div>
              </div>
              <div style={{ display: "flex", gap: 20, background:"#f1f5f9", padding:"8px 12px", borderRadius:8 }}>
                <label style={{ fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontWeight:600 }}>
                  <input type="checkbox" checked={t.isAdmin} onChange={e => {
                    const n = [...data.technicians]; n[idx].isAdmin = e.target.checked; upd("technicians", n);
                  }} /> 👑 設為管理員
                </label>
                <label style={{ fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontWeight:600, color: t.active ? "#22c55e" : "#ef4444" }}>
                  <input type="checkbox" checked={t.active !== false} onChange={e => {
                    const n = [...data.technicians]; n[idx].active = e.target.checked; upd("technicians", n);
                  }} /> {t.active ? "🟢 帳號啟用中" : "🔴 帳號已停用"}
                </label>
              </div>
           </div>
         ))}
         <button onClick={() => setModals({})} style={{ ...S.b("#0ea5e9", "#fff"), width: "100%", padding:"12px", marginTop:10 }}>儲存變更並關閉</button>
      </Modal>

      {/* 系統動態紀錄 Modal */}
      <Modal open={modals.logs} onClose={() => setModals({})} title="系統近期動態追蹤">
        <div style={{ maxHeight: 400, overflowY: "auto", paddingRight: 5 }}>
          {data.logs?.length > 0 ? data.logs.map(l => (
            <div key={l.id} style={{ padding: "12px", borderBottom: "1px solid #e2e8f0", fontSize: 13, display:"flex", gap:10 }}>
              <div style={{ color: "#94a3b8", whiteSpace:"nowrap" }}>{l.time}</div>
              <div><b style={{color:"#0ea5e9"}}>{l.user}</b> {l.msg}</div>
            </div>
          )) : <div style={{ textAlign:"center", padding:30, color:"#94a3b8" }}>尚無活動紀錄</div>}
        </div>
      </Modal>

      {/* 系統設定與備份 Modal (需求8) */}
      <Modal open={modals.cfg} onClose={() => setModals({})} title="系統環境設定">
         <div style={S.f}>
           <label style={S.l}>系統名稱</label>
           <input style={S.i} value={data.appName} onChange={e => upd("appName", e.target.value)} />
         </div>
         <div style={S.f}>
           <label style={S.l}>上傳公司 Logo (將自動轉存)</label>
           <input type="file" accept="image/*" style={{...S.i, padding:"6px"}} onChange={e => {
             if (!e.target.files[0]) return;
             const r = new FileReader(); r.onload = ev => upd("logo", ev.target.result); r.readAsDataURL(e.target.files[0]);
           }} />
         </div>
         <hr style={{ border:"0", borderTop:"1px solid #e2e8f0", margin:"20px 0" }} />
         <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
           <h4 style={{margin:0, color:"#0f172a"}}>系統級備份與還原</h4>
           <p style={{fontSize:12, color:"#64748b", margin:0}}>* 備份檔將包含最完整的排程、客戶與技師資料。</p>
           <button onClick={() => {
             const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
             const url = URL.createObjectURL(blob);
             const a = document.createElement("a"); a.href = url; a.download = `AOT_Backup_${td()}.json`; a.click();
             addLog("下載了系統資料備份");
           }} style={{ ...S.b("#10b981", "#fff"), width: "100%", padding:"12px" }}>💾 點擊下載完整 JSON 備份</button>
           
           <label style={{ ...S.b("#ef4444", "#fff"), width: "100%", padding:"12px", textAlign:"center", cursor:"pointer" }}>
             ⚠️ 上傳還原備份檔 (將覆蓋現有資料)
             <input type="file" accept=".json" style={{ display: "none" }} onChange={(e) => restoreJSON(e.target.files[0])} />
           </label>
         </div>
      </Modal>
    </div>
  );
}
