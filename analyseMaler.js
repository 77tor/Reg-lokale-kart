const analyseMaler = {
    "Lesing": {
        "1": {
            "Høst": {
                "tittel": "Fonologisk bevissthet",
                "beskrivelser": {
                    "Rim": "Måler auditiv diskriminasjon og evne til å lytte ut språklyder.",
                    "Stavelser": "Tester rytmisk deling og forståelse for ordets oppbygging.",
                    "Første lyd": "Kritisk ferdighet for bokstavinnlæring; å isolere startlyden i ord.",
                    "Lik lyd": "Måler evne til å gjenkjenne felles lyd i ulike ord.",
                    "Lydering": "Syntese-ferdighet; evnen til å trekke enkeltlyder sammen til et ord.",
                    "Dele ord": "Segmentering; å kunne bryte et ord ned i dets enkelte lyder."
                }
            },
            "Vår": {
                "tittel": "Leseferdigheter og rettskriving",
                "beskrivelser": {
                    "Lese ord": "Måler ordbildegjenkjenning og direkte dekoding.",
                    "Stave ord": "Tester lyd-bokstav-kobling og evne til å kode lyd til skrift.",
                    "Forstå": "Måler funksjonell lesing; å hente ut mening fra setninger."
                }
            }
        },
        "2": {
            "Høst": {
                "tittel": "Ordlesing og setningsforståelse",
                "beskrivelser": {
                    "Lese ord 1": "Hurtig gjenkjenning av høyfrekvente, lydrette ord.",
                    "Lese ord 2": "Dekoding av lengre ord med mer kompleks ortografi.",
                    "Stave ord": "Måler rettskriving og analyse av lyder i ord.",
                    "Forstå 1": "Lesing på setningsnivå med bilde-støtte.",
                    "Forstå 2": "Hente ut meningsinnhold i kortere tekster uten bilde-støtte."
                }
            },
            "Vår": {
                "tittel": "Automatisering og tekstforståelse",
                "beskrivelser": {
                    "Lese ord 1": "Automatisert lesing av vanlige ord.",
                    "Lese ord 2": "Presisjon i lesing av ord med morfologisk kompleksitet.",
                    "Stave ord": "Vurderer ortografisk sikkerhet og rettskrivingsregler.",
                    "Forstå 1": "Setningslesing med logisk slutning.",
                    "Forstå 2": "Tekstforståelse og evne til å finne informasjon i en sammenhengende tekst."
                }
            }
        },
        "3": {
            "Høst": {
                "tittel": "Leseflyt og begrepsforståelse",
                "beskrivelser": {
                    "Lese ord 1": "Måler flyt og automatisering av kjerneordforråd.",
                    "Lese ord 2": "Dekoding av fremmedord og komplekse ordstrukturer.",
                    "Forstå ord": "Begrepsforståelse; å koble ord til riktig definisjon eller kategori.",
                    "Stave ord": "Avansert rettskriving (stedsnavn, doble konsonanter, etc.).",
                    "Forstå 1": "Nærulesing og detaljforståelse i tekst.",
                    "Forstå 2": "Inferens; evnen til å trekke konklusjoner fra det man leser."
                }
            },
            "Vår": {
                "tittel": "Tekstoppfatning og dypere forståelse",
                "beskrivelser": {
                    "Lese ord 1": "Måler lesehastighet og presisjon i ordgjenkjenning.",
                    "Lese ord 2": "Flyt i lesing av lange og sammensatte ord.",
                    "Forstå ord": "Semantisk forståelse; forståelse av ord i ulike kontekster.",
                    "Stave ord": "Mestring av ortografiske mønstre og automatisert skriving.",
                    "Forstå 1": "Lese og følge instruksjoner/beskrivelser.",
                    "Forstå 2": "Overordnet tekstforståelse og tolking av tekstens budskap."
                }
            }
        },
        "4": {
            "Høst": {
                "tittel": "Automatisering og direkte henting",
                "beskrivelser": {
                    "Lese ord": "Måler hurtighet i ordgjenkjenning ved å skille sammensatte ord.",
                    "Forstå ord": "Tester evnen til å sette ord inn i riktig semantisk kontekst.",
                    "Stave ord": "Vurderer ortografisk selvsikkerhet i vanlige ord.",
                    "Forstå 1": "Måler presisjon i lesing av detaljer (bildevalg).",
                    "Forstå 2": "Tester evnen til å finne eksplisitt informasjon i en lengre sakprosatekst."
                }
            },
            "Vår": {
                "tittel": "Flyt og begrepsforståelse",
                "beskrivelser": {
                    "Lese ord": "Måler leseflyt og evne til å segmentere tekststrenger.",
                    "Forstå ord": "Tester dypere ordforståelse og kunnskap om definisjoner.",
                    "Stave ord": "Vurderer rettskriving av ord med mer kompleks struktur.",
                    "Forstå 1": "Måler evne til å tolke instruksjoner og detaljer.",
                    "Forstå 2": "Tester tekstforståelse og evne til å trekke slutninger fra fagtekst."
                }
            }
        },
        "5": {
            "Høst": {
                "tittel": "Ordforråd og informasjonsuthenting",
                "beskrivelser": {
                    "Lese ord": "Tester automatisering av komplekse ordstrukturer.",
                    "Forstå ord": "Måler kunnskap om synonymer og ordets betydningsnyanser.",
                    "Stave ord": "Vurderer mestring av doble konsonanter og stumme lyder.",
                    "Forstå 1": "Måler forståelse av sammensatte instruksjoner.",
                    "Forstå 2": "Tester evnen til å tolke grafiske framstillinger (infografikk) kombinert med tekst."
                }
            },
            "Vår": {
                "tittel": "Lesestrategier og teksttolking",
                "beskrivelser": {
                    "Lese ord": "Måler flyt i lesing av lavfrekvente og lange ord.",
                    "Forstå ord": "Avansert synonymforståelse og begrepsapparat.",
                    "Stave ord": "Vurderer sikkerhet i morfemisk stavemåte.",
                    "Forstå 1": "Tester evne til å lese og forstå sammenhenger i kortere avsnitt.",
                    "Forstå 2": "Måler evne til å lese lengre saktekster og identifisere hovedpoeng."
                }
            }
        },
        "6": {
            "Høst": {
                "tittel": "Tekstoppfatning og analyse",
                "beskrivelser": {
                    "Lese ord": "Måler automatisert lesing på høyt nivå.",
                    "Forstå ord": "Tester ordforrådets bredde gjennom synonymoppgaver.",
                    "Stave ord": "Vurderer presisjon i skriving av fremmedord og vanskelige ord.",
                    "Forstå 1": "Måler forståelse av implisitt informasjon i tekst.",
                    "Forstå 2": "Tester evnen til å sammenstille informasjon og forstå kontekst i lengre tekster."
                }
            },
            "Vår": {
                "tittel": "Dybdeforståelse og kildekritikk",
                "beskrivelser": {
                    "Lese ord": "Måler effektivitet i dekoding av ukjent tekst.",
                    "Forstå ord": "Tester presisjon i bruk av akademiske ord og begreper.",
                    "Stave ord": "Vurderer automatisert rettskriving i krevende tekst.",
                    "Forstå 1": "Måler evne til å tolke nyanser og forfatterens hensikt.",
                    "Forstå 2": "Tester forståelse av historiske eller naturvitenskapelige sammenhenger i tekst."
                }
            }
        },
        "7": {
            "Høst": {
                "tittel": "Avansert lesekompetanse",
                "beskrivelser": {
                    "Lese ord": "Høyeste nivå av automatisert ordgjenkjenning.",
                    "Forstå ord": "Måler modenhet i ordforråd og begrepsbruk.",
                    "Stave ord": "Vurderer fullstendig mestring av det norske rettskrivingssystemet.",
                    "Forstå 1": "Tester evne til å analysere komplekse setningsstrukturer.",
                    "Forstå 2": "Måler evnen til å lese kritisk og trekke avanserte logiske slutninger."
                }
            },
            "Vår": {
                "tittel": "Klar for ungdomsskolen - Funksjonell lesing",
                "beskrivelser": {
                    "Lese ord": "Måler lesehastighet og presisjon uten visuell støtte.",
                    "Forstå ord": "Tester forståelse av abstrakte begreper og synonymer.",
                    "Stave ord": "Vurderer evne til å stave korrekt under tidspress.",
                    "Forstå 1": "Måler tolkning av litterære virkemidler og subtekst.",
                    "Forstå 2": "Sluttevaluering av evnen til å navigere i og forstå komplekse informasjonstekster."
                }
            }
        }
    },
    "Regning": {
        "1": {
            "Høst": {
                "tittel": "Tallforståelse og telling",
                "beskrivelser": {
                    "Hvor mange": "Måler evne til telling og mengdeforståelse opp til 10.",
                    "Hvor mye": "Introduserer pengeverdi og enkel addisjon av små summer.",
                    "Tellestreker": "Tester overgangen mellom konkrete objekter og symbolske representasjoner.",
                    "Tallrekker": "Måler forståelse for tallenes rekkefølge og manglende ledd.",
                    "Rekkefølge": "Vurderer evnen til å sortere tall fra minst til størst.",
                    "Regn ut": "Grunnleggende addisjon med lave tallverdier."
                }
            },
            "Vår": {
                "tittel": "Posisjonssystemet og tallinjer",
                "beskrivelser": {
                    "Hvor mye": "Videreføring av pengeverdi med fokus på gjenkjenning av mynter.",
                    "Mangler": "Måler tallforståelse i tallområdet 0-20.",
                    "Kortet": "Tester mengdeforståelse og evne til å skrive siffer korrekt.",
                    "Tallinjen": "Måler visuell forståelse av tallenes plassering i forhold til hverandre.",
                    "Regn ut": "Enkel addisjon og subtraksjon uten overganger."
                }
            }
        },
        "2": {
            "Høst": {
                "tittel": "Tallverdier og mengder",
                "beskrivelser": {
                    "Hvor mange": "Måler rask telling og organisering av mengder.",
                    "Nærmeste tall": "Introduserer avrunding og forståelse for tallenes nærhet til tiere.",
                    "Størst verdi": "Tester sammenligning av tall og verdier (hvilket tall er størst).",
                    "Tiere og enere": "Grunnleggende forståelse for posisjonssystemet (plassverdi).",
                    "Regn ut": "Addisjon og subtraksjon i tallområdet 0-100 uten tieroverganger."
                }
            },
            "Vår": {
                "tittel": "Posisjon og halvparten/dobbelt",
                "beskrivelser": {
                    "Hvor mange": "Plassering av større tallverdier på tallinje.",
                    "Tallinjen": "Presisjonsmåling av tallforståelse på åpne tallinjer opp til 100/300.",
                    "Størst verdi": "Sammenligning av større pengebeløp (sedler og mynter).",
                    "Tiere og enere": "Decomposition; å dele opp tall i tiere og enere.",
                    "Halvparten": "Introduserer delingsbegrepet gjennom visuelle mengder.",
                    "Regn ut": "Addisjon og subtraksjon med fokus på tieroverganger."
                }
            }
        },
        "3": {
            "Høst": {
                "tittel": "Klokka og utvidet form",
                "beskrivelser": {
                    "Hvor mye": "Måler evne til å telle opp store pengebeløp (opp til 1000).",
                    "Tallinjen": "Plassering av tall på tallinjer med ulike intervaller.",
                    "Klokka": "Måler digital og analog tidsforståelse (hel/halv og fem over).",
                    "Nærmeste tall": "Vurderer overslagskunnskap og tallforståelse.",
                    "Utvidet form": "Dypere forståelse for plassverdi (f.eks. 232 = 200 + 30 + 2).",
                    "Regn ut": "Algoritmer for addisjon og subtraksjon med flersifrede tall."
                }
            },
            "Vår": {
                "tittel": "Stigende rekkefølge og komplekse utregninger",
                "beskrivelser": {
                    "Hvor mye": "Sammensatte pengeoppgaver med fokus på veksling og verdi.",
                    "Tallinjen": "Avansert bruk av tallinjen med fokus på de store tallene opp mot 1000.",
                    "Nærmeste tall": "Presisjonsvurdering av tallstørrelser.",
                    "Det dobbelte": "Tester forståelse for multiplikative sammenhenger (dobling).",
                    "Rekkefølge": "Sortering av store tallverdier (tresifrede tall).",
                    "Regn ut": "Oppstilt addisjon og subtraksjon med lån og overføring."
                }
            }
        },
        "4": {
            "Høst": {
                "tittel": "Tallforståelse og de fire regneartene",
                "beskrivelser": {
                    "Hvor mye": "Måler verdiforståelse og telling av større pengebeløp.",
                    "Tallinjen": "Plassering av tall i utvidet tallområde (opp til 10 000).",
                    "Klokka": "Måler digital/analog tid og tidsintervaller (hvor lenge er det til).",
                    "Nærmeste tall": "Vurderer overslag og avrunding til nærmeste hundrer/tusen.",
                    "Utvidet form": "Posisjonssystemet med fokus på tusenere, hundrere, tiere og enere.",
                    "Regn ut": "Blanding av addisjon, subtraksjon og introduksjon til multiplikasjonstabellen."
                }
            },
            "Vår": {
                "tittel": "Multiplikasjon og tallmønstre",
                "beskrivelser": {
                    "Hvor mye": "Sammensatte regneoppgaver med penger.",
                    "Tallinjen": "Måler presisjon på tallinjer med varierte intervaller.",
                    "Nærmeste tall": "Avrunding som strategi for rask hoderegning.",
                    "Det dobbelte": "Tester multiplikativ forståelse (2x).",
                    "Rekkefølge": "Sortering av fire- og femsifrede tall.",
                    "Regn ut": "Oppstilte stykker med fokus på multiplikasjon og divisjon."
                }
            }
        },
        "5": {
            "Høst": {
                "tittel": "Desimaltall og måling",
                "beskrivelser": {
                    "Hvor mye": "Bruk av desimaltall i praktisk kontekst (penger/måling).",
                    "Tallinjen": "Plassering av desimaltall og brøk på tallinjen.",
                    "Klokka": "Beregning av tid over midnatt og komplekse tidsenheter.",
                    "Nærmeste tall": "Avrunding av desimaltall til nærmeste hele tall.",
                    "Utvidet form": "Posisjonssystemet inkludert tideler og hundredeler.",
                    "Regn ut": "Algoritmer for alle fire regnearter med flersifrede tall."
                }
            },
            "Vår": {
                "tittel": "Brøkforståelse og geometri",
                "beskrivelser": {
                    "Hvor mye": "Problemløsing med flere ledd.",
                    "Tallinjen": "Avansert forståelse av forholdet mellom brøk, desimaltall og prosent.",
                    "Nærmeste tall": "Vurdering av størrelsesforhold i komplekse tall.",
                    "Det dobbelte": "Skalering og proporsjonalitet.",
                    "Rekkefølge": "Sammenligning av ulike tallsystemer (brøk vs desimal).",
                    "Regn ut": "Multiplikasjon og divisjon med store tall og desimaler."
                }
            }
        },
        "6": {
            "Høst": {
                "tittel": "Statistikk og koordinatsystemer",
                "beskrivelser": {
                    "Hvor mye": "Tolking av tabeller og grafiske framstillinger.",
                    "Tallinjen": "Måler forståelse for negative tall på tallinjen.",
                    "Klokka": "Tidssoner og hastighetsberegninger (fart/tid/vei).",
                    "Nærmeste tall": "Avrunding i vitenskapelig kontekst.",
                    "Utvidet form": "Eksponenter og grunntallsforståelse (10-potenser).",
                    "Regn ut": "Prioriteringsregler (parenteser og regnerekkefølge)."
                }
            },
            "Vår": {
                "tittel": "Forholdstall og sannsynlighet",
                "beskrivelser": {
                    "Hvor mye": "Beregning av rabatt, moms og prosentvise endringer.",
                    "Tallinjen": "Fininnstilling av verdier i komplekse koordinatsystemer.",
                    "Nærmeste tall": "Estimering som verktøy i problemløsing.",
                    "Det dobbelte": "Forholdstall og målestokk.",
                    "Rekkefølge": "Logisk sortering av variabler.",
                    "Regn ut": "Divisjon med desimaltall i både divisor og dividend."
                }
            }
        },
        "7": {
            "Høst": {
                "tittel": "Algebra og funksjoner",
                "beskrivelser": {
                    "Hvor mye": "Oppgaver med ukjente (enkel algebra).",
                    "Tallinjen": "Kontinuerlige tallmengder og intervaller.",
                    "Klokka": "Avansert logistikk og tidsplanlegging.",
                    "Nærmeste tall": "Signifikante sifre og presisjonsnivå.",
                    "Utvidet form": "Sammenheng mellom ulike representasjonsformer i matematikk.",
                    "Regn ut": "Sammensatte uttrykk med potenser og røtter."
                }
            },
            "Vår": {
                "tittel": "Klar for ungdomsskolen - Matematisk dypforståelse",
                "beskrivelser": {
                    "Hvor mye": "Integrerte oppgaver som krever flere matematiske strategier.",
                    "Tallinjen": "Abstrakte tallinjer og funksjonsforståelse.",
                    "Nærmeste tall": "Kritisk vurdering av svar ved bruk av overslag.",
                    "Det dobbelte": "Eksponentiell vekst vs lineær vekst.",
                    "Rekkefølge": "Kompleks sortering av reelle tall.",
                    "Regn ut": "Fullstendig mestring av de fire regneartene som forberedelse til videre skolegang."
                }
            }
        }
    }
};