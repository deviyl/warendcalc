let apiKey = '';
let warData = null;
let lastWarData = null;
let timerInterval = null;

async function startTracking() {
    apiKey = document.getElementById('api-key').value;
    if (!apiKey) return;
    document.getElementById('setup-area').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    fetchData();
    setInterval(fetchData, 30000);
    timerInterval = setInterval(renderUI, 1000);
}

async function fetchData() {
    try {
        const response = await fetch(`https://api.torn.com/factions/?selections=rankedwars&key=${apiKey}`);
        const data = await response.json();
        const wars = data.rankedwars;
        if (wars && Object.keys(wars).length > 0) {
            const warKey = Object.keys(wars)[0];
            warData = wars[warKey];
            document.getElementById('no-war-message').classList.add('hidden');
            document.getElementById('active-war-elements').classList.remove('hidden');
            document.getElementById('terms-toggle-wrapper').classList.remove('hidden');
        } else {
            warData = null;
            document.getElementById('no-war-message').classList.remove('hidden');
            document.getElementById('active-war-elements').classList.add('hidden');
            document.getElementById('terms-toggle-wrapper').classList.add('hidden');
            document.getElementById('terms-container').classList.add('hidden');
            document.getElementById('terms-checkbox').checked = false;
        }
    } catch (e) { console.error(e); }
}

async function fetchLastWar() {
    try {
        const response = await fetch(`https://api.torn.com/factions/?selections=basic&key=${apiKey}`);
        const data = await response.json();
        const factionId = data.faction_id;
        const logRes = await fetch(`https://api.torn.com/factions/${factionId}?selections=reports&key=${apiKey}`);
        const logData = await logRes.json();
        const reports = logData.reports;
        let lastReportKey = Object.keys(reports).sort((a,b) => b-a).find(k => reports[k].type === 'ranked_war_report');
        if (lastReportKey) {
            const repRes = await fetch(`https://api.torn.com/factions/${factionId}?selections=report&report_id=${lastReportKey}&key=${apiKey}`);
            lastWarData = await repRes.json();
            renderLastWar();
        }
    } catch (e) { console.error(e); }
}

function toggleLastWar() {
    const container = document.getElementById('last-war-container');
    if (document.getElementById('last-war-checkbox').checked) {
        container.classList.remove('hidden');
        fetchLastWar();
    } else {
        container.classList.add('hidden');
    }
}

function toggleTerms() {
    const container = document.getElementById('terms-container');
    if (document.getElementById('terms-checkbox').checked) {
        container.classList.remove('hidden');
    } else {
        container.classList.add('hidden');
    }
}

function updateWarClock() { renderUI(); }

