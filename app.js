import { ref, onValue, push, update, remove, get, set } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js";
import { database } from './firebaseConfig.js';
const storage = getStorage();

// DOM elements
const mainContent = document.getElementById('mainContent');
const modal = document.getElementById('modal');
const modalContent = document.getElementById('modalContent');
const closeModal = document.getElementsByClassName('close')[0];

// Close modal when clicking on 'x' or outside of it
closeModal.onclick = () => modal.style.display = "none";
window.onclick = (event) => {
  if (event.target == modal) {
    modal.style.display = "none";
  }
}

// Navigation setup
document.getElementById('statsNav').addEventListener('click', () => showSection('stats'));
document.getElementById('sessionsNav').addEventListener('click', () => showSection('sessions'));
document.getElementById('teamNav').addEventListener('click', () => showSection('team'));
document.getElementById('helpNav').addEventListener('click', () => showHelp());
document.getElementById('aboutNav').addEventListener('click', () => showAbout());

function showSection(section) {
  switch(section) {
    case 'stats': showStats(); break;
    case 'sessions': showGameSessions(); break;
    case 'team': showTeamMembers(); break;
  }
}

// Show Stats Functions for Team Statistics Page
function showStats() {
    mainContent.innerHTML = `
        <h2>Team Statistics</h2>
        <div class="stats-controls">
            <select id="statsPeriod">
                <option value="all">All-Time</option>
                <option value="10">Last 10 Sessions</option>
                <option value="25">Last 25 Sessions</option>
                <option value="50">Last 50 Sessions</option>
            </select>
        </div>
        <div id="teamStats"></div>
        <div id="playerStats"></div>
    `;
    
    document.getElementById('statsPeriod').addEventListener('change', loadStats);
    loadStats();
}

function loadStats() {
    const statsContainer = document.getElementById('teamStats');
    const playerStatsContainer = document.getElementById('playerStats');
    const period = document.getElementById('statsPeriod').value;
    
    statsContainer.innerHTML = 'Loading statistics...';
    playerStatsContainer.innerHTML = '';

    get(ref(database, 'gameSessions')).then((snapshot) => {
        let sessions = [];
        snapshot.forEach((childSnapshot) => {
            const session = childSnapshot.val();
            session.id = childSnapshot.key;
            sessions.push(session);
        });

        sessions.sort((a, b) => new Date(b.date) - new Date(a.date));

        if (period !== 'all') {
            sessions = sessions.slice(0, parseInt(period));
        }

        const stats = calculateStats(sessions);
        displayTeamStats(stats, statsContainer);
        displayPlayerStats(stats, playerStatsContainer);
    });
}

function calculateStats(sessions) {
    let stats = {
        warzone: { gamesPlayed: 0, wins: 0, top5: 0, kills: 0 },
        multiplayer: { gamesPlayed: 0, wins: 0, kills: 0 },
        gameModes: {},
        players: {}
    };

   sessions.forEach(session => {
        Object.values(session.matches || {}).forEach(match => {
            const gameType = match.gameType;
            const gameMode = match.gameMode;
            
            if (!stats.gameModes[gameMode]) {
                stats.gameModes[gameMode] = { gamesPlayed: 0, wins: 0, top3: 0, top5: 0, kills: 0 };
            }
            
            stats[gameType].gamesPlayed++;
            stats[gameType].kills += match.totalKills || 0;
            stats.gameModes[gameMode].gamesPlayed++;
            stats.gameModes[gameMode].kills += match.totalKills || 0;

            if (gameType === 'warzone') {
                if (match.placement === 1) {
                    stats.warzone.wins++;
                    stats.gameModes[gameMode].wins++;
                }
                if (match.placement <= 3) {
                    stats.warzone.top3++;
                    stats.gameModes[gameMode].top3++;
                }
                if (match.placement <= 5) {
                    stats.warzone.top5++;
                    stats.gameModes[gameMode].top5++;
                }
            } else if (gameType === 'multiplayer') {
                if (match.placement === 'Won') {
                    stats.multiplayer.wins++;
                    stats.gameModes[gameMode].wins++;
                }
            }
            // Player stats
            Object.entries(match.kills || {}).forEach(([player, kills]) => {
                if (!stats.players[player]) {
                    stats.players[player] = { gamesPlayed: 0, kills: 0, avgKills: 0 };
                }
                stats.players[player].gamesPlayed++;
                stats.players[player].kills += kills;
            });
        });
    });

    // Calculate averages
    Object.values(stats.players).forEach(player => {
        player.avgKills = player.gamesPlayed > 0 ? (player.kills / player.gamesPlayed).toFixed(2) : 0;
    });

    return stats;
}

