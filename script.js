// ── Config ────────────────────────────────────────────────────────────────────
// CHANGE THIS URL to your live Render URL once deployed (e.g., 'https://victor-hackathon.onrender.com/api')
const API = 'https://victor-hackathon-backend.onrender.com/api';

// Current user state
let currentUser = {
  code: null,
  name: null,
  voteWeight: 0,
  hasVoted: false,
  votedProjectId: null
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function setStatus(msg, type) {
  const el = document.getElementById('codeStatus');
  el.className = `status-message ${type}`;
  el.textContent = msg;
}

function setAllVoteBtnsDisabled(disabled) {
  document.querySelectorAll('.vote-btn').forEach(btn => {
    btn.disabled = disabled;
    if (disabled) {
      btn.style.opacity = '0.5';
      btn.style.cursor = 'not-allowed';
    } else {
      btn.style.opacity = '';
      btn.style.cursor = '';
    }
  });
}

function markVotedCard(projectId) {
  // Highlight the card that was voted for; grey out everything else
  document.querySelectorAll('.project-card').forEach(card => {
    const btn = card.querySelector('.vote-btn');
    if (card.dataset.projectId === projectId) {
      card.classList.add('voted-card');
      btn.textContent = '✅ Voted!';
      btn.disabled = true;
    } else {
      btn.disabled = true;
      btn.style.opacity = '0.45';
    }
  });
}

// ── Load vote counts from MongoDB ─────────────────────────────────────────────
async function loadVoteCounts() {
  try {
    const res = await fetch(`${API}/votes`);
    const data = await res.json();
    Object.entries(data).forEach(([projectId, votes]) => {
      const card = document.querySelector(`[data-project-id="${projectId}"]`);
      if (card) card.querySelector('.vote-count').textContent = votes;
    });
  } catch (err) {
    console.error('Failed to load vote counts:', err);
  }
}

// ── Submit the access code ────────────────────────────────────────────────────
async function setVotingCode() {
  const name = document.getElementById('voterName').value.trim();
  const code = document.getElementById('votingCode').value.trim();

  if (!name) {
    setStatus('❌ Please enter your name.', 'error');
    return;
  }

  if (!code) {
    setStatus('❌ Please enter your access code.', 'error');
    return;
  }

  setStatus('⏳ Validating…', '');

  try {
    const res = await fetch(`${API}/validate-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });
    const data = await res.json();

    if (!res.ok) {
      if (data.alreadyVoted) {
        // Code already used — show the app in "already voted" state
        currentUser = { code, name, voteWeight: 0, hasVoted: true, votedProjectId: data.projectId };
        showVotingSection();
        markVotedCard(data.projectId);
        setStatus('⚠️ This code has already been used to cast a vote.', 'error');
      } else {
        setStatus(`❌ ${data.error}`, 'error');
      }
      return;
    }

    // Valid, unused code
    currentUser = { code, name, voteWeight: data.weight, hasVoted: false, votedProjectId: null };
    showVotingSection();
    setStatus(`✅ Access granted! Vote weight: ${data.weight}`, 'success');

  } catch (err) {
    setStatus('❌ Could not reach the server. Is it running?', 'error');
    console.error(err);
  }
}

function showVotingSection() {
  document.getElementById('votingSection').style.display = 'block';
  document.getElementById('userInfo').textContent =
    `👤 Name: ${currentUser.name} | Code: ${currentUser.code.toUpperCase()} | Vote weight: ${currentUser.voteWeight || '—'}`;
  document.getElementById('userInfo').style.display = 'block';
  document.getElementById('votingCode').disabled = true;
  document.getElementById('voterName').disabled = true;
  document.querySelector('.auth-section button').disabled = true;
}

// ── Cast a vote ───────────────────────────────────────────────────────────────
async function vote(projectId) {
  if (!currentUser.code) {
    alert('Please enter your access code first!');
    return;
  }

  if (currentUser.hasVoted) {
    alert('You have already cast your vote!');
    return;
  }

  // Optimistic UI — disable all buttons while request is in-flight
  setAllVoteBtnsDisabled(true);

  try {
    const res = await fetch(`${API}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: currentUser.code, name: currentUser.name, projectId })
    });
    const data = await res.json();

    if (!res.ok) {
      if (data.alreadyVoted) {
        currentUser.hasVoted = true;
        currentUser.votedProjectId = data.projectId;
        markVotedCard(data.projectId);
        setStatus('⚠️ This code has already been used to cast a vote.', 'error');
      } else {
        setStatus(`❌ ${data.error}`, 'error');
        setAllVoteBtnsDisabled(false);
      }
      return;
    }

    // Success
    currentUser.hasVoted = true;
    currentUser.votedProjectId = projectId;

    // Update the voted card's count in the UI
    const card = document.querySelector(`[data-project-id="${projectId}"]`);
    if (card) card.querySelector('.vote-count').textContent = data.votes;

    markVotedCard(projectId);
    setStatus(`🎉 Your vote for project ${projectId} has been recorded!`, 'success');

  } catch (err) {
    setStatus('❌ Could not reach the server. Please try again.', 'error');
    setAllVoteBtnsDisabled(false);
    console.error(err);
  }
}

// ── Reset (change code) ───────────────────────────────────────────────────────
function resetVoting() {
  if (!confirm('Are you sure you want to switch access codes?')) return;

  currentUser = { code: null, name: null, voteWeight: 0, hasVoted: false, votedProjectId: null };

  document.getElementById('voterName').value = '';
  document.getElementById('voterName').disabled = false;
  document.getElementById('votingCode').value = '';
  document.getElementById('votingCode').disabled = false;
  document.querySelector('.auth-section button').disabled = false;
  document.getElementById('votingSection').style.display = 'none';
  document.getElementById('userInfo').style.display = 'none';
  document.getElementById('codeStatus').textContent = '';
  document.getElementById('codeStatus').className = 'status-message';

  // Reset all card states
  document.querySelectorAll('.project-card').forEach(card => {
    card.classList.remove('voted-card');
    const btn = card.querySelector('.vote-btn');
    btn.textContent = 'Vote';
    btn.disabled = false;
    btn.style.opacity = '';
    btn.style.cursor = '';
  });

  loadVoteCounts();
}

// ── Init ──────────────────────────────────────────────────────────────────────
window.addEventListener('load', loadVoteCounts);
