document.addEventListener('DOMContentLoaded', function() {
    loadLeaderboard();
});

async function loadLeaderboard() {
    const leaderboardList = document.getElementById('leaderboardList');
    leaderboardList.innerHTML = '';

    const resultsFile = 'results/results.json';
    const resultsResponse = await fetch(resultsFile);
    const resultsData = await resultsResponse.json();
    const results = resultsData.matches;
    const qualifyingTeams = resultsData.qualifyingTeams;

    const predictionFiles = [
        'predictions/user1.xlsx',
        'predictions/user2.xlsx',
        // Add more user files as needed
    ];

    const scores = [];

    for (const file of predictionFiles) {
        const response = await fetch(file);
        const data = await response.arrayBuffer();

        const workbook = XLSX.read(new Uint8Array(data), { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const predictions = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        const score = calculateScore(predictions, results, qualifyingTeams);
        scores.push({ user: file.split('/').pop().replace('.xlsx', ''), score: score });
    }

    scores.sort((a, b) => b.score - a.score);

    for (const score of scores) {
        const listItem = document.createElement('li');
        listItem.textContent = `${score.user}: ${score.score} points`;
        leaderboardList.appendChild(listItem);
    }
}

function calculateScore(predictions, results, qualifyingTeams) {
    let score = 0;
    const today = new Date();

    predictions.forEach(prediction => {
        if (prediction[0] && !isNaN(prediction[0])) {
            const date = convertExcelDate(prediction[0]);
            if (date > today) {
                return; // Skip future games
            }

            const team1 = normalizeTeamName(prediction[1]);
            const team1Score = prediction[2];
            const team2Score = prediction[3];
            const team2 = normalizeTeamName(prediction[4]);

            const result = results.find(result => {
                const resultDate = new Date(result.Date).toISOString().split('T')[0];
                const predictionDate = new Date(date).toISOString().split('T')[0];
                const teamsMatch = (normalizeTeamName(result.Team1) === team1 && normalizeTeamName(result.Team2) === team2) ||
                    (normalizeTeamName(result.Team1) === team2 && normalizeTeamName(result.Team2) === team1);

                return resultDate === predictionDate && teamsMatch;
            });

            if (result) {
                const predictedOutcome = team1Score > team2Score ? 'win' : team1Score < team2Score ? 'lose' : 'draw';
                const actualOutcome = result.Team1Score > result.Team2Score ? 'win' : result.Team1Score < result.Team2Score ? 'lose' : 'draw';

                if (predictedOutcome === actualOutcome) {
                    score += result.CorrectOutcomePoints;
                    if (result.Team1Score === team1Score && result.Team2Score === team2Score) {
                        score += result.ExactScorePoints;
                    }
                }
            } else {
                console.log('No match found');
            }
        }
    });

    // Extra points for predicting qualifying teams
    const stages = ['Round of 16', 'Quarter-finals', 'Semi-finals', 'Final'];
    const qualifyingPoints = { 'Round of 16': 3, 'Quarter-finals': 5, 'Semi-finals': 7, 'Final': 10 };

    stages.forEach(stage => {
        const predictedTeams = predictions.filter(prediction => prediction.includes(stage)).map(prediction => normalizeTeamName(prediction[1]));
        const actualTeams = qualifyingTeams[stage] || [];

        predictedTeams.forEach(team => {
            if (actualTeams.includes(team)) {
                score += qualifyingPoints[stage];
            }
        });
    });

    // Extra points for predicting the winner
    const predictedWinner = normalizeTeamName(predictions.find(prediction => prediction.includes('Winner'))?.[1]);
    const actualWinner = normalizeTeamName(qualifyingTeams['Winner']);

    if (predictedWinner && predictedWinner === actualWinner) {
        score += 12;
    }

    return score;
}

function convertExcelDate(serial) {
    const utc_days = Math.floor(serial - 25569);
    const utc_value = utc_days * 86400;
    const date_info = new Date(utc_value * 1000);

    const fractional_day = serial - Math.floor(serial) + 0.0000001;

    let total_seconds = Math.floor(86400 * fractional_day);

    const seconds = total_seconds % 60;

    total_seconds -= seconds;

    const hours = Math.floor(total_seconds / (60 * 60));
    const minutes = Math.floor(total_seconds / 60) % 60;

    return new Date(date_info.getFullYear(), date_info.getMonth(), date_info.getDate(), hours, minutes, seconds);
}

function normalizeTeamName(team) {
    return team ? team.trim().toLowerCase() : '';
}
