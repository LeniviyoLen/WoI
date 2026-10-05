(function(){
const CFG = window.WOI_CONFIG, D = window.WOI_DATA;
const $ = id => document.getElementById(id);
const MAX_LVL = 100, XP_PER_DAY = 100, DAY = 86400000;

const STATS = [["str","Сила"],["agi","Ловкость"],["int","Интеллект"],["wis","Мудрость"],["cha","Харизма"]];
const CLASSES = {
  berserk:{name:"Берсерк", rates:{str:.5,agi:.3,int:.1,wis:.1,cha:.1}, desc:"Тяжёлая броня, щит и меч, ближний бой",
           elemental:"Стихийное усиление оружия или брони (если есть стихия)"},
  archer: {name:"Лучник",  rates:{str:.1,agi:.5,int:.1,wis:.3,cha:.1}, desc:"Лёгкая/средняя броня, лук, дальний бой",
           elemental:"Стихийные стрелы или ловушки (если есть стихия)"},
  mage:   {name:"Маг",     rates:{str:.1,agi:.1,int:.5,wis:.3,cha:.1}, desc:"Заклинания и катализатор, базовое лечение"},
  hybrid: {name:"Гибрид",  rates:{str:.3,agi:.3,int:.1,wis:.1,cha:.3}, desc:"Средний во всём, без стихий и магии"}
};
const ELEMENTAL_LVLS = [25,60,90];

// ---------- storage ----------
const load = () => JSON.parse(localStorage.getItem("woi_chars") || "{}");
const save = all => localStorage.setItem("woi_chars", JSON.stringify(all));
const session = () => JSON.parse(localStorage.getItem("woi_session") || "null");
function getChar(){ const s = session(); return s ? load()[s.id] : null; }
function putChar(c){ const all = load(); all[session().id] = c; save(all); }

// ---------- math ----------
const xpForLevel = L => 100 * Math.pow(L - 1, 1.5);
function calc(c){
  const days = Math.max(0, (Date.now() - new Date(c.regDate).getTime()) / DAY);
  const bonus = Number((CFG.bonusXp || {})[c.nick] || 0);
  const xp = days * XP_PER_DAY + bonus;
  let lvl = 1;
  while (lvl < MAX_LVL && xp >= xpForLevel(lvl + 1) - 1e-9) lvl++;
  const res = {days, xp, lvl};
  if (lvl < MAX_LVL){
    const a = xpForLevel(lvl), b = xpForLevel(lvl + 1);
    res.progress = (xp - a) / (b - a);
    res.daysLeft = (b - xp) / XP_PER_DAY;
  } else { res.progress = 1; res.daysLeft = 0; }
  const r = CLASSES[c.cls].rates;
  res.stats = {};
  STATS.forEach(([k]) => res.stats[k] = 10 + r[k] * (lvl - 1));
  return res;
}
const fmt = n => (Math.round(n * 10) / 10).toString().replace(".", ",");
function plural(n, a, b, c){ n = Math.floor(Math.abs(n)); const m10=n%10, m100=n%100;
  return m10==1&&m100!=11 ? a : (m10>=2&&m10<=4&&(m100<10||m100>=20) ? b : c); }

// ---------- screens ----------
function show(id){ ["welcome","register","main"].forEach(s => $(s).classList.toggle("hidden", s !== id)); }

function route(){
  if (!session()) return showWelcome();
  if (!getChar()) return showRegister();
  showMain();
}

function showWelcome(){
  show("welcome");
  $("enter-btn").onclick = () => {
    localStorage.setItem("woi_session", JSON.stringify({id:"local"}));
    route();
  };
}

let pickedClass = null;
function showRegister(){
  show("register");
  const box = $("class-pick"); box.innerHTML = "";
  Object.entries(CLASSES).forEach(([k, c]) => {
    const b = document.createElement("button"); b.type = "button"; b.className = "cls-opt";
    b.innerHTML = `<b>${c.name}</b><small>${c.desc}</small>`;
    b.onclick = () => { pickedClass = k; [...box.children].forEach(x => x.classList.remove("active")); b.classList.add("active"); };
    box.appendChild(b);
  });
  const now = new Date(); now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  $("reg-form").regDate.max = now.toISOString().slice(0,16);
}
$("reg-form").addEventListener("submit", e => {
  e.preventDefault();
  const f = e.target;
  if (!pickedClass) return alert("Выбери класс");
  const reg = new Date(f.regDate.value);
  if (isNaN(reg) || reg > new Date()) return alert("Дата регистрации не может быть в будущем");
  if (!confirm(`Класс «${CLASSES[pickedClass].name}» и дату регистрации потом сменить нельзя. Всё верно?`)) return;
  putChar({nick:f.nick.value.trim(), profile:f.profile.value.trim(), cls:pickedClass,
           regDate:reg.toISOString(), skills:[], created:new Date().toISOString()});
  showMain();
});

function monsterFor(lvl){
  let m = D.monsters[0];
  D.monsters.forEach(x => { if (x.lvl <= lvl) m = x; });
  return m;
}
function pendingTiers(c, lvl){
  const taken = new Set(c.skills.map(s => s.tier));
  const t = []; for (let L = 5; L <= lvl; L += 5) if (!taken.has(L)) t.push(L);
  return t;
}

function showMain(){
  show("main");
  const c = getChar(), r = calc(c), cl = CLASSES[c.cls];
  $("p-nick").textContent = c.nick;
  $("p-class").textContent = cl.name;
  $("p-profile").href = c.profile;
  $("p-lvl").textContent = `LVL ${r.lvl}`;

  $("p-stats").innerHTML = STATS.map(([k, n]) => {
    const role = cl.rates[k] === .5 ? "dom" : cl.rates[k] === .3 ? "sub" : "";
    return `<div class="stat ${role}"><div class="k">${n}</div><div class="v">${fmt(r.stats[k])}</div></div>`;
  }).join("");

  $("lv-cur").textContent = r.lvl;
  $("lv-next").textContent = r.lvl < MAX_LVL ? r.lvl + 1 : "MAX";
  $("lv-fill").style.width = (r.progress * 100).toFixed(1) + "%";
  const d = Math.floor(r.days);
  $("p-days").textContent = r.lvl < MAX_LVL
    ? `Прошло ${d} ${plural(d,"день","дня","дней")} / до нового лвл ${fmt(r.daysLeft)} ${plural(Math.ceil(r.daysLeft),"день","дня","дней")}`
    : `Прошло ${d} ${plural(d,"день","дня","дней")} · максимальный уровень`;

  const m = monsterFor(r.lvl);
  $("p-monsters").innerHTML = `Опасность (CR): <span class="cr">${m.cr}</span><div class="muted">${m.ex}</div>`;

  const pend = pendingTiers(c, r.lvl);
  $("p-pick-btns").innerHTML = "";
  pend.forEach(t => {
    const b = document.createElement("button"); b.className = "btn pick";
    b.textContent = "＋ Выбрать новый навык"; b.onclick = () => openPick(t);
    $("p-pick-btns").appendChild(b);
  });
  $("p-skills").innerHTML = c.skills.length
    ? c.skills.slice().sort((a,b) => a.tier - b.tier).map(s => `<li>${s.name}<small class="muted">${s.tier} лвл</small></li>`).join("")
    : (pend.length ? "" : `<li class="muted">Пока пусто. Первый навык на 5 лвл.</li>`);
}

function openPick(tier){
  const c = getChar(), cl = CLASSES[c.cls];
  const opts = (D.skills[c.cls][tier] || []).slice();
  if (cl.elemental && ELEMENTAL_LVLS.includes(tier)) opts.push(cl.elemental);
  $("m-title").textContent = "Выбери новый навык";
  $("m-note").textContent = "Выбор навсегда, изменить потом нельзя.";
  const box = $("m-options"); box.innerHTML = "";
  opts.forEach(name => {
    const b = document.createElement("button"); b.className = "opt"; b.textContent = name;
    b.onclick = () => {
      if (!confirm(`Взять «${name}»? Отменить будет нельзя.`)) return;
      const ch = getChar();
      if (ch.skills.some(s => s.tier === tier)) return closeModal();
      ch.skills.push({tier, name, at:new Date().toISOString()}); putChar(ch);
      closeModal(); showMain();
    };
    box.appendChild(b);
  });
  $("modal").classList.remove("hidden");
}
function closeModal(){ $("modal").classList.add("hidden"); }
$("m-close").onclick = closeModal;
$("modal").onclick = e => { if (e.target.id === "modal") closeModal(); };
$("logout").onclick = () => { localStorage.removeItem("woi_session"); route(); };

// ---------- init ----------
if (CFG.background){ const bg = $("bg"); bg.style.backgroundImage = `url("${CFG.background}")`; }
$("lnk-life").href = CFG.links.life; $("lnk-tiktok").href = CFG.links.tiktok; $("lnk-donate").href = CFG.links.donate;
setInterval(() => { if (!$("main").classList.contains("hidden") && $("modal").classList.contains("hidden")) showMain(); }, 60000);
route();
})();