function renderUI() {
    if (!warData) return;
    const now = Math.floor(Date.now() / 1000);
    const fIds = Object.keys(warData.factions);
    const f1 = warData.factions[fIds[0]];
    const f2 = warData.factions[fIds[1]];
    const target = warData.war.target;
    
    document.getElementById('f1-name').innerText = f1.name;
    document.getElementById('f1-score').innerText = f1.score;
    document.getElementById('f2-name').innerText = f2.name;
    document.getElementById('f2-score').innerText = f2.score;
    document.getElementById('radio-f1-name').innerText = f1.name;
    document.getElementById('radio-f2-name').innerText = f2.name;
    document.getElementById('label-f1').innerText = f1.name;
    document.getElementById('label-f2').innerText = f2.name;
    document.getElementById('orig-target-display').innerText = `Original Target: ${target}`;

    const startTime = warData.war.start;
    if (now < startTime) {
        document.getElementById('start-timer-container').classList.remove('hidden');
        document.getElementById('countdown').classList.add('hidden');
        document.getElementById('start-countdown').innerText = formatTime(startTime - now);
        return;
    } else {
        document.getElementById('start-timer-container').classList.add('hidden');
        document.getElementById('countdown').classList.remove('hidden');
    }

    const selectedWinnerSide = document.querySelector('input[name="winner"]:checked').value;
    const winner = selectedWinnerSide === 'f1' ? f1 : f2;
    const loser = selectedWinnerSide === 'f1' ? f2 : f1;
    const bracketPct = document.getElementById('bracket-slider').value / 100;
    
    const loserTarget = Math.floor(target * bracketPct);
    const winBuffer = target - loserTarget;
    const currentLead = winner.score - loser.score;
    const remaining = winBuffer - currentLead;

    const fillLeft = document.getElementById('fill-left');
    const fillRight = document.getElementById('fill-right');
    const valLeft = document.getElementById('val-left');
    const valRight = document.getElementById('val-right');

    if (f1.score >= f2.score) {
        const p = Math.min(100, (f1.score - f2.score) / target * 100);
        fillLeft.style.width = p + '%';
        fillRight.style.width = '0%';
        valLeft.innerText = f1.score - f2.score;
        valRight.innerText = '';
    } else {
        const p = Math.min(100, (f2.score - f1.score) / target * 100);
        fillRight.style.width = p + '%';
        fillLeft.style.width = '0%';
        valRight.innerText = f2.score - f1.score;
        valLeft.innerText = '';
    }

    document.getElementById('target-left').innerText = target;
    document.getElementById('target-right').innerText = target;

    const winBar = document.getElementById('win-target-bar');
    const winTxt = document.getElementById('win-target-text');
    const winProgress = Math.min(100, (winner.score / (loser.score + winBuffer)) * 100);
    winBar.style.width = winProgress + '%';
    winTxt.innerText = `${winner.score} / ${loser.score + winBuffer}`;
    document.getElementById('win-slider-val-display').innerText = `${loser.score + winBuffer} pts`;

    const statusOuter = document.getElementById('winner-status-bar');
    const statusTxt = document.getElementById('winner-status-text');
    if (winner.score >= loser.score + winBuffer) {
        statusOuter.className = 'terms-bar-fill-static complete-green';
        statusTxt.innerText = "Target Reached";
    } else {
        statusOuter.className = 'terms-bar-fill-static';
        statusTxt.innerText = "Pushing to Target";
    }

    const conBar = document.getElementById('concede-bar');
    const conTxt = document.getElementById('concede-text');
    const conProgress = Math.min(100, (loser.score / loserTarget) * 100);
    conBar.style.width = conProgress + '%';
    conBar.className = loser.score > loserTarget ? 'terms-bar-fill fail-red' : 'terms-bar-fill';
    conTxt.innerText = `${loser.score} / ${loserTarget}`;
    document.getElementById('slider-val-display').innerText = `${document.getElementById('bracket-slider').value}% (${loserTarget} pts)`;

    const diff = winner.score - loser.score;
    const finishLineTimestamp = diff >= winBuffer ? now : now + (remaining / (warData.war.start > 0 ? 0.5 : 1)); 
    const timeToFinish = Math.max(0, remaining);
    
    document.getElementById('countdown').innerText = formatTime(timeToFinish);
    document.getElementById('details').innerHTML = `<div class="predicted-finish">Predicted Finish: ${new Date(now + timeToFinish * 1).toUTCString().replace('GMT', 'TCT')}</div>`;

    const bufferEl = document.getElementById('matchmaking-buffer');
    const pointsReqEl = document.getElementById('points-required');
    const lead = f1.score - f2.score;
    const absLead = Math.abs(lead);
    
    if (absLead >= target) {
        bufferEl.innerHTML = `<span class="buffer-danger">War Ended</span>`;
        pointsReqEl.classList.add('hidden');
    } else {
        const buffer = target - absLead;
        bufferEl.innerHTML = `Matchmaking Buffer: <span class="${buffer < 100 ? 'buffer-danger' : 'buffer-safe'}">${buffer}</span>`;
        pointsReqEl.classList.remove('hidden');
        pointsReqEl.innerHTML = `Points to end: <span class="points-val">${buffer}</span>`;
    }
}

function renderLastWar() {
    if (!lastWarData) return;
    const f1 = lastWarData.report.factions[Object.keys(lastWarData.report.factions)[0]];
    const f2 = lastWarData.report.factions[Object.keys(lastWarData.report.factions)[1]];
    document.getElementById('prev-f1-name').innerText = f1.name;
    document.getElementById('prev-f1-score').innerText = f1.score;
    document.getElementById('prev-f2-name').innerText = f2.name;
    document.getElementById('prev-f2-score').innerText = f2.score;
    document.getElementById('prev-war-details').innerText = `Result: ${f1.score > f2.score ? f1.name : f2.name} Won`;
}

function formatTime(sec) {
    if (sec <= 0) return "00:00:00";
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return [h, m, s].map(v => v < 10 ? "0" + v : v).join(":");
}
