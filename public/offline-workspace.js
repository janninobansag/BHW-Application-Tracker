import { activeWorkerId, readWorkerContents, effectiveWorkerRecords, prepareWorkerWorkspace, syncAllWorkerChanges } from "/worker-offline-store.js";
import { renderOfflineHouseholds, renderOfflineHouseholdSummary } from "/offline-households.js";

const $ = (id) => document.getElementById(id);
function element(tag, className = "", text = "") {
  const node = document.createElement(tag); node.className = className; node.textContent = text; return node;
}
function link(href, text, className = "") { const node = element("a", className, text); node.href = href; return node; }
function age(birthday, today) { const [y,m,d] = today.split("-").map(Number); const [by,bm,bd] = birthday.split("-").map(Number); return (y-by)*12+m-bm-(d<bd?1:0); }
function today() { return new Intl.DateTimeFormat("en-CA", { timeZone:"Asia/Manila", year:"numeric", month:"2-digit", day:"2-digit" }).format(new Date()); }
const destinations = [["/dashboard", "Dashboard"], ["/", "Vitamin A & Deworming"], ["/worker-portfolio", "Household Profiling"], ["/operation-timbang", "Operation Timbang"], ["/notifications", "Notifications"]];

function navigation(route) {
  const nav = document.querySelector(".sidebar .side-nav");
  nav.id = "offline-navigation"; nav.setAttribute("aria-label", "Workspace navigation"); nav.replaceChildren();
  for (const [href, label] of destinations) {
    const item = link(href, label);
    const active = route.view === "registry" ? href === (route.program === "timbang" ? "/operation-timbang" : "/") : href === `/${route.view.startsWith("portfolio") ? "worker-portfolio" : route.view}`;
    if (active) item.setAttribute("aria-current", "page");
    nav.append(item);
  }
  const host = element("div"); nav.before(host);
  const mobile = document.querySelector(".mobile-header-links"); mobile.replaceChildren();
  const trigger = element("button", "mobile-workspace-trigger", "☰"); trigger.type = "button";
  trigger.setAttribute("aria-label", "Open workspace navigation"); trigger.setAttribute("aria-controls", nav.id); trigger.setAttribute("aria-expanded", "false");
  mobile.append(trigger);
  const native = "showPopover" in nav;
  const media = matchMedia("(max-width: 760px)");
  function position() {
    if (native && nav.matches(":popover-open")) nav.hidePopover();
    nav.classList.toggle("offline-mobile-nav", media.matches);
    if (media.matches) { document.body.append(nav); if (native) { nav.setAttribute("popover", "auto"); trigger.setAttribute("popovertarget", nav.id); } else nav.hidden = true; }
    else { nav.removeAttribute("popover"); trigger.removeAttribute("popovertarget"); nav.hidden = false; host.append(nav); }
    trigger.setAttribute("aria-expanded", "false");
  }
  trigger.addEventListener("click", () => { if (!native) { nav.hidden = !nav.hidden; trigger.setAttribute("aria-expanded", String(!nav.hidden)); } });
  nav.addEventListener("toggle", (event) => trigger.setAttribute("aria-expanded", String(event.newState === "open")));
  nav.addEventListener("keydown", (event) => { if (event.key === "Escape" && !native) { nav.hidden = true; trigger.setAttribute("aria-expanded", "false"); trigger.focus(); } });
  media.addEventListener("change", position); position();
  for (const selector of [".sidebar .brand", ".topbar .mobile-brand"]) {
    const old = document.querySelector(selector); const logo = link("/dashboard", "", old.className);
    logo.setAttribute("aria-label", "BHW Records dashboard"); logo.append(...old.childNodes); old.replaceWith(logo);
  }
}

function registryCard(program, contents) {
  const title = program === "timbang" ? "Operation Timbang" : "Vitamin A & Deworming";
  const path = program === "timbang" ? "/operation-timbang" : "/";
  const card = element("article", "dashboard-registry");
  const heading = element("div", "dashboard-registry-heading"); heading.append(element("h2", "", title)); card.append(heading);
  if (contents) {
    const records = effectiveWorkerRecords(contents);
    const count = element("div", "dashboard-record-count"); count.append(element("strong", "", String(records.length)), element("span", "", "records on this device"));
    const totals = element("dl", "dashboard-sex-totals");
    for (const [sex,label] of [["M","Male"],["F","Female"]]) { const group=element("div"); group.append(element("dt","",label),element("dd","",String(records.filter(record=>record.sex===sex).length))); totals.append(group); }
    card.append(count,totals);
  } else card.append(element("p", "dashboard-section-description", "This registry has not been saved on this device yet."));
  card.append(link(path, `Open ${title}`, "dashboard-registry-link")); return card;
}

