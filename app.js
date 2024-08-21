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

// Function to show Team Members page
function showTeamMembers() {
    mainContent.innerHTML = `
        <h2>Team Members</h2>
        <div id="teamList" class="team-list"></div>
    `;
    loadTeamMembers();
}

// Function to load and display team members
function loadTeamMembers() {
    const teamList = document.getElementById('teamList');
    teamList.innerHTML = 'Loading team members...';

    onValue(ref(database, 'teamMembers'), (snapshot) => {
        teamList.innerHTML = '';
        snapshot.forEach((childSnapshot) => {
            const member = childSnapshot.val();
            const memberId = childSnapshot.key;
            const age = calculateAge(member.birthdate);
            
            let photoURL = member.photoURL;
            if (!photoURL || (!photoURL.startsWith('https://') && !photoURL.startsWith('gs://'))) {
                console.warn(`Invalid photo URL for member ${memberId}:`, photoURL);
                photoURL = 'path/to/default/profile.png'; // Provide a default image path
            }

            teamList.innerHTML += `
                <div class="card">
                    <img src="${photoURL}" alt="${member.name}" class="team-photo" onerror="this.src='path/to/fallback/profile.png';">
                    <div class="member-details">
                        <h3>${member.name}</h3>
                        <p><strong>Gamertag:</strong> ${member.gamertag}</p>
                        <p><strong>State:</strong> ${member.state}</p>
                        <p><strong>Birthdate:</strong> ${member.birthdate} (Age: ${age})</p>
                        <p><strong>Favorite Snack:</strong> ${member.favoriteSnack}</p>
                        <p><strong>BR PR:</strong> ${member.brPR !== undefined ? member.brPR : 'N/A'} ${member.brPRDate ? `(${formatDate(member.brPRDate)})` : ''}</p>
                        <p><strong>MP PR:</strong> ${member.mpPR !== undefined ? member.mpPR : 'N/A'} ${member.mpPRDate ? `(${formatDate(member.mpPRDate)})` : ''}</p>
                    </div>
                    <div class="actions">
                        <button class="button" onclick="showModal('editTeamMember', '${memberId}')">Edit</button>
                    </div>
                </div>
            `;
        });
        if (teamList.innerHTML === '') {
            teamList.innerHTML = 'No team members found.';
        }
    });
}

// Utility function to calculate age
function calculateAge(birthdate) {
    const today = new Date();
    const birthDate = new Date(birthdate);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age;
}

// Utility function to format date
function formatDate(dateString) {
    const date = new Date(dateString);
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString(undefined, options);
}

// Modal function for editing team member
window.showModal = function(action, id = null) {
    if (action === 'editTeamMember') {
        get(ref(database, `teamMembers/${id}`)).then((snapshot) => {
            if (snapshot.exists()) {
                const member = snapshot.val();
                modalContent.innerHTML = `
                    <h3>Edit Team Member</h3>
                    <form id="teamMemberForm" data-id="${id}">
                        <input type="text" id="name" value="${member.name}" required>
                        <input type="text" id="gamertag" value="${member.gamertag}" required>
                        <input type="text" id="state" value="${member.state}" required>
                        <input type="date" id="birthdate" value="${member.birthdate}" required>
                        <input type="text" id="favoriteSnack" value="${member.favoriteSnack}" required>
                        <input type="file" id="photo" accept="image/*">
                        <button type="submit">Update Team Member</button>
                    </form>
                `;
                document.getElementById('teamMemberForm').addEventListener('submit', updateTeamMember);
                modal.style.display = "block";
            }
        });
    }
}

// Function to update team member
async function updateTeamMember(e) {
    e.preventDefault();
    const form = e.target;
    const memberId = form.dataset.id;
    const memberData = {
        name: form.name.value,
        gamertag: form.gamertag.value,
        state: form.state.value,
        birthdate: form.birthdate.value,
        favoriteSnack: form.favoriteSnack.value
    };

    const photo = form.photo.files[0];
    if (photo) {
        try {
            const photoRef = storageRef(storage, `teamMembers/${Date.now()}_${photo.name}`);
            const snapshot = await uploadBytes(photoRef, photo);
            const url = await getDownloadURL(snapshot.ref);
            if (!url.startsWith('https://') && !url.startsWith('gs://')) {
                throw new Error('Invalid photo URL generated');
            }
            memberData.photoURL = url;
        } catch (error) {
            console.error('Error uploading team member photo:', error);
            alert('Error uploading photo. Please try again.');
            return;
        }
    }

    try {
        await update(ref(database, `teamMembers/${memberId}`), memberData);
        loadTeamMembers();
        modal.style.display = "none";
    } catch (error) {
        console.error("Error updating team member: ", error);
        alert('Error updating team member. Please try again.');
    }
}

function showHelp() {
  mainContent.innerHTML = '<h2>Help</h2><p>Help information will be displayed here.</p>';
}

function showAbout() {
  mainContent.innerHTML = '<h2>About Us</h2><p>Information about My COD Squad will be displayed here.</p>';
}
