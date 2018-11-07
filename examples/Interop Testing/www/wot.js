/* Web Hub telemetry demo of virtual thing */

// This is a client library with a clean abstraction
// layer above the implementations for different hubs

class Thing {
	constructor (uri, model) {
		// accept relative URLs by resolving against web page URL
		uri = new URL(uri, window.location.href).href;
		this.name = model.name;
		this.model = model;
		this.uri = uri;
		this.pending = {};
		this.properties = {};

		for (var name in model.properties) {
			if (model.properties.hasOwnProperty) {
				this.properties[name] =
					new ThingProperty(this, name, model.properties[name]);
			}
		}
		
		this.actions = {};

		for (var name in model.actions) {
			if (model.actions.hasOwnProperty) {
				this.actions[name] =
					new ThingAction(this, name, model.actions[name]);
			}
		}
		
		this.events = {};

		for (var name in model.events) {
			if (model.events.hasOwnProperty) {
				this.events[name] =
					new ThingEvent(this, name, model.events[name]);
			}
		}
		
		this.platform = wot.discoverPlatform(this);
		let thing = this;
		this.unsubscribe = () => {
			thing.platform.unsubscribe(thing);
		};
		
		// watch for when browser tab becomes visible so
		// that connections can be re-openeded as needed
		if (document && document.hidden !== undefined) {
			document.addEventListener("visibilitychange", () => {
				if (document.visibilityState === 'visible') {
					console.log('wake up sleepy head');
					thing.platform.resubscribe(thing);
				}
			}, false)
		}
	}
}

class ThingProperty {
	constructor(thing, name, meta) {
		// hack to support Things Gateway
		if (meta.hasOwnProperty("readOnly")) {
			meta.writable = ! meta.readOnly;
			delete meta.readOnly;
		}

		this.name = name;
		this.description = meta.description;
		this.type = meta.type;
		this.value = meta.value;
		this.writable = meta.writable;
		this.thing = thing;
		this.observers = [];			
	}
	
	// synchronous as it returns the local value
	read () {
		return this.value;
	}
	
	// called by exposing app to update property value and notify clients
	write(value) {
		// be safe
		if (value === undefined)
			value = null;
			
		this.value = value;
		
		// notify server of change
		return wot.platform.write(this.thing, this.name, value)
	}
	
	// subscribe to property update events
	subscribe(observer) {
		let observers = this.observers;
		let found = false;
		
		for (let i = 0; i < observers.length; ++i) {
			if (observers[i] === observer) {
				found = true;
				break;
			}
		}
		
		if (!found)
			this.observers.push(observer);
			
		this.thing.platform.observeProperty(this.thing, this.name);
	}
	
	unsubscribe(observer) {
		let observers = this.observers;
		for (let i = 0; i < observers.length; ++i) {
			if (observers[i] === observer) {
				observers.splice(i, 1);
				return;
			}
		}
	}
	
	// used internally
	notify(value) {
		let observers = this.observers;
		for (let i = 0; i < observers.length; ++i) {
			observers[i](value);
		}
	}
}

class ThingAction {
	constructor(thing, name, meta) {
		this.name = name;
		this.description = meta.description;
		this.thing = thing;
	}
	
	// invoke action with data, returning a promise
	// optional timeout in milliseconds
	invoke(input, timeout) {
	    if (timeout === undefined)
    		timeout = Number.MAX_SAFE_INTEGER;
    		
    	console.log('invoking ' + this.name + ' with timeout ' + timeout);

		return this.thing.platform.invoke(this.thing, this.name, input, timeout);
	}
}

class ThingEvent {
	constructor(thing, name, meta) {
		this.name = name;
		this.description = meta.description;
		this.type = meta.type;
		this.thing = thing;
		this.observers = [];
	}
	
	// subscribe to this event
	subscribe(observer) {
		let found = false;
		let observers = this.observers;
		for (let i = 0; i < observers.length; ++i) {
			if (observers[i] === observer) {
				found = true;
				console.log('observer already present');
				break;
			}
		}
		
		if (!found)
			observers.push(observer);
			
		this.thing.platform.observeEvent(this.thing, this.name);
	}
	
	// unsubscribe to this event
	unsubscribe(observer) {
		let observers = this.observers;
		for (let i = 0; i < observers.length; ++i) {
			if (observers[i] === observer) {
				observers.splice(i, 1);
				break;
			}
		}
	}
	
	// used internally
	notify(value) {
		let observers = this.observers;
		for (let i = 0; i < observers.length; ++i) {
			observers[i](value);
		}
	}
}

