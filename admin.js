import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, getDocs, deleteDoc, doc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAre8_kYuoXkTV0S-ApaInL5Ihuj429UGA",
  authDomain: "bribri-123.firebaseapp.com",
  projectId: "bribri-123",
  storageBucket: "bribri-123.firebasestorage.app",
  messagingSenderId: "980555615472",
  appId: "1:980555615472:web:88a49e0ac53c5776a50635",
  measurementId: "G-4B8Q0G8CST"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// GitHub Details
const GITHUB_REPO = "dorposner/BriBri";
const FILE_PATH = "dictionary.json";

// DOM Elements
const settingsToggle = document.getElementById('settings-toggle');
const settingsModal = document.getElementById('settings-modal');
const githubTokenInput = document.getElementById('github-token');
const saveSettingsBtn = document.getElementById('save-settings-btn');
const suggestionsList = document.getElementById('suggestions-list');
const pendingCount = document.getElementById('pending-count');
const suggestionTemplate = document.getElementById('suggestion-template');

// State
let suggestions = [];

document.addEventListener('DOMContentLoaded', () => {
    // Settings Logic
    const savedToken = localStorage.getItem('bribri_github_token');
    if (savedToken) {
        githubTokenInput.value = savedToken;
    } else {
        settingsModal.classList.remove('hidden');
    }

    settingsToggle.addEventListener('click', () => {
        settingsModal.classList.remove('hidden');
    });

    saveSettingsBtn.addEventListener('click', () => {
        const token = githubTokenInput.value.trim();
        if (token) {
            localStorage.setItem('bribri_github_token', token);
            settingsModal.classList.add('hidden');
        } else {
            alert('Please enter a valid GitHub token.');
        }
    });

    // Load Data
    loadSuggestions();
});

async function loadSuggestions() {
    try {
        suggestionsList.innerHTML = '<div class="loading">Loading suggestions from Firebase...</div>';
        const q = query(collection(db, "suggestions"), orderBy("timestamp", "desc"));
        const querySnapshot = await getDocs(q);
        
        suggestions = [];
        querySnapshot.forEach((docSnap) => {
            suggestions.push({ id: docSnap.id, ...docSnap.data() });
        });

        pendingCount.textContent = suggestions.length;
        renderSuggestions();
    } catch (error) {
        console.error("Error loading suggestions:", error);
        suggestionsList.innerHTML = `<div class="loading" style="color:var(--error-color);">Error loading suggestions. Make sure your Firebase Firestore is set up and public/test mode.</div>`;
    }
}

function renderSuggestions() {
    suggestionsList.innerHTML = '';
    
    if (suggestions.length === 0) {
        suggestionsList.innerHTML = '<div class="loading">No pending suggestions. You are all caught up! 🎉</div>';
        return;
    }

    suggestions.forEach(suggestion => {
        const clone = suggestionTemplate.content.cloneNode(true);
        const card = clone.querySelector('.suggestion-card');
        
        clone.querySelector('.bribri-word').textContent = suggestion.bribri;
        clone.querySelector('.translation-text').textContent = suggestion.translation;
        
        const contextEl = clone.querySelector('.context-text');
        if (suggestion.context) {
            contextEl.textContent = suggestion.context;
        } else {
            contextEl.textContent = "No context provided.";
            contextEl.style.opacity = "0.5";
        }

        const contributorEl = clone.querySelector('.contributor-text');
        if (suggestion.contributor_name) {
            contributorEl.textContent = suggestion.contributor_name;
        } else {
            contributorEl.textContent = "Anonymous";
            contributorEl.style.opacity = "0.5";
        }

        if (suggestion.timestamp) {
            const date = suggestion.timestamp.toDate();
            clone.querySelector('.timestamp').textContent = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
        }

        // Attach Events
        const approveBtn = clone.querySelector('.approve-btn');
        const deleteBtn = clone.querySelector('.delete-btn');

        approveBtn.addEventListener('click', () => handleApprove(suggestion.id, suggestion, card));
        deleteBtn.addEventListener('click', () => handleDelete(suggestion.id, card));

        suggestionsList.appendChild(clone);
    });
}

