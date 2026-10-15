# MATA

Site-ul static este pagina `mach-moto-telefon.html`. `index.html` este varianta de pe GitHub Pages. Logo-ul și pagina trebuie să rămână în același director.

## Activarea autentificării

Autentificarea folosește Firebase Authentication; parola nu este salvată de site în `localStorage`.

1. Creează un proiect Firebase și înregistrează o aplicație Web.
2. În Firebase Console, activează metoda **Email/Password** în Authentication → Sign-in method.
3. Copiază configurația aplicației Web în `firebase-config.js` (`apiKey`, `authDomain`, `projectId`, `appId`). Aceste valori pentru client sunt publice; nu pune niciodată o cheie privată sau un service-account key aici.
4. În Authentication → Settings → Authorized domains, adaugă domeniul de publicare, de exemplu `sergiualb221-jpg.github.io`.
5. Publică împreună `index.html`, `auth.js`, `firebase-config.js` și `mach-moto-logo.jpeg` pe un domeniu HTTPS. Logarea nu funcționează din `file://`.

Formularul oferă conectare, creare de cont cu trimiterea emailului de verificare și resetarea parolei. Configurează o politică de parolă compatibilă cu minimumul de 8 caractere din formular, protecțiile anti-abuz, verificarea emailului și Email Enumeration Protection în Firebase Console înainte de lansare.

## Mesaje și anunțuri comune

Mesajele și anunțurile publicate de utilizatori folosesc Cloud Firestore. În consola Firebase, creează baza de date Firestore, apoi publică regulile din `firestore.rules` și indexurile din `firestore.indexes.json` (cu Firebase CLI din directorul proiectului Firebase). Autentificarea și adresa de email confirmată sunt necesare pentru publicare și mesagerie. În profil, fila **Mesaje** afișează conversațiile; în pagina unui anunț publicat de un utilizator apare butonul **Scrie proprietarului**.

Anunțurile demonstrative vechi și anunțurile create înainte de configurarea Firebase sunt doar locale, nu au proprietar autentificat și nu pot primi mesaje. Fotografiile alese pentru anunț nu sunt încărcate în cloud; această funcție are nevoie de Firebase Storage. Folosește HTTPS și nu publica reguli Firestore cu acces general la scriere.

## Scalare

Firebase documentează conturi înregistrate nelimitate pentru Firebase Authentication, dar limitează viteza unor operații; volumele mari cer monitorizarea cotelor și creșteri de capacitate. Asta nu înseamnă că site-ul, anunțurile sau baza de date sunt deja dimensionate pentru un miliard de utilizatori.

Anunțurile publicate și mesajele se sincronizează prin Firestore după configurare; favoritele, anunțurile demonstrative și fotografiile de previzualizare rămân locale. Pentru creștere la scară mare sunt necesare monitorizarea cotelor și costurilor, reguli și indexuri testate, stocare separată pentru fotografii, cache și măsurători reale de trafic. Înainte de o promisiune privind miliarde de utilizatori, trebuie stabilite volumele simultane, cererile/secundă, latența, costul și disponibilitatea dorită, apoi validate prin teste de capacitate.