// define the wot object API
let wot = {
	things: {}, // map from name to thing
	
	// use thing description to discover which platform it uses
	// this is a hack and not currently in use
	discoverPlatform:  thing => {
		// the thing description should provide a URI
		// that uniquely identifies the platform
		// use some heuristics if it is missing
		
		let model = thing.model;
		let url = new URL(thing.uri);
		let port = url.port;
		
		let webHub = "https://github.com/draggett/arena-webhub";
		let thingsGateway = "https://iot.mozilla.org/wot/";
		let thingWeb = "https://projects.eclipse.org/projects/iot.thingweb";
		
		if (model.platform) {
			if (model.platform === webHub)
				return new ArenaWebHubWS();
			
			if (model.platform === thingsGateway)
				return new ThingsGateway();
			
			if (model.platform === thingWeb)
				return new ThingWeb();			
		} else {
			// ThingWeb always provides "forms" on
			// each property, action and event
			
			// find a property
			for (let name in model.properties) {
				if (model.properties.hasOwnProperty(name)) {
					let property = model.properties[name];
					
					if (property.forms) 
						return new ThingWeb();
				}
			}
				
			// find an action
			for (let name in model.actions) {
				if (model.actions.hasOwnProperty(name)) {
					let action = model.actions[name];
					
					if (action.forms)
						return new ThingWeb();
				}
			}
				
			// find an event
			for (let name in model.events) {
				if (model.events.hasOwnProperty(name)) {
					let event = model.events[name];
					
					if (event.forms)
						return new ThingWeb();
				}
			}
				
			// Mozilla always provides "links" on the thing
			// and by default uses port 4443
			if (model.links || port == 4443)
				return new ThingsGateway();	
		}
	
		// otherwise assume it's compatible with ThingWeb
		return new ThingWeb();
	},
	
	// asynchronous function to create consumed thing from its URI
	consume: function (uri) {
		let create = function (resolve, reject) {
			// use WebHub driver to retrieve thing description
			wot.platform.getModel(uri).then(model => {
				let thing = new Thing(uri, model);
				wot.things[model.name] = thing;
				resolve(thing);
			})
		};
		
        return new Promise(function (resolve, reject) {
            create(resolve, reject);
        });
	},
	
    invoke: function (name, data) {
    	return wot.platform.invoke(name, data);
    },
    
	poll: function () {
		let list = document.getElementById("plist");
		
		let readArray = [];
		let names = [];
		let properties = wot.td.properties;
		
		for (var name in properties) {
			if (properties.hasOwnProperty(name)) {
				readArray.push(wot.getProperty(name));
				names.push(name);
			}
		}

		Promise.all(readArray).then(resArray => {
			list.innerHTML = null;
			for (var i = 0; i < resArray.length; ++i) {
				let li = document.createElement("li");
				li.innerText = names[i] + ': ' +  resArray[i];
				list.appendChild(li);
			}
		}).catch(error => console.error('Error:', error));
	},
	
/*
	// this is currently unused and may be inherited from the Siemens code
	dispatch_message: function (msg) {
		const type = msg.messageType;
		const data = msg.data;
		
		if (type === "propertyStatus") {
			let list = document.getElementById("plist").getElementsByTagName("li");
			//console.log("data: " + JSON.stringify(data));
			for (var name in data) {
				if (data.hasOwnProperty(name)) {
					//console.log(name + " = " + data[name]);
					
					if (wot.li)
						wot.li[name].innerText = name + ': ' + data[name];
				}
			}
		} else if (type === "event") {
			console.log("event: " + JSON.stringify(data));
			for (var name in data) {
				if (data.hasOwnProperty(name)) {
					console.log("event: " + name + " : " + data[name].data);
				}
			}
		} else {
			console.log("unknown message type: " + type)
		}
	},
*/
    timedFetch: (uri, opts, timeout) => {
        var start = function (resolve, reject) {
        	let timer = setTimeout(() => {
        		reject("fetch timeout on " + uri);
        	}, timeout);
        	console.log('timedFetch with uri = ' + uri + 
        		' and opts = ' + JSON.stringify(opts));
        	fetch(uri, opts).then(response => {
        		if (!response.ok)
        			reject('fetch failed with ' + response.status + ' ' + response.statusText);
        			
        		console.log('timedFetch got response ');
        		clearTimeout(timer);
        		resolve(response);
        	}).catch(err => {
        		console.log('timedFetch failed, ' + err);
        		clearTimeout(timer);
        		reject(err);
        	});
        };
        
        return new Promise(function (resolve, reject) {
            start(resolve, reject);
        });
    }
};

