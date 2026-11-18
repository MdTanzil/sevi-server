require("dotenv").config();
const app = require("./src/app");
const { dbConnect } = require("./src/config/db");

const port = process.env.PORT || 5000;

dbConnect();

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