function displayTeamStats(stats, container) {
    const warzoneWinPercentage = (stats.warzone.wins / stats.warzone.gamesPlayed * 100).toFixed(2);
    const warzoneTop5Percentage = (stats.warzone.top5 / stats.warzone.gamesPlayed * 100).toFixed(2);
    const multiplayerWinPercentage = (stats.multiplayer.wins / stats.multiplayer.gamesPlayed * 100).toFixed(2);

    let html = `
        <h3>Warzone Stats</h3>
        <table class="stats-table">
            <tr><th>Games Played</th><td>${stats.warzone.gamesPlayed}</td></tr>
            <tr><th>Wins</th><td>${stats.warzone.wins} (${warzoneWinPercentage}%)</td></tr>
            <tr><th>Top 5 Finishes</th><td>${stats.warzone.top5} (${warzoneTop5Percentage}%)</td></tr>
            <tr><th>Total Kills</th><td>${stats.warzone.kills}</td></tr>
            <tr><th>Avg. Kills per Game</th><td>${(stats.warzone.kills / stats.warzone.gamesPlayed).toFixed(2)}</td></tr>
        </table>

        <h3>Multiplayer Stats</h3>
        <table class="stats-table">
            <tr><th>Games Played</th><td>${stats.multiplayer.gamesPlayed}</td></tr>
            <tr><th>Wins</th><td>${stats.multiplayer.wins} (${multiplayerWinPercentage}%)</td></tr>
            <tr><th>Total Kills</th><td>${stats.multiplayer.kills}</td></tr>
            <tr><th>Avg. Kills per Game</th><td>${(stats.multiplayer.kills / stats.multiplayer.gamesPlayed).toFixed(2)}</td></tr>
        </table>

        <h3>Game Mode Stats</h3>
        <table class="stats-table">
            <tr><th>Game Mode</th><th>Games Played</th><th>Wins</th><th>Win %</th><th>Total Kills</th><th>Avg. Kills</th></tr>
            ${Object.entries(stats.gameModes).map(([mode, modeStats]) => `
                <tr>
                    <td>${mode}</td>
                    <td>${modeStats.gamesPlayed}</td>
                    <td>${modeStats.wins}</td>
                    <td>${(modeStats.wins / modeStats.gamesPlayed * 100).toFixed(2)}%</td>
                    <td>${modeStats.kills}</td>
                    <td>${(modeStats.kills / modeStats.gamesPlayed).toFixed(2)}</td>
                </tr>
            `).join('')}
        </table>
    `;

    container.innerHTML = html;
}

function displayPlayerStats(stats, container) {
    let html = `
        <h3>Player Stats</h3>
        <table class="stats-table">
            <tr><th>Player</th><th>Games Played</th><th>Total Kills</th><th>Avg. Kills per Game</th></tr>
            ${Object.entries(stats.players).map(([player, playerStats]) => `
                <tr>
                    <td>${player}</td>
                    <td>${playerStats.gamesPlayed}</td>
                    <td>${playerStats.kills}</td>
                    <td>${playerStats.avgKills}</td>
                </tr>
            `).join('')}
        </table>
    `;

    container.innerHTML = html;
}

// Function for the Game Sessions Tab

