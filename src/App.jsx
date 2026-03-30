import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import * as Papa from "papaparse";
import { loadData as loadDB, saveData as saveDB } from "./supabase";

/* ═══════════ DEFAULTS ═══════════ */
const INIT = {
  appName: "水族排班系統", adminPin: "0000", logo: "",
  serviceTypes: [
    { id: "mt", label: "定期保養", color: "#0e7490", bg: "#ecfeff" },
    { id: "cl", label: "清洗服務", color: "#0369a1", bg: "#e0f2fe" },
    { id: "eg", label: "工程施作", color: "#6d28d9", bg: "#ede9fe" },
    { id: "ur", label: "臨時急件", color: "#dc2626", bg: "#fef2f2" },
  ],
  technicians: [
    { id: "t1", name: "技師 A", username: "a", pin: "1111", isAdmin: true, active: true, order: 0 },
    { id: "t2", name: "技師 B", username: "b", pin: "2222", isAdmin: false, active: true, order: 1 },
    { id: "t3", name: "技師 C", username: "c", pin: "3333", isAdmin: false, active: true, order: 2 },
  ],
  customers: [
    { id: "c1", code: "A001", name: "海洋主題餐廳", address: "香港銅鑼灣告士打道100號", contact: "陳經理", contactPhone: "66022133", fax: "", email: "info@ocean.hk", siteContact: "王姐", sitePhone: "91234567", note: "3座大型海水缸", tanks: 3, order: 0 },
  ],
  tasks: [], recurring: [], reports: {}, notifications: [],
};

const COLORS = ["#0e7490","#0369a1","#2563eb","#4f46e5","#6d28d9","#7c3aed","#9333ea","#db2777","#e11d48","#dc2626","#ea580c","#d97706","#ca8a04","#65a30d","#16a34a","#059669","#0d9488","#475569","#92400e","#1e1b4b","#831843"];
const CBG = {"#0e7490":"#ecfeff","#0369a1":"#e0f2fe","#2563eb":"#eff6ff","#4f46e5":"#eef2ff","#6d28d9":"#ede9fe","#7c3aed":"#f5f3ff","#9333ea":"#faf5ff","#db2777":"#fdf2f8","#e11d48":"#fff1f2","#dc2626":"#fef2f2","#ea580c":"#fff7ed","#d97706":"#fffbeb","#ca8a04":"#fefce8","#65a30d":"#f7fee7","#16a34a":"#f0fdf4","#059669":"#ecfdf5","#0d9488":"#f0fdfa","#475569":"#f8fafc","#92400e":"#fffbeb","#1e1b4b":"#eef2ff","#831843":"#fdf2f8"};
const FREQS = [{id:"weekly",l:"每週"},{id:"biweekly",l:"每兩週"},{id:"monthly",l:"每月"}];
const DAYOPT = [{id:1,l:"週一"},{id:2,l:"週二"},{id:3,l:"週三"},{id:4,l:"週四"},{id:5,l:"週五"},{id:6,l:"週六"},{id:0,l:"週日"}];
const DN = ["日","一","二","三","四","五","六"];

/* ═══════════ UTILS ═══════════ */
const td = () => new Date().toISOString().split("T")[0];
const uid = () => Math.random().toString(36).slice(2, 10);
const fmt = (s) => { const d = new Date(s); return (d.getMonth()+1) + "/" + d.getDate(); };
const mv = (a, f, t) => { const n=[...a]; const[i]=n.splice(f,1); n.splice(t,0,i); return n; };
const weekOf = (b) => { const d=new Date(b); const m=new Date(d); m.setDate(d.getDate()-((d.getDay()+6)%7)); return Array.from({length:7},(_,i)=>{const dd=new Date(m);dd.setDate(m.getDate()+i);return dd.toISOString().split("T")[0];}); };
const recMatch = (r,ds) => { const d=new Date(ds); if(d.getDay()!==r.dayOfWeek) return false; const s=new Date(r.startDate); if(d<s) return false; if(r.endDate&&d>new Date(r.endDate)) return false; if(r.frequency==="weekly") return true; if(r.frequency==="biweekly") return Math.floor((d-s)/604800000)%2===0; if(r.frequency==="monthly") return Math.ceil(s.getDate()/7)===Math.ceil(d.getDate()/7); return false; };
const hkTel = (n) => { if(!n) return ""; const c=n.replace(/[^0-9]/g,""); return c.length===8?"+852"+c:c.startsWith("852")?"+"+c:c; };
const hkWa = (n) => { if(!n) return ""; const c=n.replace(/[^0-9]/g,""); return c.length===8?"852"+c:c; };
const monthDays = (y,m) => { const first=new Date(y,m,1); const startD=(first.getDay()+6)%7; const days=[]; for(let i=-startD;i<42-startD;i++){const d=new Date(y,m,1+i);days.push(d.toISOString().split("T")[0]);} return days; };

/* ═══════════ STYLES ═══════════ */
const CSS = "@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;600;700;900&display=swap');*{box-sizing:border-box}input:focus,select:focus,textarea:focus{border-color:#0ea5e9!important;box-shadow:0 0 0 3px rgba(14,165,233,.12)}.tc{transition:all .12s}.tc:hover{box-shadow:0 3px 12px rgba(0,40,80,.08)!important;transform:translateY(-1px)}.nb:hover{background:rgba(14,116,144,.1)!important}";
const Z = {
  i: {width:"100%",padding:"7px 10px",border:"1.5px solid #cbd5e1",borderRadius:7,fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:"inherit"},
  s: {width:"100%",padding:"7px 10px",border:"1.5px solid #cbd5e1",borderRadius:7,fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:"inherit",background:"#fff",cursor:"pointer"},
  l: {display:"block",fontSize:11,fontWeight:600,color:"#475569",marginBottom:2},
  b: (bg,c) => ({padding:"7px 13px",background:bg,color:c||"#fff",border:"none",borderRadius:7,fontSize:12,fontWeight:600,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:4}),
  m: {padding:"4px 7px",background:"#f1f5f9",border:"none",borderRadius:5,cursor:"pointer",color:"#64748b",display:"inline-flex",alignItems:"center",fontSize:11},
  f: {marginBottom:10},
  hb: {background:"rgba(255,255,255,.15)",border:"1px solid rgba(255,255,255,.2)",color:"#fff",borderRadius:6,padding:"4px 8px",cursor:"pointer",fontSize:10,fontWeight:600,display:"inline-flex",alignItems:"center",gap:3},
};

/* ═══════════ ICONS ═══════════ */
const Ic = {
  Up: () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="18 15 12 9 6 15"/></svg>,
  Dn: () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="6 9 12 15 18 9"/></svg>,
  Pl: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  X: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Tr: () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
  Ed: () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  Fi: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6.5 12c2-6 7-7 14.5-4C17.5 12 17.5 16 21 20c-7.5 3-12.5 2-14.5-4"/><path d="M2 12l4-2v4l-4-2z"/><circle cx="14" cy="11" r="1" fill="currentColor"/></svg>,
  Eye: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  EyeOff: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>,
  Bell: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
};

