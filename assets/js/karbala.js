// ─────────────────────────────────────────────
//  JOURNEY DATA  (61 AH / 680 CE)
// ─────────────────────────────────────────────
const JOURNEY = [
{
    id: 0,
    name: "Medina",
    arabic: "المدينة المنورة",
    type: "departure",
    coords: [24.4672, 39.6111],
    month: "Rajab 60 AH",
    distanceFromPrev: null,
    distanceTotalKm: 0,
    bio: "Imam Hussain (AS) departed from the city of the Prophet ﷺ after refusing to pledge allegiance to Yazid ibn Muawiyah. In the darkness of the night of the 28th of Rajab 60 AH, he bid farewell to the grave of his grandfather and began one of history's most sacred journeys, accompanied by his family and close companions.",
    companions: [
    { name: "Abbas ibn Ali", arabic: "عباس بن علي", role: "Brother & Standard-Bearer" },
    { name: "Ali ibn Hussain (Sajjad)", arabic: "علي بن حسين", role: "Son (ill during battle)" },
    { name: "Zainab bint Ali", arabic: "زينب بنت علي", role: "Sister" },
    { name: "Muslim ibn Aqil", arabic: "مسلم بن عقيل", role: "Cousin & Envoy to Kufa" },
    { name: "Habib ibn Mazahir", arabic: "حبيب بن مظاهر", role: "Loyal Companion" },
    ],
    events: [
    { label: "28 Rajab 60 AH", title: "Departure from Medina", desc: "Hussain (AS) leaves in the night, refusing to give bay'ah (allegiance) to Yazid. He visits the Prophet's grave, prays, and departs with his household." },
    { label: "Context", title: "The Refusal", desc: "The governor of Medina, Walid ibn Utba, summoned Hussain (AS) to demand allegiance to Yazid. Hussain replied: 'A man like me does not give allegiance to a man like him.'" },
    ]
},
{
    id: 1,
    name: "Mecca",
    arabic: "مكة المكرمة",
    type: "waypoint",
    coords: [21.4225, 39.8262],
    month: "Sha'ban 60 AH",
    distanceFromPrev: 450,
    distanceTotalKm: 450,
    bio: "Imam Hussain (AS) arrived in Mecca and resided there for approximately four months. He performed Hajj (or Umrah) and received thousands of letters from the people of Kufa pledging their support. He dispatched his cousin Muslim ibn Aqil to Kufa to assess the situation.",
    companions: [
    { name: "Abdullah ibn Zubayr", arabic: "عبدالله بن الزبير", role: "Met in Mecca" },
    { name: "Muslim ibn Aqil", arabic: "مسلم بن عقيل", role: "Dispatched as envoy to Kufa" },
    ],
    events: [
    { label: "Sha'ban 60 AH", title: "Arrival in Mecca", desc: "Hussain (AS) and his companions take refuge in the sacred sanctuary. His presence draws large gatherings." },
    { label: "Multiple Letters", title: "Letters from Kufa", desc: "Over 12,000 letters arrive from Kufa, inviting Hussain (AS) to lead them. He sends Muslim ibn Aqil ahead to verify their sincerity." },
    { label: "8 Dhul Hijja 60 AH", title: "Departure from Mecca", desc: "Learning of a plot to assassinate him during Hajj and desecrate the sanctuary, Hussain (AS) converts his Hajj to Umrah and departs for Iraq." },
    ]
},
{
    id: 2,
    name: "Tan'im",
    arabic: "التنعيم",
    type: "waypoint",
    coords: [21.4728, 39.7878],
    month: "8 Dhul Hijja 60 AH",
    distanceFromPrev: 9,
    distanceTotalKm: 459,
    bio: "A small station just outside Mecca where Imam Hussain (AS) encountered a caravan of camels carrying goods for Yazid. He redirected them and distributed gifts, further reinforcing his departure from Mecca toward Iraq.",
    companions: [],
    events: [
    { label: "Encounter", title: "Caravan of Yemen", desc: "Hussain (AS) encounters a caravan near Tan'im carrying goods from Yemen. He appropriates the goods to provision his caravan, writing a letter to their owner." },
    ]
},
{
    id: 3,
    name: "Saffah",
    arabic: "الصفاح",
    type: "waypoint",
    coords: [22.5, 40.5],
    month: "Dhul Hijja 60 AH",
    distanceFromPrev: 160,
    distanceTotalKm: 619,
    bio: "A waypoint during the northward journey from Mecca toward Iraq. Here Imam Hussain (AS) encountered the poet al-Farazdaq, who informed him of the dire situation in Kufa — that the hearts of the people were with Hussain but their swords were with Yazid.",
    companions: [],
    events: [
    { label: "Historic Meeting", title: "Meeting al-Farazdaq", desc: "The famous poet al-Farazdaq reports on the mood in Iraq: 'The hearts of people are with you, but their swords are with Banu Umayya.' Hussain (AS) acknowledges this truth yet presses on." },
    ]
},
{
    id: 4,
    name: "Hajiz",
    arabic: "الحاجز",
    type: "waypoint",
    coords: [24.1, 40.9],
    month: "Dhul Hijja 60 AH",
    distanceFromPrev: 185,
    distanceTotalKm: 804,
    bio: "Here Imam Hussain (AS) received news from Kufa via a letter from Muslim ibn Aqil reporting initial success — thousands had pledged allegiance. This strengthened the resolve of the caravan. However, within days the situation in Kufa would dramatically reverse.",
    companions: [],
    events: [
    { label: "Good News", title: "Letter from Muslim ibn Aqil", desc: "Hussain (AS) receives an optimistic letter from Muslim ibn Aqil reporting 18,000 pledges of loyalty from the people of Kufa. Hussain (AS) is encouraged to hasten." },
    ]
},
{
    id: 5,
    name: "Zarud",
    arabic: "زرود",
    type: "event",
    coords: [26.3, 42.2],
    month: "Muharram 61 AH",
    distanceFromPrev: 260,
    distanceTotalKm: 1064,
    bio: "A critical moment in the journey. Here Imam Hussain (AS) received news of the martyrdom of his cousin and envoy, Muslim ibn Aqil, and the killing of Hani ibn Urwa in Kufa. Ibn Aqil had been arrested and executed at the orders of the newly appointed governor Ubaydullah ibn Ziyad.",
    companions: [
    { name: "Muslim ibn Aqil (shaheed)", arabic: "مسلم بن عقيل (شهيد)", role: "Cousin & Envoy — Martyred in Kufa" },
    ],
    events: [
    { label: "Tragic News", title: "Martyrdom of Muslim ibn Aqil", desc: "Hussain (AS) learns that Muslim ibn Aqil was captured, tortured, and thrown from the palace of Kufa. Hani ibn Urwa was also executed. He recites Inna lillahi wa inna ilayhi raji'un." },
    { label: "Decision Point", title: "Hussain Continues", desc: "Despite the heartbreaking news and warnings to turn back, Imam Hussain (AS) continues, refusing to abandon his divine mission." },
    ]
},
{
    id: 6,
    name: "Tha'labiyya",
    arabic: "الثعلبية",
    type: "waypoint",
    coords: [27.5, 43.5],
    month: "Muharram 61 AH",
    distanceFromPrev: 180,
    distanceTotalKm: 1244,
    bio: "Imam Hussain (AS) camped here and met travelers coming from Kufa who warned him of the treachery of the Kufans and the iron grip of Ibn Ziyad. A man named Zuhayr ibn Qayn, initially reluctant to meet Hussain, received a message and joined the caravan, becoming one of the most loyal companions.",
    companions: [
    { name: "Zuhayr ibn Qayn", arabic: "زهير بن قين", role: "Joined at Tha'labiyya after a dream" },
    ],
    events: [
    { label: "New Companion", title: "Zuhayr ibn Qayn Joins", desc: "A former supporter of Uthman, Zuhayr is initially reluctant. After receiving a message from Hussain and a dream, he rushes to join, sending his wife home and joining with his servants." },
    ]
},
{
    id: 7,
    name: "Shuquq",
    arabic: "شقوق",
    type: "waypoint",
    coords: [29.2, 43.9],
    month: "Muharram 61 AH",
    distanceFromPrev: 195,
    distanceTotalKm: 1439,
    bio: "A waypoint as the caravan pushed northward through the Arabian Peninsula. The terrain grew more challenging and the caravan continued its steady, purposeful movement toward Iraq, with companions reaffirming their loyalty.",
    companions: [],
    events: [
    { label: "En Route", title: "Northward March", desc: "The caravan continues its march. Hussain (AS) gives speeches to his companions reminding them of the trials ahead and releasing any who wish to leave." },
    ]
},
{
    id: 8,
    name: "Zubalah",
    arabic: "زبالة",
    type: "event",
    coords: [30.1, 44.3],
    month: "Muharram 61 AH",
    distanceFromPrev: 110,
    distanceTotalKm: 1549,
    bio: "At Zubalah, Imam Hussain (AS) received confirmation of the martyrdom of Abdullah ibn Yaqtur, another messenger he had sent to Kufa. The net was closing. Here Hussain made an open proclamation to his companions about the gravity of what lay ahead, explicitly releasing all from their pledge who wished to leave.",
    companions: [],
    events: [
    { label: "Martyrdom News", title: "Death of Abdullah ibn Yaqtur", desc: "Hussain's second messenger is captured and killed. Hussain addresses his companions publicly: 'Our Shia have abandoned us. Whoever wishes to leave may do so, with no obligation.'" },
    { label: "Loyalty", title: "Companions Reaffirm", desc: "His companions — family and loyal followers — unanimously declare they will never abandon him, preferring martyrdom to desertion." },
    ]
},
{
    id: 9,
    name: "Qadisiyyah",
    arabic: "القادسية",
    type: "waypoint",
    coords: [31.75, 44.5],
    month: "Muharram 61 AH",
    distanceFromPrev: 190,
    distanceTotalKm: 1739,
    bio: "The caravan neared the territory of Kufa. The historical site of the Battle of Qadisiyyah (637 CE) was a reminder of great sacrifice. Here the caravan received intelligence of the massive Umayyad military buildup ahead.",
    companions: [],
    events: [
    { label: "Entry into Iraq", title: "Approaching Kufa", desc: "The caravan crosses into Iraq. The gravity of the situation becomes more tangible. Military patrols of Ibn Ziyad are sighted." },
    ]
},
{
    id: 10,
    name: "Sharaf",
    arabic: "شراف",
    type: "event",
    coords: [32.3, 43.8],
    month: "2 Muharram 61 AH",
    distanceFromPrev: 70,
    distanceTotalKm: 1809,
    bio: "At a place called Sharaf, the caravan of Imam Hussain (AS) encountered the massive vanguard army of Ubaydullah ibn Ziyad — 1,000 horsemen under the command of Hurr ibn Yazid al-Riyahi. Hussain (AS) addressed Hurr, reciting the letters and pledges from the Kufans. Hurr, under orders to escort the caravan to Kufa, was unable to let them go back.",
    companions: [
    { name: "Hurr ibn Yazid al-Riyahi", arabic: "حر بن يزيد الرياحي", role: "Enemy commander (later repents & is martyred)" },
    ],
    events: [
    { label: "Confrontation", title: "Encounter with Hurr", desc: "Hurr's army of 1,000 arrives, dehydrated. Hussain (AS) orders his companions to water both the men and their horses — friend and potential foe alike." },
    { label: "Hussain's Address", title: "Reading the Letters", desc: "Hussain (AS) reads the letters from Kufa aloud to Hurr's army, documenting their invitation. 'You wrote me letters; these are your letters.'" },
    ]
},
{
    id: 11,
    name: "Baydah",
    arabic: "البيضة",
    type: "event",
    coords: [32.5, 43.7],
    month: "2 Muharram 61 AH",
    distanceFromPrev: 25,
    distanceTotalKm: 1834,
    bio: "At Baydah, Imam Hussain (AS) delivered his famous khutba (sermon) to Hurr's troops, articulating his duty to speak truth against a tyrannical ruler. This sermon, preserved through history, defines the moral essence of his stand.",
    companions: [],
    events: [
    { label: "Famous Sermon", title: "Khutba at Baydah", desc: "Hussain (AS) declares: 'O people! The Prophet ﷺ said: whoever sees a tyrannical ruler making lawful what Allah has made unlawful... and does not act against him by deed or word, it is right for Allah to place that person where that ruler belongs.'" },
    ]
},
{
    id: 12,
    name: "Ruhayma & Qasr Bani Maqatil",
    arabic: "رهيمة وقصر بني مقاتل",
    type: "waypoint",
    coords: [32.7, 43.85],
    month: "3–4 Muharram 61 AH",
    distanceFromPrev: 30,
    distanceTotalKm: 1864,
    bio: "Hussain's caravan, escorted (or rather constrained) by Hurr's forces, passed through several stations. Hurr prevented a return to Medina or a diversion to Kufa as commanded. The tension between the two groups was palpable, yet no hostilities broke out. Hussain (AS) led prayers for both groups.",
    companions: [],
    events: [
    { label: "Shared Prayers", title: "Hussain Leads Salah for All", desc: "At prayer time, Hurr's forces also prayed behind Imam Hussain (AS). Even in the midst of conflict, spiritual unity was preserved." },
    ]
},
{
    id: 13,
    name: "Karbala",
    arabic: "كربلاء",
    type: "arrival",
    coords: [32.6161, 44.0242],
    month: "2 Muharram 61 AH",
    distanceFromPrev: 30,
    distanceTotalKm: 1894,
    bio: "On the 2nd of Muharram 61 AH, the caravan of Imam Hussain (AS) arrived at the plains of Karbala beside the Euphrates river. Hussain asked for the name of the land and was told 'Karbala' — 'karb' (anguish) and 'bala' (trial). He wept and said: 'This is the land of anguish and tribulation. Here our blood will be spilled, here our children will be killed.' By the 10th of Muharram (Ashura), the tragic events of history's most renowned stand for justice would unfold.",
    companions: [
    { name: "Abbas ibn Ali", arabic: "عباس بن علي", role: "Standard-Bearer — Martyred on Ashura" },
    { name: "Ali Akbar ibn Hussain", arabic: "علي أكبر بن حسين", role: "Son — Martyred on Ashura" },
    { name: "Qasim ibn Hasan", arabic: "قاسم بن حسن", role: "Nephew — Martyred on Ashura" },
    { name: "Habib ibn Mazahir", arabic: "حبيب بن مظاهر", role: "Companion — Martyred on Ashura" },
    { name: "Hurr ibn Yazid al-Riyahi", arabic: "حر بن يزيد الرياحي", role: "Repented on morning of Ashura — Martyred" },
    { name: "Zuhayr ibn Qayn", arabic: "زهير بن قين", role: "Companion — Martyred on Ashura" },
    { name: "Ali ibn Hussain (Sajjad)", arabic: "علي بن حسين زين العابدين", role: "Son — Survived (ill), continued Imamate" },
    { name: "Zainab bint Ali", arabic: "زينب بنت علي", role: "Sister — Survived, spread message of Karbala" },
    ],
    events: [
    { label: "2 Muharram 61 AH", title: "Arrival at Karbala", desc: "The caravan halts at Karbala. Hussain (AS) recognises this as the destined place. He purchases the land from local tribes." },
    { label: "7 Muharram", title: "Water Cut Off", desc: "Ibn Sa'd's army, now 30,000 strong, cuts off access to the Euphrates on the orders of Ibn Ziyad. The camp's water supply is severed." },
    { label: "Night of 9 Muharram (Laylat al-Ashura)", title: "Final Night", desc: "Hussain (AS) gathers his companions, releases them from obligation, and extinguishes the lamp. In the darkness, every single one reaffirms their loyalty. He leads them in prayer through the night." },
    { label: "10 Muharram — Ashura", title: "The Battle of Karbala", desc: "In the morning, Hussain (AS) stands with 72 companions against thousands. They fight until mid-afternoon. By the time of Asr, Hussain (AS) is the last to fall, having buried each companion with his own hands. He is martyred in prostration (sujood)." },
    { label: "After Ashura", title: "The Message Lives On", desc: "Zainab (AS) and the surviving family are taken as captives to Kufa then Damascus. Her courageous speeches in the court of Yazid ensure the message of Karbala reaches the world, immortalising the sacrifice." },
    ]
}
];

