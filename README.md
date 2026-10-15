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

## Scalare

Firebase documentează conturi înregistrate nelimitate pentru Firebase Authentication, dar limitează viteza unor operații; volumele mari cer monitorizarea cotelor și creșteri de capacitate. Asta nu înseamnă că site-ul, anunțurile sau baza de date sunt deja dimensionate pentru un miliard de utilizatori.

Datele marketplace-ului și favoritele din pagina curentă sunt încă salvate local în browser. Pentru utilizatori pe mai multe dispozitive, trebuie mutate într-un backend cu reguli de acces per utilizator, stocare separată pentru fotografii, indexare, cache și plan de partiționare. Înainte de orice promisiune privind miliarde de utilizatori, sunt necesare o țintă de trafic (utilizatori activi/concurenți și cereri/secundă), costuri, regiuni și teste de capacitate.
