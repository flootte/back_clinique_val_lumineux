const { createHash, randomBytes } = require('crypto');

async function handle(method, splittedRoute, headers, data, queryParameters, query) {
    var res;
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
    var res = {"success": false};

    if(data["mail"] && data["password"]) {
        var result = await query(`
            SELECT
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
            WHERE U.mail='${data["mail"]}' AND U.password='${createHash('md5').update(data["password"]).digest("base64")}'
        `);
        
        if(1 <= result.length) { // le seul cas de succès
            var user = result[0];
            var token = randomBytes(64).toString("base64url");
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
        };
    }

    return res;
}

async function handleGet(splittedRoute, headers, data, query) {
    var res = { statusCode: 302, location: '/404' };
    if(splittedRoute.length == 0) {
        res = {
            statusCode: 200,
            contentType: "application/json",
            content: JSON.stringify(await connectToken(headers, query))
        };
    } else if(splittedRoute.length == 1) {
        if(splittedRoute[0] == "appointments") {
            res = {
                statusCode: 200,
                contentType: "application/json",
                content: JSON.stringify(await getAppointments(headers, query))
            };
        }
    }
    return res;
}

async function connectToken(headers, query) {
    var res = {"success": false};
    if(headers["authorization"]) {
        token = headers["authorization"].replace("Bearer ", "");
        var result = await query(`
            SELECT \
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
            WHERE UT.token="${token}" \
            ORDER BY U.id
        `);

        if(1 <= result.length) {
            var user = result[0];
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
    }
    return res;
}

async function getAppointments(headers, query) {
    var res = [];
    if(headers["authorization"]) {
        var token = headers["authorization"].replace("Bearer ", "");

        var results = await query(`
            SELECT C.id as client_id, C.name as client_name, C.firstname as client_firstname, \
            A.id appointment_id, A.time_start, A.time_end, \
            D.id as doctor_id, D.name as doctor_name, D.firstname as doctor_firstname, \
            S.id as sector_id, S.name as sector_name, S.color \
            FROM client C \
            JOIN user_client UC \
            ON C.id=UC.client_id \
            JOIN user U \
            ON UC.user_id=U.id \
            JOIN user_token UT \
            ON U.id=UT.user \
            JOIN appointment A \
            ON C.id=A.client_id \
            JOIN doctor D \
            ON A.doctor_id=D.id \
            JOIN sector S \
            ON D.sector_id=S.id \
            WHERE UT.token="${token}"
        `);

        results.forEach(appointment => {
            res.push({
                "id": appointment["appointment_id"],
                "start": appointment["time_start"],
                "end": appointment["time_end"],
                "client": {
                    "id": appointment["client_id"],
                    "name": appointment["client_name"],
                    "firstname": appointment["client_firstname"],
                },
                "doctor": {
                    "id": appointment["doctor_id"],
                    "name": appointment["doctor_name"],
                    "firstname": appointment["doctor_firstname"],
                },
                "sector": {
                    "id": appointment["sector_id"],
                    "name": appointment["sector_name"],
                    "color": appointment["color"]
                }
            });
        });
    }
    return res;
}

async function handlePut(splittedRoute, headers, data, query) {
    var res = { statusCode: 302, location: '/404' };
    if(splittedRoute.length == 0) {
        res = {
            statusCode: 200,
            contentType: 'application/json',
            content: JSON.stringify(await createUser(headers, data, query))
        };
    }
    return res;
}

async function createUserDB(mail, password, firstname, name, birthdate, query) {
    var userID = (await query(
        `INSERT INTO user(mail, password) \
        VALUES (\
        '${mail}', \
        '${createHash('md5').update(password).digest("base64")}' \
        )
    `))["insertId"];
        
    var clientID = (await query(`
        INSERT INTO client(name, firstname, birthdate) \
        VALUE ('${name}', '${firstname}', '${birthdate}')
    `))["insertId"];

    await query(`INSERT INTO user_client VALUES (${clientID}, ${userID})`);
    
    return userID;
}

async function createUser(headers, data, query) {
    var res = { "success": false };
    if(data["mail"] && data["password"] && data["firstname"] && data["name"] && data["birthdate"]) {
        var isAdmin;
        
        if(headers["autorization"]) { // personne déjà connectée
            token = headers["autorization"].replace("Bearer ", "");
            isAdmin = (await query(
                `SELECT name FROM user_token UT \
                JOIN user U \
                ON UT.user = U.id \
                WHERE UT.token='${token}' AND U.admin_id IS NOT NULL
            `)).length == 1;
        }
            
        var userID;
        if(isAdmin == undefined || isAdmin) { // soit pas connecté, soit connecté en tant qu'admin
            userID = await createUserDB(data["mail"], data["password"], data["firstname"], data["name"], data["birthdate"], query);
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
                var token = randomBytes(64).toString("base64url");
                await query(`INSERT INTO user_token VALUES (${userID}, '${token}')`);
                res["token"] = token;
            }
        }
    }
    return res;
}


module.exports = {
    handle: handle
}