// ─────────────────────────────────────────────
//  STATE
// ─────────────────────────────────────────────
let map;
let currentStop = null;
let routeLines = [];
let routeVisible = true;
let visitedStops = new Set();
const markers = [];

// ─────────────────────────────────────────────
//  MAP INIT
// ─────────────────────────────────────────────
function initMap() {
map = L.map('map', {
    center: [28.5, 42],
    zoom: 6,
    zoomControl: false,
    attributionControl: true,
});

// Dark tile layer
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap © CARTO',
    subdomains: 'abcd',
    maxZoom: 19,
    id: 'dark-tiles'
}).addTo(map);

// Light labels on top
const labelsLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png', {
    attribution: '',
    subdomains: 'abcd',
    maxZoom: 19,
});
labelsLayer.addTo(map);

drawRoute();
addMarkers();
buildProgressBar();
}

// ─────────────────────────────────────────────
//  ROUTE
// ─────────────────────────────────────────────
function drawRoute() {
const coords = JOURNEY.map(s => s.coords);

// Background line (glowing halo)
const bgLine = L.polyline(coords, {
    color: 'rgba(212,175,55,0.12)',
    weight: 12,
    smoothFactor: 2,
}).addTo(map);

// Main dashed line
const mainLine = L.polyline(coords, {
    color: 'rgba(212,175,55,0.55)',
    weight: 2,
    dashArray: '8 6',
    smoothFactor: 2,
}).addTo(map);

routeLines = [bgLine, mainLine];
}

