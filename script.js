let apiInterval;
let tickerInterval;
let currentApiKey = "";
let globalSecondsRemaining = 0;

async function startTracking() {
    const keyInput = document.getElementById('api-key').value;
    if (keyInput.length < 16) {
        alert("Please enter a valid Torn API key.");
        return;
    }
    currentApiKey = keyInput;
    
    document.getElementById('setup-area').style.display = 'none';
    document.getElementById('active-controls').style.display = 'block';
    
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

        const factions = Object.values(warData.factions);
        const f1 = factions[0];
        const f2 = factions[1];

        const now = Math.floor(Date.now() / 1000);
        const startTime = warData.war.start; 
        const currentLead = Math.abs(f1.score - f2.score);
        const leaderName = f1.score > f2.score ? f1.name : f2.name;
        
        // Dynamic target from API
        const currentTargetLead = warData.war.target;

        // Calculate Original Target to find the 1% hourly decay rate
        const secondsElapsed = now - startTime;
        const hoursPast24 = Math.max(0, Math.floor((secondsElapsed - 86400) / 3600));
        const originalTargetEstimate = currentTargetLead / (1 - (0.01 * hoursPast24));
        const hourlyDecayAmount = originalTargetEstimate * 0.01;

        if (currentLead >= currentTargetLead) {
            globalSecondsRemaining = 0;
        } else {
            const pointsRemainingToDecay = currentTargetLead - currentLead;
            const hoursToFinish = pointsRemainingToDecay / hourlyDecayAmount;
            globalSecondsRemaining = hoursToFinish * 3600;
        }

        // Update the Faction Scores Grid
        document.getElementById('stats-area').style.display = 'grid';
        document.getElementById('war-title').innerText = `${f1.name} vs ${f2.name}`;
        document.getElementById('f1-name').innerText = f1.name;
        document.getElementById('f1-score').innerText = f1.score.toLocaleString();
        document.getElementById('f2-name').innerText = f2.name;
        document.getElementById('f2-score').innerText = f2.score.toLocaleString();
        
        window.currentWarStats = {
            lead: currentLead,
            leader: leaderName,
            target: currentTargetLead,
            start: startTime
        };

        renderUI();
    } catch (e) {
        console.error("API Failure", e);
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

    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    document.getElementById('countdown').innerText = 
        `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

    const finishDate = new Date(Date.now() + (sec * 1000));
    const gmtString = finishDate.toUTCString().replace('GMT', 'TCT');

    document.getElementById('details').innerHTML = `
        Current Lead: <strong>${stats.lead.toLocaleString()}</strong> (Leader: ${stats.leader})<br>
        Required Lead Now: <strong>${stats.target.toLocaleString()}</strong><br>
        Points Until Victory: <strong>${Math.max(0, stats.target - stats.lead).toLocaleString()}</strong><br>
        <span style="color: #00ff00; font-size: 1.1em;">Predicted Finish: ${gmtString}</span>
    `;
}
