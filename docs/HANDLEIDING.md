# Handleiding: onze universe op elk apparaat ♡

Met deze stappen zien jullie allebei **dezelfde** herinneringen, brieven, foto's
en plannen. Dat werkt op jouw iPhone, haar telefoon en elke laptop, en wat de één
toevoegt, verschijnt bij de ander. Daarna installeer je de site als app.

- **Kosten:** €0. Jullie gebruiken het gratis abonnement van
  [Supabase](https://supabase.com) (de opslag) en [Netlify](https://www.netlify.com)
  (de website).
- **Tijd:** ongeveer 20–30 minuten, één keer.
- **Wat je nodig hebt:** een computer, de bestanden van dit project, en het e-mailadres
  van Shenaya.

> Waarom Supabase? Het is een echte database met echte inlog. Alleen jullie twee
> kunnen erin; dat wordt op de server afgedwongen, niet alleen in de app. Er staat geen
> geheime sleutel in de website.

---

## Stap 1: maak een Supabase-project

1. Ga naar [supabase.com](https://supabase.com) → **Start your project** en maak een
   account (met GitHub of e-mail).
2. Klik **New project**.
   - **Name:** bijvoorbeeld `our-little-universe`.
   - **Database password:** laat er een genereren en bewaar het in je
     wachtwoordmanager. De app heeft het niet nodig.
   - **Region:** kies iets in Europa, bijvoorbeeld *Central EU (Frankfurt)*.
3. Klik **Create new project** en wacht een paar minuten tot het klaar is.

## Stap 2: zet de database klaar

1. Klik links op **SQL Editor** → **New query**.
2. Open het bestand [`supabase/schema.sql`](../supabase/schema.sql) uit dit project,
   kopieer **alles**, en plak het in het venster.
3. Klik **Run**. Je hoort *Success. No rows returned* te zien.

Daarmee zijn de tabellen, de beveiligingsregels en een **privé**-map voor foto's
(`universe-media`) aangemaakt. Je mag dit later gerust opnieuw draaien, bijvoorbeeld na
een update van het bestand: er gaat niets verloren.

*Controle (mag je overslaan):*
- Onder **Table Editor** staan `spaces`, `space_members`, `space_invites` en
  `space_content`.
- Onder **Storage** staat `universe-media`, gemarkeerd als *Private*.

## Stap 3: maak jullie twee accounts aan

> **Belangrijk over e-mail.** Supabase stuurt zonder extra instellingen alleen e-mails
> naar leden van je eigen Supabase-organisatie, en maar een paar per uur. Een
> bevestigingsmail aan Shenaya komt dus **niet** aan. Daarom maak je de accounts zelf
> aan; dan is er geen e-mail nodig.

1. Ga naar **Authentication** → **Users** → **Add user** → **Create new user**.
2. Vul **jouw** e-mailadres en een wachtwoord in, en vink **Auto Confirm User** aan.
   Klik **Create user**.
3. Doe hetzelfde voor **Shenaya**: haar echte e-mailadres, een tijdelijk wachtwoord, en
   **Auto Confirm User** aangevinkt.
   - Geef haar dat tijdelijke wachtwoord persoonlijk, niet via een openbaar kanaal.
   - Ze kan het meteen zelf veranderen in de app: **Settings → Together on every
     device → Change my password**.

### Zet nieuwe aanmeldingen uit (aanrader)

Ga naar **Authentication** → **Sign In / Providers** (soms heet het **Providers** of
**Auth settings**). Zet **Allow new users to sign up** **uit**. Dan kan niemand anders
meer een account maken, ook niet als hij de link van jullie site heeft.

Laat **Confirm email** gewoon **aan** staan.

> Ook zonder deze stap komt een vreemde er niet in. Alleen e-mailadressen die
> uitgenodigd zijn kunnen meedoen, en er passen maximaal twee mensen in jullie
> universe. Dit is een extra slot op de deur.

## Stap 4: kopieer twee codes

Klik bovenaan op **Connect**, of ga naar **Project Settings** → **API Keys**
(**Data API** voor de URL). Je hebt twee dingen nodig:

| Wat | Hoe het eruitziet |
| --- | --- |
| **Project URL** | `https://abcdefgh.supabase.co` |
| **Publishable key** | begint met `sb_publishable_…` (of de oudere **anon public** key, die begint met `eyJ…`; die werkt ook) |

> ⚠️ Gebruik **nooit** de **secret key** (`sb_secret_…`) of de **service_role** key.
> Die zijn alleen voor servers en omzeilen alle beveiliging. De app weigert ze, en het
> bouwen van de site stopt ook als je er per ongeluk een invult.

De publishable key mag openbaar zijn: daar is hij voor gemaakt. De beveiligingsregels
uit stap 2 bepalen wie wat mag zien.

## Stap 5: zet de website online

Kies **A** als de code op GitHub staat (aanrader: updates gaan dan vanzelf), of **B**
als je alleen de map met bestanden hebt.

### A. Netlify + GitHub

1. Ga naar [app.netlify.com](https://app.netlify.com) en log in met GitHub.
2. **Add new site** (of **Add new project**) → **Import an existing project** →
   **GitHub** → kies de repository → kies de branch waar de code staat (meestal
   `main`).
3. De bouwinstellingen worden automatisch uit `netlify.toml` gehaald (`npm run build`,
   map `dist`). Daar hoef je niets aan te veranderen.
4. Voeg bij **Environment variables** (of later via **Site configuration →
   Environment variables**) toe:
   - `VITE_SUPABASE_URL` = jouw Project URL
   - `VITE_SUPABASE_ANON_KEY` = jouw publishable key
5. Klik **Deploy**. Je krijgt een adres zoals `https://iets-moois.netlify.app`. Een
   mooiere naam kies je via **Site configuration → Change site name**.

Heb je de codes pas ná de eerste keer bouwen toegevoegd? Ga dan naar **Deploys** →
**Trigger deploy** → **Deploy site**. De codes worden tijdens het bouwen in de site
gezet.

### B. Zonder GitHub (map slepen)

1. Neem de gebouwde map (`dist`, of het zip-bestand *our-little-universe-site*).
2. Open daarin `universe-config.json` met een teksteditor en vul je twee codes in:
   ```json
   {
     "supabaseUrl": "https://abcdefgh.supabase.co",
     "supabaseAnonKey": "sb_publishable_…"
   }
   ```
3. Log in op [app.netlify.com](https://app.netlify.com) en sleep de hele map naar
   **Sites** (of naar [app.netlify.com/drop](https://app.netlify.com/drop)). Log
   eerst in: een site die je zonder account sleept, verdwijnt na korte tijd.

### Laat Supabase je site kennen

Ga in Supabase naar **Authentication** → **URL Configuration**:
- Zet bij **Site URL** het adres van je site, bijvoorbeeld
  `https://iets-moois.netlify.app`.
- Voeg datzelfde adres toe bij **Redirect URLs**.

Dit is alleen nodig voor links in e-mails (zoals *wachtwoord vergeten*), maar het is
goed om het meteen te doen.

## Stap 6: samen verbinden

**Op jouw telefoon (Valencio):**
1. Open de site in Safari.
2. Ga naar **Menu → Together on every device**, of naar Settings.
3. Kies **Sign in** en log in met jouw e-mailadres en wachtwoord uit stap 3.
4. Vul bij **Start our shared universe** het e-mailadres van Shenaya in en tik
   **Create & invite**.
   - Alles wat nu op jouw telefoon staat, wordt de gedeelde versie, inclusief foto's.
   - Je ziet *Synced just now* en haar adres met *invited · waiting to join*.

**Op haar telefoon (Shenaya):**
1. Open dezelfde link in Safari.
2. Ga naar **Settings → Together on every device → Sign in** en log in met haar
   e-mailadres en het tijdelijke wachtwoord.
3. Ze doet automatisch mee en ziet jullie gedeelde universe. Wat ze vóór het
   inloggen al zelf had toegevoegd, blijft bewaard en wordt toegevoegd.
4. Daarna: **Change my password**, zodat alleen zij haar wachtwoord kent.

**Op een laptop of tablet:** open de link, log in, klaar.

Rechtsboven zie je een wolkje: groen betekent bijgewerkt. Veranderingen komen meestal
binnen een paar seconden door. Zonder internet kun je gewoon verder: de app synchroniseert
zodra je weer online bent.

## Stap 7: installeer de app op elk apparaat

Tik op de home-pagina op **Install**, of ga naar **Menu → Get the app**. De app laat
precies zien wat je op dát apparaat moet doen:

- **iPhone / iPad (Safari):** Deel-knop → **Zet op beginscherm** (*Add to Home
  Screen*) → **Voeg toe**. In Chrome op de iPhone gaat het via dezelfde Deel-knop, of
  open de link in Safari.
- **Android (Chrome):** knop **Install**, of ⋮-menu → **App installeren**.
- **Mac:** Safari → **Archief → Voeg toe aan Dock**; in Chrome of Edge het
  installeer-icoontje in de adresbalk.
- **Windows:** Chrome of Edge → het installeer-icoontje in de adresbalk.

De app opent dan schermvullend met een eigen icoon, en werkt ook offline. Een App Store
of Play Store is niet nodig.

---

## Goed om te weten

**Wie ziet wat?**
- Iemand die alleen de link heeft, ziet een *lege startversie*: de voorbeeldteksten die
  in de site zitten, met jullie namen. Dat gebeurt op zijn eigen apparaat. Jullie
  herinneringen, brieven en foto's komen pas na inloggen binnen, en alleen bij jullie
  twee.
- Zoekmachines wordt gevraagd de site niet op te nemen (`noindex`).
- Foto's staan in een **privé**-map. Zonder inlog kan niemand ze openen, ook niet met
  een directe link.
- Je wachtwoord wordt nooit in de app opgeslagen. De inlogsessie staat in de opslag van
  de app op je eigen apparaat, niet in `localStorage`.

**Gratis abonnement van Supabase**
- Ruimte: ongeveer **1 GB** voor foto's en filmpjes, en **500 MB** voor de database.
  Foto's worden in de app automatisch verkleind. Filmpjes nemen het snelst ruimte in.
- Een project dat ongeveer **een week niet gebruikt** wordt, kan door Supabase op pauze
  worden gezet. Je krijgt dan een e-mail; in het dashboard klik je **Restore project**.
  Er gaat niets verloren. Jullie eigen apparaten houden in de tussentijd hun kopie.

**Wachtwoord vergeten?**
- *Jij*: tik **Forgot password** in de app. Die e-mail komt aan als je in de app
  hetzelfde e-mailadres gebruikt als voor je Supabase-account.
- *Shenaya* (zolang er geen eigen e-mailinstelling is):
  1. Verwijder haar gebruiker in Supabase via **Authentication → Users**.
  2. Tik in jouw app bij **Together on every device** op **Invite the other person**
     en vul haar adres opnieuw in.
  3. Maak haar account opnieuw aan zoals in stap 3. Jullie herinneringen blijven
     gewoon staan.
- Wil je dat *Forgot password* voor jullie allebei per e-mail werkt? Stel dan een eigen
  e-maildienst in, bijvoorbeeld het gratis plan van Resend of Brevo. In Supabase gaat
  dat via **Authentication → Emails → SMTP Settings**. Dat is optioneel.

**Back-ups blijven handig.** In **Settings → Our data & backups → Export with photos**
download je alles in één bestand. Doe dat af en toe.

**Uitloggen** op een apparaat laat de kopie op dat apparaat staan, maar het krijgt geen
nieuwe dingen meer tot je weer inlogt.

---

## Liever zonder hosting eerst proberen?

Open de site, ga naar **Settings → Together on every device → Connect a project on this
device** en plak daar de twee codes. Dat geldt dan alleen voor dat ene apparaat. Handig
om te testen; voor jullie echte site is stap 5 beter.

---

## Voor de nieuwsgierigen: wat er technisch gebeurt

- Jullie universe is één document in de tabel `space_content`, met een
  versienummer. Bewerken twee mensen tegelijk? Dan voegt de app beide wijzigingen per
  onderdeel samen; er wordt niets overschreven.
- Lezen mag alleen voor de twee leden (*row-level security*). Schrijven gaat alleen via
  vaste databasefuncties die controleren wie je bent.
- Een uitnodiging werkt alleen voor een **bevestigd** account met precies dat
  e-mailadres. Er passen maximaal twee mensen in.
- De beveiligingsregels worden getest in een echte Postgres-database: `npm test` draait
  `supabase/schema.test.ts`.
