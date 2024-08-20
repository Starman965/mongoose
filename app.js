import { ref, onValue, push, update, remove, get, set } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js";
import { database } from './firebaseConfig.js';
import { 
  processMatchResult, 
  getAchievementsUpdates, 
  addOrUpdateAchievement, 
  deleteAchievement, 
  getAchievements, 
  filterAchievements, 
  sortAchievements,
  generateSampleAchievements 
} from './awardsmanager.js';

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
document.getElementById('achievementsNav').addEventListener('click', () => showSection('achievements'));
document.getElementById('highlightsNav').addEventListener('click', () => showSection('highlights'));
document.getElementById('teamNav').addEventListener('click', () => showSection('team'));
document.getElementById('adminNav').addEventListener('click', () => showAdminSection());
document.getElementById('helpNav').addEventListener('click', () => showHelp());
document.getElementById('aboutNav').addEventListener('click', () => showAbout());

function showSection(section) {
  switch(section) {
    case 'stats': showStats(); break;
    case 'sessions': showGameSessions(); break;
    case 'achievements': showAchievements(); break;
    case 'highlights': showHighlights(); break;
    case 'team': showTeamMembers(); break;
  }
}

// Admin section
function showAdminSection() {
  mainContent.innerHTML = `
    <h2>Admin</h2>
    <div class="admin-actions">
      <button class="button" onclick="initializeSampleAchievements()">Initialize Sample Achievements</button>
      <button class="button" onclick="mergeAndUpdateDatabase()">Initialize Game Modes and Maps</button>
    </div>
    <div class="admin-tabs">
      <button id="achievementsAdminBtn" class="admin-tab">Achievements</button>
      <button id="gameTypesAdminBtn" class="admin-tab">Game Types & Modes</button>
      <button id="mapsAdminBtn" class="admin-tab">Maps</button>
      <button id="teamMembersAdminBtn" class="admin-tab">Team Members</button>
    </div>
    <div id="adminContent"></div>
  `;
  
  document.getElementById('achievementsAdminBtn').addEventListener('click', showAchievementManagement);
  document.getElementById('gameTypesAdminBtn').addEventListener('click', showGameTypesAdmin);
  document.getElementById('mapsAdminBtn').addEventListener('click', showMapsAdmin);
  document.getElementById('teamMembersAdminBtn').addEventListener('click', showTeamMembersAdmin);

  showAchievementManagement(); // Show achievements management by default
}

function showAchievementManagement() {
  const adminContent = document.getElementById('adminContent');
  adminContent.innerHTML = `
    <h3>Achievement Management</h3>
    <button class="button" onclick="showModal('addAchievement')">Add New Achievement</button>
    <div id="achievementList"></div>
  `;
  loadAchievementList();
}

function loadAchievementList() {
  const achievementList = document.getElementById('achievementList');
  getAchievements().then((achievements) => {
    let achievementHtml = '<table class="admin-table">';
    achievementHtml += '<tr><th>Title</th><th>Description</th><th>Points</th><th>Difficulty</th><th>Status</th><th>Actions</th></tr>';

    for (const [id, achievement] of Object.entries(achievements)) {
      achievementHtml += `
        <tr>
          <td>${achievement.title}</td>
          <td>${achievement.description}</td>
          <td>${achievement.achievementPoints}</td>
          <td>${achievement.difficulty}</td>
          <td>${achievement.status}</td>
          <td>
            <button class="button" onclick="showModal('editAchievement', '${id}')">Edit</button>
            <button class="button" onclick="deleteAchievement('${id}')">Delete</button>
          </td>
        </tr>
      `;
    }

    achievementHtml += '</table>';
    achievementList.innerHTML = achievementHtml;
  }).catch(error => {
    console.error("Error loading achievements:", error);
    achievementList.innerHTML = "Error loading achievements. Please try again.";
  });
}

