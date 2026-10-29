# MATA

Site-ul static este `mach-moto-telefon.html`; `index.html` din repository-ul GitHub este copia publicată. Configurația browserului este în `supabase-config.js`, integrarea în `auth.js`, iar schema și politicile de securitate sunt în `supabase-schema.sql`.

## Conectarea la Supabase

1. Creează un proiect Supabase și deschide **Project Settings → API**. Copiază Project URL și cheia publică `anon`/`publishable` în `supabase-config.js`. Nu pune cheia `service_role` sau o cheie `secret` în site.
2. În **Authentication → Providers**, activează Email. Păstrează confirmarea adreselor activă.
3. În **Authentication → URL Configuration**, adaugă URL-ul GitHub Pages (și URL-ul local pentru dezvoltare) în Site URL și Redirect URLs.
4. Rulează tot conținutul din `supabase-schema.sql` o singură dată, în Supabase **SQL Editor**. Scriptul creează tabelele, politicile RLS, bucketul de imagini și publicarea Realtime.
5. Completează `supabase-config.js`, publică `index.html`, `auth.js`, `supabase-config.js` și `mach-moto-logo.jpeg` pe HTTPS. Pagina deschisă cu `file://` nu poate folosi autentificarea web.

Site-ul permite înregistrare, confirmarea emailului, logare, resetarea și schimbarea parolei, publicarea anunțurilor cu până la 5 imagini de maximum 5 MB fiecare și conversații live între cumpărător și proprietar. Accesul la rânduri este controlat prin Row Level Security. Imaginile din bucketul `mata-ad-photos` sunt publice pentru afișarea anunțurilor; uploadul și ștergerea sunt limitate la folderul proprietarului.

Anunțurile demonstrative vechi sunt locale și nu au proprietari autentificați, deci nu pot primi mesaje. Favoritele rămân locale în browser. Configurația Supabase este specifică proiectului și nu poate fi completată fără URL-ul și cheia publică reale.

## Scalare

Supabase oferă Postgres, Auth, Storage și Realtime ca servicii gestionate, dar acest prototip nu a fost dimensionat sau testat pentru miliarde de utilizatori. Stabilește volumele simultane, cererile/secundă, regiunea, latența și bugetul; apoi configurează backupuri, observabilitate, cote și teste de capacitate înainte de trafic mare.
