import pymongo
import pandas as pd
import matplotlib.pyplot as plt
from dotenv import load_dotenv
import os
import json

print("🏆 Hackathon Results")
print("Connecting to live MongoDB database...")

# Load MONGODB_URI from .env
load_dotenv()
MONGODB_URI = os.getenv('MONGODB_URI')

if not MONGODB_URI:
    print("Error: MONGODB_URI not found in .env file!")
    exit(1)

client = pymongo.MongoClient(MONGODB_URI)

# Mongoose might connect to 'test' or 'hackathon-voting' depending on exact URI.
db_test = client['test']
db_hackathon = client['hackathon-voting']
print("✅ Connected to MongoDB!\n")

# 1. Load project definitions to map IDs to Names
with open('projects.json', 'r') as f:
    projects_list = json.load(f)

projects_dict = {p['id']: p['name'] for p in projects_list}

# 2. Define the exact valid codes and their weights
CODE_WEIGHTS = {
    'victorhacks': 1.0,
    'judge26': 2.5
}

# 3. Fetch raw vote records
raw_votes = []
for db in [db_test, db_hackathon]:
    for col_name in ['voterecordv2', 'voterecordv2s', 'voterecords']:
        if col_name in db.list_collection_names():
            votes = list(db[col_name].find({}))
            raw_votes.extend(votes)

if len(raw_votes) == 0:
    print("⚠️ No votes have been cast yet! Try voting on the app first.")
    exit(0)

print(f"Found {len(raw_votes)} total vote records!\n")

# 4. Calculate total weighted score from scratch
project_totals = {pid: 0 for pid in projects_dict.keys()}

for vote in raw_votes:
    code = vote.get('code', '').lower()
    pid = vote.get('projectId')
    score = vote.get('score', 0)
    
    # We only count it if it was cast using the brand new codes!
    if code in CODE_WEIGHTS and pid in project_totals:
        weight = CODE_WEIGHTS[code]
        project_totals[pid] += (score * weight)

df = pd.DataFrame(list(project_totals.items()), columns=['projectId', 'votes'])
df['Project Name'] = df['projectId'].map(projects_dict)

# Sort descending
df = df.sort_values(by='votes', ascending=False).reset_index(drop=True)

# Filter out ineligible projects (e.g. CarbonCredible PROJ-002)
ineligible_ids = ['PROJ-002']
eligible_df = df[~df['projectId'].isin(ineligible_ids)].reset_index(drop=True)

if eligible_df.empty or eligible_df['votes'].sum() == 0:
    print("No valid votes have been cast for eligible projects yet.")
else:
    winner = eligible_df.iloc[0]
    print("*"*40)
    print(f"🏆 THE WINNER IS: {winner['Project Name']}!")
    print(f"Total Weighted Score: {winner['votes']}")
    print("*"*40 + "\n")
    
    print("Runner Ups:")
    print(eligible_df.iloc[1:4][['Project Name', 'votes']].to_string(index=False))

print("\nGenerating visualization...")
if df['votes'].sum() > 0:
    plt.figure(figsize=(10, 6))
    bars = plt.bar(df['Project Name'], df['votes'], color='#667eea')
    plt.xlabel('Projects', fontsize=12)
    plt.ylabel('Total Weighted Score', fontsize=12)
    plt.title('Final Hackathon Voting Results', fontsize=16)
    plt.xticks(rotation=45, ha='right')

    # Add values on top of bars
    for bar in bars:
        yval = bar.get_height()
        plt.text(bar.get_x() + bar.get_width()/2, yval + 0.1, yval, ha='center', va='bottom', fontweight='bold')

    plt.tight_layout()
    plt.show()
