-- Aggiunge il ruolo ADMIN agli utenti e la giacenza (disponibilità) ai caschi.
-- Da incollare nel SQL Editor di Supabase ed eseguire una sola volta.
-- È sicuro rieseguirlo: "if not exists" non crea doppioni.

-- Ruolo amministratore (di default tutti gli utenti NON sono admin)
alter table users    add column if not exists is_admin boolean not null default false;

-- Giacenza disponibile per ogni casco (di default 0)
alter table products add column if not exists stock integer not null default 0;

-- Diamo una scorta iniziale ai caschi esistenti (modificabile poi dalla dashboard)
update products set stock = 10 where stock = 0;

-- =====================================================================
-- PROMUOVI IL TUO ACCOUNT AD ADMIN
-- Nota: l'account deve già esistere (registrato sul sito con la sua
-- password). Questa riga lo rende solo amministratore.
-- =====================================================================
update users set is_admin = true where lower(email) = 'lukesalvemini@gmail.com';
update users set is_admin = true where lower(email) = 'mattiads403@gmail.com';
update users set is_admin = true where lower(email) = 'davegfxbusiness@gmail.com';
