# Plan de scalare pentru MATA

Un fișier HTML static nu poate oferi singur disponibilitate, date comune sau capacitate pentru miliarde de utilizatori. Autentificarea administrată este doar primul strat.

## Arhitectură propusă

1. **Identitate:** Firebase Authentication pentru conturi, verificarea emailului, resetarea parolei și tokenuri. Monitorizează cotele pe operații și cere creșteri înainte ca traficul estimat să le atingă.
2. **Frontend:** livrează HTML/JS/logo prin CDN cu cache versionat; nu pune secrete în codul browserului.
3. **API:** endpointuri stateless în spatele unui load balancer; validează tokenul Firebase la fiecare cerere privată, limitează abuzul pe utilizator/IP și poate scala orizontal.
4. **Date:** mută anunțurile și favoritele din `localStorage` într-o bază de date cloud. Partitionarea trebuie derivată din măsurători și modelul de acces; evită contoare globale și chei hot.
5. **Fotografii:** object storage privat/public cu URL-uri semnate, transformări de imagini și CDN; nu trimite fișierele prin API-ul de autentificare.
6. **Operații:** telemetrie pentru latență, erori, cereri/secundă și rate-limit; alerte, copii de siguranță, recuperare regională și migrații fără întrerupere.

## Criterii înainte de o promisiune de capacitate

Stabilește câți utilizatori sunt înregistrați, activi lunar, activi simultan și câte cereri/secundă generează fiecare flux. Modelează costul, regiunea, retenția, obiectivele de latență și indisponibilitatea acceptată; cere ajustarea cotelor serviciilor și testează creșterea incrementală. Numărul de conturi înregistrate nu este același lucru cu volumul de autentificări concurente.

În versiunea curentă, anunțurile utilizatorilor și conversațiile au integrare Cloud Firestore în cod, dar funcționează numai după configurarea Firebase, crearea bazei de date și publicarea regulilor și indexurilor incluse. Favoritele, anunțurile demonstrative și fotografiile rămân locale în browser. Acest prototip nu a fost dimensionat sau testat pentru miliarde de utilizatori; capacitatea trebuie stabilită prin estimări, monitorizare și teste de încărcare înainte de lansare la scară mare.
