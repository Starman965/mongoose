// initializeDatabase.js
import { database } from './firebaseConfig.js';
import { ref, set } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js";
/*
// Initialize Achievements
function initializeAchievements() {
  const achievementsRef = ref(database, 'achievements');
  set(achievementsRef, {
    achievementId1: {
      title: "Teamwork Makes the Dream Work",
      description: "The team comes in 1st place on a Battle Royale Game.",
      criteria: "1st place finish in Battle Royale",
      completionCount: 10,
      currentCount: 0,
      sessionDates: [],
      imageUrl: null,
      defaultImageUrl: "url_to_default_achievement_completed_image"
    },
    // Add more achievements here
  });
}

// Initialize Challenges
function initializeChallenges() {
  const challengesRef = ref(database, 'challenges');
  set(challengesRef, {
    challengeId1: {
      title: "Battle Royale Master",
      description: "Get 5 kills in a Battle Royale Game.",
      criteria: "5 kills in Battle Royale",
      completionCount: 10,
      playersCompleted: {},
      imageUrl: null,
      defaultImageUrl: "url_to_default_challenge_completed_image"
    },
    // Add more challenges here
  });
}

// Run the initialization
// initializeAchievements();
// initializeChallenges(); 
*/
console.log("Database initialization complete."); 
