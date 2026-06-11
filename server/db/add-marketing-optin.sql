-- Distingue "ha dato il permesso" (opt-in, scelto dall'utente alla
-- registrazione) da "riceve le email adesso" (consent, che l'admin può
-- spegnere/riaccendere). Chi non ha mai dato il permesso non può essere
-- attivato dall'admin: appare in grigio e bloccato nel pannello.
alter table users add column if not exists marketing_opt_in boolean not null default false;

-- Allinea il permesso a chi attualmente ha il consenso attivo (es. i 4 admin
-- già impostati a consent = true): così restano attivabili/disattivabili.
update users set marketing_opt_in = true where marketing_consent = true;
