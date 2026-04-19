// Voting system data
const votingData = {
    'PROJ-001': 0,
    'PROJ-002': 0,
    'PROJ-003': 0,
    'PROJ-004': 0,
    'PROJ-005': 0,
    'PROJ-006': 0
};

// Voting code multipliers
const codeMultipliers = {
    'students': 1,
    'admin': 5
};

// Current user state
let currentUser = {
    code: null,
    voteWeight: 0
};

// Load data from localStorage on page load
function loadData() {
    const savedData = localStorage.getItem('votingData');
    if (savedData) {
        Object.assign(votingData, JSON.parse(savedData));
        updateAllVoteCounts();
    }
}

// Save data to localStorage
function saveData() {
    localStorage.setItem('votingData', JSON.stringify(votingData));
}

// Set voting code
function setVotingCode() {
    const code = document.getElementById('votingCode').value.toLowerCase().trim();
    const statusDiv = document.getElementById('codeStatus');
    
    if (!code) {
        statusDiv.className = 'status-message error';
        statusDiv.textContent = '❌ Please enter a code';
        return;
    }
    
    if (!codeMultipliers.hasOwnProperty(code)) {
        statusDiv.className = 'status-message error';
        statusDiv.textContent = '❌ Invalid code. Use "students" or "admin"';
        return;
    }
    
    // Set current user
    currentUser.code = code;
    currentUser.voteWeight = codeMultipliers[code];
    
    // Update UI
    statusDiv.className = 'status-message success';
    statusDiv.textContent = `✅ Code accepted! Your vote weight: ${currentUser.voteWeight} vote(s)`;
    
    // Show voting section
    document.getElementById('votingSection').style.display = 'block';
    document.getElementById('userInfo').textContent = `👤 Code: ${code.toUpperCase()} | Vote Weight: ${currentUser.voteWeight}`;
    document.getElementById('userInfo').style.display = 'block';
    
    // Disable code input
    document.getElementById('votingCode').disabled = true;
    document.querySelector('.auth-section button').disabled = true;
}

// Update vote count for a specific project
function updateVoteCount(projectId) {
    const card = document.querySelector(`[data-project-id="${projectId}"]`);
    const voteCountElement = card.querySelector('.vote-count');
    voteCountElement.textContent = votingData[projectId];
}

// Update all vote counts
function updateAllVoteCounts() {
    Object.keys(votingData).forEach(projectId => {
        updateVoteCount(projectId);
    });
}

// Cast a vote
function vote(projectId) {
    if (!currentUser.code) {
        alert('Please enter a voting code first!');
        return;
    }
    
    if (!votingData.hasOwnProperty(projectId)) {
        alert('Invalid project ID');
        return;
    }
    
    // Add votes based on code weight
    votingData[projectId] += currentUser.voteWeight;
    
    // Update UI
    updateVoteCount(projectId);
    
    // Save data
    saveData();
    
    // Show feedback
    showVoteFeedback(projectId);
}

// Show vote feedback
function showVoteFeedback(projectId) {
    const card = document.querySelector(`[data-project-id="${projectId}"]`);
    const btn = card.querySelector('.vote-btn');
    const originalText = btn.textContent;
    
    btn.textContent = `✅ +${currentUser.voteWeight} vote(s)!`;
    btn.style.background = '#4caf50';
    
    setTimeout(() => {
        btn.textContent = originalText;
        btn.style.background = '';
    }, 1500);
}

// Reset voting (change code)
function resetVoting() {
    if (confirm('Are you sure you want to change your voting code?')) {
        currentUser = {
            code: null,
            voteWeight: 0
        };
        
        document.getElementById('votingCode').value = '';
        document.getElementById('votingCode').disabled = false;
        document.querySelector('.auth-section button').disabled = false;
        document.getElementById('votingSection').style.display = 'none';
        document.getElementById('userInfo').style.display = 'none';
        document.getElementById('codeStatus').textContent = '';
    }
}

// Initialize app on page load
window.addEventListener('load', loadData);