function toggleRoute() {
routeVisible = !routeVisible;
routeLines.forEach(l => {
    if (routeVisible) map.addLayer(l);
    else map.removeLayer(l);
});
const btn = document.getElementById('routeToggleBtn');
if (routeVisible) {
    btn.classList.add('active');
    btn.innerHTML = btn.innerHTML.replace('Show Route', 'Hide Route');
} else {
    btn.classList.remove('active');
    btn.innerHTML = btn.innerHTML.replace('Hide Route', 'Show Route');
}
}
// Make route visible and active by default
document.addEventListener('DOMContentLoaded', () => {
document.getElementById('routeToggleBtn').classList.add('active');
document.getElementById('routeToggleBtn').innerHTML = document.getElementById('routeToggleBtn').innerHTML.replace('Show Route','Hide Route');
});

// ─────────────────────────────────────────────
//  MARKERS
// ─────────────────────────────────────────────
function markerSize(type) {
if (type === 'arrival') return 22;
if (type === 'departure') return 18;
if (type === 'event') return 16;
return 14;
}

function addMarkers() {
JOURNEY.forEach((stop, i) => {
    const size = markerSize(stop.type);
    const showPulse = stop.type === 'departure' || stop.type === 'arrival';

    const html = `
    <div class="journey-marker marker-${stop.type}" style="width:${size}px;height:${size}px;">
        ${showPulse ? '<div class="marker-pulse"></div>' : ''}
        <span class="marker-number">${i + 1}</span>
        <div class="marker-tooltip">
        <strong>${stop.name}</strong>
        <span>${stop.month}</span>
        </div>
    </div>`;

    const icon = L.divIcon({
    html,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size/2, size/2],
    });

    const marker = L.marker(stop.coords, { icon, zIndexOffset: stop.type === 'arrival' ? 1000 : 0 })
    .addTo(map)
    .on('click', () => openStop(i));

    markers.push(marker);
});
}

