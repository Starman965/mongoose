import { database } from './firebaseConfig.js';
import { ref, get, update, set } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js";

let achievementsUpdates = [];

export async function processMatchResult(matchData) {
  try {
    const achievementsSnapshot = await get(ref(database, 'achievements'));
    const achievements = achievementsSnapshot.val();

    for (const [id, achievement] of Object.entries(achievements)) {
      if (checkAchievementCriteria(achievement, matchData)) {
        const updateResult = await updateAchievementProgress(id, achievement, matchData);
        if (updateResult) {
          achievementsUpdates.push(updateResult);
        }
      }
    }
    return achievementsUpdates;
  } catch (error) {
    console.error("Error processing match result:", error);
    throw error;
  }
}

function checkAchievementCriteria(achievement, matchData) {
  if (!achievement.isActive) return false;

  if (achievement.occursByDate && new Date(achievement.occursByDate) < new Date(matchData.timestamp)) return false;

  if (achievement.occursOnDOW && achievement.occursOnDOW.length > 0) {
    const matchDay = new Date(matchData.timestamp).getDay();
    if (!achievement.occursOnDOW.includes(matchDay)) return false;
  }

  if (achievement.gameType !== 'Any' && achievement.gameType !== matchData.gameType) return false;
  if (achievement.gameMode !== 'Any' && achievement.gameMode !== matchData.gameMode) return false;
  if (achievement.map !== 'Any' && achievement.map !== matchData.map) return false;

  if (achievement.placement !== 'Any') {
    if (matchData.gameType.toLowerCase() === 'multiplayer') {
      if (achievement.placement === 'Won' && matchData.placement !== 'Won') return false;
    } else {
      if (parseInt(achievement.placement) < matchData.placement) return false;
    }
  }

  if (!checkOperatorCondition(achievement.totalKillsOperator, achievement.totalKills, matchData.totalKills)) return false;

  for (const [member, killData] of Object.entries(achievement.teamMemberKills || {})) {
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

async function updateAchievementProgress(id, achievement, matchData) {
  try {
    achievement.currentProgress++;
    let updateMessage = `Progress made on achievement "${achievement.title}"`;

    if (achievement.currentProgress >= achievement.timesToComplete) {
      achievement.status = 'Completed';
      achievement.completedAt = matchData.timestamp;
      updateMessage = `Achievement "${achievement.title}" completed!`;

      achievement.completionCount = (achievement.completionCount || 0) + 1;

      if (!achievement.completionHistory) achievement.completionHistory = [];
      achievement.completionHistory.push({
        completedAt: matchData.timestamp,
        matchId: matchData.id
      });

      if (!achievement.canCompleteMultipleTimes) {
        achievement.isActive = false;
      } else {
        achievement.currentProgress = 0;
      }

      achievement.lastCompletedAt = matchData.timestamp;
    } else {
      achievement.status = 'In Progress';
    }

    achievement.lastProgressDate = matchData.timestamp;

    await set(ref(database, `achievements/${id}`), achievement);

    return updateMessage;
  } catch (error) {
    console.error("Error updating achievement progress:", error);
    throw error;
  }
}

export function getAchievementsUpdates() {
  const updates = [...achievementsUpdates];
  achievementsUpdates = []; // Clear the updates
  return updates;
}

export async function addOrUpdateAchievement(achievementData, id = null) {
  try {
    const achievementRef = id 
      ? ref(database, `achievements/${id}`)
      : ref(database, 'achievements').push();

    if (!id) {
      achievementData.createdAt = new Date().toISOString();
      achievementData.status = 'Not Started';
      achievementData.currentProgress = 0;
      achievementData.completionCount = 0;
    }

    achievementData.updatedAt = new Date().toISOString();

    await set(achievementRef, achievementData);

    return achievementRef.key;
  } catch (error) {
    console.error("Error adding/updating achievement:", error);
    throw error;
  }
}

export async function deleteAchievement(id) {
  try {
    await set(ref(database, `achievements/${id}`), null);
  } catch (error) {
    console.error("Error deleting achievement:", error);
    throw error;
  }
}

export async function getAchievements() {
  try {
    const snapshot = await get(ref(database, 'achievements'));
    return snapshot.val();
  } catch (error) {
    console.error("Error fetching achievements:", error);
    throw error;
  }
}

export function filterAchievements(achievements, filterValue, gameTypeFilter) {
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

export function sortAchievements(achievements, sortValue) {
  const difficultyOrder = ['Easy', 'Moderate', 'Hard', 'Extra Hard'];
  
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

/*
// Helper function to generate sample achievements
export function generateSampleAchievements() {
  return [
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
    // ... (other sample achievements)
  ];
}
*/
