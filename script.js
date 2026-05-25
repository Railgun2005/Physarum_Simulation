'use strict';

const settings = {
	sensor_distance:  2,
	sensor_angle:     40 / 180 * Math.PI,
	turning_speed:    40 / 180 * Math.PI,
	speed:            1,
	decay_factor:     0.95,
	deposit_amount:   0.6,
	num_agents:       5000,
	start_in_circle:  false,
	highlight_agents: false,
	random_turning:   false,
	wrap_around:      true,
	show_debug:       false,
};

const settings_to_text = {
	sensor_angle: rad_to_deg,
	turning_speed: rad_to_deg,
	num_agents: v => '' + v,
};

const weight = [
	1/16, 1/8, 1/16,
	1/8,  1/4, 1/8,
	1/16, 1/8, 1/16,
];

let counts = [0,0,0,0];
let regenerate_next = true;

const default_settings = {...settings};

function rad_to_deg(value) {
	return Math.round(value * 180 / Math.PI);
}

function update_settings_text() {

	for (let name in settings) {

		let node = document.getElementById('text_' + name);

		if (!node) continue;

		let converter = settings_to_text[name];
		let value = settings[name];

		let text = converter ? converter(value) : value;

		if (typeof text === 'number') {
			text = text.toFixed(2);
		}

		node.innerText = text;
	}
}

function settings_to_dom() {

	for (let name in settings) {

		let node = document.getElementById(name);

		if (!node) continue;

		if (typeof settings[name] === 'number') {
			node.value = settings[name];
		} else {
			node.checked = settings[name];
		}
	}

	update_settings_text();
}

function settings_from_dom() {

	for (let name in settings) {

		let node = document.getElementById(name);

		if (!node) continue;

		if (typeof settings[name] === 'number') {
			settings[name] = parseFloat(node.value);
		} else {
			settings[name] = node.checked;
		}
	}

	update_settings_text();
}

function reset_settings() {

	for (let name in settings) {
		settings[name] = default_settings[name];
	}

	settings_to_dom();
}

function update_reset_button_enabled() {

	let any_non_default = false;

	for (let name in settings) {

		if (settings[name] !== default_settings[name]) {
			any_non_default = true;
			break;
		}
	}

	document.getElementById('reset_button').disabled =
		!any_non_default;
}

function sim_step(agents, trail, width, height) {

	function index(x, y) {
		return x + y * width;
	}

	for (let agent of agents) {

		function sense(theta) {

			const sx = Math.round(
				agent.x + Math.cos(agent.heading + theta) * settings.sensor_distance
			);

			const sy = Math.round(
				agent.y + Math.sin(agent.heading + theta) * settings.sensor_distance
			);

			if (
				sx < 0 || sy < 0 ||
				sx >= width || sy >= height
			) {
				return 0;
			}

			return trail[index(sx, sy)];
		}

		const left   = sense(settings.sensor_angle);
		const middle = sense(0);
		const right  = sense(-settings.sensor_angle);

		const turn =
			(settings.random_turning
				? (Math.random() * 0.5 + 0.5)
				: 1) * settings.turning_speed;

		if (middle > left && middle > right) {

		} else if (left > right) {

			agent.heading += turn;

		} else if (right > left) {

			agent.heading -= turn;

		} else {

			agent.heading +=
				(Math.round(Math.random() * 2 - 1))
				* settings.turning_speed;
		}
	}

	for (let agent of agents) {

		agent.x += settings.speed * Math.cos(agent.heading);
		agent.y += settings.speed * Math.sin(agent.heading);

		if (settings.wrap_around) {

			agent.x = (agent.x + width) % width;
			agent.y = (agent.y + height) % height;

		} else {

			agent.x = Math.min(Math.max(agent.x, 0), width - 1);
			agent.y = Math.min(Math.max(agent.y, 0), height - 1);
		}

		const x = Math.round(agent.x);
		const y = Math.round(agent.y);

		if (
			x > 0 && y > 0 &&
			x < width - 1 &&
			y < height - 1
		) {

			trail[index(x, y)] += settings.deposit_amount;
		}
	}

	const old = Float32Array.from(trail);

	for (let y = 1; y < height - 1; y++) {

		for (let x = 1; x < width - 1; x++) {

			const value = (

				old[index(x-1,y-1)] * weight[0] +
				old[index(x,y-1)]   * weight[1] +
				old[index(x+1,y-1)] * weight[2] +

				old[index(x-1,y)]   * weight[3] +
				old[index(x,y)]     * weight[4] +
				old[index(x+1,y)]   * weight[5] +

				old[index(x-1,y+1)] * weight[6] +
				old[index(x,y+1)]   * weight[7] +
				old[index(x+1,y+1)] * weight[8]

			);

			trail[index(x, y)] =
				Math.min(1, value * settings.decay_factor);
		}
	}

	return trail;
}

function render(trail, canvas, agents) {

	const width = canvas.width;
	const height = canvas.height;

	const ctx = canvas.getContext('2d');

	const img = ctx.createImageData(width, height);

	let i = 0;

	for (let y = 0; y < height; y++) {

		for (let x = 0; x < width; x++) {

			const brightness = Math.floor(trail[i] * 255);

			img.data[i * 4 + 0] = brightness;
			img.data[i * 4 + 1] = brightness;
			img.data[i * 4 + 2] = brightness;
			img.data[i * 4 + 3] = 255;

			i++;
		}
	}

	ctx.putImageData(img, 0, 0);
}

onload = function() {

	settings_to_dom();

	const canvas = document.getElementById('simcanvas');
	const ctx = canvas.getContext('2d');

	let width;
	let height;
	let trail;

	const agents = [];

	/* AUTO RESIZE */

	function resize_canvas() {

		const dpr = window.devicePixelRatio || 1;

		canvas.width = Math.floor(window.innerWidth * dpr);
		canvas.height = Math.floor(window.innerHeight * dpr);

		canvas.style.width = window.innerWidth + 'px';
		canvas.style.height = window.innerHeight + 'px';

		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

		width = canvas.width;
		height = canvas.height;

		trail = new Float32Array(width * height);

		regenerate_next = true;
	}

	window.addEventListener('resize', resize_canvas);

	resize_canvas();

	/* FULLSCREEN */

	document.getElementById('fullscreen_btn')
	.addEventListener('click', async () => {

		if (!document.fullscreenElement) {

			await document.documentElement.requestFullscreen();

		} else {

			await document.exitFullscreen();
		}
	});

	function regenerate() {

		agents.length = 0;

		if (settings.start_in_circle) {

			const radius = Math.min(width, height) * 0.2;

			for (let i = 0; i < settings.num_agents; i++) {

				const t = 2 * Math.PI * i / settings.num_agents;

				agents.push({
					x: Math.cos(t) * radius + width / 2,
					y: Math.sin(t) * radius + height / 2,
					heading: t - Math.PI / 2,
				});
			}

		} else {

			for (let i = 0; i < settings.num_agents; i++) {

				agents.push({
					x: Math.random() * width,
					y: Math.random() * height,
					heading: Math.random() * Math.PI * 2,
				});
			}
		}

		regenerate_next = false;
	}

	function next_frame() {

		settings_from_dom();
		update_reset_button_enabled();

		if (regenerate_next) {
			regenerate();
		}

		trail = sim_step(
			agents,
			trail,
			width,
			height
		);

		render(trail, canvas, agents);

		requestAnimationFrame(next_frame);
	}

	next_frame();
};

var skip = function() {};