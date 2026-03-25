async function handle(method, splittedRoute, headers, data, queryParameters, query) {
    var res = { statusCode: 302, location: '/404' };
    switch(method) {
        case "PUT":
            res = await handlePut(splittedRoute, headers, data, query);
            break;
        case "DELETE":
            res = await handleDelete(splittedRoute, headers, data, query);
            break;
    }
    return res;
}

async function handlePut(splittedRoute, headers, data, query) {
    var res = { statusCode: 302, location: '/404' };
    var content;
    if(splittedRoute.length == 0) {
        content = await createAppointments(headers, data, query);
    } else if(splittedRoute.length == 2 && splittedRoute[1] == "subscribe") {
        content = await subscribeAppointments(headers, data, splittedRoute[0], query);
    }

    if(content) {
        res = {
            statusCode: 200,
            contentType: 'application/json',
            content: JSON.stringify(content)
        }
    }
    return res;
}

async function createAppointments(headers, data, query) { // création d'un rendez-vous de la part d'un docteur connecté
    var res = {}; 

    if(headers["authorization"] && data["time_start"] && data["time_end"]) {
        var token = headers["authorization"].replace("Bearer ", "");
        var result = await query(`
            SELECT D.id as doctor_id, D.name as doctor_name, D.firstname as doctor_firstname, \
            S.id as sector_id, S.name as sector_name, S.description as sector_description, S.color as sector_color, \
            SE.id as secretary_id, SE.name as secretary_name, SE.firstname as secretary_firstname \
            FROM user U \
            JOIN user_token UT \
            ON U.id = UT.user \
            LEFT OUTER JOIN doctor D \
            ON U.doctor_id = D.id \
            LEFT OUTER JOIN secretary SE \
            ON U.secretary_id=SE.id
            JOIN sector S \
            ON D.sector_id = S.id \
            WHERE UT.token="${token}"
        `);
        
        if(result.length == 1) { // s'il est bien docteur ou secretaire
            var dataSet = result[0];
            var doctorID;
            var success = true;

            if(dataSet["secretary_id"]) {
                result = query(`
                    SELECT D.name as doctor_name, D.firstname as doctor_firstname, \
                    S.id as sector_id, S.name as sector_name, S.description as sector_description, S.color as sector_color, \
                    FROM doctor D \
                    JOIN sector S \
                    ON D.sector_id=S.id \
                    WHERE D.id=${data["doctor_id"]||"0"}
                `);

                if(result.length == 1) {
                    doctorID = data["doctor_id"];
                    dataSet = result[0];
                } else success = false;
            } else doctorID = dataSet["doctor_id"];

            if(success) {
                var r = await query(`
                    INSERT INTO appointment
                    (time_start, time_end, doctor_id)
                    VALUES 
                    ('${data["time_start"]}', '${data["time_end"]}', ${doctorID})
                `);

                res = {
                    "id": r["insertId"],
                    "start": data["time_start"],
                    "end": data["time_end"],
                    "reseved": false,
                    "doctor": {
                        "id": doctorID,
                        "name": dataSet["doctor_name"],
                        "firstname": dataSet["doctor_firstname"]
                    },
                    "sector": {
                        "id": dataSet["sector_id"],
                        "name": dataSet["sector_name"],
                        "description": dataSet["sector_description"],
                        "color": dataSet["sector_color"]
                    }
                }
            }
        } else res = "Requête interdite";
    }

    return res;
}

async function subscribeAppointments(headers, data, appointmentID, query) {
    var res = {};

    if(headers["authorization"] && data["client_id"]) {
        var token = headers["authorization"].replace("Bearer ", "");
        var clientID = data["client_id"];

        var result = await query(`
            SELECT A.client_id \
            FROM user U \
            JOIN user_client UC \
            ON U.id=UC.user_id \
            JOIN user_token UT \
            ON U.id=UT.user \
            LEFT OUTER JOIN appointment A \
            ON A.id=${appointmentID} \
            WHERE UC.client_id=${clientID} \
            AND UT.token="${token}"
        `);

        if(result.length == 1) { // le client est bien lié à l'utilisateur
            if(result[0]["client_id"] == null) {
                await query(`
                    UPDATE appointment A SET client_id=${clientID} WHERE A.id=${appointmentID}
                `).then(() => {
                    // on a ajouté le rendez-vous au client
                    res["success"] = true;
                });
            } else res = "Déjà réservé";
        } else res = "Action interdite";
    }

    return res;
}

async function handleDelete(splittedRoute, headers, data, query) {
    var res = { statusCode: 302, location: '/404' };
    if(splittedRoute.length == 2 && splittedRoute[1] == "unsubscribe") {
        res = {
            statusCode: 200,
            contentType: 'application/json',
            content: JSON.stringify(await unsubscribeAppointments(headers, splittedRoute[0], query))
        }
    }
    return res;
}

async function unsubscribeAppointments(headers, appointmentID, query) {
    var res = {};
    if(headers["authorization"]) {
        var token = headers["authorization"].replace("Bearer ", "");

        var result = await query(`
            SELECT A.client_id \
            FROM appointment A \
            JOIN client C \
            ON A.client_id=C.id \
            JOIN user_client UC \
            ON C.id=UC.client_id \
            JOIN user_token UT \
            ON UC.user_id=UT.user \
            WHERE A.id=${appointmentID} \
            AND UT.token="${token}"
        `);
        
        if(result.length == 1) { // si le rendez-vous était bien pour ce client
            await query(`
                UPDATE appointment SET client_id=NULL WHERE client_id=${result[0]["client_id"]}
            `).then(() => {
                res["success"] = true;
            })
        };
    }
    return res;
}

module.exports = {
    handle: handle
}