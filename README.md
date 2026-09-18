# What2Post — dnevna slika + opis

Svakog jutra u 07:00 (Europe/Belgrade) server pokupi sledeći prompt iz
`functions/src/prompts.json` (30 promptova, rotiraju se u krug), pošalje ga
Gemini-ju da generiše sliku, sačuva je u Firebase Storage, upiše
opis/URL u Firestore i pošalje push notifikaciju na telefon. Flutter app
sluša tu notifikaciju i prikazuje sliku + opis.

## Struktura

- `app/` — Flutter aplikacija (Android + iOS)
- `functions/` — Firebase Cloud Function koja generiše sliku (TypeScript)
- `functions/src/prompts.json` — tvojih 30 promptova + opisa (slobodno izmeni)
- `firestore.rules`, `storage.rules`, `firebase.json`, `.firebaserc` — konfiguracija

## Koraci koje ti treba da uradiš (nalozi i ključevi — to ja ne mogu umesto tebe)

### 1. Napravi Firebase projekat
1. Idi na https://console.firebase.google.com → **Add project**.
2. Uključi **Blaze (pay-as-you-go)** plan — potreban je da Cloud Function
   sme da zove spoljašnji API (Gemini). Besplatna kvota i dalje pokriva
   ovakav mali projekat (1 poziv dnevno).
3. U projektu uključi: **Firestore Database**, **Storage**, **Cloud Messaging**.

### 2. Napravi Gemini API ključ
1. Idi na https://aistudio.google.com/apikey → **Create API key**.
2. Sačuvaj ključ, treba ti u koraku 4.

### 3. Instaliraj alate (jednom)
```bash
npm install -g firebase-tools
dart pub global activate flutterfire_cli
```

### 4. Poveži projekat sa Firebase-om
Iz root foldera (`what2post/`):
```bash
firebase login
firebase use --add
```
Izaberi svoj projekat. Zatim upiši pravi project ID u `.firebaserc`
(zameni `REPLACE_WITH_YOUR_FIREBASE_PROJECT_ID`).

Postavi Gemini ključ kao secret za funkciju:
```bash
firebase functions:secrets:set GEMINI_API_KEY
```
(nalepi ključ iz koraka 2 kad zatraži)

### 5. Deploy Cloud Function-a
```bash
cd functions
npm install
npm run deploy
```
Posle ovoga možeš ručno da testiraš iz Firebase Console → Functions →
`generateDailyImage` → **Run now**, ili sačekaj 07:00.

### 6. Poveži Flutter app sa Firebase-om
Iz `app/` foldera:
```bash
cd app
flutterfire configure
```
Ovo će prepisati placeholder `lib/firebase_options.dart` pravim
vrednostima tvog projekta i dodati potrebne native fajlove
(`google-services.json` za Android, `GoogleService-Info.plist` za iOS).

```bash
flutter pub get
flutter run
```

### 7. Push notifikacije na iOS (samo ako pravite iOS verziju)
Apple zahteva APNs ključ:
1. Apple Developer Account → Certificates → Keys → napravi APNs Auth Key.
2. Firebase Console → Project Settings → Cloud Messaging → Apple app
   configuration → upload taj ključ.
3. U Xcode-u za `app/ios/Runner.xcworkspace` uključi **Push Notifications**
   i **Background Modes → Remote notifications** capability.

Android ne zahteva ništa dodatno — `flutterfire configure` je dovoljan.

## Kako izmeniti promptove

Uredi `functions/src/prompts.json` — svaki unos ima:
- `prompt` — šalje se Gemini-ju (na engleskom radi boljeg kvaliteta slike)
- `description` — prikazuje se korisniku u aplikaciji (na srpskom)

Posle izmene, ponovo deploy-uj: `cd functions && npm run deploy`.

## Kako radi izbor prompta

Nema baze/state-a za "koji je dan po redu" — koristi se broj dana od
1.1.1970 (`epoch day % 30`), pa se prompt sam vrti u krug svaka 30 dana,
bez potrebe da bilo šta pamtiš na serveru.
