const mysql = require('mysql');
const util = require('util');

const env = process.env;

const db = mysql.createConnection({
    host: env.DB_URL,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME 
});

const query = util.promisify(db.query).bind(db);

const doctors = require('./doctors');

async function handleRequest(req) {
    res = { statusCode: 302, location: '/500'};

    method = req.method; // POST, GET, PUT, DELETE
    splittedRoute = req.url.slice(5).split("/"); // on enlève le "/api/" du début avant de séparer la chaîne par les "/"
    
    i = 0;
    while(i < splittedRoute.length) { // on enlève toutes les chaînes vides
        if(splittedRoute[i] == "") {
            splittedRoute.splice(i, 1);
        } else {
            i++;
        }
    }

    connectionFailed = false;
    if(db.state == "disconnected") {
        await util.promisify(db.connect).bind(db)()
            .catch(() => connectionFailed = true);
    }

    if(!connectionFailed) {
        switch(splittedRoute[0].toLowerCase()) {
            case "doctors":
                res = await doctors.handle(method, splittedRoute.slice(1), query);
                break;
        }
    }
    return res;
}

module.exports = {
    handleRequest: handleRequest
};