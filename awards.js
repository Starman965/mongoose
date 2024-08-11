// awards.js
import { database } from './firebaseConfig.js';
import { ref, onValue, update } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js";

// Load achievements from Firebase
function loadAchievements() {
  const achievementsRef = ref(database, 'achievements');
  onValue(achievementsRef, (snapshot) => {
    const achievements = snapshot.val();
    displayAchievements(achievements);
  });
}

// Display achievements on the page
function displayAchievements(achievements) {
  const achievementsContainer = document.getElementById('achievementsContainer');
  achievementsContainer.innerHTML = '';

  for (const [id, achievement] of Object.entries(achievements)) {
    const card = createAchievementCard(id, achievement);
    achievementsContainer.appendChild(card);
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

// Load challenges from Firebase
function loadChallenges() {
  const challengesRef = firebase.database().ref('challenges');
  challengesRef.on('value', (snapshot) => {
    const challenges = snapshot.val();
    displayChallenges(challenges);
  });
}

// Display challenges on the page
function displayChallenges(challenges) {
  const challengesContainer = document.getElementById('challengesContainer');
  challengesContainer.innerHTML = '';

  for (const [id, challenge] of Object.entries(challenges)) {
    const card = createChallengeCard(id, challenge);
    challengesContainer.appendChild(card);
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
async function processMatchResult(matchData) {
  // Implementation for checking and updating achievements and challenges based on match data
  // This will involve complex logic to check various criteria and update Firebase accordingly
  console.log("Processing match result:", matchData);
  // TODO: Implement the logic to update achievements and challenges
}


// Initialize awards functionality
function initAwards() {
  loadAchievements();
  loadChallenges();
}

// Export functions to be used in other modules
export { initAwards, processMatchResult };
