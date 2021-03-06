const childProcess = require('child_process');
const exec = (cmd) => new Promise((resolve, reject) => childProcess.exec(cmd, {
	timeout: 60 * 1000
}, (err, stdout) => {
	if (err) reject(err);
	else resolve(stdout.toString().split('\n'));
}));

function normalizeMac(mac) {
	const macBuf = Buffer.from(mac.replace(/:/g, ''), 'hex');
	macBuf[5] = macBuf[5] & 0b11111000;
	return macBuf.toString('hex');
}

const REn = /vx_mesh_lan[\t ]+([0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2})/;
const REtg = / \* *([0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}).*\[.W..\].*([0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2})/;
async function getLocalMacs() {
	const data = await exec('ssh root@fe80::b4f4:afff:fee6:bc54%vxens19 "batctl n && batctl tg"');
	const neigh = data
		.map((l) => REn.exec(l))
		.filter((re) => re)
		.map((re) => re[1])
		.map((mac) => normalizeMac(mac))

	const tg = data
		.map((l) => REtg.exec(l))
		.filter((re) => re)
		.map((re) => ({client: re[1], router: normalizeMac(re[2])}))
		.filter((item) => neigh.indexOf(item.router) !== -1)
		.map((item) => item.client)

	return tg;
}

module.exports = [[require('ftrm-basic/inject'), {
	name: 'freifunk-client-poll',
	output: 'home.haj.atf8.network.freifunkClients',
	inject: () => getLocalMacs(),
	interval: 3 * 60 * 1000
}], [require('ftrm-http/server'), {
	name: 'freifunk-client-rest-api',
	input: [{
		name: 'macs',
		pipe: 'home.haj.atf8.network.freifunkClients',
		convert: (v) => JSON.stringify({'ffh_clients': v || []})
	}, {
		name: 'temp_outdoor',
		pipe: 'home.haj.atf8.outside.temperature_degC'
	}],
	port: 8081
}]];
