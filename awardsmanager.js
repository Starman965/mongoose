import { database } from './firebaseConfig.js';
import { ref, onValue, update, get, push } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js";

let achievementsUpdates = [];
// let challengesUpdates = [];

export function initAwards() {
  // Initialize any necessary data or listeners for awards
}

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
        <p>Game Type: ${achievement.criteria.gameType || 'Any'}</p>
        <p>Game Mode: ${achievement.criteria.gameMode || 'Any'}</p>
        <p>Map: ${achievement.criteria.map || 'Any'}</p>
        <p>Status: ${achievement.status}</p>
        <p>Progress: ${achievement.currentCompletionCount}/${achievement.requiredCompletionCount}</p>
        ${achievement.dateRange ? `<p>Valid: ${new Date(achievement.dateRange.start).toLocaleDateString()} - ${new Date(achievement.dateRange.end).toLocaleDateString()}</p>` : ''}
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
  const challengesRef = ref(database, 'challenges'); // Added this line to define challengesRef
  
  const [achievementsSnapshot, challengesSnapshot] = await Promise.all([
    get(achievementsRef),
    get(challengesRef)
  ]);

  const achievements = achievementsSnapshot.val();

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
  */
} // Ensure this function is properly closed

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
// initialize the sample set of achievements and challenges
function initializeSampleAwardsForTesting() {
  const sampleAchievements = [
    {
      title: "Hump Day Victor",
      description: "Win a match on a Wednesday",
      ap: 50,
      difficultyLevel: "Easy",
      criteria: {
        gameType: "Any",
        gameMode: "Any",
        map: "Any",
        placement: { max: 1 },
        occurrence: "multiple",
        dateRange: null
      },
      requiredCompletionCount: 1,
      currentCompletionCount: 0,
      status: "Not Started",
      locked: false,
      useHistoricalData: true
    },
    {
      title: "Battle Royale Dominator",
      description: "Win 10 Battle Royale matches",
      ap: 500,
      difficultyLevel: "Hard",
      criteria: {
        gameType: "Warzone",
        gameMode: "Battle Royale",
        map: "Any",
        placement: { max: 1 },
        occurrence: "multiple",
        dateRange: {
          start: new Date().toISOString(),
          end: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString()
        }
      },
      requiredCompletionCount: 10,
      currentCompletionCount: 0,
      status: "Not Started",
      locked: false,
      useHistoricalData: false
    },
    {
      title: "Urzikstan Marksman",
      description: "Get 15 or more kills in a single Battle Royale match on Urzikstan",
      ap: 200,
      difficultyLevel: "Moderate",
      criteria: {
        gameType: "Warzone",
        gameMode: "Battle Royale",
        map: "Urzikstan",
        totalKills: { min: 15 },
        occurrence: "oneTime"
      },
      requiredCompletionCount: 1,
      currentCompletionCount: 0,
      status: "Not Started",
      locked: false,
      useHistoricalData: true
    },
    {
      title: "Team Wipe Specialist",
      description: "In Resurgence Quads, have each team member get at least 3 kills and win the match",
      ap: 300,
      difficultyLevel: "Hard",
      criteria: {
        gameType: "Warzone",
        gameMode: "Resurgence Quads",
        map: "Any",
        placement: { max: 1 },
        playerKills: [
          { player: 1, min: 3 },
          { player: 2, min: 3 },
          { player: 3, min: 3 },
          { player: 4, min: 3 }
        ],
        occurrence: "multiple"
      },
      requiredCompletionCount: 1,
      currentCompletionCount: 0,
      status: "Not Started",
      locked: false,
      useHistoricalData: true
    },
    {
      title: "Multiplayer Ace",
      description: "Win 5 consecutive Multiplayer matches",
      ap: 150,
      difficultyLevel: "Moderate",
      criteria: {
        gameType: "Multiplayer",
        gameMode: "Any",
        map: "Any",
        placement: "Won",
        occurrence: "oneTime"
      },
      requiredCompletionCount: 5,
      currentCompletionCount: 0,
      status: "Not Started",
      locked: false,
      useHistoricalData: false
    },
    {
      title: "Weekend Warrior",
      description: "Play and win a match on Saturday or Sunday",
      ap: 25,
      difficultyLevel: "Easy",
      criteria: {
        gameType: "Any",
        gameMode: "Any",
        map: "Any",
        placement: { max: 1 },
        occurrence: "weekly"
      },
      requiredCompletionCount: 1,
      currentCompletionCount: 0,
      status: "Not Started",
      locked: false,
      useHistoricalData: true
    }
  ];

  // Add sample achievements to the database
  sampleAchievements.forEach(achievement => {
    push(ref(database, 'achievements'), achievement);
  });

  console.log("Sample achievements have been added for testing.");
}