// Function to show Game Sessions page
function showGameSessions() {
    mainContent.innerHTML = `
        <h2>Game Sessions</h2>
        <button class="button" onclick="showAddGameSessionModal()">Add Game Session</button>
        <div id="sessionList"></div>
    `;
    loadGameSessions();
}

// Function to load and display game sessions
function loadGameSessions() {
    const sessionList = document.getElementById('sessionList');
    sessionList.innerHTML = 'Loading game sessions...';

    get(ref(database, 'gameSessions')).then((snapshot) => {
        const sessions = [];
        snapshot.forEach((childSnapshot) => {
            const session = childSnapshot.val();
            session.id = childSnapshot.key;
            sessions.push(session);
        });

        sessions.sort((a, b) => new Date(b.date) - new Date(a.date));

        if (sessions.length === 0) {
            sessionList.innerHTML = 'No game sessions found. Click the "Add Game Session" button to create one!';
        } else {
            sessionList.innerHTML = '';
            sessions.forEach((session) => {
                sessionList.innerHTML += `
                    <div class="card">
                        <h3>${formatDate(session.date, session.userTimezoneOffset)}</h3>
                        <p>Number of matches: ${session.matches ? Object.keys(session.matches).length : 0}</p>
                        <div class="button-group">
                            <button class="button" onclick="toggleMatches('${session.id}')">View Matches</button>
                            <button class="button" onclick="showAddMatchModal('${session.id}')">Add Match</button>
                            <button class="button" onclick="showEditGameSessionModal('${session.id}')">Edit Session</button>
                            <button class="button" onclick="deleteGameSession('${session.id}')">Delete Session</button>
                        </div>
                        <div id="matches-${session.id}" class="matches-container" style="display: none;"></div>
                    </div>
                `;
            });
        }
    }).catch(error => {
        console.error("Error loading game sessions:", error);
        sessionList.innerHTML = 'Error loading game sessions. Please try again.';
    });
}

// Function to toggle match visibility
window.toggleMatches = function(sessionId) {
    const matchesContainer = document.getElementById(`matches-${sessionId}`);
    if (matchesContainer.style.display === 'none') {
        loadMatches(sessionId);
        matchesContainer.style.display = 'block';
    } else {
        matchesContainer.style.display = 'none';
    }
}

// Function to load matches for a session
function loadMatches(sessionId) {
    const matchesContainer = document.getElementById(`matches-${sessionId}`);
    get(ref(database, `gameSessions/${sessionId}`)).then((snapshot) => {
        if (snapshot.exists()) {
            const session = snapshot.val();
            let matchesHtml = '<h3>Matches</h3>';
            if (session.matches) {
                matchesHtml += '<table class="matches-table"><tr><th>Game Type</th><th>Game Mode</th><th>Map</th><th>Placement</th><th>Total Kills</th><th>Actions</th></tr>';
                
                const sortedMatches = Object.entries(session.matches)
                    .map(([id, match]) => ({ id, ...match }))
                    .sort((a, b) => b.timestamp - a.timestamp);

                sortedMatches.forEach((match) => {
                    matchesHtml += `
                        <tr>
                            <td>${match.gameType}</td>
                            <td>${match.gameMode}</td>
                            <td>${match.map}</td>
                            <td>${match.placement}</td>
                            <td>${match.totalKills || 'N/A'}</td>
                            <td>
                                <button class="button" onclick="showEditMatchModal('${sessionId}', '${match.id}')">Edit</button>
                                <button class="button" onclick="deleteMatch('${sessionId}', '${match.id}')">Delete</button>
                                ${match.highlightURL ? `<button class="button" onclick="viewHighlight('${match.highlightURL}')">View Highlight</button>` : ''}
                            </td>
                        </tr>
                    `;
                });
                matchesHtml += '</table>';
            } else {
                matchesHtml += '<p>No matches found for this session.</p>';
            }
            matchesContainer.innerHTML = matchesHtml;
        }
    });
}