function dashboard(root, copies) {
  const cards = element("section", "dashboard-registries"); cards.setAttribute("aria-label", "Your registries");
  cards.append(registryCard("deworming", copies[0]), registryCard("timbang", copies[1])); root.append(cards);
  const records = effectiveWorkerRecords(copies[1]);
  const missing = records.filter(record=>["weight","height","muac"].some(field=>record[field]===null||record[field]===undefined||record[field]===""));
  const section = element("section", "dashboard-section"); const heading=element("header"); heading.append(element("h2","","Measurements to complete"),element("span","dashboard-section-count",String(missing.length))); section.append(heading);
  const list=element("ul","dashboard-review-list");
  for(const record of missing.slice(0,4)){const row=element("li");const item=link(`/operation-timbang/${encodeURIComponent(record.id)}`,"", "offline-dashboard-record");const copy=element("span","dashboard-review-copy");copy.append(element("strong","",record.name),element("small","","Complete weight, height, or MUAC"));item.append(copy);row.append(item);list.append(row);}
  section.append(list); if(!missing.length)section.append(element("p","dashboard-section-description",records.length?"All saved measurements are complete.":"No Operation Timbang records saved yet."));
  const footer=element("footer");footer.append(link("/operation-timbang","Open Operation Timbang"));section.append(footer); root.append(section);
  const coverage=copies.find(Boolean)?.snapshot;
  if(coverage){const panel=element("section","dashboard-section");const title=element("header");title.append(element("h2","","Assigned communities"));panel.append(title);const groups=element("ul","dashboard-coverage-list");
    for(const barangay of coverage.barangays){const group=element("li");group.append(element("strong","",barangay.name));const entries=element("ul");for(const purok of coverage.puroks.filter(item=>item.barangay_id===barangay.id)){const row=element("li");row.append(link(`/?barangay=${encodeURIComponent(barangay.id)}&purok=${encodeURIComponent(purok.id)}`,purok.name));entries.append(row);}group.append(entries);groups.append(group);}panel.append(groups);root.append(panel);}
}

function notifications(root, contents, userId) {
  const readKey=`bhw-age-notifications:${userId}`;
  let read=[];try{read=JSON.parse(localStorage.getItem(readKey)||"[]");if(!Array.isArray(read))read=[];}catch{}
  const ids=[];const list=element("ul","notification-page-list");
  for(let offset=0;offset<7;offset++){
    const date=new Date(`${today()}T12:00:00Z`);date.setUTCDate(date.getUTCDate()-offset);const day=date.toISOString().slice(0,10);date.setUTCDate(date.getUTCDate()-1);const before=date.toISOString().slice(0,10);
    for(const child of effectiveWorkerRecords(contents))if(child.birthday<=before&&age(child.birthday,day)>age(child.birthday,before)){
      ids.push(`${child.id}:${day}`);const row=element("li");const item=link(`/records/${encodeURIComponent(child.id)}`,"","notification-page-item offline-notification-item is-read");const copy=element("span","notification-page-copy");copy.append(element("strong","",child.name),element("span","",`Reached ${age(child.birthday,day)} months old`));item.append(copy,element("span","notification-page-meta",`${day} · Read`));row.append(item);list.append(row);
    }
  }
  root.className="panel notification-page-panel";root.append(list);
  if(!ids.length)root.append(element("p","dashboard-section-empty","No age updates in the last 7 days."));
  try{localStorage.setItem(readKey,JSON.stringify([...new Set([...read.filter(id=>typeof id==="string"),...ids])]));}catch{}
}

