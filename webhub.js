// Arena Web Hub with support for JWT, HTTPS, Server-Sent Events and WebSockets

var HTTPS = require("https"),
	URL = require('url'),
	PATH = require('path'),
	FS = require('fs'),
	HASHES = require('jshashes');

/*
server_options provide localhost a key and certificate as created using:

openssl req -newkey rsa:2048 -x509 -nodes -keyout privkey.pem -new \
-out fullchain.pem -subj /CN=localhost -reqexts SAN -extensions SAN \
-config <(cat /System/Library/OpenSSL/openssl.cnf \
    <(printf '[SAN]\nsubjectAltName=DNS:localhost')) -sha256 -days 3650
        
Users will be warned that a secure connection cannot be made.

On Chrome you can inform the browser that you trust this certificate.

On Safari you will need to follow these steps:

1.	Locate where your certificate file is. It is likely to be
	somewhere near your web server configurations.
2.	Open up Keychain Access. You can get to it from
	Application/Utilities/Keychain Access.app.
3. 	Drag your certificate into Keychain Access.
4. 	Go into the Certificates section and locate the certificate you just added
5. 	Double click on it, enter the trust section and under
	“When using this certificate” select “Always Trust”
*/

const default_domain = 'localhost';
const default_port = 8888;
const default_certs_dir = '.';

let config = {
  	certs: default_certs_dir, // must contain privkey.pem and fullchain.pem
	port: default_port,
	domain: default_domain,
	accountPath: '/account',
	accountManager: (request, response) => {
		// handles all HTTPS requests to the accountPath:
		// responsible for adding/removing user accounts,
		// logging in and generation of JWT tokens, and
		// logging out and handling forgotten passwords
		return fail(500, "missing account manager", response);
	},
	validateJWT: (token, url) => {
		// applications are responsible for managing user accounts and JWT tokens
		// this function should validate a JWT token given a request's URL
		// this is a dummy function to be overwritten by app supplied one
		throw new Error("application didn't provide JWT validator")
		return false;  // return true if token is valid for this URL
	}
}

const mime_types = {
    "html": "text/html",
    "txt": "text/plain",
    "js": "text/javascript",
    "json": "application/json",
    "css": "text/css",
    "jpeg": "image/jpeg",
    "jpg": "image/jpeg",
    "png": "image/png",
    "gif": "image/gif",
    "ico": "image/x-icon",
	"pdf": "application/pdf",
    "ttl": "text/turtle",
    "rdf": "text/turtle",
    "crl": "text/crl",
	"csv": "text/plain"
};

let things = {};  // map from name to thing

class ThingProperty {
	constructor(thing, name, meta) {
		this.name = name;
		this.description = meta.description;
		this.meta = meta;
		this.type = meta.type;
		this.writable = meta.writable;
		this.thing = thing;
		
		if (meta.hasOwnProperty('value'))
			this.value = meta.value;
		else if (thing.model.types && meta.type &&
				thing.model.types[meta.type] &&
				thing.model.types[meta.type].hasOwnProperty('value')) {
			this.value = thing.model.types[meta.type].value;
		}
	}
	
	// called by exposing app to update property value and notify clients
	write(data) {
		// be safe
		if (data === undefined)
			data = null;
			
		//console.log('validate ' + this.name + ' = ' + data);
		if (invalid(data, this.meta, this.thing))
			throw new Error('writing property ' + this.name +
				 ' with invalid data ' + JSON.stringify(data));
			
		this.value = data;
		
		// notify external clients of change
		this.thing.emitValue(this.name, data);
	}
}

class ThingAction {
	constructor(thing, name, meta) {
		this.name = name;
		this.description = meta.description;
		this.meta = meta;
		this.thing = thing;
	}
	
	// apps should call thing.addActionHandler to register an
	// action handler that returns a promise for the response
	
	// for an exposed thing, invoke should simply call the handler
	// for a consumed thing, invoke should use HTTP or WebSockets
	// *** FIX ME ***
	
	invoke(input) {	
		let action = this;	
		let handler = this.handler;
		let perform = function (resolve, reject) {
			// do something using action handler
			// then resolve or reject as appropriate
			// handler should throw exception on error
			// *** will a long duration action block HTTP? ***
			try {
				if (action.meta && action.meta.input && invalid(input, action.meta.input, action.thing)) {
					console.log('invalid input: ' + input);
					throw new Error('invoking action ' + action.name +
						 ' with invalid input ' + JSON.stringify(input));
				}
				
				if (handler) {
					// application handler returns a promise
					handler(input).then(output => {
						if (action.meta.output && invalid(output, action.meta.output, action.thing)) {
							console.log('invalid output: ' + output);
							throw new Error('invalid action ' + action.name +
								' with invalid response ' + JSON.stringify(data));
						}
						console.log('action ' + action.name + ' returned ' + JSON.stringify(output));
						resolve(output);
					}).catch(err => {
						console.log('action handler failed: ' + err);
						reject(err);
					});
				} else {
					// nothing to do so succeed immediately
					// or should we fail if there is no handler?
					console.log('no handler for action ' + action.name);
					resolve();
				}
			} catch (err) {
				reject(err);
			}
		};
		
		return new Promise(function (resolve, reject) {
			perform(resolve, reject);
		});
	}
}

