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
document.getElementById('teamNav').addEventListener('click', () => showSection('team'));
document.getElementById('modesNav').addEventListener('click', () => showSection('modes'));
document.getElementById('mapsNav').addEventListener('click', () => showSection('maps'));
document.getElementById('sessionsNav').addEventListener('click', () => showSection('sessions'));
document.getElementById('statsNav').addEventListener('click', () => showSection('stats'));

function showSection(section) {
  switch(section) {
    case 'team':
      showTeamMembers();
      break;
    case 'modes':
      showGameModes();
      break;
    case 'maps':
      showMaps();
      break;
    case 'sessions':
      showGameSessions();
      break;
    case 'stats':
      showStats();
      break;
  }
}

function showModal(action, id = null) {
  modalContent.innerHTML = '';
  switch(action) {
    case 'addTeamMember':
      modalContent.innerHTML = `
        <h3>Add Team Member</h3>
        <form id="teamMemberForm">
          <input type="text" id="name" placeholder="Name" required>
          <input type="text" id="gamertag" placeholder="Gamertag" required>
          <input type="text" id="state" placeholder="State" required>
          <input type="number" id="age" placeholder="Age" required>
          <input type="text" id="favoriteSnack" placeholder="Favorite Snack" required>
          <input type="file" id="photo" accept="image/*" required>
          <button type="submit">Add Team Member</button>
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
            <form id="teamMemberForm" data-id="${id}">
              <input type="text" id="name" value="${member.name}" required>
              <input type="text" id="gamertag" value="${member.gamertag}" required>
              <input type="text" id="state" value="${member.state}" required>
              <input type="number" id="age" value="${member.age}" required>
              <input type="text" id="favoriteSnack" value="${member.favoriteSnack}" required>
              <input type="file" id="photo" accept="image/*">
              <button type="submit">Update Team Member</button>
            </form>
          `;
          document.getElementById('teamMemberForm').addEventListener('submit', addOrUpdateTeamMember);
        }
      });
      break;
    case 'addGameSession':
      modalContent.innerHTML = `
        <h3>Add Game Session</h3>
        <form id="gameSessionForm">
          <input type="date" id="date" placeholder="Date" required>
          <button type="submit">Add Game Session</button>
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
            <form id="gameSessionForm" data-id="${id}">
              <input type="date" id="date" value="${session.date}" required>
              <button type="submit">Update Game Session</button>
            </form>
          `;
          document.getElementById('gameSessionForm').addEventListener('submit', addOrUpdateGameSession);
        }
      });
      break;
    case 'addMatch':
      modalContent.innerHTML = `
        <h3>Add Match</h3>
        <form id="matchForm" data-session-id="${id}">
          <select id="gameMode" required>
            <option value="">Select Game Mode</option>
          </select>
          <select id="map" required>
            <option value="">Select Map</option>
          </select>
          <input type="number" id="placement" placeholder="Placement" required>
          <input type="number" id="kills-player1" placeholder="Kills Player 1">
          <input type="number" id="kills-player2" placeholder="Kills Player 2">
          <input type="number" id="kills-player3" placeholder="Kills Player 3">
          <input type="number" id="kills-player4" placeholder="Kills Player 4">
          <input type="number" id="kills-player5" placeholder="Kills Player 5">
          <button type="submit">Add Match</button>
        </form>
      `;
      loadGameModesAndMaps();
      document.getElementById('matchForm').addEventListener('submit', addMatch);
      break;
    case 'viewMatches':
      viewMatches(id);
      break;
  }
  modal.style.display = "block";
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

