let apiInterval;
let tickerInterval;
let currentApiKey = "";
let globalSecondsRemaining = 0;

async function startTracking() {
    const keyInput = document.getElementById('api-key').value.trim();
    if (keyInput.length < 16) {
        alert("Please enter a valid Torn API key.");
        return;
    }
    
    currentApiKey = keyInput;
    
    document.getElementById('setup-area').classList.add('hidden');
    document.getElementById('active-controls').classList.remove('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    document.getElementById('war-title').innerText = "Connecting to Torn City...";
    
    await updateWarClock();
    
    if (apiInterval) clearInterval(apiInterval);
    apiInterval = setInterval(updateWarClock, 30000);

    if (tickerInterval) clearInterval(tickerInterval);
    tickerInterval = setInterval(runTicker, 1000);
}

async function updateWarClock() {
    if (!currentApiKey) return;

    try {
        const response = await fetch(`https://api.torn.com/faction/?selections=rankedwars&key=${currentApiKey}`);
        const data = await response.json();
        
        if (data.error) {
            document.getElementById('war-title').innerText = "API Error: " + data.error.error;
            return;
        }

        const sortedIds = Object.keys(data.rankedwars).sort((a, b) => b - a);
        const warData = data.rankedwars[sortedIds[0]];

        if (!warData) {
            document.getElementById('war-title').innerText = "No Active Ranked War Found";
            return;
        }

        const factions = Object.values(warData.factions);
        const f1 = factions[0];
        const f2 = factions[1];

        const now = Math.floor(Date.now() / 1000);
        const startTime = warData.war.start; 
        const currentLead = Math.abs(f1.score - f2.score);
        const leaderName = f1.score > f2.score ? f1.name : f2.name;
        
        // The API target lead that decays hourly
        const currentTargetLead = warData.war.target;

        // STABLE DECAY CALCULATION
        const secondsElapsed = now - startTime;
        const gracePeriod = 86400; // 24 Hours
        
        let originalTarget;
        if (secondsElapsed <= gracePeriod) {
            originalTarget = currentTargetLead;
        } else {
            // Reverse engineering the original target based on hours passed
            const hoursPastGrace = Math.floor((secondsElapsed - gracePeriod) / 3600);
            // We use 0.01 (1%) and round to find the integer Torn started with
            originalTarget = Math.round(currentTargetLead / (1 - (hoursPastGrace * 0.01)));
        }

        const hourlyDecayAmount = originalTarget * 0.01;
        const decayPerSec = hourlyDecayAmount / 3600;

        if (currentLead >= currentTargetLead) {
            globalSecondsRemaining = 0;
        } else {
            // How many points must the target drop to meet our current lead?
            const pointsToClose = currentTargetLead - currentLead;
            // How many seconds will that take at the current decay rate?
            globalSecondsRemaining = pointsToClose / decayPerSec;
        }

        // Update UI Text
        document.getElementById('war-title').innerText = `${f1.name} vs ${f2.name}`;
        document.getElementById('f1-name').innerText = f1.name;
        document.getElementById('f1-score').innerText = f1.score.toLocaleString();
        document.getElementById('f2-name').innerText = f2.name;
        document.getElementById('f2-score').innerText = f2.score.toLocaleString();
        
        window.currentWarStats = {
            lead: currentLead,
            leader: leaderName,
            target: currentTargetLead,
            start: startTime,
            originalTarget: originalTarget
        };

        renderUI();

    } catch (e) {
        console.error("API Failure", e);
        document.getElementById('war-title').innerText = "Connection Error";
    }
}

function runTicker() {
    if (globalSecondsRemaining > 0) {
        globalSecondsRemaining--;
        renderUI();
    }
}

function renderUI() {
    const sec = Math.max(0, Math.floor(globalSecondsRemaining));
    const stats = window.currentWarStats;
    if (!stats) return;

    // Standard Countdown Timer
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    document.getElementById('countdown').innerText = 
        `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

    // Progress Bar: Lead vs Current Target
    const progressPercent = Math.min(100, (stats.lead / stats.target) * 100).toFixed(1);
    const vBar = document.getElementById('victory-bar');
    vBar.style.width = progressPercent + "%";
    vBar.innerText = progressPercent + "% TO VICTORY";

    // Predicted Finish (TCT/GMT)
    const finishDate = new Date(Date.now() + (sec * 1000));
    const gmtString = finishDate.toUTCString().replace('GMT', 'TCT');

    document.getElementById('details').innerHTML = `
        Current Lead: <strong>${stats.lead.toLocaleString()}</strong> (Leader: ${stats.leader})<br>
        Required Lead Now: <strong>${stats.target.toLocaleString()}</strong><br>
        Points Until Victory: <strong>${Math.max(0, stats.target - stats.lead).toLocaleString()}</strong><br>
        <span style="color: #ff8c00; font-size: 1.1em; font-weight: bold; display: block; margin-top: 10px;">
            Predicted Finish: ${gmtString}
        </span>
    `;
}
