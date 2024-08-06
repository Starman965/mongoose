// ... (previous Firebase configuration and initialization)

// Make showModal globally accessible
window.showModal = function(action, id = null) {
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
          <button type="submit">Add Team Member</button>
        </form>
      `;
      document.getElementById('teamMemberForm').addEventListener('submit', addOrUpdateTeamMember);
      break;
    case 'editTeamMember':
      database.ref(`teamMembers/${id}`).once('value', (snapshot) => {
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
          <input type="date" id="date" required>
          <button type="submit">Add Game Session</button>
        </form>
      `;
      document.getElementById('gameSessionForm').addEventListener('submit', addGameSession);
      break;
    case 'editGameSession':
      database.ref(`gameSessions/${id}`).once('value', (snapshot) => {
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
            <!-- Add game modes dynamically here -->
          </select>
          <select id="map" required>
            <option value="">Select Map</option>
            <!-- Add maps dynamically here -->
          </select>
          <input type="number" id="placement" placeholder="Placement" required min="1">
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

// Make deleteTeamMember globally accessible
window.deleteTeamMember = function(id) {
  if (confirm('Are you sure you want to delete this team member?')) {
    database.ref(`teamMembers/${id}`).remove()
      .then(() => loadTeamMembers())
      .catch(error => {
        console.error("Error deleting team member: ", error);
        alert('Error deleting team member. Please try again.');
      });
  }
}

// ... (previous team member functions)

function addOrUpdateGameSession(e) {
  e.preventDefault();
  const form = e.target;
  const sessionId = form.dataset.id;
  const sessionData = {
    date: form.date.value,
  };

  const operation = sessionId
    ? database.ref(`gameSessions/${sessionId}`).update(sessionData)
    : database.ref('gameSessions').push(sessionData);

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

function deleteGameSession(id) {
  if (confirm('Are you sure you want to delete this game session?')) {
    database.ref(`gameSessions/${id}`).remove()
      .then(() => loadGameSessions())
      .catch(error => {
        console.error("Error deleting game session: ", error);
        alert('Error deleting game session. Please try again.');
      });
  }
}

function addMatch(e) {
  e.preventDefault();
  const form = e.target;
  const sessionId = form.dataset.sessionId;
  const matchData = {
    gameMode: form.gameMode.value,
    map: form.map.value,
    placement: parseInt(form.placement.value)
  };

  database.ref(`gameSessions/${sessionId}/matches`).push(matchData)
    .then(() => {
      loadGameSessions();
      modal.style.display = "none";
    })
    .catch(error => {
      console.error("Error adding match: ", error);
      alert('Error adding match. Please try again.');
    });
}

function viewMatches(sessionId) {
  database.ref(`gameSessions/${sessionId}`).once('value', (snapshot) => {
    if (snapshot.exists()) {
      const session = snapshot.val();
      let matchesHtml = '<h3>Matches</h3>';
      if (session.matches) {
        Object.entries(session.matches).forEach(([matchId, match]) => {
          matchesHtml += `
            <div class="match-card">
              <p>Game Mode: ${match.gameMode}</p>
              <p>Map: ${match.map}</p>
              <p>Placement: ${match.placement}</p>
              <button onclick="deleteMatch('${sessionId}', '${matchId}')">Delete Match</button>
            </div>
          `;
        });
      } else {
        matchesHtml += '<p>No matches found for this session.</p>';
      }
      modalContent.innerHTML = matchesHtml;
    }
  });
}

window.deleteMatch = function(sessionId, matchId) {
  if (confirm('Are you sure you want to delete this match?')) {
    database.ref(`gameSessions/${sessionId}/matches/${matchId}`).remove()
      .then(() => {
        viewMatches(sessionId);
      })
      .catch(error => {
        console.error("Error deleting match: ", error);
        alert('Error deleting match. Please try again.');
      });
  }
}

function loadGameModesAndMaps() {
  const gameModeSelect = document.getElementById('gameMode');
  const mapSelect = document.getElementById('map');

  database.ref('gameModes').once('value', (snapshot) => {
    snapshot.forEach((childSnapshot) => {
      const gameMode = childSnapshot.val();
      gameModeSelect.innerHTML += `<option value="${gameMode.name}">${gameMode.name}</option>`;
    });
  });

  database.ref('maps').once('value', (snapshot) => {
    snapshot.forEach((childSnapshot) => {
      const map = childSnapshot.val();
      mapSelect.innerHTML += `<option value="${map.name}">${map.name}</option>`;
    });
  });
}

function loadGameSessions() {
  const sessionList = document.getElementById('sessionList');
  sessionList.innerHTML = 'Loading game sessions...';
  
  database.ref('gameSessions').once('value', (snapshot) => {
    sessionList.innerHTML = '';
    snapshot.forEach((childSnapshot) => {
      const session = childSnapshot.val();
      const sessionId = childSnapshot.key;
      sessionList.innerHTML += `
        <div class="card">
          <h3>Session on ${session.date}</h3>
          <p>Number of matches: ${session.matches ? Object.keys(session.matches).length : 0}</p>
          <button onclick="showModal('viewMatches', '${sessionId}')">View Matches</button>
          <button onclick="showModal('addMatch', '${sessionId}')">Add Match</button>
          <button onclick="showModal('editGameSession', '${sessionId}')">Edit Session</button>
          <button onclick="deleteGameSession('${sessionId}')">Delete Session</button>
        </div>
      `;
    });
    if (sessionList.innerHTML === '') {
      sessionList.innerHTML = 'No game sessions found. Add some!';
    }
  });
}

// Make deleteGameSession globally accessible
window.deleteGameSession = deleteGameSession;

// Statistics
function showStats() {
  mainContent.innerHTML = `
    <h2>Game Statistics</h2>
    <div id="statsTable"></div>
  `;
  loadStats();
}

function loadStats() {
  const statsTable = document.getElementById('statsTable');
  statsTable.innerHTML = 'Loading statistics...';

  database.ref('gameSessions').once('value', (snapshot) => {
    let tableHTML = `
      <table>
        <tr>
          <th>Date</th>
          <th>Games Played</th>
          <th>Wins</th>
          <th>2nd Place</th>
          <th>3rd Place</th>
          <th>4th Place</th>
          <th>5th Place</th>
          <th>6th+ Place</th>
        </tr>
    `;

    snapshot.forEach((childSnapshot) => {
      const session = childSnapshot.val();
      const stats = calculateSessionStats(session.matches || {});
      tableHTML += `
        <tr>
          <td>${session.date}</td>
          <td>${stats.gamesPlayed}</td>
          <td>${stats.wins}</td>
          <td>${stats.secondPlace}</td>
          <td>${stats.thirdPlace}</td>
          <td>${stats.fourthPlace}</td>
          <td>${stats.fifthPlace}</td>
          <td>${stats.sixthPlacePlus}</td>
        </tr>
      `;
    });

    tableHTML += '</table>';
    statsTable.innerHTML = tableHTML;

    if (snapshot.numChildren() === 0) {
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
    sixthPlacePlus: 0
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
  });

  return stats;
}

// Initialize the app
showTeamMembers();

// Check connection
const connectedRef = database.ref(".info/connected");
connectedRef.on("value", (snap) => {
    if (snap.val() === true) {
        console.log("Connected to Firebase");
    } else {
        console.log("Not connected to Firebase");
    }
});