class ThingEvent {
	constructor(thing, name, meta) {
		this.name = name;
		
		if (!(meta === undefined) && meta !== null ) {
			this.meta = meta;
			this.description = meta.description;
			this.type = meta.type;
		}
		
		this.thing = thing;
		this.longpoll = [];
	}
	
	emit(data) {	
		if (invalid(data, this.meta, this.thing))
			throw new Error('event ' + this.name +
				' with invalid data ' + JSON.stringify(json));
						
		// notify any clients using HTTPS long polling
		
		let longpoll = this.longpoll;
		
		if (longpoll && longpoll.length) {
			let body = JSON.stringify(data);
			
			for (let i = 0; i <longpoll.length; ++i ) {
				let response = longpoll[i];
				response.writeHead(200, {
					'Content-Type': 'text/plain',
					'Access-Control-Allow-Origin': '*',
					'Content-Length': body.length
				});

				response.write(body);
				response.end();
			}
			
			this.longpoll = [];
		}
		
		this.thing.emitEvent(this.name, data);
	}
}

function new_event_stream(id, stream) {
	console.log("new event stream " + id);
	console.log("streams[id] = " + streams[id]);
	if (!streams[id]) {
		++stream_count;
		streams[id] = stream;
	}
}

function lost_event_stream(id) {
	console.log("lost event stream " + id);
	if (streams[id]) {
		--stream_count;
		delete streams[id];

		if (stream_count < 1)
			stop();
	}
}

// check that the data conforms to the metadata
// which includes its type, min and max, etc.
// this assumes that the data model itself is valid
function invalid(data, meta, thing) {
	if (meta === undefined) {
		if (data === undefined || data === null)
			return false;
			
		return true;
	}
		
	if (data === undefined && meta.required)
		return true;

	let type = meta.type;
	
	// missing type accepts anything
	if (type === undefined)
		return false;
		
	// application defined type?
	
	if (thing.model.types && thing.model.types.hasOwnProperty(type))
		return invalid(data, thing.model.types[type], thing);
		
	if (typeof (meta.enum) === 'array') {
		list = meta.enum;
		
		for (let i = 0; i < list.length; ++i ) {
			if (data === list[i])
				return false;
		}
		
		return true;
	}
	
	if (type === 'null' && data !== null)
		return true;
		
	if (type === 'const' && data !== meta.const)
		return true;
	
	if (type === 'boolean')
		return !(data === true || data === false);
		
	if (type === 'string') {
		if (typeof data !== 'string')
			return true;
			
		if (meta.regex) {
			const regex = new RegExp(meta.regex);
			return ! regex.test(data);
		}
		
		return false;
	}
		
	if (type === 'number' || type === 'integer') {
		if (typeof data !== 'number')
			return true;
			
		if (type === 'integer' && !Number.isInteger(data))
			return true;
						
		if (meta.minimum !== undefined && data < meta.minimum)
			return true;
			
		if (meta.maximum !== undefined && data > meta.maximum)
			return true;
			
		return false;
	}
	
	// arrays and objects are more complicated
	// is it acceptable for data to be null when expecting an array?
	
	if (type === 'array') {
		if (!Array.isArray(data))
			return true;
			
		let length = data.length;
		
		if (meta.minItems !== undefined && length < meta.minItems)
			return true;
			
		if (meta.maxItems !== undefined && length > meta.maxItems)
			return true;
			
		let items = meta.items;
		
		if (items !== undefined) {
			for (let i = 0; i < length; ++i) {
				if (!invalid(data[i], meta, thing))
					return true;
			}
		}
		
		return false;
	}
	
	// is it acceptable for data to be null when expecting an object?
	
	if (type === 'object') {
		if (data === null || typeof data !== 'object' || Array.isArray(data))
			return true;
		let properties = meta.properties;
			
		for (name in data) {
			if (data.hasOwnProperty(name)) {
				if (!properties.hasOwnProperty(name))
					return true;
					
				if (invalid(data[name], properties[name], thing)) {
					return true;
				}
			}
		}
		
		let required = meta.required;
		
		if (required === undefined)
			return false;
			
		// we need to check for missing required properties
		
		for (let i = 0; i < required.length; ++i) {
			if (!data.hasOwnProperty(required[i]))
				return true;
		}
			
		return false;
	}
	
	return true;
}

function b2a (str) {
	return Buffer.from(str, 'latin1').toString('base64');
}

