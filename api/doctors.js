async function handle(method, splittedRoute, headers, data, queryParameters, query) {
    var res = { statusCode: 302, location: '/404' };
    switch(method) {
        case "GET":
            res = await handleGet(splittedRoute, headers, data, query);
            break;
        case "DELETE":
            break;
    }
    return res;
}

async function handleGet(splittedRoute, headers, data, query) {
    var res = { statusCode: 302, location: '/404' };
    var content;

    if(splittedRoute.length == 1) { // "/api/doctors/{doctor_id}"
        content = await getDoctor(splittedRoute[0], query);
    } else if(splittedRoute.length == 0) {
        content = await getDoctors(query);
    }

    if(content) {
        res = {
            statusCode: 200,
            contentType: 'application/json',
            content: JSON.stringify(content)
        };
    }

    return res;
}

async function getDoctor(doctorID, query) {
    var res = {success: false};

    var result = await query(
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
    );
    
    var entry;
    if(result.length != 0) {
        entry = result[0];
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
        

    return res;
}

async function getDoctors(query) {
    var res = { success: false };

    var result = await query(
        `SELECT \
        D.id as doctor_id, D.name, D.firstname, \
        S.id as sector_id, S.name as sector_name, S.description, S.job as job_name, S.color, \
        A.id as appointment_id, A.time_start, A.time_end, A.client_id \
        FROM doctor D \
        JOIN sector S \
        ON D.sector_id = S.id \
        LEFT OUTER JOIN appointment A \
        ON D.id = A.doctor_id
        ORDER BY D.id
    `);
    
    res = [];
    var doctor;
    var doctorID;

    for(i = 0 ; i < result.length ; i++) {
        entry = result[i];
        if(doctorID != entry["doctor_id"]) {
            if(doctor) res.push(doctor);

            doctorID = entry["doctor_id"];
            doctor = {
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
            }
        }

        if(entry["appointment_id"]) { // si il a une consultation (reservée ou non), on la marque
            doctor["appointments"].push({
                id: entry["appointment_id"],
                start: entry["time_start"],
                end: entry["time_end"],
                reserved: entry["client_id"] != null
            });
        }
    }

    if(doctor) res.push(doctor);

    return res;
}

module.exports = {
    handle: handle
}