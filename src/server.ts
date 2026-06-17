import { App } from "./app.js";

const app = new App();

app.run(() => {
  console.log("Server is runnning on port 3000");
});
