const express = require("express");
const app = express();

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

const path = require("path");
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

app.use(express.json());

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

let db = null;
const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("server started running http://localhost:3000/");
    });
  } catch (error) {
    console.log(`Db error ${error.message}`);
    process.exit(1);
  }
};

initializeDbAndServer();

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken !== undefined) {
    jwt.verify(jwtToken, "secretKey", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  } else {
    response.status(401);
    response.send(`Invalid JWT Token`);
  }
};

//API 1
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const userData = `SELECT * FROM user WHERE username='${username}';`;
  const getUserData = await db.get(userData);
  if (getUserData === undefined) {
    response.status(400);
    response.send("Invalid user");
    console.log("Invalid user");
  } else {
    const isPasswordMatch = await bcrypt.compare(
      password,
      getUserData.password
    );
    if (isPasswordMatch === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "secretKey");
      response.send({ jwtToken });
      console.log({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
      console.log("Invalid password");
    }
  }
});

const convertAPI = (objectItem) => {
  return {
    stateId: objectItem.state_id,
    stateName: objectItem.state_name,
    population: objectItem.population,
  };
};

//API 2
app.get("/states/", authenticateToken, async (request, response) => {
  const getState = `SELECT * FROM state`;
  const getStateResponse = await db.all(getState);
  const getConvertedResponse = getStateResponse.map((each) => convertAPI(each));
  response.send(getConvertedResponse);
});

//API 3
app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = `SELECT * FROM state WHERE state_id=${stateId};`;
  const getStateQueryResponse = await db.get(getStateQuery);
  response.send(convertAPI(getStateQueryResponse));
});

//API 4
app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const postQuery = `
  INSERT INTO 
  district(district_name,state_id,cases,cured,active,deaths) 
  VALUES('${districtName}',${stateId},${cases},${cured},${active},${deaths});`;
  const postQueryResponse = await db.run(postQuery);
  response.send("District Successfully Added");
  console.log("District Successfully Added");
});
//API 5
const convertAPI5 = (obj) => {
  return {
    districtId: obj.district_id,
    districtName: obj.district_name,
    stateId: obj.state_id,
    cases: obj.cases,
    cured: obj.cured,
    active: obj.active,
    deaths: obj.deaths,
  };
};
//API 5
app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictByIdQuery = `select * from district where district_id=${districtId};`;
    const getDistrictByIdQueryResponse = await db.get(getDistrictByIdQuery);
    response.send(convertAPI5(getDistrictByIdQueryResponse));
    console.log(convertAPI5(getDistrictByIdQueryResponse));
  }
);

//API 6
app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteQuery = `DELETE FROM district WHERE district_id=${districtId};`;
    const deletedQueryResponse = await db.run(deleteQuery);
    response.send("District Removed");
  }
);

//API 7
app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateQuery = `UPDATE district 
    SET district_name='${districtName}', 
    state_id=${stateId},
    cases=${cases},
    cured=${cured},
    active=${active},
    deaths=${deaths}
    WHERE district_id=${districtId};`;
    const updateQueryResponse = await db.run(updateQuery);
    response.send("District Details Updated");
  }
);

//API 8
const convertAPI8 = (each) => {
  return {
    totalCases: each.totalCases,
    totalCured: each.totalCured,
    totalActive: each.totalActive,
    totalDeaths: each.totalDeaths,
  };
};
app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getQuery = `SELECT SUM(cases) as totalCases, SUM(cured) as totalCured,
  SUM(active) as totalActive, SUM(deaths) as totalDeaths FROM district WHERE state_id='${stateId}';`;
    const getQueryResponse = await db.get(getQuery);
    response.send(convertAPI8(getQueryResponse));
  }
);

module.exports = app;