/*
	The platform class exposes methods that abstract the variation
	in how the underlying protocols are used by each platform

		getModel(uri) return promise with client thing

		write(thing, propertyPath, value) returns promise with value
	
		read(thing, propertyPath) returns promise with value
	
		writeState(thing) returns promise which resolves when done
	
		readState(thing) returns promise which resolves when done
	
		invoke(thing, actionName, data) returns promise with response
	
		observeEvent(thing, eventName, handler)
	
		observeProperty(thing, propertyPath, handler)
	
		unObserveEvent(thing, eventName, handler)
	
		unObserveProperty(thing, propertyPath, handler)
	
	getModel initialises polling for property updates, and for event
	streams directed to the thing. These are then delivered to the 
	property and event class instances, as well as to the thing's
	event handler.
*/

class ArenaWebHub {
	constructor () {
		this.jwt = "somerandomstuff"; //localStorage.getItem('jwt'),
	}
	
	login (email, password) {
    	const opts = {
      		method: 'POST',
      		headers: {
        		'Content-Type': 'application/json',
        		Accept: 'application/json',
      		},
      		body: JSON.stringify({
      			'action': 'login',
        		'email': email,
        		'password': password
      		}),
    	};
    	return fetch('/account', opts).then((res) => {
      		if (!res.ok) {
        		throw new Error('Incorrect username or password');
      		}
      		return res.json();
    	}).then((body) => {
      		const jwt = body.jwt;
     		localStorage.setItem('jwt', jwt);
      		this.jwt = jwt;
      		//wot.webhub.logged_in();
		});
	}

	logout () {
    	localStorage.removeItem('jwt');
    	return fetch('/acount', {
      		method: 'POST',
      		headers: {
				'Authorization': `Bearer ${this.jwt}`,
				'Content-Type': 'application/json',
				'Accept': 'application/json',
      		},
      		body: JSON.stringify({
      			'action': 'logout'
      		}),
    	}).then((res) => {
      		if (res.ok) {
      			wot.webhub.jwt = null;
      		} else {
        		console.error('Logout failed...');
      		}
    	});
	}
	
	getModel (uri) {
		let server = this;
		var getTD = function (resolve, reject) {
			console.log('getting model for ' + uri);
        	const opts = {
				method: "GET",
				headers: {
					'Authorization': `Bearer ${server.jwt}`,
					'Accept': 'application/json'
				}
			};
			
        	fetch(uri, opts).then(response => {
        		if (response.ok) {
        			resolve(response.json());
        		}
        		else
        			throw(new Error("response status = " + response.status));
        	}).catch(err => {
        		console.log("couldn't get thing description at " + uri);
        		reject(err);
        	});
        };
        
        return new Promise(function (resolve, reject) {
            getTD(resolve, reject);
        });		
	}

	waitForLongPolledEvent (thing, name, timeout) {
		let server = this;
		let expect = function (resolve, reject) {
			var poll = function () {
				const opts = {
					method: "GET",
					headers: {
						'Authorization': `Bearer ${server.jwt}`,
						'Accept': 'application/json'
					}
				};
			
				console.log("initiating longpoll on " + name);
				let uri = thing.uri + '/events/'+ name;
		
				wot.timedFetch(uri, opts, timeout)
					.then(res => res.json())
					.then(data => {
						console.log("got event " + name + " with data " + JSON.stringify(data));
						resolve(data);
					
						//setTimeout(poll, 0); // to wait for next event
					}).catch(err => {
						console.log(err + " - couldn't get event from " + uri);
						reject(err);
					});
			};
		
			poll();  //setTimeout(poll, 0);  // kick off polling
		};
	
		return new Promise(function (resolve, reject) {
			expect(resolve, reject);
		});
	}
}

// driver for Arena Web Hub using Server-Sent Events

