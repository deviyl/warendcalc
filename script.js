const API_KEY = 'Z5VkJsXZ4h25Pffx';

async function updateWarClock() {
    try {
        // Fetch faction data (includes ranked war info)
        const response = await fetch(`https://api.torn.com/faction/?selections=rankedwars&key=${API_KEY}`);
        const data = await response.json();
        
        const war = Object.values(data.rankedwars)[0]; // Get the current active war
        if (!war) {
            document.getElementById('war-title').innerText = "No Active Ranked War Found";
            return;
        }

        const faction1 = Object.values(war.factions)[0];
        const faction2 = Object.values(war.factions)[1];
        
        // Calculation Variables
        const now = Math.floor(Date.now() / 1000);
        const startTime = war.war_start;
        const timeElapsedSec = now - startTime;
        const originalTarget = war.target; // The 100% target
        const currentLead = Math.abs(faction1.score - faction2.score);
        
        // Decay starts after 24 hours (86,400 seconds)
        const decayStart = 86400;
        const decayPerSecond = (originalTarget * 0.01) / 3600;

        let secondsUntilEnd = 0;

        if (currentLead >= originalTarget) {
            secondsUntilEnd = 0; // Already over
        } else {
            // Formula: Current Lead = Original Target - (DecayPerSec * (TimeElapsed + X - 24h))
            const remainingTarget = originalTarget - currentLead;
            const totalSecToReachTarget = remainingTarget / decayPerSecond;
            const totalSecRequiredFromStart = totalSecToReachTarget + decayStart;
            secondsUntilEnd = totalSecRequiredFromStart - timeElapsedSec;
        }

        displayTime(secondsUntilEnd, faction1, faction2, currentLead);
        
    } catch (error) {
        console.error("Error fetching Torn API:", error);
    }
}

function displayTime(seconds, f1, f2, lead) {
    if (seconds <= 0) {
        document.getElementById('countdown').innerText = "War Ending!";
        return;
    }

    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    document.getElementById('war-title').innerText = `${f1.name} vs ${f2.name}`;
    document.getElementById('countdown').innerText = `${h}h ${m}m ${s}s`;
    document.getElementById('stats').innerText = `Current Lead: ${lead.toLocaleString()} | Target: ${f1.target}`;
}

// Update every 30 seconds
setInterval(updateWarClock, 30000);
updateWarClock();
