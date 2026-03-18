const oppgaveStruktur = {
    "2024-2025": {
        "Lesing": {
            "Høst": {
                "1": { grenseTotal: 20, oppgaver: [{navn: "Rim", maks: 6, grense: -1}, {navn: "Stavelser", maks: 8, grense: -1}, {navn: "Første lyd", maks: 8, grense: -1}, {navn: "Lik lyd", maks: 3, grense: -1}, {navn: "Lydering", maks: 4, grense: -1}, {navn: "Dele ord", maks: 4, grense: -1}] },
                "2": { grenseTotal: 16, oppgaver: [{navn: "Lese ord 1", maks: 4, grense: 3}, {navn: "Lese ord 2", maks: 9, grense: 6}, {navn: "Stave ord", maks: 5, grense: 3}, {navn: "Forstå 1", maks: 3, grense: 2}, {navn: "Forstå 2", maks: 5, grense: 2}] },
                "3": { grenseTotal: 20, oppgaver: [{navn: "Lese ord 1", maks: 7, grense: 6}, {navn: "Lese ord 2", maks: 12, grense: 6}, {navn: "Stave ord", maks: 7, grense: 4}, {navn: "Forstå 1", maks: 4, grense: 2}, {navn: "Forstå 2", maks: 3, grense: 2}] },
                "4": { grenseTotal: 20, oppgaver: [{navn: "Lese ord", maks: 15, grense: 10}, {navn: "Stave ord", maks: 7, grense: 4}, {navn: "Forstå 1", maks: 4, grense: 3}, {navn: "Forstå 2", maks: 5, grense: 3}] },
                "5": { grenseTotal: 25, oppgaver: [{navn: "Lese ord", maks: 18, grense: 15}, {navn: "Stave ord", maks: 7, grense: 4}, {navn: "Forstå 1", maks: 4, grense: 3}, {navn: "Forstå 2", maks: 5, grense: 3}] },
                "6": { grenseTotal: 30, oppgaver: [{navn: "Lese ord", maks: 21, grense: 17}, {navn: "Stave ord", maks: 7, grense: 5}, {navn: "Forstå 1", maks: 4, grense: 3}, {navn: "Forstå 2", maks: 6, grense: 5}] },
                "7": { grenseTotal: 30, oppgaver: [{navn: "Lese ord", maks: 21, grense: 17}, {navn: "Stave ord", maks: 7, grense: 5}, {navn: "Forstå 1", maks: 4, grense: 3}, {navn: "Forstå 2", maks: 7, grense: 5}] }
            },
            "Vår": {
                // Gjenbruker standard vår-oppsett for lesing
                "1": { grenseTotal: 11, oppgaver: [{navn: "Lese ord", maks: 6, grense: 5}, {navn: "Stave ord", maks: 5, grense: 3}, {navn: "Forstå", maks: 4, grense: 3}] },
                "2": { grenseTotal: 14, oppgaver: [{navn: "Lese ord 1", maks: 4, grense: 3}, {navn: "Lese ord 2", maks: 3, grense: 2}, {navn: "Stave ord", maks: 5, grense: 3}, {navn: "Forstå 1", maks: 3, grense: 2}, {navn: "Forstå 2", maks: 5, grense: 4}] },
                "3": { grenseTotal: 25, oppgaver: [{navn: "Lese ord 1", maks: 7, grense: 6}, {navn: "Lese ord 2", maks: 6, grense: 5}, {navn: "Forstå ord", maks: 5, grense: 4}, {navn: "Stave ord", maks: 7, grense: 4}, {navn: "Forstå 1", maks: 4, grense: 3}, {navn: "Forstå 2", maks: 5, grense: 3}] },
                "4": { grenseTotal: 20, oppgaver: [{navn: "Lese ord", maks: 9, grense: 6}, {navn: "Forstå ord", maks: 5, grense: 4}, {navn: "Stave ord", maks: 7, grense: 4}, {navn: "Forstå 1", maks: 4, grense: 3}, {navn: "Forstå 2", maks: 5, grense: 3}] },
                "5": { grenseTotal: 23, oppgaver: [{navn: "Lese ord", maks: 12, grense: 9}, {navn: "Forstå ord", maks: 6, grense: 3}, {navn: "Stave ord", maks: 7, grense: 4}, {navn: "Forstå 1", maks: 4, grense: 3}, {navn: "Forstå 2", maks: 6, grense: 4}] },
                "6": { grenseTotal: 27, oppgaver: [{navn: "Lese ord", maks: 15, grense: 12}, {navn: "Forstå ord", maks: 6, grense: 4}, {navn: "Stave ord", maks: 7, grense: 5}, {navn: "Forstå 1", maks: 4, grense: 3}, {navn: "Forstå 2", maks: 6, grense: 3}] },
                "7": { grenseTotal: 29, oppgaver: [{navn: "Lese ord", maks: 12, grense: 10}, {navn: "Forstå ord", maks: 9, grense: 7}, {navn: "Stave ord", maks: 7, grense: 5}, {navn: "Forstå 1", maks: 4, grense: 3}, {navn: "Forstå 2", maks: 6, grense: 4}] }
            }
        },
        "Regning": {
            "Høst": {
                "1": { grenseTotal: 13, oppgaver: Array(8).fill().map((_, i) => ({navn: "O"+(i+1), maks: [3,3,2,3,3,2,3,2][i], grense: -1})) },
                "2": { grenseTotal: 17, oppgaver: Array(10).fill().map((_, i) => ({navn: "O"+(i+1), maks: [4,3,3,3,6,3,4,3,4,4][i], grense: -1})) },
                "3": { grenseTotal: 22, oppgaver: Array(12).fill().map((_, i) => ({navn: "O"+(i+1), maks: [3,3,6,3,3,3,3,4,3,4,4,3][i], grense: -1})) },
                "4": { grenseTotal: 21, oppgaver: Array(14).fill().map((_, i) => ({navn: "O"+(i+1), maks: [4,2,3,4,4,16,6,3,6,1,3,4,1,1][i], grense: -1})) },
                "5": { grenseTotal: 19, oppgaver: Array(17).fill().map((_, i) => ({navn: "O"+(i+1), maks: [2,3,4,3,6,3,16,2,3,1,1,4,1,4,3,1,1][i], grense: -1})) },
                "6": { grenseTotal: 27, oppgaver: Array(16).fill().map((_, i) => ({navn: "O"+(i+1), maks: [2,3,6,3,6,3,16,2,6,4,1,3,1,4,1,1][i], grense: -1})) },
                "7": { grenseTotal: 33, oppgaver: Array(18).fill().map((_, i) => ({navn: "O"+(i+1), maks: [4,3,4,3,6,3,7,8,2,1,1,3,4,1,4,4,1,2][i], grense: -1})) }
            },
            "Vår": {
                "1": { grenseTotal: 26, oppgaver: Array(10).fill().map((_, i) => ({navn: "O"+(i+1), maks: [5,4,2,6,3,3,4,4,4,3][i], grense: -1})) },
                "2": { grenseTotal: 30, oppgaver: Array(12).fill().map((_, i) => ({navn: "O"+(i+1), maks: [5,6,4,3,3,6,3,3,4,3,8,8][i], grense: -1})) },
                "3": { grenseTotal: 32, oppgaver: Array(16).fill().map((_, i) => ({navn: "O"+(i+1), maks: [3,6,3,6,2,4,4,3,3,3,6,4,4,4,4,4][i], grense: -1})) },
                "4": { grenseTotal: 27, oppgaver: Array(16).fill().map((_, i) => ({navn: "O"+(i+1), maks: [4,6,3,4,4,4,16,6,3,6,3,3,3,1,1,2][i], grense: -1})) },
                "5": { grenseTotal: 24, oppgaver: Array(18).fill().map((_, i) => ({navn: "O"+(i+1), maks: [2,4,4,3,6,3,16,2,3,3,3,1,4,3,1,6,1,1][i], grense: -1})) },
                "6": { grenseTotal: 27, oppgaver: Array(16).fill().map((_, i) => ({navn: "O"+(i+1), maks: [2,4,4,3,6,3,16,2,6,1,3,4,1,1,1,4][i], grense: -1})) },
                "7": { grenseTotal: 35, oppgaver: Array(19).fill().map((_, i) => ({navn: "O"+(i+1), maks: [4,3,4,3,6,3,16,2,2,1,2,4,1,2,3,3,3,2,1][i], grense: -1})) }
            }
        }
    },
    "2025-2026": {
        "Lesing": {
            "Høst": {
                "1": { grenseTotal: 20, oppgaver: [{navn: "Rim", maks: 6, grense: -1}, {navn: "Stavelser", maks: 8, grense: -1}, {navn: "Første lyd", maks: 8, grense: -1}, {navn: "Lik lyd", maks: 3, grense: -1}, {navn: "Lydering", maks: 4, grense: -1}, {navn: "Dele ord", maks: 4, grense: -1}] },
                "2": { grenseTotal: 16, oppgaver: [{navn: "Lese ord 1", maks: 4, grense: 3}, {navn: "Lese ord 2", maks: 9, grense: 6}, {navn: "Stave ord", maks: 5, grense: 3}, {navn: "Forstå 1", maks: 3, grense: 2}, {navn: "Forstå 2", maks: 5, grense: 2}] },
                "3": { grenseTotal: 23, oppgaver: [{navn: "Lese ord 1", maks: 7, grense: 6}, {navn: "Lese ord 2", maks: 6, grense: 5}, {navn: "Forstå ord", maks: 5, grense: 4}, {navn: "Stave ord", maks: 7, grense: 4}, {navn: "Forstå 1", maks: 4, grense: 2}, {navn: "Forstå 2", maks: 3, grense: 2}] },
                "4": { grenseTotal: 20, oppgaver: [{navn: "Lese ord", maks: 9, grense: 6}, {navn: "Forstå ord", maks: 5, grense: 4}, {navn: "Stave ord", maks: 7, grense: 4}, {navn: "Forstå 1", maks: 4, grense: 3}, {navn: "Forstå 2", maks: 5, grense: 3}] },
                "5": { grenseTotal: 22, oppgaver: [{navn: "Lese ord", maks: 12, grense: 9}, {navn: "Forstå ord", maks: 6, grense: 3}, {navn: "Stave ord", maks: 7, grense: 4}, {navn: "Forstå 1", maks: 4, grense: 3}, {navn: "Forstå 2", maks: 5, grense: 3}] },
                "6": { grenseTotal: 27, oppgaver: [{navn: "Lese ord", maks: 15, grense: 12}, {navn: "Forstå ord", maks: 6, grense: 4}, {navn: "Stave ord", maks: 7, grense: 5}, {navn: "Forstå 1", maks: 4, grense: 3}, {navn: "Forstå 2", maks: 6, grense: 3}] },
                "7": { grenseTotal: 30, oppgaver: [{navn: "Lese ord", maks: 12, grense: 10}, {navn: "Forstå ord", maks: 9, grense: 7}, {navn: "Stave ord", maks: 7, grense: 5}, {navn: "Forstå 1", maks: 4, grense: 3}, {navn: "Forstå 2", maks: 7, grense: 5}] }
            },
            "Vår": {
                "1": { grenseTotal: 11, oppgaver: [{navn: "Lese ord", maks: 6, grense: 5}, {navn: "Stave ord", maks: 5, grense: 3}, {navn: "Forstå", maks: 4, grense: 3}] },
                "2": { grenseTotal: 14, oppgaver: [{navn: "Lese ord 1", maks: 4, grense: 3}, {navn: "Lese ord 2", maks: 3, grense: 2}, {navn: "Stave ord", maks: 5, grense: 3}, {navn: "Forstå 1", maks: 3, grense: 2}, {navn: "Forstå 2", maks: 5, grense: 4}] },
                "3": { grenseTotal: 25, oppgaver: [{navn: "Lese ord 1", maks: 7, grense: 6}, {navn: "Lese ord 2", maks: 6, grense: 5}, {navn: "Forstå ord", maks: 5, grense: 4}, {navn: "Stave ord", maks: 7, grense: 4}, {navn: "Forstå 1", maks: 4, grense: 3}, {navn: "Forstå 2", maks: 5, grense: 3}] },
                "4": { grenseTotal: 20, oppgaver: [{navn: "Lese ord", maks: 9, grense: 6}, {navn: "Forstå ord", maks: 5, grense: 4}, {navn: "Stave ord", maks: 7, grense: 4}, {navn: "Forstå 1", maks: 4, grense: 3}, {navn: "Forstå 2", maks: 5, grense: 3}] },
                "5": { grenseTotal: 23, oppgaver: [{navn: "Lese ord", maks: 12, grense: 9}, {navn: "Forstå ord", maks: 6, grense: 3}, {navn: "Stave ord", maks: 7, grense: 4}, {navn: "Forstå 1", maks: 4, grense: 3}, {navn: "Forstå 2", maks: 6, grense: 4}] },
                "6": { grenseTotal: 27, oppgaver: [{navn: "Lese ord", maks: 15, grense: 12}, {navn: "Forstå ord", maks: 6, grense: 4}, {navn: "Stave ord", maks: 7, grense: 5}, {navn: "Forstå 1", maks: 4, grense: 3}, {navn: "Forstå 2", maks: 6, grense: 3}] },
                "7": { grenseTotal: 29, oppgaver: [{navn: "Lese ord", maks: 12, grense: 10}, {navn: "Forstå ord", maks: 9, grense: 7}, {navn: "Stave ord", maks: 7, grense: 5}, {navn: "Forstå 1", maks: 4, grense: 3}, {navn: "Forstå 2", maks: 6, grense: 4}] }
            }
        },
        "Regning": {
            "Høst": {
                "1": { grenseTotal: 13, oppgaver: Array(8).fill().map((_, i) => ({navn: "O"+(i+1), maks: [3,3,2,3,3,2,3,2][i], grense: -1})) },
                "2": { grenseTotal: 17, oppgaver: Array(10).fill().map((_, i) => ({navn: "O"+(i+1), maks: [4,3,3,3,6,3,4,3,4,4][i], grense: -1})) },
                "3": { grenseTotal: 22, oppgaver: Array(12).fill().map((_, i) => ({navn: "O"+(i+1), maks: [3,3,6,3,3,3,3,4,3,4,4,3][i], grense: -1})) },
                "4": { grenseTotal: 21, oppgaver: Array(14).fill().map((_, i) => ({navn: "O"+(i+1), maks: [4,2,3,4,4,16,6,3,6,1,3,4,1,1][i], grense: -1})) },
                "5": { grenseTotal: 25, oppgaver: Array(17).fill().map((_, i) => ({navn: "O"+(i+1), maks: [2,3,4,3,6,3,16,2,3,1,1,4,1,4,3,1,1][i], grense: -1})) },
                "6": { grenseTotal: 27, oppgaver: Array(16).fill().map((_, i) => ({navn: "O"+(i+1), maks: [2,3,6,3,6,3,16,2,6,4,1,3,1,4,1,1][i], grense: -1})) },
                "7": { grenseTotal: 33, oppgaver: Array(18).fill().map((_, i) => ({navn: "O"+(i+1), maks: [4,3,4,3,6,3,7,8,2,1,1,3,4,1,4,4,1,2][i], grense: -1})) }
            },
            "Vår": {
                "1": { grenseTotal: 26, oppgaver: Array(10).fill().map((_, i) => ({navn: "O"+(i+1), maks: [5,4,2,6,3,3,4,4,4,3][i], grense: -1})) },
                "2": { grenseTotal: 30, oppgaver: Array(12).fill().map((_, i) => ({navn: "O"+(i+1), maks: [5,6,4,3,3,6,3,3,4,3,8,8][i], grense: -1})) },
                "3": { grenseTotal: 32, oppgaver: Array(16).fill().map((_, i) => ({navn: "O"+(i+1), maks: [3,6,3,6,2,4,4,3,3,3,6,4,4,4,4,4][i], grense: -1})) },
                "4": { grenseTotal: 27, oppgaver: Array(16).fill().map((_, i) => ({navn: "O"+(i+1), maks: [4,6,3,4,4,4,16,6,3,6,3,3,3,1,1,2][i], grense: -1})) },
                "5": { grenseTotal: 24, oppgaver: Array(18).fill().map((_, i) => ({navn: "O"+(i+1), maks: [2,4,4,3,6,3,16,2,3,3,3,1,4,3,1,6,1,1][i], grense: -1})) },
                "6": { grenseTotal: 27, oppgaver: Array(16).fill().map((_, i) => ({navn: "O"+(i+1), maks: [2,4,4,3,6,3,16,2,6,1,3,4,1,1,1,4][i], grense: -1})) },
                "7": { grenseTotal: 35, oppgaver: Array(19).fill().map((_, i) => ({navn: "O"+(i+1), maks: [4,3,4,3,6,3,16,2,2,1,2,4,1,2,3,3,3,2,1][i], grense: -1})) }
            }
        }
    }
};
