# Getting started with the Web of Things

This is an introductory example to help familiarise you with the Web of Things. The starting point is a thing that exposes a couple of properties, an action and an event. The use case is a dimmable light which can be smoothly transitioned from one brightness level to another.

* A numeric property with upper and lower bounds representing the brightness
* A action that slowly changes to a new brightness over a given time duration

The thing description is declared in JSON as follows:

```javascript
{
    "name": "simple_thing",
    "description": "a dimmable light with smooth transitions",
    "properties": {
        "brightness": {
            "type": "number",
            "minimum": 0,
            "maximum": 100,
            "value": 100,
            "description": "brightness in range 0 to 100"
        }
    },
    "actions": {
        "transition": {
            "input": {
                "target": {
                    "type": "number",
                    "minimum": 0,
                    "maximum": 100,
                    "description": "target brightness in range 0 to 100"
                },
                "duration": {
                    "type": "integer",
                    "minimum": 0,
                    "description": "transition time in milliseconds" 
                }
            },
            "description": "smooth transition from current brightness level to target brightness level"
        }
    }
}
```

Note that "value" defines the initial value for a property.  This is optional as the value could be set by the application code, e.g. based upon an initial sensor reading. The "type" declares the data type which can be one of "boolean", "number", "integer", "string", "array" and "object". The "description" is optional, but helps to document the developer's intention.  "minimum" and "maximum" are examples of constraints on the permitted values for numbers and integers.

JSON-LD defines a mapping from JSON to RDF/Linked Data. There is a default context that provides maps the most common identifiers to RDF URIs, but you will need to supply additional contexts if you want to include semantic annotations that describe the kind of thing, in this case a dimmable light.  JSON-LD provides a flexible framework for metadata, for instance, allowing you to state the room the light is in.

For more information see the [W3C Editor's Draft for Thing Descriptions and the [W3C Editor's Draft for the Scripting API](https://w3c.github.io/wot-scripting-api/).

The example application is defined in "[light.js](light.js)", and simulates a dimmable light. This is exposed through a web page which is accessible as http://localhost:8888/light.html.  To install the applications dependencies, you should change to this folder and then run the command:

```
npm install
```

You can then start the application with the command:

```
npm start
```

This relies on the file "[package.json](package.json)" which declares the dependency on the Web Hub and what to execute when started. An alternative is to run the application direction from node, e.g.

```
node light.js
```

Note that this example doesn't deal with user account management and  JSON web tokens. That is covered in a separate example.

## What next?

NodeJS has a thriving community with lots of modules you can take advantage of when developing your applications. This includes modules for IoT technologies like Bluetooth, ZigBee and many more that you can use to interface to IoT devices when you want to expose them in a simple way for client applications for the Web of Things. 