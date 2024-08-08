import { ref, onValue, push, update, remove, get } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js";

const database = window.database;
const storage = getStorage();

// DOM elements
const mainContent = document.getElementById('mainContent');
const modal = document.getElementById('modal');
const modalContent = document.getElementById('modalContent');
const closeModal = document.getElementsByClassName('close')[0];

// Close modal when clicking on 'x'
closeModal.onclick = () => modal.style.display = "none";

// Close modal when clicking outside of it
window.onclick = (event) => {
  if (event.target == modal) {
    modal.style.display = "none";
  }
}

// Navigation setup
document.getElementById('statsNav').addEventListener('click', () => showSection('stats'));
document.getElementById('sessionsNav').addEventListener('click', () => showSection('sessions'));
document.getElementById('highlightsNav').addEventListener('click', () => showSection('highlights'));
document.getElementById('mapsNav').addEventListener('click', () => showSection('maps'));
document.getElementById('modesNav').addEventListener('click', () => showSection('modes'));
document.getElementById('teamNav').addEventListener('click', () => showSection('team'));

function showSection(section) {
  switch(section) {
    case 'stats':
      showStats();
      break;
    case 'sessions':
      showGameSessions();
      break;
    case 'highlights':
      showHighlights();
      break;
    case 'maps':
      showMaps();
      break;
    case 'modes':
      showGameModes();
      break;
    case 'team':
      showTeamMembers();
      break;
  }
}
function manualPRRecalculation() {
    calculatePRValues();
    setTimeout(() => {
        loadTeamMembers();
    }, 2000);  // Wait 2 seconds for the calculation to complete before reloading
}

function showTeamMembers() {
    mainContent.innerHTML = `
        <h2>Team Members</h2>
        <button class="button" onclick="showModal('addTeamMember')">Add Team Member</button>
        <div id="teamList" class="team-list"></div>
    `;
    loadTeamMembers();
}

function loadTeamMembers() {
    const teamList = document.getElementById('teamList');
    teamList.innerHTML = 'Loading team members...';

    onValue(ref(database, 'teamMembers'), (snapshot) => {
        teamList.innerHTML = '';
        snapshot.forEach((childSnapshot) => {
            const member = childSnapshot.val();
            const memberId = childSnapshot.key;
            const age = calculateAge(member.birthdate);
            console.log(`Loading member ${member.name}:`, member);
            teamList.innerHTML += `
                <div class="card">
                    <img src="${member.photoURL}" alt="${member.name}" class="team-photo">
                    <div class="member-details">
                        <h3>${member.name}</h3>
                        <p><strong>Gamertag:</strong> ${member.gamertag}</p>
                        <p><strong>State:</strong> ${member.state}</p>
                        <p><strong>Birthdate:</strong> ${member.birthdate} (Age: ${age})</p>
                        <p><strong>Favorite Snack:</strong> ${member.favoriteSnack}</p>
                        <p><strong>BR PR:</strong> ${member.brPR !== undefined ? member.brPR : 'N/A'}</p>
                        <p><strong>MP PR:</strong> ${member.mpPR !== undefined ? member.mpPR : 'N/A'}</p>
                    </div>
                    <div class="actions">
                        <button class="button" onclick="showModal('editTeamMember', '${memberId}')">Edit</button>
                        <button class="button" onclick="deleteTeamMember('${memberId}')">Delete</button>
                    </div>
                </div>
            `;
        });
        if (teamList.innerHTML === '') {
            teamList.innerHTML = 'No team members found. Add some!';
        }
    });
}
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
// Add this function definition after calculateAge function
function calculatePRValues() {
  console.log("Starting PR value calculation");
  get(ref(database, 'gameModes')).then((gameModeSnapshot) => {
    const gameModes = {};
    gameModeSnapshot.forEach(child => {
      gameModes[child.val().name] = child.val().type;
    });
    console.log("Game Modes:", gameModes);

    get(ref(database, 'gameSessions')).then((sessionsSnapshot) => {
      const prValues = {};

      sessionsSnapshot.forEach((sessionSnapshot) => {
        const session = sessionSnapshot.val();
        if (session.matches) {
          Object.values(session.matches).forEach((match) => {
            console.log("Processing match:", match);
            const gameType = gameModes[match.gameMode] === 'Battle Royale' ? 'brPR' : 'mpPR';
            console.log("Game Type:", gameType);
            
            Object.entries(match.kills || {}).forEach(([player, kills]) => {
              if (!prValues[player]) {
                prValues[player] = { brPR: 0, mpPR: 0 };
              }
              prValues[player][gameType] = Math.max(prValues[player][gameType], kills);
              console.log(`Updated ${player} ${gameType} to ${prValues[player][gameType]}`);
            });
          });
        }
      });

      console.log("Final PR Values:", prValues);

      // Update PR values for each team member
      get(ref(database, 'teamMembers')).then((membersSnapshot) => {
        membersSnapshot.forEach((memberSnapshot) => {
          const memberId = memberSnapshot.key;
          const member = memberSnapshot.val();
          const memberPR = prValues[member.gamertag] || { brPR: 0, mpPR: 0 };
          console.log(`Updating ${member.name} (${member.gamertag}) PR values:`, memberPR);
          update(ref(database, `teamMembers/${memberId}`), memberPR);
        });
      });
    });
  });
}

