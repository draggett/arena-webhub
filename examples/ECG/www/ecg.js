const webhub = "https://localhost:8888";

var cebs = {
	start: () => {
		wot.platform = new ArenaWebHubWS(); // ArenaWebHubSSE();
		wot.consume("/things/ecg")
			.then(thing => {
				console.log("got thing");
				const td = JSON.stringify(thing.model, null, 2);
				let pre = document.getElementById("model");
				pre.innerText = td;

				let canvas = cebs.canvas = document.getElementById('canvas');
				canvas.setAttribute("width", document.body.clientWidth - 30);
				canvas.setAttribute("height", 400);
				cebs.ctx = canvas.getContext('2d');
				cebs.width = cebs.canvas.width;
				cebs.height = cebs.canvas.height;
				cebs.latency = 300;
				cebs.sample_rate = 100;
				cebs.samples = new Array(Math.floor(cebs.width));
				
				for (var i = 0; i < cebs.samples.length; ++i)
					cebs.samples[i] = [0,0,0,0,0];
					
				cebs.sample = [0,0,0,0,0];

				thing.properties.chan1.subscribe(value => {
					cebs.sample[1] = value;
				});

				thing.properties.chan2.subscribe(value => {
					cebs.sample[2] = value;
				});

				thing.properties.chan3.subscribe(value => {
					cebs.sample[3] = value;
				});

				thing.properties.chan4.subscribe(value => {
					cebs.sample[4] = value;
					cebs.samples.push(cebs.sample); // append new sample
					cebs.sample = cebs.samples.shift();  // free leading sample
					cebs.draw();
				});
			}).catch (err => {
				console.log("couldn't get thing: " + err);
			});
	},
	draw: function () {
		//console.log(this.samples.length - this.width);
		var ctx = this.ctx;
		ctx.fillStyle = "rgb(230,255,230)";
		ctx.fillRect(0, 0, this.width, this.height);
		
		if (this.samples) {
			var ctx = this.ctx;
			ctx.strokeStyle = "black";

			this.channel(ctx, 1, 70, -60);
			this.channel(ctx, 2, 180, -60);
			this.channel(ctx, 3, 250, -10);
			this.channel(ctx, 4, 340, -5);
		}
	},
	channel: function (ctx, index, base, scale) {
		let s, samples = this.samples;
		let width = samples.length;
		ctx.beginPath();
		ctx.moveTo(0, base + scale * samples[0][index]);
		for (let i = 1; i < width; ++i) {
			ctx.lineTo(i, base + scale * samples[i][index]);
		}
		ctx.stroke();
	}
};

window.addEventListener("load", function() {
    cebs.start();
}, false);