// produce takes a JSON thing description and returns a thing
// you then need to expose it to make it available to clients
function produce(model) {
	console.log("model is " + JSON.stringify(model, null, 4));
	let thing = {
		properties: {},
		actions: {},
		events: {},
		clients: {},	// stream ID -> stream
		sockets: [],	// list of web sockets
		model: model
	};
	
	let name,
		properties = model.properties,
		actions = model.actions,
		events = model.events;
		
	thing.id = model.id;
	thing.name = model.name;
	model.platform = "https://github.com/draggett/arena-webhub";

	thing.emitEvent = function (name, json) {
		if (thing.events.hasOwnProperty(name)) {
			// note that event: is no longer supported for SSE
			// so use an object wrapper to convey event name
			if (json === undefined)
				json = {"event":name};
			else
				json = {"event":name,"data":json};
				
			let message = JSON.stringify(json);
			message = "data: "+ message.replace(/\n/g, '\ndata: ') + "\n\n";

			// clients for server-sent event stream
			let clients = thing.clients;
		
			for (let id in clients) {
				if (clients.hasOwnProperty(id)) {
					let client = clients[id];
					client.response.write(message);
				}
			}
			
			let sockets = thing.sockets;
			
			for (let i = 0; i < sockets.length; ++i) {
				ws_send(sockets[i], JSON.stringify(json));
			}
		} else {
			console.log('unknown event: ' + name + ' on ' + thing.name);
		}
	};
	
	thing.emitValue = function (name, value) {
		// note that event: is no longer supported for SSE
		// so use an object wrapper to convey event name
		if (thing.properties.hasOwnProperty(name)) {
			// be safe as stringify throws exception on undefined
			if (value === undefined)
				value = {"property":name};
			else
				value = {"property":name,"data":value};
				
			let message = JSON.stringify(value);
			message = "data: "+ message.replace(/\n/g, '\ndata: ') + "\n\n";
			let clients = thing.clients;

			if (clients !== undefined) {
				for (var id in clients) {
					if (clients.hasOwnProperty(id)) {
						let client = clients[id];
						client.response.write(message);
					}
				}
			}

			let sockets = thing.sockets;
			if (sockets !== undefined ) {
				//console.log('there are ' + sockets.length + ' socket clients');
				for (let i = 0; i < sockets.length; ++i) {
					ws_send(sockets[i], JSON.stringify(value));
				}
				
				//console.log('sent data to sockets');
			}
		} else {
			console.log('unknown property: ' + name + ' on ' + thing.name);
		}
	};
	
	thing.emitState = function (properties) {
		// note that event: is no longer supported for SSE
		// so use an object wrapper to convey event name
		let obj = {};
		
		if (properties === undefined)
			properties = thing.properties;
			
		for (var name in properties) {
			if (properties.hasOwnProperty(name)) {
				let value =  properties[name].value;
				
				if (value !== undefined)
					obj[name] = value;
			}
		}
		
		let json = JSON.stringify({"state":obj});
		
		// for server-sent event stream
		message = "data: "+ message.replace(/\n/g, '\ndata: ') + "\n\n";
		let clients = thing.clients;

		for (var id in clients) {
			if (clients.hasOwnProperty(id)) {
				let client = clients[id];
				client.response.write(message);
			}
		}

		let sockets = thing.sockets;
		
		for (let i = 0; i < sockets.length; ++i) {
			ws_send(sockets[i], JSON.stringify(json));
		}
	};
	
	for (name in properties) {
		if (properties.hasOwnProperty(name)) {
			thing.properties[name] = new ThingProperty(thing, name, properties[name]);
		}
	}
	
	for (name in actions) {
		if (actions.hasOwnProperty(name)) {
			thing.actions[name] = new ThingAction(thing, name, actions[name]);
		}
	}
	
	for (name in events) {
		if (events.hasOwnProperty(name)) {
			thing.events[name] = new ThingEvent(thing, name, events[name]);
		}
	}
				
	thing.setActionHandler = function (name, handler) {
		if (thing.actions[name])
			thing.actions[name].handler = handler;
	};
	
	thing.setWriteHandler = function (name, handler) {
		if (thing.properties[name])
			thing.properties[name].handler = handler;
	};
	
	thing.receive = function (socket, message) {
		// handle incoming web socket message
		
		// be safe against zero length messages
		if (message.length === 0)
			return;
			
		let fail = (id, status, description) => {
			if (typeof id !== "string")
				id = "unknown";
				
			console.log('fail: ' + id + ' ' + status + ' ' + description);
			let json = {
				id: id,
				status: status
			};
			
			if (description !== undefined)
				json.description = description;
				
			ws_send(socket, JSON.stringify(json));
		};
		
		let succeed = (id, json) => {
			if (json) {
				json.id = id;
				json.status = 200;
			} else {
				console.log('succeed with no data to return');
				json = {
					id: id,
					status: 200
				};
			}

			ws_send(socket, JSON.stringify(json));
		};
		
		try {
			let json = JSON.parse(message);
			
			if (json.property) {
				let property = thing.properties[json.property];
				
				if (property !== undefined) {
					try {
						property.write(json.data);
						console.log("write succeeded");
						succeed(json.id);
					} catch (err) {
						console.log("couldn't write " + json.data + ' to ' + property.name);
						fail(json.id, 400, "bad request");
					}
				} else {
					console.log("message with undefined property");
					fail(json.id, 400, "bad request");
				}
			} else if (json.state !== undefined) {
				let obj = json.state;
				let properties = thing.properties;
				
				for (name in obj) {
					if (obj.hasOwnProperty(name) && properties.hasOwnProperty(name)) {
						try {
							properties[name].write(obj[name]);
						} catch (err) {
							console.log("couldn't write " + obj[name] + ' to ' + name);
							return fail(json.id, 400, "bad request");
						}
					}
				}
				succeed(json.id);
			} else if (json.action !== undefined) {
				let action = thing.actions[json.action];
				
				if (action !== undefined) {
					action.invoke(json.input)
						.then(output => {
							console.log('output is ' + JSON.stringify(output));
							if (output !== undefined)
								succeed(json.id, {'output':output});
							else
								succeed(json.id);
						}).catch(err => {
							fail(json.id, 500, "action failed");
						});
				} else {
					fail(json.id, 400, "bad request");
				}
			} else {
				fail(json.id, 400, "bad request");
			}
			
		} catch (err) {
			console.log('badly formed client message: ' + message);
			fail(socket, 444, "badly formed client message");
		}
	};
	
	// used to attach a new web socket
	thing.addSocket = function(socket) {
		thing.sockets.push(socket);
		//.log('addSocket: there are ' + thing.sockets.length + ' sockets');
		
		socket.on('close', () => {
			// drop socket from thing.sockets
			let sockets = thing.sockets;
			const index = sockets.indexOf(socket);

			if (index !== -1) {
				sockets.splice(index, 1);
			};
		});
		
		// send state of all properties to sync new client
		let state = {};
		let properties = thing.properties;
		
		for (let name in properties) {
			if (properties.hasOwnProperty(name)) {
				state[name] = properties[name].value;
			}
		}
		
		ws_send(socket, JSON.stringify({state: state}));
	};
	
	// why isn't this capability on the action itself?
	thing.addActionHandler = (name, handler) => {
		if (thing.actions.hasOwnProperty(name))
			thing.actions[name].handler = handler;
	};
	
	thing.proxy = function (jwt) {
		thing.owner = jwt;
	};
	
	// republish thing on external web hub, e.g. to
	// provide access to things behind a firewall
	thing.addRemoteClient = function (wss_uri, jwt) {
		const proxy = URL.parse(wss_uri);
		const wsKey = b2a(Math.random().toString(36).substring(2, 10) +
			Math.random().toString(36).substring(2, 10));
		const wsAccept = new HASHES.SHA1().b64(wsKey +
							"258EAFA5-E914-47DA-95CA-C5AB0DC85B11");
		const options = {
			hostname: proxy.hostname,
			port: proxy.port,
			path: proxy.path,
			method: 'GET',
			headers: {
				'Authorization': jwt,
				'Connection': 'Upgrade',
				'Sec-WebSocket-Key': wskey,
				'Sec-WebSocket-Version': 13
			}
		};
				
		let connect = function (resolve, reject) {
			const request = HTTPS.request(options);
			
			request.on('upgrade', (res, socket, head) => {
				console.log('got response to upgrade request');
				console.log('  with head length = ' + head.length);
				// response should be 101 Switching Protocols
				if (res.statusCode !== 101 ||
					res.headers['Upgrade'] !== 'websocket' ||
					res.headers['Connection'] !== 'Upgrade' ||
					res.headers['Sec-WebSocket-Accept'] !== wsAccept) {
					reject(new Error("couldn't connect to proxy: " + proxy.hostname));
				}
				
				thing.message = ""; // empty continuation buffer
			
				// set up listener for incoming frames      
				socket.on('data', data => {    			
					// if PING respond with PONG
					let octet = data.charCodeAt(0);
				
					if ((octet & 15) != 0x09) {
						// test FIN to check for continuation frame
						if ((octet & 128) == 128) {
							// final frame for this message
							let message = thing.message + ws_receive(data);
							thing.message = "";
							//console.log('received: ' + message);
							thing.receive(socket, message);
						} else {
							// save continuation
							thing.message += ws_receive(data);
						}
					}
				});

				
				// notify external web hub
				
				
				// finally add socket to thing
				thing.addSocket(socket);
				resolve(socket);
			});
			
			req.on('error', () => {
				reject(new Error("client error"));
			});
			
			req.on('close', () => {
				console.log("proxy connection closed");
				// should periodically try to reconnect 
			});
		};
		
		return new Promise(function (resolve, reject) {
			connect(resolve, reject);
		});

	};
	
	// sent text string to all clients via web sockets
	
	thing.send = function (data) {
		let sockets = thing.sockets;
		
		for (let i = 0; i < sockets.length; ++i) {
			ws_send(sockets[i], data);
		}
	};
	
	thing.expose = function () {
		let publish = (resolve, reject) => {
			things[thing.model.name] = thing;
			resolve(model);
		}
		
		return new Promise(function (resolve, reject) {
			publish(resolve, reject);
		});
	};
	
	//things[model.name] = thing;
	
	return thing;
}

