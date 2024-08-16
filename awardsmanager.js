// awardsmanager.js

import { database } from './firebaseConfig.js';
import { ref, onValue, update, get, push } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js";
let achievementsUpdates = [];
let challengesUpdates = [];
export function initAwards() {
  // Initialize any necessary data or listeners for awards
}
export { initializeSampleAwardsForTesting };

// updated 8.16
export function loadAchievements() {
    const achievementsContainer = document.getElementById('achievementsContainer');
    const filterValue = document.getElementById('achievementFilter').value;
    const sortValue = document.getElementById('achievementSort').value;
    const gameTypeFilter = document.getElementById('achievementGameTypeFilter').value;
    
    get(ref(database, 'achievements')).then((snapshot) => {
        let achievements = [];
        snapshot.forEach((childSnapshot) => {
            achievements.push({id: childSnapshot.key, ...childSnapshot.val()});
        });
        
        achievements = filterAchievements(achievements, filterValue, gameTypeFilter);
        achievements = sortAchievements(achievements, sortValue);
        
        displayAchievements(achievements);
    });
}
function filterAchievements(achievements, filterValue, gameTypeFilter) {
    const now = new Date();
    return achievements.filter(a => {
        if (gameTypeFilter !== 'Any' && a.criteria.gameType !== gameTypeFilter) return false;
        
        switch(filterValue) {
            case 'completedWeek':
                return a.status === 'Completed' && new Date(a.completionDate) > new Date(now - 7 * 24 * 60 * 60 * 1000);
            case 'completedMonth':
                return a.status === 'Completed' && new Date(a.completionDate) > new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
            case 'completedYear':
                return a.status === 'Completed' && new Date(a.completionDate) > new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
            case 'inProgress':
                return a.status === 'In Progress';
            default:
                return true;
        }
    });
}

function sortAchievements(achievements, sortValue) {
  switch(sortValue) {
    case 'difficulty':
      return achievements.sort((a, b) => difficultyOrder.indexOf(a.difficultyLevel) - difficultyOrder.indexOf(b.difficultyLevel));
    case 'ap':
      return achievements.sort((a, b) => b.ap - a.ap);
    case 'progress':
      return achievements.sort((a, b) => (b.currentCompletionCount / b.requiredCompletionCount) - (a.currentCompletionCount / a.requiredCompletionCount));
    case 'completionDate':
      return achievements.sort((a, b) => new Date(b.completionDate) - new Date(a.completionDate));
    default:
      return achievements;
  }
}

const difficultyOrder = ['Easy', 'Moderate', 'Hard', 'Extra Hard'];

// added 8.16
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
    
    let imageUrl = achievement.imageUrl || 'path/to/default/achievement/image.png';

    card.innerHTML = `
        <img src="${imageUrl}" alt="${achievement.title}" onerror="this.src='path/to/fallback/image.png';">
        <h3>${achievement.title}</h3>
        <p>${achievement.description}</p>
        <p>Difficulty: ${achievement.difficultyLevel}</p>
        <p>Achievement Points: ${achievement.ap}</p>
        <p>Game Type: ${achievement.criteria.gameType}</p>
        <p>Game Mode: ${achievement.criteria.gameMode || 'Any'}</p>
        <p>Map: ${achievement.criteria.map || 'Any'}</p>
        <p>Status: ${achievement.status}</p>
        ${achievement.completionDate ? `<p>Completed: ${new Date(achievement.completionDate).toLocaleDateString()}</p>` : ''}
    `;

    return card;
}

export function getAchievementsUpdates() {
    const updates = achievementsUpdates;
    achievementsUpdates = [];  // Clear the updates
    return updates;
}

export function getChallengesUpdates() {
    const updates = challengesUpdates;
    challengesUpdates = [];  // Clear the updates
    return updates;
}