// Function to delete a game session
window.deleteGameSession = function(sessionId) {
    if (confirm('Are you sure you want to delete this game session? This action cannot be undone.')) {
        remove(ref(database, `gameSessions/${sessionId}`))
            .then(() => {
                loadGameSessions();
            })
            .catch((error) => {
                console.error("Error deleting game session:", error);
                alert('Error deleting game session. Please try again.');
            });
    }
}
// Function to delete a match
function deleteMatch(sessionId, matchId) {
    if (confirm('Are you sure you want to delete this match? This action cannot be undone.')) {
        remove(ref(database, `gameSessions/${sessionId}/matches/${matchId}`))
            .then(() => {
                loadMatches(sessionId);
            })
            .catch((error) => {
                console.error("Error deleting match:", error);
                alert('Error deleting match. Please try again.');
            });
    }
}
// Functions for Game Session Inputs
// Show modal for adding a new game session
 window.showAddGameSessionModal = function () {
    const modal = document.getElementById('modal');
    const modalContent = document.getElementById('modalContent');
    
    modalContent.innerHTML = `
        <h3>Add New Game Session</h3>
        <form id="addSessionForm">
            <div class="form-group">
                <label for="sessionDate">Session Date</label>
                <input type="date" id="sessionDate" required>
            </div>
            <button type="submit" class="button">Add Session</button>
        </form>
    `;
    
    document.getElementById('addSessionForm').addEventListener('submit', addGameSession);
    modal.style.display = 'block';
}

// Function to add a new game session
function addGameSession(e) {
    e.preventDefault();
    const sessionDate = document.getElementById('sessionDate').value;
    const newSessionRef = push(ref(database, 'gameSessions'));
    set(newSessionRef, {
        date: sessionDate,
        userTimezoneOffset: new Date().getTimezoneOffset() * 60000
    }).then(() => {
        document.getElementById('modal').style.display = 'none';
        loadGameSessions();
    }).catch((error) => {
        console.error("Error adding game session:", error);
        alert('Error adding game session. Please try again.');
    });
}

// Show modal for editing a game session
 window.showEditGameSessionModal = function(sessionId) {
    const modal = document.getElementById('modal');
    const modalContent = document.getElementById('modalContent');
    
    get(ref(database, `gameSessions/${sessionId}`)).then((snapshot) => {
        if (snapshot.exists()) {
            const session = snapshot.val();
            modalContent.innerHTML = `
                <h3>Edit Game Session</h3>
                <form id="editSessionForm">
                    <div class="form-group">
                        <label for="sessionDate">Session Date</label>
                        <input type="date" id="sessionDate" value="${formatDateForInput(session.date)}" required>
                    </div>
                    <button type="submit" class="button">Update Session</button>
                </form>
            `;
            
            document.getElementById('editSessionForm').addEventListener('submit', (e) => updateGameSession(e, sessionId));
            modal.style.display = 'block';
        }
    });
}
// Function to update a game session
function updateGameSession(e, sessionId) {
    e.preventDefault();
    const sessionDate = document.getElementById('sessionDate').value;
    update(ref(database, `gameSessions/${sessionId}`), {
        date: sessionDate,
        userTimezoneOffset: new Date().getTimezoneOffset() * 60000
    }).then(() => {
        document.getElementById('modal').style.display = 'none';
        loadGameSessions();
    }).catch((error) => {
        console.error("Error updating game session:", error);
        alert('Error updating game session. Please try again.');
    });
}