// ─────────────────────────────────────────────
//  PANEL
// ─────────────────────────────────────────────
function openStop(i) {
currentStop = i;
visitedStops.add(i);
updateProgressBar();

const s = JOURNEY[i];

// Header
const typeLabels = { departure: 'Departure', waypoint: 'Waypoint / Camp', event: 'Key Event', arrival: 'Arrival' };
document.getElementById('panelTypeBadge').innerHTML =
    `<div class="type-badge ${s.type}"><div class="type-badge-dot"></div>${typeLabels[s.type]}</div>`;
document.getElementById('panelHeader').innerHTML = `
    <div class="stop-number">Stop ${i + 1} of ${JOURNEY.length}</div>
    <div class="stop-name">${s.name}</div>
    <div class="stop-arabic">${s.arabic}</div>
    <div class="stop-meta">
    <div class="stop-meta-item">
        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        <span>${s.month}</span>
    </div>
    ${s.distanceTotalKm > 0 ? `<div class="stop-meta-item">
        <svg viewBox="0 0 24 24"><line x1="3" y1="12" x2="21" y2="12"/><polyline points="8 7 3 12 8 17"/></svg>
        <span><strong>~${s.distanceTotalKm.toLocaleString()} km</strong> from Medina</span>
    </div>` : ''}
    </div>`;

// Body
let bodyHtml = '';

bodyHtml += `<div class="section-label">About This Stop</div>`;
bodyHtml += `<p class="bio-text">${s.bio}</p>`;

if (s.distanceFromPrev !== null) {
    bodyHtml += `<div class="section-label">Distance</div>`;
    bodyHtml += `<div class="distance-card">
    <div>
        <div class="distance-card-val">~${s.distanceFromPrev} km</div>
        <div class="distance-card-label">from previous stop</div>
    </div>
    <div>
        <div class="distance-card-val">~${s.distanceTotalKm.toLocaleString()} km</div>
        <div class="distance-card-label">total from Medina</div>
    </div>
    <div class="distance-card-icon"><svg viewBox="0 0 24 24"><path d="M3 12h18"/><path d="M8 7l-5 5 5 5"/><path d="M21 7l-5 5 5 5"/></svg></div>
    </div>`;
}

if (s.events && s.events.length > 0) {
    bodyHtml += `<div class="section-label">Events at This Stop</div>`;
    bodyHtml += `<div class="events-list">`;
    s.events.forEach(ev => {
    bodyHtml += `<div class="event-node">
        <div class="event-label">${ev.label}</div>
        <div class="event-title">${ev.title}</div>
        <div class="event-desc">${ev.desc}</div>
    </div>`;
    });
    bodyHtml += `</div>`;
}

if (s.companions && s.companions.length > 0) {
    bodyHtml += `<div class="section-label">Notable Companions Here</div>`;
    bodyHtml += `<div class="companions-grid">`;
    s.companions.forEach(c => {
    const initials = c.arabic.trim().split(' ').slice(0,2).map(w=>w[0]).join('');
    bodyHtml += `<div class="companion-item">
        <div class="companion-avatar">${initials}</div>
        <div>
        <div class="companion-name">${c.name}</div>
        <div class="companion-role">${c.role}</div>
        </div>
    </div>`;
    });
    bodyHtml += `</div>`;
}

document.getElementById('panelBody').innerHTML = bodyHtml;
document.getElementById('sidePanel').classList.add('active');

// Pan map
map.flyTo(s.coords, Math.max(map.getZoom(), 7), { duration: 0.8 });
}

