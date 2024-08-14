import { ref, onValue, push, update, remove, get } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js";
import { database } from './firebaseConfig.js';
import { initAwards, loadAchievements, loadChallenges, processMatchResult } from './awardsmanager.js';
import { getAchievementsUpdates, getChallengesUpdates } from './awardsmanager.js';

const storage = getStorage();

// DOM elements
const mainContent = document.getElementById('mainContent');
const modal = document.getElementById('modal');
const modalContent = document.getElementById('modalContent');
const closeModal = document.getElementsByClassName('close')[0];

// OLD DOM ELEMENTS COMMENTED OUT TO TEST THE ONES ABOVE (Unexpected Token Error)
// const mainContent = document.getElementById('mainContent');
// const modal = document.getElementById('modal');
// const modalContent = .getElementById('modalContent');
// const closeModal = .getElementsByClassName('close')[0];

// Close modal when clicking on 'x'
closeModal.onclick = () => modal.style.display = "none";

// Close modal when clicking outside of it
window.onclick = (event) => {
  if (event.target == modal) {
    modal.style.display = "none";
  }
}
// Add the loadGameModesAndMaps function here
async function loadGameModesAndMaps() {
  const gameModeSelect = document.getElementById('gameMode');
  const mapSelect = document.getElementById('map');

  // Load game modes
  const gameModeSnapshot = await get(ref(database, 'gameModes'));
  gameModeSelect.innerHTML = '<option value="">Select Game Mode</option>';
  gameModeSnapshot.forEach((childSnapshot) => {
    const gameMode = childSnapshot.val();
    gameModeSelect.innerHTML += `<option value="${gameMode.name}">${gameMode.name}</option>`;
  });

  // Load maps
  const mapSnapshot = await get(ref(database, 'maps'));
  mapSelect.innerHTML = '<option value="">Select Map</option>';
  mapSnapshot.forEach((childSnapshot) => {
    const map = childSnapshot.val();
    mapSelect.innerHTML += `<option value="${map.name}">${map.name}</option>`;
  });
}
async function updatePlacementInput() {
    const gameMode = document.getElementById('gameMode').value;
    const placementContainer = document.getElementById('placementContainer');
    const gameModes = await get(ref(database, 'gameModes')).then(snapshot => {
        const modes = {};
        snapshot.forEach(child => {
            modes[child.val().name] = child.val().type;
        });
        return modes;
    });

    if (gameModes[gameMode] === 'Battle Royale') {
        placementContainer.innerHTML = `
            <label for="placement">Placement <span id="placementValue" class="slider-value">1st</span></label>
            <input type="range" id="placement" class="slider" min="1" max="10" step="1" value="1" required>
        `;
        document.getElementById('placement').addEventListener('input', updatePlacementValue);
    } else if (gameModes[gameMode] === 'Multiplayer') {
        placementContainer.innerHTML = `
            <label for="placement">Result</label>
            <div class="toggle-switch">
                <input type="checkbox" id="placement" name="placement" class="toggle-input">
                <label for="placement" class="toggle-label">
                    <span class="toggle-inner"></span>
                </label>
            </div>
        `;
       // Set default state to unchecked (Lost)
        document.getElementById('placement').checked = false;
    }
}

// Navigation setup
document.getElementById('statsNav').addEventListener('click', () => showSection('stats'));
document.getElementById('sessionsNav').addEventListener('click', () => showSection('sessions'));
document.getElementById('achievementsNav').addEventListener('click', () => showSection('achievements'));
document.getElementById('challengesNav').addEventListener('click', () => showSection('challenges'));
document.getElementById('highlightsNav').addEventListener('click', () => showSection('highlights'));
document.getElementById('mapsNav').addEventListener('click', () => showSection('maps'));
document.getElementById('modesNav').addEventListener('click', () => showSection('modes'));
document.getElementById('teamNav').addEventListener('click', () => showSection('team'));
document.getElementById('adminNav').addEventListener('click', () => showAdminSection());
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
    case 'achievements':
      // Show a message if `awards.js` is disabled
      mainContent.innerHTML = '<p>Achievements are currently unavailable.</p>';
      break;
    case 'challenges':
      // Show a message if `awards.js` is disabled
      mainContent.innerHTML = '<p>Challenges are currently unavailable.</p>';
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
function checkAchievementCriteria(achievement, matchData) {
  // Parse the JSON logic criteria
  const criteria = JSON.parse(achievement.logicCriteria);

  // Check if the match data meets all the criteria
  return criteria.every(criterion => {
    switch (criterion.type) {
      case 'gameMode':
        return matchData.gameMode === criterion.value;
      case 'map':
        return matchData.map === criterion.value;
      case 'placement':
        return matchData.placement <= criterion.value;
      case 'totalKills':
        return matchData.totalKills >= criterion.value;
      case 'playerKills':
        return Object.values(matchData.kills).some(kills => kills >= criterion.value);
      // Add more criteria types as needed
      default:
        return false;
    }
  });
}

