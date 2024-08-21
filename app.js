import { ref, onValue, push, update, remove, get, set } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js";
import { database } from './firebaseConfig.js';
const storage = getStorage();

// DOM elements
const mainContent = document.getElementById('mainContent');
const modal = document.getElementById('modal');
const modalContent = document.getElementById('modalContent');
const closeModal = document.getElementsByClassName('close')[0];

// Close modal when clicking on 'x' or outside of it
closeModal.onclick = () => modal.style.display = "none";
window.onclick = (event) => {
  if (event.target == modal) {
    modal.style.display = "none";
  }
}

// Navigation setup
document.getElementById('statsNav').addEventListener('click', () => showSection('stats'));
document.getElementById('sessionsNav').addEventListener('click', () => showSection('sessions'));
document.getElementById('teamNav').addEventListener('click', () => showSection('team'));
document.getElementById('helpNav').addEventListener('click', () => showHelp());
document.getElementById('aboutNav').addEventListener('click', () => showAbout());

function showSection(section) {
  switch(section) {
    case 'stats': showStats(); break;
    case 'sessions': showGameSessions(); break;
    case 'team': showTeamMembers(); break;
  }
}

// Placeholder functions for each section
function showStats() {
  mainContent.innerHTML = '<h2>Team Statistics</h2><p>Team statistics will be displayed here.</p>';
}

function showGameSessions() {
  mainContent.innerHTML = '<h2>Game Sessions</h2><p>Game sessions will be displayed here.</p>';
}

function showTeamMembers() {
  mainContent.innerHTML = '<h2>Team Members</h2><p>Team members will be displayed here.</p>';
}

function showHelp() {
  mainContent.innerHTML = '<h2>Help</h2><p>Help information will be displayed here.</p>';
}

function showAbout() {
  mainContent.innerHTML = '<h2>About Us</h2><p>Information about My COD Squad will be displayed here.</p>';
}