// see http://cjihrig.com/blog/the-server-side-of-server-sent-events/
// and https://www.w3.org/TR/eventsource/
// thing registers stream and call-back for server to invoke
// when client connects to stream. This passes response to
// the app to use when it has an event to send to clients
// app calls response.end() when done and may then call
// unregister_stream if it doesn't want to handle any more clients

// this module supports server-sent events via HTTP
// apps need to register a path for a stream together with
// call-backs for notification of new stream and lost stream
// thereby allowing apps to send events to the stream

// generates IDs for tracking event streams
let gensym_count = 0;

function gensym() {
	return "id"+ (++gensym_count);
}

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

// helper for HTTP request authorisation
function authorised(request) {
	// JWT is usually passed via an HTTP header
    let token = request.headers.authorization;
    
    // For EventSource and WebSocket, JWT is passed as a URL parameter
    if (token === undefined) {
    	let url = URL.parse(request.url, true);
    	
    	if (url.query)
    		token = url.query.jwt;
    }
    
    // ask app to validate JWT authorisation token
    return (!token || config.validateJWT(token, request.url));
}

// handles GET & HEAD requests
function process_get(request, response, uri) {
	// if path is /things then return the set of thing models
	let path = URL.parse(request.url).pathname;
	
	if (path === "/things") {
		if (!authorised(request))
			return fail(401, "unauthorized", response);
		
		let list = [];
		
		for (var name in things) {
			if (things.hasOwnProperty(name)) {
				list.push(things[name].model);
			}
		}
		
		body = JSON.stringify(list, null, 4);
	
		response.writeHead(200, {
			'Content-Type': mime_types.json,
			'Pragma': 'no-cache',
			'Cache-Control': 'no-cache',
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Credentials': 'true',
			'Content-Length': body.length
		});

		if (request.method === "GET")
				response.write(body);

		response.end();
		return;
	}

	// does path start with /things/thingID for some thingID?

	if (/^\/things\/.+/.test(path)) {
		if (!authorised(request))
			return fail(401, "unauthorized", response);

		path = path.substr(8);
		
		let i = path.indexOf('/');
		var thingID, body;
		
		if (i < 0) {
			thingID = path;
			path = "";
		} else {
			thingID = path.substr(0, i);
			path = path.substr(i);
		}
		
		if (thingID) {
			let thing = things[thingID];
			
			if (!thing)
				return fail(404, "unknown thing: " + thingID, response);
				
			if (!thing.model)
				return fail(404, "no model for thing: " + thingID, response);
				
			if (path === "") {
				body = JSON.stringify(thing.model, null, 4);
				console.log(body);
			} else if (path === "/properties"){
				// construct set of property values
				let values = {};
				
				for (var name in thing.properties) {
					if (thing.properties.hasOwnProperty(name)) {
						values[name] = thing.properties[name].value;
					}
				}
				
				body = JSON.stringify(values, null, 4);
			} else if (/^\/properties\/.+/.test(path)) {
				path = path.substr(12);
				console.log("property name: " + path);
				let property = thing.properties[path];
				
				if (property === undefined)
					return fail(404, "unknown property: " + path, response);
					
				body = JSON.stringify(property.value, null, 4);
			} else if (path === "/events") {
				// add to thing's set of server-sent event streams
				console.log("new server-sent event stream for thing: " + thing.name);
				
				response.writeHead(200, {
					'Content-Type': 'text/event-stream',
					'Cache-Control': 'no-cache',
					'Connection': 'keep-alive',
					'Access-Control-Allow-Credentials': 'true',
					'Access-Control-Allow-Origin': '*'
				});

				if (request.method === "HEAD") {
					response.end();
					return;
				}

				let id = gensym();
				console.log('client id = ' + id);
				
				thing.clients[id] = {
					id: id,
					response: response
				};
				
				// tidy up when connection is closed
				// e.g. after a browser tab is hidden

				response.on("close", function () {
					console.log('lost client id = ' + id);
					let clients = thing.clients
					delete clients[id];
				});

				response.on("end", function () {
					console.log('lost client id = ' + id);
					let clients = thing.clients
					delete clients[id];
				});

				return;
			} else if (/^\/events\/.+/.test(path)) {
				path = path.substr(8);
				console.log("long poll on event named: " + path);
				let event = thing.events[path];
				
				if (event === undefined)
					return fail(404, "unknown event: " + path, response);
					
				event.longpoll.push(response);
				return;
			} else {
				return fail(404, "invalid request: " + uri, response);
			}
			
			console.log('body length = ' + body.length);
			
			response.writeHead(200, {
				'Content-Type': mime_types.json,
				'Pragma': 'no-cache',
				'Cache-Control': 'no-cache',
				'Access-Control-Allow-Origin': '*',
				'Access-Control-Allow-Credentials': 'true',
				'Content-Length': body.length
			});

			if (request.method === "GET")
					response.write(body);

			response.end();
			return;
		}
		
		return fail(404, "missing thingID: " + path, response);
	}
	
	let prefix = './www';

	console.log('request for "' + path + '"');
	// assume this is a request for a file

	if (path[path.length-1] === '/')
		path += 'index.html';

	let filename = decodeURI(prefix + path);
	let gzipped = false;

	console.log('filename: ' + filename);

	FS.stat(filename, function(error, stat) {
		var ext = PATH.extname(filename);
		var mime = null;

		if (ext === ".gz") {
			gzipped = true;
			ext = PATH.extname(filename.substr(0, filename.length-3));
		}

		if (ext.length > 1)
			mime = mime_types[ext.split(".")[1]];

		if (error || !mime) {
			console.log("unable to serve " + filename);
			var body = "404 not found: " + request.url;
			response.writeHead(404, {
				'Content-Type': 'text/plain',
				'Content-Length': body.length
			});

			if (request.method === "GET")
				response.write(body);

			response.end();
		} else {
			if (gzipped) {
				console.log("filename has mime type " + mime);
				response.writeHead(200, {
					'Content-Type': mime,
					'Content-Encoding': 'gzip',
					'Pragma': 'no-cache',
					'Cache-Control': 'no-cache',
					'Access-Control-Allow-Origin': '*',
					'Access-Control-Allow-Credentials': 'true',
					'Content-Length': stat.size
				});
			} else {
				response.writeHead(200, {
					'Content-Type': mime,
					'Pragma': 'no-cache',
					'Cache-Control': 'no-cache',
					'Access-Control-Allow-Origin': '*',
					'Access-Control-Allow-Credentials': 'true',
					'Content-Length': stat.size
				});
			}

			if (request.method === "GET") {
				var stream = FS.createReadStream(filename);
				stream.pipe(response);
			} else
				response.end();
		}
	});
}

