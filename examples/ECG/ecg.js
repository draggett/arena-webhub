// application for streaming multichannel ECG data

let webhub = require('arena-webhub')({
	port: 8888,
	accountPath: '/account',
	accountManager: accountManager,
	validateJWT: validateJWT
});

// thing with one property per channel and update rate of 100Hz

let td = {
    "name": "ecg",
    "id": "ecg123",
    "description": "Combined measurement of ECG, breathing and seismocardiogram",
    "rate": 100,
    "properties": {
        "chan1": {
            "type": "number",
            "value": 0,
            "description": "electrocardiogram lead 1"
        },
        "chan2": {
            "type": "number",
            "value": 0,
            "description": "electrocardiogram lead 2"
        },
        "chan3": {
            "type": "number",
            "value": 0,
            "description": "breathing via a respiratory band"
        },
        "chan4": {
            "type": "number",
            "value": 0,
            "description": "seismocardiogram data"
        }
    }
};

try {
	let thing = webhub.produce(td);
	try {
		console.log("produced thing: " + thing.name);
		
		// make thing available for clients
		
		thing.expose();
		
		console.log('ready and waiting ...');
	} catch (err) {
		console.log('failed to initialise thing');
	}
} catch (err) {
	console.log('failed to produce thing');
}


let now = 0;
let samples;  // array of records with [time, chan1, chan2, chan3, chan4]

let fs = require('fs');

fs.readFile("ecg2.csv", "utf8", function (err, contents) {
	if (err) {
		console.log("couldn't open data file: " + err);
		return;
	}
	
	console.log("reading data file");

	let records = contents.split("\n");
	
	// trim empty record at end if present due to newline
	let record = records[records.length - 1];
	console.log('last record = ' + JSON.stringify(record));
	if (record === "")
		records.pop();
	
	samples = new Array(records.length);
	for (let i = 0; i < records.length; ++i) {
		record = records[i];
		let sample = record.split(",")
		for (let j = 0; j < sample.length; ++j) {
			try {
			sample[j] = Number.parseFloat(sample[j]);
			} catch (e) {
				console.log("failed to parse number: " + sample[j]);
			}
		}
		samples[i] = sample;
	}
	console.log("successfully read ecg2.csv with " + samples.length + " records");
	
	try {
		let thing = webhub.produce(td);
		try {
			console.log("produced thing: " + thing.name);
		
			thing.expose();
		
			let delay = 10;  // milliseconds between updates

			setInterval(() => {
				let sample = samples[now];
			
				if (++now >= samples.length)
					now = 0;

				thing.properties.chan1.write(sample[1]);
				thing.properties.chan2.write(sample[2]);
				thing.properties.chan3.write(sample[3]);
				thing.properties.chan4.write(sample[4]);
			}, delay);

			console.log('ready and waiting ...');
		} catch (err) {
			console.log('failed to initialise thing');
		}
	} catch (err) {
		console.log('failed to produce thing');
	}

});

// helper for http server
function fail(status, description, response) {
	let body = status + ' ' + description;
	console.log(body);
	response.writeHead(status, {
		'Content-Type': 'text/plain',
		'Access-Control-Allow-Origin': '*',
		'Content-Length': body.length
	});

	response.write(body);
	response.end();
}

// helper for http server
function succeed(status, description, response) {
	let body = status + ' ' + description;
	console.log(body);
	response.writeHead(status, {
		'Content-Type': 'text/plain',
		'Access-Control-Allow-Origin': '*',
		'Access-Control-Allow-Credentials': 'true',
		'Content-Length': body.length
	});

	response.write(body);
	response.end();
}

// manager for user accounts and security tokens
function accountManager (request, response) {
	// handles all HTTPS requests to the accountPath:
	// responsible for adding/removing user accounts,
	// logging in and generation of JWT tokens, and
	// logging out and handling forgotten passwords
	return fail(500, "missing account manager", response);
}

function validateJWT (token, url) {
	// dummy function to be replaced by code that
	// tests the validity of the JWT token given
	// the HTTPS or WSS request's URL
	console.log('verifying JWT: "' + token + '" for ' + url);
	return true;
}
