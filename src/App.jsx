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

function Modal({ open, onClose, title, children, width = 600 }) {
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,15,30,.6)", backdropFilter: "blur(4px)" }} onMouseDown={onClose}>
      <div onMouseDown={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, padding: "24px", width: width, maxWidth: "95vw", maxHeight: "85vh", overflowY: "auto", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)", display:"flex", flexDirection:"column" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 18, color: "#0f172a" }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", color: "#94a3b8", padding:0, lineHeight:1 }}>×</button>
        </div>
        <div style={{ overflowY:"auto", flex:1, paddingRight:5 }}>{children}</div>
      </div>
    </div>
  );
}

// --- 登入模組 (修復 Lag 與 alert 問題) ---
function Login({ techs = [], adminPin, appName, logo, onLogin }) {
  const [acc, setAcc] = useState(""); 
  const [pin, setPin] = useState(""); 
  const [err, setErr] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  const tryLogin = () => {
    setErr("");
    const inputAcc = acc.trim().toLowerCase();
    if (inputAcc === "admin") {
      if (pin === adminPin) onLogin({ role: "admin", name: "系統總管", isAdmin: true }); else setErr("密碼錯誤");
      return;
    }
    const safeTechs = Array.isArray(techs) ? techs : [];
    const t = safeTechs.find(x => x && x.name && x.name.toLowerCase() === inputAcc);
    if (t) {
      if (t.active === false) setErr("此帳號已離職/停用");
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
          <div style={{ position: "relative" }}>
            <input type={showPwd ? "text" : "password"} style={{ ...S.i, letterSpacing: showPwd ? 2 : 6, fontSize: 18, paddingRight: 40 }} value={pin} onChange={e => setPin(e.target.value)} onKeyDown={e => { if(e.key === "Enter") { e.preventDefault(); tryLogin(); } }} placeholder="••••" />
            <button onClick={() => setShowPwd(!showPwd)} style={{ position: "absolute", right: 10, top: 10, background: "none", border: "none", cursor: "pointer", fontSize: 16 }}>{showPwd ? "🙈" : "👁️"}</button>
          </div>
        </div>
        {err && <div style={{ color: "#ef4444", fontSize: 13, marginBottom: 15, textAlign: "center", fontWeight: 700, background:"#fef2f2", padding:8, borderRadius:8 }}>{err}</div>}
        <button onClick={tryLogin} style={{ ...S.b("#0ea5e9", "#fff"), width: "100%", padding: "12px", fontSize: 16, marginBottom: 15 }}>登入系統</button>
        <div style={{ textAlign: "center" }}>
          <button onClick={() => setShowForgot(!showForgot)} style={{ background: "none", border: "none", color: "#64748b", fontSize: 13, textDecoration: "underline", cursor: "pointer" }}>忘記密碼？</button>
          {showForgot && <div style={{ marginTop: 10, fontSize: 12, color: "#ef4444", background:"#f8fafc", padding:10, borderRadius:8 }}>請聯繫系統管理員於後台為您重設。</div>}
        </div>
      </div>
    </div>
  );
}

// --- 卡片組件 (內建直覺回報與打勾功能) ---
function TaskCard({ t, view, isAdmin, session, safeCusts, safeTechs, safeServices, upd, addLog, dragType, setDragType, dragItem, setDragItem, dragOverId, setDragOverId, setEditing, setModals }) {
  const [localReport, setLocalReport] = useState(t.report || "");
  useEffect(() => { setLocalReport(t.report || ""); }, [t.report]);

  const cust = safeCusts.find(c => c && c.id === t.customerId) || {};
  const tech = safeTechs.find(tc => tc && tc.id === t.techId) || {};
  const tag = safeServices.find(s => s.id === t.serviceId) || safeServices[0];
  const isDraggable = isAdmin || t.techId === session.techId;
  const isMyTask = isAdmin || t.techId === session.techId;

  const toggleDone = () => {
      const isDone = !t.done;
      upd("tasks", p => p.map(x => x.id === t.id ? { ...x, done: isDone } : x));
      addLog(`${isDone ? '✅ 完成了' : '🔄 重做/取消完成'} [${cust.name || "未知"}] 的行程`);
  };

  const handleBlur = () => {
      if (localReport !== (t.report || "")) {
          upd("tasks", p => p.map(x => x.id === t.id ? { ...x, report: localReport } : x));
          addLog(`更新了行程備註`);
      }
  };

  // 月視圖的小卡片
  if (view === "month") {
      return (
          <div draggable={isDraggable} onDragStart={() => { setDragType("TASK"); setDragItem(t); }} onDragEnter={() => { if(dragType==="TASK") setDragOverId(t.id); }}
               style={{ padding: "6px", borderRadius: 4, background: t.done ? "#f0fdf4" : "#fff", borderLeft: `4px solid ${t.done ? "#22c55e" : (tag?.color || "#3b82f6")}`, fontSize: 11, border: "1px solid #cbd5e1", opacity: dragOverId === t.id ? 0.4 : 1, cursor: "grab", marginBottom: 4 }}>
              <div style={{fontWeight:700, textDecoration: t.done ? "line-through" : "none", color: t.done ? "#64748b" : "#0f172a"}}>{t.time ? t.time + " " : ""}{cust.name || "未知"}</div>
              {isAdmin && <div style={{color:"#64748b", marginTop:2}}>👷‍♂️ {tech.name}</div>}
          </div>
      );
  }

  // 週視圖與放大日視圖的大卡片
  return (
      <div draggable={isDraggable} onDragStart={() => { setDragType("TASK"); setDragItem(t); }} onDragEnter={() => { if(dragType==="TASK") setDragOverId(t.id); }}
           style={{ padding: "12px", borderRadius: 8, background: t.done ? "#f0fdf4" : "#fff", border: `1px solid ${t.done ? "#bbf7d0" : "#cbd5e1"}`, borderLeft: `6px solid ${t.done ? "#22c55e" : (tag?.color || "#3b82f6")}`, cursor: "grab", opacity: dragOverId === t.id ? 0.4 : 1, marginBottom: 10, boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
          
          {/* 標頭區 */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontWeight: 900, color: "#0f172a", fontSize: 15 }}>{t.time || "待確認/全天"}</span>
                  {tag && <span style={{fontSize:11, color:tag.color, background:tag.bg, padding:"2px 8px", borderRadius:12, fontWeight:700}}>{tag.label}</span>}
              </div>
              {isAdmin && (
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <button onClick={(e) => { e.stopPropagation(); setEditing({...t, repeat:"none"}); setModals({ taskForm: true }); }} style={{ background:"none", border:"none", cursor:"pointer", padding:0, fontSize:14 }} title="編輯排程設定">✏️</button>
                      <span style={{ fontSize: 11, color: "#fff", background:"#64748b", padding:"4px 8px", borderRadius:6, fontWeight:600 }}>{tech.name}</span>
                  </div>
              )}
          </div>
          
          {/* 客戶名稱 */}
          <div style={{ color: "#0f172a", fontWeight:800, fontSize: 15, textDecoration: t.done ? "line-through" : "none", marginBottom: 8 }}>
              {cust.name || "未知客戶"} {cust.active === false && <span style={{color:"#ef4444", fontSize:11}}>(已停用)</span>}
          </div>

          {/* 詳細資訊區 */}
          <div style={{ fontSize: 12, color: "#475569", background:"#f8fafc", padding:"10px", borderRadius:8, border:"1px solid #f1f5f9" }}>
              {/* 地址與導航 */}
              {cust.address && (
                <div style={{marginBottom:6, display:"flex", alignItems:"flex-start", gap:4}}>
                  <span>📍</span>
                  <div>
                    <span>{cust.address}</span>
                    <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cust.address)}`} target="_blank" rel="noreferrer" style={{color:"#fff", background:"#3b82f6", fontWeight:600, textDecoration:"none", marginLeft:8, padding:"2px 8px", borderRadius:4, fontSize:11, display:"inline-block"}}>導航</a>
                  </div>
                </div>
              )}
              
              {/* 聯絡人區塊 (技師只能看現場) */}
              <div style={{display:"flex", flexDirection:"column", gap:6, marginTop:6}}>
                  {(!isAdmin || cust.siteContact || cust.sitePhone) && (
                      <div style={{display:"flex", flexWrap:"wrap", alignItems:"center", gap:6}}>
                          <span>👤 現場:</span> 
                          <b style={{color:"#0f172a"}}>{cust.siteContact} {cust.sitePhone}</b>
                          {cust.sitePhone && (
                            <>
                              <a href={`tel:${cust.sitePhone}`} style={{color:"#fff", background:"#0ea5e9", textDecoration:"none", padding:"2px 8px", borderRadius:4, fontSize:11, fontWeight:600}}>📞 撥打</a> 
                              <a href={`https://wa.me/${cust.sitePhone.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" style={{color:"#fff", background:"#22c55e", textDecoration:"none", padding:"2px 8px", borderRadius:4, fontSize:11, fontWeight:600}}>💬 WA</a>
                            </>
                          )}
                      </div>
                  )}
                  {isAdmin && (cust.contact || cust.phone) && (
                      <div style={{display:"flex", flexWrap:"wrap", alignItems:"center", gap:6, borderTop:"1px dashed #e2e8f0", paddingTop:6}}>
                          <span style={{color:"#94a3b8"}}>主聯絡人:</span> 
                          <b>{cust.contact} {cust.phone}</b>
                      </div>
                  )}
              </div>
              {cust.remarks && <div style={{marginTop:8, color:"#dc2626", fontWeight:600, background:"#fef2f2", padding:"4px 8px", borderRadius:4}}>⚠️ 客戶備註：{cust.remarks}</div>}
          </div>

          {/* 互動回報區 (免視窗直接輸入) */}
          {isMyTask && (
              <div style={{ marginTop: 12, borderTop: "1px dashed #cbd5e1", paddingTop: 12 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 10, userSelect: "none" }}>
                      <input type="checkbox" checked={t.done} onChange={toggleDone} style={{ transform: "scale(1.5)", cursor: "pointer" }} />
                      <span style={{ fontWeight: 800, color: t.done ? '#22c55e' : '#64748b', fontSize:14 }}>{t.done ? '✅ 已完成 (點擊取消/Redo)' : '標記為完成'}</span>
                  </label>
                  <input 
                      type="text" 
                      placeholder="📝 點此直接輸入回報備註，輸入完點擊旁邊自動儲存..." 
                      value={localReport}
                      onChange={(e) => setLocalReport(e.target.value)}
                      onBlur={handleBlur}
                      style={{ width: "100%", padding: "10px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 13, boxSizing: "border-box", background: t.done ? "#f0fdf4" : "#fff" }}
                  />
              </div>
          )}
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
  const [selectedCusts, setSelectedCusts] = useState([]); 

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
      } else { arr.push(temp); }
      arr.filter(x => x && x.date === targetDate).forEach((x, i) => { if(x) x.order = i; });
      return arr;
    });

    addLog(`拖曳調整了行程排期與順序`);
    setDragType(null); setDragItem(null); setDragOverId(null);
  };

  const handleSortCustomer = (key) => {
    let direction = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') direction = 'descending';
    setSortConfig({ key, direction });
    const sorted = [...safeCusts].sort((a, b) => {
      let valA = a[key] || ""; let valB = b[key] || "";
      if (key === 'code') return direction === 'ascending' ? valA.localeCompare(valB, undefined, {numeric:true}) : valB.localeCompare(valA, undefined, {numeric:true});
      if (valA < valB) return direction === 'ascending' ? -1 : 1;
      if (valA > valB) return direction === 'ascending' ? 1 : -1;
      return 0;
    });
    upd("customers", sorted);
  };

  const toggleCustSelect = (id) => setSelectedCusts(p => p.includes(id) ? p.filter(x=>x!==id) : [...p, id]);
  const toggleAllCusts = () => {
    if(selectedCusts.length === safeCusts.length) setSelectedCusts([]);
    else setSelectedCusts(safeCusts.map(c=>c.id));
  };
  const deleteSelectedCusts = () => {
    if(selectedCusts.length === 0) return;
    if(window.confirm(`確定要刪除這 ${selectedCusts.length} 筆客戶資料嗎？此動作不可逆！`)) {
      upd("customers", p => p.filter(c => !selectedCusts.includes(c.id)));
      setSelectedCusts([]); addLog(`批次刪除了 ${selectedCusts.length} 筆客戶`);
    }
  };

  const importCSV = (file) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = (e) => {
      try {
        const res = Papa.parse(e.target.result, { header: true, skipEmptyLines: true });
        const mapped = res.data.map(r => ({
          id: uid(), active: true,
          name: String(r["客戶名稱"] || "").trim(),
          code: String(r["編碼"] || "").trim(),
          address: String(r["地址"] || "").trim(),
          contact: String(r["聯絡人"] || "").trim(),
          phone: String(r["聯絡人電話"] || "").trim(),
          siteContact: String(r["現場聯絡人"] || "").trim(),
          sitePhone: String(r["現場聯絡人電話"] || "").trim(),
          fax: String(r["Fax"] || "").trim(),
          email: String(r["Email"] || "").trim(),
          remarks: String(r["備註"] || "").trim(),
        })).filter(c => c.name);
        
        const existSet = new Set(safeCusts.map(c => c ? String(c.name || "") + String(c.code || "") : ""));
        const newCusts = mapped.filter(c => !existSet.has(c.name + c.code));
        upd("customers", p => [...(p || []), ...newCusts]);
        addLog(`匯入了 ${newCusts.length} 筆客戶資料`);
      } catch (err) { }
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
              🔔 通知 {unreadLogs > 0 && <span style={{ background:"#ef4444", fontSize:10, padding:"2px 6px", borderRadius:10, marginLeft:4 }}>{unreadLogs}</span>}
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
                {safeTechs.map(t => t ? <option key={t.id} value={t.id}>{t.name} {t.active===false?"(離職)":""}</option> : null)}
              </select>
              <button onClick={() => { setEditing({ date: td(), time: "", serviceId: "mt", repeat: "none", repeatCount: 6 }); setModals({ taskForm: true }); setSearchCust(""); }} style={S.b("#10b981", "#fff")}>➕ 新增排程</button>
            </div>
          )}
        </div>
        
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
                  <b style={{ fontSize: 18, color:"#1e293b" }}>{viewMode === "week" ? `${gridDates[0]} ~ ${gridDates[6]}` : currentMonthLabel}</b>
                  <input type="date" value={weekBase} onChange={(e) => { if(e.target.value) setWeekBase(e.target.value); }} style={{ padding:"6px", borderRadius:6, border:"1px solid #cbd5e1", cursor:"pointer" }} title="快速跳轉日期" />
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
                           else if(isAdmin) { setEditing({ prefillDate: date, time:"", serviceId: "mt", repeat: "none", repeatCount: 6 }); setModals({ taskForm: true }); setSearchCust(""); }
                         }} 
                         style={{ textAlign: "center", borderBottom: isToday ? "1px solid #bae6fd" : "1px solid #f1f5f9", paddingBottom: 6, marginBottom: 8, cursor: "pointer", background:viewMode==="month"?"#f1f5f9":"transparent", borderRadius:6 }}
                         title={viewMode === "month" ? "點擊放大查看當日" : "點擊新增行程"}>
                      {viewMode === "week" && <div style={{ fontSize: 12, color: isToday ? "#0284c7" : "#64748b", fontWeight:600 }}>週{DN[idx]}</div>}
                      <div style={{ fontSize: viewMode==="week"?22:16, fontWeight: 900, color: isToday ? "#0c4a6e" : "#0f172a", padding: viewMode==="month"?"4px 0":0 }}>
                        {date.split("-")[2]} {viewMode==="month" && <span style={{fontSize:10, color:"#0ea5e9", marginLeft:4}}>🔍放大</span>}
                      </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: viewMode==="month"?100:"none", overflowY:"auto" }}>
                      {dayTasks.map(t => <TaskCard key={t.id} t={t} view={viewMode} isAdmin={isAdmin} session={session} safeCusts={safeCusts} safeTechs={safeTechs} safeServices={safeServices} upd={upd} addLog={addLog} dragType={dragType} setDragType={setDragType} dragItem={dragItem} setDragItem={setDragItem} dragOverId={dragOverId} setDragOverId={setDragOverId} setEditing={setEditing} setModals={setModals} />)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* --- 介面：客戶 (嚴格依照11欄位) --- */}
        {tab === "customers" && isAdmin && (
          <div style={S.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize:18 }}>客戶名單 ({safeCusts.length})</h3>
              <div style={{ display: "flex", gap: 10, alignItems:"center" }}>
                {selectedCusts.length > 0 && <button onClick={deleteSelectedCusts} style={{...S.b("#ef4444", "#fff")}}>🗑️ 刪除已選 ({selectedCusts.length})</button>}
                <button onClick={() => { setEditing({ active: true, id: uid() }); setModals({ custForm: true }); }} style={S.b("#10b981", "#fff")}>➕ 新增客戶</button>
                <label style={{ ...S.b("#0ea5e9", "#fff"), cursor: "pointer" }}> 📂 匯入 CSV <input type="file" accept=".csv" style={{ display: "none" }} onChange={(e) => importCSV(e.target.files[0])} /></label>
              </div>
            </div>
            <div style={{ background: "#fff", borderRadius: 10, overflow: "hidden", border: "1px solid #e2e8f0", overflowX:"auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "left", whiteSpace:"nowrap" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", color: "#475569", userSelect:"none" }}>
                    <th style={{ padding: "12px", borderBottom:"2px solid #e2e8f0", textAlign:"center" }}><input type="checkbox" checked={selectedCusts.length === safeCusts.length && safeCusts.length>0} onChange={toggleAllCusts} style={{cursor:"pointer", transform:"scale(1.2)"}}/></th>
                    <th style={{ padding: "12px", borderBottom:"2px solid #e2e8f0" }}>狀態</th>
                    <th style={{ padding: "12px", borderBottom:"2px solid #e2e8f0", cursor:"pointer" }} onClick={() => handleSortCustomer('code')}>編碼 ↕</th>
                    <th style={{ padding: "12px", borderBottom:"2px solid #e2e8f0", cursor:"pointer" }} onClick={() => handleSortCustomer('name')}>客戶名稱 ↕</th>
                    <th style={{ padding: "12px", borderBottom:"2px solid #e2e8f0" }}>地址</th>
                    <th style={{ padding: "12px", borderBottom:"2px solid #e2e8f0" }}>聯絡人</th>
                    <th style={{ padding: "12px", borderBottom:"2px solid #e2e8f0" }}>聯絡人電話</th>
                    <th style={{ padding: "12px", borderBottom:"2px solid #e2e8f0" }}>現場聯絡人</th>
                    <th style={{ padding: "12px", borderBottom:"2px solid #e2e8f0" }}>現場聯絡人電話</th>
                    <th style={{ padding: "12px", borderBottom:"2px solid #e2e8f0" }}>Fax</th>
                    <th style={{ padding: "12px", borderBottom:"2px solid #e2e8f0" }}>Email</th>
                    <th style={{ padding: "12px", borderBottom:"2px solid #e2e8f0" }}>備註</th>
                    <th style={{ padding: "12px", borderBottom:"2px solid #e2e8f0" }}>操作</th>
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
                        <td style={{ padding: "10px 12px", textAlign:"center" }}><input type="checkbox" checked={selectedCusts.includes(c.id)} onChange={() => toggleCustSelect(c.id)} style={{cursor:"pointer", transform:"scale(1.2)"}}/></td>
                        <td style={{ padding: "10px 12px" }}>{c.active === false ? "🔴 停用" : "🟢 啟用"}</td>
                        <td style={{ padding: "10px 12px" }}>{c.code}</td>
                        <td style={{ padding: "10px 12px", fontWeight: 700, color: "#0f172a" }}>{c.name}</td>
                        <td style={{ padding: "10px 12px" }}>{c.address}</td>
                        <td style={{ padding: "10px 12px" }}>{c.contact}</td>
                        <td style={{ padding: "10px 12px" }}>{c.phone}</td>
                        <td style={{ padding: "10px 12px" }}>{c.siteContact}</td>
                        <td style={{ padding: "10px 12px" }}>{c.sitePhone}</td>
                        <td style={{ padding: "10px 12px" }}>{c.fax}</td>
                        <td style={{ padding: "10px 12px" }}>{c.email}</td>
                        <td style={{ padding: "10px 12px", maxWidth:150, overflow:"hidden", textOverflow:"ellipsis", color:"#64748b" }}>{c.remarks}</td>
                        <td style={{ padding: "10px 12px" }}>
                          <button onClick={() => { setEditing({...c, _prevActive: c.active}); setModals({ custForm: true }); }} style={{ color: "#0ea5e9", background: "rgba(14,165,233,0.1)", padding:"6px 12px", borderRadius:6, border: "none", cursor: "pointer", fontWeight:600 }}>編輯</button>
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

      {/* --- Modals 彈窗區 --- */}

      {/* 🔍 日視圖 Modal (月視圖點擊放大，支援內部上下拖曳調換順序) */}
      <Modal open={modals.dayView} onClose={() => setModals({})} title={`🔍 ${modals.dayView} 詳細排程`} width={600}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, minHeight:"200px" }}
             onDragOver={(e) => { e.preventDefault(); if (dragType === "TASK") e.dataTransfer.dropEffect = "move"; }} 
             onDrop={(e) => handleDropTaskToDay(e, modals.dayView)}>
          {tfd(modals.dayView).length === 0 ? <div style={{textAlign:"center", color:"#64748b", padding:20, background:"#f1f5f9", borderRadius:8}}>這天沒有排程喔！</div> : 
           tfd(modals.dayView).map(t => <TaskCard key={t.id} t={t} view="day" isAdmin={isAdmin} session={session} safeCusts={safeCusts} safeTechs={safeTechs} safeServices={safeServices} upd={upd} addLog={addLog} dragType={dragType} setDragType={setDragType} dragItem={dragItem} setDragItem={setDragItem} dragOverId={dragOverId} setDragOverId={setDragOverId} setEditing={setEditing} setModals={setModals} />)
          }
        </div>
      </Modal>

      {/* ✏️ 指派/編輯行程表單 */}
      <Modal open={modals.taskForm} onClose={() => setModals({})} title={editing.id ? "編輯排程設定" : "新增排程"}>
        <div style={S.f}><label style={S.l}>日期</label><input type="date" style={S.i} value={editing.date || editing.prefillDate || ""} onChange={e => setEditing({...editing, date: e.target.value})} /></div>
        <div style={S.f}>
          <label style={S.l}>服務類型</label>
          <div style={{display:"flex", gap:8, flexWrap:"wrap"}}>
            {safeServices.map(s => (
              <button key={s.id} onClick={() => setEditing({...editing, serviceId: s.id})} style={{ padding:"6px 12px", borderRadius:20, border:`1px solid ${s.color}`, background: editing.serviceId === s.id ? s.color : "#fff", color: editing.serviceId === s.id ? "#fff" : s.color, cursor:"pointer", fontWeight:600, fontSize:12 }}>{s.label}</button>
            ))}
          </div>
        </div>
        <div style={S.f}>
          <label style={S.l}>選擇客戶 (可輸入名稱或編碼過濾)</label>
          <input type="text" placeholder="🔍 快速過濾..." style={{...S.i, marginBottom: 8}} value={searchCust} onChange={e => setSearchCust(e.target.value)} />
          <select style={S.i} value={editing.customerId || ""} onChange={e => setEditing({...editing, customerId: e.target.value})}>
            <option value="">請從下方選單選擇...</option>
            {safeCusts.filter(c => c && c.active !== false && (String(c.name||"").toLowerCase().includes(safeSearch) || String(c.code||"").toLowerCase().includes(safeSearch))).map(c => <option key={c.id} value={c.id}>[{c.code}] {c.name}</option>)}
          </select>
        </div>
        <div style={S.f}><label style={S.l}>指派技師</label><select style={S.i} value={editing.techId || ""} onChange={e => setEditing({...editing, techId: e.target.value})}><option value="">請選擇...</option>{safeTechs.filter(t=>t&&t.active).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
        <div style={S.f}><label style={S.l}>約定時間 (可留空)</label><input type="time" style={S.i} value={editing.time || ""} onChange={e => setEditing({...editing, time: e.target.value})} /></div>
        
        {!editing.id && (
          <div style={{ background: "#f0f9ff", padding: 15, borderRadius: 8, marginBottom: 15, border: "1px solid #bae6fd" }}>
            <label style={S.l}>🔄 循環定期排程</label>
            <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
              {["none", "weekly", "biweekly", "monthly"].map(opt => {
                const labels = { none: "單次", weekly: "每週", biweekly: "雙週", monthly: "每月" };
                return <label key={opt} style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}><input type="radio" checked={editing.repeat === opt} onChange={() => setEditing({...editing, repeat: opt})} /> {labels[opt]}</label>;
              })}
            </div>
            {editing.repeat !== "none" && (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 13, color: "#475569" }}>產生</span><input type="number" min="2" max="24" style={{...S.i, width: 80, padding:"6px"}} value={editing.repeatCount || 6} onChange={e => setEditing({...editing, repeatCount: Number(e.target.value)})} /><span style={{ fontSize: 13, color: "#475569" }}>期</span>
              </div>
            )}
          </div>
        )}
        
        {editing.id && <div style={{ textAlign: "right", marginTop: 10, marginBottom: 10 }}><button onClick={() => { if(window.confirm("確定刪除此行程？")) { upd("tasks", p => p.filter(t => t.id !== editing.id)); addLog("刪除了行程"); setModals({}); } }} style={{ background:"none", border:"none", color:"#ef4444", cursor:"pointer", fontSize:13, fontWeight:700 }}>🗑️ 刪除此行程</button></div>}

        <button onClick={() => {
          if (!editing.customerId || !editing.techId || (!editing.date && !editing.prefillDate)) return; // 靜默防呆
          const baseDateStr = editing.date || editing.prefillDate;
          if (editing.id || editing.repeat === "none" || !editing.repeat) {
             const newTask = { id: editing.id || uid(), date: baseDateStr, time: editing.time || "", customerId: editing.customerId, techId: editing.techId, serviceId: editing.serviceId || "mt", done: editing.done || false, report: editing.report || "", order: editing.order || Date.now() };
             if(editing.id) upd("tasks", p => p.map(t => t.id === editing.id ? { ...t, ...newTask } : t)); else upd("tasks", p => [...(p || []), newTask]);
             addLog(`排定了 ${baseDateStr} 的行程`);
          } else {
             let generatedTasks = []; let baseDate = new Date(baseDateStr); let count = editing.repeatCount || 6;
             for (let i = 0; i < count; i++) {
                let d = new Date(baseDate);
                if (editing.repeat === "weekly") d.setDate(d.getDate() + (i * 7));
                if (editing.repeat === "biweekly") d.setDate(d.getDate() + (i * 14));
                if (editing.repeat === "monthly") d.setMonth(d.getMonth() + i);
                generatedTasks.push({ id: uid(), date: d.toISOString().split("T")[0], time: editing.time || "", customerId: editing.customerId, techId: editing.techId, serviceId: editing.serviceId || "mt", done: false, report: "", order: Date.now() + i });
             }
             upd("tasks", p => [...(p || []), ...generatedTasks]); addLog(`自動產生了 ${count} 期循環排程`);
          }
          setModals({}); 
        }} style={{ ...S.b("#0ea5e9", "#fff"), width: "100%", padding: "12px" }}>確認儲存</button>
      </Modal>

      {/* 👤 客戶表單 (已簡化文字) */}
      <Modal open={modals.custForm} onClose={() => setModals({})} title={editing.name ? "編輯客戶" : "新增客戶"}>
        <div style={S.f}><label style={S.l}>客戶名稱 (必填)</label><input style={S.i} value={editing.name || ""} onChange={e => setEditing({...editing, name: e.target.value})} /></div>
        <div style={S.f}><label style={S.l}>編碼</label><input style={S.i} value={editing.code || ""} onChange={e => setEditing({...editing, code: e.target.value})} /></div>
        <div style={S.f}><label style={S.l}>地址</label><input style={S.i} value={editing.address || ""} onChange={e => setEditing({...editing, address: e.target.value})} /></div>
        <div style={{ display: "flex", gap:10, marginBottom:12 }}>
          <div style={{flex:1}}><label style={S.l}>聯絡人</label><input style={S.i} value={editing.contact || ""} onChange={e => setEditing({...editing, contact: e.target.value})} /></div>
          <div style={{flex:1}}><label style={S.l}>聯絡人電話</label><input style={S.i} value={editing.phone || ""} onChange={e => setEditing({...editing, phone: e.target.value})} /></div>
        </div>
        <div style={{ display: "flex", gap:10, marginBottom:12, background:"#f0fdf4", padding:10, borderRadius:8 }}>
          <div style={{flex:1}}><label style={S.l}>現場聯絡人 (技師可見)</label><input style={S.i} value={editing.siteContact || ""} onChange={e => setEditing({...editing, siteContact: e.target.value})} /></div>
          <div style={{flex:1}}><label style={S.l}>現場電話 (技師可見)</label><input style={S.i} value={editing.sitePhone || ""} onChange={e => setEditing({...editing, sitePhone: e.target.value})} /></div>
        </div>
        <div style={{ display: "flex", gap:10, marginBottom:12 }}>
          <div style={{flex:1}}><label style={S.l}>Fax</label><input style={S.i} value={editing.fax || ""} onChange={e => setEditing({...editing, fax: e.target.value})} /></div>
          <div style={{flex:1}}><label style={S.l}>Email</label><input style={S.i} value={editing.email || ""} onChange={e => setEditing({...editing, email: e.target.value})} /></div>
        </div>
        <div style={S.f}><label style={S.l}>備註</label><textarea rows={2} style={S.i} value={editing.remarks || ""} onChange={e => setEditing({...editing, remarks: e.target.value})} /></div>

        <div style={S.f}>
          <label style={{ fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontWeight:700, background:"#f1f5f9", padding:10, borderRadius:8 }}>
            <input type="checkbox" checked={editing.active !== false} onChange={e => setEditing({...editing, active: e.target.checked})} style={{transform:"scale(1.2)"}} /> 
            {editing.active !== false ? "🟢 啟用此客戶" : "🔴 停用此客戶"}
          </label>
        </div>
        <button onClick={() => {
          if (!editing.name) return; 
          
          if (editing._prevActive !== false && editing.active === false) {
             const futureTasks = safeTasks.filter(t => t.customerId === editing.id && t.date >= td() && !t.done);
             if (futureTasks.length > 0 && window.confirm(`⚠️ 此客戶還有 ${futureTasks.length} 筆未來的排程尚未執行。\n\n按【確定】一併刪除這些未來行程。\n按【取消】保留未來排程。`)) {
                   upd("tasks", p => p.filter(t => !(t.customerId === editing.id && t.date >= td() && !t.done)));
                   addLog(`清除了停用客戶的未來排程`);
             }
          }

          const isExist = safeCusts.find(c => c && c.id === editing.id);
          const finalData = {...editing}; delete finalData._prevActive;

          if (isExist) upd("customers", p => p.map(c => c.id === editing.id ? finalData : c));
          else upd("customers", p => [finalData, ...(p||[])]);
          
          addLog(`更新了客戶資料: ${editing.name}`);
          setModals({});
        }} style={{ ...S.b("#10b981", "#fff"), width: "100%", padding: "12px" }}>儲存資料</button>
      </Modal>

      {/* 👷‍♂️ 技師管理 */}
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
                  <input type="checkbox" checked={t.isAdmin} onChange={e => { const n = [...safeTechs]; n[idx].isAdmin = e.target.checked; upd("technicians", n); }} /> 👑 管理員
                </label>
                <label style={{ fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontWeight:600, color: t.active ? "#22c55e" : "#ef4444" }}>
                  <input type="checkbox" checked={t.active !== false} onChange={e => { const n = [...safeTechs]; n[idx].active = e.target.checked; upd("technicians", n); }} /> {t.active ? "🟢 啟用中" : "🔴 離職/停用 (歷史紀錄保留)"}
                </label>
              </div>
           </div>
         )})}
         <button onClick={() => setModals({})} style={{ ...S.b("#0ea5e9", "#fff"), width: "100%", padding:"12px", marginTop:10 }}>完成</button>
      </Modal>

      {/* 🔔 系統通知 */}
      <Modal open={modals.logs} onClose={() => setModals({})} title="系統動態追蹤">
        <div style={{ display:"flex", justifyContent:"flex-end", marginBottom: 15 }}>
          <button onClick={() => { upd("logs", p => p.map(x => ({...x, read:true}))); }} style={{...S.b("none", "#64748b"), border:"1px solid #cbd5e1", padding:"6px 10px", fontSize:12}}>✔️ 全部標記為已讀</button>
        </div>
        <div style={{ maxHeight: 400, overflowY: "auto", paddingRight: 5 }}>
          {safeLogs.length > 0 ? safeLogs.map((l, i) => (
            <div key={l?.id || i} style={{ padding: "14px 12px", borderBottom: "1px solid #e2e8f0", fontSize: 14, display:"flex", gap:10, background: l.read ? "#fff" : "#fff1f2", borderLeft: l.read ? "none" : "4px solid #ef4444" }}>
              <div style={{ color: "#94a3b8", whiteSpace:"nowrap", fontSize:12 }}>{l?.time || ""}</div>
              <div style={{ lineHeight:1.4 }}><b style={{color:"#0ea5e9"}}>{l?.user || "系統"}</b> {l?.msg || ""}</div>
            </div>
          )) : <div style={{ textAlign:"center", padding:40, color:"#94a3b8", fontSize:15 }}>✅ 尚無動態</div>}
        </div>
      </Modal>

      {/* ⚙️ 設定與備份還原 */}
      <Modal open={modals.cfg} onClose={() => setModals({})} title="環境設定與備份">
         <div style={S.f}><label style={S.l}>系統名稱</label><input style={S.i} value={data.appName || ""} onChange={e => upd("appName", e.target.value)} /></div>
         <div style={S.f}><label style={S.l}>上傳公司 Logo</label><input type="file" accept="image/*" style={{...S.i, padding:"6px"}} onChange={e => { if (!e.target.files[0]) return; const r = new FileReader(); r.onload = ev => upd("logo", ev.target.result); r.readAsDataURL(e.target.files[0]); }} /></div>
         <hr style={{ border:"0", borderTop:"1px solid #e2e8f0", margin:"20px 0" }} />
         <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
           <h4 style={{margin:0, color:"#0f172a"}}>100% 完整備份與還原</h4>
           <p style={{fontSize:12, color:"#64748b", margin:0}}>* 備份檔包含所有歷史排程、客戶清單、技師設定與通知紀錄。</p>
           <button onClick={() => {
             const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
             const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `AOT_Backup_${td()}.json`; a.click();
             addLog("下載了系統資料備份");
           }} style={{ ...S.b("#10b981", "#fff"), width: "100%", padding:"12px" }}>💾 下載完整系統 JSON 備份</button>

           <label style={{ ...S.b("#ef4444", "#fff"), width: "100%", padding:"12px", textAlign:"center", cursor:"pointer", display:"block", boxSizing:"border-box", marginTop:10 }}>
             ⚠️ 上傳還原備份檔 (將覆蓋現有資料)
             <input type="file" accept=".json" style={{ display: "none" }} onChange={(e) => {
                if (!e.target.files[0]) return;
                if (!window.confirm("⚠️ 警告：還原將會【覆蓋】目前系統所有資料！確定要繼續嗎？")) return;
                const r = new FileReader();
                r.onload = (ev) => {
                  try { 
                    const d = JSON.parse(ev.target.result); setData(d); 
                    addLog("執行了系統層級還原"); 
                  } catch { }
                };
                r.readAsText(e.target.files[0]);
             }} />
           </label>
         </div>
      </Modal>
    </div>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "40px", textAlign: "center", fontFamily: "sans-serif" }}>
          <h2 style={{ color: "#ef4444" }}>⚠️ 系統畫面發生錯誤</h2>
          <button onClick={() => window.location.reload()} style={{ padding: "10px 20px", background: "#0ea5e9", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "16px", margin: "20px 0" }}>🔄 重新載入系統</button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return <ErrorBoundary><MainApp /></ErrorBoundary>;
}