class ArenaWebHubSSE extends ArenaWebHub {
	// write value to named property, returning a promise
	write (thing, name, value) {
		let server = this;
        let setValue = function (resolve, reject) {
        	const uri = thing.uri + "/properties/" + name;
        	
        	const opts = {
				method: "PUT",
				headers: {
					'Authorization': `Bearer ${server.jwt}`,
					'Accept': 'application/json',
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(value)
			};
			
        	fetch(uri, opts).then(response => {
        		if (response.ok) {
        			console.log("resolve: set property " + name + " to " + value);
        			resolve(true);
        		}
        		else {
        			console.log("reject: couldn't set property " + name + " to " + value);
        			reject("reject: couldn't set property " + name + " to " + value);
        		}
        	}).catch(err => {
        		//log("catch: couldn't set property " + name + " to " + value);
        		reject(err);
        	});
        };
        
        return new Promise(function (resolve, reject) {
            setValue(resolve, reject);
        });
    }
	
	// read named property, returning a promise for the value
	read (thing, name) {
		let server = this;
        let getValue = function (resolve, reject) {
        	const uri = thing.uri + "/properties/" + name;
        	
        	const opts = {
				method: "GET",
				headers: {
					'Authorization': `Bearer ${server.jwt}`,
					'Accept': 'application/json'
				}
			};
			
        	fetch(uri, opts).then(response => {
        		if (response.ok) {
        			//console.log("got value ");
        			resolve(response.json());
        		} else
        			throw(new Error("property is unknown or unreadable"));
        	}).catch(err => {
        		console.log("couldn't get property " + name);
        		reject(err);
        	});
        };
        
        return new Promise(function (resolve, reject) {
            getValue(resolve, reject);
        });
    }
    
    // invoke action with data, returns promise for response data
    // optional timeout in milliseconds
    invoke (thing, name, data, timeout) {
    	let server = this;
    	if (data === undefined)
    		data = null;
    		
    	var act = function (resolve, reject) {
    		console.log('timeout is ' + timeout);
    		const uri = thing.uri + "/actions/" + name;
    		let timer = setTimeout(function () {
    			reject('timeout on action ' + name);
    		}, timeout);
        	const opts = {
				method: "POST",
				headers: {
					'Authorization': `Bearer ${server.jwt}`,
					'Accept': 'application/json',
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(data)
			};
			
         	fetch(uri, opts).then(response => {
         		console.log('got response');
         		clearTimeout(timer);
        		if (response.ok) {
        			if (response.status == 204)
        				resolve();
        			else
        				resolve(response.json());
        		} else
        			throw(new Error("action is unknown or failed"));
        	}).catch(err => {
        		console.log("couldn't invoke action " + name);
        		clearTimeout(timer);
        		reject(err);
        	});
   		};
    	
        return new Promise(function (resolve, reject) {
            act(resolve, reject);
        }); 	
    }
    
    observeEvent (thing, name) {
    	let event = thing.events[name];
    	
    	if (!thing.eventSource)
    		thing.platform.subscribe(thing);
    }
    
    observeProperty (thing, name) {
    	let property = thing.properties[name];
    	
    	if (!thing.eventSource)
    		thing.platform.subscribe(thing);
    }
    
    // internal methods
    
    subscribe (thing) {
    	// open the server-sent event stream
		thing.eventSource = new EventSource(thing.uri+ "/events?jwt=" + this.jwt);

		thing.eventSource.onopen = function() {
			console.log("EventSource opened connection to " + thing.uri + "/events")
		};

		thing.eventSource.onerror = function() {
			console.log("EventSource error on connection to " + thing.uri + "/events");
			thing.eventSource = null;
		};

		thing.eventSource.onmessage = function(e) {
			//console.log("received SSE message: " + e.data);
			let data = JSON.parse(e.data);
			
			// different kinds of notifications
			if (data.event) {
				let event = thing.events[data.event];
				event.notify(data.data);
			} else if (data.property) {
				let property = thing.properties[data.property];
				property.notify(data.data);
				//console.log('setting ' + property.name + ' to ' + data.data);
				property.value = data.data;
			} else if (data.state) {
				let state = data.state;
				for (let name in state) {
					if (state.hasOwnProperty(name)) {
						let property = thing.properties[name];
						property.notify(state[name]);
						property.value = state[name];
					}
				}
			} else {
				console.log("unknown message")
			}
		};
    }
    
    // when browser tab becomes visible
    // check if the connection needs reopening
    resubscribe (thing) {
    	if (!thing.eventSource) {
    		console.log('reopening event source for ' + thing.name);
    		thing.platform.subscribe(thing);
    	}
    }
    
    unsubscribe (thing) {
    	if (thing.eventSource) {
    		thing.eventSource.close();
    		thing.eventSource = null;
    	}
    }
}

// driver Arena Web Hub using Web Sockets

class ArenaWebHubWS extends ArenaWebHub {

	// write value to named property, returning a promise
	write (thing, name, value) {
		let server = this;
        let setValue = function (resolve, reject) {
        	let json = {
        		property: name,
        		data: value
        	};

			let id = server.send(thing, json);
			thing.pending[id] = {
				'resolve': resolve,
				'reject': reject
			};
        };
        
        return new Promise(function (resolve, reject) {
            setValue(resolve, reject);
        });
    }
    
	// read named property, returning a promise for the value
	read (thing, name) {
    }

	// request state for all properties
    readState (thing) {
    }
	
	// write state for multiple properties
    writeState (thing, state) {
    }
	    
    // invoke action with data, returns promise for response data
    // optional timeout in milliseconds
    invoke (thing, name, data, timeout) {
    	let server = this;
    	if (data === undefined)
    		data = null;
    		
    	var act = function (resolve, reject) {
    		let json = {
    			action: name,
    			input: data
    		};
    		
			let id = server.send(thing, json);
			thing.pending[id] = {
				'resolve': resolve,
				'reject': reject
			};
   		};
    	
        return new Promise(function (resolve, reject) {
            act(resolve, reject);
        }); 	
    }
    
    observeEvent (thing, name) {
    	if (!thing.ws)
    		thing.platform.subscribe(thing);
    }
    
    observeProperty (thing, name) {
    	if (!thing.ws)
    		thing.platform.subscribe(thing);
    }
    
    unObserveEvent (thing, name) {
    }
    
    unObserveProperty (thing, name) {
    }
    
    // internal methods
   
    send (thing, json) {
    	json.id = 'r' + thing.requestId++;
    	let message = JSON.stringify(json);
    	thing.ws.send(message);
    	return json.id;
    }
    
    receive (thing, json) {
    	//console.log("ArenaWebHubWS.receive: " + JSON.stringify(json));
    	if (json.event) {
    		// event notification
    		if (thing.events.hasOwnProperty(json.event)) {
    			let event = thing.events[json.event];
    			event.notify(json.data);
    		}
    	} else if (json.property) {
    		// single property update 
    		if (thing.properties.hasOwnProperty(json.property)) {
    			let property = thing.properties[json.property];
    			property.notify(json.data);
    			property.value = json.data;
    		}
    	} else if (json.state) {
    		// multiple property update
    		let state = json.state;
    		let properties =thing.properties;
    		
    		for (let name in state) {
    			if (state.hasOwnProperty(name)) {
    				let property = properties[name];
    				property.notify(state[name]);
    				property.value = state[name];
    			}
    		}
    		console.log("initialised thing's state");
    	} else if (json.id) {
    		// response to previous request
    		//console.log('response to request ' + json.id + ' with status ' + json.status);
    		let request = thing.pending[json.id]; // {resolve:res, reject:rej}
    		
    		if (json.status == 200) {
    			request.resolve(json.output);
    		} else {
    			request.reject('failed: ' + json.status + ' ' + json.description);
    		}
    		delete thing.pending[json.id];
    	} else {
    		console.log('unrecognised message: ' + JSON.stringify(json));
    	}
    }
    
    subscribe (thing) {
    	// open the WebSockets event stream
    	//console.log('subscribe to ' + thing.name)
    	console.log('opening event stream for ' + thing.uri);
		const wsUri = thing.uri.replace(/^http/, 'ws');
    	thing.ws = new WebSocket(`${wsUri}?jwt=${this.jwt}`);
    	thing.requestId = 1;
    	let platform = this;
    	
    	console.log("websocket connection opening ...");

        thing.ws.onopen = () => {
            console.log("websocket connection opened");
        };

        thing.ws.onclose = () => {
            console.log("websocket connection closed");
            thing.ws = null;
        };

        thing.ws.onerror = () => {
            console.log("websocket connection error");
            this.ws.close();
            thing.ws = null;
        };

        thing.ws.onmessage = message => {
            //console.log("received message: " + message.data);
            try {
                let json = JSON.parse(message.data);
                console.log('parsed message as JSON')
                platform.receive(thing, json);
            } catch (e) {
                console.log("can't process " + message.data);
            }
        };
    }
    
    // when browser tab becomes visible
    // check if the connection needs reopening
    resubscribe (thing) {
    	if (!thing.ws) {
    		console.log('reopening web socket for ' + thing.name);
    		thing.platform.subscribe(thing);
    	}
    }
    
    unsubscribe (thing) {
    	//console.log('unsubscribe from ' + thing.name);
    	if (thing.ws) {
    		thing.ws.close();
    		thing.ws = null;
    	}
    }
}

// Driver for Mozilla Things Gateway, see https://iot.mozilla.org/wot/
//
// This uses HTTP for reading and writing properties, and invoking actions.
// WebSockets is used for listening for events and property updates.
// The code could be updated to also use WebSockets for invoking actions
// and when the client wants to update a property. Further work is also
// needed to share a WebSocket connection rather than as now opening one 
// connection for each observeEvent or observeProperty. Additional work
// is needed to support the browser visibilityChange event to re-open
// sockets when a browser tab becomes visible after being hidden.
//
// Note that Things Gateway Web typically uses port 4443 and adds a
// "links" meta property to thing description

class ThingsGateway {
	constructor () {
		//this.jwt = localStorage.getItem('jwt');
		this.login('dsr@w3.org', '78HelloGreen');
	}
	
	login (email, password) {
    	const opts = {
      		method: 'POST',
      		headers: {
        		'Content-Type': 'application/json',
        		Accept: 'application/json',
      		},
      		body: JSON.stringify({
        		email, password,
      		}),
    	};
    	return fetch('/login', opts).then((res) => {
      		if (!res.ok) {
        		throw new Error('Incorrect username or password');
      		}
      		return res.json();
    	}).then((body) => {
      		const jwt = body.jwt;
     		localStorage.setItem('jwt', jwt);
      		wot.thingsgateway.jwt = jwt;
      		//wot.thingsgateway.logged_in();
		});
	}

	logout () {
    	localStorage.removeItem('jwt');
    	return fetch('/log-out', {
      		method: 'POST',
      		headers: {
				'Authorization': `Bearer ${wot.thingsgateway.jwt}`,
				'Content-Type': 'application/json',
				'Accept': 'application/json',
      		}
    	}).then((res) => {
      		if (res.ok) {
      			wot.thingsgateway.jwt = null;
      		} else {
        		console.error('Logout failed...');
      		}
    	});
	}

	getModel (uri) {
		var getTD = function (resolve, reject) {
        	const opts = {
				method: "GET",
				headers: {
					'Accept': 'application/json',
					'Authorization': `Bearer ${this.jwt}`
				}
			};
			
        	fetch(uri, opts).then(response => {
        		if (response.ok)
        			resolve(response.json());
        		else
        			throw(new Error("can't get thing description"));
        	}).catch(err => {
        		console.log("couldn't get thing description at " + uri);
        		reject(err);
        	});
        };
        
        return new Promise(function (resolve, reject) {
            getTD(resolve, reject);
        });		
	}
	
	// write value to named property, returning a promise
	
	write (thing, name, value) {
        var setValue = function (resolve, reject) {
        	const uri = thing.uri + "/properties/" + name;
        	console.log('uri: ' + uri);
        	
        	const opts = {
				method: "PUT",
				headers: {
					'Accept': 'application/json',
					'Authorization': `Bearer ${this.jwt}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(value)
			};
			
        	fetch(uri, opts).then(response => {
        		if (response.ok)
        			resolve(true);
        		else
        			throw(new Error("property is unknown or unwritable"));
        	}).catch(err => {
        		console.log("couldn't set property " + name + " to " + value);
        		reject(err);
        	});
        };
        
        return new Promise(function (resolve, reject) {
            setValue(resolve, reject);
        });
    }
	
	// read named property, returning a promise for the value
	
	read (thing, name) {
        var getValue = function (resolve, reject) {
        	const uri = thing.uri + "/properties/" + name;
        	
        	const opts = {
				method: "GET",
				headers: {
					'Accept': 'application/json',
					'Authorization': `Bearer ${this.jwt}`
				}
			};
			
        	fetch(uri, opts).then(response => {
        		if (response.ok) {
        			//console.log("got value ");
        			resolve(response.json());
        		} else
        			throw(new Error("property is unknown or unreadable"));
        	}).catch(err => {
        		console.log("couldn't get property " + name);
        		reject(err);
        	});
        };
        
        return new Promise(function (resolve, reject) {
            getValue(resolve, reject);
        });
    }
    
    // invoke action with data, returns promise for response data
    // optional timeout in milliseconds
    invoke (thing, name, data, timeout) {
    	if (data === undefined)
    		data = null;
    		
    	var act = function (resolve, reject) {
    		const uri = thing.uri + "/actions/" + name;
        	const opts = {
				method: "POST",
				headers: {
					'Accept': 'application/json',
					'Authorization': `Bearer ${this.jwt}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(data)
			};
			
         	fetch(uri, opts).then(response => {
        		if (response.ok) {
        			if (response.status == 204)
        				resolve(null); // no content
        			else
        				resolve(response.json());
        		} else
        			throw(new Error("action is unknown or failed"));
        	}).catch(err => {
        		console.log("couldn't invoke action " + name);
        		reject(err);
        	});
   		};
    	
        return new Promise(function (resolve, reject) {
            act(resolve, reject);
        }); 	
    }
    
    observeEvent (thing, name, handler) {
    	let event = thing.events[name];
    	event.observer = handler;
    	
    	if (this.ws) {
    		let evt = {};
    		evt[name] = name;
    		let message = {
				"messageType": "addEventSubscription",
  				"data": evt
			};
			
            this.ws.send(JSON.stringify(message));
    		
    	} else
    		this.subscribe(thing, name);
    		
    }
    
    observeProperty (thing, name, handler) {
    	let property = thing.properties[name];
    	property.observer = handler;
    	
    	if (!this.ws)
    		this.subscribe(thing);
    }
    
    unObserveEvent (thing, name) {
    }
    
    unObserveProperty (thing, name) {
    }
    
   subscribe (thing, name) {
    	// open the WebSockets event stream
		const wsUri = thing.uri.replace(/^http/, 'ws');
    	this.ws = new WebSocket(`${wsUri}?jwt=${this.jwt}`);
    	
    	console.log("websocket connection opening ...");

        this.ws.onopen = function() {
            console.log("websocket connection opened");
            
            if (name) {
				let evt = {};
				evt[name] = name;
				let message = {
					"messageType": "addEventSubscription",
					"data": evt
				};
			
				this.ws.send(JSON.stringify(message));
            }
        };

        this.ws.onclose = function() {
            console.log("websocket connection closed");
        };

        this.ws.onerror = function() {
            console.log("websocket connection error");
        };

        this.ws.onmessage = function(message) {
            //console.log("received message: " + message.data);
            try {
                var msg = JSON.parse(message.data);

				try {
					let messageType = msg.messageType;
					let data = msg.data;
					
					if (messageType === "propertyStatus") {
						for (let name in data) {
							if (data.hasOwnProperty(name)) {
								//console.log(name + " = " + data[name]);
								let property = thing.properties[name];
								property.notify(data[name]);
							}
						}
					} else if (messageType === "event") {
						//console.log("event: " + JSON.stringify(data));
						for (let name in data) {
							if (data.hasOwnProperty(name)) {
								//console.log("event: " + name + " : " + data[name].data);
							}
						}
					}
				} catch (e) {
				    console.log("dispatch error " + e.message + " in " + msg);
				}
            } catch (e) {
                console.log("JSON syntax error in " + msg);
            }
        };
    }
    
    // when browser tab becomes visible
    // check if the connection needs reopening
    resubscribe (thing) {
    	console.log('reopening web socket for ' + thing.name);
    }
    
    unsubscribe () {
    	console.log('thing.unsubscribe() is not implemented');
    }
}

// Driver for Siemens's Eclipse ThingWeb platform, see
//       https://projects.eclipse.org/projects/iot.thingweb
//
// This uses HTTP for reading and writing properties, and invoking actions.
// You have a choice between long polling or Web Sockets for listening
// for events. A separate socket is needed for each event. This code
// uses polling to determine when properties have changed their values.
// A more recent version of ThingWeb allows you to use a Web Socket
// for that which would be much more efficient. Further work is also
// needed to support the browser visibilityChange event to re-open
// the sockets when a browser tab becomes visible after being hidden.
//
// Note that ThingWeb typically uses port 8080 and adds a "form" meta
// property to each property, action and event in the thing description

class ThingWeb {
	constructor () {
	}
	
	getModel (uri) {
		console.log('get thing description for ' + uri);
		var getTD = function (resolve, reject) {
        	const opts = {
				method: "GET",
				headers: {
					'Accept': 'application/json'
				}
			};
			
        	fetch(uri, opts).then(response => {
        		if (response.ok)
        			resolve(response.json());
        		else
        			throw(new Error("can't get thing description"));
        	}).catch(err => {
        		console.log("couldn't get thing description at " + uri);
        		reject(err);
        	});
        };
        
        return new Promise(function (resolve, reject) {
            getTD(resolve, reject);
        });		
	}
	
	// write value to named property, returning a promise
	write (thing, name, value) {
        var setValue = function (resolve, reject) {
        	const uri = thing.uri + "/properties/" + name;
        	console.log('uri: ' + uri);
        	
        	const opts = {
				method: "PUT",
				headers: {
					'Accept': 'application/json',
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(value)
			};
			
        	fetch(uri, opts).then(response => {
        		if (response.ok)
        			resolve(true);
        		else
        			throw(new Error("property is unknown or unwritable"));
        	}).catch(err => {
        		console.log("couldn't set property " + name + " to " + value);
        		reject(err);
        	});
        };
        
        return new Promise(function (resolve, reject) {
            setValue(resolve, reject);
        });
    }
	
	// read named property, returning a promise for the value
	read (thing, name) {
        var getValue = function (resolve, reject) {
        	const uri = thing.uri + "/properties/" + name;
        	
        	const opts = {
				method: "GET",
				headers: {
					'Accept': 'application/json'
				}
			};
			
        	fetch(uri, opts).then(response => {
        		if (response.ok) {
        			//console.log("got value ");
        			resolve(response.json());
        		} else
        			throw(new Error("property is unknown or unreadable"));
        	}).catch(err => {
        		console.log("couldn't get property " + name);
        		reject(err);
        	});
        };
        
        return new Promise(function (resolve, reject) {
            getValue(resolve, reject);
        });
    }
    
    // invoke action with data, returns promise for response data
    // optional timeout in milliseconds
    invoke (thing, name, data, timeout) {
    	if (data === undefined)
    		data = null;
    		
    	var act = function (resolve, reject) {
    		const uri = thing.uri + "/actions/" + name;
        	const opts = {
				method: "POST",
				headers: {
					'Accept': 'application/json',
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(data)
			};
			
         	fetch(uri, opts).then(response => {
        		if (response.ok) {
        			if (response.status == 204)
        				resolve(null); // no content
        			else
        				resolve(response.json());
        		} else
        			throw(new Error("action is unknown or failed"));
        	}).catch(err => {
        		console.log("couldn't invoke action " + name);
        		reject(err);
        	});
   		};
    	
        return new Promise(function (resolve, reject) {
            act(resolve, reject);
        }); 	
    }
    
    // ThingWeb now supports event notifications on web sockets
    observeEvent (thing, name) {
    	console.log('observe event ' + name + ' on ' + thing.name);
    	this.observe(thing, name, false);
    }
    
    observeProperty (thing, name) {    	
    	// ThingWeb currently doesn't support update notifications on web sockets
    	// this.observe(thing, name, true);  // doesn't work for now
    	
    	// work around is to poll and look for changes
    	// doesn't work if event doesn't change the value
    	
    	let latency = 500; // milliseconds
    	let uri = thing.uri + '/properties/' + name;
    	let property = thing.properties[name];
    	
    	setInterval(function () {
        	const opts = {
				method: "GET",
				headers: {
					'Accept': 'application/json'
				}
			};
    	
    		fetch(uri)
    			.then(res => res.json())
    			.then(data => {
    				if (data !== property.value) {
						property.notify(data);
						property.value = data;
    				}
    			}).catch(err => {
        			console.log("couldn't get value from " + uri);
        		});    		
    	}, latency);  
    }
    
    unObserveEvent (thing, name) {
    }
    
    unObserveProperty (thing, name) {
    }
    
    waitForLongPolledEvent(thing, name, timeout) {
    	var wait = function (resolve, reject) {
    		reject('not implemented by test agent for this platform');
    	};
    	
        return new Promise(function (resolve, reject) {
            wait(resolve, reject);
        }); 	
    }
    
    observeLongPoll (thing, name) {
    	const uri = thing.uri + '/events/' + name;
    	
    	var poll = function () {
        	const opts = {
				method: "GET",
				headers: {
					'Accept': 'application/json'
				}
			};
    	
    		fetch(uri)
    			.then(res => res.json())
    			.then(data => {
    				event.notify(data);
    				setTimeout(poll, 0); // to wait for next event
    			}).catch(err => {
        			console.log("couldn't get event from " + uri);
        		});
    	};
    	
    	setTimeout(poll, 0);  // kick off polling
    }
    
    // observe property /properties/foo or even /events/bar
	observe (thing, name, isProperty) {
		const path = (isProperty ? '/properties' : '/events/') + name;
		const wsUri = (thing.uri + path).replace(/^http/, 'ws');
    	this.ws = new WebSocket(wsUri);
    	
        console.log("trying to open websocket on " + wsUri);

        this.ws.onopen = function() {
            console.log("websocket connection opened for " + path);
        };

        this.ws.onclose = function() {
            console.log("websocket connection closed for " + path);
        };

        this.ws.onerror = function() {
            console.log("websocket connection error for " + path);
        };

        this.ws.onmessage = function(message) {
            //console.log("received message: " + message.data);
            try {
                let data = JSON.parse(message.data);

				try {
					if (isProperty) {
						let property = thing.properties[name];
						property.notify(data);
						property.value = data;
					} else {
						let event = thing.events[name];
						event.notify(data);
					}
				} catch (e) {
				    console.log("handler error " + e.message + " in " + message);
				}
            } catch (e) {
                console.log("JSON syntax error in " + message);
            }
        };
    }
    
    // when browser tab becomes visible
    // check if the connection needs reopening
    resubscribe (thing) {
    	console.log('reopening web sockets for ' + thing.name);
    }
    
    unsubscribe () {
    	console.log('thing.unsubscribe() is not implemented');
    }
};
