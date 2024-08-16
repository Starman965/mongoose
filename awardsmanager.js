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

function filterChallenges(challenges, filterValue) {
  const now = new Date();
  switch(filterValue) {
    case 'completedWeek':
      return challenges.filter(c => c.status === 'Completed' && new Date(c.completionDate) > new Date(now - 7 * 24 * 60 * 60 * 1000));
    case 'completedMonth':
      return challenges.filter(c => c.status === 'Completed' && new Date(c.completionDate) > new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()));
    case 'completedYear':
      return challenges.filter(c => c.status === 'Completed' && new Date(c.completionDate) > new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()));
    case 'inProgress':
      return challenges.filter(c => c.status === 'In Progress');
    default:
      return challenges;
  }
}

function sortChallenges(challenges, sortValue) {
  switch(sortValue) {
    case 'difficulty':
      return challenges.sort((a, b) => difficultyOrder.indexOf(a.difficultyLevel) - difficultyOrder.indexOf(b.difficultyLevel));
    case 'cp':
      return challenges.sort((a, b) => b.cp - a.cp);
    case 'completionDate':
      return challenges.sort((a, b) => new Date(b.completionDate) - new Date(a.completionDate));
    case 'prize':
      return challenges.sort((a, b) => (b.prizeDescription || '').localeCompare(a.prizeDescription || ''));
    default:
      return challenges;
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
export function loadChallenges() {
  const challengesContainer = document.getElementById('challengesContainer');
  const filterValue = document.getElementById('challengeFilter').value;
  const sortValue = document.getElementById('challengeSort').value;
  
  challengesContainer.innerHTML = '<p>Loading challenges...</p>';

  get(ref(database, 'challenges')).then((snapshot) => {
    let challenges = [];

    snapshot.forEach((childSnapshot) => {
      challenges.push({ id: childSnapshot.key, ...childSnapshot.val() });
    });

    if (challenges.length === 0) {
      challengesContainer.innerHTML = '<p>No challenges found.</p>';
      return;
    }

    challenges = filterChallenges(challenges, filterValue);
    challenges = sortChallenges(challenges, sortValue);
    
    displayChallenges(challenges);
  }).catch((error) => {
    console.error("Error loading challenges:", error);
    challengesContainer.innerHTML = '<p>Error loading challenges. Please try again later.</p>';
  });
}
export async function processMatchResult(matchData) {
  // Process achievements
  await processAchievements(matchData);

  // Process challenges
  await processChallenges(matchData);
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
function checkChallengeCriteria(challenge, matchData) {
  if (challenge.locked) return false;
  
  if (!isWithinTimeFrame(challenge, matchData.timestamp)) return false;

  const criteria = JSON.parse(challenge.logicCriteria);
  return criteria.every(criterion => evaluateCriterion(criterion, matchData));
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
async function updateChallenge(id, challenge, matchData) {
  if (!challenge.useHistoricalData && challenge.creationDate > matchData.timestamp) {
    return null;
  }
  let update = null;
  if (checkChallengeCriteria(challenge, matchData)) {
    // For challenges, we need to track completion for each player
    const playerName = getPlayerNameFromMatchData(matchData);
    if (!challenge.playersCompleted) challenge.playersCompleted = {};
    if (!challenge.playersCompleted[playerName]) {
      challenge.playersCompleted[playerName] = 0;
    }
    challenge.playersCompleted[playerName]++;

   if (challenge.playersCompleted[playerName] >= challenge.requiredCompletionCount) {
    update = `Player ${playerName} completed the challenge "${challenge.title}"!`;
    if (!challenge.repeatable) {
      // Mark as completed for this player
      challenge.playersCompleted[playerName] = {
        status: 'Completed',
        completionDate: new Date().toISOString(),
        completionMatchId: matchData.matchId  // Assuming matchData has a matchId field
      };
    }
  } else {
    update = `Player ${playerName} made progress on challenge "${challenge.title}"`;
  }

    await update(ref(database, `challenges/${id}`), challenge);
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
function displayChallenges(challenges) {
  const container = document.getElementById('challengesContainer');
  container.innerHTML = '';

  // Check if challenges is null or undefined
  if (!challenges) {
    container.innerHTML = '<p>No challenges available.</p>';
    return;
  }

  // If challenges is an object, convert it to an array
  const challengesArray = Array.isArray(challenges) ? challenges : Object.values(challenges);

  // Now use challengesArray instead of challenges in your loop
  for (const challenge of challengesArray) {
    const card = createChallengeCard(challenge);
    container.appendChild(card);
  }
}

function createChallengeCard(challenge) {
  const card = document.createElement('div');
  card.className = 'card challenge-card';
  
  let imageUrl = challenge.customImageUrl || challenge.defaultImageUrl || 'http://mongoose.mycodsquad.com/challengebadgedefault.png';

  let progressHtml = '';
  if (challenge.playersCompleted) {
    progressHtml = Object.entries(challenge.playersCompleted)
      .map(([player, status]) => `<p>${player}: ${typeof status === 'object' ? status.status : status}</p>`)
      .join('');
  }

  card.innerHTML = `
    <img src="${imageUrl}" alt="${challenge.title}" onerror="this.src='path/to/fallback/image.png';">
    <h3>${challenge.title}</h3>
    <p>${challenge.description}</p>
    <p>Difficulty: ${challenge.difficultyLevel}</p>
    <p>Challenge Points: ${challenge.cp}</p>
    <p>Required Completions: ${challenge.requiredCompletionCount}</p>
    <p>Game Mode: ${challenge.gameMode}</p>
    <p>Map: ${challenge.map}</p>
    <p>Prize: ${challenge.prizeDescription || 'N/A'}</p>
    <p>Sponsor: ${challenge.prizeSponsor || 'N/A'}</p>
    <div class="challenge-progress">
      <h4>Progress:</h4>
      ${progressHtml}
    </div>
    ${challenge.startDate ? `<p>Start Date: ${new Date(challenge.startDate).toLocaleDateString()}</p>` : ''}
    ${challenge.endDate ? `<p>End Date: ${new Date(challenge.endDate).toLocaleDateString()}</p>` : ''}
  `;

  return card;
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