// handles PUT & POST requests after getting the request body
function process_post(request, response, uri, body) {
	if (!authorised(request))
		return fail(401, "unauthorized", response);

	// be safe
	if (body === undefined)
		body = null;
		
	let path = URL.parse(request.url).pathname;

	// does path start with /things/thingID for some thingID?

	if (/^\/things\/.+/.test(path)) {
		path = path.substr(8);
		
		let i = path.indexOf('/');
		var thingID;
		
		if (i < 0) {
			thingID = path;
			path = "";
		} else {
			thingID = path.substr(0, i);
			path = path.substr(i);
		}
		
		if (thingID) {
			let thing = things[thingID];
			
			if (!thing)
				return fail(404, "unknown thing: " + thingID, response);
				
			// /things/thingID/properties to update all properties
			// /things/thingID/properties/propName to update given property
			
			if (path === "/properties") {
				// update properties from request body
				
				try {
					let values = JSON.parse(body);
					if (typeof values != 'object')
						return fail(555, "invalid data", response);
					
					// fail if any of the values are invalid or readonly
					for (var name in values) {
						if (values.hasOwnProperty(name)) {
							let value = values[name];
							let property = thing.properties[name];
							
							if (property === undefined)
								return fail(404, "unknown property name: " + name, response);

							if (property.meta) {
								if (property.meta.writable !== undefined  && !property.meta.writable)
									return fail(405, "read-only", response);
							
								if (invalid(value, property.meta, thing))
									return fail(400, "invalid data", response);
							}							
						}
					}
					
					// all values are good so update and notify
					for (var name in values) {
						if (values.hasOwnProperty(name)) {
							let value = values[name];
							let property = thing.properties[name];
							
							if (property != undefined) {
								property.value = value;
								
								// notify exposing app of external change
								if (property.handler)
									property.handler(value);
							}
						}
					}
					
					thing.emitState(values); // notify all clients
					// *** need to validate against model's data type ***
					// *** need to notify clients ***
					return succeed(204, "no data", response);
				} catch (err) {
					return fail(404, "invalid: " + body, response);
				}
			} else if (/^\/properties\/.+/.test(path)) {
				path = path.substr(12);
				console.log("property name: " + path);
				let property = thing.properties[path];
				
				if (property === undefined)
					return fail(404, "unknown property: " + path, response);
					
				console.log('parsing request body');
					
				// update named property from request body
				try {
					let value = JSON.parse(body);
					
					if (property.meta) {
						if (property.meta.writable !== undefined  && !property.meta.writable)
							return fail(405, "read-only", response);

						if (invalid(value, property.meta, thing)) {
							console.log('failed to set ' + path + ' to ' + value);
							return fail(400, "invalid data", response);
						}
					}

					property.value = value;
					
					// notify exposing app of external change
					if (property.handler)
						property.handler(value);
									
					console.log('setting ' + property.name + ' to ' + value);
					console.log('calling emitValue with path = ' + path + ' and value = ' + value);
					thing.emitValue(path, value);
					// *** need to validate against model's data type ***
					// *** need to notify clients ***
					console.log('succeeded in setting ' + property.name + ' to ' + property.value);
					return succeed(204, "no data", response);
				} catch (err) {
					console.log('failed to parse request body');
					return fail(404, "invalid: " + body, response);
				}
			}
			
			// /things/thingID/actions/actName to invoke given action (POST only)
			
			if (/^\/actions\/.+/.test(path)) {
				path = path.substr(9);
				//console.log("action name: " + path);
				
				let action = thing.actions[path];
				
				if (action === undefined)
					return fail(404, "unknown action: " + path, response);
					
				// *** need to validate input data against model's data type
				let input = null;
				
				//console.log(" input body is: " + JSON.stringify(body));
				
				if (body !== undefined) {
					try {
						input = JSON.parse(body);
					} catch (err) {
						return fail(404, "invalid: " + body, response);
					}
				}
				
				if (action.meta && action.meta.input && invalid(input, action.meta.input, thing))
					return fail(400, "invalid input", response);
					
				if (action.handler === undefined) {
					// succeed immediately as nothing to be done
					console.log('action ' + action.name + ' has no handler');
					return succeed(204, "no data", response);
				} else {
					//console.log('ready to invoke handler for action ' + action.name);
					// invoke handler and use promise to deliver response
					// after testing response against model's data type
					action.handler(input).then(output => {
						if (action.meta && action.meta.output && invalid(output, action.meta.output, thing)) {
							console.log(output + ' is invalid');
							return fail(400, "invalid output", response);
						}
						let body = JSON.stringify(output, null, 4);
						
						console.log('output body is ' + body);
						
						if (body === undefined) {
							console.log('body is undefined');
							response.writeHead(204, {
								'Content-Type': mime_types.json,
								'Pragma': 'no-cache',
								'Cache-Control': 'no-cache',
								'Access-Control-Allow-Origin': '*'
							});
						} else {
							response.writeHead(200, {
								'Content-Type': mime_types.json,
								'Pragma': 'no-cache',
								'Cache-Control': 'no-cache',
								'Access-Control-Allow-Origin': '*',
								'Content-Length': body.length
							});
							response.write(body);
						}
						
						response.end();
						return;
					}).catch(err => {
						console.log('handler failed: ' + err);
						return fail(500, "action failed: " + err, response);
					});
					
					return;  // deferred response
				}
			}
		}
		
		return fail(404, "missing thingID: " + uri.path, response);
	}
}