// Show modal for adding a new match
function window.showAddMatchModal = function(sessionId) {
    const modal = document.getElementById('modal');
    const modalContent = document.getElementById('modalContent');
    
    modalContent.innerHTML = `
        <h3>Add New Match</h3>
        <form id="addMatchForm">
            <div class="form-group">
                <label for="gameType">Game Type</label>
                <select id="gameType" required onchange="updateGameModeOptions()">
                    <option value="">Select Game Type</option>
                    <option value="warzone">Warzone</option>
                    <option value="multiplayer">Multiplayer</option>
                </select>
            </div>
            <div class="form-group">
                <label for="gameMode">Game Mode</label>
                <select id="gameMode" required>
                    <option value="">Select Game Mode</option>
                </select>
            </div>
            <div class="form-group">
                <label for="map">Map</label>
                <select id="map" required>
                    <option value="">Select Map</option>
                </select>
            </div>
            <div id="placementContainer" class="form-group">
                <!-- Placement input will be dynamically added here -->
            </div>
            <div class="form-group">
                <label for="totalKills">Total Kills</label>
                <input type="number" id="totalKills" min="0" value="0">
            </div>
            <div id="playerKillsContainer">
                <!-- Player kill inputs will be dynamically added here -->
            </div>
            <div class="form-group">
                <label for="highlightVideo">Highlight Video</label>
                <input type="file" id="highlightVideo" accept="video/*">
            </div>
            <button type="submit" class="button">Add Match</button>
        </form>
    `;
    
    document.getElementById('addMatchForm').addEventListener('submit', (e) => addMatch(e, sessionId));
    document.getElementById('gameType').addEventListener('change', updateGameModeAndMapOptions);
    updatePlayerKillInputs();
    modal.style.display = 'block';
}
*/
// Function to add a new match
async function addMatch(e, sessionId) {
    e.preventDefault();
    const form = e.target;
    const matchData = {
        gameType: form.gameType.value,
        gameMode: form.gameMode.value,
        map: form.map.value,
        placement: form.gameType.value === 'warzone' ? parseInt(form.placement.value) : form.placement.checked ? 'Won' : 'Lost',
        totalKills: parseInt(form.totalKills.value),
        kills: {},
        timestamp: Date.now()
    };

    // Process individual player kills
    document.querySelectorAll('[id^="kills-"]').forEach(input => {
        const player = input.id.split('-')[1];
        const kills = parseInt(input.value);
        if (!isNaN(kills)) {
            matchData.kills[player] = kills;
        }
    });

    // Handle highlight video
    const highlightVideo = form.highlightVideo.files[0];
    if (highlightVideo) {
        try {
            const videoRef = storageRef(storage, `highlights/${sessionId}/${Date.now()}_${highlightVideo.name}`);
            const snapshot = await uploadBytes(videoRef, highlightVideo);
            const url = await getDownloadURL(snapshot.ref);
            matchData.highlightURL = url;
        } catch (error) {
            console.error("Error uploading highlight video:", error);
            alert('Error uploading highlight video. The match will be saved without the video.');
        }
    }

    // Save match data
    const newMatchRef = push(ref(database, `gameSessions/${sessionId}/matches`));
    set(newMatchRef, matchData).then(() => {
        document.getElementById('modal').style.display = 'none';
        loadMatches(sessionId);
    }).catch((error) => {
        console.error("Error adding match:", error);
        alert('Error adding match. Please try again.');
    });
}

