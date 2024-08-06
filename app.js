// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCsW2O4WMxcHKMsIBJE4qHhkcTBdqYNZTk",
  authDomain: "mongoose-a1fec.firebaseapp.com",
  databaseURL: "https://mongoose-a1fec-default-rtdb.firebaseio.com",
  projectId: "mongoose-a1fec",
  storageBucket: "mongoose-a1fec.appspot.com",
  messagingSenderId: "504377946463",
  appId: "1:504377946463:web:863aee9ddf559239bb06ea",
  measurementId: "G-31E63T2391"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const analytics = firebase.analytics();

// DOM elements
const mainContent = document.getElementById('mainContent');
const showTeamBtn = document.getElementById('showTeamBtn');
const showSessionsBtn = document.getElementById('showSessionsBtn');

// Event listeners
showTeamBtn.addEventListener('click', showTeamMembers);
showSessionsBtn.addEventListener('click', showGameSessions);

// Functions to show team members
function showTeamMembers() {
    mainContent.innerHTML = '<h2>Team Members</h2>';
    mainContent.innerHTML += '<div id="teamList"></div>';
    mainContent.innerHTML += `
        <h3>Add New Team Member</h3>
        <form id="addTeamMemberForm">
            <input type="text" id="name" placeholder="Name" required>
            <input type="text" id="gamertag" placeholder="Gamertag" required>
            <input type="text" id="state" placeholder="State" required>
            <input type="number" id="age" placeholder="Age" required>
            <input type="text" id="favoriteSnack" placeholder="Favorite Snack" required>
            <button type="submit">Add Team Member</button>
        </form>
    `;

    const addTeamMemberForm = document.getElementById('addTeamMemberForm');
    addTeamMemberForm.addEventListener('submit', addTeamMember);

    loadTeamMembers();
}

function loadTeamMembers() {
    const teamList = document.getElementById('teamList');
    teamList.innerHTML = '';

    db.collection('teamMembers').get().then((querySnapshot) => {
        querySnapshot.forEach((doc) => {
            const member = doc.data();
            teamList.innerHTML += `
                <div class="card">
                    <h3>${member.name} (${member.gamertag})</h3>
                    <p>State: ${member.state}</p>
                    <p>Age: ${member.age}</p>
                    <p>Favorite Snack: ${member.favoriteSnack}</p>
                </div>
            `;
        });
    });
}

function addTeamMember(e) {
    e.preventDefault();
    const newMember = {
        name: document.getElementById('name').value,
        gamertag: document.getElementById('gamertag').value,
        state: document.getElementById('state').value,
        age: parseInt(document.getElementById('age').value),
        favoriteSnack: document.getElementById('favoriteSnack').value
    };

    db.collection('teamMembers').add(newMember)
        .then(() => {
            loadTeamMembers();
            e.target.reset();
        })
        .catch((error) => {
            console.error("Error adding team member: ", error);
        });
}

// Functions to show game sessions
function showGameSessions() {
    mainContent.innerHTML = '<h2>Game Sessions</h2>';
    mainContent.innerHTML += '<div id="sessionList"></div>';
    mainContent.innerHTML += `
        <h3>Add New Game Session</h3>
        <form id="addGameSessionForm">
            <input type="date" id="date" required>
            <input type="text" id="players" placeholder="Players (comma-separated)" required>
            <select id="gameType" required>
                <option value="">Select Game Type</option>
                <option value="Warzone">Warzone</option>
                <option value="Resurgence">Resurgence</option>
                <option value="Multiplayer">Multiplayer</option>
            </select>
            <input type="text" id="map" placeholder="Map" required>
            <input type="number" id="placement" placeholder="Placement" required>
            <button type="submit">Add Game Session</button>
        </form>
    `;

    const addGameSessionForm = document.getElementById('addGameSessionForm');
    addGameSessionForm.addEventListener('submit', addGameSession);

    loadGameSessions();
}

function loadGameSessions() {
    const sessionList = document.getElementById('sessionList');
    sessionList.innerHTML = '';

    db.collection('gameSessions').get().then((querySnapshot) => {
        querySnapshot.forEach((doc) => {
            const session = doc.data();
            sessionList.innerHTML += `
                <div class="card">
                    <h3>Session on ${session.date}</h3>
                    <p>Players: ${session.players.join(', ')}</p>
                    <p>Game Type: ${session.gameType}</p>
                    <p>Map: ${session.map}</p>
                    <p>Placement: ${session.placement}</p>
                </div>
            `;
        });
    });
}

function addGameSession(e) {
    e.preventDefault();
    const newSession = {
        date: document.getElementById('date').value,
        players: document.getElementById('players').value.split(',').map(player => player.trim()),
        gameType: document.getElementById('gameType').value,
        map: document.getElementById('map').value,
        placement: parseInt(document.getElementById('placement').value)
    };

    db.collection('gameSessions').add(newSession)
        .then(() => {
            loadGameSessions();
            e.target.reset();
        })
        .catch((error) => {
            console.error("Error adding game session: ", error);
        });
}

// Initial load
showTeamMembers();
