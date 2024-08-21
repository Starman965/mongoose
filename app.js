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

// Navigation setup (keep only these)
document.getElementById('statsNav').addEventListener('click', () => showSection('stats'));
document.getElementById('sessionsNav').addEventListener('click', () => showSection('sessions'));
document.getElementById('achievementsNav').addEventListener('click', () => showAchievementsPage());
document.getElementById('highlightsNav').addEventListener('click', () => showSection('highlights'));
document.getElementById('teamNav').addEventListener('click', () => showSection('team'));
document.getElementById('adminNav').addEventListener('click', () => showSection('admin'));
document.getElementById('helpNav').addEventListener('click', () => showSection('help'));
document.getElementById('aboutNav').addEventListener('click', () => showSection('about'));

// Centralized function to handle navigation
function showSection(section) {
  switch(section) {
    case 'stats': showStats(); break;
    case 'sessions': showGameSessions(); break;
    case 'highlights': showHighlightsPage(); break;
    case 'team': showTeamMembers(); break;
    case 'admin': showAdmin(); break;
    case 'help': showHelp(); break;
    case 'about': showAbout(); break;
    default: 
      const mainContent = document.getElementById('mainContent');
      mainContent.innerHTML = '<h2>Page Not Found</h2>';
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
 window.deleteMatch = function(sessionId, matchId) {
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
window.showAddMatchModal = function(sessionId) {
    const modal = document.getElementById('modal');
    const modalContent = document.getElementById('modalContent');
    
    modalContent.innerHTML = `
        <h3>Add New Match</h3>
        <form id="addMatchForm">
            <div class="form-group">
                <label for="gameType">Game Type</label>
                <select id="gameType" required>
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
                <label for="totalKills">Total Kills <span id="totalKillsValue">0</span></label>
                <input type="range" id="totalKills" min="0" max="100" value="0" class="slider" required>
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
    
    // Attach event listener for the game type dropdown
    const gameTypeElement = document.getElementById('gameType');
    gameTypeElement.removeEventListener('change', window.updateGameModeAndMapOptions); // Prevent multiple listeners
    gameTypeElement.addEventListener('change', window.updateGameModeAndMapOptions);

    // Total kills slider
    const totalKillsSlider = document.getElementById('totalKills');
    const totalKillsValue = document.getElementById('totalKillsValue');
    
    totalKillsSlider.addEventListener('input', () => {
        totalKillsValue.textContent = totalKillsSlider.value;
    });
    
    // Attach event listener for form submission
    document.getElementById('addMatchForm').addEventListener('submit', (e) => addMatch(e, sessionId));

    // Initial setup for player kill inputs
    updatePlayerKillInputs();

    // Show the modal
    modal.style.display = 'block';
}

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
 window.showEditMatchModal =  function(sessionId, matchId) {
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
window.updateGameModeAndMapOptions = async function() {
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
            <input type="range" id="placement" class="slider" min="1" max="10" step="1" value="${currentPlacement || 1}" required>
        `;
        const placementSlider = document.getElementById('placement');
        const placementValue = document.getElementById('placementValue');
        placementValue.textContent = getPlacementText(currentPlacement || 1);

        placementSlider.addEventListener('input', () => {
            placementValue.textContent = getPlacementText(placementSlider.value);
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

function getPlacementText(value) {
    if (value === '1') return '1st';
    if (value === '2') return '2nd';
    if (value === '3') return '3rd';
    return `${value}th`;
}


// Function to update player kill inputs
function updatePlayerKillInputs(currentKills = {}) {
    const playerKillsContainer = document.getElementById('playerKillsContainer');
    playerKillsContainer.innerHTML = ''; // Clear the container before adding sliders
    
    ['STARMAN', 'RSKILLA', 'SWFTSWORD', 'VAIDED', 'MOWGLI'].forEach(player => {
        const playerKills = currentKills[player] || 0;
        const playerId = `kills-${player}`; // Unique ID for each player's slider and value display

        playerKillsContainer.innerHTML += `
            <div class="form-group">
                <label for="${playerId}">${player} Kills <span id="killsValue-${player}">${playerKills}</span></label>
                <input type="range" id="${playerId}" min="0" max="30" value="${playerKills}" class="slider" required>
            </div>
        `;
    });
    
    // After rendering all sliders, attach event listeners
    ['STARMAN', 'RSKILLA', 'SWFTSWORD', 'VAIDED', 'MOWGLI'].forEach(player => {
        const playerId = `kills-${player}`;
        const killsSlider = document.getElementById(playerId);
        const killsValue = document.getElementById(`killsValue-${player}`);
        
        // Attach event listener to update the corresponding kills value display
        killsSlider.addEventListener('input', () => {
            killsValue.textContent = killsSlider.value;
        });
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

// Highlights Page Functions
// Function to show Highlights page
function showHighlightsPage() {
    mainContent.innerHTML = `
        <h2>Match Highlights</h2>
        <div id="highlightsTableContainer">
            <table id="highlightsTable" class="highlights-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Game Type</th>
                        <th>Game Mode</th>
                        <th>Map</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    <!-- Highlight Rows will be dynamically added here -->
                </tbody>
            </table>
        </div>
    `;
    loadHighlights();
}

// Function to load highlights
function loadHighlights() {
    const highlightsTableBody = document.querySelector('#highlightsTable tbody');
    highlightsTableBody.innerHTML = 'Loading highlights...';

    // Fetch game sessions from the database
    get(ref(database, 'gameSessions')).then((snapshot) => {
        const sessions = [];
        snapshot.forEach((childSnapshot) => {
            const session = childSnapshot.val();
            session.id = childSnapshot.key;
            sessions.push(session);
        });

        let highlightRows = '';
        sessions.forEach((session) => {
            const sessionDate = formatDate(session.date, session.userTimezoneOffset);

            Object.entries(session.matches || {}).forEach(([matchId, match]) => {
                if (match.highlightURL) {
                    highlightRows += `
                        <tr>
                            <td>${sessionDate}</td>
                            <td>${match.gameType}</td>
                            <td>${match.gameMode}</td>
                            <td>${match.map}</td>
                            <td>
                                <button class="button" onclick="viewHighlight('${match.highlightURL}')">View Highlight</button>
                            </td>
                        </tr>
                    `;
                }
            });
        });

        // Populate the table with the highlight rows
        if (highlightRows === '') {
            highlightsTableBody.innerHTML = '<tr><td colspan="5">No highlights found.</td></tr>';
        } else {
            highlightsTableBody.innerHTML = highlightRows;
        }
    }).catch((error) => {
        console.error("Error loading highlights:", error);
        highlightsTableBody.innerHTML = '<tr><td colspan="5">Error loading highlights. Please try again.</td></tr>';
    });
}



// ChatGPT 8.20: These Functions are to view highlight video in a modal in Matches Area
window.viewHighlight = function(url) {
    const modal = document.getElementById('videoModal');
    const videoPlayer = document.getElementById('highlightVideoPlayer');
    const videoSource = document.getElementById('highlightVideoSource');

    // Set the video source to the provided URL
    videoSource.src = url;
    videoPlayer.load(); // Reload the video element with the new source

    // Show the modal
    modal.style.display = 'block';
    
    // Play the video when modal is opened
    videoPlayer.play();
}

// Get the modal element and the close button
const videoModal = document.getElementById('videoModal');
const closeVideoModal = document.getElementById('closeVideoModal');

// Close the modal when the 'x' is clicked
closeVideoModal.onclick = function() {
    const videoPlayer = document.getElementById('highlightVideoPlayer');

    // Pause the video when the modal is closed
    videoPlayer.pause();

    // Hide the modal
    videoModal.style.display = 'none';
}

// Close the modal if the user clicks anywhere outside of the modal content
window.onclick = function(event) {
    if (event.target == videoModal) {
        const videoPlayer = document.getElementById('highlightVideoPlayer');

        // Pause the video when the modal is closed
        videoPlayer.pause();

        // Hide the modal
        videoModal.style.display = 'none';
    }
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
  mainContent.innerHTML = '<h2>Help</h2><p>If you need help and this is an emergency, please log off and call 911.</p>';
}

function showAbout() {
  mainContent.innerHTML = `
    <div class="about-us" style="text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center;">
  <!-- Team Logo -->
  <div class="team-logo-about">
    <img src="2022-group-logo.png" alt="Mongoose Omelette Team Logo" width="300" height="300" style="display: block; margin: 0 auto;">
  </div>

      <!-- About Us Header -->
      <h1 style="text-align: center; color: #FFD700; font-size: 2em; margin-bottom: 20px;">
        About Us: The Story of Mongoose Omelet
      </h1>

      <!-- Pull Quote -->
      <blockquote style="border-left: 4px solid #FFD700; padding-left: 15px; font-style: italic; color: #FFD700; margin: 20px 0; font-size: 1.2em;">
        "Winning isn’t everything. It’s the joy of playing together, pushing each other to be better, and celebrating our ridiculous achievements along the way."  -- Said No One
      </blockquote>

      <!-- Story Content -->
      <p>Our story begins over a decade ago, when fate brought David (STARMAN) and Ron (RSKILLA) together at a company called DemandGen. They were colleagues, yes—but more importantly, they were kindred spirits. Between the client meetings, company offsites, and work-at-home culture, they discovered a mutual love for video gaming, particularly Call of Duty. Though life moved on, and years passed without so much as a virtual bullet fired between them, their friendship endured.</p>

      <p>And then the world stopped. The global pandemic hit, and like so many others, we found ourselves locked away, searching for ways to reconnect and pass the time. Call of Duty nights became our answer. What began as a casual reunion soon transformed into something more—a weekly ritual of strategy, camaraderie, late night snacks, and plenty of laughs.</p>

      <p>By this time, Ron had met the love of his life, Megan, and the two had married, bringing two beautiful daughters into the world. Along with his new family, Ron also gained two awesome brother-in-laws: Dan (VAIDED) and Brad (SWFTSWORD). Like David and Ron, Dan and Brad were also passionate gamers. Naturally, it didn’t take long before they roped them into the squad. And thus, the core of what would become <em>Mongoose Omelet</em> was formed—named after Dan and Brad’s legendary high school band.</p>

      <p>But the team wouldn’t stop there. Ron soon reached out to Usman (MOWGLI), a childhood friend from the days of pickup basketball games and hijinks, asking if he’d be interested in joining our Call of Duty crew. We knew that life often got in the way—work, family, and other commitments sometimes meant we needed an alternate player to keep the team full. Usman jumped in, and the five of us began a new tradition: every Thursday night, without fail, we would squad up and dive into the virtual battlefield together.</p>

      <p>Since 2019, this tradition has endured. And in April 2024, something magical happened. Usman got engaged to his wonderful wife Amber, and they decided to host their wedding at none other than Disney World—The Happiest Place on Earth. As the date approached, we realized this wedding wasn’t just about celebrating love (though it certainly was that). It would also be the first time the five of us met in person. After years of Thursday night gaming, the <em>Mongoose Omelet</em> squad was finally face-to-face, united in both real life and in the game.</p>

      <p>That meeting sparked something new. We realized that what we loved most about Call of Duty wasn’t just the thrill of victory—it was the joy of playing together, pushing each other to be better, and celebrating our small, ridiculous achievements along the way. That’s when the idea for the COD Squad app was born. We wanted to create a way to tally our team’s stats, wins, and deliver team achievements — a virtual trophy case, if you will. And so, My COD Squad was created for us, and one day for you.</p>

      <p>Today, we continue to play every Thursday night, not just for the wins, but for the moments in between—the jokes, the strategies, the hilarious defeats, and the glorious victories.</p>

      <p>Welcome to the world of <em>Mongoose Omelet</em>. Grab your controller, and let’s get to work.</p>
      
      <p>You can watch us weekly on Dan's <a href="https://www.twitch.tv/tubecrazed" target="_blank">Twitch Channel</a>.</p>


      <!-- Centered Wedding Photo -->
      <div class="wedding-photo" style="text-align: center; margin: 30px 0;">
        <img src="wedding-photo.JPG" alt="Wedding Photo" style="max-width: 500px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
        <figcaption style="color: #FFD700; font-style: italic; margin-top: 10px;">The first time we met in person at Usman’s wedding in Disney World</figcaption>
      </div>

      <!-- Embedded Team Trailer -->
      <div class="team-trailer" style="text-align: center; margin-top: 20px;">
        <video controls style="max-width: 100%; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <source src="mongooseIntro.mp4" type="video/mp4">
          Your browser does not support the video tag.
        </video>
      </div>
    </div>
  `;
}
function showAdmin() {
    mainContent.innerHTML = `
        <h2>Administration</h2>
        <div id="adminTabs" class="admin-options">
            <button id="achievementsAdminNav" class="admin-button">Achievements</button>
            <button id="teamMembersAdminNav" class="admin-button">Team Members</button>
            <button id="gameTypesAdminNav" class="admin-button">Game Types and Modes</button>
            <button id="mapsAdminNav" class="admin-button">Maps</button>
            <button id="dbUtilitiesAdminNav" class="admin-button">Database Utilities</button>
        </div>
        <div id="adminContent">
            <!-- Content for the selected admin tab will be displayed here -->
            <p>Select an admin section to manage.</p>
        </div>
    `;

    // Attach event listeners for the Admin buttons
    document.getElementById('achievementsAdminNav').addEventListener('click', () => showAchievementsPage());
    document.getElementById('teamMembersAdminNav').addEventListener('click', () => showAdminTeamMembersPage());
    document.getElementById('gameTypesAdminNav').addEventListener('click', () => showGameTypesPage());
    document.getElementById('mapsAdminNav').addEventListener('click', () => showMapsPage());
    document.getElementById('dbUtilitiesAdminNav').addEventListener('click', () => showDatabaseUtilitiesPage());
}

function showAdminTeamMembersPage() {
    const adminContent = document.getElementById('adminContent');
    adminContent.innerHTML = '<h2>Manage Team Members</h2><p>Team member management UI will go here.</p>';
}

function showGameTypesPage() {
    const adminContent = document.getElementById('adminContent');
    adminContent.innerHTML = '<h2>Manage Game Types and Modes</h2><p>Game Types and Modes management UI will go here.</p>';
}

function showMapsPage() {
    const adminContent = document.getElementById('adminContent');
    adminContent.innerHTML = '<h2>Manage Maps</h2><p>Maps management UI will go here.</p>';
}

function showDatabaseUtilitiesPage() {
    const adminContent = document.getElementById('adminContent');
    adminContent.innerHTML = '<h2>Database Utilities</h2><p>Database utilities and tools will go here.</p>';
}

// Achievements Tab
function showAchievementsPage() {
    const mainContent = document.getElementById('mainContent');
    
    mainContent.innerHTML = `
        <h2>Achievements</h2>
        <div id="achievementsContainer" class="achievements-container">
            <!-- Achievements will be dynamically loaded here -->
        </div>
    `;

    loadAchievements();  // Load the achievements from the database
}
function loadAchievements() {
    const achievementsContainer = document.getElementById('achievementsContainer');
    achievementsContainer.innerHTML = 'Loading achievements...';

    // Fetch achievements from the database
    onValue(ref(database, 'achievements'), (snapshot) => {
        achievementsContainer.innerHTML = '';
        
        snapshot.forEach((childSnapshot) => {
            const achievement = childSnapshot.val();
            const achievementId = childSnapshot.key;

            // Display each achievement
            achievementsContainer.innerHTML += `
                <div class="achievement-card">
                    <h3>${achievement.title}</h3>
                    <p>${achievement.description}</p>
                    <p><strong>Difficulty:</strong> ${achievement.difficulty}</p>
                    <p><strong>Status:</strong> ${achievement.status}</p>
                    <p><strong>Points:</strong> ${achievement.achievementPoints}</p>
                    <p><strong>Award:</strong> ${achievement.award} (Sponsored by ${achievement.awardSponsor})</p>
                </div>
            `;
        });

        if (achievementsContainer.innerHTML === '') {
            achievementsContainer.innerHTML = '<p>No achievements found.</p>';
        }
    });
}
function analyzeAchievements() {
    // Fetch all matches from the database
    onValue(ref(database, 'gameSessions'), (snapshot) => {
        snapshot.forEach((sessionSnapshot) => {
            const session = sessionSnapshot.val();
            
            session.matches && Object.keys(session.matches).forEach((matchId) => {
                const match = session.matches[matchId];
                
                // Fetch achievements from the database
                onValue(ref(database, 'achievements'), (achievementSnapshot) => {
                    achievementSnapshot.forEach((achievementChild) => {
                        const achievement = achievementChild.val();
                        const achievementId = achievementChild.key;
                        
                        // Check if the achievement allows using historical data
                        if (achievement.useHistoricalData) {
                            checkAchievementCriteria(match, achievement, achievementId);
                        }
                    });
                });
            });
        });
    });
}

function checkAchievementCriteria(match, achievement, achievementId) {
    // Check the criteria for the specific achievement
    if (achievement.title === "STARMAN's Rampage") {
        if (match.kills && match.kills.STARMAN >= 10) {
            updateAchievementProgress(achievementId);
        }
    }

    // Add other achievement checks here as needed
}

function updateAchievementProgress(achievementId) {
    const achievementRef = ref(database, `achievements/${achievementId}`);

    get(achievementRef).then((snapshot) => {
        if (snapshot.exists()) {
            const achievement = snapshot.val();
            console.log("Achievement data before update:", achievement);

            // Update the achievement's status to "Completed" if it's not already completed
            if (achievement.status !== 'Completed') {
                console.log(`Updating achievement ${achievementId} to Completed.`);
                update(achievementRef, {
                    status: 'Completed',
                    completionCount: achievement.completionCount + 1
                }).then(() => {
                    console.log("Achievement successfully updated.");
                }).catch((error) => {
                    console.error("Error updating achievement:", error);
                });
            }
        } else {
            console.error("Achievement not found:", achievementId);
        }
    }).catch((error) => {
        console.error("Error fetching achievement:", error);
    });
}

function displayAchievements() {
    const achievementsContainer = document.getElementById('achievementsContainer');
    achievementsContainer.innerHTML = '';

    onValue(ref(database, 'achievements'), (snapshot) => {
        snapshot.forEach((childSnapshot) => {
            const achievement = childSnapshot.val();
            const achievementId = childSnapshot.key;

            // Add trophy icon if achievement is completed
            const awardIcon = achievement.status === 'Completed' ? '<img src="achievementbadgedefault.png" alt="Trophy" />' : '';
            
            achievementsContainer.innerHTML += `
                <div class="achievement-card">
                    <h3>${achievement.title}</h3>
                    <p>${achievement.description}</p>
                    <p><strong>Difficulty:</strong> ${achievement.difficulty}</p>
                    <p><strong>Status:</strong> ${achievement.status}</p>
                    <p><strong>Award:</strong> ${achievement.award} ${awardIcon}</p>
                    <p><strong>Points:</strong> ${achievement.achievementPoints}</p>
                </div>
            `;
        });
    });
}
