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
  }
  modal.style.display = "block";
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

// Game Sessions
function showGameSessions() {
  mainContent.innerHTML = `
    <h2>Game Sessions</h2>
    <button onclick="showModal('addGameSession')">Add Game Session</button>
    <div id="sessionList"></div>
  `;
  loadGameSessions();
}

function loadGameSessions() {
  const sessionList = document.getElementById('sessionList');
  sessionList.innerHTML = 'Loading game sessions...';
  
  onValue(ref(database, 'gameSessions'), (snapshot) => {
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

function addMatch(e) {
  e.preventDefault();
  const form = e.target;
  const sessionId = form.dataset.sessionId;
  const matchData = {
    gameMode: form.gameMode.value,
    map: form.map.value,
    placement: parseInt(form.placement.value)
  };

  push(ref(database, `gameSessions/${sessionId}/matches`), matchData)
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
  get(ref(database, `gameSessions/${sessionId}`)).then((snapshot) => {
    if (snapshot.exists()) {
      const session = snapshot.val();
      let matchesHtml = '<h3>Matches</h3>';
      if (session.matches) {
        matchesHtml += '<table><tr><th>Game Mode</th><th>Map</th><th>Placement</th><th>Action</th></tr>';
        Object.entries(session.matches).forEach(([matchId, match]) => {
          matchesHtml += `
            <tr>
              <td>${match.gameMode}</td>
              <td>${match.map}</td>
              <td>${match.placement}</td>
              <td><button onclick="deleteMatch('${sessionId}', '${matchId}')">Delete Match</button></td>
            </tr>
          `;
        });
        matchesHtml += '</table>';
      } else {
        matchesHtml += '<p>No matches found for this session.</p>';
      }
      modalContent.innerHTML = matchesHtml;
    }
  });
}

window.deleteMatch = function(sessionId, matchId) {
  if (confirm('Are you sure you want to delete this match?')) {
    remove(ref(database, `gameSessions/${sessionId}/matches/${matchId}`))
      .then(() => {
        viewMatches(sessionId);
      })
      .catch(error => {
        console.error("Error deleting match: ", error);
        alert('Error deleting match. Please try again.');
      });
  }
}

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

  get(ref(database, 'gameSessions')).then((snapshot) => {
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

    let totalStats = {
      gamesPlayed: 0,
      wins: 0,
      secondPlace: 0,
      thirdPlace: 0,
      fourthPlace: 0,
      fifthPlace: 0,
      sixthPlacePlus: 0
    };

    snapshot.forEach((childSnapshot) => {
      const session = childSnapshot.val();
      const stats = calculateSessionStats(session.matches || {});
      
      // Add to totals
      for (let key in totalStats) {
        totalStats[key] += stats[key];
      }

      tableHTML += `
        <tr>
          <td>${session.date}</td>
          <td>${stats.gamesPlayed}</td>
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
      tableHTML += `
        <tr>
          <td><strong>Total</strong></td>
          <td><strong>${totalStats.gamesPlayed}</strong></td>
          <td><strong>${totalStats.wins} (${((totalStats.wins / totalStats.gamesPlayed) * 100).toFixed(1)}%)</strong></td>
          <td><strong>${totalStats.secondPlace} (${((totalStats.secondPlace / totalStats.gamesPlayed) * 100).toFixed(1)}%)</strong></td>
          <td><strong>${totalStats.thirdPlace} (${((totalStats.thirdPlace / totalStats.gamesPlayed) * 100).toFixed(1)}%)</strong></td>
          <td><strong>${totalStats.fourthPlace} (${((totalStats.fourthPlace / totalStats.gamesPlayed) * 100).toFixed(1)}%)</strong></td>
          <td><strong>${totalStats.fifthPlace} (${((totalStats.fifthPlace / totalStats.gamesPlayed) * 100).toFixed(1)}%)</strong></td>
          <td><strong>${totalStats.sixthPlacePlus} (${((totalStats.sixthPlacePlus / totalStats.gamesPlayed) * 100).toFixed(1)}%)</strong></td>
        </tr>
      `;
    }

    tableHTML += '</table>';
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
