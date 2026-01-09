let apiInterval;
let tickerInterval;
let currentApiKey = "";
let finishLineTimestamp = 0;
let previousWarData = null;
window.currentWarStats = null;
let initialDefaultSet = false; 

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
    if (keyInput.length < 16) {
        alert("Please enter a valid Torn API key.");
        return;
    }
    currentApiKey = keyInput;
    document.getElementById('setup-area').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    
    await updateWarClock();
    apiInterval = setInterval(updateWarClock, 30000);
    tickerInterval = setInterval(renderUI, 1000);
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
            if (secondsElapsed < gracePeriod) {
                originalTarget = currentTargetLead;
            } else {
                const hoursPastGrace = Math.floor((secondsElapsed - gracePeriod) / 3600);
                const currentIterations = hoursPastGrace + 1;
                originalTarget = Math.round(currentTargetLead / (1 - (0.01 * currentIterations)));
            }

            const totalIterationsNeeded = Math.ceil((originalTarget - currentLead) / (originalTarget * 0.01));
            finishLineTimestamp = startTime + gracePeriod + ((totalIterationsNeeded - 1) * 3600);

            window.currentWarStats = {
                active: true,
                lead: currentLead,
                leader: f1.score > f2.score ? f1.name : f2.name,
                target: currentTargetLead,
                original: originalTarget,
                f1Name: f1.name, f2Name: f2.name,
                f1Score: f1.score, f2Score: f2.score,
                startTime: startTime
            };

            if (!initialDefaultSet) {
                const mmTime = getNextMatchmakingTuesday();
                const mmTS = Math.floor(mmTime.getTime() / 1000);
                const tFinTS = mmTS - (5 * 3600); 
                const avail = tFinTS - (startTime + 86400);
                
                if (avail >= 0) {
                    const maxIt = Math.floor(avail / 3600) + 1;
                    const reqLeadScore = Math.ceil(originalTarget - (maxIt * originalTarget * 0.01));
                    const leadPctNeeded = Math.round((reqLeadScore / originalTarget) * 100);
                    const concederPct = parseInt(document.getElementById('bracket-slider').value);
                    const totalWinPct = Math.min(100, concederPct + leadPctNeeded);
                    document.getElementById('win-bracket-slider').value = totalWinPct;
                }
                initialDefaultSet = true;
            }

        } else {
            window.currentWarStats = { active: false };
        }

        const lastWarIndex = isLiveOrScheduled ? 1 : 0;
        if (sortedIds.length > lastWarIndex) {
            const prevWar = data.rankedwars[sortedIds[lastWarIndex]];
            const prevFactions = Object.values(prevWar.factions);
            previousWarData = {
                f1Name: prevFactions[0].name,
                f1Score: prevFactions[0].score,
                f2Name: prevFactions[1].name,
                f2Score: prevFactions[1].score,
                endTime: prevWar.war.end
            };
        }
    } catch (e) { console.error(e); }
}

function getNextMatchmakingTuesday() {
    const now = new Date();
    const nextTuesday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    while (nextTuesday.getUTCDay() !== 2) { nextTuesday.setUTCDate(nextTuesday.getUTCDate() + 1); }
    nextTuesday.setUTCHours(12, 0, 0, 0);
    if (nextTuesday.getTime() < now.getTime()) { nextTuesday.setUTCDate(nextTuesday.getUTCDate() + 7); }
    return nextTuesday;
}

function renderUI() {
    const stats = window.currentWarStats;
    if (!stats) return;

    if (previousWarData) {
        document.getElementById('prev-f1-name').innerText = previousWarData.f1Name;
        document.getElementById('prev-f1-score').innerText = previousWarData.f1Score.toLocaleString();
        document.getElementById('prev-f2-name').innerText = previousWarData.f2Name;
        document.getElementById('prev-f2-score').innerText = previousWarData.f2Score.toLocaleString();
        document.getElementById('prev-war-details').innerText = `Actual End Time: ${new Date(previousWarData.endTime * 1000).toUTCString().replace('GMT', 'TCT')}`;
    }

    const warElements = document.getElementById('active-war-elements');
    const noWarMsg = document.getElementById('no-war-message');
    const termsToggle = document.getElementById('terms-toggle-wrapper');

    if (!stats.active) {
        warElements.classList.add('hidden');
        noWarMsg.classList.remove('hidden');
        termsToggle.classList.add('hidden');
        return;
    }

    warElements.classList.remove('hidden');
    noWarMsg.classList.add('hidden');
    termsToggle.classList.remove('hidden');

    const now = Math.floor(Date.now() / 1000);

    // --- Start Time Logic ---
    const startContainer = document.getElementById('start-timer-container');
    if (now < stats.startTime) {
        startContainer.classList.remove('hidden');
        const startSec = stats.startTime - now;
        const sh = Math.floor(startSec / 3600), sm = Math.floor((startSec % 3600) / 60), ss = Math.floor(startSec % 60);
        document.getElementById('start-countdown').innerText = `${sh.toString().padStart(2, '0')}:${sm.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`;
    } else {
        startContainer.classList.add('hidden');
    }
    // ------------------------

    const sec = Math.max(0, finishLineTimestamp - now);
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60);
    document.getElementById('countdown').innerText = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    document.getElementById('orig-target-display').innerText = `Original Target: ${stats.original.toLocaleString()}`;
    
    document.getElementById('f1-name').innerText = stats.f1Name;
    document.getElementById('f1-score').innerText = stats.f1Score.toLocaleString();
    document.getElementById('f2-name').innerText = stats.f2Name;
    document.getElementById('f2-score').innerText = stats.f2Score.toLocaleString();
    document.getElementById('label-f1').innerText = stats.f1Name;
    document.getElementById('label-f2').innerText = stats.f2Name;
    document.getElementById('target-left').innerText = stats.target.toLocaleString();
    document.getElementById('target-right').innerText = stats.target.toLocaleString();

    const fillLeft = document.getElementById('fill-left'), fillRight = document.getElementById('fill-right');
    const valLeft = document.getElementById('val-left'), valRight = document.getElementById('val-right');
    fillLeft.style.width = "0%"; fillRight.style.width = "0%";
    valLeft.innerText = ""; valRight.innerText = "";
    const barWidthPercent = Math.min(100, (stats.lead / stats.target) * 100).toFixed(1);
    if (stats.f1Score > stats.f2Score) {
        fillLeft.style.width = barWidthPercent + "%";
        valLeft.innerText = stats.lead.toLocaleString();
    } else if (stats.f2Score > stats.f1Score) {
        fillRight.style.width = barWidthPercent + "%";
        valRight.innerText = stats.lead.toLocaleString();
    }
    document.getElementById('details').innerHTML = `<span style="color: #ff8c00; font-weight: bold;">Predicted Finish: ${new Date(finishLineTimestamp * 1000).toUTCString().replace('GMT', 'TCT')}</span>`;

    document.getElementById('radio-f1-name').innerText = stats.f1Name;
    document.getElementById('radio-f2-name').innerText = stats.f2Name;
    const winnerVal = document.querySelector('input[name="winner"]:checked').value;
    const winGoalPct = parseInt(document.getElementById('win-bracket-slider').value);
    const conGoalPct = parseInt(document.getElementById('bracket-slider').value);
    document.getElementById('win-slider-val-display').innerText = winGoalPct + "%";
    document.getElementById('slider-val-display').innerText = conGoalPct + "%";

    const wScore = (winnerVal === 'f1') ? stats.f1Score : stats.f2Score;
    const cScore = (winnerVal === 'f1') ? stats.f2Score : stats.f1Score;

    const wTarg = Math.round(stats.original * (winGoalPct / 100));
    const wPct = wTarg === 0 ? 100 : Math.min(100, (wScore / wTarg) * 100);
    const wBar = document.getElementById('win-target-bar');
    wBar.style.width = wPct + "%";
    document.getElementById('win-target-text').innerText = `${wScore.toLocaleString()} / ${wTarg.toLocaleString()} (${Math.round(wPct)}%)`;
    if (wScore >= wTarg && wTarg > 0) wBar.classList.add('complete-green'); else wBar.classList.remove('complete-green');

    const sBar = document.getElementById('winner-status-bar'), sText = document.getElementById('winner-status-text');
    if (wScore > cScore) { 
        sBar.classList.add('complete-green'); sBar.classList.remove('fail-red'); sText.innerText = "WINNING"; 
    } else { 
        sBar.classList.remove('complete-green'); sBar.classList.add('fail-red'); sText.innerText = "LOSING"; 
    }

    const cTarg = Math.round(stats.original * (conGoalPct / 100));
    const cPct = cTarg === 0 ? 100 : Math.min(100, (cScore / cTarg) * 100);
    const cBar = document.getElementById('concede-bar');
    cBar.style.width = cPct + "%";
    document.getElementById('concede-text').innerText = `${cScore.toLocaleString()} / ${cTarg.toLocaleString()} (${Math.round(cPct)}%)`;
    if (cScore >= cTarg && cTarg > 0) cBar.classList.add('complete-green'); else cBar.classList.remove('complete-green');

    const mmTime = getNextMatchmakingTuesday();
    const mmTS = Math.floor(mmTime.getTime() / 1000);
    const bSec = mmTS - finishLineTimestamp;
    const bHrs = (bSec / 3600).toFixed(1);
    const bDiv = document.getElementById('matchmaking-buffer');
    const pDiv = document.getElementById('points-required');
    const dStr = mmTime.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });

    if (bSec < 0 || bHrs < 5) {
        pDiv.classList.remove('hidden');
        const sliderLead = Math.max(0, Math.round(stats.original * ((winGoalPct - conGoalPct) / 100)));

        const getRowData = (hours) => {
            const tFinTS = mmTS - (hours * 3600);
            const avail = tFinTS - (stats.startTime + 86400);
            if (avail < 0) return `<tr><td>${hours} Hour</td><td colspan="2" class="buffer-danger">Impossible - deadline too early</td></tr>`;
            
            const maxIt = Math.floor(avail / 3600) + 1;
            const xxx = Math.ceil(stats.original - (maxIt * stats.original * 0.01));
            const statusColor = sliderLead >= xxx ? 'buffer-safe' : 'buffer-danger';
            const statusWord = sliderLead >= xxx ? 'YES' : 'NO';

            return `<tr>
                <td>${hours} Hour</td>
                <td><span class="points-val">${xxx.toLocaleString()}</span></td>
                <td class="status-cell ${statusColor}">${statusWord}</td>
            </tr>`;
        };

        pDiv.innerHTML = `
            <div style="text-align:left; margin-bottom:5px; font-weight:bold; color:#cca3a3;">Lead Required to end before next Matchmaking:</div>
            <table class="deadline-table">
                <thead>
                    <tr><th>Hours Before</th><th>Lead Needed</th><th>Goal Met?</th></tr>
                </thead>
                <tbody>
                    ${getRowData(1)}
                    ${getRowData(5)}
                </tbody>
            </table>
            <div style="text-align:left; font-size:0.8em; margin-top:8px; color:#888;">
                Your planned lead (based on sliders): <span class="points-val">${sliderLead.toLocaleString()}</span>
            </div>`;
    } else { pDiv.classList.add('hidden'); }

    if (bSec < 0) { bDiv.innerHTML = `<span class="buffer-danger">Predicted finish is AFTER matchmaking on:<br>Tuesday (${dStr}) at 12:00 TCT<br>(this is based on current scores, not sliders)</span>`; }
    else { bDiv.innerHTML = `End <span class="${bHrs >= 5 ? 'buffer-safe' : 'buffer-danger'}">${bHrs} hours</span> before matchmaking on Tuesday (${dStr}) at 12:00 TCT`; }
}