// Show modal for editing a match
function showEditMatchModal(sessionId, matchId) {
    const modal = document.getElementById('modal');
    const modalContent = document.getElementById('modalContent');
    
    get(ref(database, `gameSessions/${sessionId}/matches/${matchId}`)).then((snapshot) => {
        if (snapshot.exists()) {
            const match = snapshot.val();
            modalContent.innerHTML = `
                <h3>Edit Match</h3>
                <form id="editMatchForm">
                    <div class="form-group">
                        <label for="gameType">Game Type</label>
                        <select id="gameType" required onchange="updateGameModeOptions()">
                            <option value="warzone" ${match.gameType === 'warzone' ? 'selected' : ''}>Warzone</option>
                            <option value="multiplayer" ${match.gameType === 'multiplayer' ? 'selected' : ''}>Multiplayer</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="gameMode">Game Mode</label>
                        <select id="gameMode" required>
                            <option value="${match.gameMode}">${match.gameMode}</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="map">Map</label>
                        <select id="map" required>
                            <option value="${match.map}">${match.map}</option>
                        </select>
                    </div>
                    <div id="placementContainer" class="form-group">
                        <!-- Placement input will be dynamically added here -->
                    </div>
                    <div class="form-group">
                        <label for="totalKills">Total Kills</label>
                        <input type="number" id="totalKills" min="0" value="${match.totalKills || 0}">
                    </div>
                    <div id="playerKillsContainer">
                        <!-- Player kill inputs will be dynamically added here -->
                    </div>
                    <div class="form-group">
                        <label for="highlightVideo">Highlight Video</label>
                        <input type="file" id="highlightVideo" accept="video/*">
                        ${match.highlightURL ? `<p>Current video: <a href="${match.highlightURL}" target="_blank">View</a></p>` : ''}
                    </div>
                    <button type="submit" class="button">Update Match</button>
                </form>
            `;
            
           document.getElementById('editMatchForm').addEventListener('submit', (e) => updateMatch(e, sessionId, matchId));
            document.getElementById('gameType').addEventListener('change', updateGameModeAndMapOptions);
            updateGameModeAndMapOptions();
            updatePlacementInput(match.gameType, match.placement);
            updatePlayerKillInputs(match.kills);
            modal.style.display = 'block';
        }
    });
}

// Function to update a match
async function updateMatch(e, sessionId, matchId) {
    e.preventDefault();
    const form = e.target;
    const matchData = {
        gameType: form.gameType.value,
        gameMode: form.gameMode.value,
        map: form.map.value,
        placement: form.gameType.value === 'warzone' ? parseInt(form.placement.value) : form.placement.checked ? 'Won' : 'Lost',
        totalKills: parseInt(form.totalKills.value),
        kills: {},
        timestamp: Date.now()
    };

    // Process individual player kills
    document.querySelectorAll('[id^="kills-"]').forEach(input => {
        const player = input.id.split('-')[1];
        const kills = parseInt(input.value);
        if (!isNaN(kills)) {
            matchData.kills[player] = kills;
        }
    });

    // Handle highlight video
    const highlightVideo = form.highlightVideo.files[0];
    if (highlightVideo) {
        try {
            const videoRef = storageRef(storage, `highlights/${sessionId}/${Date.now()}_${highlightVideo.name}`);
            const snapshot = await uploadBytes(videoRef, highlightVideo);
            const url = await getDownloadURL(snapshot.ref);
            matchData.highlightURL = url;
        } catch (error) {
            console.error("Error uploading highlight video:", error);
            alert('Error uploading highlight video. The match will be updated without changing the video.');
        }
    }

    // Update match data
    update(ref(database, `gameSessions/${sessionId}/matches/${matchId}`), matchData).then(() => {
        document.getElementById('modal').style.display = 'none';
        loadMatches(sessionId);
    }).catch((error) => {
        console.error("Error updating match:", error);
        alert('Error updating match. Please try again.');
    });
}

// Function to update game mode and map options based on selected game type
async function updateGameModeAndMapOptions() {
    const gameType = document.getElementById('gameType').value;
    const gameModeSelect = document.getElementById('gameMode');
    const mapSelect = document.getElementById('map');

    // Clear existing options
    gameModeSelect.innerHTML = '<option value="">Select Game Mode</option>';
    mapSelect.innerHTML = '<option value="">Select Map</option>';

    if (gameType) {
        try {
            // Fetch game modes
            const gameModes = await getGameModes(gameType);
            gameModes.forEach(mode => {
                const option = document.createElement('option');
                option.value = mode.name;
                option.textContent = mode.name;
                gameModeSelect.appendChild(option);
            });

            // Fetch maps
            const maps = await getMaps(gameType);
            maps.forEach(map => {
                const option = document.createElement('option');
                option.value = map.name;
                option.textContent = map.name;
                mapSelect.appendChild(option);
            });

            // Update placement input
            updatePlacementInput(gameType);
        } catch (error) {
            console.error('Error fetching game modes or maps:', error);
        }
    }
}