function checkChallengeCriteria(challenge, matchData) {
  // Similar to checkAchievementCriteria, but may include player-specific checks
  const criteria = JSON.parse(challenge.logicCriteria);

  return criteria.every(criterion => {
    // Implement challenge-specific criteria checks
    // This might include checking individual player performance
    // or other challenge-specific conditions
  });
}

function showAdminSection() {
  mainContent.innerHTML = `
    <h2>Admin</h2>
    <div class="admin-tabs">
      <button class="admin-tab" onclick="showAchievementsAdmin()">Achievements</button>
      <button class="admin-tab" onclick="showChallengesAdmin()">Challenges</button>
    </div>
    <div id="adminContent"></div>
  `;
}

function showAchievementsAdmin() {
  const adminContent = document.getElementById('adminContent');
  adminContent.innerHTML = `
    <h3>Achievements Management</h3>
    <button class="button" onclick="showModal('addAchievement')">Add Achievement</button>
    <div id="achievementsList"></div>
  `;
  loadAchievementsAdmin();
}
function showChallengesAdmin() {
  const adminContent = document.getElementById('adminContent');
  adminContent.innerHTML = `
    <h3>Challenges Management</h3>
    <button class="button" onclick="showModal('addChallenge')">Add Challenge</button>
    <div id="challengesList"></div>
  `;
  loadChallengesAdmin();
}
function loadAchievementsAdmin() {
  const achievementsList = document.getElementById('achievementsList');
  achievementsList.innerHTML = 'Loading achievements...';

  get(ref(database, 'achievements')).then((snapshot) => {
    const achievements = snapshot.val();
    let achievementsHtml = '<table class="admin-table">';
    achievementsHtml += '<tr><th>Title</th><th>Description</th><th>AP</th><th>Difficulty</th><th>Actions</th></tr>';

    for (const [id, achievement] of Object.entries(achievements)) {
      achievementsHtml += `
        <tr>
          <td>${achievement.title}</td>
          <td>${achievement.description}</td>
          <td>${achievement.ap}</td>
          <td>${achievement.difficultyLevel}</td>
          <td>
            <button class="button" onclick="showModal('editAchievement', '${id}')">Edit</button>
            <button class="button" onclick="deleteAchievement('${id}')">Delete</button>
          </td>
        </tr>
      `;
    }

    achievementsHtml += '</table>';
    achievementsList.innerHTML = achievementsHtml;
  });
}

function loadChallengesAdmin() {
  const challengesList = document.getElementById('challengesList');
  challengesList.innerHTML = 'Loading challenges...';

  get(ref(database, 'challenges')).then((snapshot) => {
    const challenges = snapshot.val();
    let challengesHtml = '<table class="admin-table">';
    challengesHtml += '<tr><th>Title</th><th>Description</th><th>CP</th><th>Difficulty</th><th>Actions</th></tr>';

    for (const [id, challenge] of Object.entries(challenges)) {
      challengesHtml += `
        <tr>
          <td>${challenge.title}</td>
          <td>${challenge.description}</td>
          <td>${challenge.cp}</td>
          <td>${challenge.difficultyLevel}</td>
          <td>
            <button class="button" onclick="showModal('editChallenge', '${id}')">Edit</button>
            <button class="button" onclick="deleteChallenge('${id}')">Delete</button>
          </td>
        </tr>
      `;
    }

    challengesHtml += '</table>';
    challengesList.innerHTML = challengesHtml;
  });
}
// Add these functions to handle adding, editing, and deleting achievements and challenges
function addOrUpdateAchievement(e) {
  e.preventDefault();
  const form = e.target;
  const achievementId = form.dataset.id;
  const achievementData = {
    title: form.title.value,
    description: form.description.value,
    ap: parseInt(form.ap.value),
    difficultyLevel: form.difficultyLevel.value,
    requiredCompletionCount: parseInt(form.requiredCompletionCount.value),
    repeatable: form.repeatable.checked,
    gameMode: form.gameMode.value,
    specificMode: form.specificMode.value,
    map: form.map.value,
    logicCriteria: form.logicCriteria.value,
    locked: form.locked.checked,
    startDate: form.startDate.value,
    endDate: form.endDate.value,
    useHistoricalData: form.useHistoricalData.checked
  };

  const operation = achievementId
    ? update(ref(database, `achievements/${achievementId}`), achievementData)
    : push(ref(database, 'achievements'), achievementData);

  operation
    .then(() => {
      loadAchievementsAdmin();
      modal.style.display = "none";
    })
    .catch(error => {
      console.error("Error adding/updating achievement: ", error);
      alert('Error adding/updating achievement. Please try again.');
    });
}

