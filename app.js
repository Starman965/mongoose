// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCsW2O4WMxcHKMsIBJE4qHhkcTBdqYNZTk",
  authDomain: "mongoose-a1fec.firebaseapp.com",
  projectId: "mongoose-a1fec",
  storageBucket: "mongoose-a1fec.appspot.com",
  messagingSenderId: "504377946463",
  appId: "1:504377946463:web:863aee9ddf559239bb06ea",
  measurementId: "G-31E63T2391"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

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
  db.collection('teamMembers').get()
    .then(querySnapshot => {
      teamList.innerHTML = '';
      querySnapshot.forEach(doc => {
        const member = doc.data();
        teamList.innerHTML += `
          <div class="card">
            <h3>${member.name} (${member.gamertag})</h3>
            <p>State: ${member.state}</p>
            <p>Age: ${member.age}</p>
            <p>Favorite Snack: ${member.favoriteSnack}</p>
            <button onclick="showModal('editTeamMember', '${doc.id}')">Edit</button>
            <button onclick="deleteTeamMember('${doc.id}')">Delete</button>
          </div>
        `;
      });
      if (querySnapshot.empty) {
        teamList.innerHTML = 'No team members found. Add some!';
      }
    })
    .catch(error => {
      console.error("Error loading team members: ", error);
      teamList.innerHTML = 'Error loading team members. Please try again.';
    });
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
          <button type="submit">Add Team Member</button>
        </form>
      `;
      document.getElementById('teamMemberForm').addEventListener('submit', addOrUpdateTeamMember);
      break;
    case 'editTeamMember':
      db.collection('teamMembers').doc(id).get()
        .then(doc => {
          const member = doc.data();
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
        });
      break;
    // Add cases for game modes and maps here
  }
  modal.style.display = "block";
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

  const operation = memberId
    ? db.collection('teamMembers').doc(memberId).update(memberData)
    : db.collection('teamMembers').add(memberData);

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

function deleteTeamMember(id) {
  if (confirm('Are you sure you want to delete this team member?')) {
    db.collection('teamMembers').doc(id).delete()
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
  db.collection('gameSessions').orderBy('date', 'desc').get()
    .then(querySnapshot => {
      sessionList.innerHTML = '';
      querySnapshot.forEach(doc => {
        const session = doc.data();
        sessionList.innerHTML += `
          <div class="card">
            <h3>Session on ${session.date}</h3>
            <p>Number of matches: ${session.matches.length}</p>
            <button onclick="showModal('viewMatches', '${doc.id}')">View Matches</button>
            <button onclick="showModal('addMatch', '${doc.id}')">Add Match</button>
          </div>
        `;
      });
      if (querySnapshot.empty) {
        sessionList.innerHTML = 'No game sessions found. Add some!';
      }
    })
    .catch(error => {
      console.error("Error loading game sessions: ", error);
      sessionList.innerHTML = 'Error loading game sessions. Please try again.';
    });
}

// Add functions for adding/editing/deleting game sessions and matches here

// Initialize the app
showTeamMembers();
