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
document.getElementById('helpNav').addEventListener('click', () => showHelp());
document.getElementById('aboutNav').addEventListener('click', () => showAbout());

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

function showHelp() {
  mainContent.innerHTML = `
    <h2>Help</h2>
    <p>Instructions on how to use the app:</p>
    <ul>
        <li><strong>Team Statistics:</strong> View the overall performance of the team including total kills, placements, and wins.</li>
        <li><strong>Game Sessions:</strong> Manage and review past game sessions including adding new matches.</li>
        <li><strong>Highlights:</strong> Watch recorded highlights of past matches.</li>
        <li><strong>Maps:</strong> Add, edit, and delete maps used in the game sessions.</li>
        <li><strong>Game Modes:</strong> Manage the game modes available for the sessions.</li>
        <li><strong>Team Members:</strong> View, add, and manage team member profiles and their statistics.</li>
    </ul>
  `;
}

function showAbout() {
  mainContent.innerHTML = `
    <h2>About Us</h2>
    <img src="group-logo.png" alt="Team Logo" style="max-width: 100%;">
    <hr>
    <video controls style="width: 100%; margin-top: 20px;">
      <source src="mongooseIntro.mp4" type="video/mp4">
      Your browser does not support the video tag.
    </video>
    <p>Placeholder text. You can add team information here later.</p>
  `;
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
            teamList.innerHTML += `
                <div class="card">
                    <img src="${member.photoURL}" alt="${member.name}" class="team-photo">
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

function calculatePRValues() {
  get(ref(database, 'gameModes')).then((gameModeSnapshot) => {
    const gameModes = {};
    gameModeSnapshot.forEach(child => {
      gameModes[child.val().name] = child.val().type;
    });

    get(ref(database, 'gameSessions')).then((sessionsSnapshot) => {
      const prValues = {};

      sessionsSnapshot.forEach((sessionSnapshot) => {
        const session = sessionSnapshot.val();
        if (session.matches) {
          Object.values(session.matches).forEach((match) => {
            const gameType = gameModes[match.gameMode] === 'Battle Royale' ? 'brPR' : 'mpPR';
            Object.entries(match.kills || {}).forEach(([player, kills]) => {
              if (!prValues[player]) {
                prValues[player] = { brPR: 0, mpPR: 0, brPRDate: '', mpPRDate: '' };
              }
              if (kills > prValues[player][gameType]) {
                prValues[player][gameType] = kills;
                prValues[player][`${gameType}Date`] = session.date;
              }
            });
          });
        }
      });

      // Update PR values for each team member
      get(ref(database, 'teamMembers')).then((membersSnapshot) => {
        membersSnapshot.forEach((memberSnapshot) => {
          const memberId = memberSnapshot.key;
          const member = memberSnapshot.val();
          const memberPR = prValues[member.gamertag] || { brPR: 0, mpPR: 0, brPRDate: '', mpPRDate: '' };
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
                    <h3><a href="#" onclick="showSessionMatches('${session.id}')">${formatDate(session.date)}</a></h3>
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
                Object.entries(session.matches).sort(([, a], [, b]) => b.timePlayed - a.timePlayed).forEach(([matchId, match]) => {
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
    name: form.name.value
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

  onValue(ref(database, 'gameSessions'), (snapshot) => {
    highlightsList.innerHTML = '';
    snapshot.forEach((childSnapshot) => {
      const session = childSnapshot.val();
      if (session.matches) {
        Object.entries(session.matches).forEach(([matchId, match]) => {
          if (match.highlightURL) {
            highlightsList.innerHTML += `
              <div class="card">
                <h3>${formatDate(session.date)}</h3>
                <p><strong>Game Mode:</strong> ${match.gameMode}</p>
                <p><strong>Map:</strong> ${match.map}</p>
                <video controls>
                  <source src="${match.highlightURL}" type="video/mp4">
                  Your browser does not support the video tag.
                </video>
                <div class="button-group">
                  <button class="button" onclick="viewHighlight('${match.highlightURL}')">View Full Highlight</button>
                </div>
              </div>
            `;
          }
        });
      }
    });

    if (highlightsList.innerHTML === '') {
      highlightsList.innerHTML = 'No highlights found.';
    }
  });
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const options = { weekday: 'long', day: '2-digit', month: '2-digit', year: '2-digit' };
    return date.toLocaleDateString(undefined, options);
}

function showModal(action, id = null, subId = null) {
  modalContent.innerHTML = '';
  switch(action) {
    case 'addMatch':
      modalContent.innerHTML = `
        <h3>Add Match</h3>
        <form id="matchForm" data-session-id="${id}" class="vertical-form">
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
          <div class="form-group">
            <label for="placement">Placement</label>
            <input type="range" id="placement" class="slider" min="1" max="10" step="1" list="tickmarks" required>
            <datalist id="tickmarks">
              <option value="1" label="1st">
              <option value="2" label="2nd">
              <option value="3" label="3rd">
              <option value="4" label="4th">
              <option value="5" label="5th">
              <option value="6" label="6th">
              <option value="7" label="7th">
              <option value="8" label="8th">
              <option value="9" label="9th">
              <option value="10" label="10th+">
            </datalist>
          </div>
          <div class="form-group">
            <label for="totalKills">Total Kills</label>
            <input type="range" id="totalKills" class="slider" min="0" max="30" step="1">
          </div>
          <div class="form-group">
            <label for="killsSTARMAN">Kills (STARMAN)</label>
            <input type="range" id="killsSTARMAN" class="slider" min="0" max="30" step="1">
          </div>
          <div class="form-group">
            <label for="killsRSKILLA">Kills (RSKILLA)</label>
            <input type="range" id="killsRSKILLA" class="slider" min="0" max="30" step="1">
          </div>
          <div class="form-group">
            <label for="killsSWFTSWORD">Kills (SWFTSWORD)</label>
            <input type="range" id="killsSWFTSWORD" class="slider" min="0" max="30" step="1">
          </div>
          <div class="form-group">
            <label for="killsVAIDED">Kills (VAIDED)</label>
            <input type="range" id="killsVAIDED" class="slider" min="0" max="30" step="1">
          </div>
          <div class="form-group">
            <label for="killsMOWGLI">Kills (MOWGLI)</label>
            <input type="range" id="killsMOWGLI" class="slider" min="0" max="30" step="1">
          </div>
          <div class="form-group">
            <label for="highlightVideo">Highlight Video</label>
            <input type="file" id="highlightVideo" accept="video/*">
          </div>
          <button type="submit" class="button">Add Match</button>
        </form>
      `;
      loadGameModesAndMaps();
      document.getElementById('matchForm').addEventListener('submit', addMatch);
      break;
      
case 'editMatch':
  get(ref(database, `gameSessions/${id}/matches/${subId}`)).then((snapshot) => {
    if (snapshot.exists()) {
      const match = snapshot.val();
      modalContent.innerHTML = `
        <h3>Edit Match</h3>
        <form id="matchForm" data-session-id="${id}" data-match-id="${subId}" class="vertical-form">
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
          <div class="form-group">
            <label for="placement">Placement</label>
            <input type="range" id="placement" class="slider" min="1" max="10" step="1" value="${match.placement}" list="tickmarks" required>
            <datalist id="tickmarks">
              <option value="1" label="1st">
              <option value="2" label="2nd">
              <option value="3" label="3rd">
              <option value="4" label="4th">
              <option value="5" label="5th">
              <option value="6" label="6th">
              <option value="7" label="7th">
              <option value="8" label="8th">
              <option value="9" label="9th">
              <option value="10" label="10th+">
            </datalist>
          </div>
          <div class="form-group">
            <label for="totalKills">Total Kills</label>
            <input type="range" id="totalKills" class="slider" min="0" max="30" step="1" value="${match.totalKills || ''}">
          </div>
          <div class="form-group">
            <label for="killsSTARMAN">Kills (STARMAN)</label>
            <input type="range" id="killsSTARMAN" class="slider" min="0" max="30" step="1" value="${match.kills?.STARMAN || ''}">
          </div>
          <div class="form-group">
            <label for="killsRSKILLA">Kills (RSKILLA)</label>
            <input type="range" id="killsRSKILLA" class="slider" min="0" max="30" step="1" value="${match.kills?.RSKILLA || ''}">
          </div>
          <div class="form-group">
            <label for="killsSWFTSWORD">Kills (SWFTSWORD)</label>
            <input type="range" id="killsSWFTSWORD" class="slider" min="0" max="30" step="1" value="${match.kills?.SWFTSWORD || ''}">
          </div>
          <div class="form-group">
            <label for="killsVAIDED">Kills (VAIDED)</label>
            <input type="range" id="killsVAIDED" class="slider" min="0" max="30" step="1" value="${match.kills?.VAIDED || ''}">
          </div>
          <div class="form-group">
            <label for="killsMOWGLI">Kills (MOWGLI)</label>
            <input type="range" id="killsMOWGLI" class="slider" min="0" max="30" step="1" value="${match.kills?.MOWGLI || ''}">
          </div>
          <div class="form-group">
            <label for="highlightVideo">Highlight Video</label>
            <input type="file" id="highlightVideo" accept="video/*">
          </div>
          ${match.highlightURL ? '<p>A highlight video is already uploaded. Uploading a new one will replace it.</p>' : ''}
          <button type="submit" class="button">Update Match</button>
        </form>
      `;
      loadGameModesAndMaps();
      document.getElementById('matchForm').addEventListener('submit', addMatch);
      
      // Set the game mode and map after options are loaded
      setTimeout(() => {
        document.getElementById('gameMode').value = match.gameMode;
        document.getElementById('map').value = match.map;
      }, 100);
    }
  });
  break;
      
    case 'addMap':
      modalContent.innerHTML = `
        <h3>Add Map</h3>
        <form id="mapForm">
          <input type="text" id="name" placeholder="Map Name" required>
          <button type="submit">Add Map</button>
        </form>
      `;
      document.getElementById('mapForm').addEventListener('submit', addOrUpdateMap);
      break;
    case 'editMap':
      get(ref(database, `maps/${id}`)).then((snapshot) => {
        if (snapshot.exists()) {
          const map = snapshot.val();
          modalContent.innerHTML = `
            <h3>Edit Map</h3>
            <form id="mapForm" data-id="${id}">
              <input type="text" id="name" value="${map.name}" required>
              <button type="submit">Update Map</button>
            </form>
          `;
          document.getElementById('mapForm').addEventListener('submit', addOrUpdateMap);
        }
      });
      break;
    case 'addGameMode':
      modalContent.innerHTML = `
        <h3>Add Game Mode</h3>
        <form id="gameModeForm">
          <input type="text" id="name" placeholder="Game Mode Name" required>
          <select id="type" required>
            <option value="">Select Type</option>
            <option value="Battle Royale">Battle Royale</option>
            <option value="Multiplayer">Multiplayer</option>
          </select>
          <button type="submit">Add Game Mode</button>
        </form>
      `;
      document.getElementById('gameModeForm').addEventListener('submit', addOrUpdateGameMode);
      break;
    case 'editGameMode':
      get(ref(database, `gameModes/${id}`)).then((snapshot) => {
        if (snapshot.exists()) {
          const gameMode = snapshot.val();
          modalContent.innerHTML = `
            <h3>Edit Game Mode</h3>
            <form id="gameModeForm" data-id="${id}">
              <input type="text" id="name" value="${gameMode.name}" required>
              <select id="type" required>
                <option value="">Select Type</option>
                <option value="Battle Royale" ${gameMode.type === 'Battle Royale' ? 'selected' : ''}>Battle Royale</option>
                <option value="Multiplayer" ${gameMode.type === 'Multiplayer' ? 'selected' : ''}>Multiplayer</option>
              </select>
              <button type="submit">Update Game Mode</button>
            </form>
          `;
          document.getElementById('gameModeForm').addEventListener('submit', addOrUpdateGameMode);
        }
      });
      break;
  }
  modal.style.display = "block";
}

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

function formatDate(dateString) {
    const date = new Date(dateString);
    const options = { weekday: 'long', day: '2-digit', month: '2-digit', year: '2-digit' };
    return date.toLocaleDateString(undefined, options);
}
