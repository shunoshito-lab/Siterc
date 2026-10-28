# Canovacci in PDF, stile Radio Carducci

Ogni puntata è un file JSON in `dati/`. Lo script `genera.mjs` li trasforma
in PDF (in `assets/canovacci/`) e scrive `assets/canovacci/indice.json`,
che l'angolino Emergenza Emergenti / Cose da Nerd legge sul sito.

Formato di un file:

    {
      "programma": "cose-da-nerd" | "emergenza-emergenti",
      "titolo": "Demoscene",
      "data": "2026-04-08",
      "conduzione": "Simone e Marta",
      "ospite": "",
      "intro": "una riga sotto il titolo (facoltativa)",
      "blocchi": [
        { "tipo": "talk", "titolo": "Cos'è la Demoscene", "testo": ["paragrafo", "..."], "brano": "Artista - Titolo" },
        { "tipo": "scheda", "titolo": "Andrea Cristofori", "sezioni": [{ "titolo": "CHI È", "voci": ["...", "..."] }] }
      ]
    }

Nei testi, il contenuto tra parentesi tonde diventa la nota a margine RC
(la battuta in corsivo grigio).

Rigenerare tutto:

    node canovacci/genera.mjs
