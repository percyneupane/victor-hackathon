// ── Config ────────────────────────────────────────────────────────────────────
// CHANGE THIS URL to your live Render URL once deployed (e.g., 'https://victor-hackathon.onrender.com/api')
const API = 'https://victor-hackathon-backend.onrender.com/api';

// Current user state
let currentUser = {
  code: null,
  name: null,
  voteWeight: 0,
  votedProjects: {}
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

function markVotedCard(projectId, score) {
  const card = document.querySelector(`[data-project-id="${projectId}"]`);
  if (card) {
    card.classList.add('voted-card');
    const btn = card.querySelector('.vote-btn');
    if (btn) {
      btn.textContent = '✅ Voted!';
      btn.disabled = true;
    }
    const select = card.querySelector('.score-selector');
    if (select) {
      select.value = score;
      select.disabled = true;
    }
    const voteCount = card.querySelector('.vote-count');
    if (voteCount) voteCount.textContent = score;
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
      body: JSON.stringify({ code, name })
    });
    const data = await res.json();

    if (!res.ok) {
      setStatus(`❌ ${data.error}`, 'error');
      return;
    }

    // Valid code
    currentUser = { code, name, voteWeight: data.weight, votedProjects: data.votedProjects || {} };
    showVotingSection();
    setStatus(`✅ Access granted! You can now vote for each project.`, 'success');

    // Mark previously voted projects
    Object.entries(currentUser.votedProjects).forEach(([pid, score]) => markVotedCard(pid, score));

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

  if (currentUser.votedProjects.hasOwnProperty(projectId)) {
    alert('You have already voted for this project!');
    return;
  }

  const scoreSelect = document.getElementById(`score-${projectId}`);
  const score = scoreSelect ? parseInt(scoreSelect.value) : 0;

  if (!score || score < 1 || score > 5) {
    alert('Please select a valid score (1-5)!');
    return;
  }

  // Disable button while request is in-flight
  const card = document.querySelector(`[data-project-id="${projectId}"]`);
  const btn = card.querySelector('.vote-btn');
  btn.disabled = true;

  try {
    const res = await fetch(`${API}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: currentUser.code, name: currentUser.name, projectId, score })
    });
    const data = await res.json();

    if (!res.ok) {
      setStatus(`❌ ${data.error}`, 'error');
      btn.disabled = false;
      return;
    }

    // Success
    currentUser.votedProjects[projectId] = score;

    markVotedCard(projectId, score);
    setStatus(`🎉 Your score for project ${projectId} has been recorded!`, 'success');

  } catch (err) {
    setStatus('❌ Could not reach the server. Please try again.', 'error');
    btn.disabled = false;
    console.error(err);
  }
}

// ── Reset (change code) ───────────────────────────────────────────────────────
function resetVoting() {
  if (!confirm('Are you sure you want to switch access codes?')) return;

  currentUser = { code: null, name: null, voteWeight: 0, votedProjects: {} };

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
    if (btn) {
      btn.textContent = 'Vote';
      btn.disabled = false;
      btn.style.opacity = '';
      btn.style.cursor = '';
    }
    const select = card.querySelector('.score-selector');
    if (select) {
      select.value = "5";
      select.disabled = false;
    }
    const voteCount = card.querySelector('.vote-count');
    if (voteCount) voteCount.textContent = '-';
  });
}
