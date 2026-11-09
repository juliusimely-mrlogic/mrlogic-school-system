// Injini ya Kuhesabu Alama za NECTA (CSEE & ACSEE)

function getOLevelGrade(marks) {
    if (marks >= 75) return { grade: 'A', points: 1 };
    if (marks >= 65) return { grade: 'B', points: 2 };
    if (marks >= 45) return { grade: 'C', points: 3 };
    if (marks >= 30) return { grade: 'D', points: 4 };
    return { grade: 'F', points: 5 };
}

function getALevelGrade(marks) {
    if (marks >= 80) return { grade: 'A', points: 1 };
    if (marks >= 70) return { grade: 'B', points: 2 };
    if (marks >= 60) return { grade: 'C', points: 3 };
    if (marks >= 50) return { grade: 'D', points: 4 };
    if (marks >= 40) return { grade: 'E', points: 5 };
    if (marks >= 35) return { grade: 'S', points: 6 };
    return { grade: 'F', points: 7 };
}

function calculateDivisionOLevel(best7Points) {
    const sum = best7Points.reduce((a, b) => a + b, 0);
    if (sum >= 7 && sum <= 17) return { division: 'I', points: sum };
    if (sum >= 18 && sum <= 21) return { division: 'II', points: sum };
    if (sum >= 22 && sum <= 25) return { division: 'III', points: sum };
    if (sum >= 26 && sum <= 33) return { division: 'IV', points: sum };
    return { division: '0', points: sum };
}

function calculateDivisionALevel(principalPoints) {
    const sum = principalPoints.reduce((a, b) => a + b, 0);
    if (sum >= 3 && sum <= 9) return { division: 'I', points: sum };
    if (sum >= 10 && sum <= 12) return { division: 'II', points: sum };
    if (sum >= 13 && sum <= 17) return { division: 'III', points: sum };
    if (sum >= 18 && sum <= 19) return { division: 'IV', points: sum };
    return { division: '0', points: sum };
}

// Kazi kuu ya kuchakata matokeo ya mwanafunzi mmoja
function processStudentResults(results, levelType) {
    let subjectResults = [];
    let totalPoints = 0;
    let totalMarks = 0;

    results.forEach(r => {
        // Tunadhani marks ziko kwenye asilimia (0-100)
        const mark = r.marks;
        let gradeInfo = levelType === 'A_LEVEL' ? getALevelGrade(mark) : getOLevelGrade(mark);
        
        subjectResults.push({
            subject_name: r.subject_name,
            marks: mark,
            grade: gradeInfo.grade,
            points: gradeInfo.points,
            is_principal: r.a_level_role === 'PRINCIPAL' // Kwa ajili ya A-Level
        });
        totalMarks += mark;
    });

    // Panga masomo kwa pointi (ndogo hadi kubwa) kupata bora
    subjectResults.sort((a, b) => a.points - b.points);

    let divisionInfo = { division: '-', points: 0 };
    let gpa = 0;

    if (levelType === 'A_LEVEL') {
        // A-Level: Chukua masomo 3 ya Principal pekee
        const principalSubjects = subjectResults.filter(s => s.is_principal).slice(0, 3);
        const principalPoints = principalSubjects.map(s => s.points);
        divisionInfo = calculateDivisionALevel(principalPoints);
        gpa = principalPoints.length > 0 ? (divisionInfo.points / principalSubjects.length).toFixed(2) : 0;
    } else {
        // O-Level: Chukua masomo 7 bora
        const best7 = subjectResults.slice(0, 7);
        const best7Points = best7.map(s => s.points);
        divisionInfo = calculateDivisionOLevel(best7Points);
        gpa = best7.length > 0 ? (divisionInfo.points / best7.length).toFixed(2) : 0;
    }

    return {
        subjects: subjectResults,
        totalMarks: totalMarks,
        division: divisionInfo.division,
        aggregatePoints: divisionInfo.points,
        gpa: gpa
    };
}

module.exports = { processStudentResults };