// Achievements section
function showAchievements() {
  mainContent.innerHTML = `
    <h2>Achievements</h2>
    <div class="filter-sort-container">
      <select id="achievementFilter">
        <option value="all">Show All</option>
        <option value="completed">Completed</option>
        <option value="inProgress">In Progress</option>
        <option value="notStarted">Not Started</option>
        <option value="completedWeek">Completed This Week</option>
        <option value="completedMonth">Completed This Month</option>
        <option value="completedYear">Completed This Year</option>
      </select>
      <select id="achievementSort">
        <option value="difficulty">Sort by Difficulty</option>
        <option value="ap">Sort by Achievement Points</option>
        <option value="progress">Sort by Progress</option>
        <option value="completionDate">Sort by Completion Date</option>
      </select>
      <select id="achievementGameTypeFilter">
        <option value="Any">Any Game Type</option>
        <option value="Warzone">Warzone</option>
        <option value="Multiplayer">Multiplayer</option>
      </select>
    </div>
    <div id="achievementsContainer" class="awards-grid"></div>
  `;
  loadAchievements();
  
  // Add event listeners for filter and sort
  document.getElementById('achievementFilter').addEventListener('change', loadAchievements);
  document.getElementById('achievementSort').addEventListener('change', loadAchievements);
  document.getElementById('achievementGameTypeFilter').addEventListener('change', loadAchievements);
}

function loadAchievements() {
  const achievementsContainer = document.getElementById('achievementsContainer');
  const filterValue = document.getElementById('achievementFilter').value;
  const sortValue = document.getElementById('achievementSort').value;
  const gameTypeFilter = document.getElementById('achievementGameTypeFilter').value;
  
  getAchievements().then((achievements) => {
    let achievementsArray = Object.entries(achievements).map(([id, achievement]) => ({id, ...achievement}));
    
    achievementsArray = filterAchievements(achievementsArray, filterValue, gameTypeFilter);
    achievementsArray = sortAchievements(achievementsArray, sortValue);
    
    displayAchievements(achievementsArray);
  }).catch((error) => {
    console.error("Error loading achievements:", error);
    achievementsContainer.innerHTML = "Error loading achievements. Please try again.";
  });
}

function displayAchievements(achievements) {
  const container = document.getElementById('achievementsContainer');
  container.innerHTML = '';

  if (achievements.length === 0) {
    container.innerHTML = 'No achievements found.';
    return;
  }

  achievements.forEach(achievement => {
    if (achievement && achievement.title) {
      const card = createAchievementCard(achievement);
      container.appendChild(card);
    }
  });
}

function createAchievementCard(achievement) {
  const card = document.createElement('div');
  card.className = 'card achievement-card';
  
  let imageUrl = achievement.customImageUrl || 'https://mongoose.mycodsquad.com/achievementbadgedefault.png';
  
  card.innerHTML = `
    <img src="${imageUrl}" alt="${achievement.title}" onerror="this.src='https://mongoose.mycodsquad.com/achievementbadgedefault.png';">
    <h3>${achievement.title}</h3>
    <p>${achievement.description || 'No description available'}</p>
    <p>Points: ${achievement.achievementPoints || 0}</p>
    <p>Difficulty: ${achievement.difficulty || 'Not specified'}</p>
    <p>Status: ${achievement.status || 'Not started'}</p>
    <p>Times Completed: ${achievement.completionCount || 0}</p>
    ${achievement.canCompleteMultipleTimes ? `<p>Progress: ${achievement.currentProgress || 0}/${achievement.timesToComplete || 1}</p>` : ''}
    ${achievement.lastCompletedAt ? `<p>Last Completed: ${new Date(achievement.lastCompletedAt).toLocaleDateString()}</p>` : ''}
  `;

  return card;
}