function addOrUpdateTeamMember(e) {
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
    const photoRef = storageRef(storage, `teamMembers/${photo.name}`);
    uploadBytes(photoRef, photo).then(snapshot => {
      getDownloadURL(snapshot.ref).then(url => {
        memberData.photoURL = url;
        saveTeamMember(memberId, memberData);
      });
    });
  } else {
    saveTeamMember(memberId, memberData);
  }
}

function saveTeamMember(memberId, memberData) {
  const operation = memberId
    ? update(ref(database, `teamMembers/${memberId}`), memberData)
    : push(ref(database, 'teamMembers'), memberData);

  operation
    .then(() => {
      loadTeamMembers();
      modal.style.display = "none";
    })
    .catch(error => {
      console.error("Error adding/updating team member: ", error);
      alert('Error adding/updating team member. Please try again.');
    });
}

window.deleteTeamMember = function(id) {
  if (confirm('Are you sure you want to delete this team member?')) {
    remove(ref(database, `teamMembers/${id}`))
      .then(() => loadTeamMembers())
      .catch(error => {
        console.error("Error deleting team member: ", error);
        alert('Error deleting team member. Please try again.');
      });
  }
}
function showGameSessions() {
  mainContent.innerHTML = `
    <h2>Game Sessions</h2>
    <button class="button" onclick="showModal('addGameSession')">Add Game Session</button>
    <div id="sessionList"></div>
  `;
  loadGameSessions();
  calculatePRValues(); // Add this line to calculate PR values when showing game sessions
}

function loadGameSessions() {
    const sessionList = document.getElementById('sessionList');
    sessionList.innerHTML = 'Loading game sessions...';

    onValue(ref(database, 'gameSessions'), (snapshot) => {
        const sessions = [];
        snapshot.forEach((childSnapshot) => {
            const session = childSnapshot.val();
            session.id = childSnapshot.key;
            sessions.push(session);
        });

        sessions.sort((a, b) => new Date(b.date) - new Date(a.date));

        sessionList.innerHTML = '';
        sessions.forEach((session) => {
            sessionList.innerHTML += `
                <div class="card">
                    <h3>${formatDate(session.date)}</h3>
                    <p>Number of matches: ${session.matches ? Object.keys(session.matches).length : 0}</p>
                    <div class="button-group">
                        <button class="button" onclick="toggleMatches('${session.id}')">View Matches</button>
                        <button class="button" onclick="showModal('addMatch', '${session.id}')">Add Match</button>
                        <button class="button" onclick="showModal('editGameSession', '${session.id}')">Edit Session</button>
                        <button class="button" onclick="deleteGameSession('${session.id}')">Delete Session</button>
                    </div>
                    <div id="matches-${session.id}" class="matches-container" style="display: none;"></div>
                </div>
            `;
        });

        if (sessionList.innerHTML === '') {
            sessionList.innerHTML = 'No game sessions found. Add some!';
        }
    });
}
function formatDate(dateString) {
  const date = new Date(dateString);
  const correctedDate = new Date(date.getTime() + date.getTimezoneOffset() * 60000);
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  return correctedDate.toLocaleDateString(undefined, options);
}

window.toggleMatches = function(sessionId) {
    const matchesContainer = document.getElementById(`matches-${sessionId}`);
    if (matchesContainer.style.display === 'none') {
        loadMatches(sessionId);
        matchesContainer.style.display = 'block';
    } else {
        matchesContainer.style.display = 'none';
    }
}

