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

async function checkDBConnection() {
    let connectionFailed = false;

    // on vérifie si la connexion à la BDD est possible
    await util.promisify(db.getConnection).bind(db)()
        .then(async conn => {
            conn.ping(undefined, () => {
                connectionFailed = true;
            });
            conn.release();
        }).catch(() => connectionFailed = true);
    return !connectionFailed;
}

async function handleRequest(req) {
    var res = { statusCode: 302, location: '/500'}; // redirection vers la page 500

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
        if(await checkDBConnection()) { // si on a réussi à se connecter
            var firstRoute = splittedRoute[0].toLowerCase();
            if(requestHandlers[firstRoute]) { // si le début de la route existe
                // on délégue le traitement de la requête à bonne route
                res = requestHandlers[firstRoute](method, splittedRoute.slice(1), req.headers, data, queryParameters, query);
            }
        }
    }
    return res;
}

async function getData(req) { // récupère les data d'une requête
    data = '';

    req.on('data', chunk => { // récupère les données et les stocke dans une variable
        data += chunk;
    });

    await util.promisify(req.on).bind(req)('end'); // permet d'attendre que les données aient bien toutes été récupérées
    return data;
}

async function cleanData() {
    while(await checkDBConnection()) {
        await query(`DELETE FROM user_token WHERE expiration < NOW()`);
        await new Promise(r => setTimeout(r, 172800000)); // 172800000 ms = 2d
    }
}

cleanData();

module.exports = {
    handleRequest: handleRequest
};