function addMatch(e) {
  e.preventDefault();
  const form = e.target;
  const sessionId = form.dataset.sessionId;
  const matchData = {
    gameMode: form.gameMode.value,
    map: form.map.value,
    placement: parseInt(form.placement.value),
    killsPlayer1: form['kills-player1'].value ? parseInt(form['kills-player1'].value) : null,
    killsPlayer2: form['kills-player2'].value ? parseInt(form['kills-player2'].value) : null,
    killsPlayer3: form['kills-player3'].value ? parseInt(form['kills-player3'].value) : null,
    killsPlayer4: form['kills-player4'].value ? parseInt(form['kills-player4'].value) : null,
    killsPlayer5: form['kills-player5'].value ? parseInt(form['kills-player5'].value) : null,
  };

  const matchRef = push(ref(database, `gameSessions/${sessionId}/matches`), matchData);

  matchRef
    .then(() => {
      loadMatches(sessionId);
      modal.style.display = "none";
    })
    .catch(error => {
      console.error("Error adding match: ", error);
      alert('Error adding match. Please try again.');
    });
}

// Team Members
function showTeamMembers() {
  mainContent.innerHTML = `
    <h2>Team Members</h2>
    <button onclick="showModal('addTeamMember')">Add Team Member</button>
    <div id="teamList"></div>
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
      teamList.innerHTML += `
        <div class="card">
          <img src="${member.photoURL}" alt="${member.name}" class="team-photo">
          <h3>${member.name} (${member.gamertag})</h3>
          <p>State: ${member.state}</p>
          <p>Age: ${member.age}</p>
          <p>Favorite Snack: ${member.favoriteSnack}</p>
          <p>Games Played: ${member.gamesPlayed || 0}</p>
          <p>Total Kills: ${member.totalKills || 0}</p>
          <button onclick="showModal('editTeamMember', '${memberId}')">Edit</button>
          <button onclick="deleteTeamMember('${memberId}')">Delete</button>
        </div>
      `;
    });
    if (teamList.innerHTML === '') {
      teamList.innerHTML = 'No team members found. Add some!';
    }
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
    age: parseInt(form.age.value),
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

function formatDate(dateString) {
  const date = new Date(dateString);
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  return date.toLocaleDateString(undefined, options);
}

// Game Sessions
function loadGameSessions() {
  const sessionList = document.getElementById('sessionList');
  sessionList.innerHTML = 'Loading game sessions...';
  
  onValue(ref(database, 'gameSessions'), (snapshot) => {
    const sessions = [];
    snapshot.forEach((childSnapshot) => {
      const session = childSnapshot.val();
      session.id = childSnapshot.key; // Save the session ID
      sessions.push(session);
    });

    // Sort sessions by date in descending order
    sessions.sort((a, b) => new Date(b.date) - new Date(a.date));

    sessionList.innerHTML = '';
    sessions.forEach((session) => {
      sessionList.innerHTML += `
        <div class="card">
          <div class="session-header">
            <h3>${formatDate(session.date)}</h3>
            <div class="session-actions">
              <i class="fas fa-pencil-alt" onclick="showModal('editGameSession', '${session.id}')"></i>
              <i class="fas fa-trash" onclick="deleteGameSession('${session.id}')"></i>
            </div>
          </div>
          <p>Number of matches: ${session.matches ? Object.keys(session.matches).length : 0}</p>
          <div class="session-buttons">
            <button onclick="toggleMatches('${session.id}')">View Matches</button>
            <button onclick="showModal('addMatch', '${session.id}')">Add Match</button>
          </div>
          <div id="matches-${session.id}" class="matches-container"></div>
        </div>
      `;
    });
    
    if (sessionList.innerHTML === '') {
      sessionList.innerHTML = 'No game sessions found. Add some!';
    }
  });
}

function toggleMatches(sessionId) {
  const matchesContainer = document.getElementById(`matches-${sessionId}`);
  if (matchesContainer.style.display === 'none' || matchesContainer.style.display === '') {
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
        matchesHtml += '<table><tr><th>Game Mode</th><th>Map</th><th>Placement</th><th>Kills Player 1</th><th>Kills Player 2</th><th>Kills Player 3</th><th>Kills Player 4</th><th>Kills Player 5</th></tr>';
        Object.entries(session.matches).forEach(([matchId, match]) => {
          matchesHtml += `
            <tr>
              <td>${match.gameMode}</td>
              <td>${match.map}</td>
              <td>${match.placement}</td>
              <td>${match.killsPlayer1 !== null && match.killsPlayer1 !== undefined ? match.killsPlayer1 : ''}</td>
              <td>${match.killsPlayer2 !== null && match.killsPlayer2 !== undefined ? match.killsPlayer2 : ''}</td>
              <td>${match.killsPlayer3 !== null && match.killsPlayer3 !== undefined ? match.killsPlayer3 : ''}</td>
              <td>${match.killsPlayer4 !== null && match.killsPlayer4 !== undefined ? match.killsPlayer4 : ''}</td>
              <td>${match.killsPlayer5 !== null && match.killsPlayer5 !== undefined ? match.killsPlayer5 : ''}</td>
              <td><button onclick="deleteMatch('${sessionId}', '${matchId}')">Delete Match</button></td>
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

window.deleteMatch = function(sessionId, matchId) {
  if (confirm('Are you sure you want to delete this match?')) {
    remove(ref(database, `gameSessions/${sessionId}/matches/${matchId}`))
      .then(() => {
        loadMatches(sessionId);
      })
      .catch(error => {
        console.error("Error deleting match: ", error);
        alert('Error deleting match. Please try again.');
      });
  }
}

// Game Modes
function showGameModes() {
  mainContent.innerHTML = `
    <h2>Game Modes</h2>
    <button onclick="showModal('addGameMode')">Add Game Mode</button>
    <div id="gameModeList"></div>
  `;
  loadGameModes();
}

function loadGameModes() {
  const gameModeList = document.getElementById('gameModeList');
  gameModeList.innerHTML = 'Loading game modes...';
  
  onValue(ref(database, 'gameModes'), (snapshot) => {
    gameModeList.innerHTML = '';
    snapshot.forEach((childSnapshot) => {
      const gameMode = childSnapshot.val();
      const gameModeId = childSnapshot.key;
      gameModeList.innerHTML += `
        <div class="card">
          <h3>${gameMode.name}</h3>
          <button onclick="showModal('editGameMode', '${gameModeId}')">Edit</button>
          <button onclick="deleteGameMode('${gameModeId}')">Delete</button>
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

// Maps
function showMaps() {
  mainContent.innerHTML = `
    <h2>Maps</h2>
    <button onclick="showModal('addMap')">Add Map</button>
    <div id="mapList"></div>
  `;
  loadMaps();
}

function loadMaps() {
  const mapList = document.getElementById('mapList');
  mapList.innerHTML = 'Loading maps...';
  
  onValue(ref(database, 'maps'), (snapshot) => {
    mapList.innerHTML = '';
    snapshot.forEach((childSnapshot) => {
      const map = childSnapshot.val();
      const mapId = childSnapshot.key;
      mapList.innerHTML += `
        <div class="card">
          <h3>${map.name}</h3>
          <button onclick="showModal('editMap', '${mapId}')">Edit</button>
          <button onclick="deleteMap('${mapId}')">Delete</button>
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
showTeamMembers();

// Check connection
const connectedRef = ref(database, ".info/connected");
onValue(connectedRef, (snap) => {
    if (snap.val() === true) {
        console.log("Connected to Firebase");
    } else {
        console.log("Not connected to Firebase");
    }
});

// Statistics
function loadStats() {
  const statsTable = document.getElementById('statsTable');
  statsTable.innerHTML = 'Loading statistics...';

  get(ref(database, 'gameSessions')).then((snapshot) => {
    const sessions = [];
    snapshot.forEach((childSnapshot) => {
      const session = childSnapshot.val();
      session.id = childSnapshot.key; // Save the session ID
      sessions.push(session);
    });

    // Sort sessions by date in descending order
    sessions.sort((a, b) => new Date(b.date) - new Date(a.date));

    let tableHTML = `
      <table class="stats-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Games Played</th>
            <th>Wins</th>
            <th>2nd Place</th>
            <th>3rd Place</th>
            <th>4th Place</th>
            <th>5th Place</th>
            <th>6th+ Place</th>
            <th>Kills Player 1</th>
            <th>Kills Player 2</th>
            <th>Kills Player 3</th>
            <th>Kills Player 4</th>
            <th>Kills Player 5</th>
          </tr>
        </thead>
        <tbody>
    `;

    let totalStats = {
      gamesPlayed: 0,
      wins: 0,
      secondPlace: 0,
      thirdPlace: 0,
      fourthPlace: 0,
      fifthPlace: 0,
      sixthPlacePlus: 0,
      killsPlayer1: 0,
      killsPlayer2: 0,
      killsPlayer3: 0,
      killsPlayer4: 0,
      killsPlayer5: 0,
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
          <td>${stats.wins} (${((stats.wins / stats.gamesPlayed) * 100).toFixed(1)}%)</td>
          <td>${stats.secondPlace} (${((stats.secondPlace / stats.gamesPlayed) * 100).toFixed(1)}%)</td>
          <td>${stats.thirdPlace} (${((stats.thirdPlace / stats.gamesPlayed) * 100).toFixed(1)}%)</td>
          <td>${stats.fourthPlace} (${((stats.fourthPlace / stats.gamesPlayed) * 100).toFixed(1)}%)</td>
          <td>${stats.fifthPlace} (${((stats.fifthPlace / stats.gamesPlayed) * 100).toFixed(1)}%)</td>
          <td>${stats.sixthPlacePlus} (${((stats.sixthPlacePlus / stats.gamesPlayed) * 100).toFixed(1)}%)</td>
          <td>${stats.killsPlayer1}</td>
          <td>${stats.killsPlayer2}</td>
          <td>${stats.killsPlayer3}</td>
          <td>${stats.killsPlayer4}</td>
          <td>${stats.killsPlayer5}</td>
        </tr>
      `;
    });

    // Add total row
    if (totalStats.gamesPlayed > 0) {
      tableHTML += `
        <tfoot>
          <tr>
            <td><strong>Total</strong></td>
            <td><strong>${totalStats.gamesPlayed}</strong></td>
            <td><strong>${totalStats.wins} (${((totalStats.wins / totalStats.gamesPlayed) * 100).toFixed(1)}%)</strong></td>
            <td><strong>${totalStats.secondPlace} (${((totalStats.secondPlace / totalStats.gamesPlayed) * 100).toFixed(1)}%)</strong></td>
            <td><strong>${totalStats.thirdPlace} (${((totalStats.thirdPlace / totalStats.gamesPlayed) * 100).toFixed(1)}%)</strong></td>
            <td><strong>${totalStats.fourthPlace} (${((totalStats.fourthPlace / totalStats.gamesPlayed) * 100).toFixed(1)}%)</strong></td>
            <td><strong>${totalStats.fifthPlace} (${((totalStats.fifthPlace / totalStats.gamesPlayed) * 100).toFixed(1)}%)</strong></td>
            <td><strong>${totalStats.sixthPlacePlus} (${((totalStats.sixthPlacePlus / totalStats.gamesPlayed) * 100).toFixed(1)}%)</strong></td>
            <td><strong>${totalStats.killsPlayer1}</strong></td>
            <td><strong>${totalStats.killsPlayer2}</strong></td>
            <td><strong>${totalStats.killsPlayer3}</strong></td>
            <td><strong>${totalStats.killsPlayer4}</strong></td>
            <td><strong>${totalStats.killsPlayer5}</strong></td>
          </tr>
        </tfoot>
      `;
    }

    tableHTML += '</tbody></table>';
    statsTable.innerHTML = tableHTML;

    if (snapshot.size === 0) {
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
    killsPlayer1: 0,
    killsPlayer2: 0,
    killsPlayer3: 0,
    killsPlayer4: 0,
    killsPlayer5: 0,
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
    if (match.killsPlayer1) stats.killsPlayer1 += match.killsPlayer1;
    if (match.killsPlayer2) stats.killsPlayer2 += match.killsPlayer2;
    if (match.killsPlayer3) stats.killsPlayer3 += match.killsPlayer3;
    if (match.killsPlayer4) stats.killsPlayer4 += match.killsPlayer4;
    if (match.killsPlayer5) stats.killsPlayer5 += match.killsPlayer5;
  });

  return stats;
}
