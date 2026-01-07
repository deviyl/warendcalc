let apiInterval, tickerInterval, currentApiKey = "", finishLineTimestamp = 0, previousWarData = null;

function toggleTerms() {
    const isChecked = document.getElementById('terms-checkbox').checked;
    const termsContainer = document.getElementById('terms-container');
    if (isChecked) termsContainer.classList.remove('hidden');
    else termsContainer.classList.add('hidden');
}

function toggleLastWar() {
    const isChecked = document.getElementById('last-war-checkbox').checked;
    const lastWarContainer = document.getElementById('last-war-container');
    if (isChecked) lastWarContainer.classList.remove('hidden');
    else lastWarContainer.classList.add('hidden');
}

async function startTracking() {
    const keyInput = document.getElementById('api-key').value.trim();
    if (keyInput.length < 16) { alert("Please enter a valid Torn API key."); return; }
    currentApiKey = keyInput;
    document.getElementById('setup-area').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    await updateWarClock();
    apiInterval = setInterval(updateWarClock, 30000);
    tickerInterval = setInterval(runTicker, 1000);
}

async function updateWarClock() {
    if (!currentApiKey) return;
    try {
        const response = await fetch(`https://api.torn.com/faction/?selections=rankedwars&key=${currentApiKey}`);
        const data = await response.json();
        const sortedIds = Object.keys(data.rankedwars).sort((a, b) => b - a);
        const warData = data.rankedwars[sortedIds[0]];
        const isLiveOrScheduled = warData.war.end === 0;

        if (isLiveOrScheduled) {
            const factions = Object.values(warData.factions);
            const f1 = factions[0], f2 = factions[1];
            const now = Math.floor(Date.now() / 1000);
            const startTime = warData.war.start; 
            const currentLead = Math.abs(f1.score - f2.score);
            const currentTargetLead = warData.war.target;
            const secondsElapsed = Math.max(0, now - startTime); 
            const gracePeriod = 86400; 
            let originalTarget;
            if (secondsElapsed < gracePeriod) { originalTarget = currentTargetLead; } 
            else {
                const hoursPastGrace = Math.floor((secondsElapsed - gracePeriod) / 3600);
                originalTarget = Math.round(currentTargetLead / (1 - (0.01 * (hoursPastGrace + 1))));
            }
            const itNeeded = Math.ceil((originalTarget - currentLead) / (originalTarget * 0.01));
            finishLineTimestamp = startTime + gracePeriod + ((itNeeded - 1) * 3600);
            window.currentWarStats = {
                active: true, lead: currentLead, leader: f1.score > f2.score ? f1.name : f2.name,
                target: currentTargetLead, original: originalTarget, f1Name: f1.name, f2Name: f2.name,
                f1Score: f1.score, f2Score: f2.score, startTime: startTime
            };
        } else { window.currentWarStats = { active: false }; }

        const lastWarIdx = isLiveOrScheduled ? 1 : 0;
        if (sortedIds.length > lastWarIdx) {
            const prev = data.rankedwars[sortedIds[lastWarIdx]];
            const pFacts = Object.values(prev.factions);
            previousWarData = { f1Name: pFacts[0].name, f1Score: pFacts[0].score, f2Name: pFacts[1].name, f2Score: pFacts[1].score, endTime: prev.war.end };
        }
        renderUI();
    } catch (e) { console.error(e); }
}

function runTicker() { renderUI(); }

function getNextMatchmakingTuesday() {
    const now = new Date();
    const nextTues = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    while (nextTues.getUTCDay() !== 2) { nextTues.setUTCDate(nextTues.getUTCDate() + 1); }
    nextTues.setUTCHours(12, 0, 0, 0);
    if (nextTues.getTime() < now.getTime()) { nextTues.setUTCDate(nextTues.getUTCDate() + 7); }
    return nextTues;
}

