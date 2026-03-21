const mysql = require('mysql');
const util = require('util');
const querystring = require('querystring');

const env = process.env;

var db = mysql.createPool({
    host: env.DB_URL,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    connectionLimit: 10,
    waitForConnections: true,
    queueLimit: 0
});

const query = util.promisify(db.query).bind(db);

const doctors = require('./doctors');
const users = require('./users');
const appointments = require('./appointments');
const clients = require('./clients');

const requestHandlers = {
    "doctors": doctors.handle,
    "users": users.handle,
    "appointments": appointments.handle,
    "clients": clients.handle
}

async function handleRequest(req) {
    var res = { statusCode: 302, location: '/500'};

    data = querystring.decode(await getData(req)); // récupère les potentielles datas
    queryParameters  = querystring.decode(req.url.split("?")[1]||"");

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

    if(splittedRoute.length != 0) {
        connectionFailed = false;

        await util.promisify(db.getConnection).bind(db)()
            .then(async conn => {
                conn.ping(undefined, err => {
                    connectionFailed = true;
                });
                conn.release();
            })
            .catch(() => connectionFailed = true);

        if(!connectionFailed) {
            var firstRoute = splittedRoute[0].toLowerCase();
            if(requestHandlers[firstRoute]) {
                res = requestHandlers[firstRoute](method, splittedRoute.slice(1), req.headers, data, queryParameters, query);
            }
        }
    }
    return res;
}

async function getData(req) {
    data = '';

    req.on('data', chunk => { // récupère les données et les stocke dans une variable
        data += chunk;
    });

    await util.promisify(req.on).bind(req)('end'); // permet d'attendre que les données aient bien toutes été récupérées
    return data;
}

module.exports = {
    handleRequest: handleRequest
};