// Function to update placement input based on game type
function updatePlacementInput(gameType, currentPlacement = null) {
    const placementContainer = document.getElementById('placementContainer');
    
    if (gameType === 'warzone') {
        placementContainer.innerHTML = `
            <label for="placement">Placement <span id="placementValue"></span></label>
            <input type="range" id="placement" class="slider" min="1" max="150" step="1" value="${currentPlacement || 1}" required>
        `;
        const placementSlider = document.getElementById('placement');
        const placementValue = document.getElementById('placementValue');
        placementValue.textContent = currentPlacement || '1st';
        placementSlider.addEventListener('input', () => {
            placementValue.textContent = placementSlider.value === '1' ? '1st' : 
                                         placementSlider.value === '2' ? '2nd' : 
                                         placementSlider.value === '3' ? '3rd' : 
                                         `${placementSlider.value}th`;
        });
    } else if (gameType === 'multiplayer') {
        placementContainer.innerHTML = `
            <label for="placement">Result</label>
            <div class="toggle-switch">
                <input type="checkbox" id="placement" name="placement" class="toggle-input" ${currentPlacement === 'Won' ? 'checked' : ''}>
                <label for="placement" class="toggle-label">
                    <span class="toggle-inner"></span>
                </label>
            </div>
        `;
    }
}

// Function to update player kill inputs
function updatePlayerKillInputs(currentKills = {}) {
    const playerKillsContainer = document.getElementById('playerKillsContainer');
    playerKillsContainer.innerHTML = '';

    ['STARMAN', 'RSKILLA', 'SWFTSWORD', 'VAIDED', 'MOWGLI'].forEach(player => {
        playerKillsContainer.innerHTML += `
            <div class="form-group">
                <label for="kills-${player}">${player} Kills</label>
                <input type="number" id="kills-${player}" min="0" value="${currentKills[player] || 0}">
            </div>
        `;
    });
}

// Function to get game modes for a given game type
async function getGameModes(gameType) {
    const snapshot = await get(ref(database, `gameTypes/${gameType}/gameModes`));
    if (snapshot.exists()) {
        return Object.entries(snapshot.val()).map(([id, mode]) => ({
            id,
            name: mode.name
        }));
    }
    return [];
}

// Function to get maps for a given game type
async function getMaps(gameType) {
    const snapshot = await get(ref(database, `maps/${gameType}`));
    if (snapshot.exists()) {
        return Object.entries(snapshot.val()).map(([id, map]) => ({
            id,
            name: map.name
        }));
    }
    return [];
}

// Utility function to format date for input fields
function formatDateForInput(dateString) {
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
}

// Function to view highlight video
function viewHighlight(url) {
    window.open(url, '_blank');
}

// Function to show Team Members page
function showTeamMembers() {
    mainContent.innerHTML = `
        <h2>Team Members</h2>
        <div id="teamList" class="team-list"></div>
    `;
    loadTeamMembers();
}

