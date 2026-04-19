require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ── MongoDB Connection ────────────────────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hackathon-voting')
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// ── Schemas ───────────────────────────────────────────────────────────────────

// Tracks each project's total votes
const projectSchema = new mongoose.Schema({
  projectId: { type: String, required: true, unique: true },
  votes: { type: Number, default: 0 }
});

const voteRecordSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  projectId: { type: String, required: true },
  votedAt: { type: Date, default: Date.now }
});

const Project = mongoose.model('Project', projectSchema);
const VoteRecord = mongoose.model('VoteRecord', voteRecordSchema);

// ── Valid codes & their weights ───────────────────────────────────────────────
const CODE_WEIGHTS = {
  'vote2024': 1,
  'judge': 5
};

// Seed project documents if they don't exist yet
const PROJECT_IDS = ['PROJ-001', 'PROJ-002', 'PROJ-003', 'PROJ-004', 'PROJ-005', 'PROJ-006'];

async function seedProjects() {
  for (const id of PROJECT_IDS) {
    await Project.findOneAndUpdate(
      { projectId: id },
      { $setOnInsert: { projectId: id, votes: 0 } },
      { upsert: true, new: true }
    );
  }
}
mongoose.connection.once('open', seedProjects);

// ── Routes ────────────────────────────────────────────────────────────────────

// Validate a voting code; returns weight if valid, error if already used
app.post('/api/validate-code', async (req, res) => {
  try {
    const code = (req.body.code || '').toLowerCase().trim();

    if (!CODE_WEIGHTS.hasOwnProperty(code)) {
      return res.status(400).json({ error: 'Invalid code.' });
    }

    // Check if this code already voted
    const existing = await VoteRecord.findOne({ code });
    if (existing) {
      return res.status(409).json({
        error: `This code has already been used to vote for project ${existing.projectId}.`,
        alreadyVoted: true,
        projectId: existing.projectId
      });
    }

    res.json({ valid: true, weight: CODE_WEIGHTS[code] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// Fetch all vote counts
app.get('/api/votes', async (req, res) => {
  try {
    const projects = await Project.find({}, 'projectId votes -_id');
    const result = {};
    projects.forEach(p => { result[p.projectId] = p.votes; });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// Cast a vote
app.post('/api/vote', async (req, res) => {
  try {
    const code = (req.body.code || '').toLowerCase().trim();
    const name = (req.body.name || '').trim();
    const projectId = (req.body.projectId || '').trim();

    if (!name) {
      return res.status(400).json({ error: 'Name is required.' });
    }

    // Validate code
    if (!CODE_WEIGHTS.hasOwnProperty(code)) {
      return res.status(400).json({ error: 'Invalid code.' });
    }

    // Validate project
    if (!PROJECT_IDS.includes(projectId)) {
      return res.status(400).json({ error: 'Invalid project.' });
    }

    // Enforce one-vote-per-code (atomic upsert)
    try {
      await VoteRecord.create({ code, name, projectId });
    } catch (dupErr) {
      if (dupErr.code === 11000) {
        const existing = await VoteRecord.findOne({ code });
        return res.status(409).json({
          error: 'You have already voted.',
          alreadyVoted: true,
          projectId: existing.projectId
        });
      }
      throw dupErr;
    }

    // Increment vote count
    const weight = CODE_WEIGHTS[code];
    const project = await Project.findOneAndUpdate(
      { projectId },
      { $inc: { votes: weight } },
      { new: true }
    );

    res.json({ success: true, projectId, votes: project.votes, weight });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