function closePanel() {
document.getElementById('sidePanel').classList.remove('active');
document.getElementById('panelTypeBadge').innerHTML = '';
currentStop = null;
updateProgressBar();
}

function prevStop() {
if (currentStop === null) { openStop(JOURNEY.length - 1); return; }
openStop((currentStop - 1 + JOURNEY.length) % JOURNEY.length);
}

function nextStop() {
if (currentStop === null) { openStop(0); return; }
openStop((currentStop + 1) % JOURNEY.length);
}

// ─────────────────────────────────────────────
//  PROGRESS BAR
// ─────────────────────────────────────────────
function buildProgressBar() {
const track = document.getElementById('stopsTrack');
document.getElementById('progressTotal').textContent = JOURNEY.length;
track.innerHTML = '';
JOURNEY.forEach((s, i) => {
    // Connector before
    if (i > 0) {
    const conn = document.createElement('div');
    conn.className = 'track-connector';
    conn.id = `conn-${i}`;
    track.appendChild(conn);
    }
    // Stop
    const stop = document.createElement('div');
    stop.className = 'track-stop';
    stop.onclick = () => openStop(i);
    stop.innerHTML = `
    <div class="track-dot ${s.type === 'departure' ? 'departure' : s.type === 'arrival' ? 'arrival' : ''}" id="tdot-${i}"></div>
    <div class="track-label">${s.name}</div>`;
    track.appendChild(stop);
});
updateProgressBar();
}

