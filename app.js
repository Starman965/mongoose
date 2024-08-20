import { ref, onValue, push, update, remove, get, set } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js";
import { database } from './firebaseConfig.js';
import { processMatchResult } from './awardsmanager.js';
import { getAchievementsUpdates } from './awardsmanager.js';

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
// Add the loadGameModesAndMaps function here
async function loadGameModesAndMaps() {
  const gameModeSelect = document.getElementById('gameMode');
  const mapSelect = document.getElementById('map');

  // Load game types and modes
  const gameTypesSnapshot = await get(ref(database, 'gameTypes'));
  gameModeSelect.innerHTML = '<option value="">Select Game Mode</option>';
  gameTypesSnapshot.forEach((typeSnapshot) => {
    const gameType = typeSnapshot.val();
    const optgroup = document.createElement('optgroup');
    optgroup.label = gameType.name;
    
    Object.entries(gameType.gameModes || {}).forEach(([modeId, mode]) => {
      const option = document.createElement('option');
      option.value = `${gameType.name}|${mode.name}`;
      option.textContent = mode.name;
      optgroup.appendChild(option);
    });
    
    gameModeSelect.appendChild(optgroup);
  });
function addOrUpdateGameType(e) {
  e.preventDefault();
  const form = e.target;
  const typeId = form.dataset.id || generateId(form.name.value);
  const name = form.name.value;

  const typeData = { 
    name,
    gameModes: {}  // Initialize empty gameModes object
  };

  set(ref(database, `gameTypes/${typeId}`), typeData)
    .then(() => {
      loadGameTypes();
      modal.style.display = "none";
    })
    .catch(error => {
      console.error("Error adding/updating game type: ", error);
      alert('Error adding/updating game type. Please try again.');
    });
}
  // Load maps
  const mapsSnapshot = await get(ref(database, 'maps'));
  mapSelect.innerHTML = '<option value="">Select Map</option>';
  mapsSnapshot.forEach((categorySnapshot) => {
    const category = categorySnapshot.key;
    const optgroup = document.createElement('optgroup');
    optgroup.label = category === 'battleRoyale' ? 'Battle Royale' : 'Multiplayer';
    
    Object.entries(categorySnapshot.val() || {}).forEach(([mapId, map]) => {
      const option = document.createElement('option');
      option.value = `${category}|${map.name}`;
      option.textContent = map.name;
      optgroup.appendChild(option);
    });
    
    mapSelect.appendChild(optgroup);
  });
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
    case 'stats':
      showStats();
      break;
    case 'sessions':
      showGameSessions();
      break;
    case 'achievements':
     showAchievements();    
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
  if (!achievement.isActive) return false;

  if (achievement.occursByDate && new Date(achievement.occursByDate) < new Date(matchData.timestamp)) return false;

  if (achievement.occursOnDOW && achievement.occursOnDOW.length > 0) {
    const matchDay = new Date(matchData.timestamp).getDay();
    if (!achievement.occursOnDOW.includes(matchDay)) return false;
  }

  if (achievement.gameTypeId !== 'Any' && achievement.gameTypeId !== matchData.gameTypeId) return false;
  if (achievement.gameModeId !== 'Any' && achievement.gameModeId !== matchData.gameModeId) return false;
  if (achievement.mapId !== 'Any' && achievement.mapId !== matchData.mapId) return false;

  if (achievement.placement !== 'Any') {
    if (matchData.gameType.toLowerCase() === 'multiplayer') {
      if (achievement.placement === 'Won' && matchData.placement !== 'Won') return false;
    } else {
      if (parseInt(achievement.placement) < matchData.placement) return false;
    }
  }

  if (!checkOperatorCondition(achievement.totalKillsOperator, achievement.totalKills, matchData.totalKills)) return false;

  for (const [member, killData] of Object.entries(achievement.teamMemberKills)) {
    if (!checkOperatorCondition(killData.operator, killData.value, matchData.kills[member] || 0)) return false;
  }

  return true;
}
function checkOperatorCondition(operator, achievementValue, matchValue) {
  switch (operator) {
    case '=': return achievementValue === matchValue;
    case '!=': return achievementValue !== matchValue;
    case '>=': return matchValue >= achievementValue;
    case '>': return matchValue > achievementValue;
    case '<': return matchValue < achievementValue;
    case '<=': return matchValue <= achievementValue;
    case 'is Odd': return matchValue % 2 !== 0;
    case 'is Even': return matchValue % 2 === 0;
    default: return false;
  }
}
// first filter
function filterAchievements(achievements, filterValue, gameTypeFilter) {
    const now = new Date();
    return achievements.filter(a => {
        if (gameTypeFilter !== 'Any' && a.gameType !== gameTypeFilter) return false;
        
        switch(filterValue) {
            case 'completed':
                return a.status === 'Completed';
            case 'inProgress':
                return a.status === 'In Progress';
            case 'notStarted':
                return a.status === 'Not Started';
            case 'completedWeek':
                return a.status === 'Completed' && a.lastCompletedAt && new Date(a.lastCompletedAt) > new Date(now - 7 * 24 * 60 * 60 * 1000);
            case 'completedMonth':
                return a.status === 'Completed' && a.lastCompletedAt && new Date(a.lastCompletedAt) > new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
            case 'completedYear':
                return a.status === 'Completed' && a.lastCompletedAt && new Date(a.lastCompletedAt) > new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
            default:
                return true;
        }
    });
}
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

  // Show achievements management by default
  showAchievementManagement();
}
function showGameTypesAdmin() {
  const adminContent = document.getElementById('adminContent');
  adminContent.innerHTML = `
    <h3>Game Types & Modes Management</h3>
    <div id="gameTypesList"></div>
  `;
  loadGameTypes();
}
function showMapsAdmin() {
  const adminContent = document.getElementById('adminContent');
  adminContent.innerHTML = `
    <h3>Maps Management</h3>
    <button class="button" onclick="showModal('addMap')">Add Map</button>
    <div id="mapsList"></div>
  `;
  loadMaps();
}

