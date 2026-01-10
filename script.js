let apiKey = '';
let warData = null;
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
        if (data.rankedwars && Object.keys(data.rankedwars).length > 0) {
            warData = data.rankedwars[Object.keys(data.rankedwars)[0]];
            document.getElementById('no-war-message').classList.add('hidden');
            document.getElementById('active-war-elements').classList.remove('hidden');
        } else {
            warData = null;
            document.getElementById('no-war-message').classList.remove('hidden');
            document.getElementById('active-war-elements').classList.add('hidden');
        }
    } catch (e) { console.error(e); }
}

function updateWarClock() { renderUI(); }

function toggleLastWar() {
    document.getElementById('last-war-container').classList.toggle('hidden');
}

function toggleTerms() {
    document.getElementById('terms-container').classList.toggle('hidden');
}

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

    const lead = f1.score - f2.score;
    if (lead >= 0) {
        document.getElementById('fill-left').style.width = Math.min(100, (lead/target)*100) + '%';
        document.getElementById('fill-right').style.width = '0%';
        document.getElementById('val-left').innerText = lead;
        document.getElementById('val-right').innerText = '';
    } else {
        document.getElementById('fill-right').style.width = Math.min(100, (Math.abs(lead)/target)*100) + '%';
        document.getElementById('fill-left').style.width = '0%';
        document.getElementById('val-right').innerText = Math.abs(lead);
        document.getElementById('val-left').innerText = '';
    }

    document.getElementById('target-left').innerText = target;
    document.getElementById('target-right').innerText = target;

    const selectedWinner = document.querySelector('input[name="winner"]:checked').value;
    const winFaction = selectedWinner === 'f1' ? f1 : f2;
    const loseFaction = selectedWinner === 'f1' ? f2 : f1;
    const bracket = document.getElementById('bracket-slider').value / 100;
    const loseTarget = Math.floor(target * bracket);
    const winTarget = target - loseTarget + loseFaction.score;

    document.getElementById('win-target-bar').style.width = Math.min(100, (winFaction.score/winTarget)*100) + '%';
    document.getElementById('win-target-text').innerText = `${winFaction.score} / ${winTarget}`;
    document.getElementById('win-slider-val-display').innerText = `${winTarget} pts`;

    const statusFill = document.getElementById('winner-status-bar');
    if (winFaction.score >= winTarget) {
        statusFill.classList.add('complete-green');
        document.getElementById('winner-status-text').innerText = "Target Reached";
    } else {
        statusFill.classList.remove('complete-green');
        document.getElementById('winner-status-text').innerText = "Pushing...";
    }

    document.getElementById('concede-bar').style.width = Math.min(100, (loseFaction.score/loseTarget)*100) + '%';
    document.getElementById('concede-text').innerText = `${loseFaction.score} / ${loseTarget}`;
    document.getElementById('slider-val-display').innerText = `${document.getElementById('bracket-slider').value}% (${loseTarget})`;
    
    if (loseFaction.score > loseTarget) document.getElementById('concede-bar').classList.add('fail-red');
    else document.getElementById('concede-bar').classList.remove('fail-red');

    const remaining = Math.max(0, target - Math.abs(lead));
    document.getElementById('countdown').innerText = formatTime(remaining);
    document.getElementById('details').innerText = `Predicted Finish: ${new Date(now * 1000 + remaining * 1000).toUTCString().replace('GMT', 'TCT')}`;

    const buffer = target - Math.abs(lead);
    document.getElementById('matchmaking-buffer').innerHTML = `Buffer: <span class="${buffer < 100 ? 'buffer-danger' : 'buffer-safe'}">${buffer}</span>`;
}

function formatTime(sec) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return [h, m, s].map(v => v < 10 ? "0" + v : v).join(":");
}