function addOrUpdateChallenge(e) {
  e.preventDefault();
  const form = e.target;
  const challengeId = form.dataset.id;
  const challengeData = {
    title: form.title.value,
    description: form.description.value,
    cp: parseInt(form.cp.value),
    difficultyLevel: form.difficultyLevel.value,
    requiredCompletionCount: parseInt(form.requiredCompletionCount.value),
    repeatable: form.repeatable.checked,
    gameMode: form.gameMode.value,
    specificMode: form.specificMode.value,
    map: form.map.value,
    logicCriteria: form.logicCriteria.value,
    locked: form.locked.checked,
    startDate: form.startDate.value,
    endDate: form.endDate.value,
    useHistoricalData: form.useHistoricalData.checked,
    prizeDescription: form.prizeDescription.value,
    prizeSponsor: form.prizeSponsor.value,
    soloChallenge: form.soloChallenge.checked
  };

  const operation = challengeId
    ? update(ref(database, `challenges/${challengeId}`), challengeData)
    : push(ref(database, 'challenges'), challengeData);

  operation
    .then(() => {
      loadChallengesAdmin();
      modal.style.display = "none";
    })
    .catch(error => {
      console.error("Error adding/updating challenge: ", error);
      alert('Error adding/updating challenge. Please try again.');
    });
}

window.deleteAchievement = function(id) {
  if (confirm('Are you sure you want to delete this achievement?')) {
    remove(ref(database, `achievements/${id}`))
      .then(() => loadAchievementsAdmin())
      .catch(error => {
        console.error("Error deleting achievement: ", error);
        alert('Error deleting achievement. Please try again.');
      });
  }
}

window.deleteChallenge = function(id) {
  if (confirm('Are you sure you want to delete this challenge?')) {
    remove(ref(database, `challenges/${id}`))
      .then(() => loadChallengesAdmin())
      .catch(error => {
        console.error("Error deleting challenge: ", error);
        alert('Error deleting challenge. Please try again.');
      });
  }
}

