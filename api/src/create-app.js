import express from "express";
import users from "./routes/users.js";
import mood from "./routes/mood.js";

export function createApp(database) {
  const app = express();

  app.use(express.json());

  // Inject database into request
  app.use((req, res, next) => {
    req.db = database;
    next();
  });

  app.use("/users", users);
  app.use("/mood", mood);

  return app;
}

export default createApp;