export async function mountOfflineWorkspace(route) {
  let copies;
  const userId=activeWorkerId();
  try {
    copies=await Promise.all([readWorkerContents(),readWorkerContents("timbang"),readWorkerContents("households")]);
    if(!userId||activeWorkerId()!==userId||!copies.some(Boolean))throw new Error("Sign in as a worker while online once to save both registries on this device.");
  }catch(error){$("access-loading").hidden=true;$("access-content").hidden=false;$("access-message").textContent=error.message;$("access-message").hidden=false;return false;}
  const current=copies[route.program==="timbang"?1:0];const identity=copies.find(Boolean).snapshot.user;
  navigation(route);
  $("workspace-title").textContent=route.title;document.title=`${route.title} | BHW Records`;
  document.querySelector(".desktop-header-context strong").textContent=route.title;
  document.querySelectorAll(".page-heading .eyebrow,.page-heading .page-description,#welcome").forEach(node=>node.remove());
  document.querySelector(".page-heading").classList.add("compact-page-heading");
  document.querySelector(".page-heading").append(document.querySelector(".sync-status-row"));
  $("worker-name").textContent=identity.display_name;$("worker-avatar").textContent=identity.display_name.charAt(0).toUpperCase();$("account-name").textContent=identity.display_name;
  $("access-panel").hidden=true;$("workspace").hidden=false;
  if(route.view==="registry"&&current)return true;
  document.querySelector(".stats-grid").hidden=true;$("registry-grid").hidden=true;$("snapshot-date").hidden=true;$("conflicts").hidden=true;
  const root=element("div","worker-dashboard");document.querySelector("main.content").append(root);
  let editorRendered=false;
  function render(){
    if(route.view==="portfolio"&&route.recordId&&editorRendered)return;
    root.replaceChildren();
    if(!current&&route.view==="registry")root.append(element("p","notice","This registry has not been saved on this device yet. Connect once to download it; your other pages remain available."));
    else if(route.view==="dashboard")dashboard(root,copies);
    else if(route.view==="notifications")notifications(root,copies[0],userId);
    else if(route.view==="portfolio-summary")renderOfflineHouseholdSummary(root,copies[2]);
    else if(route.view==="portfolio") { renderOfflineHouseholds(root,copies[2],route,()=>location.assign("/offline.html?view=portfolio")); editorRendered=Boolean(route.recordId); }
    else root.append(element("p","panel workspace-coming-soon","Coming soon"));
    const pending=copies.reduce((sum,copy)=>sum+(copy?.pending.length||0),0);
    $("connection-status").textContent=navigator.onLine?"Online":"Offline";$("count-pending").textContent=pending?`${pending} changes waiting to sync`:"";$("sync-button").hidden=!pending;$("sync-button").disabled=!navigator.onLine;
  }
  let busy=false;
  async function refresh(){
    if(busy||!navigator.onLine||activeWorkerId()!==userId)return;
    busy=true;try{
      if(copies.some(copy=>!copy))await prepareWorkerWorkspace(userId,()=>activeWorkerId()===userId);
      await syncAllWorkerChanges();
      copies=await Promise.all([readWorkerContents(),readWorkerContents("timbang"),readWorkerContents("households")]);
      if(activeWorkerId()!==userId)return;
      if(route.view==="registry"&&copies[route.program==="timbang"?1:0]){location.reload();return;}
      const key=`bhw-age-notifications:${userId}`;let ids=[];try{ids=JSON.parse(localStorage.getItem(key)||"[]");}catch{}
      if(Array.isArray(ids)&&ids.length)await fetch("/api/backend/notifications/age/read",{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({ids:ids.filter(id=>typeof id==="string").slice(-500)}),cache:"no-store"});
      render();
    }catch{$("connection-status").textContent="Changes saved on this device";}finally{busy=false;}
  }
  $("account-button").addEventListener("click",()=>$("account-dialog").showModal());$("account-close").addEventListener("click",()=>$("account-dialog").close());
  $("sync-button").addEventListener("click",refresh);window.addEventListener("online",refresh);window.addEventListener("focus",refresh);window.addEventListener("offline",render);
  window.addEventListener("storage",()=>{if(activeWorkerId()!==userId){$("workspace").hidden=true;$("access-loading").hidden=true;$("access-content").hidden=false;$("access-panel").hidden=false;root.replaceChildren();}});
  setInterval(refresh,30000);render();if(navigator.onLine)void refresh();return false;
}