function showStats() {
    mainContent.innerHTML = `
        <h2>Team Statistics</h2>
        <p>* Note: Total Kills and Average Kills are based solely on Battle Royale game modes.</p>
        <div id="statsTable"></div>
    `;
    loadStats();
    updateTeamStats();  // Add this line
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
function showAchievements() {
  mainContent.innerHTML = `
    <h2>Achievements</h2>
    <div class="filter-sort-container">
      <select id="achievementFilter">
        <option value="all">Show All</option>
        <option value="completedWeek">Completed This Week</option>
        <option value="completedMonth">Completed This Month</option>
        <option value="completedYear">Completed This Year</option>
        <option value="inProgress">In Progress</option>
      </select>
      <select id="achievementSort">
        <option value="difficulty">Sort by Difficulty</option>
        <option value="ap">Sort by Achievement Points</option>
        <option value="progress">Sort by Progress</option>
        <option value="completionDate">Sort by Completion Date</option>
      </select>
    </div>
    <div id="achievementsContainer" class="awards-grid"></div>
  `;
  loadAchievements();
}

function showChallenges() {
  mainContent.innerHTML = `
    <h2>Challenges</h2>
    <div class="filter-sort-container">
      <select id="challengeFilter">
        <option value="all">Show All</option>
        <option value="completedWeek">Completed This Week</option>
        <option value="completedMonth">Completed This Month</option>
        <option value="completedYear">Completed This Year</option>
        <option value="inProgress">In Progress</option>
      </select>
      <select id="challengeSort">
        <option value="difficulty">Sort by Difficulty</option>
        <option value="cp">Sort by Challenge Points</option>
        <option value="completionDate">Sort by Completion Date</option>
        <option value="prize">Sort by Prize</option>
      </select>
    </div>
    <div id="challengesContainer" class="awards-grid"></div>
  `;
  loadChallenges();
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
    <img src="2022-group-logo.png" alt="Team Logo" class="team-logo-about">
    <hr>
       <p>Once upon a time, in a galaxy far far away...</p>
    <hr>
      <video controls style="width: 25%; margin-top: 20px;">
      <source src="mongooseIntro.mp4" type="video/mp4">
      Your browser does not support the video tag.
    </video>
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

async function addOrUpdateTeamMember(e) {
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
      console.log('Attempting to access URL:', url); // Add this line
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
    await saveTeamMember(memberId, memberData);
    loadTeamMembers();
    modal.style.display = "none";
  } catch (error) {
    console.error("Error adding/updating team member: ", error);
    alert('Error adding/updating team member. Please try again.');
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
                    <h3>${formatDate(session.date, session.userTimezoneOffset)}</h3>
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
                
                // Convert matches object to array and sort by timestamp
                const sortedMatches = Object.entries(session.matches)
                    .map(([id, match]) => ({ id, ...match }))
                    .sort((a, b) => b.timestamp - a.timestamp);

                sortedMatches.forEach((match) => {
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
                                <button class="button" onclick="showModal('editMatch', '${sessionId}', '${match.id}')">Edit</button>
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

function addOrUpdateGameSession(e) {
  e.preventDefault();
  const form = e.target;
  const sessionId = form.dataset.id;
  
  // Create a date object from the input value
  const inputDate = new Date(form.date.value);
  
  // Adjust for the local time zone
  const userTimezoneOffset = inputDate.getTimezoneOffset() * 60000;
  const adjustedDate = new Date(inputDate.getTime() + userTimezoneOffset);
  
  const sessionData = {
    date: adjustedDate.toISOString(),
    userTimezoneOffset: userTimezoneOffset
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

async function saveMatch(sessionId, matchId, matchData) {
  let operation;
  if (matchId) {
    // Update existing match
    operation = update(ref(database, `gameSessions/${sessionId}/matches/${matchId}`), matchData);
  } else {
    // Add new match
    operation = push(ref(database, `gameSessions/${sessionId}/matches`), matchData);
  }

  try {
    await operation;
    loadMatches(sessionId);
    calculatePRValues();
    modal.style.display = "none";
  } catch (error) {
    console.error("Error adding/updating match: ", error);
    alert('Error adding/updating match. Please try again.');
  }
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
   console.log('Attempting to access highlight URL:', highlightURL);
   if (!highlightURL) {
     console.error('Highlight URL is undefined or null');
     alert('Sorry, the highlight video is not available.');
     return;
   }
   if (!highlightURL.startsWith('https://') && !highlightURL.startsWith('gs://')) {
     console.error('Invalid highlight URL format:', highlightURL);
     alert('Sorry, the highlight video URL is invalid.');
     return;
   }

  modalContent.innerHTML = `
    <h3>Match Highlight</h3>
    <video id="highlightVideo" controls>
      <source src="${highlightURL}" type="video/mp4">
      Your browser does not support the video tag.
    </video>
  `;
  modal.style.display = "block";

  const video = document.getElementById('highlightVideo');
  video.onerror = function() {
    console.error('Error loading video:', highlightURL);
    modalContent.innerHTML = '<p>Error loading the highlight video. Please try again later.</p>';
  };
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

function createAchievementCard(id, achievement) {
  const card = document.createElement('div');
  card.className = 'card achievement-card';
  
  let imageUrl = achievement.imageUrl || achievement.defaultImageUrl;
   console.log('Attempting to access URL:', imageURL); // Add this line
  if (!imageUrl || (!imageUrl.startsWith('https://') && !imageUrl.startsWith('gs://'))) {
    console.warn(`Invalid image URL for achievement ${id}:`, imageUrl);
    imageUrl = 'https://firebasestorage.googleapis.com/v0/b/gamenight-37cc6.appspot.com/o/achievements%2Fsample.png?alt=media&token=a96d1b32-4a21-4f92-86a9-6281a19053cf'; // Provide a default image path
  }

  card.innerHTML = `
    <img src="${imageUrl}" alt="${achievement.title}" onerror="this.src='path/to/fallback/image.png';">
    <h3>${achievement.title}</h3>
    <p>${achievement.description}</p>
    <p>Completed: ${achievement.currentCount}/${achievement.completionCount}</p>
  `;
  return card;
}

function formatDate(dateString, userTimezoneOffset) {
    const date = new Date(dateString);
    
    // Adjust the date based on the stored user timezone offset
    if (userTimezoneOffset !== undefined) {
        date.setTime(date.getTime() + userTimezoneOffset);
    }
    
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString(undefined, options);
}

 async function addMatch(e) {
    e.preventDefault();
    console.log('addMatch function called');
    const form = e.target;
    const sessionId = form.dataset.sessionId;
    const matchId = form.dataset.matchId;
    const gameMode = form.gameMode.value;
    console.log('Form data:', {
        sessionId,
        matchId,
        gameMode
    });
    try {
        const gameModes = await get(ref(database, 'gameModes')).then(snapshot => {
            const modes = {};
            snapshot.forEach(child => {
                modes[child.val().name] = child.val().type;
            });
            return modes;
        });
        console.log('Game modes fetched:', gameModes);
        let placement;
        if (gameModes[gameMode] === 'Battle Royale') {
            placement = parseInt(form.placement.value);
        } else if (gameModes[gameMode] === 'Multiplayer') {
            placement = form.placement.checked ? 'Won' : 'Lost';
        }
        console.log('Placement:', placement);
        const matchData = {
            gameMode: gameMode,
            map: form.map.value,
            placement: placement,
            totalKills: parseInt(form.totalKills.value) === -1 ? null : parseInt(form.totalKills.value),
            kills: {},
            timestamp: Date.now()
        };
        console.log('Match data before adding kills:', matchData);
        ['STARMAN', 'RSKILLA', 'SWFTSWORD', 'VAIDED', 'MOWGLI'].forEach(player => {
            const kills = parseInt(form[`kills${player}`].value);
            if (kills !== -1) {
                matchData.kills[player] = kills;
            }
        });
        console.log('Match data after adding kills:', matchData);
        const highlightVideo = form.highlightVideo.files[0];
        if (highlightVideo) {
            console.log('Highlight video found:', highlightVideo.name);
            try {
                const videoRef = storageRef(storage, `highlights/${sessionId}/${Date.now()}_${highlightVideo.name}`);
                const snapshot = await uploadBytes(videoRef, highlightVideo);
                const url = await getDownloadURL(snapshot.ref);
                console.log('Generated highlight video URL:', url);
                if (!url.startsWith('https://') && !url.startsWith('gs://')) {
                    console.error('Invalid video URL generated:', url);
                    throw new Error('Invalid video URL generated');
                }
                matchData.highlightURL = url;
            } catch (error) {
                console.error('Error uploading highlight video:', error);
                alert('Error uploading highlight video. The match will be saved without the video.');
            }
        } else if (matchId) {
            console.log('Checking for existing highlight URL');
            try {
                const existingMatch = await get(ref(database, `gameSessions/${sessionId}/matches/${matchId}`));
                if (existingMatch.exists() && existingMatch.val().highlightURL) {
                    matchData.highlightURL = existingMatch.val().highlightURL;
                    console.log('Existing highlight URL found:', matchData.highlightURL);
                }
            } catch (error) {
                console.error('Error retrieving existing highlight URL:', error);
            }
        }
        console.log('Final match data before saving:', matchData);
        if (matchId) {
            console.log('Updating existing match');
            await update(ref(database, `gameSessions/${sessionId}/matches/${matchId}`), matchData);
        } else {
            console.log('Adding new match');
            await push(ref(database, `gameSessions/${sessionId}/matches`), matchData);
        }
        console.log('Match saved successfully');

        // Process achievements and challenges
        await processMatchResult(matchData);

        // Show notification
        showNotification(matchData);

        loadMatches(sessionId);
        modal.style.display = "none";
    } catch (error) {
        console.error("Error adding/updating match:", error);
        alert('Error adding/updating match. Please try again.');
    }
}
function showNotification(matchData) {
    const achievementsUpdates = getAchievementsUpdates();
    const challengesUpdates = getChallengesUpdates();

    let notificationContent = '';
    let soundToPlay = '';

    if (achievementsUpdates.length > 0 || challengesUpdates.length > 0) {
        notificationContent += `<h3>Updates</h3>`;
        
        if (achievementsUpdates.length > 0) {
            notificationContent += `<h4>Achievements</h4>`;
            notificationContent += `<p>${achievementsUpdates.length} achievement(s) updated</p>`;
            notificationContent += achievementsUpdates.map(update => `<p>${update}</p>`).join('');
            soundToPlay = '/sounds/achievementsound2.mp3';
        } else {
            soundToPlay = '/sounds/achievementsound1.mp3';
        }

        if (challengesUpdates.length > 0) {
            notificationContent += `<h4>Challenges</h4>`;
            notificationContent += `<p>${challengesUpdates.length} challenge(s) updated</p>`;
            notificationContent += challengesUpdates.map(update => `<p>${update}</p>`).join('');
            soundToPlay = soundToPlay || '/sounds/challengesound2.mp3';
        } else if (!soundToPlay) {
            soundToPlay = '/sounds/challengesound1.mp3';
        }
    } else {
        notificationContent = '<p>No new achievements or challenges updated this match.</p>';
        soundToPlay = '/sounds/achievementsound1.mp3';
    }

    // Display the notification
    modalContent.innerHTML = notificationContent;
    modal.style.display = "block";

    // Play the sound
    const audio = new Audio(soundToPlay);
    audio.play();
}

// Make showModal function globally accessible
window.showModal = async function(action, id = null, subId = null) {
    modalContent.innerHTML = '';
    switch(action) {
        case 'addTeamMember':
            modalContent.innerHTML = `
                <h3>Add Team Member</h3>
                <form id="teamMemberForm">
                    <input type="text" id="name" placeholder="Name" required>
                    <input type="text" id="gamertag" placeholder="Gamertag" required>
                    <input type="text" id="state" placeholder="State" required>
                    <input type="date" id="birthdate" required>
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
                            <input type="date" id="birthdate" value="${member.birthdate}" required>
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
                    <input type="date" id="date" required>
                    <button type="submit">Add Game Session</button>
                </form>
            `;
            document.getElementById('gameSessionForm').addEventListener('submit', addOrUpdateGameSession);
            break;
      case 'editGameSession':
    get(ref(database, `gameSessions/${id}`)).then((snapshot) => {
        if (snapshot.exists()) {
            const session = snapshot.val();
            const sessionDate = new Date(session.date);
            
            // Adjust the date based on the stored user timezone offset
            if (session.userTimezoneOffset !== undefined) {
                sessionDate.setTime(sessionDate.getTime() - session.userTimezoneOffset);
            }
            
            const formattedDate = sessionDate.toISOString().split('T')[0]; // Format for date input
            modalContent.innerHTML = `
                <h3>Edit Game Session</h3>
                <form id="gameSessionForm" data-id="${id}">
                    <input type="date" id="date" value="${formattedDate}" required>
                    <button type="submit">Update Game Session</button>
                </form>
            `;
            document.getElementById('gameSessionForm').addEventListener('submit', addOrUpdateGameSession);
        }
    });
    break;
        case 'addMatch':
        case 'editMatch':
    let match = null;
    if (action === 'editMatch') {
        const snapshot = await get(ref(database, `gameSessions/${id}/matches/${subId}`));
        match = snapshot.val();
    }
            modalContent.innerHTML = `
                <h3>${action === 'addMatch' ? 'Add' : 'Edit'} Match</h3>
                <form id="matchForm" data-session-id="${id}" ${action === 'editMatch' ? `data-match-id="${subId}"` : ''} class="vertical-form">
                    <div class="form-group horizontal">
                        <div class="form-field">
                            <label for="gameMode">Game Mode</label>
                            <select id="gameMode" required>
                                <option value="">Select Game Mode</option>
                            </select>
                        </div>
                        <div class="form-field">
                            <label for="map">Map</label>
                            <select id="map" required>
                                <option value="">Select Map</option>
                            </select>
                        </div>
                    </div>
                    <div id="placementContainer" class="form-group">
                        <!-- Placement input will be dynamically added here -->
                    </div>
                    <div class="form-group">
                        <label for="totalKills">Total Kills <span id="totalKillsValue" class="slider-value">N/A</span></label>
                        <input type="range" id="totalKills" class="slider" min="-1" max="30" step="1" value="-1">
                    </div>
                    <div class="form-group">
                        <label for="killsSTARMAN">Kills (STARMAN) <span id="killsSTARMANValue" class="slider-value">N/A</span></label>
                        <input type="range" id="killsSTARMAN" class="slider" min="-1" max="30" step="1" value="-1">
                    </div>
                    <div class="form-group">
                        <label for="killsRSKILLA">Kills (RSKILLA) <span id="killsRSKILLAValue" class="slider-value">N/A</span></label>
                        <input type="range" id="killsRSKILLA" class="slider" min="-1" max="30" step="1" value="-1">
                    </div>
                    <div class="form-group">
                        <label for="killsSWFTSWORD">Kills (SWFTSWORD) <span id="killsSWFTSWORDValue" class="slider-value">N/A</span></label>
                        <input type="range" id="killsSWFTSWORD" class="slider" min="-1" max="30" step="1" value="-1">
                    </div>
                    <div class="form-group">
                        <label for="killsVAIDED">Kills (VAIDED) <span id="killsVAIDEDValue" class="slider-value">N/A</span></label>
                        <input type="range" id="killsVAIDED" class="slider" min="-1" max="30" step="1" value="-1">
                    </div>
                    <div class="form-group">
                        <label for="killsMOWGLI">Kills (MOWGLI) <span id="killsMOWGLIValue" class="slider-value">N/A</span></label>
                        <input type="range" id="killsMOWGLI" class="slider" min="-1" max="30" step="1" value="-1">
                    </div>
                    <div class="form-group">
                        <label for="highlightVideo">Highlight Video</label>
                        <input type="file" id="highlightVideo" accept="video/*">
                    </div>
                    ${match && match.highlightURL ? '<p>A highlight video is already uploaded. Uploading a new one will replace it.</p>' : ''}
                    <button type="submit" class="button">${action === 'addMatch' ? 'Add' : 'Update'} Match</button>
                </form>
            `;
            await loadGameModesAndMaps(); // Loads maps and modes
            document.getElementById('matchForm').addEventListener('submit', addMatch);
            document.getElementById('gameMode').addEventListener('change', updatePlacementInput);

            // Set up event listeners for sliders
            ['totalKills', 'killsSTARMAN', 'killsRSKILLA', 'killsSWFTSWORD', 'killsVAIDED', 'killsMOWGLI'].forEach(slider => {
                document.getElementById(slider).addEventListener('input', updateSliderValue);
            });

            if (action === 'editMatch' && match) {
        // Populate form with existing match data
        document.getElementById('gameMode').value = match.gameMode;
        document.getElementById('map').value = match.map;
        await updatePlacementInput(); // Wait for this to complete
        if (match.gameMode === 'Battle Royale') {
            document.getElementById('placement').value = match.placement;
            updatePlacementValue();
        } else {
            document.getElementById('placement').checked = match.placement === 'Won';
        }
        document.getElementById('totalKills').value = match.totalKills ?? -1;
        updateSliderValue({ target: document.getElementById('totalKills') });
        ['STARMAN', 'RSKILLA', 'SWFTSWORD', 'VAIDED', 'MOWGLI'].forEach(player => {
            const kills = match.kills?.[player] ?? -1;
            document.getElementById(`kills${player}`).value = kills;
            updateSliderValue({ target: document.getElementById(`kills${player}`) });
        });
    }
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
// New show modal for admin stuff. Was not sure to append the othe showmodal or make a new one
window.showModal = async function(action, id = null) {
  modalContent.innerHTML = '';
  switch(action) {
    // ... (existing cases)

    case 'addAchievement':
    case 'editAchievement':
      let achievement = {};
      if (action === 'editAchievement') {
        const snapshot = await get(ref(database, `achievements/${id}`));
        achievement = snapshot.val();
      }
      modalContent.innerHTML = `
        <h3>${action === 'addAchievement' ? 'Add' : 'Edit'} Achievement</h3>
        <form id="achievementForm" data-id="${id || ''}">
          <input type="text" id="title" value="${achievement.title || ''}" placeholder="Title" required>
          <textarea id="description" placeholder="Description" required>${achievement.description || ''}</textarea>
          <input type="number" id="ap" value="${achievement.ap || ''}" placeholder="Achievement Points" required>
          <select id="difficultyLevel" required>
            <option value="">Select Difficulty</option>
            <option value="Easy" ${achievement.difficultyLevel === 'Easy' ? 'selected' : ''}>Easy</option>
            <option value="Moderate" ${achievement.difficultyLevel === 'Moderate' ? 'selected' : ''}>Moderate</option>
            <option value="Hard" ${achievement.difficultyLevel === 'Hard' ? 'selected' : ''}>Hard</option>
            <option value="Extra Hard" ${achievement.difficultyLevel === 'Extra Hard' ? 'selected' : ''}>Extra Hard</option>
          </select>
          <input type="number" id="requiredCompletionCount" value="${achievement.requiredCompletionCount || ''}" placeholder="Required Completion Count" required>
          <label><input type="checkbox" id="repeatable" ${achievement.repeatable ? 'checked' : ''}> Repeatable</label>
          <select id="gameMode" required>
            <option value="">Select Game Mode</option>
            <!-- Add game mode options dynamically -->
          </select>
          <select id="specificMode" required>
            <option value="">Select Specific Mode</option>
            <!-- Add specific mode options dynamically -->
          </select>
          <select id="map" required>
            <option value="">Select Map</option>
            <!-- Add map options dynamically -->
          </select>
          <textarea id="logicCriteria" placeholder="Logic Criteria (JSON)">${achievement.logicCriteria || ''}</textarea>
          <label><input type="checkbox" id="locked" ${achievement.locked ? 'checked' : ''}> Locked</label>
          <input type="date" id="startDate" value="${achievement.startDate || ''}" placeholder="Start Date">
          <input type="date" id="endDate" value="${achievement.endDate || ''}" placeholder="End Date">
          <label><input type="checkbox" id="useHistoricalData" ${achievement.useHistoricalData ? 'checked' : ''}> Use Historical Data</label>
          <button type="submit">${action === 'addAchievement' ? 'Add' : 'Update'} Achievement</button>
        </form>
      `;
      document.getElementById('achievementForm').addEventListener('submit', addOrUpdateAchievement);
      break;

    case 'addChallenge':
    case 'editChallenge':
      let challenge = {};
      if (action === 'editChallenge') {
        const snapshot = await get(ref(database, `challenges/${id}`));
        challenge = snapshot.val();
      }
      modalContent.innerHTML = `
        <h3>${action === 'addChallenge' ? 'Add' : 'Edit'} Challenge</h3>
        <form id="challengeForm" data-id="${id || ''}">
          <input type="text" id="title" value="${challenge.title || ''}" placeholder="Title" required>
          <textarea id="description" placeholder="Description" required>${challenge.description || ''}</textarea>
          <input type="number" id="cp" value="${challenge.cp || ''}" placeholder="Challenge Points" required>
          <select id="difficultyLevel" required>
            <option value="">Select Difficulty</option>
            <option value="Easy" ${challenge.difficultyLevel === 'Easy' ? 'selected' : ''}>Easy</option>
            <option value="Moderate" ${challenge.difficultyLevel === 'Moderate' ? 'selected' : ''}>Moderate</option>
            <option value="Hard" ${challenge.difficultyLevel === 'Hard' ? 'selected' : ''}>Hard</option>
            <option value="Extra Hard" ${challenge.difficultyLevel === 'Extra Hard' ? 'selected' : ''}>Extra Hard</option>
          </select>
          <input type="number" id="requiredCompletionCount" value="${challenge.requiredCompletionCount || ''}" placeholder="Required Completion Count" required>
          <label><input type="checkbox" id="repeatable" ${challenge.repeatable ? 'checked' : ''}> Repeatable</label>
          <select id="gameMode" required>
            <option value="">Select Game Mode</option>
            <!-- Add game mode options dynamically -->
          </select>
          <select id="specificMode" required>
            <option value="">Select Specific Mode</option>
            <!-- Add specific mode options dynamically -->
          </select>
          <select id="map" required>
            <option value="">Select Map</option>
            <!-- Add map options dynamically -->
          </select>
          <textarea id="logicCriteria" placeholder="Logic Criteria (JSON)">${challenge.logicCriteria || ''}</textarea>
          <label><input type="checkbox" id="locked" ${challenge.locked ? 'checked' : ''}> Locked</label>
          <input type="date" id="startDate" value="${challenge.startDate || ''}" placeholder="Start Date">
          <input type="date" id="endDate" value="${challenge.endDate || ''}" placeholder="End Date">
          <label><input type="checkbox" id="useHistoricalData" ${challenge.useHistoricalData ? 'checked' : ''}> Use Historical Data</label>
          <input type="text" id="prizeDescription" value="${challenge.prizeDescription || ''}" placeholder="Prize Description">
          <select id="prizeSponsor" required>
            <option value="">Select Prize Sponsor</option>
            <!-- Add team members as options dynamically -->
          </select>
          <label><input type="checkbox" id="soloChallenge" ${challenge.soloChallenge ? 'checked' : ''}> Solo Challenge</label>
          <button type="submit">${action === 'addChallenge' ? 'Add' : 'Update'} Challenge</button>
        </form>
      `;
      document.getElementById('challengeForm').addEventListener('submit', addOrUpdateChallenge);
      break;
  }
  modal.style.display = "block";

  // Populate dynamic select options
  if (action.includes('Achievement') || action.includes('Challenge')) {
    populateGameModes();
    populateMaps();
    if (action.includes('Challenge')) {
      populateTeamMembers();
    }
  }
}

// Functions to update slider value labels
function updatePlacementValue() {
    const placement = document.getElementById('placement').value;
    const placementText = placement == 10 ? '10th+' : `${placement}${getOrdinalSuffix(placement)}`;
    document.getElementById('placementValue').textContent = placementText;
}

function getOrdinalSuffix(i) {
    var j = i % 10,
        k = i % 100;
    if (j == 1 && k != 11) {
        return "st";
    }
    if (j == 2 && k != 12) {
        return "nd";
    }
    if (j == 3 && k != 13) {
        return "rd";
    }
    return "th";
}
function updateSliderValue(event) {
    const slider = event.target;
    const valueSpan = document.getElementById(`${slider.id}Value`);
    const value = parseInt(slider.value);
    valueSpan.textContent = value === -1 ? 'N/A' : value;
}

function updateTeamStats() {
    get(ref(database, 'teamMembers')).then((snapshot) => {
        const teamMembers = snapshot.val();
        const leaderboardData = [];

        for (const [id, member] of Object.entries(teamMembers)) {
            leaderboardData.push({
                name: member.name,
                completedChallenges: member.completedChallenges || 0,
                inProgressChallenges: member.inProgressChallenges || 0,
                totalCP: member.totalCP || 0
            });
        }

        // Sort leaderboard by total CP
        leaderboardData.sort((a, b) => b.totalCP - a.totalCP);

        const leaderboardHTML = `
            <h3>Challenges Leaderboard</h3>
            <table class="stats-table">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Completed Challenges</th>
                        <th>In-Progress Challenges</th>
                        <th>Total CP</th>
                    </tr>
                </thead>
                <tbody>
                    ${leaderboardData.map(member => `
                        <tr>
                            <td>${member.name}</td>
                            <td>${member.completedChallenges}</td>
                            <td>${member.inProgressChallenges}</td>
                            <td>${member.totalCP}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        // Add this leaderboard to the existing stats page
        const statsContainer = document.getElementById('statsTable');
        statsContainer.insertAdjacentHTML('afterend', leaderboardHTML);
    });
}
// Add these helper functions to populate select options
function populateGameModes() {
  get(ref(database, 'gameModes')).then((snapshot) => {
    const gameModes = snapshot.val();
    const gameModeSelect = document.getElementById('gameMode');
    const specificModeSelect = document.getElementById('specificMode');

    for (const [id, mode] of Object.entries(gameModes)) {
      const option = document.createElement('option');
      option.value = mode.name;
      option.textContent = mode.name;
      gameModeSelect.appendChild(option);

      const specificOption = document.createElement('option');
      specificOption.value = mode.name;
      specificOption.textContent = mode.name;
      specificModeSelect.appendChild(specificOption);
    }
  });
}
function populateMaps() {
  get(ref(database, 'maps')).then((snapshot) => {
    const maps = snapshot.val();
    const mapSelect = document.getElementById('map');

    for (const [id, map] of Object.entries(maps)) {
      const option = document.createElement('option');
      option.value = map.name;
      option.textContent = map.name;
      mapSelect.appendChild(option);
    }
  });
}

function populateTeamMembers() {
  get(ref(database, 'teamMembers')).then((snapshot) => {
    const teamMembers = snapshot.val();
    const sponsorSelect = document.getElementById('prizeSponsor');

    for (const [id, member] of Object.entries(teamMembers)) {
      const option = document.createElement('option');
      option.value = member.name;
      option.textContent = member.name;
      sponsorSelect.appendChild(option);
    }
  });
}
window.onload = function() {
    modal.style.display = "none"; // Ensure modal is hidden on load
};
