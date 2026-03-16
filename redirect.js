const fs = require("fs");

var redirections = [];

if(fs.existsSync(`.redirect`)) {
    var lines = fs.readFileSync(`.redirect`, { encoding: "utf-8", flag: "r" }).split(`\n`);
    var i = 1;
    lines.forEach(l => {
        if(!l.startsWith(`#`)) { // commencer par # = commentaire
            if(/^\S+\s->\s\S+$/.test(l)) {
                var splittedLine = l.split(` -> `);
                redirections.push({                  // on ajoute la redirection
                    "from": splittedLine[0],
                    "to": splittedLine[1]
                });
            } else console.warn(`Redirection invalide .redirect:${i}`);
        }
        i++;
    });
}

function removeEndSlashes(uri) {
    while(uri.endsWith("/")) {
        uri = uri.slice(0,-1);
    }
    return uri;
}

function getRedirection(path) {
    path = removeEndSlashes(path);
    var redirect = undefined;
    var i = 0;
    while(!redirect && i < redirections.length) {
        var redirection = redirections[i];
        var from = removeEndSlashes(redirection["from"]);
        
        if(new RegExp("{x}").test(from)) {
            var splittedRedirection = from.split("{x}");
            var y = 0;
            while(y < splittedRedirection.length) {
                if(splittedRedirection[y] == "") {
                    splittedRedirection.splice(y, 1);
                } else y++;
            }
            var partNumber = splittedRedirection.length;
            
            var workingPath = path;
            var match = true;
            var j = 0;
            var args = [];

            while(match && j < partNumber) {
                if(new RegExp(`^${splittedRedirection[j]}`).test(workingPath)) {
                    workingPath = workingPath.slice(splittedRedirection[j].length);
                    if( (j == partNumber-1 && from.endsWith("{x}")) || j != partNumber-1) {
                        if(workingPath.length == 0) {
                            match = false;
                        }
                        else {
                            var gettedArg = workingPath.split("/")[0];
                            workingPath = workingPath.slice(gettedArg.length);
                            args.push(gettedArg);
                        }
                    }
                } else match = false;
                j++;
            }

            if(match && workingPath == "") {
                redirect = redirection["to"];
                for(var x = 0 ; x < args.length ; x++) { // on remplace tous les arguments qu'on connaît dans la nouvelle URL
                    redirect = redirect.replaceAll(`{${x}}`, args[x]);
                }
            }
        } else if(new RegExp(`^${redirection}/*$`).test(path)) redirect = redirection["to"];
        i++;
    }

    return redirect||path; // path si redirect == undefined
}

/*module.exports = {
    redirections: redirections
}*/