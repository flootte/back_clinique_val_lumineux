const { createHash, randomBytes } = require('crypto');

async function handle(method, splittedRoute, headers, data, query) {
    res;
    switch(method) {
        case "GET":
            res = await handleGet(splittedRoute, headers, data, query);
            break;
        case "POST":
            res = await handlePost(splittedRoute, headers, data, query);
            break;
        case "PUT":
            res = await handlePut(splittedRoute, headers, data, query);
            break;
        case "DELETE":
            break;
        default:
            res = { statusCode: 302, location: '/404' };
            break;
    }
    return res;
}

async function handlePost(splittedRoute, headers, data, query) {
    res = { statusCode: 302, location: '/404' };
    if(splittedRoute.length == 0) {
        res = {
            statusCode: 200,
            contentType: "application/json",
            content: JSON.stringify(await connectMailPassword(data, query))
        };
    }

    return res;
}

async function connectMailPassword(data, query) {
    res = {"success": false};

    if(data["mail"] && data["password"]) {
        await query(
            `SELECT
            U.id, U.mail, \
            C.name as client_name, \
            C.firstname as client_firstname, \
            A.name as admin_name, A.firstname as admin_firstname, \
            S.name as secretary_name, S.firstname as secretary_firstname, \
            D.name as doctor_name, D.firstname as doctor_firstname \
            FROM user U \
            LEFT OUTER JOIN user_client UC \
            ON UC.user_id = U.id \
            LEFT OUTER JOIN client C \
            ON UC.client_id = C.id \
            LEFT OUTER JOIN admin A \
            ON (U.admin_id IS NOT NULL AND U.admin_id = A.id) \
            LEFT OUTER JOIN secretary S \
            ON (U.secretary_id IS NOT NULL AND U.secretary_id = S.id) \
            LEFT OUTER JOIN doctor D \
            ON (U.doctor_id IS NOT NULL AND U.doctor_id = D.id) \
            WHERE U.mail='${data["mail"]}' AND U.password='${createHash('md5').update(data["password"]).digest("base64")}'`
        ).then(async (result) => {
            if(result.length == 1) { // le seul cas de succès
                user = result[0];
                token = randomBytes(64).toString("base64url");
                res = {
                    "id": user["id"],
                    "mail": user["mail"],
                    "name": user["client_name"] || user["admin_name"] || user["secretary_name"] || user["admin_name"],
                    "firstname": user["client_firstname"] || user["admin_firstname"] || user["secretary_firstname"] || user["admin_firstname"],
                    "admin": user["admin_firstname"] != null,
                    "secretary": user["secretary_firstname"] != null,
                    "doctor": user["doctor_firstname"] != null,
                    "token": token
                };

                await query(`INSERT INTO user_token VALUES (${user["id"]}, '${token}')`);
            }
        });
    }

    return res;
}

async function handleGet(splittedRoute, headers, data, query) {
    res = { statusCode: 302, location: '/404' };
    if(splittedRoute.length == 0) {
        res = {
            statusCode: 200,
            contentType: "application/json",
            content: JSON.stringify(await connectToken(headers, query))
        };
    }
    return res;
}

async function connectToken(headers, query) {
    res = {"success": false};
    if(headers["authorization"]) {
        token = headers["authorization"].replace("Bearer ", "");
        await query(
            `SELECT \
            U.id, \
            U.mail, \
            C.name AS client_name, \
            C.firstname AS client_firstname, \
            A.name AS admin_name, \
            A.firstname AS admin_firstname, \
            S.name AS secretary_name, \
            S.firstname AS secretary_firstname, \
            D.name AS doctor_name, \
            D.firstname AS doctor_firstname \
            FROM user_token UT \
            JOIN user U \
            ON UT.user=U.id \
            LEFT OUTER JOIN user_client UC \
            ON UC.user_id = U.id \
            LEFT OUTER JOIN client C \
            ON UC.client_id = C.id \
            LEFT OUTER JOIN admin A \
            ON (U.admin_id IS NOT NULL AND U.admin_id = A.id) \
            LEFT OUTER JOIN secretary S \
            ON (U.secretary_id IS NOT NULL AND U.secretary_id = S.id) \
            LEFT OUTER JOIN doctor D \
            ON (U.doctor_id IS NOT NULL AND U.doctor_id = D.id) \
            WHERE UT.token="${token}";`
        ).then(result => {
            if(result.length == 1) { // le seul cas de succès
                user = result[0];
                res = {
                    "id": user["id"],
                    "mail": user["mail"],
                    "name": user["client_name"] || user["admin_name"] || user["secretary_name"] || user["admin_name"],
                    "firstname": user["client_firstname"] || user["admin_firstname"] || user["secretary_firstname"] || user["admin_firstname"],
                    "admin": user["admin_firstname"] != null,
                    "secretary": user["secretary_firstname"] != null,
                    "doctor": user["doctor_firstname"] != null
                };
            }
        });
    }
    return res;
}

async function handlePut(splittedRoute, headers, data, query) {
    res = { statusCode: 302, location: '/404' };
    if(splittedRoute.length == 0) {
        res = await createUser(headers, data, query);
    }
    return res;
}

async function createUserDB(mail, password, firstname, name, birthdate, query) {
    userID = undefined;

    await query(
        `INSERT INTO user(mail, password) \
        VALUES (\
        '${mail}', \
        '${createHash('md5').update(password).digest("base64")}' \
        )`
    ).then(async result => {
        userID = result["insertId"]; // id de l'utilisateur créé
        // on créé le client associé
        await query(
            `INSERT INTO client(name, firstname, birthdate) \
            VALUE ('${name}', '${firstname}', '${birthdate}')
            `).then(async result => {
            clientID = result["insertId"]; // id du client associé
            // on lie les deux
            await query(`INSERT INTO user_client VALUES (${userID}, ${clientID})`);
        });
    });

    return userID;
}

async function createUser(headers, data, query) {
    res = { "success": false };
    if(data["mail"] && data["password"] && data["firstname"] && data["name"] && data["birthdate"]) {
        isAdmin;
        
        if(headers["autorization"]) { // personne déjà connectée
            token = headers["autorization"].replace("Bearer ", "");
            await query(
                `SELECT name FROM user_token UT \
                JOIN user U \
                ON UT.user = U.id \
                WHERE UT.token='${token}' AND U.admin_id IS NOT NULL
                `).then(result => { isAdmin = result.length == 1; });
        }
            
        userID;
        if(isAdmin == undefined || isAdmin) { // soit pas connecté, soit connecté en tant qu'admin
            userID = createUserDB(data["mail"], data["password"], data["firstname"], data["name"], data["birthdate"], query);
        }

        if(userID) { // la création a fonctionné
            res = {
                "id": userID,
                "mail": data["mail"],
                "name": data["name"],
                "firstname": data["firstname"],
                "admin": false,
                "secretary": false
            };

            if(!isAdmin) {
                token = randomBytes(64).toString("base64url");
                await query(
                    `INSERT INTO user_token VALUES (${userID}, '${token}')`
                ).then(() => {
                    res["token"] = token;
                });
            }
        }
    }
    return res;
}


module.exports = {
    handle: handle
}