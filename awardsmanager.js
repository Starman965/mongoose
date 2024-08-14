// awardsmanager.js

import { database } from './firebaseConfig.js';
import { ref, onValue, update, get } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js";

export function initAwards() {
  // Initialize any necessary data or listeners for awards
}

export function loadAchievements() {
  const achievementsContainer = document.getElementById('achievementsContainer');
  const achievementsRef = ref(database, 'achievements');
  
  onValue(achievementsRef, (snapshot) => {
    const achievements = snapshot.val();
    displayAchievements(achievements);
  });
}

function displayAchievements(achievements) {
  const container = document.getElementById('achievementsContainer');
  container.innerHTML = '';

  for (const [id, achievement] of Object.entries(achievements)) {
    const card = createAchievementCard(id, achievement);
    container.appendChild(card);
  }
}

function createAchievementCard(id, achievement) {
  const card = document.createElement('div');
  card.className = 'card achievement-card';
  
  let imageUrl = achievement.customImageUrl || achievement.defaultImageUrl;

  card.innerHTML = `
    <img src="${imageUrl}" alt="${achievement.title}" onerror="this.src='https://firebasestorage.googleapis.com/v0/b/gamenight-37cc6.appspot.com/o/achievements%2Fachievementbadgedefault.png?alt=media&token=ee6be1b0-0ec0-49ab-9e4d-c0a9456231e9';">
    <h3>${achievement.title}</h3>
    <p>${achievement.description}</p>
    <p>Difficulty: ${achievement.difficultyLevel}</p>
    <p>Achievement Points: ${achievement.ap}</p>
    <p>Status: ${achievement.status}</p>
    <p>Progress: ${achievement.currentCompletionCount}/${achievement.requiredCompletionCount}</p>
  `;

  return card;
}

export function loadChallenges() {
  // Similar implementation to loadAchievements, but for challenges
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
      await updateAchievement(id, achievement, matchData);
    }
  }
}

function checkAchievementCriteria(achievement, matchData) {
  // Implement the logic to check if the match data meets the achievement criteria
  // This should interpret the JSON logic criteria stored in the achievement
  // Return true if the criteria is met, false otherwise
}

async function updateAchievement(id, achievement, matchData) {
  // Update the achievement progress or status based on the match data
  // This function should handle different types of achievements (one-time, repeatable, time-limited)
  // and respect the "Use Historical Data" flag
}

async function processChallenges(matchData) {
  // Similar implementation to processAchievements, but for challenges
}

// Add more helper functions as needed
