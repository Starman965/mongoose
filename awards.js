/* 
// awards.js
// import { database } from './firebaseConfig.js';
// import { ref, onValue, update, get } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js";

// Load and display achievements
export function showAchievements() {
  const mainContent = document.getElementById('mainContent');
  mainContent.innerHTML = `
    <h2>Achievements</h2>
    <div id="achievementsContainer" class="awards-grid"></div>
  `;
  loadAchievements();
}

// Load and display challenges
export function showChallenges() {
  const mainContent = document.getElementById('mainContent');
  mainContent.innerHTML = `
    <h2>Challenges</h2>
    <div id="challengesContainer" class="awards-grid"></div>
  `;
  loadChallenges();
}

// Load achievements from Firebase
function loadAchievements() {
  try {
    const achievementsRef = ref(database, 'achievements');
    onValue(achievementsRef, (snapshot) => {
      const achievements = snapshot.val();
      displayAchievements(achievements);
    }, (error) => {
      console.error("Error loading achievements:", error);
    });
  } catch (error) {
    console.error("Error setting up achievements listener:", error);
  }
}

// Display achievements on the page
function displayAchievements(achievements) {
  try {
    const achievementsContainer = document.getElementById('achievementsContainer');
    if (!achievementsContainer) {
      console.error("Achievements container not found");
      return;
    }
    achievementsContainer.innerHTML = '';
    for (const [id, achievement] of Object.entries(achievements)) {
      const card = createAchievementCard(id, achievement);
      achievementsContainer.appendChild(card);
    }
  } catch (error) {
    console.error("Error displaying achievements:", error);
  }
}

// Create an achievement card
function createAchievementCard(id, achievement) {
  const card = document.createElement('div');
  card.className = 'card achievement-card';
  card.innerHTML = `
    <img src="${achievement.imageUrl || achievement.defaultImageUrl}" alt="${achievement.title}">
    <h3>${achievement.title}</h3>
    <p>${achievement.description}</p>
    <p>Completed: ${achievement.currentCount}/${achievement.completionCount}</p>
  `;
  return card;
}

function loadChallenges() {
  try {
    const challengesRef = ref(database, 'challenges');
    onValue(challengesRef, (snapshot) => {
      const challenges = snapshot.val();
      displayChallenges(challenges);
    }, (error) => {
      console.error("Error loading challenges:", error);
    });
  } catch (error) {
    console.error("Error setting up challenges listener:", error);
  }
}


// Display challenges on the page
function displayChallenges(challenges) {
  try {
    const challengesContainer = document.getElementById('challengesContainer');
    if (!challengesContainer) {
      console.error("Challenges container not found");
      return;
    }
    challengesContainer.innerHTML = '';
    for (const [id, challenge] of Object.entries(challenges)) {
      const card = createChallengeCard(id, challenge);
      challengesContainer.appendChild(card);
    }
  } catch (error) {
    console.error("Error displaying challenges:", error);
  }
}

// Create a challenge card
function createChallengeCard(id, challenge) {
  const card = document.createElement('div');
  card.className = 'card challenge-card';
  card.innerHTML = `
    <img src="${challenge.imageUrl || challenge.defaultImageUrl}" alt="${challenge.title}">
    <h3>${challenge.title}</h3>
    <p>${challenge.description}</p>
    <p>Players Completed: ${Object.keys(challenge.playersCompleted).length}</p>
  `;
  return card;
}

// Process match results to update achievements and challenges
export async function processMatchResult(matchData) {
  console.log("Processing match result:", matchData);
  try {
    // Update achievements
    const achievementsRef = ref(database, 'achievements');
    const achievementsSnapshot = await get(achievementsRef);
    const achievements = achievementsSnapshot.val();

    for (const [id, achievement] of Object.entries(achievements)) {
      if (checkAchievementCriteria(achievement, matchData)) {
        achievement.currentCount++;
        await update(ref(database, `achievements/${id}`), { currentCount: achievement.currentCount });
      }
    }

    // Update challenges
    const challengesRef = ref(database, 'challenges');
    const challengesSnapshot = await get(challengesRef);
    const challenges = challengesSnapshot.val();

    for (const [id, challenge] of Object.entries(challenges)) {
      if (checkChallengeCriteria(challenge, matchData)) {
        if (!challenge.playersCompleted) challenge.playersCompleted = {};
        challenge.playersCompleted[matchData.playerId] = true;
        await update(ref(database, `challenges/${id}/playersCompleted`), challenge.playersCompleted);
      }
    }

    console.log("Achievements and challenges updated successfully");
  } catch (error) {
    console.error("Error processing match result:", error);
  }
}
// Helper function to check if an achievement's criteria is met
function checkAchievementCriteria(achievement, matchData) {
  // Implement the logic to check if the match data meets the achievement criteria
  // This is a placeholder and should be replaced with actual logic
  return false;
}

// Helper function to check if a challenge's criteria is met
function checkChallengeCriteria(challenge, matchData) {
  // Implement the logic to check if the match data meets the challenge criteria
  // This is a placeholder and should be replaced with actual logic
  return false;
}

// Initialize awards functionality
/* function initAwards() {
  try {
    loadAchievements();
    loadChallenges();
  } catch (error) {
    console.error("Error initializing awards:", error);
  }
}
*/
*/
// Export functions to be used in other modules
export { initAwards, loadAchievements, loadChallenges };