function updateProgressBar() {
document.getElementById('progressCurrent').textContent =
    currentStop !== null ? currentStop + 1 : '—';

JOURNEY.forEach((_, i) => {
    const dot = document.getElementById(`tdot-${i}`);
    if (!dot) return;
    dot.classList.remove('visited', 'active');
    const base = JOURNEY[i].type === 'departure' ? 'departure'
                : JOURNEY[i].type === 'arrival'   ? 'arrival' : '';
    dot.className = 'track-dot ' + base;
    if (i === currentStop) dot.classList.add('active');
    else if (visitedStops.has(i)) dot.classList.add('visited');

    if (i > 0) {
    const conn = document.getElementById(`conn-${i}`);
    if (conn) {
        conn.classList.toggle('done',
        currentStop !== null && i <= currentStop);
    }
    }
});
}

// ─────────────────────────────────────────────
//  THEME
// ─────────────────────────────────────────────
function toggleTheme() {
const body = document.body;
const isLight = body.getAttribute('data-theme') === 'light';
body.setAttribute('data-theme', isLight ? '' : 'light');

// Swap tile layers
map.eachLayer(layer => {
    if (layer._url && layer._url.includes('carto')) {
    map.removeLayer(layer);
    }
});

const theme = isLight ? 'dark' : 'light';
L.tileLayer(`https://{s}.basemaps.cartocdn.com/${theme}_nolabels/{z}/{x}/{y}{r}.png`, {
    attribution: '© OpenStreetMap © CARTO',
    subdomains: 'abcd', maxZoom: 19,
}).addTo(map);
L.tileLayer(`https://{s}.basemaps.cartocdn.com/${theme}_only_labels/{z}/{x}/{y}{r}.png`, {
    attribution: '', subdomains: 'abcd', maxZoom: 19,
}).addTo(map);
}

// ─────────────────────────────────────────────
//  FIT VIEW
// ─────────────────────────────────────────────
function fitJourney() {
const coords = JOURNEY.map(s => s.coords);
const bounds = L.latLngBounds(coords);
map.flyToBounds(bounds, { padding: [60, 60], duration: 1 });
closePanel();
}

// ─────────────────────────────────────────────
//  BOOT
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
initMap();
// Default route visible
document.getElementById('routeToggleBtn').classList.add('active');
document.getElementById('routeToggleBtn').querySelector('svg').nextSibling.textContent = ' Hide Route';
});
