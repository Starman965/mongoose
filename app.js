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
            stats[gameType].gamesPlayed++;
            stats[gameType].kills += match.totalKills || 0;

            // Game mode stats
            if (!stats.gameModes[match.gameMode]) {
                stats.gameModes[match.gameMode] = { gamesPlayed: 0, wins: 0, kills: 0 };
            }
            stats.gameModes[match.gameMode].gamesPlayed++;
            stats.gameModes[match.gameMode].kills += match.totalKills || 0;

            if (gameType === 'warzone') {
                if (match.placement === 1) stats.warzone.wins++;
                if (match.placement <= 5) stats.warzone.top5++;
            } else if (gameType === 'multiplayer') {
                if (match.placement === 'Won') {
                    stats.multiplayer.wins++;
                    stats.gameModes[match.gameMode].wins++;
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

function showGameSessions() {
  mainContent.innerHTML = '<h2>Game Sessions</h2><p>Game sessions will be displayed here.</p>';
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
