require("dotenv").config();

const http = require('http');
const fs = require('fs');

const githubRequest = require('./githubRequest');
const { getRedirection } = require("./redirect");
const api = require('./api/api');

const env = process.env;

const HOSTNAME = env.SERVER_IP;
const PORT = env.SERVER_PORT;
const SITE_FOLDER = env.SITE_FOLDER;

function getAssociatedResponseSite(askedRessource) {
	askedRessource = askedRessource.split("?")[0]; // on enlève les query parameters
	var res = { // par défaut tout fonctionne
		statusCode: 200,
		contentType: "text/html",
		content: undefined
	};

	var splitted_path = askedRessource.split(".");
	var extension = splitted_path[splitted_path.length-1].toLowerCase();

	var fileToRead = SITE_FOLDER + askedRessource;
	var encoding = "utf-8";
	
	switch (extension) {
		case "js":
			res.contentType = "text/javascript";
			break;
		case "css":
			res.contentType = "text/css";
			break;
		case "png": // pour les images, il faut les renvoyer sans encodage et avec un content type spécial
		case "gif":
			res.contentType = "image/" + extension;
			encoding = null;
			break;
		case "jpg":
		case "jpeg":
			res.contentType = "image/jpeg";
			encoding = null;
			break;
		case "ico":
			res.contentType = "image/x-icon";
			encoding = null;
			break;
		case "html": // on lui donne exactement la page demandé
			break;
		default:
			fileToRead = SITE_FOLDER + "/index.html";
			break;
	}

	if(askedRessource == "/404") { // on demande explicitement la page 404
		res.statusCode = 404;

		if(fs.existsSync(fileToRead)) { // si le site n'est pas mis en ligne, il ne peut pas y avoir de 404 personnalisé
			res.content = fs.readFileSync(fileToRead, encoding);
		}

	} else if(fs.existsSync(fileToRead)) { // si la ressource existe, on la donne

		if(encoding != null) { // encoding null <=> lecture binaire
			res.content = fs.readFileSync(fileToRead, encoding);
			if(fileToRead.endsWith(".html")) {
				res.content += '<script>window.__BASE_PATH__=window.location.pathname.replace("' + askedRessource + '", "");</script>';
			}
		} else {
			res.content = fs.readFileSync(fileToRead);
		}

	} else { // on redirige vers 404 car la ressource n'existe pas
		res.statusCode = 302; // code de redirection
		res.location = "/404"; // page de redirection
	}

	return res;
}

const server = http.createServer(async (req, res) => {
	const askedRessource = getRedirection(req.url);
	req.url = askedRessource;

	var askedContent;
	if(askedRessource.toLowerCase().startsWith("/api")) {
		askedContent = await api.handleRequest(req);
	} else if(askedRessource.toLowerCase().startsWith("/github")) {
		askedContent = await githubRequest.handleRequest(req);
	} else {
		askedContent = getAssociatedResponseSite(askedRessource);
	}

	if(askedContent ==  undefined) askedContent = { statusCode: 302, location: '/500'};

	res.statusCode = askedContent.statusCode;

	switch(askedContent.statusCode) {
		case 302: // code de redirection
			res.setHeader('Location', askedContent.location);
			break;
		default:
			res.setHeader('Content-Type', askedContent.contentType);
			break;
	}

	if(askedContent.content != undefined) { // s'il y a quelque chose à écrire, on l'écrit
		res.end(askedContent.content);
	} else { // sinon, on ferme simplement la communication
		res.end();
	}
});

server.listen(PORT, HOSTNAME, () => {
	console.log(`Serveur démarré sur http://${HOSTNAME}:${PORT}`);
});