export async function processMatchResult(matchData) {
  const achievementsRef = ref(database, 'achievements');
  // const challengesRef = ref(database, 'challenges');

  const [achievementsSnapshot, challengesSnapshot] = await Promise.all([
    get(achievementsRef),
    get(challengesRef)
  ]);

  const achievements = achievementsSnapshot.val();
  // const challenges = challengesSnapshot.val();

  for (const [id, achievement] of Object.entries(achievements)) {
    if (checkAchievementCriteria(achievement, matchData)) {
      const update = await updateAchievement(id, achievement, matchData);
      if (update) {
        achievementsUpdates.push(update);
      }
    }
  }
/*
  for (const [id, challenge] of Object.entries(challenges)) {
    if (checkChallengeCriteria(challenge, matchData)) {
      const update = await updateChallenge(id, challenge, matchData);
      if (update) {
        challengesUpdates.push(update);
      }
    }
  }
}
*/
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
    if (achievement.locked) return false;
    
    if (!isWithinTimeFrame(achievement.criteria.dateRange, matchData.timestamp)) return false;

    // Check game type
    if (achievement.criteria.gameType !== 'Any' && achievement.criteria.gameType !== matchData.gameType) return false;

    // Check game mode
    if (achievement.criteria.gameMode && achievement.criteria.gameMode !== matchData.gameMode) return false;

    // Check map
    if (achievement.criteria.map && achievement.criteria.map !== matchData.map) return false;

    // Check placement
    if (!checkPlacement(achievement.criteria.placement, matchData)) return false;

    // Check total kills
    if (achievement.criteria.totalKills && matchData.totalKills < achievement.criteria.totalKills.min) return false;

    // Check player kills
    if (achievement.criteria.playerKills && !checkPlayerKills(achievement.criteria.playerKills, matchData.kills)) return false;

    return true;
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

async function updateAchievement(id, achievement, matchData) {
  if (!achievement.useHistoricalData && achievement.creationDate > matchData.timestamp) {
    return null;
  }

  let update = null;
  if (checkAchievementCriteria(achievement, matchData)) {
    achievement.currentCompletionCount++;
    if (achievement.currentCompletionCount >= achievement.requiredCompletionCount) {
      achievement.status = 'Completed';
      if (!achievement.firstCompletionDate) {
        achievement.firstCompletionDate = matchData.timestamp;
      }
      update = `Achievement "${achievement.title}" completed!`;
    } else {
      achievement.status = 'In Progress';
      update = `Progress made on achievement "${achievement.title}"`;
    }

    if (!achievement.repeatable && achievement.status === 'Completed') {
      achievement.locked = true;
    }

    await update(ref(database, `achievements/${id}`), achievement);
  }

  return update;
}

async function processChallenges(matchData) {
    const challengesRef = ref(database, 'challenges');
    const challengesSnapshot = await get(challengesRef);
    const challenges = challengesSnapshot.val();

    for (const [id, challenge] of Object.entries(challenges)) {
        if (checkChallengeCriteria(challenge, matchData)) {
            const update = await updateChallenge(id, challenge, matchData);
            if (update) {
                challengesUpdates.push(update);
            }
        }
    }
}

// Add more helper functions as needed
function getPlayerNameFromMatchData(matchData) {
  // This function should return the name of the player who performed the action
  // You might need to adjust this based on how player information is stored in matchData
  return Object.keys(matchData.kills)[0] || 'Unknown Player';
}

// code for sample achievements
function initializeSampleAwardsForTesting() {
  const sampleAchievements = [
    {
      title: "Hump Day",
      description: "Getting a Win on a Wednesday",
      ap: 50,
      difficultyLevel: "Easy",
      requiredCompletionCount: 1,
      repeatable: true,
      gameMode: "Any",
      map: "Any",
      logicCriteria: JSON.stringify([
        { type: "dayOfWeek", days: [3] }, // Wednesday is day 3 (0-indexed)
        { type: "placement", value: 1 }
      ]),
      locked: false,
      useHistoricalData: true
    },
    {
      title: "Honeymoon Fund",
      description: "Get 35 wins in a Battle Royale mode game",
      ap: 500,
      difficultyLevel: "Hard",
      requiredCompletionCount: 35,
      repeatable: false,
      gameMode: "Battle Royale",
      map: "Any",
      logicCriteria: JSON.stringify([
        { type: "gameMode", value: "Battle Royale" },
        { type: "placement", value: 1 }
      ]),
      locked: false,
      startDate: new Date().toISOString(),
      endDate: new Date("2025-04-01").toISOString(),
      useHistoricalData: false
    },
    {
      title: "Another Win in Paradise",
      description: "Get a win on Resurgence Quads mode on Rebirth Island map",
      ap: 100,
      difficultyLevel: "Moderate",
      requiredCompletionCount: 1,
      repeatable: true,
      gameMode: "Resurgence Quads",
      map: "Rebirth Island",
      logicCriteria: JSON.stringify([
        { type: "gameMode", value: "Resurgence Quads" },
        { type: "map", value: "Rebirth Island" },
        { type: "placement", value: 1 }
      ]),
      locked: false,
      useHistoricalData: true
    },
    {
      title: "Odd Man Out",
      description: "Win a Battle Royale Resurgence game on Rebirth Island with total team kills over 10 and each team member having more than 2 kills",
      ap: 1000,
      difficultyLevel: "Extra Hard",
      requiredCompletionCount: 1,
      repeatable: false,
      gameMode: "Battle Royale Resurgence",
      map: "Rebirth Island",
      logicCriteria: JSON.stringify([
        { type: "gameMode", value: "Battle Royale Resurgence" },
        { type: "map", value: "Rebirth Island" },
        { type: "placement", value: 1 },
        { type: "totalKills", value: 10 },
        { type: "playerKills", value: 2 }
      ]),
      locked: false,
      useHistoricalData: true
    }
  ];

  const sampleChallenges = [
    {
      title: "Slayer",
      description: "Get 10 or more kills on a Battle Royale Resurgence Solos game on Rebirth Island",
      cp: 100,
      difficultyLevel: "Moderate",
      requiredCompletionCount: 1,
      repeatable: false,
      gameMode: "Battle Royale Resurgence Solos",
      map: "Rebirth Island",
      logicCriteria: JSON.stringify([
        { type: "gameMode", value: "Battle Royale Resurgence Solos" },
        { type: "map", value: "Rebirth Island" },
        { type: "playerKills", value: 10 }
      ]),
      locked: false,
      startDate: new Date().toISOString(),
      endDate: new Date("2024-12-31").toISOString(),
      useHistoricalData: false,
      prizeDescription: "Coffee Mug",
      prizeSponsor: "STARMAN",
      soloChallenge: true
    }
  ];

  // Add sample achievements to the database
  sampleAchievements.forEach(achievement => {
    push(ref(database, 'achievements'), achievement);
  });

  // Add sample challenges to the database
  sampleChallenges.forEach(challenge => {
    push(ref(database, 'challenges'), challenge);
  });

  console.log("Sample achievements and challenges have been added for testing.");
}
export { displayChallenges };
