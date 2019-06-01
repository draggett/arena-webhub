var demo = {
	start: function () {
	    this.drip = document.getElementById('drip');
		this.canvas = document.getElementById('canvas');
		this.ctx = canvas.getContext('2d');
		this.width = this.canvas.width;
		this.height = this.canvas.height;

		var bell = function (bell) {
			bell.style.visibility = "visible";
			setTimeout(function() {
				bell.style.visibility = "hidden";
			}, 1000);
		};

        // note use of relative URI for thing description
        // this works nicely thanks to same origin policy
		wot.consume("/wot/water").then(thing => {
		    console.log("successfully registered consumer for " + thing.name);
			var pre = document.getElementById("td");
			td.innerText = JSON.stringify(thing["@model"], undefined, 4);

			// now couple the form fields to the thing and set an observer
			// for updates to the properties and for two app specific events

			controls.inlet.onchange = function () {
				thing.inlet = controls.inlet.checked;
				this.blur(); // to ensure it gets updated by thing
			};

			controls.outlet.onchange = function () {
				thing.outlet = controls.outlet.checked;
				this.blur(); // to ensure it gets updated by thing
			};

			controls.upper.onchange = function () {
				thing.upper = parseFloat(controls.upper.value);
			};

			controls.lower.onchange = function () {
				thing.lower = parseFloat(controls.lower.value);
			};

			thing["@observe"]("high", function () {
				bell(document.getElementById("high"));
			});

			thing["@observe"]("low", function () {
				bell(document.getElementById("low"));
			});

			thing["@observe"]("@properties", function () {
				update_checkbox(controls.inlet, thing.inlet);
				update_checkbox(controls.outlet, thing.outlet);
				update_field(controls.upper, thing.upper);
				update_field(controls.lower, thing.lower);
				update_field(controls.level, thing.level);
				demo.draw(thing);
			});

			// avoid updating form controls whilst they have the focus

			var update_checkbox = function (element, value) {
				if (element != document.activeElement)
					element.checked = value;
			}

			var update_field = function (element, value) {
				if (element != document.activeElement)
					element.value = value;
			}

            demo.draw(thing);
			console.log("initialised /wot/water");
		}).catch(error => {
		    console.log("unable to register proxy: " + error);
		});
	},

	draw: function (thing) {
	    var level2canvas = function (level) {
		    //return 100 + 283 * (1.0 - level);
		    return 100 + 283 * (1.0 - level);
	    };

		var ctx = this.ctx;
		var y = level2canvas(thing.level);

		this.drip.style.visibility = thing.outlet ? "visible" : "hidden";

		ctx.fillStyle = "rgb(255,255,247)"; //"rgb(255,255,230)";
		ctx.fillRect(0, 0, this.width, this.height);
		ctx.fillStyle = "rgb(160,192,224)";
		ctx.fillRect(10, y, 280, 380-y);

		ctx.fillRect(142, 10, 20, 60);

		if (thing.inlet)
			ctx.fillRect(142, 80, 16, 297);

		if (thing.level > 0)
			ctx.fillRect(142, 380, 16, 20);

		ctx.strokeStyle = "black";
		ctx.lineWidth = 6;

		ctx.beginPath();
		ctx.moveTo(142, 10);
		ctx.lineTo(142, 100);
		ctx.lineTo(10, 100);
		ctx.lineTo(10, 383);
		ctx.stroke();

		ctx.beginPath();
		ctx.moveTo(158, 10);
		ctx.lineTo(158, 100);
		ctx.lineTo(290, 100);
		ctx.lineTo(290, 383);
		ctx.stroke();

		ctx.beginPath();
		ctx.moveTo(142, 470);
		ctx.lineTo(142, 380);
		ctx.lineTo(10, 380);
		ctx.stroke();

		ctx.beginPath();
		ctx.moveTo(158, 470);
		ctx.lineTo(158, 380);
		ctx.lineTo(290, 380);
		ctx.stroke();

		var cx = 150;
		var cy = 60;
		var r = 20;

		ctx.fillStyle = "white";

		ctx.beginPath();
		ctx.arc(cx, cy, r, 0, 2 * Math.PI, false);
		ctx.fill();
		ctx.stroke();

		ctx.beginPath();
		ctx.arc(cx, cy, r, 0, 2 * Math.PI, false);
		ctx.fill();

		if (thing.inlet) {
			ctx.moveTo(cx, cy-r);
			ctx.lineTo(cx, cy+r);
		} else {
			ctx.moveTo(cx-r, cy);
			ctx.lineTo(cx+r, cy);
		}
		ctx.stroke();

		cy = 420;

		ctx.beginPath();
		ctx.arc(cx, cy, r, 0, 2 * Math.PI, false);
		ctx.fill();

		if (thing.outlet) {
			ctx.moveTo(cx, cy-r);
			ctx.lineTo(cx, cy+r);
		} else {
			ctx.moveTo(cx-r, cy);
			ctx.lineTo(cx+r, cy);
		}

		ctx.stroke();

		cy = level2canvas(thing.upper);
		ctx.strokeStyle = "green";
		ctx.beginPath();
		ctx.moveTo(10, cy);
		ctx.lineTo(290, cy);
		ctx.stroke();

		cy = level2canvas(thing.lower);
		ctx.strokeStyle = "red";
		ctx.beginPath();
		ctx.moveTo(10, cy);
		ctx.lineTo(290, cy);
		ctx.stroke();
	}
};

window.addEventListener("load", function() {
    demo.start();
}, false);