// send string data to web socket
function ws_send(socket, data) {
	//console.log("send: " + data);
	let header;
	let payload = new Buffer.from(data);
	const len = payload.length;
	
	if (len <= 125) {
		header = new Buffer.alloc(2);
		header[1] = len;
	} else if (len <= 0xffff) {
		header = new Buffer.alloc(4);
		header[1] = 126;
		header[2] = (len >> 8) & 0xff;
		header[3] = len & 0xff;
	} else { /* 0xffff < len <= 2^63 */
		header = new Buffer(10);
		header[1] = 127;
		header[2] = (len >> 56) & 0xff;
		header[3] = (len >> 48) & 0xff;
		header[4] = (len >> 40) & 0xff;
		header[5] = (len >> 32) & 0xff;
		header[6] = (len >> 24) & 0xff;
		header[7] = (len >> 16) & 0xff;
		header[8] = (len >> 8) & 0xff;
		header[9] = len & 0xff;
	}
	
	header[0] = 0x81;
	socket.write(Buffer.concat([header, payload],
		 header.length + payload.length), 'binary');
	//console.log('sent ' + data.length + ' bytes');
}

// return message as string
function ws_receive(raw)
{
	let data = unpack(raw); // string to byte array
	let fin = (data[0] & 128) == 128;
	let opcode = data[0] & 15;
	let isMasked = (data[1] & 128) == 128;
    let dataLength = data[1] & 127;
    let start = 2;
	let length = data.length;
	let output = "";
	
    if (dataLength == 126)
        start = 4;
    else if (dataLength == 127)
        start = 10;
        
    if (isMasked) {
		let i = start + 4;
		let masks = data.slice(start, i);
		let index = 0;
	
		while (i < length) {
			output += String.fromCharCode(data[i++] ^ masks[index++ % 4]);
		}
    } else {
		let i = start;
		while (i < length) {
			output += String.fromCharCode(data[i++]);
		}
    }

    //console.log("decode message: " + output);
    return output;
}