function loadMatches(sessionId) {
    const matchesContainer = document.getElementById(`matches-${sessionId}`);
    get(ref(database, `gameSessions/${sessionId}`)).then((snapshot) => {
        if (snapshot.exists()) {
            const session = snapshot.val();
            let matchesHtml = '<h3>Matches</h3>';
            if (session.matches) {
                matchesHtml += '<table class="matches-table"><tr><th>Game Mode</th><th>Map</th><th>Placement</th><th>Total Kills</th><th>STARMAN</th><th>RSKILLA</th><th>SWFTSWORD</th><th>VAIDED</th><th>MOWGLI</th><th>Actions</th></tr>';
                Object.entries(session.matches).forEach(([matchId, match]) => {
                    matchesHtml += `
                        <tr>
                            <td>${match.gameMode}</td>
                            <td>${match.map}</td>
                            <td>${match.placement}</td>
                            <td>${match.totalKills || 'N/A'}</td>
                            <td>${match.kills?.STARMAN || 'N/A'}</td>
                            <td>${match.kills?.RSKILLA || 'N/A'}</td>
                            <td>${match.kills?.SWFTSWORD || 'N/A'}</td>
                            <td>${match.kills?.VAIDED || 'N/A'}</td>
                            <td>${match.kills?.MOWGLI || 'N/A'}</td>
                            <td>
                                <button class="button" onclick="showModal('editMatch', '${sessionId}', '${matchId}')">Edit</button>
                                <button class="button" onclick="deleteMatch('${sessionId}', '${matchId}')">Delete</button>
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

function addOrUpdateGameSession(e) {
  e.preventDefault();
  const form = e.target;
  const sessionId = form.dataset.id;
  const sessionData = {
    date: form.date.value,
  };

  const operation = sessionId
    ? update(ref(database, `gameSessions/${sessionId}`), sessionData)
    : push(ref(database, 'gameSessions'), sessionData);

  operation
    .then(() => {
      loadGameSessions();
      modal.style.display = "none";
    })
    .catch(error => {
      console.error("Error adding/updating game session: ", error);
      alert('Error adding/updating game session. Please try again.');
    });
}

window.deleteGameSession = function(id) {
  if (confirm('Are you sure you want to delete this game session?')) {
    remove(ref(database, `gameSessions/${id}`))
      .then(() => loadGameSessions())
      .catch(error => {
        console.error("Error deleting game session: ", error);
        alert('Error deleting game session. Please try again.');
      });
  }
}

function saveMatch(sessionId, matchId, matchData) {
  let operation;
  if (matchId) {
    // Update existing match
    operation = update(ref(database, `gameSessions/${sessionId}/matches/${matchId}`), matchData);
  } else {
    // Add new match
    operation = push(ref(database, `gameSessions/${sessionId}/matches`), matchData);
  }

  operation
    .then(() => {
      loadMatches(sessionId);
      calculatePRValues();
      modal.style.display = "none";
    })
    .catch(error => {
      console.error("Error adding/updating match: ", error);
      alert('Error adding/updating match. Please try again.');
    });
}

window.deleteMatch = function(sessionId, matchId) {
  if (confirm('Are you sure you want to delete this match?')) {
    remove(ref(database, `gameSessions/${sessionId}/matches/${matchId}`))
      .then(() => {
        loadMatches(sessionId);
        calculatePRValues(); // Add this line to recalculate PR values
      })
      .catch(error => {
        console.error("Error deleting match: ", error);
        alert('Error deleting match. Please try again.');
      });
  }
}

window.viewHighlight = function(highlightURL) {
  modalContent.innerHTML = `
    <h3>Match Highlight</h3>
    <video id="highlightVideo" controls>
      <source src="${highlightURL}" type="video/mp4">
      Your browser does not support the video tag.
    </video>
  `;
  modal.style.display = "block";
}
function addMatch(e) {
  e.preventDefault();
  const form = e.target;
  const sessionId = form.dataset.sessionId;
  const matchId = form.dataset.matchId;
  const matchData = {
    gameMode: form.gameMode.value,
    map: form.map.value,
    placement: parseInt(form.placement.value),
    totalKills: parseInt(form.totalKills.value) || 0,
    kills: {
      STARMAN: parseInt(form.killsSTARMAN.value) || 0,
      RSKILLA: parseInt(form.killsRSKILLA.value) || 0,
      SWFTSWORD: parseInt(form.killsSWFTSWORD.value) || 0,
      VAIDED: parseInt(form.killsVAIDED.value) || 0,
      MOWGLI: parseInt(form.killsMOWGLI.value) || 0
    }
  };

  const highlightVideo = form.highlightVideo.files[0];
  if (highlightVideo) {
    const videoRef = storageRef(storage, `highlights/${sessionId}/${highlightVideo.name}`);
    uploadBytes(videoRef, highlightVideo).then(snapshot => {
      getDownloadURL(snapshot.ref).then(url => {
        matchData.highlightURL = url;
        saveMatch(sessionId, matchId, matchData);
      });
    });
  } else {
    // If updating and no new video is provided, keep the existing highlightURL
    if (matchId) {
      get(ref(database, `gameSessions/${sessionId}/matches/${matchId}`)).then((snapshot) => {
        if (snapshot.exists()) {
          const existingMatch = snapshot.val();
          if (existingMatch.highlightURL) {
            matchData.highlightURL = existingMatch.highlightURL;
          }
        }
        saveMatch(sessionId, matchId, matchData);
      });
    } else {
      saveMatch(sessionId, matchId, matchData);
    }
  }
}

function showGameModes() {
  mainContent.innerHTML = `
    <h2>Game Modes</h2>
    <button class="button" onclick="showModal('addGameMode')">Add Game Mode</button>
    <div id="gameModeList"></div>
  `;
  loadGameModes();
}

function loadGameModes() {
  const gameModeList = document.getElementById('gameModeList');
  gameModeList.innerHTML = 'Loading game modes...';
  
  onValue(ref(database, 'gameModes'), (snapshot) => {
    const gameModes = [];
    snapshot.forEach((childSnapshot) => {
      const gameMode = childSnapshot.val();
      gameMode.id = childSnapshot.key;
      gameModes.push(gameMode);
    });

    gameModes.sort((a, b) => a.name.localeCompare(b.name));

    gameModeList.innerHTML = '';
    gameModes.forEach((gameMode) => {
      gameModeList.innerHTML += `
        <div class="table-row">
          <div class="name">${gameMode.name} (${gameMode.type})</div>
          <div class="actions">
            <button class="button" onclick="showModal('editGameMode', '${gameMode.id}')">Edit</button>
            <button class="button" onclick="deleteGameMode('${gameMode.id}')">Delete</button>
          </div>
        </div>
      `;
    });
    if (gameModeList.innerHTML === '') {
      gameModeList.innerHTML = 'No game modes found. Add some!';
    }
  });
}

function addOrUpdateGameMode(e) {
  e.preventDefault();
  const form = e.target;
  const gameModeId = form.dataset.id;
  const gameModeData = {
    name: form.name.value,
    type: form.type.value
  };

  const operation = gameModeId
    ? update(ref(database, `gameModes/${gameModeId}`), gameModeData)
    : push(ref(database, 'gameModes'), gameModeData);

  operation
    .then(() => {
      loadGameModes();
      modal.style.display = "none";
    })
    .catch(error => {
      console.error("Error adding/updating game mode: ", error);
      alert('Error adding/updating game mode. Please try again.');
    });
}

window.deleteGameMode = function(id) {
  if (confirm('Are you sure you want to delete this game mode?')) {
    remove(ref(database, `gameModes/${id}`))
      .then(() => loadGameModes())
      .catch(error => {
        console.error("Error deleting game mode: ", error);
        alert('Error deleting game mode. Please try again.');
      });
  }
}
function showMaps() {
  mainContent.innerHTML = `
    <h2>Maps</h2>
    <button class="button" onclick="showModal('addMap')">Add Map</button>
    <div id="mapList"></div>
  `;
  loadMaps();
}

function loadMaps() {
  const mapList = document.getElementById('mapList');
  mapList.innerHTML = 'Loading maps...';
  
  onValue(ref(database, 'maps'), (snapshot) => {
    const maps = [];
    snapshot.forEach((childSnapshot) => {
      const map = childSnapshot.val();
      map.id = childSnapshot.key;
      maps.push(map);
    });

    maps.sort((a, b) => a.name.localeCompare(b.name));

    mapList.innerHTML = '';
    maps.forEach((map) => {
      mapList.innerHTML += `
        <div class="table-row">
          <div class="name">${map.name}</div>
          <div class="actions">
            <button class="button" onclick="showModal('editMap', '${map.id}')">Edit</button>
            <button class="button" onclick="deleteMap('${map.id}')">Delete</button>
          </div>
        </div>
      `;
    });
    if (mapList.innerHTML === '') {
      mapList.innerHTML = 'No maps found. Add some!';
    }
  });
}

function addOrUpdateMap(e) {
  e.preventDefault();
  const form = e.target;
  const mapId = form.dataset.id;
  const mapData = {
    name: form.name.value,
  };

  const operation = mapId
    ? update(ref(database, `maps/${mapId}`), mapData)
    : push(ref(database, 'maps'), mapData);

  operation
    .then(() => {
      loadMaps();
      modal.style.display = "none";
    })
    .catch(error => {
      console.error("Error adding/updating map: ", error);
      alert('Error adding/updating map. Please try again.');
    });
}

window.deleteMap = function(id) {
  if (confirm('Are you sure you want to delete this map?')) {
    remove(ref(database, `maps/${id}`))
      .then(() => loadMaps())
      .catch(error => {
        console.error("Error deleting map: ", error);
        alert('Error deleting map. Please try again.');
      });
  }
}
function showHighlights() {
  mainContent.innerHTML = `
    <h2>Highlights</h2>
    <div id="highlightsList"></div>
  `;
  loadHighlights();
}

function loadHighlights() {
  const highlightsList = document.getElementById('highlightsList');
  highlightsList.innerHTML = 'Loading highlights...';
  
  get(ref(database, 'gameSessions')).then((snapshot) => {
    const highlights = [];
    snapshot.forEach((sessionSnapshot) => {
      const session = sessionSnapshot.val();
      if (session.matches) {
        Object.entries(session.matches).forEach(([matchId, match]) => {
          if (match.highlightURL) {
            highlights.push({
              date: session.date,
              gameMode: match.gameMode,
              map: match.map,
              placement: match.placement,
              totalKills: match.totalKills,
              kills: match.kills,
              highlightURL: match.highlightURL
            });
          }
        });
      }
    });

    highlights.sort((a, b) => new Date(b.date) - new Date(a.date));

    let highlightsHtml = `
      <table class="highlights-table">
        <tr>
          <th>Date</th>
          <th>Game Mode</th>
          <th>Map</th>
          <th>Placement</th>
          <th>Total Kills</th>
          <th>Kills by Player</th>
          <th>Action</th>
        </tr>
    `;

    highlights.forEach((highlight, index) => {
      if (index < 20) {
        highlightsHtml += `
          <tr>
            <td>${formatDate(highlight.date)}</td>
            <td>${highlight.gameMode}</td>
            <td>${highlight.map}</td>
            <td>${highlight.placement}</td>
            <td>${highlight.totalKills}</td>
            <td>
              STARMAN: ${highlight.kills.STARMAN || 0}<br>
              RSKILLA: ${highlight.kills.RSKILLA || 0}<br>
              SWFTSWORD: ${highlight.kills.SWFTSWORD || 0}<br>
              VAIDED: ${highlight.kills.VAIDED || 0}<br>
              MOWGLI: ${highlight.kills.MOWGLI || 0}
            </td>
            <td><button class="button" onclick="viewHighlight('${highlight.highlightURL}')">Watch Video</button></td>
          </tr>
        `;
      }
    });

    highlightsHtml += '</table>';
    highlightsList.innerHTML = highlightsHtml;

    if (highlights.length === 0) {
      highlightsList.innerHTML = 'No highlights found.';
    }
  });
}
function showStats() {
  mainContent.innerHTML = `
    <h2>Team Statistics</h2>
    <p>* Note: Total Kills and Average Kills are based solely on Battle Royale style games.</p>
    <div id="statsTable"></div>
  `;
  loadStats();
}

function loadStats() {
  const statsTable = document.getElementById('statsTable');
  statsTable.innerHTML = 'Loading statistics...';

  get(ref(database, 'gameSessions')).then((snapshot) => {
    const sessions = [];
    snapshot.forEach((childSnapshot) => {
      const session = childSnapshot.val();
      session.id = childSnapshot.key;
      sessions.push(session);
    });

    sessions.sort((a, b) => new Date(b.date) - new Date(a.date));

    let tableHTML = `
      <table class="stats-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Games Played</th>
            <th>Total Kills</th>
            <th>Average Kills</th>
            <th>Wins</th>
            <th>2nd Place</th>
            <th>3rd Place</th>
            <th>4th Place</th>
            <th>5th Place</th>
            <th>6th+ Place</th>
          </tr>
        </thead>
        <tbody>
    `;

    let totalStats = {
      gamesPlayed: 0,
      totalKills: 0,
      wins: 0,
      secondPlace: 0,
      thirdPlace: 0,
      fourthPlace: 0,
      fifthPlace: 0,
      sixthPlacePlus: 0
    };

    sessions.forEach((session) => {
      const stats = calculateSessionStats(session.matches || {});

      // Add to totals
      for (let key in totalStats) {
        totalStats[key] += stats[key];
      }

      tableHTML += `
        <tr>
          <td>${formatDate(session.date)}</td>
          <td>${stats.gamesPlayed}</td>
          <td>${stats.totalKills}</td>
          <td>${stats.averageKills}</td>
          <td>${stats.wins} (${((stats.wins / stats.gamesPlayed) * 100).toFixed(1)}%)</td>
          <td>${stats.secondPlace} (${((stats.secondPlace / stats.gamesPlayed) * 100).toFixed(1)}%)</td>
          <td>${stats.thirdPlace} (${((stats.thirdPlace / stats.gamesPlayed) * 100).toFixed(1)}%)</td>
          <td>${stats.fourthPlace} (${((stats.fourthPlace / stats.gamesPlayed) * 100).toFixed(1)}%)</td>
          <td>${stats.fifthPlace} (${((stats.fifthPlace / stats.gamesPlayed) * 100).toFixed(1)}%)</td>
          <td>${stats.sixthPlacePlus} (${((stats.sixthPlacePlus / stats.gamesPlayed) * 100).toFixed(1)}%)</td>
        </tr>
      `;
    });

    // Add total row
    if (totalStats.gamesPlayed > 0) {
      const totalAverageKills = (totalStats.totalKills / totalStats.gamesPlayed).toFixed(2);
      tableHTML += `
        <tfoot>
          <tr>
            <td><strong>Total</strong></td>
            <td><strong>${totalStats.gamesPlayed}</strong></td>
            <td><strong>${totalStats.totalKills}</strong></td>
            <td><strong>${totalAverageKills}</strong></td>
            <td><strong>${totalStats.wins} (${((totalStats.wins / totalStats.gamesPlayed) * 100).toFixed(1)}%)</strong></td>
            <td><strong>${totalStats.secondPlace} (${((totalStats.secondPlace / totalStats.gamesPlayed) * 100).toFixed(1)}%)</strong></td>
            <td><strong>${totalStats.thirdPlace} (${((totalStats.thirdPlace / totalStats.gamesPlayed) * 100).toFixed(1)}%)</strong></td>
            <td><strong>${totalStats.fourthPlace} (${((totalStats.fourthPlace / totalStats.gamesPlayed) * 100).toFixed(1)}%)</strong></td>
            <td><strong>${totalStats.fifthPlace} (${((totalStats.fifthPlace / totalStats.gamesPlayed) * 100).toFixed(1)}%)</strong></td>
            <td><strong>${totalStats.sixthPlacePlus} (${((totalStats.sixthPlacePlus / totalStats.gamesPlayed) * 100).toFixed(1)}%)</strong></td>
          </tr>
        </tfoot>
      `;
    }

    tableHTML += '</tbody></table>';
    statsTable.innerHTML = tableHTML;

    if (sessions.length === 0) {
      statsTable.innerHTML = 'No game sessions found. Add some games first!';
    }
  });
}

function calculateSessionStats(matches) {
  const stats = {
    gamesPlayed: Object.keys(matches).length,
    wins: 0,
    secondPlace: 0,
    thirdPlace: 0,
    fourthPlace: 0,
    fifthPlace: 0,
    sixthPlacePlus: 0,
    totalKills: 0,
    brGamesPlayed: 0
  };

  Object.values(matches).forEach(match => {
    switch(match.placement) {
      case 1: stats.wins++; break;
      case 2: stats.secondPlace++; break;
      case 3: stats.thirdPlace++; break;
      case 4: stats.fourthPlace++; break;
      case 5: stats.fifthPlace++; break;
      default: stats.sixthPlacePlus++;
    }

    stats.totalKills += match.totalKills || 0;
    if (match.gameMode === 'Battle Royale') {
      stats.brGamesPlayed++;
    }
  });

  stats.averageKills = stats.gamesPlayed > 0 ? (stats.totalKills / stats.gamesPlayed).toFixed(2) : 0;

  return stats;
}
window.showSessionMatches = function(sessionId) {
  showGameSessions();
  setTimeout(() => {
    const sessionElement = document.getElementById(`matches-${sessionId}`);
    if (sessionElement) {
      sessionElement.style.display = 'block';
      sessionElement.scrollIntoView({ behavior: 'smooth' });
    }
  }, 500);
}

// Helper function to load game modes and maps for the match form
function loadGameModesAndMaps() {
  const gameModeSelect = document.getElementById('gameMode');
  const mapSelect = document.getElementById('map');

  get(ref(database, 'gameModes')).then((snapshot) => {
    gameModeSelect.innerHTML = '<option value="">Select Game Mode</option>';
    snapshot.forEach((childSnapshot) => {
      const gameMode = childSnapshot.val();
      gameModeSelect.innerHTML += `<option value="${gameMode.name}">${gameMode.name}</option>`;
    });
  });

  get(ref(database, 'maps')).then((snapshot) => {
    mapSelect.innerHTML = '<option value="">Select Map</option>';
    snapshot.forEach((childSnapshot) => {
      const map = childSnapshot.val();
      mapSelect.innerHTML += `<option value="${map.name}">${map.name}</option>`;
    });
  });
}

// Initialize the app
showStats();

// Check connection
const connectedRef = ref(database, ".info/connected");
onValue(connectedRef, (snap) => {
    if (snap.val() === true) {
        console.log("Connected to Firebase");
    } else {
        console.log("Not connected to Firebase");
    }
});

// Make showModal function globally accessible
window.showModal = function(action, id = null, subId = null) {
  modalContent.innerHTML = '';  // Clear previous content

  // Helper function to generate input fields
  function generateInputField(label, id, type = 'text', value = '', required = false, placeholder = '') {
    return `
      <div class="form-group">
        <label for="${id}">${label}</label>
        <input type="${type}" id="${id}" value="${value}" placeholder="${placeholder}" ${required ? 'required' : ''}>
      </div>
    `;
  }

  switch(action) {
    case 'addTeamMember':
      modalContent.innerHTML = `
        <h3>Add Team Member</h3>
        <form id="teamMemberForm" class="vertical-form">
          ${generateInputField('Name', 'name', 'text', '', true, 'Name')}
          ${generateInputField('Gamertag', 'gamertag', 'text', '', true, 'Gamertag')}
          ${generateInputField('State', 'state', 'text', '', true, 'State')}
          ${generateInputField('Birthdate', 'birthdate', 'date', '', true)}
          ${generateInputField('Favorite Snack', 'favoriteSnack', 'text', '', true, 'Favorite Snack')}
          ${generateInputField('Photo', 'photo', 'file', '', true)}
          <button type="submit" class="button">Add Team Member</button>
        </form>
      `;
      document.getElementById('teamMemberForm').addEventListener('submit', addOrUpdateTeamMember);
      break;

    case 'editTeamMember':
      get(ref(database, `teamMembers/${id}`)).then((snapshot) => {
        if (snapshot.exists()) {
          const member = snapshot.val();
          modalContent.innerHTML = `
            <h3>Edit Team Member</h3>
            <form id="teamMemberForm" data-id="${id}" class="vertical-form">
              ${generateInputField('Name', 'name', 'text', member.name, true)}
              ${generateInputField('Gamertag', 'gamertag', 'text', member.gamertag, true)}
              ${generateInputField('State', 'state', 'text', member.state, true)}
              ${generateInputField('Birthdate', 'birthdate', 'date', member.birthdate, true)}
              ${generateInputField('Favorite Snack', 'favoriteSnack', 'text', member.favoriteSnack, true)}
              ${generateInputField('Photo', 'photo', 'file')}
              <button type="submit" class="button">Update Team Member</button>
            </form>
          `;
          document.getElementById('teamMemberForm').addEventListener('submit', addOrUpdateTeamMember);
        }
      });
      break;

    case 'addGameSession':
      modalContent.innerHTML = `
        <h3>Add Game Session</h3>
        <form id="gameSessionForm" class="vertical-form">
          ${generateInputField('Date', 'date', 'date', '', true)}
          <button type="submit" class="button">Add Game Session</button>
        </form>
      `;
      document.getElementById('gameSessionForm').addEventListener('submit', addOrUpdateGameSession);
      break;

    case 'editGameSession':
      get(ref(database, `gameSessions/${id}`)).then((snapshot) => {
        if (snapshot.exists()) {
          const session = snapshot.val();
          modalContent.innerHTML = `
            <h3>Edit Game Session</h3>
            <form id="gameSessionForm" data-id="${id}" class="vertical-form">
              ${generateInputField('Date', 'date', 'date', session.date, true)}
              <button type="submit" class="button">Update Game Session</button>
            </form>
          `;
          document.getElementById('gameSessionForm').addEventListener('submit', addOrUpdateGameSession);
        }
      });
      break;

    case 'addMatch':
    case 'editMatch':
      const isEdit = action === 'editMatch';
      if (isEdit) {
        get(ref(database, `gameSessions/${id}/matches/${subId}`)).then((snapshot) => {
          if (snapshot.exists()) {
            const match = snapshot.val();
            populateMatchForm(match);
          }
        });
      } else {
        populateMatchForm({});
      }
      
      function populateMatchForm(match) {
        modalContent.innerHTML = `
          <h3>${isEdit ? 'Edit' : 'Add'} Match</h3>
          <form id="matchForm" data-session-id="${id}" ${isEdit ? `data-match-id="${subId}"` : ''} class="vertical-form">
            ${generateInputField('Game Mode', 'gameMode', 'select', match.gameMode || '', true)}
            ${generateInputField('Map', 'map', 'select', match.map || '', true)}
            ${generateInputField('Placement', 'placement', 'number', match.placement || '', true)}
            ${generateInputField('Total Kills', 'totalKills', 'number', match.totalKills || '')}
            ${generateInputField('Kills (STARMAN)', 'killsSTARMAN', 'number', match.kills?.STARMAN || '')}
            ${generateInputField('Kills (RSKILLA)', 'killsRSKILLA', 'number', match.kills?.RSKILLA || '')}
            ${generateInputField('Kills (SWFTSWORD)', 'killsSWFTSWORD', 'number', match.kills?.SWFTSWORD || '')}
            ${generateInputField('Kills (VAIDED)', 'killsVAIDED', 'number', match.kills?.VAIDED || '')}
            ${generateInputField('Kills (MOWGLI)', 'killsMOWGLI', 'number', match.kills?.MOWGLI || '')}
            ${generateInputField('Highlight Video', 'highlightVideo', 'file')}
            ${match.highlightURL ? '<p>A highlight video is already uploaded. Uploading a new one will replace it.</p>' : ''}
            <button type="submit" class="button">${isEdit ? 'Update' : 'Add'} Match</button>
          </form>
        `;
        loadGameModesAndMaps();
        document.getElementById('matchForm').addEventListener('submit', addMatch);
      }
      break;

    case 'addMap':
    case 'editMap':
      const mapIsEdit = action === 'editMap';
      if (mapIsEdit) {
        get(ref(database, `maps/${id}`)).then((snapshot) => {
          if (snapshot.exists()) {
            const map = snapshot.val();
            populateMapForm(map);
          }
        });
      } else {
        populateMapForm({});
      }
      
      function populateMapForm(map) {
        modalContent.innerHTML = `
          <h3>${mapIsEdit ? 'Edit' : 'Add'} Map</h3>
          <form id="mapForm" data-id="${id}" class="vertical-form">
            ${generateInputField('Map Name', 'name', 'text', map.name || '', true)}
            <button type="submit" class="button">${mapIsEdit ? 'Update' : 'Add'} Map</button>
          </form>
        `;
        document.getElementById('mapForm').addEventListener('submit', addOrUpdateMap);
      }
      break;

    case 'addGameMode':
    case 'editGameMode':
      const gameModeIsEdit = action === 'editGameMode';
      if (gameModeIsEdit) {
        get(ref(database, `gameModes/${id}`)).then((snapshot) => {
          if (snapshot.exists()) {
            const gameMode = snapshot.val();
            populateGameModeForm(gameMode);
          }
        });
      } else {
        populateGameModeForm({});
      }
      
      function populateGameModeForm(gameMode) {
        modalContent.innerHTML = `
          <h3>${gameModeIsEdit ? 'Edit' : 'Add'} Game Mode</h3>
          <form id="gameModeForm" data-id="${id}" class="vertical-form">
            ${generateInputField('Game Mode Name', 'name', 'text', gameMode.name || '', true)}
            <div class="form-group">
              <label for="type">Type</label>
              <select id="type" required>
                <option value="">Select Type</option>
                <option value="Battle Royale" ${gameMode.type === 'Battle Royale' ? 'selected' : ''}>Battle Royale</option>
                <option value="Multiplayer" ${gameMode.type === 'Multiplayer' ? 'selected' : ''}>Multiplayer</option>
              </select>
            </div>
            <button type="submit" class="button">${gameModeIsEdit ? 'Update' : 'Add'} Game Mode</button>
          </form>
        `;
        document.getElementById('gameModeForm').addEventListener('submit', addOrUpdateGameMode);
      }
      break;
  }

  modal.style.display = "block";
}
