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
function Login({ techs, adminPin, appName, logo, onLogin }) {
  const [acc, setAcc] = useState(""); const [pin, setPin] = useState(""); const [err, setErr] = useState("");

  const tryLogin = () => {
    const inputAcc = acc.trim().toLowerCase();
    if (inputAcc === "admin") {
      if (pin === adminPin) onLogin({ role: "admin", name: "系統總管", isAdmin: true }); else setErr("密碼錯誤");
      return;
    }
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
          <input type="password" style={{ ...S.i, letterSpacing: 6, fontSize: 18 }} value={pin} onChange={e => setPin(e.target.value)} onKeyDown={e => { if(e.key === "Enter") { e.preventDefault(); tryLogin(); } }} placeholder="••••" />
        </div>
        {err && <div style={{ color: "#ef4444", fontSize: 13, marginBottom: 15, textAlign: "center", fontWeight: 700 }}>{err}</div>}
        <button onClick={tryLogin} style={{ ...S.b("#0ea5e9", "#fff"), width: "100%", padding: "12px", fontSize: 16 }}>登入系統</button>
      </div>
    </div>
  );
}

// --- 主系統 ---
export default function App() {
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

  // 拖曳狀態
  const [dragType, setDragType] = useState(null);
  const [dragItem, setDragItem] = useState(null);
  const [dragOverId, setDragOverId] = useState(null); 

  const ready = useRef(false);

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
  
  // 系統紀錄
  const addLog = (msg) => {
    const newLog = { id: uid(), time: new Date().toLocaleString('zh-TW', {hour12:false}), msg, user: session.name };
    upd("logs", p => [newLog, ...(p || [])].slice(0, 50));
  };

  const gridDates = viewMode === "week" ? weekOf(weekBase) : monthOf(weekBase);
  
  // 排程檢視邏輯 (含 Order 排序)
  const tfd = (ds) => {
    let tasks = data.tasks || [];
    if (!isAdmin) tasks = tasks.filter(t => t.techId === session.techId);
    else if (filterTech !== "ALL") tasks = tasks.filter(t => t.techId === filterTech);
    return tasks.filter(t => t.date === ds).sort((a, b) => {
      if (a.order !== undefined && b.order !== undefined) return a.order - b.order;
      return (a.time || "23:59").localeCompare(b.time || "23:59"); 
    });
  };

  // 標記/取消完成 (包含自動通報)
  const toggleDone = (task) => {
    const isDone = !task.done;
    upd("tasks", p => p.map(t => t.id === task.id ? { ...t, done: isDone } : t));
    const custName = data.customers.find(c => c.id === task.customerId)?.name || "未知客戶";
    addLog(`${isDone ? '✅ 完成了' : '🔄 取消完成'} [${custName}] 的行程`);
  };

  // 無縫拖曳：支援同日排序與跨日移動
  const handleDropTaskToDay = (e, targetDate) => {
    e.preventDefault();
    if (dragType !== "TASK" || !dragItem) return;
    
    upd("tasks", p => {
      let arr = [...p];
      const oldIdx = arr.findIndex(x => x.id === dragItem.id);
      if (oldIdx === -1) return arr;

      const temp = arr.splice(oldIdx, 1)[0];
      temp.date = targetDate; // 無論同日跨日，都更新為目標日期

      if (dragOverId && dragOverId !== dragItem.id) {
        const targetIdx = arr.findIndex(x => x.id === dragOverId);
        if (targetIdx > -1) arr.splice(targetIdx, 0, temp); // 插入到目標上方
        else arr.push(temp);
      } else {
        arr.push(temp); // 若沒對準某個卡片，就放到該天最後
      }

      // 重新刷新目標日期內所有卡片的 order 權重
      arr.filter(x => x.date === targetDate).forEach((x, i) => x.order = i);
      return arr;
    });

    addLog(`調整了行程排期與順序`);
    setDragType(null); setDragItem(null); setDragOverId(null);
  };

  // 客戶匯入
  const importCSV = (file) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = (e) => {
      try {
        const res = Papa.parse(e.target.result, { header: true, skipEmptyLines: true });
        const mapped = res.data.map(r => ({
          id: uid(), name: (r["客戶名稱"] || "").trim(), code: (r["客戶編碼"] || "").trim(),
          address: (r["地址"] || "").trim(), contact: (r["聯絡人"] || "").trim(), phone: (r["電話"] || "").trim(), email: (r["Email"] || "").trim(), active: true
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

  const currentMonthLabel = new Date(weekBase).toLocaleString('zh-TW', { year: 'numeric', month: 'long' });

  return (
    <div style={{ fontFamily: "'Noto Sans TC',sans-serif", background: "#f8fafc", minHeight: "100vh", paddingBottom: 50 }}>
      {saveStatus && (
        <div style={{ position: "fixed", bottom: 12, right: 12, zIndex: 2000, padding: "8px 14px", borderRadius: 8, fontSize: 12, background: "#fff", border: "1px solid #e2e8f0", boxShadow: "0 4px 10px rgba(0,0,0,0.1)" }}>
          {saveStatus === "saving" ? "🔄 同步中..." : saveStatus === "saved" ? "✅ 雲端已同步" : "❌ 同步失敗"}
        </div>
      )}
      
      {/* 導航列 */}
      <div style={{ background: "linear-gradient(135deg,#0c4a6e,#0ea5e9)", padding: "12px 20px", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {data.logo && <img src={data.logo} alt="logo" style={{ height: 32, borderRadius: 4, background:"#fff", padding:2 }} />}
          <b style={{ fontSize: 18, letterSpacing: 1 }}>{data.appName}</b>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {isAdmin && (
            <button onClick={() => setModals({ logs: true })} style={{ background:"rgba(255,255,255,0.15)", border:"none", color:"#fff", cursor:"pointer", padding:"6px 12px", borderRadius:8 }}>
              🔔 動態通知 <span style={{ background:"#ef4444", fontSize:10, padding:"2px 6px", borderRadius:10, marginLeft:4 }}>{data.logs?.length || 0}</span>
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
                {data.technicians.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <button onClick={() => { setEditing({ date: td(), time: "" }); setModals({ task: true }); setSearchCust(""); }} style={S.b("#10b981", "#fff")}>➕ 手動新增排程</button>
            </div>
          )}
        </div>
        
        {/* 頁籤 */}
        <div style={{ display: "flex", gap: 20, borderBottom: "2px solid #e2e8f0", marginBottom: 20 }}>
          <button onClick={() => setTab("schedule")} style={{ padding: "10px 5px", background: "none", border: "none", fontSize: 16, fontWeight: tab === "schedule" ? 800 : 500, color: tab === "schedule" ? "#0ea5e9" : "#64748b", borderBottom: tab === "schedule" ? "3px solid #0ea5e9" : "3px solid transparent", cursor: "pointer" }}>📅 排程總覽</button>
          {isAdmin && <button onClick={() => setTab("customers")} style={{ padding: "10px 5px", background: "none", border: "none", fontSize: 16, fontWeight: tab === "customers" ? 800 : 500, color: tab === "customers" ? "#0ea5e9" : "#64748b", borderBottom: tab === "customers" ? "3px solid #0ea5e9" : "3px solid transparent", cursor: "pointer" }}>👥 客戶管理</button>}
        </div>

        {/* --- 排程視圖 --- */}
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
                  <b style={{ fontSize: 18, color:"#1e293b" }}>{viewMode === "week" ? `${weekDates[0]} ~ ${weekDates[6]}` : currentMonthLabel}</b>
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
                    <div onClick={() => { if(isAdmin) { setEditing({ prefillDate: date, time:"" }); setModals({ task: true }); setSearchCust(""); } }} 
                         style={{ textAlign: "center", borderBottom: isToday ? "1px solid #bae6fd" : "1px solid #f1f5f9", paddingBottom: 6, marginBottom: 8, cursor: isAdmin ? "pointer" : "default" }}>
                      {viewMode === "week" && <div style={{ fontSize: 12, color: isToday ? "#0284c7" : "#64748b", fontWeight:600 }}>週{DN[idx]}</div>}
                      <div style={{ fontSize: viewMode==="week"?22:16, fontWeight: 900, color: isToday ? "#0c4a6e" : "#0f172a" }}>{date.split("-")[2]}</div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: viewMode==="month"?80:"none", overflowY:"auto" }}>
                      {dayTasks.map(t => {
                        const cust = data.customers.find(c => c.id === t.customerId) || {};
                        const tech = data.technicians.find(tc => tc.id === t.techId) || {};
                        const isDraggable = isAdmin || t.techId === session.techId;
                        
                        // 卡片視覺設計 (已完成綠色 / 未完成白色)
                        const cardBg = t.done ? "#f0fdf4" : (t.report ? "#f8fafc" : "#fff");
                        const cardBorder = t.done ? "#bbf7d0" : "#cbd5e1";
                        const cardLeftBorder = t.done ? "#22c55e" : "#3b82f6";

                        return (
                          <div key={t.id} 
                               draggable={isDraggable}
                               onDragStart={() => { setDragType("TASK"); setDragItem(t); }}
                               onDragEnter={() => { if(dragType === "TASK") setDragOverId(t.id); }}
                               style={{ padding: "8px", borderRadius: 8, background: cardBg, border: `1px solid ${cardBorder}`, borderLeft: `5px solid ${cardLeftBorder}`, cursor: isDraggable ? "grab" : "default", opacity: dragOverId === t.id ? 0.4 : 1, transition: "opacity 0.2s" }}>
                            
                            {/* 第一列：時間與技師/編輯按鈕 */}
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                              {t.time ? <span style={{ fontWeight: 800, color: "#1e293b", fontSize: 13 }}>{t.time}</span> : <span />}
                              {isAdmin && (
                                <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                                  <button onClick={() => { setEditing(t); setModals({ task: true }); setSearchCust(""); }} style={{ background:"none", border:"none", cursor:"pointer", padding:0, fontSize:12 }} title="編輯行程">✏️</button>
                                  {viewMode === "week" && <span style={{ fontSize: 10, color: "#fff", background:"#64748b", padding:"2px 4px", borderRadius:4 }}>{tech.name}</span>}
                                </div>
                              )}
                            </div>
                            
                            {/* 客戶名稱 */}
                            <div style={{ color: "#334155", fontWeight:700, fontSize: 13, textDecoration: t.done ? "line-through" : "none", opacity: t.done ? 0.7 : 1 }}>{cust.name || "未知客戶"}</div>
                            
                            {/* 技師視角：聯絡人 */}
                            {!isAdmin && viewMode==="week" && cust.contact && (
                              <div style={{ fontSize: 11, color: "#475569", marginTop: 4, background:"#f1f5f9", padding:"4px", borderRadius:4 }}>
                                👤 {cust.contact} <br/>📞 <a href={`tel:${cust.phone}`} style={{color:"#0ea5e9", textDecoration:"none", fontWeight:600}}>{cust.phone}</a>
                              </div>
                            )}

                            {/* 回報提示 */}
                            {t.report && viewMode==="week" && (
                              <div style={{ fontSize: 11, color:"#64748b", marginTop: 4 }}>📝 有新備註</div>
                            )}
                            
                            {/* 技師操作按鈕 (標記完成/回報) */}
                            {t.techId === session.techId && viewMode==="week" && (
                              <div style={{ display: "flex", gap: 5, marginTop: 8 }}>
                                <button onClick={() => toggleDone(t)} style={{ flex: 1, background: t.done ? "#22c55e" : "#f1f5f9", color: t.done ? "#fff" : "#475569", border: "none", padding: "6px 0", borderRadius: 4, fontSize: 11, cursor: "pointer", fontWeight:700 }}>
                                  {t.done ? "✅ 已完成 (點擊取消)" : "⬜ 標記完成"}
                                </button>
                                <button onClick={() => { setEditing(t); setModals({ report: true }); }} style={{ flex: 1, background: "#f8fafc", color: "#475569", border: "1px solid #cbd5e1", padding: "6px 0", borderRadius: 4, fontSize: 11, cursor: "pointer", fontWeight:600 }}>
                                  📝 備註回報
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
              <h3 style={{ margin: 0, fontSize:18 }}>客戶名單 ({data.customers.length})</h3>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => { setEditing({ active: true, id: uid() }); setModals({ custForm: true }); }} style={S.b("#10b981", "#fff")}>➕ 手動新增客戶</button>
                <label style={{ ...S.b("#0ea5e9", "#fff"), cursor: "pointer" }}> 📂 匯入 CSV <input type="file" accept=".csv" style={{ display: "none" }} onChange={(e) => importCSV(e.target.files[0])} /></label>
              </div>
            </div>
            <div style={{ background: "#fff", borderRadius: 10, overflow: "hidden", border: "1px solid #e2e8f0" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, textAlign: "left" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", color: "#475569" }}>
                    <th style={{ padding: "14px", borderBottom:"2px solid #e2e8f0", width:60 }}>狀態</th>
                    <th style={{ padding: "14px", borderBottom:"2px solid #e2e8f0" }}>編碼</th>
                    <th style={{ padding: "14px", borderBottom:"2px solid #e2e8f0" }}>客戶名稱</th>
                    <th style={{ padding: "14px", borderBottom:"2px solid #e2e8f0" }}>聯絡人資訊</th>
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
                        style={{ borderBottom: "1px solid #f1f5f9", background: c.active === false ? "#f8fafc" : "#fff", opacity: c.active === false ? 0.5 : 1, cursor:"grab" }}>
                      <td style={{ padding: "12px 14px", textAlign:"center" }}>{c.active === false ? "🔴" : "🟢"}</td>
                      <td style={{ padding: "12px 14px" }}>{c.code}</td>
                      <td style={{ padding: "12px 14px", fontWeight: 700, color: "#0f172a" }}>{c.name}</td>
                      <td style={{ padding: "12px 14px" }}>
                        <div>{c.contact} {c.phone && <a href={`tel:${c.phone}`} style={{color:"#0ea5e9", textDecoration:"none", fontWeight:600}}>📞 {c.phone}</a>}</div>
                        {c.email && <div style={{marginTop:4}}><a href={`mailto:${c.email}`} style={{color:"#f59e0b", textDecoration:"none", fontSize:12}}>✉️ Email</a></div>}
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <button onClick={() => { setEditing(c); setModals({ custForm: true }); }} style={{ color: "#0ea5e9", background: "rgba(14,165,233,0.1)", padding:"6px 12px", borderRadius:6, border: "none", cursor: "pointer", fontWeight:600 }}>編輯</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* --- Modals 區塊 --- */}

      {/* 指派/編輯行程 */}
      <Modal open={modals.task} onClose={() => setModals({})} title={editing.id ? "編輯排程" : "新增排程"}>
        <div style={S.f}>
          <label style={S.l}>日期</label>
          <input type="date" style={S.i} value={editing.date || editing.prefillDate || ""} onChange={e => setEditing({...editing, date: e.target.value})} />
        </div>
        <div style={S.f}>
          <label style={S.l}>選擇客戶 (可搜尋)</label>
          <input type="text" placeholder="🔍 輸入名稱或編碼搜尋..." style={{...S.i, marginBottom: 8}} value={searchCust} onChange={e => setSearchCust(e.target.value)} />
          <select style={S.i} value={editing.customerId || ""} onChange={e => setEditing({...editing, customerId: e.target.value})}>
            <option value="">請從選單選擇客戶...</option>
            {data.customers
              .filter(c => c.active !== false && (c.name.includes(searchCust) || (c.code||"").includes(searchCust)))
              .map(c => <option key={c.id} value={c.id}>[{c.code}] {c.name}</option>)}
          </select>
        </div>
        <div style={S.f}>
          <label style={S.l}>指派技師</label>
          <select style={S.i} value={editing.techId || ""} onChange={e => setEditing({...editing, techId: e.target.value})}>
            <option value="">請選擇技師...</option>
            {data.technicians.filter(t=>t.active).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div style={S.f}>
          <label style={S.l}>約定時間 (非必填，空白將不顯示時間)</label>
          <input type="time" style={S.i} value={editing.time || ""} onChange={e => setEditing({...editing, time: e.target.value})} />
        </div>
        
        {/* 若為編輯模式，管理員可直接刪除行程 */}
        {editing.id && (
          <div style={{ textAlign: "right", marginTop: 10, marginBottom: 10 }}>
            <button onClick={() => { if(window.confirm("確定刪除此行程？")) { upd("tasks", p => p.filter(t => t.id !== editing.id)); addLog("刪除了行程"); setModals({}); } }} style={{ background:"none", border:"none", color:"#ef4444", cursor:"pointer", fontSize:13 }}>🗑️ 刪除此行程</button>
          </div>
        )}

        <button onClick={() => {
          if (!editing.customerId || !editing.techId || (!editing.date && !editing.prefillDate)) return alert("日期、客戶與技師為必選");
          const theDate = editing.date || editing.prefillDate;
          const newTask = { id: editing.id || uid(), date: theDate, time: editing.time || "", customerId: editing.customerId, techId: editing.techId, done: editing.done || false, report: editing.report || "", order: editing.order || Date.now() };
          
          if(editing.id) upd("tasks", p => p.map(t => t.id === editing.id ? { ...t, ...newTask } : t));
          else upd("tasks", p => [...(p || []), newTask]);
          
          addLog(`為 ${data.technicians.find(t=>t.id===editing.techId)?.name} ${editing.id ? '更新' : '排定'}了 ${theDate} 的行程`);
          setModals({});
        }} style={{ ...S.b("#0ea5e9", "#fff"), width: "100%", padding: "12px" }}>確認儲存排程</button>
      </Modal>

      {/* 手動客戶表單 */}
      <Modal open={modals.custForm} onClose={() => setModals({})} title={editing.name ? "編輯客戶" : "新增客戶"}>
        <div style={S.f}><label style={S.l}>客戶名稱 (必填)</label><input style={S.i} value={editing.name || ""} onChange={e => setEditing({...editing, name: e.target.value})} /></div>
        <div style={S.f}><label style={S.l}>客戶編碼</label><input style={S.i} value={editing.code || ""} onChange={e => setEditing({...editing, code: e.target.value})} /></div>
        <div style={S.f}><label style={S.l}>地址</label><input style={S.i} value={editing.address || ""} onChange={e => setEditing({...editing, address: e.target.value})} /></div>
        <div style={{ display: "flex", gap:10, marginBottom:12 }}>
          <div style={{flex:1}}><label style={S.l}>聯絡人</label><input style={S.i} value={editing.contact || ""} onChange={e => setEditing({...editing, contact: e.target.value})} /></div>
          <div style={{flex:1}}><label style={S.l}>電話</label><input style={S.i} value={editing.phone || ""} onChange={e => setEditing({...editing, phone: e.target.value})} /></div>
        </div>
        <div style={S.f}><label style={S.l}>Email</label><input style={S.i} value={editing.email || ""} onChange={e => setEditing({...editing, email: e.target.value})} /></div>
        <div style={S.f}>
          <label style={{ fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontWeight:700, background:"#f1f5f9", padding:10, borderRadius:8 }}>
            <input type="checkbox" checked={editing.active !== false} onChange={e => setEditing({...editing, active: e.target.checked})} style={{transform:"scale(1.2)"}} /> 
            {editing.active !== false ? "🟢 啟用此客戶" : "🔴 停用此客戶 (將從排程選單隱藏)"}
          </label>
        </div>
        <button onClick={() => {
          if (!editing.name) return alert("請輸入客戶名稱");
          const isExist = data.customers.find(c => c.id === editing.id);
          if (isExist) upd("customers", p => p.map(c => c.id === editing.id ? editing : c));
          else upd("customers", p => [editing, ...p]);
          addLog(`手動更新了客戶資料: ${editing.name}`);
          setModals({});
        }} style={{ ...S.b("#10b981", "#fff"), width: "100%", padding: "12px" }}>儲存客戶資料</button>
      </Modal>

      {/* 技師文字回報 Modal */}
      <Modal open={modals.report} onClose={() => setModals({})} title="填寫狀態備註">
        <div style={S.f}><label style={S.l}>現場備註 / 處理狀況</label><textarea rows={5} style={S.i} value={editing.report || ""} onChange={e => setEditing({...editing, report: e.target.value})} placeholder="例如：已完成保養，建議下次更換馬達..." /></div>
        <button onClick={() => {
          upd("tasks", p => p.map(t => t.id === editing.id ? { ...t, report: editing.report } : t));
          addLog(`回報了行程備註`);
          setModals({});
        }} style={{ ...S.b("#0ea5e9", "#fff"), width: "100%", padding: "12px" }}>送出備註</button>
      </Modal>

      {/* 技師管理 Modal */}
      <Modal open={modals.tech} onClose={() => setModals({})} title="技師管理模組">
         <p style={{ fontSize: 13, color:"#64748b", marginBottom:15 }}>* 提示：按住技師區塊可上下拖曳調整顯示排序。</p>
         {data.technicians && data.technicians.map((t, idx) => (
           <div key={t.id} draggable onDragStart={() => { setDragType("TECH"); setDragItem(idx); }} onDragOver={(e) => e.preventDefault()} onDrop={() => {
                  if(dragType !== "TECH") return;
                  const arr = [...data.technicians]; const temp = arr[dragItem];
                  arr.splice(dragItem, 1); arr.splice(idx, 0, temp);
                  upd("technicians", arr); setDragType(null); setDragItem(null);
                }}
                style={{ border: "1px solid #e2e8f0", padding: 16, borderRadius: 12, marginBottom: 12, background: t.active ? "#fff" : "#f8fafc", opacity: t.active ? 1 : 0.6, cursor:"grab" }}>
              <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                <div style={{ flex: 2 }}><label style={S.l}>姓名</label><input style={S.i} value={t.name} onChange={e => { const n = [...data.technicians]; n[idx].name = e.target.value; upd("technicians", n); }} /></div>
                <div style={{ flex: 1 }}><label style={S.l}>PIN 碼</label><input type="password" style={{...S.i, letterSpacing:3}} maxLength={4} value={t.pin} onChange={e => { const n = [...data.technicians]; n[idx].pin = e.target.value.replace(/\D/g,''); upd("technicians", n); }} /></div>
              </div>
              <div style={{ display: "flex", gap: 20, background:"#f1f5f9", padding:"8px 12px", borderRadius:8 }}>
                <label style={{ fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontWeight:600 }}>
                  <input type="checkbox" checked={t.isAdmin} onChange={e => { const n = [...data.technicians]; n[idx].isAdmin = e.target.checked; upd("technicians", n); }} /> 👑 設為管理員
                </label>
                <label style={{ fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontWeight:600, color: t.active ? "#22c55e" : "#ef4444" }}>
                  <input type="checkbox" checked={t.active !== false} onChange={e => { const n = [...data.technicians]; n[idx].active = e.target.checked; upd("technicians", n); }} /> {t.active ? "🟢 帳號啟用中" : "🔴 帳號已停用"}
                </label>
              </div>
           </div>
         ))}
         <button onClick={() => setModals({})} style={{ ...S.b("#0ea5e9", "#fff"), width: "100%", padding:"12px", marginTop:10 }}>儲存變更並關閉</button>
      </Modal>

      {/* 系統動態紀錄 Modal */}
      <Modal open={modals.logs} onClose={() => setModals({})} title="系統近期動態追蹤">
        <div style={{ display:"flex", justifyContent:"flex-end", marginBottom: 15 }}>
          <button onClick={() => { if(window.confirm("確定要清空所有紀錄嗎？")) upd("logs", []); }} style={{...S.b("none", "#ef4444"), border:"1px solid #ef4444", padding:"6px 10px", fontSize:12}}>🗑️ 清除全部已讀紀錄</button>
        </div>
        <div style={{ maxHeight: 400, overflowY: "auto", paddingRight: 5 }}>
          {data.logs?.length > 0 ? data.logs.map(l => (
            <div key={l.id} style={{ padding: "14px 12px", borderBottom: "1px solid #e2e8f0", fontSize: 14, display:"flex", gap:10 }}>
              <div style={{ color: "#94a3b8", whiteSpace:"nowrap", fontSize:12 }}>{l.time}</div>
              <div style={{ lineHeight:1.4 }}><b style={{color:"#0ea5e9"}}>{l.user}</b> {l.msg}</div>
            </div>
          )) : <div style={{ textAlign:"center", padding:40, color:"#94a3b8", fontSize:15 }}>✅ 目前尚無任何新動態</div>}
        </div>
      </Modal>

      {/* 系統設定 Modal */}
      <Modal open={modals.cfg} onClose={() => setModals({})} title="系統環境設定">
         <div style={S.f}><label style={S.l}>系統名稱</label><input style={S.i} value={data.appName} onChange={e => upd("appName", e.target.value)} /></div>
         <div style={S.f}><label style={S.l}>上傳公司 Logo</label><input type="file" accept="image/*" style={{...S.i, padding:"6px"}} onChange={e => { if (!e.target.files[0]) return; const r = new FileReader(); r.onload = ev => upd("logo", ev.target.result); r.readAsDataURL(e.target.files[0]); }} /></div>
         <hr style={{ border:"0", borderTop:"1px solid #e2e8f0", margin:"20px 0" }} />
         <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
           <h4 style={{margin:0, color:"#0f172a"}}>備份與還原</h4>
           <button onClick={() => {
             const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
             const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `AOT_Backup_${td()}.json`; a.click();
             addLog("下載了系統資料備份");
           }} style={{ ...S.b("#10b981", "#fff"), width: "100%", padding:"12px" }}>💾 點擊下載完整 JSON 備份</button>
         </div>
      </Modal>
    </div>
  );
}