function unpack(str) {
    let bytes = new Uint8Array(str.length);
    
    for (let i = 0; i < str.length; i++) {
        bytes[i] = str.charCodeAt(i);
    }
    return bytes;
}

module.exports = options => {
	if (options) {
		if (options.port)
			config.port = options.port;
		
		if (options.domain)
			config.domain = options.domain;
			
		if (options.certs)
			config.certs = options.certs;
		
		if (options.accountPath)
			config.accountPath = options.accountPath;
		
		if (options.accountManager)
			config.accountManager = options.accountManager;
		
		if (options.validateJWT)
			config.validateJWT =  options.validateJWT;
	}
	
	config.base = 'https://' + config.domain + ':' + config.port;
		
	let webhub = {
		produce: produce
	};
	
	// certificates for transport layer security 

	let server_options = {
		key: FS.readFileSync(config.certs + '/privkey.pem'),
		cert: FS.readFileSync(config.certs + '/fullchain.pem')
	};

	// start the HTTPS server - expect to extend it to support WebSockets
	let server = HTTPS.createServer(server_options, function(request, response) {
		//console.log('http request: ' + request.url);
	
		let uri = URL.parse(URL.resolve(config.base, request.url));

		console.log('HTTP request: ' + request.method + ' ' + uri.path);
		//console.log(request.headers);
	
		if (request.method === "OPTIONS") {
			response.writeHead(200, {
				'Content-Length': 0,
				'Connection': 'keep-alive',
				'Access-Control-Allow-Origin': '*',
				'Access-Control-Allow-Methods': 'POST, GET, PUT, OPTIONS',
				'Access-Control-Allow-Credentials': 'true',
				'Access-Control-Allow-Headers': 'Content-Type, Upgrade, Authorization'
			});

			//response.write(body);
			response.end();
			return;
		}
	
		const re = new RegExp('^' + config.accountPath + '(/\\S*)?$');
	
		if (re.test(uri.pathname)) {
			return config.accountManager(request, response);
		}
	
		if (request.method === "GET" || request.method === 'HEAD') {
			process_get(request, response, uri);
		} else if (request.method === "PUT" || request.method === 'POST') {
			//console.log("headers: " + JSON.stringify(request.headers, null, 4));
			let contentType = request.headers['content-type'];
	
			if (contentType !== mime_types.json)
				return fail(500, "expected " + mime_types.json + " for content-type", response);

			// okay, get the request body and fail if too large
			const MAX_REQUEST_SIZE = 1048576;  // 1 Mb = 1024 squared
			let body = '';
		
			request.on('data', chunk => {
				if (body.length + chunk.length > MAX_REQUEST_SIZE) {
					fail(500, "request body too large", response);
				}

				body += chunk.toString(); // convert Buffer to string
			});
		
			request.on('end', () => {
				//console.log(body);
				process_post(request, response, uri, body);
			});
		
			request.on('error', () => {
				console.log('unexpected end of data');
				fail(500, "unexpected end of data", response);
			});

		} else { // unimplemented HTTP Method
			fail(501, "not implemented " + request.method + " " + request.url, response);
		}
	}).listen(config.port);

	console.log('started https server on port ' + config.port);

	// listen for close event to track long polling
	server.on('close', (request, socket, head) => {
		console.log('bye');
		console.log('request url: ' + request.url);
	});

	// listen for web socket connections from thing clients
	// for now each thing's client involves a separate socket
	// future work will share socket for things with same server
	server.on('upgrade', (request, socket, upgradeHead) => {
		console.log('received upgrade request with headers\n'
					 + JSON.stringify(request.headers, null, 4));
		if (request.headers.upgrade !== 'websocket') {
			return fail(501, "unable to upgrade to " + request.headers.upgrade, response);
		}
  
		if (!authorised(request))
			return fail(401, "unauthorized", response);
		
		// handle the websocket connection
		let uri = URL.parse(URL.resolve(config.base, request.url));
		console.log('web socket client for ' + uri.pathname);
  
		// generate the handshake key
		let SHA1 = new HASHES.SHA1().b64(request.headers["sec-websocket-key"] +
							"258EAFA5-E914-47DA-95CA-C5AB0DC85B11");
		//console.log("response key: " + SHA1);
  
		// send server response headers
		socket.write('HTTP/1.1 101 Switching Protocols\r\n' +
				   'Upgrade: WebSocket\r\n' +
				   'Connection: Upgrade\r\n' +
				   'Sec-WebSocket-Accept: ' + SHA1 + '\r\n' +
				   '\r\n');
			   
		socket.setEncoding('binary');
		
		socket.on('error', err => {
			console.log('socket error: ' + err);
		});

		// identify the thing and associated it with this socket

		let path = uri.pathname;
	
		if (/^\/things\/.+/.test(path)) {
			let thingID = path.substr(8);
			console.log('path: ' + path)
				
			if (thingID) {
				console.log('thingID: ' + thingID);
				let thing = things[thingID];
			
				if (!thing) {
					console.log("request missing thing ID");
					socket.end();
				}
			
				// add socket to thing's sockets
				thing.addSocket(socket);
				thing.message = ""; // empty continuation buffer
			
				// set up listener for incoming frames      
				socket.on('data', data => {    			
					// if PING respond with PONG
					let octet = data.charCodeAt(0);
				
					if ((octet & 15) == 0x09) {
						let buffer = unpack(data);
						buffer[0] = (buffer[0] & 0xF0) | 0x0A;
						socket.write(buffer, 'binary');
					} else {
						// test FIN to check for continuation frame
						if ((octet & 128) == 128) {
							// final frame for this message
							let message = thing.message + ws_receive(data);
							thing.message = "";
							//console.log('received: ' + message);
							thing.receive(socket, message);
						} else {
							// save continuation
							thing.message += ws_receive(data);
						}
					}
				});

			}
		} else {
			console.log("request missing /things");
			socket.end();
		}    
	})

	return webhub;
};