// Game Sessions section
function showGameSessions() {
  mainContent.innerHTML = `
    <h2>Game Sessions</h2>
    <button class="button" onclick="showModal('addGameSession')">Add Game Session</button>
    <div id="sessionList"></div>
  `;
  loadGameSessions();
  calculatePRValues();
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

async function addOrUpdateMatch(e) {
  e.preventDefault();
  const form = e.target;
  const sessionId = form.dataset.sessionId;
  const matchId = form.dataset.matchId || push(ref(database, `gameSessions/${sessionId}/matches`)).key;
  
  const gameType = form.gameType.value;
  const gameMode = form.gameMode.value;
  const map = form.map.value;
  
  try {
    const placement = gameType === 'warzone' ? parseInt(form.placement.value) : (form.placement.checked ? 'Won' : 'Lost');
    
    const matchData = {
      id: matchId,
      gameType: gameType,
      gameMode: gameMode,
      map: map,
      placement: placement,
      totalKills: parseInt(form.totalKills.value) === -1 ? null : parseInt(form.totalKills.value), kills: {},
      timestamp: Date.now()
    };

    ['STARMAN', 'RSKILLA', 'SWFTSWORD', 'VAIDED', 'MOWGLI'].forEach(player => {
      const kills = parseInt(form[`kills${player}`].value);
      if (kills !== -1) {
        matchData.kills[player] = kills;
      }
    });

    const highlightVideo = form.highlightVideo.files[0];
    if (highlightVideo) {
      const videoRef = storageRef(storage, `highlights/${sessionId}/${Date.now()}_${highlightVideo.name}`);
      const snapshot = await uploadBytes(videoRef, highlightVideo);
      const url = await getDownloadURL(snapshot.ref);
      matchData.highlightURL = url;
    }

    await set(ref(database, `gameSessions/${sessionId}/matches/${matchId}`), matchData);
    
    // Process achievements
    await processMatchResult(matchData);

    loadMatches(sessionId);
    modal.style.display = "none";

    // Show notification
    showNotification(matchData);

  } catch (error) {
    console.error("Error adding/updating match:", error);
    alert('Error adding/updating match. Please try again.');
  }
}
function showNotification(matchData) {
    const achievementsUpdates = getAchievementsUpdates();

    let notificationContent = '';
    let soundToPlay = '';

    if (achievementsUpdates.length > 0) {
        notificationContent += `<h3>Updates</h3>`;
        notificationContent += `<h4>Achievements</h4>`;
        notificationContent += `<p>${achievementsUpdates.length} achievement(s) updated</p>`;
        notificationContent += achievementsUpdates.map(update => `<p>${update}</p>`).join('');
        soundToPlay = 'achievementsound2.mp3';
    } else {
        notificationContent = '<p>No new achievements updated this match.</p>';
        soundToPlay = 'achievementsound1.mp3';
    }

    modalContent.innerHTML = notificationContent;
    modal.style.display = "block";

    const audio = new Audio(soundToPlay);
    audio.play();
}

// Team Members section
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

  return operation;
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

// Utility functions
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

function formatDate(dateString, userTimezoneOffset) {
    const date = new Date(dateString);
    
    if (userTimezoneOffset !== undefined) {
        date.setTime(date.getTime() + userTimezoneOffset);
    }
    
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString(undefined, options);
}

// Modal handling
window.showModal = async function(action, id = null, subId = null) {
    modalContent.innerHTML = '';
    let achievement = {};
    let match = null;

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
            const memberSnapshot = await get(ref(database, `teamMembers/${id}`));
            if (memberSnapshot.exists()) {
                const member = memberSnapshot.val();
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
            const sessionSnapshot = await get(ref(database, `gameSessions/${id}`));
            if (sessionSnapshot.exists()) {
                const session = sessionSnapshot.val();
                const sessionDate = new Date(session.date);
                
                if (session.userTimezoneOffset !== undefined) {
                    sessionDate.setTime(sessionDate.getTime() - session.userTimezoneOffset);
                }
                
                const formattedDate = sessionDate.toISOString().split('T')[0];
                modalContent.innerHTML = `
                    <h3>Edit Game Session</h3>
                    <form id="gameSessionForm" data-id="${id}">
                        <input type="date" id="date" value="${formattedDate}" required>
                        <button type="submit">Update Game Session</button>
                    </form>
                `;
                document.getElementById('gameSessionForm').addEventListener('submit', addOrUpdateGameSession);
            }
            break;

        case 'addMatch':
        case 'editMatch':
            if (action === 'editMatch') {
                const matchSnapshot = await get(ref(database, `gameSessions/${id}/matches/${subId}`));
                match = matchSnapshot.val();
            }
            modalContent.innerHTML = `
                <h3>${action === 'addMatch' ? 'Add' : 'Edit'} Match</h3>
                <form id="matchForm" data-session-id="${id}" ${action === 'editMatch' ? `data-match-id="${subId}"` : ''} class="vertical-form">
                    <div class="form-group">
                        <label for="gameType">Game Type</label>
                        <select id="gameType" required>
                            <option value="">Select Game Type</option>
                            <option value="warzone">Warzone</option>
                            <option value="multiplayer">Multiplayer</option>
                        </select>
                    </div>
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
                    <div id="placementContainer" class="form-group">
                        <!-- Placement input will be dynamically added here -->
                    </div>
                    <div class="form-group">
                        <label for="totalKills">Total Kills <span id="totalKillsValue" class="slider-value">N/A</span></label>
                        <input type="range" id="totalKills" class="slider" min="-1" max="30" step="1" value="-1">
                    </div>
                    <!-- Repeat for each team member -->
                    <div class="form-group">
                        <label for="killsSTARMAN">Kills (STARMAN) <span id="killsSTARMANValue" class="slider-value">N/A</span></label>
                        <input type="range" id="killsSTARMAN" class="slider" min="-1" max="30" step="1" value="-1">
                    </div>
                    <!-- ... (repeat for other team members) -->
                    <div class="form-group">
                        <label for="highlightVideo">Highlight Video</label>
                        <input type="file" id="highlightVideo" accept="video/*">
                    </div>
                    ${match && match.highlightURL ? '<p>A highlight video is already uploaded. Uploading a new one will replace it.</p>' : ''}
                    <button type="submit" class="button">${action === 'addMatch' ? 'Add' : 'Update'} Match</button>
                </form>
            `;
            document.getElementById('matchForm').addEventListener('submit', addOrUpdateMatch);
            document.getElementById('gameType').addEventListener('change', updateGameModeOptions);
            document.getElementById('gameType').addEventListener('change', updateMapOptions);
            document.getElementById('gameType').addEventListener('change', updatePlacementInput);

            ['totalKills', 'killsSTARMAN', 'killsRSKILLA', 'killsSWFTSWORD', 'killsVAIDED', 'killsMOWGLI'].forEach(slider => {
                document.getElementById(slider).addEventListener('input', updateSliderValue);
            });

            if (action === 'editMatch' && match) {
                // Populate form with existing match data
                document.getElementById('gameType').value = match.gameType;
                await updateGameModeOptions();
                document.getElementById('gameMode').value = match.gameMode;
                await updateMapOptions();
                document.getElementById('map').value = match.map;
                await updatePlacementInput();
                if (match.gameType === 'warzone') {
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

        case 'addAchievement':
        case 'editAchievement':
            if (action === 'editAchievement') {
                const achievementSnapshot = await get(ref(database, `achievements/${id}`));
                achievement = achievementSnapshot.val() || {};
            }
            modalContent.innerHTML = `
                <h3>${action === 'addAchievement' ? 'Add' : 'Edit'} Achievement</h3>
                <form id="achievementForm" data-id="${id || ''}" class="achievement-form">
                    <!-- Achievement form fields -->
                    <!-- ... (include all necessary fields for the achievement) -->
                    <button type="submit" class="submit-btn">${action === 'addAchievement' ? 'Add' : 'Update'} Achievement</button>
                </form>
            `;
            document.getElementById('achievementForm').addEventListener('submit', addOrUpdateAchievement);
            document.getElementById('gameMode').addEventListener('change', updateGameModeAndMapOptions);
            
            // Populate game modes and maps
            setTimeout(() => {
                populateGameModes();
                populateMaps();
                updateGameModeAndMapOptions();
            }, 0);
            break;

        default:
            console.error('Unknown modal action:', action);
            return;
    }

    modal.style.display = "block";
};

// Helper functions for populating select options
// Populate Game Modes
async function populateGameModes() {
  console.log("Populating game modes...");
  
  const gameModeSelect = document.getElementById('gameMode');
  
  if (!gameModeSelect) {
    console.error("Game mode select element not found");
    return;
  }
  
  // Clear existing options
  gameModeSelect.innerHTML = '<option value="Any|Any">Any</option>';
  
  try {
    const snapshot = await get(ref(database, 'gameTypes'));
    const gameTypes = snapshot.val();
    
    if (!gameTypes) {
      console.warn("No game types found in the database");
      return;
    }
    
    for (const [typeId, typeData] of Object.entries(gameTypes)) {
      console.log(`Processing game type: ${typeId}`);
      
      // Add game type as an option
      const typeOption = document.createElement('option');
      typeOption.value = `${typeData.name}|Any`;
      typeOption.textContent = `${typeData.name} - Any`;
      gameModeSelect.appendChild(typeOption);
      
      if (typeData.gameModes) {
        for (const [modeId, mode] of Object.entries(typeData.gameModes)) {
          console.log(`Adding game mode: ${mode.name}`);
          
          const option = document.createElement('option');
          option.value = `${typeData.name}|${mode.name}`;
          option.textContent = `${typeData.name} - ${mode.name}`;
          gameModeSelect.appendChild(option);
        }
      } else {
        console.warn(`No game modes found for game type: ${typeId}`);
      }
    }
  } catch (error) {
    console.error("Error fetching game types:", error);
  }
}

async function populateMaps() {
  const mapSelect = document.getElementById('map');
  mapSelect.innerHTML = '<option value="Any">Any</option>';

  try {
    const snapshot = await get(ref(database, 'maps'));
    const maps = snapshot.val();
    console.log("Maps data retrieved:", maps);

    for (const [gameType, gameMaps] of Object.entries(maps)) {
      const optgroup = document.createElement('optgroup');
      optgroup.label = gameType.charAt(0).toUpperCase() + gameType.slice(1);
      
      for (const [mapId, map] of Object.entries(gameMaps)) {
        const option = document.createElement('option');
        option.value = `${gameType}|${map.name}`;
        option.textContent = map.name;
        optgroup.appendChild(option);
      }

      mapSelect.appendChild(optgroup);
    }
  } catch (error) {
    console.error("Error fetching maps:", error);
  }
}
// Initialize sample achievements
window.initializeSampleAchievements = function() {
  const sampleAchievements = generateSampleAchievements();

  console.log("Starting to initialize sample achievements");

  sampleAchievements.forEach(achievement => {
    push(ref(database, 'achievements'), achievement)
      .then(() => console.log(`Added sample achievement: ${achievement.title}`))
      .catch(error => console.error(`Error adding sample achievement ${achievement.title}:`, error));
  });

  console.log("Sample achievements have been added for testing.");
  alert("Sample achievements have been added successfully!");
}

// Database structure update
window.mergeAndUpdateDatabase = async function() {
  try {
    const snapshot = await get(ref(database));
    const existingData = snapshot.val();

    // ... (Merge logic for gameTypes and maps)

    await set(ref(database), existingData);
    console.log("Database updated successfully with merged data");
    alert("Database structure updated while preserving existing data");
  } catch (error) {
    console.error("Error updating database:", error);
    alert("Error updating database. Check console for details.");
  }
};

// Export necessary functions
export { 
  addOrUpdateAchievement, 
  handleMatchUpdate,
  showAchievementNotification
};
// stuff claude claims he left out
// Update Game Mode Options
async function updateGameModeOptions() {
    const gameType = document.getElementById('gameType').value;
    const gameModeSelect = document.getElementById('gameMode');
    gameModeSelect.innerHTML = '<option value="">Select Game Mode</option>';

    if (gameType) {
        try {
            const gameModes = await get(ref(database, `gameTypes/${gameType}/gameModes`));
            gameModes.forEach((modeSnapshot) => {
                const mode = modeSnapshot.val();
                const option = document.createElement('option');
                option.value = modeSnapshot.key;
                option.textContent = mode.name;
                gameModeSelect.appendChild(option);
            });
        } catch (error) {
            console.error("Error fetching game modes:", error);
        }
    }
}

// Update Map Options
async function updateMapOptions() {
    const gameType = document.getElementById('gameType').value;
    const mapSelect = document.getElementById('map');
    mapSelect.innerHTML = '<option value="">Select Map</option>';

    if (gameType) {
        try {
            const maps = await get(ref(database, `maps/${gameType}`));
            maps.forEach((mapSnapshot) => {
                const map = mapSnapshot.val();
                const option = document.createElement('option');
                option.value = mapSnapshot.key;
                option.textContent = map.name;
                mapSelect.appendChild(option);
            });
        } catch (error) {
            console.error("Error fetching maps:", error);
        }
    }
}

// Update Placement Input
function updatePlacementInput() {
    const gameType = document.getElementById('gameType').value;
    const placementContainer = document.getElementById('placementContainer');
    
    if (gameType === 'warzone') {
        placementContainer.innerHTML = `
            <label for="placement">Placement <span id="placementValue" class="slider-value">1st</span></label>
            <input type="range" id="placement" class="slider" min="1" max="10" step="1" value="1" required>
        `;
        document.getElementById('placement').addEventListener('input', updatePlacementValue);
    } else if (gameType === 'multiplayer') {
        placementContainer.innerHTML = `
            <label for="placement">Result</label>
            <div class="toggle-switch">
                <input type="checkbox" id="placement" name="placement" class="toggle-input">
                <label for="placement" class="toggle-label">
                    <span class="toggle-inner"></span>
                </label>
            </div>
        `;
        document.getElementById('placement').checked = false; // Default to 'Lost'
    }
}

// Update Placement Value (for Warzone)
function updatePlacementValue() {
    const placement = document.getElementById('placement').value;
    const placementText = placement == 10 ? '10th+' : `${placement}${getOrdinalSuffix(placement)}`;
    document.getElementById('placementValue').textContent = placementText;
}

// Get Ordinal Suffix
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

// Update Slider Value
function updateSliderValue(event) {
    const slider = event.target;
    const valueSpan = document.getElementById(`${slider.id}Value`);
    const value = parseInt(slider.value);
    valueSpan.textContent = value === -1 ? 'N/A' : value;
}

// Update Game Mode and Map Options (for Achievements)
async function updateGameModeAndMapOptions() {
  console.log("Updating game mode and map options...");
  const gameModeSelect = document.getElementById('gameMode');
  const mapSelect = document.getElementById('map');

  if (!gameModeSelect || !mapSelect) {
    console.error("Game mode or map select element not found");
    return;
  }

  const [selectedGameType, selectedGameMode] = gameModeSelect.value.split('|');
  console.log(`Selected: Game Type - ${selectedGameType}, Game Mode - ${selectedGameMode}`);

  // Clear existing map options and add 'Any' option
  mapSelect.innerHTML = '<option value="Any">Any</option>';

  if (selectedGameType !== 'Any') {
    try {
      // Fetch maps based on selected game type
      const mapsSnapshot = await get(ref(database, `maps/${selectedGameType.toLowerCase()}`));
      console.log("Maps data retrieved:", mapsSnapshot.val());
      if (mapsSnapshot.exists()) {
        mapsSnapshot.forEach((mapSnapshot) => {
          const map = mapSnapshot.val();
          const option = document.createElement('option');
          option.value = map.name;
          option.textContent = map.name;
          mapSelect.appendChild(option);
        });
      } else {
        console.warn(`No maps found for game type: ${selectedGameType}`);
      }
    } catch (error) {
      console.error("Error fetching maps:", error);
    }
  }

  // Set selected values if editing an achievement
  const achievementForm = document.getElementById('achievementForm');
  if (achievementForm) {
    const achievementId = achievementForm.dataset.id;
    if (achievementId) {
      try {
        const achievementSnapshot = await get(ref(database, `achievements/${achievementId}`));
        const achievement = achievementSnapshot.val();
        if (achievement) {
          mapSelect.value = achievement.map || 'Any';
        }
      } catch (error) {
        console.error("Error fetching achievement data:", error);
      }
    }
  }
}
