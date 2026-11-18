import { app } from "./app.js";
import { getDb } from "./db.js";

const port = Number(process.env.PORT ?? 10000);
await getDb();
app.listen(port, "0.0.0.0", () => console.log(`BHW API listening on ${port}`));
