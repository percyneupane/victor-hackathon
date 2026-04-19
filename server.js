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
  code: { type: String, required: true }, // Removed unique:true
  name: { type: String, required: true },
  projectId: { type: String, required: true },
  score: { type: Number, required: true },
  votedAt: { type: Date, default: Date.now }
});

const Project = mongoose.model('Project', projectSchema);
const VoteRecord = mongoose.model('VoteRecordV2', voteRecordSchema); // Use V2 to avoid old unique index

// ── Valid codes & their weights ───────────────────────────────────────────────
const CODE_WEIGHTS = {
  'victorhacks': 1,
  'judge26': 2.5
};

// Seed project documents if they don't exist yet
const fs = require('fs');
let PROJECT_IDS = [];

async function seedProjects() {
  try {
    const data = fs.readFileSync(path.join(__dirname, 'projects.json'), 'utf8');
    const projects = JSON.parse(data);
    PROJECT_IDS = projects.map(p => p.id);
    
    for (const id of PROJECT_IDS) {
      await Project.findOneAndUpdate(
        { projectId: id },
        { $setOnInsert: { projectId: id, votes: 0 } },
        { upsert: true, new: true }
      );
    }
  } catch (err) {
    console.error('Failed to load projects.json for seeding:', err);
  }
}
mongoose.connection.once('open', seedProjects);

// ── Routes ────────────────────────────────────────────────────────────────────

// Validate a voting code; returns weight if valid, error if already used
app.post('/api/validate-code', async (req, res) => {
  try {
    const code = (req.body.code || '').toLowerCase().trim();
    const name = (req.body.name || '').trim();

    if (!CODE_WEIGHTS.hasOwnProperty(code)) {
      return res.status(400).json({ error: 'Invalid code.' });
    }

    if (!name) {
      return res.status(400).json({ error: 'Name is required.' });
    }

    // Get all projects this specific user has already voted for
    const existingVotes = await VoteRecord.find({ name });
    const votedProjects = {};
    existingVotes.forEach(v => {
      votedProjects[v.projectId] = v.score;
    });

    res.json({ valid: true, weight: CODE_WEIGHTS[code], votedProjects });
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
    const score = Number(req.body.score);

    if (!name) {
      return res.status(400).json({ error: 'Name is required.' });
    }

    if (!score || score < 1 || score > 5) {
      return res.status(400).json({ error: 'Score must be between 1 and 5.' });
    }

    // Validate code
    if (!CODE_WEIGHTS.hasOwnProperty(code)) {
      return res.status(400).json({ error: 'Invalid code.' });
    }

    // Validate project
    if (!PROJECT_IDS.includes(projectId)) {
      return res.status(400).json({ error: 'Invalid project.' });
    }

    // Check if THIS USER already voted for THIS PROJECT
    const existing = await VoteRecord.findOne({ name, projectId });
    if (existing) {
      return res.status(409).json({
        error: 'You have already voted for this project.',
        alreadyVoted: true,
        projectId
      });
    }

    // Create the vote record
    await VoteRecord.create({ code, name, projectId, score });

    // Increment vote count (score * weight)
    const weight = CODE_WEIGHTS[code];
    const addedVotes = score * weight;
    const project = await Project.findOneAndUpdate(
      { projectId },
      { $inc: { votes: addedVotes } },
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
