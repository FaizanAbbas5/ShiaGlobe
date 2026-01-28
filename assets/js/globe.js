/**
 * Globe Visualisation - main JavaScript
 */

let imamsData = [];

async function loadScholarsData() {
    try {
        const response = await fetch('./data/scholars-data.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        imamsData = await response.json();
        console.log('Loaded ' + imamsData.length + ' scholars');
        console.log('First scholar:', imamsData[0]);
        return true;
    } catch (error) {
        console.error('Error loading data:', error);
        alert('Failed to load data: ' + error.message);
        return false;
    }
}

const colors = {
      birth: '#22c55e',
      battle: '#ef4444',
      life: '#3b82f6',
      political: '#3b82f6',
      migration: '#a855f7',
      travel: '#a855f7',
      death: '#6b7280',
      shrine: '#fbbf24'
    };

    

    let globe;
    let currentYear = 40;
    let selectedImamId = 1;
    let rotationActive = false;

    async function init() {
      console.log('Initializing globe...');
      
      // wait for data to load
      const loaded = await loadScholarsData();
      if (!loaded) {
        console.error('Failed to load scholars data');
        return;
      }
      
      globe = Globe()(document.getElementById('globeViz'))
        .globeImageUrl('https://unpkg.com/three-globe/example/img/earth-night.jpg')
        .bumpImageUrl('https://unpkg.com/three-globe/example/img/earth-topology.png')
        .backgroundColor('#050505')
        .atmosphereColor('#4a90e2')
        .atmosphereAltitude(0.15)
        .htmlElementsData([])
        .htmlLat(d => d.lat)
        .htmlLng(d => d.lng)
        .htmlAltitude(0.01)
        .htmlElement(d => createPointEl(d));

      globe.controls().autoRotate = false;
      globe.controls().autoRotateSpeed = 0.5;
      globe.controls().enableZoom = true;
      globe.pointOfView({ lat: 26, lng: 44, altitude: 2 });

      document.getElementById('timeSlider').addEventListener('input', (e) => {
        currentYear = parseInt(e.target.value);
        updateDisplay();
      });

      updateRotationBtn();
      selectImam(1);

      window.jumpTo = jumpTo;
      window.closePanel = closePanel;
      window.toggleSearch = toggleSearch;
      window.filterSearch = filterSearch;
      window.toggleRotation = toggleRotation;
      window.toggleTheme = toggleTheme;
      window.closeCluster = closeCluster;
      window.nextImam = nextImam;
      window.prevImam = prevImam;
      
      console.log('Globe initialized successfully');
    }

    function createPointEl(d) {
      const wrapper = document.createElement('div');
      wrapper.style.position = 'relative';

      const point = document.createElement('div');
      const tooltip = document.createElement('div');
      tooltip.className = 'point-tooltip';

      if (d.isCluster) {
        point.className = 'map-cluster';
        point.textContent = d.count;
        tooltip.innerHTML = `<strong>${d.count} events</strong><span>Click to view</span>`;
      } else {
        point.className = 'map-point';
        point.style.backgroundColor = colors[d.type] || '#fff';
        tooltip.innerHTML = `<strong>${d.name}</strong><span>${d.imamName} • ${d.year} AH</span>`;
      }

      point.appendChild(tooltip);
      wrapper.appendChild(point);

      point.onclick = (e) => {
        e.stopPropagation();
        if (d.isCluster) {
          openClusterModal(d.events, e.clientX, e.clientY);
        } else {
          const imam = imamsData.find(i => i.id === d.imamId);
          selectImam(imam.id, d);
        }
      };

      return wrapper;
    }

    function getVisiblePoints() {
      let visible = [];

      if (selectedImamId) {
        const imam = imamsData.find(i => i.id === selectedImamId);
        if (!imam) {
          console.error('Imam not found:', selectedImamId);
          return [];
        }
        imam.events.forEach(ev => {
          if (ev.year <= currentYear) visible.push({ ...ev, imamId: imam.id, imamName: imam.name });
        });
      } else {
        imamsData.forEach(imam => {
          const isActive = currentYear >= imam.period[0] && currentYear <= imam.period[1];

          if (isActive) {
            let latest = null;
            imam.events.forEach(ev => {
              if (ev.year <= currentYear) {
                if (!latest || ev.year > latest.year) latest = ev;
              }
            });
            if (latest) visible.push({ ...latest, imamId: imam.id, imamName: imam.name });
          }

          if (!visible.length) {
            imam.events.forEach(ev => {
              if (ev.year === currentYear) visible.push({ ...ev, imamId: imam.id, imamName: imam.name });
            });
          }
        });

        if (!visible.length && imamsData.length > 0) {
          const ali = imamsData[0];
          visible.push({ ...ali.events[0], imamId: ali.id, imamName: ali.name });
        }
      }

      const threshold = 0.5;
      const clusters = [];
      const used = new Set();

      for (let i = 0; i < visible.length; i++) {
        if (used.has(i)) continue;
        const group = [visible[i]];
        used.add(i);

        for (let j = i + 1; j < visible.length; j++) {
          if (used.has(j)) continue;
          const dist = Math.sqrt(
            Math.pow(visible[i].lat - visible[j].lat, 2) +
            Math.pow(visible[i].lng - visible[j].lng, 2)
          );
          if (dist < threshold) {
            group.push(visible[j]);
            used.add(j);
          }
        }

        if (group.length > 1) {
          clusters.push({
            lat: group[0].lat,
            lng: group[0].lng,
            isCluster: true,
            count: group.length,
            events: group
          });
        } else {
          clusters.push(group[0]);
        }
      }

      console.log('Visible points:', clusters.length);
      return clusters;
    }

    function updateDisplay() {
      document.getElementById('yearVal').innerText = currentYear;
      document.getElementById('timeSlider').value = currentYear;
      // Always update globe regardless of panel state
      const points = getVisiblePoints();
      globe.htmlElementsData(points);
    }

    function openClusterModal(events, x, y) {
      const modal = document.getElementById('clusterModal');
      const content = document.getElementById('clusterContent');
      content.innerHTML = '';

      events.slice().sort((a,b) => (a.year - b.year) || (a.imamId - b.imamId)).forEach(ev => {
        const item = document.createElement('div');
        item.className = 'cluster-item';
        item.innerHTML = `
          <div class="cluster-item-year">${ev.year} AH</div>
          <div class="cluster-item-name">${ev.name}</div>
          <div class="cluster-item-sub">${ev.imamName}</div>
        `;
        item.onclick = () => {
          const imam = imamsData.find(i => i.id === ev.imamId);
          selectImam(imam.id, ev);
          closeCluster();
        };
        content.appendChild(item);
      });

      let left = x + 20;
      let top = y - 20;
      if (left + 280 > window.innerWidth) left = x - 300;
      if (top + 300 > window.innerHeight) top = window.innerHeight - 320;

      modal.style.left = left + 'px';
      modal.style.top = top + 'px';
      modal.classList.add('active');
    }

    function closeCluster() {
      document.getElementById('clusterModal').classList.remove('active');
    }

    function renderPanel(imam) {
      document.getElementById('panelHeaderContent').innerHTML = `
        <div class="imam-name">${imam.name}</div>
        <div class="imam-arabic">${imam.arabic}</div>
        <div class="imam-meta">
          <div class="meta-item"><strong>Title</strong> ${imam.titles}</div>
          <div class="meta-item"><strong>Period</strong> ${imam.lifespan}</div>
        </div>
      `;

      document.getElementById('panelBodyContent').innerHTML = `
        <div class="section-title">Biography</div>
        <div class="bio-text">${imam.bio}</div>
        <div class="section-title">Historical Events</div>
        <div class="events-list">
          ${imam.events.map(ev => `
            <div class="event-node" onclick="jumpTo(${ev.year}, ${ev.lat}, ${ev.lng})">
              <div class="event-year">${ev.year} AH</div>
              <div class="event-title">${ev.name}</div>
              <div class="event-desc">${ev.desc}</div>
            </div>
          `).join('')}
        </div>
      `;

      document.getElementById('sidePanel').classList.add('active');
    }

    function selectImam(id, point = null) {
      selectedImamId = id;
      const imam = imamsData.find(i => i.id === id);
      if (!imam) return;

      renderPanel(imam);

      if (point) {
        if (currentYear < point.year) currentYear = point.year;
        updateDisplay();
        globe.pointOfView({ lat: point.lat, lng: point.lng, altitude: 1.2 }, 1000);
      } else {
        currentYear = Math.min(imam.period[1], 330);
        updateDisplay();
        globe.pointOfView({ lat: 24.4672, lng: 39.6111, altitude: 2 }, 1000);
      }
    }

    function nextImam() {
      if (!selectedImamId) { selectImam(1); return; }
      const nextId = selectedImamId === 12 ? 1 : (selectedImamId + 1);
      selectImam(nextId);
    }

    function prevImam() {
      if (!selectedImamId) { selectImam(12); return; }
      const prevId = selectedImamId === 1 ? 12 : (selectedImamId - 1);
      selectImam(prevId);
    }

    function jumpTo(year, lat, lng) {
      currentYear = year;
      updateDisplay();
      globe.pointOfView({ lat: lat, lng: lng, altitude: 1.0 }, 1000);
    }

    function closePanel() {
      document.getElementById('sidePanel').classList.remove('active');
      selectedImamId = null;
      updateDisplay();
    }

    function toggleSearch() {
      const modal = document.getElementById('searchModal');
      const btn = document.getElementById('searchBtn');
      modal.classList.toggle('active');
      btn.classList.toggle('active');
      if (modal.classList.contains('active')) {
        document.getElementById('searchInput').focus();
        filterSearch();
      }
    }

    function filterSearch() {
      const q = (document.getElementById('searchInput').value || '').toLowerCase();
      const res = document.getElementById('searchResults');
      res.innerHTML = '';

      imamsData
        .filter(i => i.name.toLowerCase().includes(q) || i.arabic.includes(q))
        .forEach(i => {
          const div = document.createElement('div');
          div.className = 'result-item';
          div.innerHTML = `
            <div style="width:24px;height:24px;background:rgba(255,255,255,0.1);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;color:var(--accent-color);font-weight:700">${i.id}</div>
            <div>
              <div style="font-weight:600;color:var(--text-color)">${i.name}</div>
              <div style="font-size:11px;color:var(--secondary-text)">${i.arabic}</div>
            </div>
          `;
          div.onclick = () => { selectImam(i.id); toggleSearch(); };
          res.appendChild(div);
        });
    }

    function toggleRotation() {
      rotationActive = !rotationActive;
      globe.controls().autoRotate = rotationActive;
      updateRotationBtn();
    }

    function updateRotationBtn() {
      document.getElementById('rotateBtn').classList.toggle('active', rotationActive);
    }

    function toggleTheme() {
      const isLight = document.body.getAttribute('data-theme') === 'light';
      document.body.setAttribute('data-theme', isLight ? 'dark' : 'light');

      if (!isLight) {
        globe.globeImageUrl('https://unpkg.com/three-globe/example/img/earth-day.jpg')
          .backgroundColor('#f0f2f5')
          .atmosphereColor('#ffffff');
      } else {
        globe.globeImageUrl('https://unpkg.com/three-globe/example/img/earth-night.jpg')
          .backgroundColor('#050505')
          .atmosphereColor('#4a90e2');
      }
    }

    document.addEventListener('click', (e) => {
      if (!e.target.closest('#clusterModal') && !e.target.closest('.map-cluster')) {
        closeCluster();
      }
    });

    // Initialise when DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }