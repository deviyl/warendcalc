let apiInterval;
let tickerInterval;
let currentApiKey = "";
let finishLineTimestamp = 0;
let previousWarData = null;

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
    tickerInterval = setInterval(runTicker, 1000);
}

async function updateWarClock() {
    if (!currentApiKey) return;
    try {
        const response = await fetch(`https://api.torn.com/faction/?selections=rankedwars&key=${currentApiKey}`);
        const data = await response.json();
        const sortedIds = Object.keys(data.rankedwars).sort((a, b) => b - a);
        
        const warData = data.rankedwars[sortedIds[0]];
        // If end is 0, the war is either in recruitment/scheduled OR currently live.
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
        } else {
            window.currentWarStats = { active: false };
        }

        // Logic for Previous War:
        // If there's an active/scheduled war [0], the previous war is [1].
        // If there's NO active/scheduled war, the "last war" is [0].
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

        renderUI();
    } catch (e) { console.error(e); }
}

function runTicker() { renderUI(); }

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

    const warElements = document.getElementById('active-war-elements');
    const noWarMsg = document.getElementById('no-war-message');
    const termsToggle = document.getElementById('terms-toggle-wrapper');

    // Update History UI regardless of current war state
    if (previousWarData) {
        document.getElementById('prev-f1-name').innerText = previousWarData.f1Name;
        document.getElementById('prev-f1-score').innerText = previousWarData.f1Score.toLocaleString();
        document.getElementById('prev-f2-name').innerText = previousWarData.f2Name;
        document.getElementById('prev-f2-score').innerText = previousWarData.f2Score.toLocaleString();
        const prevDate = new Date(previousWarData.endTime * 1000);
        document.getElementById('prev-war-details').innerText = `Actual End Time: ${prevDate.toUTCString().replace('GMT', 'TCT')}`;
    }

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
    const sec = Math.max(0, finishLineTimestamp - now);
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60);
    
    document.getElementById('countdown').innerText = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    document.getElementById('orig-target-display').innerText = `Original Target: ${stats.original.toLocaleString()}`;
    document.getElementById('f1-name').innerText = stats.f1Name;
    document.getElementById('f1-score').innerText = stats.f1Score.toLocaleString();
    document.getElementById('f2-name').innerText = stats.f2Name;
    document.getElementById('f2-score').innerText = stats.f2Score.toLocaleString();

    const fillLeft = document.getElementById('fill-left'), fillRight = document.getElementById('fill-right');
    const valLeft = document.getElementById('val-left'), valRight = document.getElementById('val-right');
    fillLeft.style.width = "0%"; fillRight.style.width = "0%";
    valLeft.innerText = ""; valRight.innerText = "";
    document.getElementById('label-f1').innerText = stats.f1Name;
    document.getElementById('label-f2').innerText = stats.f2Name;
    document.getElementById('target-left').innerText = stats.target.toLocaleString();
    document.getElementById('target-right').innerText = stats.target.toLocaleString();

    const barWidthPercent = Math.min(100, (stats.lead / stats.target) * 100).toFixed(1);
    if (stats.f1Score > stats.f2Score) {
        fillLeft.style.width = barWidthPercent + "%";
        valLeft.innerText = stats.lead.toLocaleString();
    } else if (stats.f2Score > stats.f1Score) {
        fillRight.style.width = barWidthPercent + "%";
        valRight.innerText = stats.lead.toLocaleString();
    }
    const finishDate = new Date(finishLineTimestamp * 1000);
    document.getElementById('details').innerHTML = `<span style="color: #ff8c00; font-weight: bold;">Predicted Finish: ${finishDate.toUTCString().replace('GMT', 'TCT')}</span>`;

    document.getElementById('radio-f1-name').innerText = stats.f1Name;
    document.getElementById('radio-f2-name').innerText = stats.f2Name;
    const winnerVal = document.querySelector('input[name="winner"]:checked').value;
    const bracketPercent = parseInt(document.getElementById('bracket-slider').value);
    document.getElementById('slider-val-display').innerText = bracketPercent + "%";
    
    const winningName = (winnerVal === 'f1') ? stats.f1Name : stats.f2Name;
    const concedeName = (winnerVal === 'f1') ? stats.f2Name : stats.f1Name;
    const winningScore = (winnerVal === 'f1') ? stats.f1Score : stats.f2Score;
    const concedeScore = (winnerVal === 'f1') ? stats.f2Score : stats.f1Score;
    
    document.getElementById('concede-label-text').innerHTML = `Conceding Faction<br>(${concedeName})`;
    document.getElementById('win-label-text').innerHTML = `Winning Faction<br>(${winningName})`;

    const concedeTarget = Math.round(stats.original * (bracketPercent / 100));
    const concedePercent = concedeTarget === 0 ? 100 : Math.min(100, (concedeScore / concedeTarget) * 100);
    const concedeBar = document.getElementById('concede-bar');
    concedeBar.style.width = concedePercent + "%";
    document.getElementById('concede-text').innerText = `${concedeScore.toLocaleString()} / ${concedeTarget.toLocaleString()} (${Math.round(concedePercent)}%)`;
    
    if (concedeScore >= concedeTarget && concedeTarget > 0) concedeBar.classList.add('complete-green');
    else concedeBar.classList.remove('complete-green');

    const winnerStatusBar = document.getElementById('winner-status-bar');
    const winnerStatusText = document.getElementById('winner-status-text');
    if (winningScore > concedeScore) {
        winnerStatusBar.classList.add('complete-green');
        winnerStatusBar.classList.remove('fail-red');
        winnerStatusText.innerText = "WINNING";
    } else {
        winnerStatusBar.classList.remove('complete-green');
        winnerStatusBar.classList.add('fail-red');
        winnerStatusText.innerText = "LOSING";
    }

    const matchmakingTime = getNextMatchmakingTuesday();
    const mmTimestamp = Math.floor(matchmakingTime.getTime() / 1000);
    const bufferSeconds = mmTimestamp - finishLineTimestamp;
    const bufferHours = (bufferSeconds / 3600).toFixed(1);
    const bufferDiv = document.getElementById('matchmaking-buffer');
    const pointsDiv = document.getElementById('points-required');
    const dateString = matchmakingTime.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });

    if (bufferSeconds < 0 || bufferHours < 5) {
        pointsDiv.classList.remove('hidden');
        const calculatePoints = (requiredBufferHours) => {
            const targetFinishTime = mmTimestamp - (requiredBufferHours * 3600);
            const timeAvailableForIterations = targetFinishTime - (stats.startTime + 86400);
            if (timeAvailableForIterations < 0) return "Impossible";
            const maxIterationsAllowed = Math.floor(timeAvailableForIterations / 3600) + 1;
            const requiredLead = Math.ceil(stats.original - (maxIterationsAllowed * stats.original * 0.01));
            return Math.max(0, requiredLead - stats.lead).toLocaleString();
        };
        pointsDiv.innerHTML = `To clear deadline by 1 hour, gain: <span class="points-val">${calculatePoints(1)}</span> points<br>` +
                              `To clear deadline by 5 hours, gain: <span class="points-val">${calculatePoints(5)}</span> points`;
    } else { pointsDiv.classList.add('hidden'); }

    if (bufferSeconds < 0) {
        bufferDiv.innerHTML = `<span class="buffer-danger">Predicted finish is AFTER matchmaking begins on:<br>Tuesday (${dateString}) at 12:00 TCT</span>`;
    } else {
        const statusClass = bufferHours >= 5 ? 'buffer-safe' : 'buffer-danger';
        bufferDiv.innerHTML = `Current war will end <span class="${statusClass}">${bufferHours} hours</span> before<br>matchmaking begins on Tuesday (${dateString}) at 12:00 TCT`;
    }
}