function showAchievementNotification(message) {
  const notification = document.createElement('div');
  notification.className = 'achievement-notification';
  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => notification.classList.add('show'), 10);
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
  }, 3000);
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
  get(ref(database, 'achievements')).then((snapshot) => {
    const achievements = snapshot.val();
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
  });
}

function loadAchievementsAdmin() {
    const achievementsList = document.getElementById('achievementsList');
    achievementsList.innerHTML = 'Loading achievements...';

    get(ref(database, 'achievements')).then((snapshot) => {
        const achievements = snapshot.val();
        let achievementsHtml = '<table class="admin-table">';
        achievementsHtml += '<tr><th>Title</th><th>Description</th><th>AP</th><th>Difficulty</th><th>Game Type</th><th>Game Mode</th><th>Map</th><th>Status</th><th>Actions</th></tr>';

        for (const [id, achievement] of Object.entries(achievements)) {
            achievementsHtml += `
                <tr>
                    <td>${achievement.title}</td>
                    <td>${achievement.description}</td>
                    <td>${achievement.ap}</td>
                    <td>${achievement.difficultyLevel}</td>
                    <td>${achievement.criteria.gameType}</td>
                    <td>${achievement.criteria.gameMode || 'Any'}</td>
                    <td>${achievement.criteria.map || 'Any'}</td>
                    <td>${achievement.status || 'Not Started'}</td>
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

// Load Function
function loadAchievements() {
  console.log("Starting to load achievements");
  const achievementsContainer = document.getElementById('achievementsContainer');
  const filterValue = document.getElementById('achievementFilter').value;
  const sortValue = document.getElementById('achievementSort').value;
  const gameTypeFilter = document.getElementById('achievementGameTypeFilter').value;
  
  console.log("Filter:", filterValue, "Sort:", sortValue, "Game Type:", gameTypeFilter);

  get(ref(database, 'achievements')).then((snapshot) => {
    console.log("Achievements data retrieved from database");
    let achievements = [];
    snapshot.forEach((childSnapshot) => {
      const achievement = childSnapshot.val();
      if (achievement && achievement.title) {  // Add a check for a required property
        achievements.push({id: childSnapshot.key, ...achievement});
      } else {
        console.warn("Invalid achievement found with key:", childSnapshot.key);
      }
    });
    
    console.log("Achievements array created:", achievements);

    if (achievements.length > 0) {
      achievements = filterAchievements(achievements, filterValue, gameTypeFilter);
      console.log("Achievements filtered:", achievements);

      achievements = sortAchievements(achievements, sortValue);
      console.log("Achievements sorted:", achievements);
    
      displayAchievements(achievements);
    } else {
      console.log("No valid achievements found");
      achievementsContainer.innerHTML = "No achievements found.";
    }
  }).catch((error) => {
    console.error("Error loading achievements:", error);
    achievementsContainer.innerHTML = "Error loading achievements. Please try again.";
  });
}
function sortAchievements(achievements, sortValue) {
  switch(sortValue) {
    case 'difficulty':
      return achievements.sort((a, b) => difficultyOrder.indexOf(a.difficulty) - difficultyOrder.indexOf(b.difficulty));
    case 'ap':
      return achievements.sort((a, b) => b.achievementPoints - a.achievementPoints);
    case 'progress':
      return achievements.sort((a, b) => (b.currentProgress / b.timesToComplete) - (a.currentProgress / a.timesToComplete));
    case 'completionDate':
      return achievements.sort((a, b) => {
        if (!a.lastCompletedAt) return 1;
        if (!b.lastCompletedAt) return -1;
        return new Date(b.lastCompletedAt) - new Date(a.lastCompletedAt);
      });
    default:
      return achievements;
  }
}

const difficultyOrder = ['Easy', 'Moderate', 'Hard', 'Extra Hard'];

function displayAchievements(achievements) {
  console.log("Displaying achievements:", achievements);
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
    } else {
      console.warn("Invalid achievement encountered in displayAchievements");
    }
  });
}

function createAchievementCard(achievement) {
  console.log("Creating card for achievement:", achievement);
  if (!achievement || !achievement.title) {
    console.warn("Attempt to create card for invalid achievement");
    return document.createElement('div'); // Return empty div to avoid errors
  }

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
// updated 8.19 with complete new function after restructure
function addOrUpdateAchievement(e) {
  e.preventDefault();
  const form = e.target;
  const achievementId = form.dataset.id || push(ref(database, 'achievements')).key;

  const achievementData = {
    id: achievementId,
    title: form.title.value,
    description: form.description.value,
    gameTypeId: form.gameType.value,
    gameModeId: form.gameMode.value,
    mapId: form.map.value,
    achievementPoints: parseInt(form.achievementPoints.value) || 0,
    placement: form.placement.value,
    totalKills: parseInt(form.totalKills.value) || 0,
    totalKillsOperator: form.totalKillsOperator.value,
    teamMemberKills: {},
    timesToComplete: parseInt(form.timesToComplete.value) || 1,
    difficulty: form.difficulty.value,
    isActive: form.isActive.checked,
    canCompleteMultipleTimes: form.canCompleteMultipleTimes.checked,
    occursOnDOW: Array.from(form.querySelectorAll('#occursOnDOW input:checked')).map(input => parseInt(input.value)),
    useHistoricalData: form.useHistoricalData.checked,
    status: form.dataset.id ? form.status.value : 'Not Started',
    currentProgress: form.dataset.id ? parseInt(form.currentProgress.value) || 0 : 0,
    completionCount: form.dataset.id ? parseInt(form.completionCount.value) || 0 : 0,
    createdAt: form.dataset.id ? form.createdAt.value : new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  ['STARMAN', 'RSKILLA', 'SWFTSWORD', 'VAIDED', 'MOWGLI'].forEach(player => {
    const kills = parseInt(form[`${player}Kills`].value);
    const operator = form[`${player}KillsOperator`].value;
    if (!isNaN(kills) && kills > 0) {
      achievementData.teamMemberKills[player] = { operator, value: kills };
    }
  });

  set(ref(database, `achievements/${achievementId}`), achievementData)
    .then(() => {
      loadAchievements();
      modal.style.display = "none";
    })
    .catch(error => {
      console.error("Error adding/updating achievement: ", error);
      alert('Error adding/updating achievement. Please try again.');
    });
}
function getPlayerKillsCriteria(form) {
    const playerKills = [];
    for (let i = 1; i <= 4; i++) {
        const kills = form[`playerKills${i}`].value;
        if (kills) {
            playerKills.push({ player: i, min: parseInt(kills) });
        }
    }
    return playerKills.length > 0 ? playerKills : null;
}
window.deleteAchievement = function(id) {
  if (confirm('Are you sure you want to delete this achievement?')) {
    remove(ref(database, `achievements/${id}`))
      .then(() => loadAchievementList())
      .catch(error => {
        console.error("Error deleting achievement: ", error);
        alert('Error deleting achievement. Please try again.');
      });
  }
}

function showStats() {
  mainContent.innerHTML = `
    <h2>Team Statistics</h2>
    <div id="statsTable"></div>
    <div id="achievementsTable"></div>
    <div id="prizePatrolTable"></div>
  `;
  loadStats();
  loadAchievementsStats();
  loadPrizePatrol();
}

function loadAchievementsStats() {
  const achievementsTable = document.getElementById('achievementsTable');
  get(ref(database, 'achievements')).then((snapshot) => {
    const achievements = snapshot.val();
    let completedCount = 0;
    let inProgressCount = 0;
    let totalPoints = 0;

    for (const achievement of Object.values(achievements)) {
      if (achievement.status === 'Completed') {
        completedCount++;
        totalPoints += achievement.achievementPoints;
      } else if (achievement.status === 'In Progress') {
        inProgressCount++;
      }
    }

    achievementsTable.innerHTML = `
      <h3>Achievements Overview</h3>
      <table class="stats-table">
        <tr>
          <th>Completed Achievements</th>
          <th>In-Progress Achievements</th>
          <th>Total Achievement Points</th>
        </tr>
        <tr>
          <td>${completedCount}</td>
          <td>${inProgressCount}</td>
          <td>${totalPoints}</td>
        </tr>
      </table>
    `;
  });
}

function loadPrizePatrol() {
  const prizePatrolTable = document.getElementById('prizePatrolTable');
  get(ref(database, 'achievements')).then((snapshot) => {
    const achievements = snapshot.val();
    let prizePatrolHtml = `
      <h3>Prize Patrol</h3>
      <table class="stats-table">
        <tr>
          <th>Achievement</th>
          <th>Award</th>
          <th>Sponsor</th>
          <th>Completed By</th>
          <th>Completion Date</th>
        </tr>
    `;

    for (const achievement of Object.values(achievements)) {
      if (achievement.status === 'Completed' && achievement.award) {
        prizePatrolHtml += `
          <tr>
            <td>${achievement.title}</td>
            <td>${achievement.award}</td>
            <td>${achievement.awardSponsor || 'N/A'}</td>
            <td>${achievement.completedBy || 'Team'}</td>
            <td>${new Date(achievement.completedAt).toLocaleDateString()}</td>
          </tr>
        `;
      }
    }

    prizePatrolHtml += '</table>';
    prizePatrolTable.innerHTML = prizePatrolHtml;
  });
}

function viewMatch(matchId) {
    // Implement this function to show match details
    console.log(`Viewing match: ${matchId}`);
    // You might want to open a modal or navigate to a match details page
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

// New Update 8.19
async function updatePlacementInput() {
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

  function showTeamMembersAdmin() {
  const adminContent = document.getElementById('adminContent');
  adminContent.innerHTML = `
    <h3>Team Members Management</h3>
    <button class="button" onclick="showModal('addTeamMember')">Add New Team Member</button>
    <div id="teamMembersList"></div>
  `;
  loadTeamMembers();
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
  const sessionId = form.dataset.id || push(ref(database, 'gameSessions')).key;
  
  const inputDate = new Date(form.date.value);
  const userTimezoneOffset = inputDate.getTimezoneOffset() * 60000;
  const adjustedDate = new Date(inputDate.getTime() - userTimezoneOffset);
  
  const sessionData = {
    date: adjustedDate.toISOString(),
    userTimezoneOffset: userTimezoneOffset,
    id: sessionId
  };
  
  set(ref(database, `gameSessions/${sessionId}`), sessionData)
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
// new function added 8.19 may replace other not sure
async function addOrUpdateMatch(e) {
  e.preventDefault();
  const form = e.target;
  const sessionId = form.dataset.sessionId;
  const matchId = form.dataset.matchId || push(ref(database, `gameSessions/${sessionId}/matches`)).key;
  
  const gameTypeId = form.gameType.value;
  const gameModeId = form.gameMode.value;
  const mapId = form.map.value;
  
  try {
    const [gameTypeSnapshot, gameModeSnapshot, mapSnapshot] = await Promise.all([
      get(ref(database, `gameTypes/${gameTypeId}`)),
      get(ref(database, `gameModes/${gameModeId}`)),
      get(ref(database, `maps/${mapId}`))
    ]);

    let placement;
    if (gameTypeSnapshot.val().name.toLowerCase() === 'warzone') {
      placement = parseInt(form.placement.value);
    } else {
      placement = form.placement.checked ? 'Won' : 'Lost';
    }

    const matchData = {
      id: matchId,
      gameTypeId: gameTypeId,
      gameType: gameTypeSnapshot.val().name,
      gameModeId: gameModeId,
      gameMode: gameModeSnapshot.val().name,
      mapId: mapId,
      map: mapSnapshot.val().name,
      placement: placement,
      totalKills: parseInt(form.totalKills.value) === -1 ? null : parseInt(form.totalKills.value),
      kills: {},
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

  } catch (error) {
    console.error("Error adding/updating match:", error);
    alert('Error adding/updating match. Please try again.');
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
  const typeId = form.gameTypeId.value;
  const modeId = form.dataset.modeId || generateId(form.name.value);
  const name = form.name.value;

  const modeData = { name };

  set(ref(database, `gameTypes/${typeId}/gameModes/${modeId}`), modeData)
    .then(() => {
      loadGameTypes();
      modal.style.display = "none";
    })
    .catch(error => {
      console.error("Error adding/updating game mode: ", error);
      alert('Error adding/updating game mode. Please try again.');
    });
}
function loadGameTypes() {
  const gameTypesList = document.getElementById('gameTypesList');
  gameTypesList.innerHTML = 'Loading game types...';
  
  onValue(ref(database, 'gameTypes'), (snapshot) => {
    const gameTypes = snapshot.val();
    let html = '';

    for (const [typeId, typeData] of Object.entries(gameTypes)) {
      html += `
        <div class="game-type">
          <h4>${typeData.name}</h4>
          <button class="button" onclick="showModal('addGameMode', '${typeId}')">Add Game Mode</button>
          <div class="game-modes-list">
      `;

      for (const [modeId, modeData] of Object.entries(typeData.gameModes || {})) {
        html += `
          <div class="game-mode">
            <span>${modeData.name}</span>
            <button class="button" onclick="showModal('editGameMode', '${typeId}', '${modeId}')">Edit</button>
            <button class="button" onclick="deleteGameMode('${typeId}', '${modeId}')">Delete</button>
          </div>
        `;
      }

      html += `
          </div>
        </div>
      `;
    }

    gameTypesList.innerHTML = html || 'No game types found. Add some!';
  });
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
  const mapsList = document.getElementById('mapsList');
  mapsList.innerHTML = 'Loading maps...';
  
  get(ref(database, 'maps')).then((snapshot) => {
    const maps = snapshot.val() || {};
    let html = '';

    for (const [typeId, typeMaps] of Object.entries(maps)) {
      html += `
        <div class="map-type">
          <h4>${typeId.charAt(0).toUpperCase() + typeId.slice(1)} Maps</h4>
          <div class="maps-list">
      `;

      for (const [mapId, mapData] of Object.entries(typeMaps)) {
        html += `
          <div class="map">
            <span>${mapData.name}</span>
            <button class="button" onclick="showModal('editMap', '${typeId}', '${mapId}')">Edit</button>
            <button class="button" onclick="deleteMap('${typeId}', '${mapId}')">Delete</button>
          </div>
        `;
      }

      html += `
          </div>
        </div>
      `;
    }

    mapsList.innerHTML = html || 'No maps found. Add some!';
  }).catch(error => {
    console.error("Error loading maps:", error);
    mapsList.innerHTML = 'Error loading maps. Please try again.';
  });
}

function addOrUpdateMap(e) {
  e.preventDefault();
  const form = e.target;
  const typeId = form.gameTypeId.value;
  const mapId = form.dataset.mapId || generateId(form.name.value);
  const name = form.name.value;

  const mapData = { name };

  set(ref(database, `maps/${typeId}/${mapId}`), mapData)
    .then(() => {
      loadMaps();
      modal.style.display = "none";
    })
    .catch(error => {
      console.error("Error adding/updating map: ", error);
      alert('Error adding/updating map. Please try again.');
    });
}
// Helper function to generate an ID from a name
function generateId(name) {
  return name.toLowerCase().replace(/\s+/g, '');
}
window.deleteMap = function(typeId, mapId) {
  // Check if IDs are provided
  if (!typeId || !mapId) {
    console.error('Type ID or Map ID is missing.');
    alert('Error: Unable to delete the map. Invalid map details.');
    return;
  }

  // Confirmation prompt
  if (confirm('Are you sure you want to delete this map? This action cannot be undone.')) {
    // Proceed with deletion
    remove(ref(database, `maps/${typeId}/${mapId}`))
      .then(() => {
        console.log(`Map with ID ${mapId} from type ${typeId} has been deleted successfully.`);
        alert('Map deleted successfully.');

        // Reload the maps to reflect the deletion
        loadMaps();
      })
      .catch((error) => {
        console.error('Error deleting map:', error);
        alert('Error deleting the map. Please try again.');
      });
  } else {
    console.log('Map deletion was cancelled.');
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
    const gameType = form.gameType.value;
    const gameMode = form.gameMode.value;
    console.log('Form data:', {
        sessionId,
        matchId,
        gameType,
        gameMode
    });
    try {
        let placement;
        if (gameType === 'warzone') {
            placement = parseInt(form.placement.value);
        } else if (gameType === 'multiplayer') {
            placement = form.placement.checked ? 'Won' : 'Lost';
        }
        console.log('Placement:', placement);
        const matchData = {
            gameType: gameType,
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

        // Process achievements
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

    // Display the notification
    modalContent.innerHTML = notificationContent;
    modal.style.display = "block";

    // Play the sound
    const audio = new Audio(soundToPlay);
    audio.play();
}
// new combined show modal
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
    document.getElementById('matchForm').addEventListener('submit', addMatch);
    document.getElementById('gameType').addEventListener('change', updateGameModeOptions);
    document.getElementById('gameType').addEventListener('change', updateMapOptions);
    document.getElementById('gameType').addEventListener('change', updatePlacementInput);

    ['totalKills', 'killsSTARMAN', 'killsRSKILLA', 'killsSWFTSWORD', 'killsVAIDED', 'killsMOWGLI'].forEach(slider => {
        document.getElementById(slider).addEventListener('input', updateSliderValue);
    });

    if (action === 'editMatch' && match) {
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
case 'addAchievement':
case 'editAchievement':
  const achievementSnapshot = await get(ref(database, `achievements/${id}`));
  achievement = achievementSnapshot.val() || {};
  modalContent.innerHTML = `
    <h3>${action === 'addAchievement' ? 'Add' : 'Edit'} Achievement</h3>
    <form id="achievementForm" data-id="${id}" class="achievement-form">
      <div class="form-group">
        <label for="title">Achievement Title (Required)</label>
        <input type="text" id="title" value="${achievement.title || ''}" required>
      </div>
      <div class="form-group">
        <label for="description">Description (Required)</label>
        <textarea id="description" required>${achievement.description || ''}</textarea>
      </div>
      <div class="form-group">
        <label for="gameMode">Game Type / Mode</label>
        <select id="gameMode" name="gameMode">
          <option value="Any|Any">Any</option>
          <!-- Other options will be populated dynamically -->
        </select>
      </div>
      <div class="form-group">
        <label for="map">Map</label>
        <select id="map" name="map">
          <option value="Any">Any</option>
          <!-- Other options will be populated dynamically -->
        </select>
      </div>
      <div class="form-group">
        <label for="placement">Placement</label>
        <select id="placement">
          <option value="Any" ${achievement.placement === 'Any' ? 'selected' : ''}>Any</option>
          <option value="Won" ${achievement.placement === 'Won' ? 'selected' : ''}>Won (MP Only)</option>
          <option value="1" ${achievement.placement === '1' ? 'selected' : ''}>1st</option>
          <option value="2" ${achievement.placement === '2' ? 'selected' : ''}>2nd</option>
          <option value="3" ${achievement.placement === '3' ? 'selected' : ''}>3rd</option>
          <option value="4" ${achievement.placement === '4' ? 'selected' : ''}>4th</option>
          <option value="5" ${achievement.placement === '5' ? 'selected' : ''}>5th</option>
          <option value="6" ${achievement.placement === '6' ? 'selected' : ''}>6th</option>
          <option value="7" ${achievement.placement === '7' ? 'selected' : ''}>7th</option>
          <option value="8" ${achievement.placement === '8' ? 'selected' : ''}>8th</option>
          <option value="9" ${achievement.placement === '9' ? 'selected' : ''}>9th</option>
          <option value="10th+" ${achievement.placement === '10th+' ? 'selected' : ''}>10th+</option>
        </select>
      </div>
      <div class="form-group">
        <label for="totalKills">Total Kills</label>
        <div class="input-group">
          <select id="totalKillsOperator">
            <option value="=" ${achievement.totalKillsOperator === '=' ? 'selected' : ''}>=</option>
            <option value=">=" ${achievement.totalKillsOperator === '>=' ? 'selected' : ''}>>=</option>
            <option value="<" ${achievement.totalKillsOperator === '<' ? 'selected' : ''}><</option>
            <option value=">" ${achievement.totalKillsOperator === '>' ? 'selected' : ''}>></option>
            <option value="is Odd" ${achievement.totalKillsOperator === 'is Odd' ? 'selected' : ''}>is Odd</option>
            <option value="is Even" ${achievement.totalKillsOperator === 'is Even' ? 'selected' : ''}>is Even</option>
          </select>
          <input type="number" id="totalKills" value="${achievement.totalKills || 0}" min="0">
        </div>
      </div>
      <div class="form-group">
        <label>Team Member Kills</label>
        <div id="teamMemberKills">
          ${['STARMAN', 'RSKILLA', 'SWFTSWORD', 'VAIDED', 'MOWGLI'].map(member => `
            <div class="input-group">
              <select id="${member}KillsOperator">
                <option value="=" ${achievement.teamMemberKills?.[member]?.operator === '=' ? 'selected' : ''}>=</option>
                <option value=">=" ${achievement.teamMemberKills?.[member]?.operator === '>=' ? 'selected' : ''}>>=</option>
                <option value="<" ${achievement.teamMemberKills?.[member]?.operator === '<' ? 'selected' : ''}><</option>
                <option value=">" ${achievement.teamMemberKills?.[member]?.operator === '>' ? 'selected' : ''}>></option>
                <option value="is Odd" ${achievement.teamMemberKills?.[member]?.operator === 'is Odd' ? 'selected' : ''}>is Odd</option>
                <option value="is Even" ${achievement.teamMemberKills?.[member]?.operator === 'is Even' ? 'selected' : ''}>is Even</option>
              </select>
              <input type="number" id="${member}Kills" value="${achievement.teamMemberKills?.[member]?.value || 0}" min="0">
              <label>${member}</label>
            </div>
          `).join('')}
        </div>
      </div>
      <div class="form-group">
        <label for="timesToComplete">Times to Complete</label>
        <input type="number" id="timesToComplete" value="${achievement.timesToComplete || 1}" min="1" required>
      </div>
      <div class="form-group">
        <label for="achievementPoints">Achievement Points</label>
        <input type="number" id="achievementPoints" value="${achievement.achievementPoints || 0}" min="0" required>
      </div>
      <div class="form-group">
        <label for="difficulty">Achievement Difficulty</label>
        <select id="difficulty" required>
          <option value="Easy" ${achievement.difficulty === 'Easy' ? 'selected' : ''}>Easy</option>
          <option value="Moderate" ${achievement.difficulty === 'Moderate' ? 'selected' : ''}>Moderate</option>
          <option value="Hard" ${achievement.difficulty === 'Hard' ? 'selected' : ''}>Hard</option>
          <option value="Extra Hard" ${achievement.difficulty === 'Extra Hard' ? 'selected' : ''}>Extra Hard</option>
        </select>
      </div>
      <div class="form-group">
        <label for="occursByDate">Occurs by Date</label>
        <input type="date" id="occursByDate" value="${achievement.occursByDate || ''}">
      </div>
      <div class="form-group">
        <label>Occurs on Day of Week</label>
        <div id="occursOnDOW" class="checkbox-group">
          ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, index) => `
            <label><input type="checkbox" value="${index}" ${achievement.occursOnDOW && achievement.occursOnDOW.includes(index) ? 'checked' : ''}> ${day}</label>
          `).join('')}
        </div>
      </div>
      <div class="form-group">
        <label for="canCompleteMultipleTimes">Can Complete More Than Once</label>
        <input type="checkbox" id="canCompleteMultipleTimes" ${achievement.canCompleteMultipleTimes ? 'checked' : ''}>
      </div>
      <div class="form-group">
        <label for="award">Award</label>
        <input type="text" id="award" value="${achievement.award || ''}" placeholder="Award Description">
      </div>
      <div class="form-group">
        <label for="awardSponsor">Award Sponsor</label>
        <input type="text" id="awardSponsor" value="${achievement.awardSponsor || ''}" placeholder="Award Sponsor">
      </div>
      <div class="form-group">
        <label>Awarded To</label>
        <div class="radio-group">
          <label><input type="radio" name="awardedTo" value="Team" ${achievement.awardedTo === 'Team' ? 'checked' : ''} required> Team</label>
          <label><input type="radio" name="awardedTo" value="Player" ${achievement.awardedTo === 'Player' ? 'checked' : ''} required> Player</label>
        </div>
      </div>
      <div class="form-group">
        <label for="useHistoricalData">Use Historical Data</label>
        <input type="checkbox" id="useHistoricalData" ${achievement.useHistoricalData ? 'checked' : ''}>
      </div>
      <div class="form-group">
        <label for="isActive">Activate Achievement</label>
        <input type="checkbox" id="isActive" ${achievement.isActive !== false ? 'checked' : ''}>
      </div>
      
      <!-- New fields for image handling -->
      <div class="form-group">
        <label for="useDefaultImage">Use Default Badge</label>
        <input type="checkbox" id="useDefaultImage" ${!achievement.customImageUrl ? 'checked' : ''}>
      </div>
      <div class="form-group" id="customImageUpload" style="${achievement.customImageUrl ? '' : 'display: none;'}">
        <label for="customImage">Upload Custom Badge</label>
        <input type="file" id="customImage" accept="image/*">
      </div>
      <div class="form-group">
        <label>Achievement Badge</label>
        <img id="achievementBadgePreview" src="${achievement.customImageUrl || 'https://mongoose.mycodsquad.com/achievementbadgedefault.png'}" alt="Achievement Badge" style="width: 200px; height: 200px;">
      </div>
      <div class="form-group">
        <a href="https://chatgpt.com/g/g-2MhMzdTAe-mycodsquad-com-achievement-badge-maker" target="_blank">Achievement Image Creator</a>
      </div>
      
      <button type="submit" class="submit-btn">Update Achievement</button>
    </form>
  `;
  
  document.getElementById('achievementForm').addEventListener('submit', addOrUpdateAchievement);
  document.getElementById('gameMode').addEventListener('change', updateGameModeAndMapOptions);
  
  // Handle image preview and upload logic
  const useDefaultImageCheckbox = document.getElementById('useDefaultImage');
  const customImageUpload = document.getElementById('customImageUpload');
  const customImageInput = document.getElementById('customImage');
  const badgePreview = document.getElementById('achievementBadgePreview');
  
  useDefaultImageCheckbox.addEventListener('change', (e) => {
    customImageUpload.style.display = e.target.checked ? 'none' : 'block';
    badgePreview.src = e.target.checked ? 'https://mongoose.mycodsquad.com/achievementbadgedefault.png' : (achievement.customImageUrl || 'https://mongoose.mycodsquad.com/achievementbadgedefault.png');
  });
  
  customImageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        badgePreview.src = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  });

  // Populate game modes and maps
  setTimeout(() => {
    console.log("Calling populateGameModes and populateMaps");
    populateGameModes();
    populateMaps();
    updateGameModeAndMapOptions();
  }, 0);
  break;
        case 'addGameType':
        case 'editGameType':
            let gameType = {};
            if (action === 'editGameType') {
                const gameTypeSnapshot = await get(ref(database, `gameTypes/${id}`));
                gameType = gameTypeSnapshot.val();
            }
            modalContent.innerHTML = `
                <h3>${action === 'addGameType' ? 'Add' : 'Edit'} Game Type</h3>
                <form id="gameTypeForm" data-id="${id || ''}">
                    <input type="text" id="name" value="${gameType.name || ''}" placeholder="Game Type Name" required>
                    <button type="submit">${action === 'addGameType' ? 'Add' : 'Update'} Game Type</button>
                </form>
            `;
            document.getElementById('gameTypeForm').addEventListener('submit', addOrUpdateGameType);
            break;

        case 'addGameMode':
        case 'editGameMode':
            let gameMode = {};
            if (action === 'editGameMode') {
                const gameModeSnapshot = await get(ref(database, `gameTypes/${id}/gameModes/${subId}`));
                gameMode = gameModeSnapshot.val();
            }
            modalContent.innerHTML = `
                <h3>${action === 'addGameMode' ? 'Add' : 'Edit'} Game Mode</h3>
                <form id="gameModeForm" data-type-id="${id}" data-mode-id="${subId || ''}">
                    <input type="text" id="name" value="${gameMode.name || ''}" placeholder="Game Mode Name" required>
                    <button type="submit">${action === 'addGameMode' ? 'Add' : 'Update'} Game Mode</button>
                </form>
            `;
            document.getElementById('gameModeForm').addEventListener('submit', addOrUpdateGameMode);
            break;

       case 'addMap':
case 'editMap':
    let map = {};
    if (action === 'editMap') {
        const mapSnapshot = await get(ref(database, `maps/${id}/${subId}`));
        map = mapSnapshot.val() || {};
    }
    modalContent.innerHTML = `
        <h3>${action === 'addMap' ? 'Add' : 'Edit'} Map</h3>
        <form id="mapForm" data-map-id="${subId || ''}">
            <select id="mapCategory" ${action === 'editMap' ? 'disabled' : ''} required>
                <option value="battleRoyale" ${id === 'battleRoyale' ? 'selected' : ''}>Battle Royale</option>
                <option value="multiplayer" ${id === 'multiplayer' ? 'selected' : ''}>Multiplayer</option>
            </select>
            <input type="text" id="name" value="${map.name || ''}" placeholder="Map Name" required>
            <button type="submit">${action === 'addMap' ? 'Add' : 'Update'} Map</button>
        </form>
    `;
    document.getElementById('mapForm').addEventListener('submit', addOrUpdateMap);
    break;

        default:
            console.error('Unknown modal action:', action);
            return;
    }

    modal.style.display = "block";

    // Populate dynamic select options for achievements
    if (action.includes('Achievement')) {
        populateGameModes();
        populateMaps();
    }
};

// this new function came from claud 8.19
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

// new function for game modes 8.19
async function updateGameModeOptions() {
    const gameType = document.getElementById('gameType').value;
    const gameModeSelect = document.getElementById('gameMode');
    gameModeSelect.innerHTML = '<option value="">Select Game Mode</option>';

    if (gameType) {
        const gameModes = await get(ref(database, `gameTypes/${gameType}/gameModes`));
        gameModes.forEach((modeSnapshot) => {
            const mode = modeSnapshot.val();
            const option = document.createElement('option');
            option.value = modeSnapshot.key;
            option.textContent = mode.name;
            gameModeSelect.appendChild(option);
        });
    }
}
// New Function for Map Options
async function updateMapOptions() {
    const gameType = document.getElementById('gameType').value;
    const mapSelect = document.getElementById('map');
    mapSelect.innerHTML = '<option value="">Select Map</option>';

    if (gameType) {
        const maps = await get(ref(database, `maps/${gameType}`));
        maps.forEach((mapSnapshot) => {
            const map = mapSnapshot.val();
            const option = document.createElement('option');
            option.value = mapSnapshot.key;
            option.textContent = map.name;
            mapSelect.appendChild(option);
        });
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
                completedAchievements: member.completedAchievements || 0,
                inProgressAchievements: member.inProgressAchievements || 0,
                totalAP: member.totalAP || 0
            });
        }

        // Sort leaderboard by total AP
        leaderboardData.sort((a, b) => b.totalAP - a.totalAP);

        const leaderboardHTML = `
            <h3>Achievements Leaderboard</h3>
            <table class="stats-table">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Completed Achievements</th>
                        <th>In-Progress Achievements</th>
                        <th>Total AP</th>
                    </tr>
                </thead>
                <tbody>
                    ${leaderboardData.map(member => `
                        <tr>
                            <td>${member.name}</td>
                            <td>${member.completedAchievements}</td>
                            <td>${member.inProgressAchievements}</td>
                            <td>${member.totalAP}</td>
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
// New Function 8.19 based on way achievement form game types, modes and maps 
function populateGameModes() {
  console.log("Populating game modes...");
  
  const gameModeSelect = document.getElementById('gameMode');
  
  if (!gameModeSelect) {
    console.error("Game mode select element not found");
    return;
  }
  
  // Clear existing options
  gameModeSelect.innerHTML = '<option value="Any|Any">Any</option>';
  
  get(ref(database, 'gameTypes')).then((snapshot) => {
    console.log("Game types data retrieved:", snapshot.val());
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
  }).catch(error => {
    console.error("Error fetching game types:", error);
  });
}
function populateMaps() {
  const mapSelect = document.getElementById('map');
  mapSelect.innerHTML = '<option value="Any">Any</option>';

  get(ref(database, 'maps')).then((snapshot) => {
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
  }).catch(error => {
    console.error("Error fetching maps:", error);
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
// initialize the sample set of achievements database updated 8.17
window.initializeSampleAchievements = function() {
  const sampleAchievements = [
    {
      title: "Hump Day Win",
      description: "Get a Win on a Wednesday",
      gameType: "Any",
      gameMode: "Any",
      map: "Any",
      placement: "1",
      totalKillsOperator: ">=",
      totalKills: 0,
      teamMemberKills: {},
      timesToComplete: 1,
      achievementPoints: 50,
      difficulty: "Easy",
      occursByDate: "",
      occursOnDOW: [3], // Wednesday
      canCompleteMultipleTimes: true,
      award: "Hump Day Hero Trophy",
      awardSponsor: "MyCODSquad",
      awardedTo: "Team",
      useHistoricalData: false,
      isActive: true,
      status: "Not Started",
      currentProgress: 0,
      completionCount: 0,
      completionHistory: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      customImageUrl: null // Use default image
    },
    {
      title: "Battle Royale Master",
      description: "Win a Battle Royale match",
      gameType: "warzone",
      gameMode: "Battle Royale",
      map: "Any",
      placement: "1",
      totalKillsOperator: ">=",
      totalKills: 0,
      teamMemberKills: {},
      timesToComplete: 1,
      achievementPoints: 500,
      difficulty: "Hard",
      occursByDate: "",
      occursOnDOW: [],
      canCompleteMultipleTimes: false,
      award: "Battle Royale Champion Belt",
      awardSponsor: "Warzone Legends",
      awardedTo: "Team",
      useHistoricalData: false,
      isActive: true,
      status: "Not Started",
      currentProgress: 0,
      completionCount: 0,
      completionHistory: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      customImageUrl: null // Use default image
    },
    {
      title: "Team Kill Streak",
      description: "Team gets 20 or more kills in a single match",
      gameType: "Any",
      gameMode: "Any",
      map: "Any",
      placement: "Any",
      totalKillsOperator: ">=",
      totalKills: 20,
      teamMemberKills: {},
      timesToComplete: 1,
      achievementPoints: 100,
      difficulty: "Moderate",
      occursByDate: "",
      occursOnDOW: [],
      canCompleteMultipleTimes: true,
      award: "Kill Streak Medal",
      awardSponsor: "Sharpshooter Inc.",
      awardedTo: "Team",
      useHistoricalData: false,
      isActive: true,
      status: "Not Started",
      currentProgress: 0,
      completionCount: 0,
      completionHistory: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      customImageUrl: null // Use default image
    },
    {
      title: "STARMAN's Rampage",
      description: "STARMAN gets 10 or more kills in a single match",
      gameType: "Any",
      gameMode: "Any",
      map: "Any",
      placement: "Any",
      totalKillsOperator: ">=",
      totalKills: 0,
      teamMemberKills: {
        STARMAN: { operator: ">=", value: 10 }
      },
      timesToComplete: 1,
      achievementPoints: 200,
      difficulty: "Hard",
      occursByDate: "",
      occursOnDOW: [],
      canCompleteMultipleTimes: true,
      award: "STARMAN's MVP Trophy",
      awardSponsor: "Cosmic Gaming",
      awardedTo: "Player",
      useHistoricalData: false,
      isActive: true,
      status: "Not Started",
      currentProgress: 0,
      completionCount: 0,
      completionHistory: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      customImageUrl: null // Use default image
    }
  ];

  console.log("Starting to initialize sample achievements");

  sampleAchievements.forEach(achievement => {
    push(ref(database, 'achievements'), achievement)
      .then(() => console.log(`Added sample achievement: ${achievement.title}`))
      .catch(error => console.error(`Error adding sample achievement ${achievement.title}:`, error));
  });

  console.log("Sample achievements have been added for testing.");
  alert("Sample achievements have been added successfully!");
}

window.mergeAndUpdateDatabase = async function() {
  try {
    // Fetch existing data
    const snapshot = await get(ref(database));
    const existingData = snapshot.val();

    // New structure to merge
    const newStructure = {
      gameTypes: {
        warzone: {
          name: "Warzone",
          gameModes: {
            battleRoyale: { name: "Battle Royale" },
            resurgence: { name: "Resurgence" }
          }
        },
        multiplayer: {
          name: "Multiplayer",
          gameModes: {
            teamDeathmatch: { name: "Team Deathmatch" },
            domination: { name: "Domination" }
          }
        }
      },
      maps: {
        warzone: {
          rebirthIsland: { name: "Rebirth Island" },
          urzikstan: { name: "Urzikstan" },
          superstore: { name: "Superstore" }
        },
        multiplayer: {
          rust: { name: "Rust" }
        }
      }
    };

    // Merge gameTypes
    if (!existingData.gameTypes) existingData.gameTypes = {};
    for (const [typeKey, typeValue] of Object.entries(newStructure.gameTypes)) {
      if (!existingData.gameTypes[typeKey]) {
        existingData.gameTypes[typeKey] = typeValue;
      } else {
        // Merge gameModes
        if (!existingData.gameTypes[typeKey].gameModes) existingData.gameTypes[typeKey].gameModes = {};
        for (const [modeKey, modeValue] of Object.entries(typeValue.gameModes)) {
          if (!existingData.gameTypes[typeKey].gameModes[modeKey]) {
            existingData.gameTypes[typeKey].gameModes[modeKey] = modeValue;
          }
        }
      }
    }

    // Merge maps
    if (!existingData.maps) existingData.maps = {};
    for (const [typeKey, typeValue] of Object.entries(newStructure.maps)) {
      if (!existingData.maps[typeKey]) existingData.maps[typeKey] = {};
      for (const [mapKey, mapValue] of Object.entries(typeValue)) {
        if (!existingData.maps[typeKey][mapKey]) {
          existingData.maps[typeKey][mapKey] = mapValue;
        }
      }
    }

    // Update the database with merged data
    await set(ref(database), existingData);
    console.log("Database updated successfully with merged data");
    alert("Database structure updated while preserving existing data");
  } catch (error) {
    console.error("Error updating database:", error);
    alert("Error updating database. Check console for details.");
  }
};