/* ═══════════ SHARED COMPONENTS ═══════════ */
function Modal({open,onClose,title,children,wide}) {
  if(!open) return null;
  return <div style={{position:"fixed",inset:0,zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,20,40,.45)",backdropFilter:"blur(3px)"}} onClick={onClose}>
    <div onClick={e=>e.stopPropagation()} style={{background:"#fff",borderRadius:14,padding:"20px 22px",width:wide?560:420,maxWidth:"94vw",maxHeight:"88vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,40,80,.18)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><h3 style={{margin:0,fontSize:15,fontWeight:700,color:"#0c4a6e"}}>{title}</h3><button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:"#94a3b8"}}><Ic.X/></button></div>
      {children}
    </div></div>;
}

const PhLink = ({n}) => n ? <span style={{display:"inline-flex",gap:4,alignItems:"center"}}><a href={"tel:"+hkTel(n)} style={{color:"#0369a1",fontWeight:600,textDecoration:"underline",fontSize:11}}>{"📞"+n}</a><a href={"https://wa.me/"+hkWa(n)} target="_blank" rel="noopener noreferrer" style={{fontSize:10,color:"#16a34a",fontWeight:600,textDecoration:"underline"}}>WA</a></span> : null;

function NavLk({addr}) {
  const [o,sO] = useState(false);
  if(!addr) return null;
  const e = encodeURIComponent(addr);
  return <span style={{position:"relative"}}><button onClick={()=>sO(!o)} style={{background:"none",border:"none",cursor:"pointer",color:"#0369a1",fontSize:10,textDecoration:"underline",padding:0,fontFamily:"inherit"}}>{"📍"+addr+" ▸"}</button>
    {o && <div style={{position:"absolute",top:"100%",left:0,zIndex:50,background:"#fff",border:"1.5px solid #e2e8f0",borderRadius:7,boxShadow:"0 8px 20px rgba(0,0,0,.1)",padding:3,marginTop:2,minWidth:110}}>
      {[["Google Maps","https://www.google.com/maps/search/?api=1&query="+e],["Apple Maps","https://maps.apple.com/?q="+e],["Waze","https://waze.com/ul?q="+e],["高德","https://uri.amap.com/search?keyword="+e]].map(([n,u])=>
        <a key={n} href={u} target="_blank" rel="noopener noreferrer" onClick={()=>sO(false)} style={{display:"block",padding:"6px 8px",fontSize:11,color:"#1e293b",textDecoration:"none"}}>{n}</a>)}
    </div>}</span>;
}

/* ═══════════ LOGIN ═══════════ */
function Login({data, onLogin, status}) {
  const {technicians=[],adminPin="0000",appName="水族排班系統",logo=""} = data||{};
  const activeTechs = technicians.filter(t=>t.active!==false);
  const [mode,setMode] = useState("pick");
  const [sel,setSel] = useState(null);
  const [user,setUser] = useState("");
  const [pin,setPin] = useState("");
  const [show,setShow] = useState(false);
  const [err,setErr] = useState("");
  const [forgot,setForgot] = useState(false);

  const tryLogin = () => {
    if(mode==="admin") {
      if(pin===adminPin) return onLogin({role:"admin",techId:null,isAdmin:true});
      // Check if any tech with isAdmin matches
      const t = activeTechs.find(t=>t.username?.toLowerCase()===user.toLowerCase()&&t.pin===pin&&t.isAdmin);
      if(t) return onLogin({role:"admin",techId:t.id,isAdmin:true});
      setErr("帳號或PIN錯誤"); setPin("");
    } else if(sel) {
      if(pin===sel.pin) return onLogin({role:sel.isAdmin?"admin":"tech",techId:sel.id,isAdmin:sel.isAdmin||false});
      setErr("PIN錯誤"); setPin("");
    }
  };

  return <div style={{fontFamily:"'Noto Sans TC',sans-serif",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"linear-gradient(160deg,#0c4a6e,#0e7490 50%,#14b8a6)"}}><style>{CSS}</style>
    <div style={{background:"#fff",borderRadius:18,padding:"28px 24px",width:380,maxWidth:"92vw",boxShadow:"0 24px 60px rgba(0,30,60,.25)"}}>
      <div style={{textAlign:"center",marginBottom:18}}>
        {logo ? <img src={logo} alt="logo" style={{height:48,marginBottom:8,borderRadius:8}}/> : <div style={{width:44,height:44,borderRadius:11,background:"linear-gradient(135deg,#0e7490,#14b8a6)",display:"inline-flex",alignItems:"center",justifyContent:"center",color:"#fff",marginBottom:8}}><Ic.Fi/></div>}
        <div style={{fontSize:19,fontWeight:900,color:"#0c4a6e"}}>{appName}</div>
        {status==="loaded"&&<div style={{fontSize:10,color:"#16a34a",marginTop:2}}>{"✅ 已載入"}</div>}
        {status==="new"&&<div style={{fontSize:10,color:"#ea580c",marginTop:2}}>{"🆕 首次使用"}</div>}
      </div>

      {forgot && <div style={{background:"#f0f9ff",border:"1.5px solid #bfdbfe",borderRadius:10,padding:14,marginBottom:10}}>
        <div style={{fontSize:13,fontWeight:600,color:"#0369a1",marginBottom:4}}>忘記密碼？</div>
        <div style={{fontSize:12,color:"#64748b"}}>請聯繫系統管理員重設密碼</div>
        <button onClick={()=>setForgot(false)} style={{...Z.b("#0369a1"),marginTop:8,fontSize:11}}>知道了</button>
      </div>}

      {mode==="pick"&&!forgot&&<div style={{display:"flex",flexDirection:"column",gap:7}}>
        <button onClick={()=>setMode("admin")} style={{...Z.b("#0c4a6e"),width:"100%",justifyContent:"center",padding:11,borderRadius:10,fontSize:14}}>管理員登入</button>
        <div style={{textAlign:"center",fontSize:11,color:"#94a3b8"}}>— 技師 —</div>
        {activeTechs.sort((a,b)=>(a.order||0)-(b.order||0)).map(t=><button key={t.id} onClick={()=>{setSel(t);setMode("tech");setPin("");setErr("");}} style={{...Z.b("#f0f9ff","#0e7490"),width:"100%",justifyContent:"center",padding:9,borderRadius:8,border:"1.5px solid #e0f2fe"}}>{t.name}{t.isAdmin?" ⭐":""}</button>)}
        <button onClick={()=>setForgot(true)} style={{background:"none",border:"none",cursor:"pointer",fontSize:11,color:"#94a3b8",marginTop:3,textDecoration:"underline"}}>忘記密碼？</button>
      </div>}

      {(mode==="admin"||mode==="tech")&&!forgot&&<div>
        <div style={{marginBottom:12,padding:"7px 10px",background:"#f8fafc",borderRadius:7,fontWeight:700,color:"#0c4a6e",fontSize:13}}>{mode==="admin"?"管理員":sel?.name}</div>
        {mode==="admin"&&<div style={Z.f}><label style={Z.l}>帳號（不分大小寫）</label><input style={Z.i} value={user} onChange={e=>{setUser(e.target.value);setErr("");}} placeholder="admin 或技師帳號" /></div>}
        <div style={Z.f}><label style={Z.l}>PIN碼</label>
          <div style={{position:"relative"}}><input type={show?"text":"password"} maxLength={10} style={{...Z.i,fontSize:17,letterSpacing:5,textAlign:"center",paddingRight:36}} value={pin} onChange={e=>{setPin(e.target.value);setErr("");}} onKeyDown={e=>{if(e.key==="Enter")tryLogin();}} autoFocus />
            <button onClick={()=>setShow(!show)} style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:"#94a3b8"}}>{show?<Ic.EyeOff/>:<Ic.Eye/>}</button>
          </div></div>
        {err&&<div style={{color:"#dc2626",fontSize:12,fontWeight:600,marginBottom:6,textAlign:"center"}}>{err}</div>}
        <div style={{display:"flex",gap:6}}><button onClick={()=>{setMode("pick");setPin("");setErr("");setUser("");}} style={{...Z.b("#f1f5f9","#475569"),flex:1,justifyContent:"center"}}>返回</button><button onClick={tryLogin} style={{...Z.b("#0e7490"),flex:1,justifyContent:"center"}}>登入</button></div>
        {mode==="tech"&&<div style={{textAlign:"center",marginTop:6,fontSize:11,color:"#94a3b8"}}>忘記密碼？請聯繫管理員</div>}
      </div>}
    </div></div>;
}

/* ═══════════ MAIN APP ═══════════ */
export default function App() {
  const [data,setData]=useState(null); const [session,setSession]=useState(null);
  const [tab,setTab]=useState("schedule"); const [weekBase,setWeekBase]=useState(td());
  const [monthDate,setMonthDate]=useState(()=>{const d=new Date();return{y:d.getFullYear(),m:d.getMonth()};});
  const [modals,setModals]=useState({}); const [editing,setEditing]=useState({});
  const [saveStatus,setSaveStatus]=useState(""); const [dayDetail,setDayDetail]=useState(null);
  const [importMsg,setImportMsg]=useState(""); const [scheduleView,setScheduleView]=useState("week");
  const [techFilter,setTechFilter]=useState("all");
  const ready=useRef(false); const hist=useRef([]); const future=useRef([]); const skipH=useRef(false);

  // Load
  useEffect(()=>{loadDB().then(d=>{if(d){setData(d);setSaveStatus("loaded");}else{setData(INIT);setSaveStatus("new");}setTimeout(()=>{ready.current=true;},300);setTimeout(()=>setSaveStatus(""),3000);});},[]);
  // Save
  const doSave=useCallback(async(d)=>{const x=d||data;if(!x)return;setSaveStatus("saving");const ok=await saveDB(x);setSaveStatus(ok?"saved":"error");if(ok)setTimeout(()=>setSaveStatus(""),2500);},[data]);
  useEffect(()=>{if(!data||!ready.current)return;doSave(data);},[data]);

  // Undo/Redo
  const upd=(key,val)=>{setData(prev=>{if(!prev)return prev;if(!skipH.current){hist.current.push(JSON.stringify(prev));if(hist.current.length>30)hist.current.shift();future.current=[];}skipH.current=false;return{...prev,[key]:typeof val==="function"?val(prev[key]):val};});};
  const doUndo=()=>{if(!hist.current.length||!data)return;future.current.push(JSON.stringify(data));skipH.current=true;setData(JSON.parse(hist.current.pop()));};
  const doRedo=()=>{if(!future.current.length||!data)return;hist.current.push(JSON.stringify(data));skipH.current=true;setData(JSON.parse(future.current.pop()));};

  const openM=(k)=>setModals(p=>({...p,[k]:true})); const closeM=(k)=>setModals(p=>({...p,[k]:false}));

  // Notify helper
  const notify=(msg)=>{upd("notifications",prev=>[{id:uid(),msg,time:new Date().toLocaleString("zh-TW"),by:session?.techId||"admin",read:false},...(prev||[]).slice(0,99)]);};

  // Exports
  const exportJSON=()=>{if(!data)return;const b=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});const u=URL.createObjectURL(b);const a=document.createElement("a");a.href=u;a.download="backup-"+td()+".json";a.click();URL.revokeObjectURL(u);};
  const exportCSV=()=>{if(!data)return;const h=["客戶編碼","客戶名稱","地址","聯絡人","聯絡人電話","Fax","Email","現場聯絡人","現場電話","魚缸數","備註"];const r=data.customers.map(c=>[c.code||"",c.name,c.address,c.contact||"",c.contactPhone||"",c.fax||"",c.email||"",c.siteContact||"",c.sitePhone||"",c.tanks,c.note||""].map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(","));const csv="\uFEFF"+h.join(",")+"\n"+r.join("\n");const b=new Blob([csv],{type:"text/csv;charset=utf-8"});const u=URL.createObjectURL(b);const a=document.createElement("a");a.href=u;a.download="customers-"+td()+".csv";a.click();URL.revokeObjectURL(u);};
  const importJSON=(file)=>{const r=new FileReader();r.onload=(e)=>{try{const d=JSON.parse(e.target.result);if(!d.customers||!d.technicians){setImportMsg("❌ 格式錯");return;}setData(d);setImportMsg("✅ 還原成功");}catch{setImportMsg("❌ 失敗");}setTimeout(()=>setImportMsg(""),4000);};r.readAsText(file);};
  const importCSV=(file)=>{const r=new FileReader();r.onload=(e)=>{try{const res=Papa.parse(e.target.result,{header:true,skipEmptyLines:true});const existing=new Set((data?.customers||[]).map(c=>c.name+"|"+(c.code||"")));const mapped=(res.data||[]).map(r=>{const name=r["客戶名稱"]||r["name"]||r["公司"]||Object.values(r)[0]||"";const code=String(r["客戶編碼"]||r["編碼"]||"").trim();return{id:uid(),name:String(name).trim(),code,address:String(r["地址"]||"").trim(),contact:String(r["聯絡人"]||"").trim(),contactPhone:String(r["聯絡人電話"]||r["電話"]||"").trim(),fax:String(r["Fax"]||r["傳真"]||"").trim(),email:String(r["Email"]||"").trim(),siteContact:String(r["現場聯絡人"]||"").trim(),sitePhone:String(r["現場電話"]||"").trim(),note:String(r["備註"]||"").trim(),tanks:parseInt(r["魚缸數"]||"1")||1,order:999};}).filter(c=>c.name&&!existing.has(c.name+"|"+c.code));if(mapped.length){upd("customers",prev=>[...prev,...mapped]);setImportMsg("✅ 匯入"+mapped.length+"筆（跳過重複）");}else setImportMsg("⚠️ 無新資料或全部重複");}catch{setImportMsg("❌ 失敗");}setTimeout(()=>setImportMsg(""),4000);};r.readAsText(file);};

  // Loading
  if(!data) return <div style={{fontFamily:"'Noto Sans TC',sans-serif",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"linear-gradient(160deg,#0c4a6e,#0e7490,#14b8a6)"}}><style>{CSS}</style><div style={{background:"#fff",borderRadius:14,padding:28,textAlign:"center"}}>{"🐠 載入中..."}</div></div>;
  if(!session) return <Login data={data} onLogin={setSession} status={saveStatus}/>;

  const {customers=[],tasks=[],recurring=[],technicians=[],serviceTypes=[],adminPin,appName,logo,reports={},notifications=[]} = data;
  const isAdmin = session.isAdmin;
  const myId = session.techId;
  const activeTechs = technicians.filter(t=>t.active!==false).sort((a,b)=>(a.order||0)-(b.order||0));
  const visTechs = isAdmin ? (techFilter==="all" ? activeTechs.map(t=>t.id) : [techFilter]) : [myId];
  const gS=(id)=>serviceTypes.find(x=>x.id===id)||serviceTypes[0]||{label:"?",color:"#999",bg:"#eee"};
  const gC=(id)=>customers.find(c=>c.id===id); const gT=(id)=>technicians.find(t=>t.id===id);
  const fL=(f)=>FREQS.find(x=>x.id===f)?.l||f; const dL=(d)=>DAYOPT.find(x=>x.id===d)?.l||d;
  const weekDates=weekOf(weekBase);
  const shiftW=(dir)=>{const d=new Date(weekBase);d.setDate(d.getDate()+dir*7);setWeekBase(d.toISOString().split("T")[0]);};
  const tfd=(ds)=>{const oo=tasks.filter(t=>t.date===ds&&visTechs.includes(t.techId));const fr=recurring.filter(r=>visTechs.includes(r.techId)&&recMatch(r,ds)&&!(r.skipDates||[]).includes(ds)).map(r=>({id:r.id+"_"+ds,recurringId:r.id,customerId:r.customerId,techId:r.techId,date:ds,time:r.time,serviceType:r.serviceType,note:r.note,done:false,isRecurring:true}));return[...fr,...oo].sort((a,b)=>(a.time||"").localeCompare(b.time||""));};
  const todayT=tfd(td());
  const unreadN = (notifications||[]).filter(n=>!n.read).length;

  /* ── Inline components ── */
  function SiteEdit({cust}) {
    const [o,sO]=useState(false);const [nc,sNc]=useState(cust?.siteContact||"");const [np,sNp]=useState(cust?.sitePhone||"");
    useEffect(()=>{sNc(cust?.siteContact||"");sNp(cust?.sitePhone||"");},[cust]);
    if(!o) return <div style={{fontSize:10,color:"#0369a1",background:"#f0f9ff",padding:"2px 5px",borderRadius:4,marginTop:1,display:"flex",alignItems:"center",gap:5,flexWrap:"wrap"}}>{"👷"+(cust?.siteContact||"未設定")}{cust?.sitePhone&&<PhLink n={cust.sitePhone}/>}<button onClick={()=>sO(true)} style={{fontSize:9,color:"#0369a1",background:"#e0f2fe",border:"none",borderRadius:3,padding:"1px 4px",cursor:"pointer",fontFamily:"inherit"}}>{"✏️"}</button></div>;
    return <div style={{background:"#f0f9ff",border:"1px solid #bfdbfe",borderRadius:5,padding:"5px 7px",marginTop:1}}><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4}}><input style={{...Z.i,fontSize:11,padding:"3px 5px"}} value={nc} onChange={e=>sNc(e.target.value)} placeholder="聯絡人"/><input style={{...Z.i,fontSize:11,padding:"3px 5px"}} value={np} onChange={e=>sNp(e.target.value)} placeholder="電話"/></div><div style={{display:"flex",gap:3,marginTop:3,justifyContent:"flex-end"}}><button onClick={()=>sO(false)} style={{...Z.b("#f1f5f9","#475569"),padding:"2px 7px",fontSize:10}}>取消</button><button onClick={()=>{upd("customers",p=>p.map(c=>c.id===cust?.id?{...c,siteContact:nc,sitePhone:np}:c));notify(gT(myId)?.name+"修改了"+cust?.name+"的現場聯絡人");sO(false);}} style={{...Z.b("#0369a1"),padding:"2px 7px",fontSize:10}}>存</button></div></div>;
  }

  function RptInput({tKey}) {
    const [o,sO]=useState(false);const rp=(reports||{})[tKey];const [txt,sTxt]=useState(rp?.text||"");
    useEffect(()=>{sTxt(rp?.text||"");},[rp]);
    if(!o) return <button onClick={()=>sO(true)} style={{marginTop:2,fontSize:10,color:"#16a34a",background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:4,padding:"2px 7px",cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>{rp?"✏️修改":"📋回報"}</button>;
    return <div style={{marginTop:2,background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:5,padding:"5px 7px"}}><textarea value={txt} onChange={e=>sTxt(e.target.value)} placeholder="回報內容..." style={{...Z.i,minHeight:36,resize:"vertical",fontSize:11,border:"1px solid #bbf7d0"}} autoFocus/><div style={{display:"flex",gap:3,marginTop:3,justifyContent:"flex-end"}}><button onClick={()=>sO(false)} style={{...Z.b("#f1f5f9","#475569"),padding:"2px 7px",fontSize:10}}>取消</button><button onClick={()=>{upd("reports",prev=>({...(prev||{}),[tKey]:{text:txt,time:new Date().toLocaleString("zh-TW"),techId:myId||"admin"}}));notify((gT(myId)?.name||"管理員")+"回報了行程");sO(false);}} style={{...Z.b("#16a34a"),padding:"2px 7px",fontSize:10}}>送出</button></div></div>;
  }

  function CustPick({value,onChange}) {
    const [o,sO]=useState(false);const [q,sQ]=useState("");const ref=useRef(null);
    const sel=customers.find(c=>c.id===value);
    const fl=q?customers.filter(c=>c.name.includes(q)||(c.code||"").includes(q)||(c.contact||"").includes(q)||(c.address||"").includes(q)):customers;
    useEffect(()=>{const h=(e)=>{if(ref.current&&!ref.current.contains(e.target))sO(false);};document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);},[]);
    return <div ref={ref} style={{position:"relative"}}><div onClick={()=>{sO(!o);sQ("");}} style={{...Z.i,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",background:"#fff"}}><span style={{color:sel?"#1e293b":"#94a3b8",fontSize:11}}>{sel?(sel.code?"["+sel.code+"] ":"")+sel.name:"選擇客戶"}</span><span style={{fontSize:9,color:"#94a3b8"}}>{"▼"}</span></div>
      {o&&<div style={{position:"absolute",top:"100%",left:0,right:0,zIndex:50,background:"#fff",border:"1.5px solid #e2e8f0",borderRadius:6,marginTop:2,boxShadow:"0 8px 20px rgba(0,0,0,.1)",maxHeight:180,overflowY:"auto"}}><div style={{padding:"4px 5px",borderBottom:"1px solid #f1f5f9",position:"sticky",top:0,background:"#fff"}}><input style={{...Z.i,fontSize:11,padding:"4px 6px"}} placeholder="搜尋..." value={q} onChange={e=>sQ(e.target.value)} autoFocus/></div>
        {fl.length===0&&<div style={{padding:8,textAlign:"center",color:"#94a3b8",fontSize:11}}>無結果</div>}
        {fl.map(c=><div key={c.id} onClick={()=>{onChange(c.id);sO(false);sQ("");}} style={{padding:"5px 7px",cursor:"pointer",borderBottom:"1px solid #f8fafc",fontSize:11}}><div style={{fontWeight:600,color:"#0c4a6e"}}>{c.code&&<span style={{color:"#94a3b8"}}>{"["+c.code+"] "}</span>}{c.name}</div></div>)}
      </div>}</div>;
  }

  function TaskCard({task,date}) {
    const svc=gS(task.serviceType);const cust=gC(task.customerId);
    const rk=task.isRecurring?(task.recurringId+"_"+date):task.id;const rp=(reports||{})[rk];
    const canAct=isAdmin||(myId===task.techId);
    return <div style={{padding:"6px 0"}}>
      <div style={{display:"flex",gap:5}}>
        <div style={{width:3,borderRadius:2,background:svc.color,flexShrink:0}}/>
        <div style={{flex:1}}>
          <div style={{display:"flex",alignItems:"center",gap:3,marginBottom:1}}>
            {task.time&&<span style={{fontWeight:800,fontSize:12,color:"#0c4a6e"}}>{task.time}</span>}
            <span style={{fontSize:9,fontWeight:700,color:svc.color,background:svc.bg,padding:"0 4px",borderRadius:3}}>{svc.label}</span>
            {task.isRecurring&&<span style={{fontSize:8,color:"#0d9488"}}>🔄</span>}
            {task.done&&<span style={{fontSize:8,color:"#16a34a",fontWeight:700}}>✅</span>}
          </div>
          <div style={{fontWeight:600,fontSize:12}}>{cust?.name}{cust?.tanks?<span style={{fontSize:9,color:"#94a3b8",marginLeft:2}}>{"🐠"+cust.tanks}</span>:null}</div>
          {cust?.address&&<NavLk addr={cust.address}/>}
          <SiteEdit cust={cust}/>
          {task.note&&<div style={{fontSize:10,color:"#64748b",marginTop:1}}>{"📝"+task.note}</div>}
          {cust?.note&&<div style={{fontSize:10,color:"#94a3b8",fontStyle:"italic"}}>{"💬"+cust.note}</div>}
          <div style={{fontSize:9,color:"#94a3b8"}}>{"🔧"+(gT(task.techId)?.name||"")}</div>
          {rp&&<div style={{fontSize:10,color:"#16a34a",background:"#f0fdf4",padding:"2px 5px",borderRadius:3,marginTop:1,border:"1px solid #bbf7d0"}}>{"📋"+rp.text+" ("+rp.time+")"}</div>}
          {canAct&&<RptInput tKey={rk}/>}
        </div>
        {canAct&&<div style={{display:"flex",flexDirection:"column",gap:2,flexShrink:0}}>
          {!task.isRecurring&&<button onClick={()=>{upd("tasks",p=>p.map(t=>t.id===task.id?{...t,done:!t.done}:t));if(!task.done)notify((gT(task.techId)?.name||"")+"完成了"+cust?.name+"的行程");}} style={{...Z.m,color:task.done?"#ea580c":"#16a34a",fontWeight:700}}>{task.done?"↩":"✓"}</button>}
          {task.isRecurring&&<button onClick={()=>{upd("recurring",p=>p.map(r=>r.id===task.recurringId?{...r,skipDates:[...(r.skipDates||[]),date]}:r));}} style={{...Z.m,color:"#ea580c",fontSize:9}}>跳過</button>}
          {!task.isRecurring&&isAdmin&&<><button onClick={()=>{setEditing({task});openM("task");}} style={Z.m}><Ic.Ed/></button><button onClick={()=>upd("tasks",p=>p.filter(t=>t.id!==task.id))} style={{...Z.m,color:"#ef4444"}}><Ic.Tr/></button></>}
        </div>}
      </div></div>;
  }

  /* ── Forms ── */
  function RecForm({onClose,initial}) {
    const [f,sF]=useState(initial||{customerId:customers[0]?.id||"",techId:activeTechs[0]?.id||"",dayOfWeek:1,time:"",serviceType:serviceTypes[0]?.id||"",frequency:"weekly",startDate:td(),endDate:"",note:"",skipDates:[]});
    const u=(k,v)=>sF(p=>({...p,[k]:v}));
    return <div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
      <div style={Z.f}><label style={Z.l}>客戶</label><CustPick value={f.customerId} onChange={v=>u("customerId",v)}/></div>
      <div style={Z.f}><label style={Z.l}>技師</label><select style={Z.s} value={f.techId} onChange={e=>u("techId",e.target.value)}>{activeTechs.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
      <div style={Z.f}><label style={Z.l}>星期</label><select style={Z.s} value={f.dayOfWeek} onChange={e=>u("dayOfWeek",parseInt(e.target.value))}>{DAYOPT.map(d=><option key={d.id} value={d.id}>{d.l}</option>)}</select></div>
      <div style={Z.f}><label style={Z.l}>時間（選填）</label><input type="time" style={Z.i} value={f.time} onChange={e=>u("time",e.target.value)}/></div>
      <div style={Z.f}><label style={Z.l}>類型</label><select style={Z.s} value={f.serviceType} onChange={e=>u("serviceType",e.target.value)}>{serviceTypes.map(x=><option key={x.id} value={x.id}>{x.label}</option>)}</select></div>
      <div style={Z.f}><label style={Z.l}>頻率</label><select style={Z.s} value={f.frequency} onChange={e=>u("frequency",e.target.value)}>{FREQS.map(x=><option key={x.id} value={x.id}>{x.l}</option>)}</select></div>
      <div style={Z.f}><label style={Z.l}>開始</label><input type="date" style={Z.i} value={f.startDate} onChange={e=>u("startDate",e.target.value)}/></div>
      <div style={Z.f}><label style={Z.l}>結束</label><input type="date" style={Z.i} value={f.endDate} onChange={e=>u("endDate",e.target.value)}/></div>
    </div><div style={Z.f}><label style={Z.l}>備註</label><textarea style={{...Z.i,minHeight:32,resize:"vertical"}} value={f.note} onChange={e=>u("note",e.target.value)}/></div>
    <div style={{display:"flex",justifyContent:"flex-end",gap:5}}><button onClick={onClose} style={Z.b("#f1f5f9","#475569")}>取消</button><button onClick={()=>{if(!f.customerId||!f.techId)return;if(initial)upd("recurring",p=>p.map(r=>r.id===initial.id?{...f,id:initial.id}:r));else{upd("recurring",p=>[...p,{...f,id:uid(),skipDates:[]}]);notify("新增定期排程："+gC(f.customerId)?.name);}onClose();}} style={Z.b("#0d9488")}>{initial?"更新":"建立"}</button></div></div>;
  }

  function TaskForm({onClose,initial}) {
    const [f,sF]=useState(initial||{customerId:customers[0]?.id||"",techId:activeTechs[0]?.id||"",date:editing.prefillDate||td(),time:"",serviceType:serviceTypes[0]?.id||"",note:"",done:false});
    const u=(k,v)=>sF(p=>({...p,[k]:v}));
    return <div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
      <div style={Z.f}><label style={Z.l}>客戶</label><CustPick value={f.customerId} onChange={v=>u("customerId",v)}/></div>
      <div style={Z.f}><label style={Z.l}>技師</label><select style={Z.s} value={f.techId} onChange={e=>u("techId",e.target.value)}>{activeTechs.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
      <div style={Z.f}><label style={Z.l}>日期</label><input type="date" style={Z.i} value={f.date} onChange={e=>u("date",e.target.value)}/></div>
      <div style={Z.f}><label style={Z.l}>時間（選填）</label><input type="time" style={Z.i} value={f.time} onChange={e=>u("time",e.target.value)}/></div>
      <div style={{...Z.f,gridColumn:"1/-1"}}><label style={Z.l}>類型</label><select style={Z.s} value={f.serviceType} onChange={e=>u("serviceType",e.target.value)}>{serviceTypes.map(x=><option key={x.id} value={x.id}>{x.label}</option>)}</select></div>
    </div><div style={Z.f}><label style={Z.l}>備註</label><textarea style={{...Z.i,minHeight:32,resize:"vertical"}} value={f.note} onChange={e=>u("note",e.target.value)}/></div>
    <div style={{display:"flex",justifyContent:"flex-end",gap:5}}><button onClick={onClose} style={Z.b("#f1f5f9","#475569")}>取消</button><button onClick={()=>{if(!f.customerId||!f.techId||!f.date)return;if(initial&&initial.id&&!initial.isRecurring)upd("tasks",p=>p.map(t=>t.id===initial.id?{...f,id:initial.id}:t));else{upd("tasks",p=>[...p,{...f,id:uid()}]);notify("新增行程："+gC(f.customerId)?.name);}onClose();}} style={Z.b("#0e7490")}>{initial&&!initial.isRecurring?"更新":"新增"}</button></div></div>;
  }

  function CustForm({onClose,initial}) {
    const [f,sF]=useState(initial||{name:"",code:"",address:"",contact:"",contactPhone:"",fax:"",email:"",siteContact:"",sitePhone:"",note:"",tanks:1,order:999});
    const u=(k,v)=>sF(p=>({...p,[k]:v}));
    return <div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
      <div style={{...Z.f,gridColumn:"1/-1"}}><label style={Z.l}>客戶名稱 *</label><input style={Z.i} value={f.name} onChange={e=>u("name",e.target.value)}/></div>
      <div style={Z.f}><label style={Z.l}>編碼</label><input style={Z.i} value={f.code||""} onChange={e=>u("code",e.target.value)} placeholder="A001"/></div>
      <div style={Z.f}><label style={Z.l}>地址</label><input style={Z.i} value={f.address} onChange={e=>u("address",e.target.value)}/></div>
      <div style={Z.f}><label style={Z.l}>聯絡人（主管）</label><input style={Z.i} value={f.contact||""} onChange={e=>u("contact",e.target.value)}/></div>
      <div style={Z.f}><label style={Z.l}>聯絡人電話</label><input style={Z.i} value={f.contactPhone||""} onChange={e=>u("contactPhone",e.target.value)}/></div>
      <div style={Z.f}><label style={Z.l}>Fax</label><input style={Z.i} value={f.fax||""} onChange={e=>u("fax",e.target.value)}/></div>
      <div style={Z.f}><label style={Z.l}>Email</label><input style={Z.i} value={f.email||""} onChange={e=>u("email",e.target.value)}/></div>
    </div>
    <div style={{background:"#f0f9ff",borderRadius:6,padding:"7px 9px",marginBottom:8,border:"1px solid #bfdbfe"}}>
      <div style={{fontSize:10,fontWeight:700,color:"#0369a1",marginBottom:4}}>📍 現場資訊（技師可見）</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
        <div style={Z.f}><label style={Z.l}>現場聯絡人</label><input style={Z.i} value={f.siteContact||""} onChange={e=>u("siteContact",e.target.value)}/></div>
        <div style={Z.f}><label style={Z.l}>現場電話</label><input style={Z.i} value={f.sitePhone||""} onChange={e=>u("sitePhone",e.target.value)}/></div>
      </div></div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}><div style={Z.f}><label style={Z.l}>魚缸數</label><input type="number" min="1" style={Z.i} value={f.tanks} onChange={e=>u("tanks",parseInt(e.target.value)||1)}/></div></div>
    <div style={Z.f}><label style={Z.l}>備註</label><textarea style={{...Z.i,minHeight:32,resize:"vertical"}} value={f.note} onChange={e=>u("note",e.target.value)}/></div>
    <div style={{display:"flex",justifyContent:"flex-end",gap:5}}><button onClick={onClose} style={Z.b("#f1f5f9","#475569")}>取消</button><button onClick={()=>{if(!f.name)return;if(initial)upd("customers",p=>p.map(c=>c.id===initial.id?{...f,id:initial.id}:c));else upd("customers",p=>[...p,{...f,id:uid()}]);onClose();}} style={Z.b("#0e7490")}>{initial?"更新":"新增"}</button></div></div>;
  }

  function SvcEditor({onClose}) {
    const [list,setList]=useState([...serviceTypes]);
    const upL=(i,k,v)=>{const n=[...list];n[i]={...n[i],[k]:v};setList(n);};
    return <div>{list.map((it,i)=><div key={it.id} style={{padding:8,background:"#fafbfc",borderRadius:7,marginBottom:5,border:"1px solid #e2e8f0"}}>
      <div style={{display:"flex",gap:4,alignItems:"center",marginBottom:4}}>
        <div style={{display:"flex",flexDirection:"column",gap:1}}><button disabled={i===0} onClick={()=>setList(mv(list,i,i-1))} style={{...Z.m,padding:"1px 3px",opacity:i===0?.3:1}}><Ic.Up/></button><button disabled={i===list.length-1} onClick={()=>setList(mv(list,i,i+1))} style={{...Z.m,padding:"1px 3px",opacity:i===list.length-1?.3:1}}><Ic.Dn/></button></div>
        <input style={{...Z.i,flex:1}} value={it.label} onChange={e=>upL(i,"label",e.target.value)}/>
        <div style={{width:20,height:20,borderRadius:4,background:it.color}}/>
        {list.length>1&&<button onClick={()=>{if(tasks.some(t=>t.serviceType===it.id)||recurring.some(r=>r.serviceType===it.id))return;setList(p=>p.filter((_,j)=>j!==i));}} style={{...Z.m,color:"#ef4444"}}><Ic.Tr/></button>}
      </div>
      <div style={{display:"flex",gap:2,flexWrap:"wrap"}}>{COLORS.map(c=><button key={c} onClick={()=>{const n=[...list];n[i]={...n[i],color:c,bg:CBG[c]||"#f8fafc"};setList(n);}} style={{width:15,height:15,borderRadius:3,background:c,border:it.color===c?"2px solid #0c4a6e":"1px solid transparent",cursor:"pointer"}}/>)}</div>
    </div>)}
    <button onClick={()=>setList(p=>[...p,{id:uid(),label:"新類型",color:"#475569",bg:"#f8fafc"}])} style={{...Z.b("#f0fdfa","#0d9488"),width:"100%",justifyContent:"center",padding:6,borderRadius:7,border:"1.5px dashed #99f6e4",marginBottom:8}}><Ic.Pl/> 新增</button>
    <div style={{display:"flex",justifyContent:"flex-end",gap:5}}><button onClick={onClose} style={Z.b("#f1f5f9","#475569")}>取消</button><button onClick={()=>{upd("serviceTypes",list);onClose();}} style={Z.b("#0e7490")}>儲存</button></div></div>;
  }

  function TechEditor({onClose}) {
    const [list,setList]=useState(technicians.map(t=>({...t})));const [lap,setLap]=useState(adminPin);
    const upL=(i,k,v)=>{const n=[...list];n[i]={...n[i],[k]:v};setList(n);};
    return <div>
      <div style={{...Z.f,background:"#f0f9ff",borderRadius:6,padding:"7px 10px"}}><label style={Z.l}>通用管理員PIN</label><input maxLength={10} style={{...Z.i,width:100,letterSpacing:3,fontWeight:700}} value={lap} onChange={e=>setLap(e.target.value)}/></div>
      {list.map((t,i)=><div key={t.id} style={{padding:10,background:t.active===false?"#fef2f2":"#fafbfc",borderRadius:8,marginBottom:6,border:"1px solid "+(t.active===false?"#fecaca":"#e2e8f0")}}>
        <div style={{display:"flex",gap:5,alignItems:"flex-end",marginBottom:6,flexWrap:"wrap"}}>
          <div style={{display:"flex",flexDirection:"column",gap:1}}><button disabled={i===0} onClick={()=>setList(mv(list,i,i-1))} style={{...Z.m,padding:"1px 2px",opacity:i===0?.3:1}}><Ic.Up/></button><button disabled={i===list.length-1} onClick={()=>setList(mv(list,i,i+1))} style={{...Z.m,padding:"1px 2px",opacity:i===list.length-1?.3:1}}><Ic.Dn/></button></div>
          <div style={{flex:1,minWidth:80}}><label style={Z.l}>姓名</label><input style={Z.i} value={t.name} onChange={e=>upL(i,"name",e.target.value)}/></div>
          <div style={{width:80}}><label style={Z.l}>帳號</label><input style={Z.i} value={t.username||""} onChange={e=>upL(i,"username",e.target.value)} placeholder="英文"/></div>
          <div><label style={Z.l}>PIN</label><div style={{display:"flex",gap:3}}><input maxLength={10} style={{...Z.i,width:60,letterSpacing:2,fontWeight:700}} value={t.pin} onChange={e=>upL(i,"pin",e.target.value)}/><button onClick={()=>upL(i,"pin","0000")} style={{...Z.b("#fff7ed","#ea580c"),padding:"4px 6px",fontSize:9}}>重設</button></div></div>
        </div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap",fontSize:12}}>
          <label style={{display:"flex",alignItems:"center",gap:4,cursor:"pointer",fontWeight:600,color:t.isAdmin?"#0e7490":"#64748b"}}><input type="checkbox" checked={t.isAdmin||false} onChange={e=>upL(i,"isAdmin",e.target.checked)}/> ⭐管理員</label>
          <label style={{display:"flex",alignItems:"center",gap:4,cursor:"pointer",fontWeight:600,color:t.active===false?"#dc2626":"#16a34a"}}><input type="checkbox" checked={t.active!==false} onChange={e=>upL(i,"active",e.target.checked)}/> {t.active!==false?"✅啟用":"🚫停用"}</label>
        </div>
        {t.active===false&&<div style={{fontSize:10,color:"#dc2626",marginTop:3}}>停用帳號無法登入，歷史排程保留</div>}
      </div>)}
      <button onClick={()=>{const nid=uid();setList(p=>[...p,{id:nid,name:"新技師",username:"",pin:"0000",isAdmin:false,active:true,order:p.length}]);}} style={{...Z.b("#f0fdfa","#0d9488"),width:"100%",justifyContent:"center",padding:6,borderRadius:7,border:"1.5px dashed #99f6e4",marginBottom:8}}><Ic.Pl/> 新增技師</button>
      <div style={{display:"flex",justifyContent:"flex-end",gap:5}}><button onClick={onClose} style={Z.b("#f1f5f9","#475569")}>取消</button><button onClick={()=>{const updated=list.map((t,i)=>({...t,order:i}));upd("technicians",updated);upd("adminPin",lap);onClose();}} style={Z.b("#0e7490")}>儲存</button></div>
    </div>;
  }

  function AppCfg({onClose}) {
    const [n,sN]=useState(appName||"");const [lg,sLg]=useState(logo||"");
    const [restoreFile,setRF]=useState(null);
    const handleLogo=(e)=>{const file=e.target.files[0];if(!file)return;const r=new FileReader();r.onload=(ev)=>sLg(ev.target.result);r.readAsDataURL(file);};
    return <div>
      <div style={Z.f}><label style={Z.l}>系統名稱</label><input style={Z.i} value={n} onChange={e=>sN(e.target.value)}/></div>
      <div style={Z.f}><label style={Z.l}>Logo</label><div style={{display:"flex",alignItems:"center",gap:8}}>
        {lg&&<img src={lg} alt="logo" style={{height:32,borderRadius:6}}/>}
        <label style={{...Z.b("#f0f9ff","#0369a1"),borderRadius:6,cursor:"pointer",border:"1.5px solid #bfdbfe",fontSize:11}}>{"📷選圖片"}<input type="file" accept="image/*" style={{display:"none"}} onChange={handleLogo}/></label>
        {lg&&<button onClick={()=>sLg("")} style={{...Z.m,color:"#ef4444",fontSize:10}}>移除</button>}
      </div></div>
      <div style={{display:"flex",justifyContent:"flex-end",gap:5,marginBottom:12}}><button onClick={onClose} style={Z.b("#f1f5f9","#475569")}>取消</button><button onClick={()=>{upd("appName",n);upd("logo",lg);onClose();}} style={Z.b("#0e7490")}>儲存</button></div>
      <div style={{borderTop:"1.5px solid #e2e8f0",paddingTop:10}}>
        <div style={{fontSize:12,fontWeight:700,color:"#0c4a6e",marginBottom:6}}>📦 備份與還原</div>
        <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:6}}>
          <button onClick={exportJSON} style={{...Z.b("#0d9488"),borderRadius:6,fontSize:11}}>💾 全部JSON</button>
          <button onClick={exportCSV} style={{...Z.b("#0369a1"),borderRadius:6,fontSize:11}}>📊 客戶CSV</button>
        </div>
        <div style={{background:"#fef2f2",borderRadius:6,padding:"7px 9px",border:"1px solid #fecaca"}}>
          <div style={{fontSize:10,fontWeight:600,color:"#dc2626",marginBottom:3}}>⚠️ 還原備份</div>
          {!restoreFile?<label style={{...Z.b("#dc2626"),borderRadius:6,cursor:"pointer",fontSize:11}}>📂 選.json檔<input type="file" accept=".json" style={{display:"none"}} onChange={e=>{if(e.target.files[0])setRF(e.target.files[0]);e.target.value="";}}/></label>
          :<div><div style={{fontSize:11,marginBottom:3}}>{"還原「"+restoreFile.name+"」？"}</div><div style={{display:"flex",gap:4}}><button onClick={()=>setRF(null)} style={{...Z.b("#f1f5f9","#475569"),padding:"2px 8px",fontSize:10}}>取消</button><button onClick={()=>{importJSON(restoreFile);setRF(null);}} style={{...Z.b("#dc2626"),padding:"2px 8px",fontSize:10}}>確定</button></div></div>}
          {importMsg&&<div style={{marginTop:4,fontSize:11,fontWeight:600,color:importMsg.startsWith("✅")?"#16a34a":"#dc2626"}}>{importMsg}</div>}
        </div></div></div>;
  }

  function PinChg({open,onClose,curPin,onSave,title}) {
    const [o,sO]=useState("");const [n,sN]=useState("");const [c,sC]=useState("");const [err,sE]=useState("");const [ok,sOk]=useState(false);const [show,setShow]=useState(false);
    useEffect(()=>{if(!open){sO("");sN("");sC("");sE("");sOk(false);setShow(false);}},[open]);
    if(!open) return null;
    return <Modal open={open} onClose={onClose} title={title}>{ok?<div style={{textAlign:"center",padding:14,fontWeight:700,color:"#16a34a"}}>✅ 已更新！</div>
      :<div><div style={Z.f}><label style={Z.l}>舊PIN</label><input type={show?"text":"password"} maxLength={10} style={{...Z.i,letterSpacing:3}} value={o} onChange={e=>{sO(e.target.value);sE("");}}/></div>
        <div style={Z.f}><label style={Z.l}>新PIN（4碼+）</label><input type={show?"text":"password"} maxLength={10} style={{...Z.i,letterSpacing:3}} value={n} onChange={e=>{sN(e.target.value);sE("");}}/></div>
        <div style={Z.f}><label style={Z.l}>確認</label><input type={show?"text":"password"} maxLength={10} style={{...Z.i,letterSpacing:3}} value={c} onChange={e=>{sC(e.target.value);sE("");}}/></div>
        <label style={{display:"flex",alignItems:"center",gap:4,fontSize:11,color:"#64748b",marginBottom:8,cursor:"pointer"}}><input type="checkbox" checked={show} onChange={e=>setShow(e.target.checked)}/> 顯示密碼</label>
        {err&&<div style={{color:"#dc2626",fontSize:11,marginBottom:6}}>{err}</div>}
        <div style={{display:"flex",justifyContent:"flex-end",gap:5}}><button onClick={onClose} style={Z.b("#f1f5f9","#475569")}>取消</button><button onClick={()=>{if(o!==curPin){sE("舊密碼錯");return;}if(n.length<4){sE("至少4碼");return;}if(n!==c){sE("不一致");return;}onSave(n);sOk(true);setTimeout(onClose,1200);}} style={Z.b("#0e7490")}>更新</button></div></div>}</Modal>;
  }

  /* ═══════════ RENDER ═══════════ */
  const curTP = myId ? technicians.find(t=>t.id===myId)?.pin : null;

  return <div style={{fontFamily:"'Noto Sans TC',sans-serif",background:"linear-gradient(160deg,#f0f9ff,#e0f2fe 40%,#f0fdfa)",minHeight:"100vh",color:"#1e293b"}}><style>{CSS}</style>

    {/* Save status */}
    {saveStatus&&saveStatus!=="loaded"&&saveStatus!=="new"&&<div style={{position:"fixed",bottom:10,right:10,zIndex:999,padding:"5px 10px",borderRadius:7,fontSize:10,fontWeight:600,boxShadow:"0 3px 10px rgba(0,0,0,.08)",background:saveStatus==="saved"?"#f0fdf4":saveStatus==="error"?"#fef2f2":"#f0f9ff",color:saveStatus==="saved"?"#16a34a":saveStatus==="error"?"#dc2626":"#0369a1"}}>
      {saveStatus==="saving"&&"💾..."}{saveStatus==="saved"&&"✅"}{saveStatus==="error"&&<span>❌ <button onClick={()=>doSave()} style={{...Z.b("#dc2626"),padding:"1px 6px",fontSize:9}}>重試</button></span>}
    </div>}

    {dayDetail&&<Modal open={true} onClose={()=>setDayDetail(null)} title={fmt(dayDetail)+" 週"+DN[new Date(dayDetail).getDay()]} wide>
      {tfd(dayDetail).length===0&&<div style={{textAlign:"center",padding:16,color:"#94a3b8"}}>無排程</div>}
      {tfd(dayDetail).map((task,i)=><div key={task.id} style={{borderBottom:i<tfd(dayDetail).length-1?"1px solid #f1f5f9":"none"}}><TaskCard task={task} date={dayDetail}/></div>)}
      {(isAdmin||true)&&<button onClick={()=>{setEditing({task:null,prefillDate:dayDetail});openM("task");setDayDetail(null);}} style={{...Z.b("#0e7490"),width:"100%",justifyContent:"center",marginTop:6,borderRadius:7}}><Ic.Pl/> 新增</button>}
    </Modal>}

    {/* Header */}
    <div style={{background:"linear-gradient(135deg,#0c4a6e,#0e7490 60%,#14b8a6)",padding:"10px 16px",color:"#fff"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",maxWidth:1100,margin:"0 auto",flexWrap:"wrap",gap:5}}>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          {logo?<img src={logo} alt="" style={{height:28,borderRadius:6}}/>:<div style={{width:28,height:28,borderRadius:7,background:"rgba(255,255,255,.18)",display:"flex",alignItems:"center",justifyContent:"center"}}><Ic.Fi/></div>}
          <div><div style={{fontSize:14,fontWeight:900}}>{appName}</div><div style={{fontSize:9,opacity:.7}}>{isAdmin?"管理員"+(myId?" ("+gT(myId)?.name+")":""):(gT(myId)?.name||"")}</div></div>
        </div>
        <div style={{display:"flex",gap:3,flexWrap:"wrap",alignItems:"center"}}>
          {isAdmin&&<button onClick={()=>openM("appCfg")} className="nb" style={Z.hb}>系統</button>}
          {isAdmin&&<button onClick={()=>openM("svc")} className="nb" style={Z.hb}>類型</button>}
          {isAdmin&&<button onClick={()=>openM("tech")} className="nb" style={Z.hb}>技師</button>}
          {isAdmin&&<button onClick={()=>setTab("notif")} className="nb" style={{...Z.hb,position:"relative"}}><Ic.Bell/>{unreadN>0&&<span style={{position:"absolute",top:-4,right:-4,background:"#dc2626",color:"#fff",fontSize:8,fontWeight:700,borderRadius:10,padding:"1px 4px",minWidth:14,textAlign:"center"}}>{unreadN}</span>}</button>}
          <button onClick={doUndo} className="nb" style={{...Z.hb,opacity:hist.current.length?.9:.4}}>↩</button>
          <button onClick={doRedo} className="nb" style={{...Z.hb,opacity:future.current.length?.9:.4}}>↪</button>
          <button onClick={()=>openM("pin")} className="nb" style={Z.hb}>密碼</button>
          <button onClick={()=>setSession(null)} className="nb" style={Z.hb}>登出</button>
        </div>
      </div>
    </div>

    <div style={{maxWidth:1100,margin:"0 auto",padding:"0 14px"}}>
      {/* Admin tech filter */}
      {isAdmin&&(tab==="schedule"||tab==="today")&&<div style={{display:"flex",alignItems:"center",gap:6,paddingTop:8,flexWrap:"wrap"}}>
        <span style={{fontSize:11,fontWeight:600,color:"#64748b"}}>篩選技師:</span>
        <select value={techFilter} onChange={e=>setTechFilter(e.target.value)} style={{...Z.s,width:"auto",padding:"4px 8px",fontSize:11}}>
          <option value="all">全部</option>
          {activeTechs.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>}

      {/* Tabs */}
      <div style={{display:"flex",gap:2,padding:"8px 0 0",borderBottom:"2px solid #e2e8f0",flexWrap:"wrap"}}>
        {[{id:"schedule",l:"排程"},{id:"today",l:"今日"},...(isAdmin?[{id:"recurring",l:"定期"},{id:"customers",l:"客戶"},{id:"notif",l:"通知"+( unreadN>0?" ("+unreadN+")":"")}]:[])].map(t=>
          <button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"6px 10px",background:"none",border:"none",cursor:"pointer",fontSize:12,fontWeight:tab===t.id?700:500,color:tab===t.id?"#0e7490":"#64748b",borderBottom:tab===t.id?"2.5px solid #0e7490":"2.5px solid transparent",marginBottom:-2}}>{t.l}</button>)}
      </div>

      {/* ══════ SCHEDULE ══════ */}
      {tab==="schedule"&&<div style={{paddingTop:12,paddingBottom:28}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10,flexWrap:"wrap",gap:5}}>
          <div style={{display:"flex",alignItems:"center",gap:4}}>
            <button onClick={()=>setScheduleView(scheduleView==="week"?"month":"week")} style={{...Z.b(scheduleView==="week"?"#f0f9ff":"#ecfdf5",scheduleView==="week"?"#0369a1":"#059669"),borderRadius:6,fontSize:11}}>{scheduleView==="week"?"📅月":"📆週"}</button>
            {scheduleView==="week"&&<><button onClick={()=>shiftW(-1)} style={{...Z.m,padding:"3px 5px"}}>◀</button>
              <span style={{fontSize:11,fontWeight:700,color:"#0c4a6e",minWidth:100,textAlign:"center"}}>{fmt(weekDates[0])}—{fmt(weekDates[6])}</span>
              <button onClick={()=>shiftW(1)} style={{...Z.m,padding:"3px 5px"}}>▶</button>
              <button onClick={()=>setWeekBase(td())} style={{...Z.m,fontSize:10,fontWeight:600,color:"#0e7490"}}>今天</button></>}
            {scheduleView==="month"&&<><button onClick={()=>setMonthDate(p=>({y:p.m===0?p.y-1:p.y,m:p.m===0?11:p.m-1}))} style={{...Z.m,padding:"3px 5px"}}>◀</button>
              <span style={{fontSize:11,fontWeight:700,color:"#0c4a6e",minWidth:80,textAlign:"center"}}>{monthDate.y+"/"+(monthDate.m+1)}</span>
              <button onClick={()=>setMonthDate(p=>({y:p.m===11?p.y+1:p.y,m:p.m===11?0:p.m+1}))} style={{...Z.m,padding:"3px 5px"}}>▶</button>
              <button onClick={()=>{const n=new Date();setMonthDate({y:n.getFullYear(),m:n.getMonth()});}} style={{...Z.m,fontSize:10,fontWeight:600,color:"#0e7490"}}>本月</button></>}
          </div>
          {(isAdmin)&&<div style={{display:"flex",gap:4}}>
            <button onClick={()=>{setEditing({rec:null});openM("rec");}} style={{...Z.b("#0d9488"),borderRadius:6,padding:"5px 9px",fontSize:11}}>定期</button>
            <button onClick={()=>{setEditing({task:null,prefillDate:null});openM("task");}} style={{...Z.b("#0e7490"),borderRadius:6,padding:"5px 9px",fontSize:11}}><Ic.Pl/> 單次</button>
          </div>}
        </div>

        {/* Week View */}
        {scheduleView==="week"&&<div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3,background:"#fff",borderRadius:9,padding:6,boxShadow:"0 2px 10px rgba(0,40,80,.04)",border:"1px solid #e2e8f0"}}>
          {weekDates.map((date,di)=>{const isT=date===td();const dt=tfd(date);
            return <div key={date} style={{minHeight:90,maxHeight:200,borderRadius:6,padding:4,background:isT?"#f0fdfa":"#fafbfc",border:isT?"1.5px solid #14b8a6":"1px solid #f1f5f9",overflowY:"auto"}}>
              <div onClick={()=>setDayDetail(date)} style={{fontSize:9,fontWeight:700,marginBottom:3,textAlign:"center",color:isT?"#0d9488":"#94a3b8",cursor:"pointer"}}>
                <span style={{display:"block",fontSize:8}}>{"週"+DN[new Date(date).getDay()]}</span>
                <span style={{display:"inline-block",fontSize:12,fontWeight:900,color:isT?"#fff":"#475569",background:isT?"#0d9488":"transparent",borderRadius:10,width:20,height:20,lineHeight:"20px"}}>{new Date(date).getDate()}</span></div>
              {dt.map(task=>{const svc=gS(task.serviceType);
                return <div key={task.id} className="tc" onClick={()=>setDayDetail(date)} style={{background:svc.bg,borderLeft:"2px solid "+svc.color,borderRadius:3,padding:"2px 4px",marginBottom:2,cursor:"pointer",fontSize:8}}>
                  <div style={{fontWeight:700,color:svc.color}}>{task.time||"--:--"}{task.isRecurring?" 🔄":""}{task.done?" ✅":""}</div>
                  <div style={{color:"#334155",fontWeight:600}}>{gC(task.customerId)?.name||"?"}</div>
                  <div style={{color:"#94a3b8",fontSize:7}}>{gT(task.techId)?.name}</div></div>;})}
              {dt.length===0&&<div style={{fontSize:8,color:"#cbd5e1",textAlign:"center",marginTop:6}}>—</div>}
              {dt.length>2&&<div style={{textAlign:"center",fontSize:7,color:"#94a3b8"}}>點擊展開</div>}
            </div>;})}
        </div>}

        {/* Month View */}
        {scheduleView==="month"&&<div style={{background:"#fff",borderRadius:9,padding:6,boxShadow:"0 2px 10px rgba(0,40,80,.04)",border:"1px solid #e2e8f0"}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:1,marginBottom:2}}>
            {["一","二","三","四","五","六","日"].map(d=><div key={d} style={{textAlign:"center",fontSize:9,fontWeight:700,color:"#94a3b8",padding:2}}>{d}</div>)}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:1}}>
            {monthDays(monthDate.y,monthDate.m).map((date,i)=>{const d=new Date(date);const inMonth=d.getMonth()===monthDate.m;const isT=date===td();const dt=tfd(date);
              return <div key={i} onClick={()=>setDayDetail(date)} style={{minHeight:50,padding:2,borderRadius:4,background:isT?"#f0fdfa":inMonth?"#fff":"#f8fafc",border:isT?"1.5px solid #14b8a6":"1px solid #f1f5f9",cursor:"pointer",opacity:inMonth?1:.5,overflowY:"auto",maxHeight:80}}>
                <div style={{fontSize:9,fontWeight:isT?900:600,color:isT?"#0d9488":"#475569",textAlign:"center"}}>{d.getDate()}</div>
                {dt.slice(0,3).map(task=>{const svc=gS(task.serviceType);return <div key={task.id} style={{background:svc.bg,borderLeft:"2px solid "+svc.color,borderRadius:2,padding:"1px 2px",marginBottom:1,fontSize:7}}><span style={{fontWeight:700,color:svc.color}}>{task.time||"--"}</span> {gC(task.customerId)?.name?.slice(0,4)}</div>;})}
                {dt.length>3&&<div style={{fontSize:7,color:"#94a3b8",textAlign:"center"}}>+{dt.length-3}</div>}
              </div>;})}
          </div>
        </div>}
      </div>}

      {/* ══════ TODAY ══════ */}
      {tab==="today"&&<div style={{paddingTop:12,paddingBottom:28}}>
        <div style={{fontSize:12,fontWeight:700,color:"#0c4a6e",marginBottom:8}}>{new Date().toLocaleDateString("zh-TW",{year:"numeric",month:"long",day:"numeric",weekday:"long"})} <span style={{fontSize:10,background:"#ecfeff",color:"#0e7490",padding:"1px 6px",borderRadius:12}}>{todayT.length+"項"}</span></div>
        {activeTechs.filter(t=>visTechs.includes(t.id)).map(tech=>{const tt=todayT.filter(t=>t.techId===tech.id);
          return <div key={tech.id} style={{background:"#fff",borderRadius:9,padding:"10px 12px",marginBottom:8,border:"1px solid #e2e8f0"}}>
            <div style={{fontWeight:700,fontSize:12,marginBottom:5,paddingBottom:5,borderBottom:"1px solid #f1f5f9"}}>{tech.name} <span style={{fontWeight:500,color:"#94a3b8",fontSize:10}}>{tt.length+"項"}</span></div>
            {tt.length===0&&<div style={{color:"#cbd5e1",fontSize:11,textAlign:"center",padding:8}}>無排程</div>}
            {tt.map((task,i)=><div key={task.id} style={{borderBottom:i<tt.length-1?"1px solid #f1f5f9":"none"}}><TaskCard task={task} date={td()}/></div>)}
          </div>;})}
      </div>}

      {/* ══════ RECURRING ══════ */}
      {tab==="recurring"&&isAdmin&&<div style={{paddingTop:12,paddingBottom:28}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <span style={{fontSize:12,fontWeight:700,color:"#0c4a6e"}}>{"定期排程 "+recurring.length+"組"}</span>
          <button onClick={()=>{setEditing({rec:null});openM("rec");}} style={{...Z.b("#0d9488"),borderRadius:6}}><Ic.Pl/> 新增</button></div>
        {recurring.map(r=>{const svc=gS(r.serviceType);const cust=gC(r.customerId);
          return <div key={r.id} style={{background:"#fff",borderRadius:8,padding:"8px 12px",marginBottom:6,border:"1px solid #e2e8f0",borderLeft:"3px solid "+svc.color,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:4}}>
            <div><div style={{fontWeight:700,fontSize:12,color:"#0c4a6e"}}>{cust?.name} <span style={{fontSize:9,color:svc.color,background:svc.bg,padding:"0 3px",borderRadius:3}}>{svc.label}</span></div>
              <div style={{fontSize:10,fontWeight:600,color:"#0d9488",marginTop:1}}>{fL(r.frequency)+" "+dL(r.dayOfWeek)+" "+(r.time||"時間未定")}</div>
              <div style={{fontSize:9,color:"#64748b"}}>{gT(r.techId)?.name}</div></div>
            <div style={{display:"flex",gap:3}}><button onClick={()=>{setEditing({rec:r});openM("rec");}} style={Z.m}><Ic.Ed/></button><button onClick={()=>upd("recurring",p=>p.filter(x=>x.id!==r.id))} style={{...Z.m,color:"#ef4444"}}><Ic.Tr/></button></div>
          </div>;})}
      </div>}

      {/* ══════ CUSTOMERS ══════ */}
      {tab==="customers"&&isAdmin&&<div style={{paddingTop:12,paddingBottom:28}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6,flexWrap:"wrap",gap:4}}>
          <span style={{fontSize:12,fontWeight:700,color:"#0c4a6e"}}>{"客戶 "+customers.length+"位"}</span>
          <div style={{display:"flex",gap:3}}>
            <label style={{...Z.b("#f0f9ff","#0369a1"),borderRadius:6,cursor:"pointer",border:"1.5px solid #bfdbfe",fontSize:10}}>📄CSV<input type="file" accept=".csv" style={{display:"none"}} onChange={e=>{if(e.target.files[0])importCSV(e.target.files[0]);e.target.value="";}}/></label>
            <button onClick={()=>{setEditing({cust:null});openM("cust");}} style={{...Z.b("#0e7490"),borderRadius:6,fontSize:10}}><Ic.Pl/> 新增</button></div></div>
        {importMsg&&<div style={{marginBottom:5,padding:"3px 7px",borderRadius:5,fontSize:10,fontWeight:600,background:importMsg.startsWith("✅")?"#f0fdf4":"#fef2f2",color:importMsg.startsWith("✅")?"#16a34a":"#dc2626"}}>{importMsg}</div>}
        {customers.sort((a,b)=>(a.order||0)-(b.order||0)).map((c,ci)=><div key={c.id} style={{background:"#fff",borderRadius:8,padding:"8px 12px",marginBottom:5,border:"1px solid #e2e8f0",display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:4}}>
          <div style={{flex:1,minWidth:120}}>
            <div style={{fontWeight:700,fontSize:12,color:"#0c4a6e"}}>{c.code&&<span style={{color:"#94a3b8",fontSize:10}}>{"["+c.code+"] "}</span>}{c.name} <span style={{fontSize:9,color:"#94a3b8"}}>{"🐠"+c.tanks}</span></div>
            <div style={{fontSize:10,color:"#64748b"}}>{c.address}</div>
            {c.contact&&<div style={{fontSize:10,color:"#475569",marginTop:1}}>{"👤"+c.contact}{c.contactPhone&&<span style={{marginLeft:3}}><PhLink n={c.contactPhone}/></span>}</div>}
            {(c.siteContact||c.sitePhone)&&<div style={{fontSize:10,color:"#0369a1",background:"#f0f9ff",padding:"1px 4px",borderRadius:3,display:"inline-flex",gap:4,marginTop:1}}>{"👷"+(c.siteContact||"")}{c.sitePhone&&<PhLink n={c.sitePhone}/>}</div>}
            <div style={{display:"flex",gap:5,fontSize:9,color:"#94a3b8",marginTop:1,flexWrap:"wrap"}}>
              {c.fax&&<span>{"📠"+c.fax}</span>}
              {c.email&&<a href={"mailto:"+c.email} style={{color:"#0369a1",textDecoration:"underline"}}>{"✉️"+c.email}</a>}
            </div>
          </div>
          <div style={{display:"flex",gap:2,alignItems:"center"}}>
            <div style={{display:"flex",flexDirection:"column",gap:1}}><button disabled={ci===0} onClick={()=>{const sorted=[...customers].sort((a,b)=>(a.order||0)-(b.order||0));upd("customers",mv(sorted,ci,ci-1).map((x,i)=>({...x,order:i})));}} style={{...Z.m,padding:"1px 2px",opacity:ci===0?.3:1}}><Ic.Up/></button><button disabled={ci===customers.length-1} onClick={()=>{const sorted=[...customers].sort((a,b)=>(a.order||0)-(b.order||0));upd("customers",mv(sorted,ci,ci+1).map((x,i)=>({...x,order:i})));}} style={{...Z.m,padding:"1px 2px",opacity:ci===customers.length-1?.3:1}}><Ic.Dn/></button></div>
            <button onClick={()=>{setEditing({cust:c});openM("cust");}} style={Z.m}><Ic.Ed/></button>
            <button onClick={()=>{upd("customers",p=>p.filter(x=>x.id!==c.id));upd("tasks",p=>p.filter(t=>t.customerId!==c.id));upd("recurring",p=>p.filter(r=>r.customerId!==c.id));}} style={{...Z.m,color:"#ef4444"}}><Ic.Tr/></button>
          </div>
        </div>)}
      </div>}

      {/* ══════ NOTIFICATIONS ══════ */}
      {tab==="notif"&&isAdmin&&<div style={{paddingTop:12,paddingBottom:28}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <span style={{fontSize:12,fontWeight:700,color:"#0c4a6e"}}>通知 {unreadN>0&&<span style={{fontSize:10,background:"#fef2f2",color:"#dc2626",padding:"1px 6px",borderRadius:10}}>{unreadN+"未讀"}</span>}</span>
          {unreadN>0&&<button onClick={()=>upd("notifications",prev=>(prev||[]).map(n=>({...n,read:true})))} style={{...Z.b("#f1f5f9","#475569"),fontSize:10}}>全部已讀</button>}
        </div>
        {(notifications||[]).length===0&&<div style={{textAlign:"center",padding:20,color:"#94a3b8"}}>暫無通知</div>}
        {(notifications||[]).map(n=><div key={n.id} style={{background:n.read?"#fff":"#eff6ff",borderRadius:7,padding:"8px 10px",marginBottom:4,border:"1px solid "+(n.read?"#e2e8f0":"#bfdbfe"),display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div><div style={{fontSize:11,fontWeight:n.read?500:700,color:"#1e293b"}}>{n.msg}</div><div style={{fontSize:9,color:"#94a3b8"}}>{n.time} · {gT(n.by)?.name||"管理員"}</div></div>
          {!n.read&&<button onClick={()=>upd("notifications",prev=>(prev||[]).map(x=>x.id===n.id?{...x,read:true}:x))} style={{...Z.m,fontSize:9,color:"#0369a1"}}>已讀</button>}
        </div>)}
      </div>}
    </div>

    {/* Modals */}
    <Modal open={modals.task} onClose={()=>closeM("task")} title={editing.task?"編輯":"新增排程"} wide><TaskForm onClose={()=>closeM("task")} initial={editing.task}/></Modal>
    <Modal open={modals.rec} onClose={()=>closeM("rec")} title={editing.rec?"編輯定期":"新增定期"} wide><RecForm onClose={()=>closeM("rec")} initial={editing.rec}/></Modal>
    <Modal open={modals.cust} onClose={()=>closeM("cust")} title={editing.cust?"編輯客戶":"新增客戶"} wide><CustForm onClose={()=>closeM("cust")} initial={editing.cust}/></Modal>
    {isAdmin&&<Modal open={modals.tech} onClose={()=>closeM("tech")} title="技師管理" wide><TechEditor onClose={()=>closeM("tech")}/></Modal>}
    {isAdmin&&<Modal open={modals.svc} onClose={()=>closeM("svc")} title="服務類型" wide><SvcEditor onClose={()=>closeM("svc")}/></Modal>}
    {isAdmin&&<Modal open={modals.appCfg} onClose={()=>closeM("appCfg")} title="系統設定" wide><AppCfg onClose={()=>closeM("appCfg")}/></Modal>}
    <PinChg open={modals.pin} onClose={()=>closeM("pin")} curPin={isAdmin?adminPin:curTP} onSave={p=>{if(isAdmin&&!myId)upd("adminPin",p);else upd("technicians",prev=>prev.map(t=>t.id===myId?{...t,pin:p}:t));}} title="變更PIN"/>
  </div>;
}