async function handleApprove(id, suggestionData, cardElement) {
    const token = localStorage.getItem('bribri_github_token');
    if (!token) {
        alert("Please provide your GitHub Token in Settings first.");
        settingsModal.classList.remove('hidden');
        return;
    }

    if (!confirm(`Are you sure you want to approve "${suggestionData.bribri}" and update the live dictionary?`)) return;

    cardElement.classList.add('processing');
    const approveBtn = cardElement.querySelector('.approve-btn');
    const originalText = approveBtn.textContent;
    approveBtn.textContent = "Publishing...";

    try {
        // 1. Fetch current dictionary.json from GitHub
        const apiUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/${FILE_PATH}`;
        const getRes = await fetch(apiUrl, {
            headers: {
                "Authorization": `token ${token}`,
                "Accept": "application/vnd.github.v3+json"
            }
        });

        if (!getRes.ok) throw new Error("Failed to fetch dictionary.json from GitHub. Check your token.");
        
        const fileData = await getRes.json();
        
        // GitHub sends content as base64. 
        // Need to decode, preserving UTF-8 chars (Bribri diacritics)
        const contentStr = decodeURIComponent(escape(atob(fileData.content)));
        const dictionary = JSON.parse(contentStr);

        // 2. Append new word
        // Try to guess the language of the translation to put it in the right array, 
        // or just put it in english for now and the admin can edit later if needed.
        // Or better, let's put it in both English and Spanish to be safe, or just English.
        const isHebrew = /[\u0590-\u05FF]/.test(suggestionData.translation);
        
        const newEntry = {
            bribri: suggestionData.bribri,
            english: isHebrew ? [] : [suggestionData.translation],
            spanish: isHebrew ? [] : [suggestionData.translation],
            hebrew: isHebrew ? [suggestionData.translation] : [],
            context: suggestionData.context || "",
            category: "Community Suggestion",
            source: suggestionData.contributor_name ? `Suggested by ${suggestionData.contributor_name}` : "Community Suggestion"
        };

        dictionary.push(newEntry);

        // 3. Save back to GitHub
        // Encode preserving UTF-8
        const newContentStr = JSON.stringify(dictionary, null, 4);
        const newContentBase64 = btoa(unescape(encodeURIComponent(newContentStr)));

        const putRes = await fetch(apiUrl, {
            method: "PUT",
            headers: {
                "Authorization": `token ${token}`,
                "Accept": "application/vnd.github.v3+json",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                message: `Add new word: ${suggestionData.bribri} (Admin Approved)`,
                content: newContentBase64,
                sha: fileData.sha
            })
        });

        if (!putRes.ok) throw new Error("Failed to commit the updated file to GitHub.");

        // 4. Delete from Firebase
        await deleteDoc(doc(db, "suggestions", id));

        // 5. Update UI
        cardElement.remove();
        updatePendingCount(-1);
        alert(`Successfully published "${suggestionData.bribri}"! The live app will update shortly.`);

    } catch (error) {
        console.error(error);
        alert("Error: " + error.message);
        approveBtn.textContent = originalText;
        cardElement.classList.remove('processing');
    }
}

async function handleDelete(id, cardElement) {
    if (!confirm("Are you sure you want to delete this suggestion?")) return;

    cardElement.classList.add('processing');
    
    try {
        await deleteDoc(doc(db, "suggestions", id));
        cardElement.remove();
        updatePendingCount(-1);
    } catch (error) {
        console.error("Error deleting document:", error);
        alert("Failed to delete suggestion.");
        cardElement.classList.remove('processing');
    }
}

function updatePendingCount(change) {
    let current = parseInt(pendingCount.textContent);
    current += change;
    pendingCount.textContent = current;
    
    if (current === 0) {
        suggestionsList.innerHTML = '<div class="loading">No pending suggestions. You are all caught up! 🎉</div>';
    }
}