function renderUI() {
    const stats = window.currentWarStats;
    if (!stats) return;
    const warEl = document.getElementById('active-war-elements'), noWarMsg = document.getElementById('no-war-message'), termsTog = document.getElementById('terms-toggle-wrapper');

    if (previousWarData) {
        document.getElementById('prev-f1-name').innerText = previousWarData.f1Name;
        document.getElementById('prev-f1-score').innerText = previousWarData.f1Score.toLocaleString();
        document.getElementById('prev-f2-name').innerText = previousWarData.f2Name;
        document.getElementById('prev-f2-score').innerText = previousWarData.f2Score.toLocaleString();
        document.getElementById('prev-war-details').innerText = `Actual End Time: ${new Date(previousWarData.endTime * 1000).toUTCString().replace('GMT', 'TCT')}`;
    }

    if (!stats.active) { warEl.classList.add('hidden'); noWarMsg.classList.remove('hidden'); termsTog.classList.add('hidden'); return; }

    warEl.classList.remove('hidden'); noWarMsg.classList.add('hidden'); termsTog.classList.remove('hidden');

    const now = Math.floor(Date.now() / 1000);
    const sec = Math.max(0, finishLineTimestamp - now);
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60);
    document.getElementById('countdown').innerText = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    document.getElementById('orig-target-display').innerText = `Original Target: ${stats.original.toLocaleString()}`;
    document.getElementById('f1-name').innerText = stats.f1Name; document.getElementById('f1-score').innerText = stats.f1Score.toLocaleString();
    document.getElementById('f2-name').innerText = stats.f2Name; document.getElementById('f2-score').innerText = stats.f2Score.toLocaleString();

    const fillL = document.getElementById('fill-left'), fillR = document.getElementById('fill-right'), valL = document.getElementById('val-left'), valR = document.getElementById('val-right');
    fillL.style.width = "0%"; fillR.style.width = "0%"; valL.innerText = ""; valR.innerText = "";
    document.getElementById('label-f1').innerText = stats.f1Name; document.getElementById('label-f2').innerText = stats.f2Name;
    document.getElementById('target-left').innerText = stats.target.toLocaleString(); document.getElementById('target-right').innerText = stats.target.toLocaleString();
    const barPct = Math.min(100, (stats.lead / stats.target) * 100).toFixed(1);
    if (stats.f1Score > stats.f2Score) { fillL.style.width = barPct + "%"; valL.innerText = stats.lead.toLocaleString(); } 
    else if (stats.f2Score > stats.f1Score) { fillR.style.width = barPct + "%"; valR.innerText = stats.lead.toLocaleString(); }
    document.getElementById('details').innerHTML = `<span style="color: #ff8c00; font-weight: bold;">Predicted Finish: ${new Date(finishLineTimestamp * 1000).toUTCString().replace('GMT', 'TCT')}</span>`;

    // Terms Logic
    document.getElementById('radio-f1-name').innerText = stats.f1Name; document.getElementById('radio-f2-name').innerText = stats.f2Name;
    const winnerVal = document.querySelector('input[name="winner"]:checked').value;
    const winGoalPct = parseInt(document.getElementById('win-bracket-slider').value);
    const conGoalPct = parseInt(document.getElementById('bracket-slider').value);
    document.getElementById('win-slider-val-display').innerText = winGoalPct + "%";
    document.getElementById('slider-val-display').innerText = conGoalPct + "%";

    const wName = (winnerVal === 'f1') ? stats.f1Name : stats.f2Name;
    const cName = (winnerVal === 'f1') ? stats.f2Name : stats.f1Name;
    const wScore = (winnerVal === 'f1') ? stats.f1Score : stats.f2Score;
    const cScore = (winnerVal === 'f1') ? stats.f2Score : stats.f1Score;

    document.getElementById('win-target-label-text').innerHTML = `Winning Faction Target<br>(${wName})`;
    document.getElementById('concede-label-text').innerHTML = `Conceding Faction Target<br>(${cName})`;

    // Winner Bar
    const wTarg = Math.round(stats.original * (winGoalPct / 100));
    const wPct = wTarg === 0 ? 100 : Math.min(100, (wScore / wTarg) * 100);
    const wBar = document.getElementById('win-target-bar');
    wBar.style.width = wPct + "%";
    document.getElementById('win-target-text').innerText = `${wScore.toLocaleString()} / ${wTarg.toLocaleString()} (${Math.round(wPct)}%)`;
    if (wScore >= wTarg && wTarg > 0) wBar.classList.add('complete-green'); else wBar.classList.remove('complete-green');

    // Conceder Bar
    const cTarg = Math.round(stats.original * (conGoalPct / 100));
    const cPct = cTarg === 0 ? 100 : Math.min(100, (cScore / cTarg) * 100);
    const cBar = document.getElementById('concede-bar');
    cBar.style.width = cPct + "%";
    document.getElementById('concede-text').innerText = `${cScore.toLocaleString()} / ${cTarg.toLocaleString()} (${Math.round(cPct)}%)`;
    if (cScore >= cTarg && cTarg > 0) cBar.classList.add('complete-green'); else cBar.classList.remove('complete-green');

    // Lead Status Bar
    const sBar = document.getElementById('winner-status-bar'), sText = document.getElementById('winner-status-text');
    if (wScore > cScore) { sBar.classList.add('complete-green'); sBar.classList.remove('fail-red'); sText.innerText = "CURRENTLY LEADING"; }
    else { sBar.classList.remove('complete-green'); sBar.classList.add('fail-red'); sText.innerText = "CURRENTLY TRAILING"; }

    // Matchmaking
    const mmTime = getNextMatchmakingTuesday(), mmTS = Math.floor(mmTime.getTime() / 1000);
    const bSec = mmTS - finishLineTimestamp, bHrs = (bSec / 3600).toFixed(1);
    const bDiv = document.getElementById('matchmaking-buffer'), pDiv = document.getElementById('points-required');
    const dStr = mmTime.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });

    if (bSec < 0 || bHrs < 5) {
        pDiv.classList.remove('hidden');
        const calcP = (rh) => {
            const avail = (mmTS - (rh * 3600)) - (stats.startTime + 86400);
            if (avail < 0) return "Impossible";
            const reqL = Math.ceil(stats.original - ((Math.floor(avail / 3600) + 1) * stats.original * 0.01));
            return Math.max(0, reqL - stats.lead).toLocaleString();
        };
        pDiv.innerHTML = `To clear deadline by 1 hour, gain: <span class="points-val">${calcP(1)}</span> points<br>To clear deadline by 5 hours, gain: <span class="points-val">${calcP(5)}</span> points`;
    } else { pDiv.classList.add('hidden'); }

    if (bSec < 0) { bDiv.innerHTML = `<span class="buffer-danger">Predicted finish is AFTER matchmaking on:<br>Tuesday (${dStr}) at 12:00 TCT</span>`; }
    else { bDiv.innerHTML = `End <span class="${bHrs >= 5 ? 'buffer-safe' : 'buffer-danger'}">${bHrs} hours</span> before matchmaking on Tuesday (${dStr}) at 12:00 TCT`; }
}