// Function to load and display team members
function loadTeamMembers() {
    const teamList = document.getElementById('teamList');
    teamList.innerHTML = 'Loading team members...';

    onValue(ref(database, 'teamMembers'), (snapshot) => {
        teamList.innerHTML = '';
        snapshot.forEach((childSnapshot) => {
            const member = childSnapshot.val();
            const memberId = childSnapshot.key;
            const age = calculateAge(member.birthdate);
            
            let photoURL = member.photoURL;
            if (!photoURL || (!photoURL.startsWith('https://') && !photoURL.startsWith('gs://'))) {
                console.warn(`Invalid photo URL for member ${memberId}:`, photoURL);
                photoURL = 'path/to/default/profile.png'; // Provide a default image path
            }

            teamList.innerHTML += `
                <div class="card">
                    <img src="${photoURL}" alt="${member.name}" class="team-photo" onerror="this.src='path/to/fallback/profile.png';">
                    <div class="member-details">
                        <h3>${member.name}</h3>
                        <p><strong>Gamertag:</strong> ${member.gamertag}</p>
                        <p><strong>State:</strong> ${member.state}</p>
                        <p><strong>Birthdate:</strong> ${member.birthdate} (Age: ${age})</p>
                        <p><strong>Favorite Snack:</strong> ${member.favoriteSnack}</p>
                        <p><strong>BR PR:</strong> ${member.brPR !== undefined ? member.brPR : 'N/A'} ${member.brPRDate ? `(${formatDate(member.brPRDate)})` : ''}</p>
                        <p><strong>MP PR:</strong> ${member.mpPR !== undefined ? member.mpPR : 'N/A'} ${member.mpPRDate ? `(${formatDate(member.mpPRDate)})` : ''}</p>
                    </div>
                    <div class="actions">
                        <button class="button" onclick="showModal('editTeamMember', '${memberId}')">Edit</button>
                    </div>
                </div>
            `;
        });
        if (teamList.innerHTML === '') {
            teamList.innerHTML = 'No team members found.';
        }
    });
}

// Utility function to calculate age
function calculateAge(birthdate) {
    const today = new Date();
    const birthDate = new Date(birthdate);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age;
}

// Utility function to format date
function formatDate(dateString) {
    const date = new Date(dateString);
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString(undefined, options);
}

// Modal function for editing team member
window.showModal = function(action, id = null) {
    if (action === 'editTeamMember') {
        get(ref(database, `teamMembers/${id}`)).then((snapshot) => {
            if (snapshot.exists()) {
                const member = snapshot.val();
                modalContent.innerHTML = `
                    <h3>Edit Team Member</h3>
                    <form id="teamMemberForm" data-id="${id}">
                        <input type="text" id="name" value="${member.name}" required>
                        <input type="text" id="gamertag" value="${member.gamertag}" required>
                        <input type="text" id="state" value="${member.state}" required>
                        <input type="date" id="birthdate" value="${member.birthdate}" required>
                        <input type="text" id="favoriteSnack" value="${member.favoriteSnack}" required>
                        <input type="file" id="photo" accept="image/*">
                        <button type="submit">Update Team Member</button>
                    </form>
                `;
                document.getElementById('teamMemberForm').addEventListener('submit', updateTeamMember);
                modal.style.display = "block";
            }
        });
    }
}

// Function to update team member
async function updateTeamMember(e) {
    e.preventDefault();
    const form = e.target;
    const memberId = form.dataset.id;
    const memberData = {
        name: form.name.value,
        gamertag: form.gamertag.value,
        state: form.state.value,
        birthdate: form.birthdate.value,
        favoriteSnack: form.favoriteSnack.value
    };

    const photo = form.photo.files[0];
    if (photo) {
        try {
            const photoRef = storageRef(storage, `teamMembers/${Date.now()}_${photo.name}`);
            const snapshot = await uploadBytes(photoRef, photo);
            const url = await getDownloadURL(snapshot.ref);
            if (!url.startsWith('https://') && !url.startsWith('gs://')) {
                throw new Error('Invalid photo URL generated');
            }
            memberData.photoURL = url;
        } catch (error) {
            console.error('Error uploading team member photo:', error);
            alert('Error uploading photo. Please try again.');
            return;
        }
    }

    try {
        await update(ref(database, `teamMembers/${memberId}`), memberData);
        loadTeamMembers();
        modal.style.display = "none";
    } catch (error) {
        console.error("Error updating team member: ", error);
        alert('Error updating team member. Please try again.');
    }
}

function showHelp() {
  mainContent.innerHTML = '<h2>Help</h2><p>Help information will be displayed here.</p>';
}

function showAbout() {
  mainContent.innerHTML = '<h2>About Us</h2><p>Information about My COD Squad will be displayed here.</p>';
}
