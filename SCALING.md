# Scalarea MATA

MATA folosește Supabase pentru autentificare, Postgres, stocarea fotografiilor și evenimente Realtime. `supabase-schema.sql` definește datele și politicile RLS pentru proprietatea anunțurilor și participanții conversațiilor.

Înainte de lansare, măsoară utilizatorii activi și simultani, traficul pe anunțuri/conversații, cererile pe secundă, latența și costul. Activează backupuri și alerte, monitorizează Storage și Realtime, limitează abuzul și verifică politicile RLS cu teste dedicate. Pentru volume foarte mari, indexurile și arhitectura trebuie validate pe tiparele reale de trafic și ajustate împreună cu planul Supabase ales.

Codul din repository nu constituie o garanție de capacitate pentru miliarde de utilizatori. URL-ul proiectului și cheia publică trebuie completate în `supabase-config.js`; nu pune cheia secretă/service-role în frontend.
