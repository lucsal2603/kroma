// Applica lo schema e (opzionalmente) il seed dei prodotti.
//   npm run db:migrate         -> crea le tabelle + inserisce i 3 caschi
//   npm run db:migrate -- --no-seed   -> solo schema, niente seed
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const skipSeed = process.argv.includes("--no-seed");

async function run() {
  const schema = await readFile(join(__dirname, "schema.sql"), "utf8");

  console.log("→ Applico lo schema (tabelle, indici)...");
  await pool.query(schema);
  console.log("✓ Schema applicato.");

  if (!skipSeed) {
    const seed = await readFile(join(__dirname, "seed.sql"), "utf8");
    console.log("→ Inserisco i prodotti (seed)...");
    await pool.query(seed);
    const { rows } = await pool.query("select code, name, price from products order by code");
    console.log(`✓ Prodotti in catalogo (${rows.length}):`);
    for (const p of rows) console.log(`   • ${p.code}  ${p.name}  €${p.price}`);
  }

  console.log("\n✅ Database pronto.");
}

run()
  .catch((err) => {
    console.error("\n❌ Migrazione fallita:", err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
