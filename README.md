# Pomodúo

Pomodoro-timer voor twee: Margot (links) en Thomas (rechts). Beide timers zijn vanaf elk apparaat te zien en te bedienen, live gesynchroniseerd via Firebase Realtime Database. Gehost op GitHub Pages.

## Bestanden

| Bestand | Wat |
|---|---|
| `index.html`, `app.js`, `style.css` | De timerpagina |
| `stats.html`, `stats.js`, `stats.css` | Statistiekenpagina (per dag / per week) |
| `db.js` | Koppeling met Firebase (of lokale modus zonder Firebase) |
| `config.js` | **Hier komt je Firebase-configuratie** |
| `database.rules.json` | Beveiligingsregels voor de Realtime Database |

## Eenmalige setup

### 1. Firebase (± 5 min)
1. Ga naar <https://console.firebase.google.com> → **Project maken** → naam `pomoduo` → Google Analytics uit.
2. **Build → Realtime Database → Database maken** → locatie `europe-west1 (Belgium)` → **vergrendelde modus**.
3. Tabblad **Regels**: plak de inhoud van `database.rules.json` → **Publiceren**.
4. **Projectinstellingen → Je apps → `</>` (Web)** → app registreren (zonder Hosting).
5. Kopieer de waarden uit `firebaseConfig` naar `config.js` (vooral `apiKey` en `databaseURL`).

De `apiKey` is niet geheim; de beveiliging zit in de regels: alleen wie de geheime code uit de link kent, kan een sala lezen of bedienen.

### 2. GitHub Pages
Repo → **Settings → Pages** → *Source*: **Deploy from a branch** → branch `main`, map `/ (root)` → **Save**. Na ± 1 minuut staat de site op `https://twierikx.github.io/pomoduo/`.

### 3. Sala aanmaken
Open de site → **Crear sala nueva**. De URL krijgt een geheime code (`…/pomoduo/#abc…`). Zet die link in je bladwijzers en stuur hem naar Margot. Op elke laptop:
- kies onderaan **Este ordenador es de …** (bepaalt bij wie de wekker afgaat en welke tijd in de tabtitel staat);
- klik eenmalig op **Activar avisos** voor browsermeldingen.

## Gebruik
- **EMPEZAR / PAUSAR**, ↺ reset, tabbladen *Enfoque / Pausa corta / Pausa larga*. Elke fase start handmatig.
- ⚙ per persoon: duur van focus/pauzes en na hoeveel pomodoros een lange pauze.
- **Sincronizar con …**: kopieert eenmalig instellingen, fase, ronde en resterende tijd van de ander; daarna lopen de timers weer los.
- Einde van een fase: keukenwekker + melding, alleen op de laptop van die persoon.
- Zonder Firebase-config werkt de site in *modo local* (alleen binnen één browser) om uit te proberen.
