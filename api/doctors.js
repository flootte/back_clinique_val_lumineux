async function handle(method, splittedRoute, headers, data, queryParameters, query) {
    res;
    switch(method) {
        case "GET":
            res = await handleGet(splittedRoute, headers, data, query);
            break;
        case "POST":
            break;
        case "PUT":
            break;
        case "DELETE":
            break;
        default:
            res = { statusCode: 302, location: '/404' };
            break;
    }
    return res;
}

async function handleGet(splittedRoute, headers, data, query) {
    res = { statusCode: 302, location: '/404' };
    if(splittedRoute.length == 1) { // "/api/doctors/{doctor_id}"
        res = {
            statusCode: 200,
            contentType: "application/json",
            content: JSON.stringify(await getDoctor(splittedRoute[0], query))
        };
    } else if(splittedRoute.length == 0) {
        res = {
            statusCode: 200,
            contentType: "application/json",
            content: JSON.stringify(await getDoctors(query))
        };
    }
    return res;
}

async function getDoctor(doctorID, query) {
    res = {success: false};

    await query(
        `SELECT \
        D.id as doctor_id, \
        D.name, \
        D.firstname, \
        S.id as sector_id, \
        S.name as sector_name, \
        S.description, \
        S.job as job_name, \
        S.color, \
        A.id as appointment_id, \
        A.time_start, \
        A.time_end, \
        A.client_id \
        FROM doctor D \
        JOIN sector S \
        ON D.sector_id = S.id \
        LEFT OUTER JOIN appointment A \
        ON D.id = A.doctor_id \
        WHERE D.id = ${doctorID} \
        ORDER BY A.time_start`
    ).then((result) => {
        if(result.length != 0) {
            entry = result[0]
            res = {
                "id": entry["doctor_id"],
                "name": entry["name"],
                "firstname": entry["firstname"],
                "sector": {
                    "id": entry["sector_id"],
                    "name": entry["sector_name"],
                    "description": entry["description"],
                    "job_name": entry["job_name"],
                    "color": entry["color"]
                },
                "appointments": []
            }
        }

        for(i = 0 ; i < result.length ; i++) {
            entry = result[i];
            if(entry["appointment_id"] != null) {
                res["appointments"].push({ 
                    "id": entry["appointment_id"],
                    "start": entry["time_start"],
                    "end": entry["time_end"],
                    "reserved": entry["client_id"] != null
                });
            }
        }
    });

    return res;
}

async function getDoctors(query) {
    res = { success: false };

    await query(
        `SELECT \
        D.id as doctor_id, \
        D.name, \
        D.firstname, \
        S.id as sector_id, \
        S.name as sector_name, \
        S.description, \
        S.job as job_name, \
        S.color, \
        A.id as appointment_id, \
        A.time_start, \
        A.time_end, \
        A.client_id \
        FROM doctor D \
        JOIN sector S \
        ON D.sector_id = S.id \
        LEFT OUTER JOIN appointment A \
        ON D.id = A.doctor_id`
    ).then((result) => {
        res = [];
        addedDoctors = [];

        for(i = 0 ; i < result.length ; i++) {
            entry = result[i];
            index = addedDoctors.findIndex((doctorID) => doctorID == entry["doctor_id"]);
            if(index == -1) {
                addedDoctors.push(entry["id"]);
                toAdd = { // on créé le docteur
                    id: entry["doctor_id"],
                    name: entry["name"],
                    firstname: entry["firstname"],
                    sector: {
                        id: entry["sector_id"],
                        name: entry["sector_name"],
                        description: entry["description"],
                        job_name: entry["job_name"],
                        color: entry["color"]
                    },
                    appointments: []
                };

                if(entry["appointment_id"] != null) { // si il a une consultation (réservée ou non), on la marque
                    toAdd["appointments"].push({
                        id: entry["appointment_id"],
                        start: entry["time_start"],
                        end: entry["time_end"],
                        reserved: entry["client_id"] != null
                    });
                }

                res.push(toAdd); // on ajoute au résultat final
            } else if(entry["appointment_id"] != null) { // le docteur existe déjà, et on a une autre consultation à ajouter
                res[index]["appointments"].push({
                    id: entry["appointment_id"],
                    start: entry["time_start"],
                    end: entry["time_end"],
                    reserved: entry["client_id"] != null
                });
            }
        }
    });

    return res;
}

module.exports = {
    handle: handle
}