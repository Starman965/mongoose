import { ref, onValue, push, update, remove, get, set } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js";
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
function formatDate(dateString) {
  const date = new Date(dateString);
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  return date.toLocaleDateString(undefined, options);
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
          <h3>${formatDate(session.date)}</h3>
          <p>Number of matches: ${session.matches ? Object.keys(session.matches).length : 0}</p>
          <button class="toggle-matches" onclick="toggleMatches('${sessionId}')">View Matches</button>
          <button onclick="showModal('addMatch', '${sessionId}')">Add Match</button>
          <button onclick="showModal('editGameSession', '${sessionId}')">Edit Session</button>
          <button onclick="deleteGameSession('${sessionId}')">Delete Session</button>
          <div id="matches-${sessionId}" class="matches-container"></div>
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

// Initialize the app
showTeamMembers();
