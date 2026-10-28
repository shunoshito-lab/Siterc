# Account di Radio Carducci — come metterlo online

Il sito da solo non riesce a ricordarsi di chi entra: quando è mostrato
dentro WordPress (iframe) molti browser bloccano o cancellano il salvataggio
locale. Questo Worker tiene i dati sul server di Cloudflare: preferiti,
ascolti e preferenze tornano ogni volta che fai login.

## Come funziona per chi usa il sito

1. Clicca **ACCEDI** in alto, poi **SONO NUOVO**.
2. Scrive nome e cognome. Riceve un codice tipo **Simone4821**.
3. Da quel momento, su qualsiasi telefono o computer, entra scrivendo solo il codice.

Il codice è utente e password insieme. Non è "Simone1": un codice così lo
indovina chiunque si chiami Simone. Con 4 cifre a caso e il limite di
30 tentativi all'ora per connessione, indovinarlo non conviene.

Salviamo solo nome + iniziale del cognome ("Simone P."), mai il cognome intero.
Il codice in Cloudflare non c'è: c'è solo la sua impronta (hash).

## Messa online (una volta sola, 10 minuti)

Serve Node installato e l'account Cloudflare che usate già per R2.

```bash
cd worker
npx wrangler login
npx wrangler kv namespace create ACCOUNTS
```

L'ultimo comando stampa un `id`: incollalo in `wrangler.toml` al posto di
`INCOLLA_QUI_ID_DEL_KV`. Poi:

```bash
npx wrangler deploy
```

Wrangler stampa l'indirizzo del Worker, tipo
`https://radiocarducci-account.<vostro-nome>.workers.dev`.

## Collegarlo al sito

Nel `config.json` su R2 aggiungete dentro `meta`:

```json
"accountApi": "https://radiocarducci-account.<vostro-nome>.workers.dev"
```

Oppure, se preferite, in `index.html` prima di `rc-account.js`:

```html
<script>window.RC_ACCOUNT_API = 'https://radiocarducci-account.<vostro-nome>.workers.dev';</script>
```

Finché l'indirizzo non c'è, il pulsante ACCEDI non compare e il sito
funziona come prima.

Se il sito si apre da un dominio diverso da quelli in `ALLOWED_ORIGINS`
(dentro `wrangler.toml`), aggiungetelo lì e rifate `npx wrangler deploy`.
