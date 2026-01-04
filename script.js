let apiInterval;
let tickerInterval;
let currentApiKey = "";
let globalSecondsRemaining = 0;

/**
 * Validates the key, hides the setup UI, and reveals the dashboard.
 */
async function startTracking() {
    const keyInput = document.getElementById('api-key').value.trim();
    if (keyInput.length < 16) {
        alert("Please enter a valid Torn API key.");
        return;
    }
    
    currentApiKey = keyInput;
    
    // UI Transitions: Hide input, show the dashboard and controls
    document.getElementById('setup-area').classList.add('hidden');
    document.getElementById('active-controls').classList.remove('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    document.getElementById('war-title').innerText = "Fetching War Data...";
    
    // Initial data pull
    await updateWarClock();
    
    // Setup Intervals: API sync every 30s, UI Ticker every 1s
    if (apiInterval) clearInterval(apiInterval);
    apiInterval = setInterval(updateWarClock, 30000);

    if (tickerInterval) clearInterval(tickerInterval);
    tickerInterval = setInterval(runTicker, 1000);
}

/**
 * Fetches the latest data from Torn API and calculates the countdown.
 */
async function updateWarClock() {
    if (!currentApiKey) return;

    try {
        const response = await fetch(`https://api.torn.com/faction/?selections=rankedwars&key=${currentApiKey}`);
        const data = await response.json();
        
        if (data.error) {
            document.getElementById('war-title').innerText = "API Error: " + data.error.error;
            return;
        }

        // Sort keys to ensure we get the newest war ID
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
        
        // Dynamic target lead provided by the API
        const currentTargetLead = warData.war.target;

        /**
         * PREDICTION LOGIC:
         * Since we only have the CURRENT (decayed) target, we estimate the 
         * ORIGINAL target to find the 1% hourly decay rate (since decay is 
         * always 1% of the original starting value).
         */
        const secondsElapsed = now - startTime;
        const hoursPast24 = Math.max(0, Math.floor((secondsElapsed - 86400) / 3600));
        
        // Reverse-engineer the original target: Current = Original * (1 - (0.01 * Hours))
        const originalTargetEstimate = currentTargetLead / (1 - (0.01 * hoursPast24));
        const hourlyDecayAmount = originalTargetEstimate * 0.01;

        if (currentLead >= currentTargetLead) {
            globalSecondsRemaining = 0;
        } else {
            // Solve for time until Current Lead >= Decaying Target
            const pointsRemainingToDecay = currentTargetLead - currentLead;
            const hoursToFinish = pointsRemainingToDecay / hourlyDecayAmount;
            globalSecondsRemaining = hoursToFinish * 3600;
        }

        // Update the Faction Card UI
        document.getElementById('war-title').innerText = `${f1.name} vs ${f2.name}`;
        document.getElementById('f1-name').innerText = f1.name;
        document.getElementById('f1-score').innerText = f1.score.toLocaleString();
        document.getElementById('f2-name').innerText = f2.name;
        document.getElementById('f2-score').innerText = f2.score.toLocaleString();
        
        // Store state for the 1s ticker to use
        window.currentWarStats = {
            lead: currentLead,
            leader: leaderName,
            target: currentTargetLead,
            start: startTime
        };

        renderUI();

    } catch (e) {
        console.error("API Failure", e);
        document.getElementById('war-title').innerText = "Connection Error";
    }
}

/**
 * Decrements the countdown every second locally for a smooth UI.
 */
function runTicker() {
    if (globalSecondsRemaining > 0) {
        globalSecondsRemaining--;
        renderUI();
    }
}

/**
 * Updates all visual elements including timer, progress bar, and finish time.
 */
function renderUI() {
    const sec = Math.max(0, Math.floor(globalSecondsRemaining));
    const stats = window.currentWarStats;
    if (!stats) return;

    // Timer display formatting (HH:MM:SS)
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    document.getElementById('countdown').innerText = 
        `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

    // Victory Bar Progress
    const progressPercent = Math.min(100, (stats.lead / stats.target) * 100).toFixed(1);
    const vBar = document.getElementById('victory-bar');
    vBar.style.width = progressPercent + "%";
    vBar.innerText = progressPercent + "% TO VICTORY";

    // Predicted Finish Calculation (GMT/TCT)
    const finishDate = new Date(Date.now() + (sec * 1000));
    const gmtString = finishDate.toUTCString().replace('GMT', 'TCT');

    // Detail text update
    document.getElementById('details').innerHTML = `
        Current Lead: <strong>${stats.lead.toLocaleString()}</strong> (Leader: ${stats.leader})<br>
        Required Lead Now: <strong>${stats.target.toLocaleString()}</strong><br>
        Points Until Victory: <strong>${Math.max(0, stats.target - stats.lead).toLocaleString()}</strong><br>
        <span style="color: #00ff00; font-size: 1.1em; font-weight: bold; display: block; margin-top: 10px;">
            Predicted Finish: ${gmtString}
        </span>
    `;
}
