import { database } from './firebaseConfig.js';
import { ref, onValue, update, get, push } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js";

let achievementsUpdates = [];

// added new function 8.17
function addOrUpdateGameType(e) {
  e.preventDefault();
  const form = e.target;
  const typeId = form.dataset.id;
  const name = form.name.value;

  const typeData = { name };

  const operation = typeId
    ? update(ref(database, `gameTypes/${typeId}`), typeData)
    : push(ref(database, 'gameTypes'), typeData);

  operation
    .then(() => {
      loadGameTypes();
      modal.style.display = "none";
    })
    .catch(error => {
      console.error("Error adding/updating game type: ", error);
      alert('Error adding/updating game type. Please try again.');
    });
}

// First Display Achievements
function displayAchievements(achievements) {
  const container = document.getElementById('achievementsContainer');
  container.innerHTML = '';

  achievements.forEach(achievement => {
    const card = createAchievementCard(achievement);
    container.appendChild(card);
  });
}

function createAchievementCard(achievement) {
  const card = document.createElement('div');
  card.className = 'card achievement-card';
  
  card.innerHTML = `
    <img src="${achievement.imageUrl || 'path/to/default/achievement/image.png'}" alt="${achievement.title}">
    <h3>${achievement.title}</h3>
    <p>${achievement.description}</p>
    <p>Points: ${achievement.achievementPoints}</p>
    <p>Difficulty: ${achievement.difficulty}</p>
    <p>Status: ${achievement.status}</p>
    <p>Progress: ${achievement.currentProgress}/${achievement.timesToComplete}</p>
    ${achievement.award ? `<p>Award: ${achievement.award}</p>` : ''}
    ${achievement.awardSponsor ? `<p>Sponsor: ${achievement.awardSponsor}</p>` : ''}
  `;

  return card;
}

const difficultyOrder = ['Easy', 'Moderate', 'Hard', 'Extra Hard'];

export function getAchievementsUpdates() {
    const updates = achievementsUpdates;
    achievementsUpdates = [];  // Clear the updates
    return updates;
}

export async function processMatchResult(matchData) {
  const achievementsRef = ref(database, 'achievements');
  const achievementsSnapshot = await get(achievementsRef);

  const achievements = achievementsSnapshot.val();

  for (const [id, achievement] of Object.entries(achievements)) {
    if (checkAchievementCriteria(achievement, matchData)) {
      const update = await updateAchievement(id, achievement, matchData);
      if (update) {
        notifyAchievementUpdate(update);
      }
    }
  }
}

// Added 8.18
async function updateAchievement(id, achievement, matchData) {
  achievement.currentProgress++;
  let update = null;

  if (achievement.currentProgress >= achievement.timesToComplete) {
    achievement.status = 'Completed';
    achievement.completedAt = matchData.timestamp;
    update = `Achievement "${achievement.title}" completed!`;

    // Increment the completion count
    achievement.completionCount = (achievement.completionCount || 0) + 1;

    // Add to completion history
    if (!achievement.completionHistory) achievement.completionHistory = [];
    achievement.completionHistory.push({
      completedAt: matchData.timestamp,
      matchId: matchData.id // Assuming matchData has an id field
    });

    if (!achievement.canCompleteMultipleTimes) {
      achievement.isActive = false;
    } else {
      achievement.currentProgress = 0;
    }

    achievement.lastCompletedAt = matchData.timestamp;
  } else {
    achievement.status = 'In Progress';
    update = `Progress made on achievement "${achievement.title}"`;
  }

  achievement.lastProgressDate = matchData.timestamp;

  await update(ref(database, `achievements/${id}`), achievement);

  return update;
}
function notifyAchievementUpdate(update) {
  // Implement notification logic (e.g., show a toast message, update UI)
  console.log(update);
}

async function processAchievements(matchData) {
    const achievementsRef = ref(database, 'achievements');
    const achievementsSnapshot = await get(achievementsRef);
    const achievements = achievementsSnapshot.val();

    for (const [id, achievement] of Object.entries(achievements)) {
        if (checkAchievementCriteria(achievement, matchData)) {
            const update = await updateAchievement(id, achievement, matchData);
            if (update) {
                achievementsUpdates.push(update);
            }
        }
    }
}

function checkAchievementCriteria(achievement, matchData) {
  if (!achievement.isActive) return false;

  if (achievement.occursByDate && new Date(achievement.occursByDate) < new Date(matchData.timestamp)) return false;

  if (achievement.occursOnDOW && achievement.occursOnDOW.length > 0) {
    const matchDay = new Date(matchData.timestamp).getDay();
    if (!achievement.occursOnDOW.includes(matchDay)) return false;
  }

  if (!checkOperatorCondition(achievement.gameTypeOperator, achievement.gameType, matchData.gameType)) return false;
  if (!checkOperatorCondition(achievement.gameModeOperator, achievement.gameMode, matchData.gameMode)) return false;
  if (!checkOperatorCondition(achievement.mapOperator, achievement.map, matchData.map)) return false;

  if (achievement.placement !== 'Any') {
    if (matchData.gameType === 'Multiplayer') {
      if (achievement.placement === 'Won' && matchData.placement !== 'Won') return false;
    } else {
      if (parseInt(achievement.placement) < matchData.placement) return false;
    }
  }

  if (!checkOperatorCondition(achievement.totalKillsOperator, achievement.totalKills, matchData.totalKills)) return false;

  // Check team member kills
  for (const [member, killData] of Object.entries(achievement.teamMemberKills || {})) {
    if (!checkOperatorCondition(killData.operator, killData.value, matchData.kills[member])) return false;
  }

  return true;
}

function checkOperatorCondition(operator, achievementValue, matchValue) {
  switch (operator) {
    case '=': return achievementValue === matchValue;
    case '!=': return achievementValue !== matchValue;
    case 'IN': return achievementValue.includes(matchValue);
    case 'NOT IN': return !achievementValue.includes(matchValue);
    case '>=': return matchValue >= achievementValue;
    case '>': return matchValue > achievementValue;
    case '<': return matchValue < achievementValue;
    case '<=': return matchValue <= achievementValue;
    case 'is Odd': return matchValue % 2 !== 0;
    case 'is Even': return matchValue % 2 === 0;
    default: return false;
  }
}

function isWithinTimeFrame(dateRange, timestamp) {
    if (!dateRange) return true;
    const date = new Date(timestamp);
    if (dateRange.start && date < new Date(dateRange.start)) return false;
    if (dateRange.end && date > new Date(dateRange.end)) return false;
    return true;
}

// new function
function checkPlacement(placementCriteria, matchData) {
    if (!placementCriteria) return true;
    if (typeof placementCriteria === 'string') {
        // Multiplayer
        return matchData.placement === placementCriteria;
    } else {
        // Warzone
        return matchData.placement <= placementCriteria.max;
    }
}

// new function added 8.16
function checkPlayerKills(playerKillsCriteria, matchKills) {
    return playerKillsCriteria.every(criterion => {
        const playerKills = matchKills[`Player${criterion.player}`] || 0;
        return playerKills >= criterion.min;
    });
}

function evaluateCriterion(criterion, matchData) {
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
    case 'specificPlayerKills':
      return matchData.kills[criterion.player] >= criterion.value;
    case 'winStreak':
      // This would require checking previous matches, which we'll implement later
      return true;
    case 'dayOfWeek':
      const dayOfWeek = new Date(matchData.timestamp).getDay();
      return criterion.days.includes(dayOfWeek);
    default:
      console.warn(`Unknown criterion type: ${criterion.type}`);
      return false;
  }
}
